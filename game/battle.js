"use strict";
// ===== 戦闘（ドラクエ風・みんなで たたかう）／オート戦闘／自動レベル上げ =====
const IMGC = {};
function foeImg(key){ if(!IMGC[key]){ const im = new Image(); im.src = "./img/" + key + ".webp"; IMGC[key] = im; } return IMGC[key]; }
const AUTO_DELAY = [700, 380, 130];

function bAlive(id){ return G.S.m[id].hp > 0; }
function bSpend(id, n){ if(!G.S.cx.infmp) G.S.m[id].mp = Math.max(0, G.S.m[id].mp - n); }
function bDmg(atk, def, mult){
    let d = Math.max(1, Math.round((atk - def / 2) * (mult || 1) * (0.88 + G.rnd() * 0.24)));
    const crit = G.rnd() < 1 / 16; if(crit) d = Math.round(d * 1.7);
    return {d, crit};
}
function battleStart(ids, after){
    const foes = ids.map((id) => Object.assign({id}, RPG_FOES[id], {cur:RPG_FOES[id].hp, stun:0}));
    const cnt = {}, seen = {};
    foes.forEach((f) => { cnt[f.n] = (cnt[f.n] || 0) + 1; });
    foes.forEach((f) => { if(cnt[f.n] > 1){ seen[f.n] = (seen[f.n] || 0) + 1; f.label = f.n + "ABCD"[seen[f.n] - 1]; } else f.label = f.n; });
    G.b = {foes, menu:"top", after, turn:1, buff:{atk:0, def:0}, boss:foes.some((f) => f.boss), spar:foes.some((f) => f.spar), log:[], guard:false, busy:false, text:foes.map((f) => f.label).join("、") + "が あらわれた！"};
    G.mode = "battle"; G.pend = null; G.bg = "";
    if(G.S.cx.areall) G.S.gauge = 100;
    G.auto = !!(G.autoPref || G.grind);
    render(); scheduleAuto();
}
function foesAlive(){ return G.b.foes.filter((f) => f.cur > 0); }
function areBonus(){ return [1, 2, 3, 4].filter((i) => G.S.f["fu_m" + i]).length; }
function battleView(){
    const b = G.b, S = G.S; if(!b) return "";
    const bar = (v, mx, cls) => '<span class="bar ' + (cls || "") + '"><i class="' + (cls !== "mp" && v / mx < 0.3 ? "lo" : "") + '" style="width:' + Math.max(0, Math.round(100 * v / mx)) + '%"></i></span>';
    const party = S.party.map((id) => { const st = tqStat(id), m = S.m[id]; return '<div class="l' + (m.hp <= 0 ? " ko" : "") + '">' + esc(tqName(id)) + ' Lv' + S.lv + ' HP ' + m.hp + bar(m.hp, st.maxhp) + ' MP ' + m.mp + bar(m.mp, st.maxmp, "mp") + '</div>'; }).join("");
    let cmd = "";
    if(G.auto){ cmd = '<button class="opt" data-a="bauto">⏹ オートを とめる</button>' + (G.grind ? '<button class="opt" data-a="grindStop">⏹ れんぞくを とめる</button>' : ""); }
    else if(b.busy){ cmd = ""; }
    else if(b.menu === "skill"){
        const l = Object.keys(TQ_SKILLS).filter((k) => S.lv >= TQ_SKILLS[k].lv);
        cmd = (l.length ? l.map((k) => '<button class="opt" data-a="bcmd" data-v="skill|' + k + '">' + esc(TQ_SKILLS[k].n) + '（MP' + TQ_SKILLS[k].mp + '）</button>').join("") : '<div class="meta">まだ とくぎを おぼえていない</div>') + '<button class="opt" data-a="bcmd" data-v="back">もどる</button>';
    }else if(b.menu === "item"){
        const l = Object.keys(RPG_ITEMS).filter((k) => S.items[k] > 0);
        cmd = (l.length ? l.map((k) => '<button class="opt" data-a="bcmd" data-v="item|' + k + '">' + esc(RPG_ITEMS[k].n) + '×' + S.items[k] + '</button>').join("") : '<div class="meta">どうぐが ない</div>') + '<button class="opt" data-a="bcmd" data-v="back">もどる</button>';
    }else if(b.menu === "target"){
        cmd = b.foes.map((f, i) => f.cur > 0 ? '<button class="opt" data-a="bcmd" data-v="tgt|' + i + '">' + esc(f.label) + '</button>' : "").join("") + '<button class="opt" data-a="bcmd" data-v="back">もどる</button>';
    }else if(b.menu === "ally"){
        cmd = S.party.map((id) => '<button class="opt" data-a="bcmd" data-v="ally|' + id + '">' + esc(tqName(id)) + '</button>').join("") + '<button class="opt" data-a="bcmd" data-v="back">もどる</button>';
    }else{
        cmd = '<button class="opt" data-a="bcmd" data-v="attack">⚔️ たたかう</button><button class="opt" data-a="bcmd" data-v="menu-skill">✨ とくぎ</button><button class="opt" data-a="bcmd" data-v="guard">🛡️ ぼうぎょ</button><button class="opt" data-a="bcmd" data-v="menu-item">🎒 どうぐ</button>' +
            (S.gauge >= 100 ? '<button class="opt" data-a="bcmd" data-v="are">🌟 ARE！</button>' : "") + '<button class="opt" data-a="bauto">🤖 オート戦闘</button>' + (b.boss ? "" : '<button class="opt" data-a="bcmd" data-v="run">🏃 にげる</button>');
    }
    return '<div id="bp" class="win">' + party + '</div><div id="bt" class="win">ターン ' + b.turn + (G.auto ? '　🤖オート' : '') + (G.grind ? '　⚡' + G.grind.n + '回' : '') + '</div>' + (cmd ? '<div id="bc" class="win">' + cmd + '</div>' : "") + '<div id="bm" class="win">' + esc(b.text) + '</div>';
}
function paintBattle(g, time){
    const b = G.b, bgm = ({sendai:["#8ecae6", "#e0f2e9"], tokyo:["#0b1020", "#1d2b53"], aprt:["#0b1020", "#1d2b53"], tower:["#1e2a4a", "#3a4a7a"], white:["#ffffff", "#e6edf5"], xmas:["#1d3557", "#a8dadc"], base:["#3a2a1a", "#7a5a3a"], labn:["#1b1f3b", "#2c3e70"], future:["#0b132b", "#5bc0be"], lab:["#6b8aa8", "#cfe0ee"], xr:["#2a1b5e", "#c9a7ff"]})[b.foes.find((f) => f.bg) ? b.foes.find((f) => f.bg).bg : G.S.map] || ["#9ad0f5", "#d9f0ff"];
    const gr = g.createLinearGradient(0, 0, 0, 360); gr.addColorStop(0, bgm[0]); gr.addColorStop(1, bgm[1]);
    g.fillStyle = gr; g.fillRect(0, 0, 640, 360);
    g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(0, 250, 640, 110);
    const n = b.foes.length, big = n === 1 ? (b.foes[0].boss ? 130 : 104) : n === 2 ? 84 : n === 3 ? 70 : 58;
    b.foes.forEach((f, i) => {
        if(f.cur <= 0) return;
        const sp = n === 1 ? 0 : Math.min(150, 440 / n), cx = 340 + (i - (n - 1) / 2) * sp, cy = 120 + (n === 1 ? 0 : (i % 2 ? 16 : -4)), bob = Math.sin(time / 420 + i) * 3;
        const hit = G.hit && G.hit.idx === i && time < G.hit.until;
        g.save(); if(hit) g.translate((Math.random() - 0.5) * 8, 0);
        g.globalAlpha = hit ? 0.55 : 1;
        if(f.img){ const im = foeImg(f.img); if(im.complete && im.naturalWidth){ const h = 190, w = h * im.naturalWidth / im.naturalHeight; g.drawImage(im, cx - w / 2, cy - h / 2 + bob + 6, w, h); } }
        else{ g.font = big + "px serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#000"; g.fillText(f.e, cx, cy + bob); }
        g.restore();
        g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(cx, 232, f.img ? 40 : big / 2.2, 6, 0, 0, 7); g.fill();
        g.fillStyle = "#1f2937"; g.fillRect(cx - 40, 242, 80, 7); g.fillStyle = f.cur / f.hp > 0.3 ? "#34d399" : "#ef4444"; g.fillRect(cx - 40, 242, 80 * f.cur / f.hp, 7);
        g.font = "bold 12px sans-serif"; g.fillStyle = "#111"; g.textAlign = "center"; g.textBaseline = "alphabetic"; g.fillText(f.label, cx, 262);
        if(f.stun > 0){ g.font = "18px serif"; g.fillText("💫", cx + 30, cy - 40); }
    });
    g.fillStyle = "rgba(0,0,0,.5)"; g.fillRect(250, 342, 140, 9); g.fillStyle = G.S.gauge >= 100 ? "#fbbf24" : "#60a5fa"; g.fillRect(250, 342, 140 * G.S.gauge / 100, 9);
    g.font = "bold 10px sans-serif"; g.fillStyle = "#fff"; g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillText("ARE ゲージ" + (G.S.gauge >= 100 ? "  MAX！" : ""), 250, 338);
}
function bLog(t){ G.b.log.push(t); }
function bHit(i){ G.hit = {idx:i, until:Date.now() + 260}; }
function bHurt(id, d){
    const m = G.S.m[id]; if(G.S.cx.god) d = 0;
    m.hp = Math.max(0, m.hp - d); G.S.gauge = Math.min(100, G.S.gauge + 6);
    if(m.hp === 0) bLog(tqName(id) + "は たおれた…！");
}
function bFoeHurt(f, d){
    if(G.S.cx.onehit) d *= 100;
    f.cur = Math.max(0, f.cur - d);
    if(f.cur === 0) bLog(f.label + "を たおした！");
    else if(f.boss && !f.sayDone && f.cur <= f.hp / 2 && f.say50){ f.sayDone = true; bLog(rpgFmt(f.say50)); }
    return d;
}
// ---------------------------------------------------------------- コマンド
ACT.bcmd = (v) => {
    if(G.mode !== "battle" || !G.b || G.b.busy || G.auto) return;
    const [c, arg] = String(v).split("|"), b = G.b, S = G.S;
    if(c === "back"){ b.menu = "top"; G.pend = null; render(); return; }
    if(c === "menu-skill"){ b.menu = "skill"; render(); return; }
    if(c === "menu-item"){ b.menu = "item"; render(); return; }
    if(c === "attack"){ if(foesAlive().length > 1){ G.pend = {k:"attack"}; b.menu = "target"; render(); } else heroTurn({k:"attack", t:foesAlive()[0]}); return; }
    if(c === "skill"){
        const sk = TQ_SKILLS[arg]; if(!sk || S.lv < sk.lv) return;
        if(S.m.hero.mp < sk.mp && !S.cx.infmp){ b.text = "MPが たりない！"; render(); return; }
        if(sk.t === "one"){ if(foesAlive().length > 1){ G.pend = {k:"skill", id:arg}; b.menu = "target"; render(); } else heroTurn({k:"skill", id:arg, t:foesAlive()[0]}); }
        else if(sk.t === "ally"){ G.pend = {k:"skill", id:arg}; b.menu = "ally"; render(); }
        else heroTurn({k:"skill", id:arg});
        return;
    }
    if(c === "item"){ if(!S.items[arg]){ b.text = "もっていない！"; render(); return; } G.pend = {k:"item", id:arg}; b.menu = "ally"; render(); return; }
    if(c === "tgt"){ const f = b.foes[Number(arg)]; if(!f || f.cur <= 0) return; const p = G.pend || {k:"attack"}; G.pend = null; heroTurn(Object.assign({}, p, {t:f})); return; }
    if(c === "ally"){ const p = G.pend; G.pend = null; if(!p) return; heroTurn(Object.assign({}, p, {to:arg})); return; }
    if(c === "guard"){ heroTurn({k:"guard"}); return; }
    if(c === "are"){ if(S.gauge < 100){ b.text = "ARE ゲージが まだ たまっていない！"; render(); return; } heroTurn({k:"are"}); return; }
    if(c === "run"){ heroTurn({k:"run"}); return; }
};
ACT.bauto = () => { G.autoPref = !G.auto; G.auto = G.autoPref; if(!G.auto) G.grind = null; render(); if(G.auto) scheduleAuto(); };
function heroTurn(act){ battleRound(act); }
// ---------------------------------------------------------------- 1ターン
function battleRound(heroAct){
    const b = G.b, S = G.S; b.log = []; b.menu = "top";
    const acts = [];
    S.party.forEach((id) => { if(bAlive(id)) acts.push({t:"p", id, agi:tqStat(id).agi + G.rnd() * 6 + (id === "hero" ? 10 : 0)}); });
    b.foes.forEach((f) => { if(f.cur > 0) acts.push({t:"f", f, agi:f.hp / 40 + G.rnd() * 6 + 4}); });
    acts.sort((a, c) => c.agi - a.agi);
    if(heroAct.k === "run") acts.sort((a, c) => (c.t === "p" && c.id === "hero" ? 1 : 0) - (a.t === "p" && a.id === "hero" ? 1 : 0));
    b.guard = heroAct.k === "guard";
    for(const a of acts){
        if(foesAlive().length === 0) break;
        if(!S.party.some((id) => bAlive(id))) break;
        if(a.t === "p"){
            if(!bAlive(a.id)) continue;
            if(a.id === "hero"){ if(heroAction(heroAct)) return; } else allyAction(a.id);
        }else{ if(a.f.cur <= 0) continue; foeAction(a.f); }
    }
    roundEnd();
}
function heroAction(act){
    const b = G.b, S = G.S, hn = S.name, st = tqStat("hero"), atkB = b.buff.atk > 0 ? 1.25 : 1;
    if(S.cx.areall) S.gauge = 100;
    if(act.k === "attack"){
        let t = act.t; if(!t || t.cur <= 0) t = foesAlive()[0]; if(!t) return false;
        const r = bDmg(st.atk * atkB, t.def, 1), d = bFoeHurt(t, r.d); bHit(b.foes.indexOf(t)); S.gauge = Math.min(100, S.gauge + 10);
        bLog(hn + "の こうげき！" + (r.crit ? "（かいしんのいちげき！）" : "") + " " + t.label + "に " + d + "のダメージ！"); return false;
    }
    if(act.k === "guard"){ bLog(hn + "は みを まもっている。"); S.gauge = Math.min(100, S.gauge + 8); return false; }
    if(act.k === "run"){
        if(b.boss){ bLog("この あいてからは にげられない！"); return false; }
        if(G.rnd() < 0.6){ bLog("うまく にげきれた！"); endBattle("run"); return true; }
        bLog("しかし まわりこまれて しまった！"); return false;
    }
    if(act.k === "item"){
        const it = RPG_ITEMS[act.id]; if(!S.items[act.id]) return false; const to = act.to || "hero";
        if(it.revive){ if(bAlive(to)){ bLog("たおれていない…！"); return false; } S.items[act.id]--; S.m[to].hp = Math.ceil(tqStat(to).maxhp / 2); bLog(tqName(to) + "は ふっかつした！"); return false; }
        if(!bAlive(to)){ bLog("たおれていて つかえない！"); return false; }
        S.items[act.id]--; const mm = S.m[to], mx = tqStat(to);
        if(it.hp){ const before = mm.hp; mm.hp = Math.min(mx.maxhp, mm.hp + it.hp); bLog(it.n + "を つかった。" + tqName(to) + "の HPが " + (mm.hp - before) + " かいふく！"); }
        if(it.mp){ const before = mm.mp; mm.mp = Math.min(mx.maxmp, mm.mp + it.mp); bLog(it.n + "を のんだ。" + tqName(to) + "の MPが " + (mm.mp - before) + " かいふく！"); }
        return false;
    }
    if(act.k === "skill"){
        const sk = TQ_SKILLS[act.id], m = S.m.hero; if(m.mp < sk.mp && !S.cx.infmp) return false; bSpend("hero", sk.mp);
        if(act.id === "code"){ let t = act.t; if(!t || t.cur <= 0) t = foesAlive()[0]; if(!t) return false; const r = bDmg(st.atk * atkB, t.def, sk.p), d = bFoeHurt(t, r.d); bHit(b.foes.indexOf(t)); S.gauge = Math.min(100, S.gauge + 12); bLog(hn + "の コードアタック！" + (r.crit ? "（かいしん！）" : "") + " " + t.label + "に " + d + "のダメージ！"); }
        else if(act.id === "beam"){ bLog(hn + "は デバッグ・ビームを はなった！"); foesAlive().forEach((t) => { const r = bDmg(st.atk * atkB, t.def, sk.p), d = bFoeHurt(t, r.d); bHit(b.foes.indexOf(t)); bLog(t.label + "に " + d + "のダメージ！"); }); S.gauge = Math.min(100, S.gauge + 12); }
        else if(act.id === "recover"){ const to = act.to || "hero", mm = S.m[to]; if(!bAlive(to)){ bLog("たおれていて きかない！"); return false; } const h = 40 + S.lv * 5, before = mm.hp; mm.hp = Math.min(tqStat(to).maxhp, mm.hp + h); bLog("「そういうときは、あれ(ARE)を使おう！」リカバリー！ " + tqName(to) + "の HPが " + (mm.hp - before) + " かいふく！"); }
        else if(act.id === "freeze"){ bLog(hn + "は タイムストップを となえた！"); foesAlive().forEach((t) => { if(G.rnd() < (t.boss ? 0.35 : 0.7)){ t.stun = 2; bLog(t.label + "は うごけなくなった！"); } else bLog(t.label + "には きかなかった！"); }); }
        return false;
    }
    if(act.k === "are"){
        const bn = areBonus(); S.gauge = 0; if(S.cx.areall) S.gauge = 100;
        bLog(hn + "「そうだ！ そういうときは、あれ(ARE)を使おう！」" + (bn ? "（つながり ×" + bn + "）" : ""));
        foesAlive().forEach((t) => { const d0 = Math.max(1, Math.round((st.atk * 2.2 * (1 + 0.12 * bn)) - t.def / 3)), d = bFoeHurt(t, d0); bHit(b.foes.indexOf(t)); bLog(t.label + "に " + d + "のダメージ！"); });
        S.party.forEach((id) => { const mm = S.m[id], mx = tqStat(id); if(mm.hp <= 0 && bn >= 1){ mm.hp = Math.ceil(mx.maxhp * 0.2); bLog(tqName(id) + "が ふっかつした！"); } if(mm.hp > 0) mm.hp = Math.min(mx.maxhp, mm.hp + Math.round(mx.maxhp * (0.35 + 0.05 * bn))); });
        bLog("みんなの HPが かいふくした！");
    }
    return false;
}
function weakestAlly(){
    const S = G.S, al = S.party.filter((x) => bAlive(x)).sort((a, c) => S.m[a].hp / tqStat(a).maxhp - S.m[c].hp / tqStat(c).maxhp);
    return al[0] ? {id:al[0], r:S.m[al[0]].hp / tqStat(al[0]).maxhp} : null;
}
function allyAction(id){
    const b = G.b, S = G.S, st = tqStat(id), m = S.m[id], nm = tqName(id), atkB = b.buff.atk > 0 ? 1.25 : 1, w = weakestAlly(), cls = RPG_CLASS[id];
    const role = id === "haruki" ? "heal" : id === "akito" ? "buff" : (cls.role || "atk");
    const healUp = (mult, txt) => { const h = Math.round((28 + S.lv * 4) * mult), mm = S.m[w.id], before = mm.hp; mm.hp = Math.min(tqStat(w.id).maxhp, mm.hp + h); bLog(nm + "の " + txt + "！ " + tqName(w.id) + "の HPが " + (mm.hp - before) + " かいふく！"); };
    if(role === "heal" && w && w.r < 0.55 && (m.mp >= 3 || S.cx.infmp)){ bSpend(id, 3); healUp(1, id === "haruki" ? "コーヒーブレイク" : "いやしの うた"); return; }
    if(id === "haruki" && S.lv >= 5 && b.buff.def <= 0 && (m.mp >= 5 || S.cx.infmp) && G.rnd() < 0.3){ bSpend(id, 5); b.buff.def = 3; bLog(nm + "の ファイアウォール！ みんなの ぼうぎょが あがった！"); return; }
    if(id === "akito" && S.lv >= 3 && b.buff.atk <= 0 && (m.mp >= 4 || S.cx.infmp) && G.rnd() < 0.3){ bSpend(id, 4); b.buff.atk = 3; bLog(nm + "「そうだ！ そういうときは…！」チアアップ！ みんなの こうげきが あがった！"); return; }
    if(role === "buff" && id !== "akito" && b.buff.atk <= 0 && (m.mp >= 4 || S.cx.infmp) && G.rnd() < 0.4){ bSpend(id, 4); b.buff.atk = 3; bLog(nm + "の おうえんダンス！ みんなの こうげきが あがった！"); return; }
    const fa = foesAlive(); if(!fa.length) return;
    if(role === "mage" && (m.mp >= 5 || S.cx.infmp) && fa.length > 1 && G.rnd() < 0.6){ bSpend(id, 5); bLog(nm + "の まほう！ きらめく ほのお！"); fa.forEach((t) => { const r = bDmg(st.atk * atkB, t.def, 0.85), d = bFoeHurt(t, r.d); bHit(b.foes.indexOf(t)); bLog(t.label + "に " + d + "のダメージ！"); }); S.gauge = Math.min(100, S.gauge + 5); return; }
    const t = fa[Math.floor(G.rnd() * fa.length) % fa.length], big = (role === "mage" && (m.mp >= 3 || S.cx.infmp)) ? 1.6 : G.rnd() < 0.2 ? 1.5 : 1;
    if(role === "mage" && big === 1.6) bSpend(id, 3);
    const r = bDmg(st.atk * atkB, t.def, big), d = bFoeHurt(t, r.d); bHit(b.foes.indexOf(t)); S.gauge = Math.min(100, S.gauge + 4);
    bLog(nm + "の " + (role === "mage" && big === 1.6 ? "まほうの 矢！ " : big > 1 ? "ばくれつ こうげき！ " : "こうげき！ ") + t.label + "に " + d + "のダメージ！");
}
function foeAction(f){
    const b = G.b, S = G.S;
    if(f.stun > 0){ f.stun--; bLog(f.label + "は うごけない！"); return; }
    const alive = S.party.filter((id) => bAlive(id)); if(!alive.length) return;
    const list = f.acts && f.acts.length ? f.acts : [["こうげき", 0, 1, 1.2]], tot = list.reduce((a, c) => a + c[2], 0);
    let r = G.rnd() * tot, act = list[0]; for(const a of list){ r -= a[2]; if(r <= 0){ act = a; break; } }
    const defB = b.buff.def > 0 ? 1.3 : 1;
    const hit = (id, mult) => {
        const st = tqStat(id); let def = st.def * defB; if(id === "hero" && b.guard) def *= 2;
        const d = bDmg(f.atk, def, mult * (id === "hero" && b.guard ? 0.6 : 1)); bHurt(id, d.d); bLog(tqName(id) + "は " + (S.cx.god ? 0 : d.d) + "の ダメージを うけた！" + (d.crit && !S.cx.god ? "（つうこんの いちげき！）" : ""));
    };
    bLog(f.label + "の " + act[0] + "！");
    if(act[1] === 1) alive.forEach((id) => hit(id, act[3]));
    else{ const wts = alive.map((id) => (RPG_CLASS[id].role === "tank" ? 2.2 : 1)), tw = wts.reduce((a, c) => a + c, 0); let q = G.rnd() * tw, pick = alive[0]; for(let i = 0; i < alive.length; i++){ q -= wts[i]; if(q <= 0){ pick = alive[i]; break; } } hit(pick, act[3]); }
}
function roundEnd(){
    const b = G.b, S = G.S;
    if(foesAlive().length === 0){ endBattle("win"); return; }
    if(!S.party.some((id) => bAlive(id))){ endBattle("lose"); return; }
    b.turn++; if(b.buff.atk > 0) b.buff.atk--; if(b.buff.def > 0) b.buff.def--;
    if(S.cx.areall) S.gauge = 100;
    b.text = b.log.slice(-8).join("\n"); b.busy = false; render(); scheduleAuto();
}
function endBattle(res){
    const b = G.b, S = G.S, log = b.log.slice(-6);
    if(res === "run"){ G.mode = "map"; G.b = null; G.info = log.join("\n"); render(); tqAutoSave(); return; }
    if(res === "lose"){
        const spar = b.spar, after = b.after; G.b = null; G.scripts.length = 0; tqHealAll();
        if(spar){
            G.scripts.push({a:(after || []).slice(), i:0}); G.scripts.push({a:[["say", "", "（模擬戦だから、負けても だいじょうぶ！ みんな すぐに 元気に なった。）"]], i:0}); G.mode = "script"; pump(); return;
        }
        G.grind = null; G.auto = false; S.gold = Math.floor(S.gold / 2); gotoMap("lab", 8, 9); G.scripts.length = 0; G.mode = "map";
        G.info = log.join("\n") + "\n\n" + rpgFmt("{名前}たちは たおれて しまった…\nけれど ラボの ソファで めをさました。（ゴールドが 半分に なった）"); render(); tqAutoSave(); return;
    }
    let gold = 0, exp = 0; b.foes.forEach((f) => { gold += f.g; exp += f.exp; });
    S.gold = Math.min(TQ_MAX_GOLD, S.gold + gold); S.kills += b.foes.length;
    const lines = log.slice(); lines.push(rpgFmt("たたかいに しょうり！ " + Math.round(exp * (S.expmul || 1)).toLocaleString() + "EXP と " + gold + "G を てにいれた。"));
    if(!b.boss && G.rnd() < 0.18){ S.items.onigiri = Math.min(99, (S.items.onigiri || 0) + 1); lines.push("おにぎりを ひろった！"); }
    else if(!b.boss && G.rnd() < 0.03){ S.items.omamori = Math.min(99, (S.items.omamori || 0) + 1); lines.push("ふっかつのおまもりを ひろった！"); }
    tqGain(exp).forEach((u) => lines.push(u));
    S.party.forEach((id) => { if(S.m[id].hp <= 0) S.m[id].hp = 1; });
    const after = b.after; G.b = null;
    if(G.grind){ G.grind.n++; S.grinds = (S.grinds || 0) + 1; }
    if(after) G.scripts.push({a:after, i:0});
    tqAutoSave();
    if(after || G.scripts.length){ G.scripts.push({a:[["say", "", lines.join("\n")]], i:0}); G.mode = "script"; pump(); }
    else{ G.mode = "map"; G.info = G.grind ? "" : lines.join("\n"); render(); }
}
// ---------------------------------------------------------------- オート戦闘（ヒーローの行動を自動で選ぶ）
function autoChoice(){
    const S = G.S, h = S.m.hero, b = G.b, w = weakestAlly();
    if(S.gauge >= 100) return {k:"are"};
    if(w && w.r < 0.3 && S.items.special > 0) return {k:"item", id:"special", to:w.id};
    if(w && w.r < 0.45 && S.lv >= 3 && (h.mp >= 4 || S.cx.infmp) && bAlive("hero")) return {k:"skill", id:"recover", to:w.id};
    if(w && w.r < 0.4 && S.items.onigiri > 0) return {k:"item", id:"onigiri", to:w.id};
    if(h.mp < 5 && S.items.coffee > 0 && !S.cx.infmp && h.mp < tqStat("hero").maxmp * 0.2 && G.rnd() < 0.3) return {k:"item", id:"coffee", to:"hero"};
    if(S.lv >= 6 && (h.mp >= 7 || S.cx.infmp) && foesAlive().length > 1) return {k:"skill", id:"beam"};
    if(S.lv >= 2 && (h.mp >= 3 || S.cx.infmp) && (b.boss || foesAlive()[0].hp > 60)) return {k:"skill", id:"code", t:foesAlive().slice().sort((a, c) => c.cur - a.cur)[0]};
    return {k:"attack", t:foesAlive()[0]};
}
function scheduleAuto(){
    clearTimeout(G.autoT);
    if(!G.auto || G.mode !== "battle" || !G.b) return;
    G.autoT = setTimeout(() => {
        if(!G.auto || G.mode !== "battle" || !G.b) return;
        if(!bAlive("hero")){ const alive = G.S.party.find((x) => bAlive(x)); void alive; }
        const act = bAlive("hero") ? autoChoice() : {k:"guard"};
        battleRound(act);
    }, AUTO_DELAY[G.set.speed || 0]);
}
// ---------------------------------------------------------------- 自動レベル上げ（れんぞく戦闘）
ACT.autoPref = () => { G.autoPref = !G.autoPref; render(); };
ACT.grindStart = () => {
    const S = G.S; if(!curMap().enc){ G.menuMsg = "ここでは できません。"; render(); return; }
    if(S.lv >= TQ_MAX_LV){ G.menuMsg = "もう レベル99 です！"; render(); return; }
    G.grind = {n:0}; G.auto = true; G.autoPref = true; G.mode = "map"; G.info = "れんぞく戦闘 スタート！（なにかキー・ボタンで ストップ）"; render(); startGrindLoop();
};
ACT.grindStop = () => stopGrind();
function stopGrind(msg){
    clearInterval(G.grindT); const n = G.grind ? G.grind.n : 0; G.grind = null; G.auto = false; G.autoPref = false; clearTimeout(G.autoT);
    if(G.mode === "map"){ G.info = msg || ("れんぞく戦闘を ストップ。（" + n + "回 たたかった）"); }
    toast(msg || ("れんぞく戦闘 ストップ（" + n + "回）")); render();
}
function startGrindLoop(){
    clearInterval(G.grindT);
    G.grindT = setInterval(() => {
        if(!G.grind){ clearInterval(G.grindT); return; }
        if(G.mode !== "map") return;
        const S = G.S;
        if(S.lv >= TQ_MAX_LV){ stopGrind("レベル99に なりました！ おめでとう！"); return; }
        // 回復：弱っている仲間におにぎり／MPがなければコーヒー
        const w = weakestAlly();
        if(!w){ stopGrind("ぜんいん たおれています。"); return; }
        let guard = 0;
        while(guard++ < 8){
            const ww = weakestAlly(); if(!ww || ww.r >= 0.55) break;
            const it = S.items.special > 0 && ww.r < 0.3 ? "special" : S.items.onigiri > 0 ? "onigiri" : S.items.special > 0 ? "special" : null;
            if(!it) break; useItem(it, ww.id);
        }
        S.party.forEach((id) => { if(!bAlive(id) && S.items.omamori > 0) useItem("omamori", id); });
        const w2 = weakestAlly();
        if(w2 && w2.r < 0.3){ stopGrind("HPが ひくいので ストップしました。（おにぎりが ないよ）"); return; }
        const mpLow = S.m.hero.mp < 3 && S.lv >= 2 && !S.cx.infmp; if(mpLow && S.items.coffee > 0) useItem("coffee", "hero");
        G.lastEnc = S.steps; G.info = ""; encounter();
    }, 450);
}
