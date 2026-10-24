"use strict";
// ===== ARE 〜そういうときは、AREだ！〜（2D RPG・ドラクエ7ふうのタイムスリップ冒険）=====
// ・主人公は20歳の社会人。男女を選べて、名前はプロフィールの表示名（変えられます）。
// ・過去の世界へタイムスリップして、ノイズ（かわいいモンスター）に持っていかれた大事な「メモリ」を取りもどす物語。
// ・BGMはありません。声は、ブラウザの読み上げ（許可されていれば）で流れます。
// ・セーブはこの端末のブラウザに自動で保存されます。操作：矢印キー/WASD、決定=Enter/Z/Space、メニュー=X/M。
// データは chat-rpg-data.js / chat-rpg-maps.js / chat-rpg-story.js にあります。

const RPG_TS = 32, RPG_VW = 15, RPG_VH = 10;
const RPG_SKILLS = {
    code:{n:"コードアタック", mp:3, lv:2, t:"one", p:1.8, d:"つよい 一撃"},
    recover:{n:"リカバリー", mp:4, lv:3, t:"ally", d:"なかまを かいふく"},
    beam:{n:"デバッグ・ビーム", mp:7, lv:6, t:"all", p:1.0, d:"てき ぜんたいに こうげき"},
    freeze:{n:"タイムストップ", mp:9, lv:10, t:"all", d:"てきの うごきを とめる"}
};
const rpg = {s:null, mode:"create", sc:[], b:null, rnd:() => Math.random(), uid:"x", cv:null, g:null, menu:"", keyH:null, voice:true, tw:null, tick:null, npcDir:{}, banner:null, hit:null, choices:null, sex:"m", nameDraft:"", pending:null, shopMsg:"", menuMsg:"", lastEnc:0};

// ---------------------------------------------------------------- 文字の置きかえ・読み上げ
function rpgFmt(t){
    const s = rpg.s || {sex:rpg.sex || "m", name:"ユウ"}, m = s.sex === "m";
    return String(t).replace(/\[\[([^|\]]*)\|([^\]]*)\]\]/g, (_x, a, b) => m ? a : b)
        .replace(/\{名前\}/g, s.name).replace(/\{私\}/g, m ? "俺" : "わたし").replace(/\{くん\}/g, m ? "くん" : "ちゃん");
}
function rpgVoicePref(){ try{ return localStorage.getItem("are_rpg_voice") !== "off"; }catch(_e){ return true; } }
function rpgSpeak(text, who){
    if(!rpg.voice) return;
    try{
        if(!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance !== "function") return;
        const ss = window.speechSynthesis; ss.cancel();
        const clean = String(text).replace(/\(ARE\)/g, "アレ").replace(/ARE/g, "アレ").replace(/[「」『』（）()…♪★☆]/g, "、").replace(/\s+/g, "");
        if(!clean.replace(/、/g, "").trim()) return;
        const key = who === "me" ? "me:" + (rpg.s ? rpg.s.sex : "m") : (who || "");
        const v = RPG_VOICES[key] || RPG_VOICES[""] || [1, 1];
        const u = new SpeechSynthesisUtterance(clean); u.lang = "ja-JP"; u.pitch = v[0]; u.rate = v[1];
        const jp = (ss.getVoices() || []).find((x) => /^ja/i.test(x.lang)); if(jp) u.voice = jp;
        ss.speak(u);
    }catch(_e){}
}
function rpgSpeakStop(){ try{ window.speechSynthesis && window.speechSynthesis.cancel(); }catch(_e){} }

// ---------------------------------------------------------------- 状態・セーブ
function rpgNew(sex, name){
    return {v:2, sex:sex || "m", name:name || "ユウ", map:"lab", x:8, y:9, dir:"up", px:8, py:9, lv:1, exp:0, gold:60, party:["hero"], m:{hero:{hp:1, mp:1}},
        items:{onigiri:3, coffee:1}, own:["w0", "a0", "c0"], eq:{w:"w0", a:"a0", c:"c0"}, f:{}, mem:[0, 0, 0, 0, 0, 0], steps:0, kills:0, gauge:0, trail:[], wh:{}};
}
function rpgKey(){ return "are_rpg2_" + rpg.uid; }
function rpgSave(){ try{ if(rpg.s) localStorage.setItem(rpgKey(), JSON.stringify(rpg.s)); }catch(_e){} }
function rpgLoad(){
    try{
        const s = JSON.parse(localStorage.getItem(rpgKey()) || "null");
        if(s && s.v === 2 && RPG_MAPS[s.map]) return Object.assign(rpgNew(s.sex, s.name), s);
    }catch(_e){}
    return null;
}
function rpgMemCount(){ return rpg.s ? rpg.s.mem.reduce((a, b) => a + b, 0) : 0; }
function rpgCond(c){
    if(!c) return true;
    return String(c).split("&").every((t0) => {
        let t = t0.trim(), neg = false; if(t[0] === "!"){ neg = true; t = t.slice(1); }
        const m = t.match(/^(mem|lv)>=(\d+)$/); let r;
        if(m) r = (m[1] === "mem" ? rpgMemCount() : rpg.s.lv) >= Number(m[2]); else r = !!rpg.s.f[t];
        return neg ? !r : r;
    });
}
function rpgStatOf(id){
    const c = RPG_CLASS[id], L = rpg.s.lv, v = (a) => Math.round(a[0] + a[1] * L), e = rpg.s.eq;
    const st = {maxhp:v(c.hp), maxmp:v(c.mp), atk:v(c.atk), def:v(c.def), agi:v(c.agi)};
    const w = RPG_EQUIP[e.w].v, a = RPG_EQUIP[e.a].v + RPG_EQUIP[e.c].v;
    if(id === "hero"){ st.atk += w; st.def += a; } else { st.atk += Math.round(w * 0.6); st.def += Math.round(a * 0.6); }
    return st;
}
function rpgName(id){ return id === "hero" ? rpg.s.name : (RPG_CLASS[id].n || id); }
function rpgHeal(){
    rpg.s.party.forEach((id) => { const st = rpgStatOf(id); rpg.s.m[id] = {hp:st.maxhp, mp:st.maxmp}; });
}
function rpgClampHp(){ rpg.s.party.forEach((id) => { const st = rpgStatOf(id), m = rpg.s.m[id]; m.hp = Math.min(m.hp, st.maxhp); m.mp = Math.min(m.mp, st.maxmp); }); }
function rpgGain(exp){
    const s = rpg.s, ups = [];
    s.exp += exp;
    while(s.lv < 30 && s.exp >= rpgNeed(s.lv)){
        s.exp -= rpgNeed(s.lv);
        const before = {}; s.party.forEach((id) => { before[id] = rpgStatOf(id); });
        s.lv++;
        s.party.forEach((id) => { const a = rpgStatOf(id), m = s.m[id]; m.hp = Math.min(a.maxhp, m.hp + (a.maxhp - before[id].maxhp)); m.mp = Math.min(a.maxmp, m.mp + (a.maxmp - before[id].maxmp)); });
        let t = "レベル" + s.lv + " に あがった！";
        Object.keys(RPG_SKILLS).forEach((k) => { if(RPG_SKILLS[k].lv === s.lv) t += "\n" + s.name + "は「" + RPG_SKILLS[k].n + "」を おぼえた！"; });
        if(s.lv === 5 && s.party.includes("haruki")) t += "\nハルキは「ファイアウォール」を おぼえた！";
        if(s.lv === 3 && s.party.includes("akito")) t += "\nアキトは「チアアップ」を おぼえた！";
        ups.push(t);
    }
    if(s.lv >= 30) s.exp = 0;
    return ups;
}

// ---------------------------------------------------------------- 地図まわり
function rpgMap(){ return RPG_MAPS[rpg.s.map]; }
function rpgTileCh(mapId, x, y){ const r = RPG_MAPS[mapId].rows[y]; return r ? (r[x] || null) : null; }
function rpgVisible(o){ return (!o.hide || !rpgCond(o.hide)) && (!o.show || rpgCond(o.show)); }
function rpgNpcAt(x, y){ return (rpgMap().objs || []).find((o) => o.k === "npc" && o.x === x && o.y === y && rpgVisible(o)); }
function rpgObjAt(x, y, kind){ return (rpgMap().objs || []).find((o) => o.k === kind && o.x === x && o.y === y); }
function rpgWalkable(x, y){
    const ch = rpgTileCh(rpg.s.map, x, y); if(!ch) return false;
    const t = RPG_TILES[ch]; if(!t || !t.w) return false;
    return !rpgNpcAt(x, y);
}
const RPG_DIRS = {up:[0, -1], down:[0, 1], left:[-1, 0], right:[1, 0]};

function rpgGoto(map, x, y){
    const s = rpg.s; s.map = map; s.x = x; s.y = y; s.px = x; s.py = y; s.trail = []; rpg.tw = null;
    rpg.banner = {t:Date.now(), text:RPG_MAPS[map].name};
    rpgSave();
    const ev = RPG_ENTER[map];
    if(ev && RPG_EV[ev]) rpg.sc.push({a:RPG_EV[ev], i:0});
}
function rpgMove(dir){
    if(rpg.mode !== "map" || !rpg.s) return;
    const s = rpg.s, d = RPG_DIRS[dir]; if(!d) return;
    s.dir = dir;
    const nx = s.x + d[0], ny = s.y + d[1];
    const npc = rpgNpcAt(nx, ny);
    if(npc){ rpgTalk(npc); return; }
    if(!rpgWalkable(nx, ny)){ rpgPaint(); return; }
    s.px = s.x; s.py = s.y;
    s.trail.unshift([s.x, s.y]); s.trail = s.trail.slice(0, 3);
    s.x = nx; s.y = ny; s.steps++;
    rpg.tw = {t:Date.now(), dx:-d[0], dy:-d[1]};
    rpgAfterStep();
}
function rpgAfterStep(){
    const s = rpg.s, mp = rpgMap();
    const warp = rpgObjAt(s.x, s.y, "warp");
    if(warp){
        if(warp.need && !rpgCond(warp.need)){ rpgRun(RPG_EV[warp.deny || "tk_locked"] || [["say", "", "いまは はいれない。"], ["back"]]); return; }
        const w = ["warp", warp.to[0], warp.to[1], warp.to[2]];
        if(warp.ev && RPG_EV[warp.ev]) rpgRun(RPG_EV[warp.ev].concat([w])); else rpgRun([w]);
        return;
    }
    const btn = rpgObjAt(s.x, s.y, "btn");
    if(btn && !s.wh[btn.id]){
        s.wh[btn.id] = 1; const n = 3 - Object.keys(s.wh).length;
        const steps = [["say", "", "ピッ！ とうめいな ボタンを 押した！" + (n > 0 ? "（のこり " + n + "こ）" : "（ぜんぶ 押した！）")]];
        if(n === 0){ s.f.wh_all = 1; steps.push(["say", "アナウンくん", "…あれ？ ぜんぶ 押された！？ アナウンくんの ところへ 行こう！"]); }
        rpgRun(steps); return;
    }
    const st = rpgObjAt(s.x, s.y, "step");
    if(st && RPG_EV[st.ev]){ rpgRun(RPG_EV[st.ev]); return; }
    const ch = rpgTileCh(s.map, s.x, s.y), tev = mp.tev && mp.tev[ch];
    if(tev && tev[1] && RPG_EV[tev[0]]){ rpgRun(RPG_EV[tev[0]]); return; }
    if(mp.enc && !/[DGE]/.test(ch) && s.steps - rpg.lastEnc > 3 && rpg.rnd() < mp.enc.rate){
        rpg.lastEnc = s.steps;
        const list = mp.enc.f, tot = list.reduce((a, b) => a + b[1], 0); let r = rpg.rnd() * tot, pick = list[0];
        for(const f of list){ r -= f[1]; if(r <= 0){ pick = f; break; } }
        rpgBattleStart(pick[0].slice(), null);
        return;
    }
    rpgRefresh();
}
function rpgAct(){
    if(rpg.mode === "talk"){ rpgNext(); return; }
    if(rpg.mode !== "map" || !rpg.s) return;
    const s = rpg.s, d = RPG_DIRS[s.dir], fx = s.x + d[0], fy = s.y + d[1];
    const npc = rpgNpcAt(fx, fy);
    if(npc){ rpgTalk(npc); return; }
    const sign = rpgObjAt(fx, fy, "sign");
    if(sign && RPG_EV[sign.ev]){ rpgRun(RPG_EV[sign.ev]); return; }
    const ch = rpgTileCh(s.map, fx, fy), mp = rpgMap(), tev = mp.tev && mp.tev[ch];
    if(tev && RPG_EV[tev[0]]){ rpgRun(RPG_EV[tev[0]]); return; }
    if(s.map === "white" && !s.f.wh_all){
        const btns = (mp.objs || []).filter((o) => o.k === "btn" && !s.wh[o.id]);
        if(btns.length){
            const dist = Math.min(...btns.map((b) => Math.abs(b.x - s.x) + Math.abs(b.y - s.y)));
            rpgRun([["say", "", dist <= 2 ? "ぴりぴり…！ すぐ ちかくに ボタンが ある 気が する！" : dist <= 5 ? "なにか ちかくに ある 気が する…" : "…とおい。この あたりには なさそうだ。"]]);
            return;
        }
    }
    rpgRefresh();
}
function rpgTalk(npc){
    const s = rpg.s;
    rpg.npcDir[npc.id] = {up:"down", down:"up", left:"right", right:"left"}[s.dir];
    const ev = RPG_EV[npc.ev]; if(ev) rpgRun(ev);
}

// ---------------------------------------------------------------- 物語のスクリプト実行
function rpgRun(steps){ if(!steps) return; rpg.sc.push({a:steps, i:0}); if(rpg.mode === "map" || rpg.mode === "script" || rpg.mode === "menu") { rpg.mode = "script"; rpgPump(); } }
function rpgShowSay(who, text){
    const name = who === "me" ? rpg.s.name : who;
    const t = rpgFmt(text);
    rpgSetMsg(name, t);
    rpgSpeak(t, who);
}
function rpgSetMsg(name, text){
    const m = $("rpgMsg"); if(!m) return;
    m.innerHTML = (name ? "<b>" + escapeHtml(name) + "</b>\n" : "") + escapeHtml(text);
}
function rpgNext(){ if(rpg.mode === "talk"){ rpgSpeakStop(); rpgPump(); } }
function rpgChoose(i){
    if(rpg.mode !== "choice" || !rpg.choices) return;
    const c = rpg.choices[i]; rpg.choices = null; rpg.mode = "script";
    if(c) rpg.sc.push({a:c[1], i:0});
    rpgPump();
}
function rpgPump(){
    const st = rpg.sc, s = rpg.s;
    for(let guard = 0; guard < 4000; guard++){
        const fr = st[st.length - 1];
        if(!fr){ rpg.mode = "map"; rpgRefresh(); rpgSave(); return; }
        if(fr.i >= fr.a.length){ st.pop(); continue; }
        const op = fr.a[fr.i++], k = op[0];
        if(k === "say"){ rpg.mode = "talk"; rpgShowSay(op[1], op[2]); rpgRefresh(); return; }
        if(k === "choice"){ rpg.mode = "choice"; rpg.choices = op[1]; rpgRefresh(); return; }
        if(k === "set") s.f[op[1]] = 1;
        else if(k === "clr") delete s.f[op[1]];
        else if(k === "if"){ const br = rpgCond(op[1]) ? op[2] : op[3]; if(br && br.length) st.push({a:br, i:0}); }
        else if(k === "run"){ if(RPG_EV[op[1]]) st.push({a:RPG_EV[op[1]], i:0}); }
        else if(k === "pick"){ const l = op[1]; st.push({a:l[Math.floor(rpg.rnd() * l.length) % l.length], i:0}); }
        else if(k === "warp"){ rpgGoto(op[1], op[2], op[3]); }
        else if(k === "back"){ s.x = s.px; s.y = s.py; rpg.tw = null; }
        else if(k === "gold") s.gold += op[1];
        else if(k === "item"){ s.items[op[1]] = (s.items[op[1]] || 0) + (op[2] || 1); }
        else if(k === "mem"){ s.mem[op[1] - 1] = 1; }
        else if(k === "join"){ if(!s.party.includes(op[1])){ s.party.push(op[1]); const a = rpgStatOf(op[1]); s.m[op[1]] = {hp:a.maxhp, mp:a.maxmp}; } }
        else if(k === "heal") rpgHeal();
        else if(k === "battle"){ rpgBattleStart(op[1].slice(), op[2]); return; }
        else if(k === "shop"){ rpg.mode = "shop"; rpg.shopMsg = ""; rpgRefresh(); return; }
        else if(k === "gate"){ rpg.mode = "gate"; rpgRefresh(); return; }
        else if(k === "rename"){ rpg.mode = "rename"; rpgRefresh(); return; }
        else if(k === "recap"){ st.push({a:rpgRecap(), i:0}); }
        else if(k === "end"){ rpgEnding(); return; }
    }
    rpg.mode = "map"; rpgRefresh();
}
function rpgRecap(){
    const f = rpg.s.f, L = [];
    L.push(["say", "", "ここまでの おはなし。メモリは " + rpgMemCount() + "/6 こ。"]);
    const parts = [["e_sendai", "仙台で 迷惑ボーイ 玲也の ノイズを おとなしくさせ、ひかりのメモリを 取りもどした。"], ["e_tokyo", "夜の 東京で 蒼太さんを はげまし、さえこと コピペ・パンダを 説得して メモリを 手に入れた。"],
        ["e_white", "まっしろルームで『みんなで クリア』の ルールを 取りもどした。"], ["e_xmas", "クリスマスの 東京で 紘と いっしょに USBメモリを 取りかえした。"], ["e_labn", "ARE が 生まれた 夜の 研究室で 設計図を もらった。"]];
    parts.forEach((p) => { if(f[p[0]]) L.push(["say", "", p[1]]); });
    if(!f.e_sendai) L.push(["say", "", "まだ 旅は はじまったばかり。ゲートから 仙台へ 行こう。"]);
    if(f.e_future) L.push(["say", "", "そして 2035年。ノイズの 王は ARE の マスコットに なった。ARE は 完成した！"]);
    else if(rpgMemCount() >= 5) L.push(["say", "", "のこりは さいごの メモリ。2035年の ARE タワーへ。"]);
    return L;
}
function rpgEnding(){
    rpg.mode = "end"; rpg.sc.length = 0;
    const s = rpg.s;
    rpgSetMsg("", rpgFmt("ARE 〜そういうときは、AREだ！〜\n\nおわり\n\n{名前}は ARE を 完成させた！\nノイズだった ものは、いま ARE の やさしい マスコットに。\nそして 今日も どこかで だれかが つぶやく。\n「そうだ！ そういうときは、あれ(ARE)を使おう！」\n\n（歩数 " + s.steps + "・たおした数 " + s.kills + "・レベル " + s.lv + "）"));
    rpgSpeak("そうだ！ そういうときは、あれ(ARE)を使おう！", "アキト");
    rpgSave(); rpgRefresh();
}

// ---------------------------------------------------------------- 戦闘
function rpgAlive(id){ return rpg.s.m[id].hp > 0; }
function rpgDmg(atk, def, mult){
    let d = Math.max(1, Math.round((atk - def / 2) * (mult || 1) * (0.88 + rpg.rnd() * 0.24)));
    const crit = rpg.rnd() < 1 / 16; if(crit) d = Math.round(d * 1.7);
    return {d, crit};
}
function rpgBattleStart(ids, after){
    const foes = ids.map((id) => Object.assign({id}, RPG_FOES[id], {cur:RPG_FOES[id].hp, stun:0}));
    const cnt = {}, seen = {};
    foes.forEach((f) => { cnt[f.n] = (cnt[f.n] || 0) + 1; });
    foes.forEach((f) => { if(cnt[f.n] > 1){ seen[f.n] = (seen[f.n] || 0) + 1; f.label = f.n + "ABCD"[seen[f.n] - 1]; } else f.label = f.n; });
    rpg.b = {foes, menu:"top", after, turn:1, buff:{atk:0, def:0}, boss:foes.some((f) => f.boss), final:foes.some((f) => f.final), log:[], guard:false};
    rpg.mode = "battle"; rpg.pending = null;
    rpgSetMsg("", foes.map((f) => f.label).join("、") + "が あらわれた！");
    rpgRefresh();
}
function rpgFoesAlive(){ return rpg.b.foes.filter((f) => f.cur > 0); }
function rpgAreBonus(){ return [1, 2, 3, 4].filter((i) => rpg.s.f["fu_m" + i]).length; }
function rpgBattleCmd(c, arg){
    if(rpg.mode !== "battle" || !rpg.b) return;
    const b = rpg.b, s = rpg.s;
    if(c === "back"){ b.menu = "top"; rpg.pending = null; rpgRefresh(); return; }
    if(c === "menu-skill"){ b.menu = "skill"; rpgRefresh(); return; }
    if(c === "menu-item"){ b.menu = "item"; rpgRefresh(); return; }
    if(c === "attack"){ if(rpgFoesAlive().length > 1){ rpg.pending = {k:"attack"}; b.menu = "target"; rpgRefresh(); } else rpgRound({k:"attack", t:rpgFoesAlive()[0]}); return; }
    if(c === "skill"){
        const sk = RPG_SKILLS[arg]; if(!sk || s.lv < sk.lv) return;
        if(s.m.hero.mp < sk.mp){ rpgSetMsg("", "MPが たりない！"); return; }
        if(sk.t === "one"){ if(rpgFoesAlive().length > 1){ rpg.pending = {k:"skill", id:arg}; b.menu = "target"; rpgRefresh(); } else rpgRound({k:"skill", id:arg, t:rpgFoesAlive()[0]}); }
        else if(sk.t === "ally"){ rpg.pending = {k:"skill", id:arg}; b.menu = "ally"; rpgRefresh(); }
        else rpgRound({k:"skill", id:arg});
        return;
    }
    if(c === "item"){
        if(!s.items[arg]){ rpgSetMsg("", "もっていない！"); return; }
        rpg.pending = {k:"item", id:arg}; b.menu = "ally"; rpgRefresh(); return;
    }
    if(c === "tgt"){ const f = b.foes[Number(arg)]; if(!f || f.cur <= 0) return; const p = rpg.pending || {k:"attack"}; rpg.pending = null; rpgRound(Object.assign({}, p, {t:f})); return; }
    if(c === "ally"){ const p = rpg.pending; rpg.pending = null; if(!p) return; rpgRound(Object.assign({}, p, {to:arg})); return; }
    if(c === "guard"){ rpgRound({k:"guard"}); return; }
    if(c === "are"){ if(s.gauge < 100){ rpgSetMsg("", "ARE ゲージが まだ たまっていない！"); return; } rpgRound({k:"are"}); return; }
    if(c === "run"){ rpgRound({k:"run"}); return; }
}
function rpgLog(t){ rpg.b.log.push(t); }
function rpgHit(idx){ rpg.hit = {idx, until:Date.now() + 260}; }
function rpgHurtParty(id, d){
    const m = rpg.s.m[id]; m.hp = Math.max(0, m.hp - d); rpg.s.gauge = Math.min(100, rpg.s.gauge + 6);
    if(m.hp === 0) rpgLog(rpgName(id) + "は たおれた…！");
}
function rpgFoeHurt(f, d){
    f.cur = Math.max(0, f.cur - d);
    if(f.cur === 0) rpgLog(f.label + "を たおした！");
    else if(f.boss && !f.sayDone && f.cur <= f.hp / 2 && f.say50){ f.sayDone = true; rpgLog(rpgFmt(f.say50)); }
}
function rpgRound(heroAct){
    const b = rpg.b, s = rpg.s; b.log = []; b.menu = "top";
    const heroSt = rpgStatOf("hero");
    const acts = [];
    s.party.forEach((id) => { if(rpgAlive(id)) acts.push({t:"p", id, agi:rpgStatOf(id).agi + rpg.rnd() * 6 + (id === "hero" ? 10 : 0)}); });
    b.foes.forEach((f, i) => { if(f.cur > 0) acts.push({t:"f", f, i, agi:f.hp / 40 + rpg.rnd() * 6 + 4}); });
    acts.sort((a, c) => c.agi - a.agi);
    if(heroAct.k === "run") acts.sort((a, c) => (c.t === "p" && c.id === "hero" ? 1 : 0) - (a.t === "p" && a.id === "hero" ? 1 : 0));
    b.guard = heroAct.k === "guard";
    for(const a of acts){
        if(rpgFoesAlive().length === 0) break;
        if(!s.party.some((id) => rpgAlive(id))) break;
        if(a.t === "p"){
            if(!rpgAlive(a.id)) continue;
            if(a.id === "hero"){ if(rpgHeroAct(heroAct, heroSt)) return; }
            else rpgCompanionAct(a.id);
        }else{
            if(a.f.cur <= 0) continue;
            rpgFoeAct(a.f);
        }
    }
    rpgRoundEnd();
}
function rpgHeroAct(act, st){
    const b = rpg.b, s = rpg.s, hn = s.name, m = s.m.hero, atkB = b.buff.atk > 0 ? 1.25 : 1;
    if(act.k === "attack"){
        let t = act.t; if(!t || t.cur <= 0) t = rpgFoesAlive()[0]; if(!t) return false;
        const r = rpgDmg(st.atk * atkB, t.def, 1); rpgFoeHurt(t, r.d); rpgHit(b.foes.indexOf(t)); s.gauge = Math.min(100, s.gauge + 10);
        rpgLog(hn + "の こうげき！" + (r.crit ? "（かいしんのいちげき！）" : "") + " " + t.label + "に " + r.d + "のダメージ！"); return false;
    }
    if(act.k === "guard"){ rpgLog(hn + "は みを まもっている。"); s.gauge = Math.min(100, s.gauge + 8); return false; }
    if(act.k === "run"){
        if(b.boss){ rpgLog("この あいてからは にげられない！"); return false; }
        if(rpg.rnd() < 0.6){ rpgLog("うまく にげきれた！"); rpgEndBattle("run"); return true; }
        rpgLog("しかし まわりこまれて しまった！"); return false;
    }
    if(act.k === "item"){
        const it = RPG_ITEMS[act.id]; if(!s.items[act.id]) return false;
        const to = act.to || "hero";
        if(it.revive){ if(rpgAlive(to)){ rpgLog("たおれていない…！"); return false; } s.items[act.id]--; s.m[to].hp = Math.ceil(rpgStatOf(to).maxhp / 2); rpgLog(rpgName(to) + "は ふっかつした！"); return false; }
        if(!rpgAlive(to)){ rpgLog("たおれていて つかえない！"); return false; }
        s.items[act.id]--; const mm = s.m[to], mx = rpgStatOf(to);
        if(it.hp){ const before = mm.hp; mm.hp = Math.min(mx.maxhp, mm.hp + it.hp); rpgLog(it.n + "を つかった。" + rpgName(to) + "の HPが " + (mm.hp - before) + " かいふく！"); }
        if(it.mp){ const before = mm.mp; mm.mp = Math.min(mx.maxmp, mm.mp + it.mp); rpgLog(it.n + "を のんだ。" + rpgName(to) + "の MPが " + (mm.mp - before) + " かいふく！"); }
        return false;
    }
    if(act.k === "skill"){
        const sk = RPG_SKILLS[act.id]; if(m.mp < sk.mp) return false; m.mp -= sk.mp;
        if(act.id === "code"){ let t = act.t; if(!t || t.cur <= 0) t = rpgFoesAlive()[0]; if(!t) return false; const r = rpgDmg(st.atk * atkB, t.def, sk.p); rpgFoeHurt(t, r.d); rpgHit(b.foes.indexOf(t)); s.gauge = Math.min(100, s.gauge + 12); rpgLog(hn + "の コードアタック！" + (r.crit ? "（かいしん！）" : "") + " " + t.label + "に " + r.d + "のダメージ！"); }
        else if(act.id === "beam"){ rpgLog(hn + "は デバッグ・ビームを はなった！"); rpgFoesAlive().forEach((t) => { const r = rpgDmg(st.atk * atkB, t.def, sk.p); rpgFoeHurt(t, r.d); rpgHit(b.foes.indexOf(t)); rpgLog(t.label + "に " + r.d + "のダメージ！"); }); s.gauge = Math.min(100, s.gauge + 12); }
        else if(act.id === "recover"){ const to = act.to || "hero", mm = s.m[to]; if(!rpgAlive(to)){ rpgLog("たおれていて きかない！"); return false; } const h = 40 + s.lv * 5, before = mm.hp; mm.hp = Math.min(rpgStatOf(to).maxhp, mm.hp + h); rpgLog("「そういうときは、あれ(ARE)を使おう！」リカバリー！ " + rpgName(to) + "の HPが " + (mm.hp - before) + " かいふく！"); }
        else if(act.id === "freeze"){ rpgLog(hn + "は タイムストップを となえた！"); rpgFoesAlive().forEach((t) => { if(rpg.rnd() < (t.boss ? 0.35 : 0.7)){ t.stun = 2; rpgLog(t.label + "は うごけなくなった！"); } else rpgLog(t.label + "には きかなかった！"); }); }
        return false;
    }
    if(act.k === "are"){
        const bn = rpgAreBonus(); s.gauge = 0;
        rpgLog(hn + "「そうだ！ そういうときは、あれ(ARE)を使おう！」" + (bn ? "（つながり ×" + bn + "）" : ""));
        rpgFoesAlive().forEach((t) => { const d = Math.max(1, Math.round((st.atk * 2.2 * (1 + 0.12 * bn)) - t.def / 3)); rpgFoeHurt(t, d); rpgHit(b.foes.indexOf(t)); rpgLog(t.label + "に " + d + "のダメージ！"); });
        s.party.forEach((id) => { const mm = s.m[id], mx = rpgStatOf(id); if(mm.hp <= 0 && bn >= 1){ mm.hp = Math.ceil(mx.maxhp * 0.2); rpgLog(rpgName(id) + "が ふっかつした！"); } if(mm.hp > 0) mm.hp = Math.min(mx.maxhp, mm.hp + Math.round(mx.maxhp * (0.35 + 0.05 * bn))); });
        rpgLog("みんなの HPが かいふくした！");
    }
    return false;
}
function rpgCompanionAct(id){
    const b = rpg.b, s = rpg.s, st = rpgStatOf(id), m = s.m[id], nm = rpgName(id), atkB = b.buff.atk > 0 ? 1.25 : 1;
    const al = s.party.filter((x) => rpgAlive(x)).sort((a, c) => s.m[a].hp / rpgStatOf(a).maxhp - s.m[c].hp / rpgStatOf(c).maxhp);
    const weakest = al[0], wRatio = weakest ? s.m[weakest].hp / rpgStatOf(weakest).maxhp : 1;
    if(id === "haruki"){
        if(wRatio < 0.5 && m.mp >= 3){ m.mp -= 3; const h = 28 + s.lv * 4, mm = s.m[weakest], before = mm.hp; mm.hp = Math.min(rpgStatOf(weakest).maxhp, mm.hp + h); rpgLog(nm + "の コーヒーブレイク！ " + rpgName(weakest) + "の HPが " + (mm.hp - before) + " かいふく！"); return; }
        if(s.lv >= 5 && b.buff.def <= 0 && m.mp >= 5 && rpg.rnd() < 0.3){ m.mp -= 5; b.buff.def = 3; rpgLog(nm + "の ファイアウォール！ みんなの ぼうぎょが あがった！"); return; }
    }
    if(id === "akito" && s.lv >= 3 && b.buff.atk <= 0 && m.mp >= 4 && rpg.rnd() < 0.3){ m.mp -= 4; b.buff.atk = 3; rpgLog(nm + "「そうだ！ そういうときは…！」チアアップ！ みんなの こうげきが あがった！"); return; }
    const fa = rpgFoesAlive(), t = fa[Math.floor(rpg.rnd() * fa.length) % fa.length]; if(!t) return;
    const big = id === "akito" && rpg.rnd() < 0.2;
    const r = rpgDmg(st.atk * atkB, t.def, big ? 1.5 : 1); rpgFoeHurt(t, r.d); rpgHit(b.foes.indexOf(t)); s.gauge = Math.min(100, s.gauge + 4);
    rpgLog(nm + "の " + (big ? "ばくれつ パンチ！ " : "こうげき！ ") + t.label + "に " + r.d + "のダメージ！");
}
function rpgFoeAct(f){
    const b = rpg.b, s = rpg.s;
    if(f.stun > 0){ f.stun--; rpgLog(f.label + "は うごけない！"); return; }
    const alive = s.party.filter((id) => rpgAlive(id)); if(!alive.length) return;
    const list = f.acts && f.acts.length ? f.acts : [["こうげき", 0, 1, 1.2]], tot = list.reduce((a, c) => a + c[2], 0);
    let r = rpg.rnd() * tot, act = list[0]; for(const a of list){ r -= a[2]; if(r <= 0){ act = a; break; } }
    const defB = b.buff.def > 0 ? 1.3 : 1;
    const hit = (id, mult) => {
        const st = rpgStatOf(id); let def = st.def * defB; if(id === "hero" && b.guard) def *= 2;
        const d = rpgDmg(f.atk, def, mult * (id === "hero" && b.guard ? 0.6 : 1)); rpgHurtParty(id, d.d); rpgLog(rpgName(id) + "は " + d.d + "の ダメージを うけた！" + (d.crit ? "（つうこんの いちげき！）" : ""));
    };
    rpgLog(f.label + "の " + act[0] + "！");
    if(act[1] === 1) alive.forEach((id) => hit(id, act[3]));
    else hit(alive[Math.floor(rpg.rnd() * alive.length) % alive.length], act[3]);
}
function rpgRoundEnd(){
    const b = rpg.b, s = rpg.s;
    if(rpgFoesAlive().length === 0){ rpgEndBattle("win"); return; }
    if(!s.party.some((id) => rpgAlive(id))){ rpgEndBattle("lose"); return; }
    b.turn++; if(b.buff.atk > 0) b.buff.atk--; if(b.buff.def > 0) b.buff.def--;
    rpgSetMsg("", b.log.slice(-7).join("\n")); rpgRefresh();
}
function rpgEndBattle(res){
    const b = rpg.b, s = rpg.s, log = b.log.slice(-6);
    if(res === "run"){ rpg.mode = "map"; rpg.b = null; rpgSetMsg("", log.join("\n")); rpgRefresh(); rpgSave(); return; }
    if(res === "lose"){
        rpg.b = null; rpg.sc.length = 0; s.gold = Math.floor(s.gold / 2); rpgHeal();
        rpgGoto("lab", 8, 9); rpg.sc.length = 0; rpg.mode = "map";
        rpgSetMsg("", log.join("\n") + "\n\n" + rpgFmt("{名前}たちは たおれて しまった…\nけれど ラボの ソファで めをさました。（ゴールドが 半分に なった）")); rpgRefresh(); rpgSave(); return;
    }
    let gold = 0, exp = 0; b.foes.forEach((f) => { gold += f.g; exp += f.exp; });
    s.gold += gold; s.kills += b.foes.length;
    const lines = log.slice(); lines.push(rpgFmt("たたかいに しょうり！ " + exp + "EXP と " + gold + "G を てにいれた。"));
    if(!b.boss && rpg.rnd() < 0.18){ s.items.onigiri = (s.items.onigiri || 0) + 1; lines.push("おにぎりを ひろった！"); }
    else if(!b.boss && rpg.rnd() < 0.03){ s.items.omamori = (s.items.omamori || 0) + 1; lines.push("ふっかつのおまもりを ひろった！"); }
    rpgGain(exp).forEach((u) => lines.push(u));
    s.party.forEach((id) => { if(s.m[id].hp <= 0) s.m[id].hp = 1; });
    const after = b.after; rpg.b = null;
    if(after) rpg.sc.push({a:after, i:0});
    rpg.sc.push({a:[["say", "", lines.join("\n")]], i:0});
    rpgSave();
    rpg.mode = "script"; rpgPump();
}

// ---------------------------------------------------------------- どうぐ・そうび・おみせ
function rpgUseItem(id, to){
    const s = rpg.s, it = RPG_ITEMS[id]; if(!it || !s.items[id]) return "もっていない！";
    const mm = s.m[to], mx = rpgStatOf(to);
    if(it.revive){ if(mm.hp > 0) return "たおれて いない！"; s.items[id]--; mm.hp = Math.ceil(mx.maxhp / 2); return rpgName(to) + "は ふっかつした！"; }
    if(mm.hp <= 0) return "たおれていて つかえない！";
    if(it.hp){ if(mm.hp >= mx.maxhp) return "HPは まんたん だ！"; s.items[id]--; const b = mm.hp; mm.hp = Math.min(mx.maxhp, mm.hp + it.hp); return rpgName(to) + "の HPが " + (mm.hp - b) + " かいふく！"; }
    if(it.mp){ if(mm.mp >= mx.maxmp) return "MPは まんたん だ！"; s.items[id]--; const b = mm.mp; mm.mp = Math.min(mx.maxmp, mm.mp + it.mp); return rpgName(to) + "の MPが " + (mm.mp - b) + " かいふく！"; }
    return "";
}
function rpgBuy(id){
    const s = rpg.s, def = RPG_ITEMS[id] || RPG_EQUIP[id]; if(!def) return "";
    if(s.gold < def.price) return "ゴールドが たりない！";
    if(RPG_EQUIP[id]){
        const e = RPG_EQUIP[id];
        if(s.own.includes(id)) return "もう もっている！";
        s.gold -= def.price; s.own.push(id); if(e.v >= RPG_EQUIP[s.eq[e.slot]].v) s.eq[e.slot] = id; rpgClampHp();
        return e.n + "を かった！" + (s.eq[e.slot] === id ? "（そうびした）" : "");
    }
    if((s.items[id] || 0) >= 20) return "これいじょう もてない！";
    s.gold -= def.price; s.items[id] = (s.items[id] || 0) + 1; return def.n + "を かった！";
}

// ---------------------------------------------------------------- 描画
function rpgRng(x, y, n){ return (((x * 73856093) ^ (y * 19349663)) >>> 0) % n; }
function rpgRR(g, x, y, w, h, r){ g.beginPath(); if(g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); g.fill(); }
function rpgDrawTile(g, ch, X, Y, tx, ty, time){
    const t = RPG_TILES[ch] || RPG_TILES["."], S = RPG_TS;
    g.fillStyle = t.c; g.fillRect(X, Y, S, S);
    const r = rpgRng(tx, ty, 8);
    switch(t.d){
        case "tuft": g.fillStyle = "rgba(30,110,50,.35)"; g.fillRect(X + 6 + r * 2, Y + 8 + (r % 3) * 6, 2, 4); g.fillRect(X + 20 - r, Y + 18 + (r % 2) * 5, 2, 4); break;
        case "path": g.fillStyle = "rgba(140,100,50,.25)"; g.fillRect(X + 5 + r * 3, Y + 6 + (r % 4) * 6, 3, 2); g.fillRect(X + 18, Y + 20 - (r % 3) * 4, 3, 2); break;
        case "wave": { g.fillStyle = "rgba(255,255,255,.35)"; const o = Math.floor(time / 300 + tx) % 4; g.fillRect(X + 4 + o * 2, Y + 8, 10, 2); g.fillRect(X + 14 - o * 2, Y + 20, 10, 2); break; }
        case "brick": g.strokeStyle = "rgba(0,0,0,.28)"; g.strokeRect(X + .5, Y + .5, S - 1, S / 2); g.strokeRect(X + .5, Y + S / 2 + .5, S - 1, S / 2 - 1); break;
        case "plank": g.fillStyle = "rgba(120,80,30,.22)"; g.fillRect(X, Y + 10, S, 1); g.fillRect(X, Y + 21, S, 1); break;
        case "carpet": g.strokeStyle = "rgba(255,230,160,.5)"; g.strokeRect(X + 2.5, Y + 2.5, S - 5, S - 5); break;
        case "window": g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(X + 3, Y + 3, S - 6, 3); g.fillRect(X + S / 2 - 1, Y + 3, 2, S - 6); g.fillRect(X + 3, Y + S / 2, S - 6, 2); break;
        case "snow": g.fillStyle = "rgba(160,190,230,.5)"; g.fillRect(X + 6 + r * 2, Y + 10, 2, 2); g.fillRect(X + 20, Y + 22 - (r % 3) * 4, 2, 2); break;
        case "grid": g.strokeStyle = "rgba(0,0,0,.07)"; g.strokeRect(X + .5, Y + .5, S, S); break;
        case "gate": { const a = 0.35 + 0.25 * Math.sin(time / 260 + tx); g.fillStyle = "rgba(120,220,255," + a + ")"; g.beginPath(); g.arc(X + S / 2, Y + S / 2, 13, 0, 7); g.fill(); g.strokeStyle = "rgba(255,255,255,.8)"; g.beginPath(); g.arc(X + S / 2, Y + S / 2, 8 + 3 * Math.sin(time / 200), 0, 5); g.stroke(); break; }
        case "bldg": g.fillStyle = "rgba(255,230,120,.85)"; for(let i = 0; i < 2; i++) for(let j = 0; j < 2; j++) if(rpgRng(tx + i, ty + j, 3) > 0) g.fillRect(X + 4 + i * 14, Y + 5 + j * 14, 8, 8); break;
        case "roof": g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(X, Y + 8, S, 2); g.fillRect(X, Y + 20, S, 2); break;
        case "wall": g.fillStyle = "rgba(0,0,0,.08)"; g.fillRect(X, Y + S - 4, S, 4); break;
        case "stone": g.strokeStyle = "rgba(0,0,0,.14)"; g.strokeRect(X + .5, Y + .5, S, S); break;
        case "tech": g.fillStyle = "rgba(120,160,220,.25)"; g.fillRect(X, Y + 15, S, 2); break;
        case "glass": g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.moveTo(X + 6, Y + S); g.lineTo(X + 16, Y); g.lineTo(X + 22, Y); g.lineTo(X + 12, Y + S); g.fill(); break;
        case "server": g.fillStyle = (Math.floor(time / 350) + tx + ty) % 3 === 0 ? "#34d399" : "#38bdf8"; g.fillRect(X + 6, Y + 6, 3, 3); g.fillRect(X + 6, Y + 14, 3, 3); g.fillRect(X + 6, Y + 22, 3, 3); g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(X + 14, Y + 6, 12, 3); g.fillRect(X + 14, Y + 14, 12, 3); g.fillRect(X + 14, Y + 22, 12, 3); break;
        case "ice": g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(X + 4, Y + 6, 10, 2); g.fillRect(X + 16, Y + 18, 9, 2); break;
        case "nroad": g.fillStyle = "rgba(255,255,255,.1)"; if(ty % 4 === 0) g.fillRect(X + 4, Y + 15, 10, 2); break;
        default: break;
    }
    if(t.e){ g.font = "24px serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#000"; g.fillText(t.e, X + S / 2, Y + S / 2 + 2); }
}
function rpgSprite(g, look, px, py, dir, bob, sec){
    const L = RPG_LOOKS[look] || RPG_LOOKS.citizen, cx = px + 16, b = bob || 0, up = dir === "up";
    g.fillStyle = "rgba(0,0,0,.22)"; g.beginPath(); g.ellipse(cx, py + 29, 9, 3.5, 0, 0, 7); g.fill();
    const step = sec ? (Math.floor(sec) % 2) : 0;
    g.fillStyle = L.bot; g.fillRect(cx - 6, py + 22 + b, 5, 7 - (step ? 1 : 0)); g.fillRect(cx + 1, py + 22 + b, 5, 7 - (step ? 0 : 1));
    g.fillStyle = L.top; rpgRR(g, cx - 8, py + 12 + b, 16, 12, 3);
    g.fillRect(cx - 11, py + 13 + b, 3, 9); g.fillRect(cx + 8, py + 13 + b, 3, 9);
    g.fillStyle = L.skin; g.fillRect(cx - 11, py + 21 + b, 3, 2); g.fillRect(cx + 8, py + 21 + b, 3, 2);
    if(L.acc === "tie"){ g.fillStyle = "#d62828"; g.fillRect(cx - 1.5, py + 13 + b, 3, 7); }
    if(L.acc === "scarf"){ g.fillStyle = "#d33"; g.fillRect(cx - 7, py + 15 + b, 14, 3); }
    g.fillStyle = L.skin; g.beginPath(); g.arc(cx, py + 9 + b, 8, 0, 7); g.fill();
    g.fillStyle = L.hair;
    const hy = py + 8 + b;
    if(L.style !== "bald"){
        if(up){ g.beginPath(); g.arc(cx, py + 9 + b, 8.6, 0, 7); g.fill(); }
        else{ g.beginPath(); g.arc(cx, hy, 8.6, Math.PI, 2 * Math.PI); g.fill(); g.fillRect(cx - 8.6, hy, 3, 3); g.fillRect(cx + 5.6, hy, 3, 3); }
        if(L.style === "spike"){ g.beginPath(); g.moveTo(cx - 8, hy - 2); g.lineTo(cx - 5, hy - 12); g.lineTo(cx - 1, hy - 5); g.lineTo(cx + 3, hy - 13); g.lineTo(cx + 6, hy - 5); g.lineTo(cx + 9, hy - 10); g.lineTo(cx + 8, hy - 1); g.fill(); }
        if(L.style === "long"){ g.fillRect(cx - 9.5, hy - 1, 4, 16); g.fillRect(cx + 5.5, hy - 1, 4, 16); }
        if(L.style === "bob"){ g.fillRect(cx - 9.5, hy - 1, 4, 9); g.fillRect(cx + 5.5, hy - 1, 4, 9); }
        if(L.style === "twin"){ g.beginPath(); g.arc(cx - 11, hy + 3, 3.5, 0, 7); g.arc(cx + 11, hy + 3, 3.5, 0, 7); g.fill(); }
        if(L.style === "bun"){ g.beginPath(); g.arc(cx, hy - 8, 4, 0, 7); g.fill(); }
        if(L.style === "cap"){ g.fillStyle = L.top; g.beginPath(); g.arc(cx, hy, 8.8, Math.PI, 2 * Math.PI); g.fill(); g.fillRect(cx - 10, hy - 1, 20, 2.5); }
    }
    if(!up){
        const ox = dir === "left" ? -2 : dir === "right" ? 2 : 0;
        g.fillStyle = "#1a1a1a"; g.fillRect(cx - 4 + ox, py + 9 + b, 2, 3); g.fillRect(cx + 2 + ox, py + 9 + b, 2, 3);
        g.fillStyle = "rgba(255,120,120,.5)"; g.fillRect(cx - 6 + ox, py + 13 + b, 3, 2); g.fillRect(cx + 3 + ox, py + 13 + b, 3, 2);
        if(L.acc === "glasses"){ g.strokeStyle = "#222"; g.lineWidth = 1; g.strokeRect(cx - 6 + ox, py + 8 + b, 5, 5); g.strokeRect(cx + 1 + ox, py + 8 + b, 5, 5); }
        if(L.acc === "xr"){ g.fillStyle = "rgba(60,200,255,.85)"; g.fillRect(cx - 7 + ox, py + 8 + b, 14, 4); }
    }
    if(L.acc === "santa"){ g.fillStyle = "#d62828"; g.beginPath(); g.moveTo(cx - 8, hy); g.lineTo(cx + 1, py - 7 + b); g.lineTo(cx + 8, hy); g.fill(); g.fillStyle = "#fff"; g.fillRect(cx - 9, hy - 2, 18, 3); g.beginPath(); g.arc(cx + 1, py - 7 + b, 3, 0, 7); g.fill(); }
}
function rpgBgFor(map){
    return ({sendai:["#8ecae6", "#e0f2e9"], tokyo:["#0b1020", "#1d2b53"], aprt:["#0b1020", "#1d2b53"], tower:["#1e2a4a", "#3a4a7a"], white:["#ffffff", "#e6edf5"], xmas:["#1d3557", "#a8dadc"], base:["#3a2a1a", "#7a5a3a"], labn:["#1b1f3b", "#2c3e70"], future:["#0b132b", "#5bc0be"], lab:["#6b8aa8", "#cfe0ee"]})[map] || ["#9ad0f5", "#d9f0ff"];
}
function rpgPaint(){
    const g = rpg.g, s = rpg.s; if(!g || !$("rpgCv")) return;
    const time = Date.now(), S = RPG_TS;
    g.clearRect(0, 0, 480, 320);
    if(rpg.mode === "battle" && rpg.b){ rpgPaintBattle(g, time); return; }
    if(!s || rpg.mode === "create"){ g.fillStyle = "#0b1020"; g.fillRect(0, 0, 480, 320); rpgPaintTitle(g, time); return; }
    if(rpg.mode === "end"){ g.fillStyle = "#0b1020"; g.fillRect(0, 0, 480, 320); rpgPaintTitle(g, time, true); return; }
    const mp = rpgMap(), W = mp.rows[0].length, H = mp.rows.length;
    let fx = s.x, fy = s.y;
    if(rpg.tw){ const t = Math.min(1, (time - rpg.tw.t) / 130); fx += rpg.tw.dx * (1 - t); fy += rpg.tw.dy * (1 - t); if(t >= 1) rpg.tw = null; }
    const camX = W <= RPG_VW ? -(RPG_VW - W) / 2 : Math.max(0, Math.min(W - RPG_VW, fx - 7));
    const camY = H <= RPG_VH ? -(RPG_VH - H) / 2 : Math.max(0, Math.min(H - RPG_VH, fy - 4.5));
    g.fillStyle = "#0b1020"; g.fillRect(0, 0, 480, 320);
    for(let ty = Math.floor(camY) - 1; ty <= camY + RPG_VH + 1; ty++) for(let tx = Math.floor(camX) - 1; tx <= camX + RPG_VW + 1; tx++){
        const ch = rpgTileCh(s.map, tx, ty); if(!ch) continue;
        rpgDrawTile(g, ch, Math.round((tx - camX) * S), Math.round((ty - camY) * S), tx, ty, time);
    }
    (mp.objs || []).forEach((o) => { if(o.k === "btn" && s.wh[o.id]){ g.fillStyle = "rgba(80,170,255,.65)"; g.beginPath(); g.arc((o.x - camX) * S + 16, (o.y - camY) * S + 16, 9, 0, 7); g.fill(); } });
    const items = [];
    (mp.objs || []).forEach((o) => { if(o.k === "npc" && rpgVisible(o)) items.push({y:o.y, f:() => rpgSprite(g, o.look, Math.round((o.x - camX) * S), Math.round((o.y - camY) * S) - 4, rpg.npcDir[o.id] || "down", Math.sin(time / 600 + o.x) > 0.6 ? -1 : 0, 0)}); });
    const hx = Math.round((fx - camX) * S), hy = Math.round((fy - camY) * S) - 4;
    s.party.slice(1).forEach((id, i) => { const tr = s.trail[i]; if(tr) items.push({y:tr[1] - 0.01, f:() => rpgSprite(g, id, Math.round((tr[0] - camX) * S), Math.round((tr[1] - camY) * S) - 4, s.dir, 0, rpg.tw ? time / 120 : 0)}); });
    items.push({y:fy, f:() => rpgSprite(g, s.sex === "m" ? "heroM" : "heroF", hx, hy, s.dir, 0, rpg.tw ? time / 120 : 0)});
    items.sort((a, c) => a.y - c.y).forEach((it) => it.f());
    if(mp.tint){ g.fillStyle = mp.tint; g.fillRect(0, 0, 480, 320); }
    if(rpg.banner){
        const a = (time - rpg.banner.t) / 2600;
        if(a < 1){ g.globalAlpha = a < 0.8 ? 1 : (1 - a) / 0.2; g.fillStyle = "rgba(10,16,40,.78)"; rpgRR(g, 12, 10, Math.min(456, 40 + rpg.banner.text.length * 16), 30, 8); g.fillStyle = "#fff"; g.font = "bold 16px sans-serif"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(rpg.banner.text, 26, 26); g.globalAlpha = 1; }
        else rpg.banner = null;
    }
}
function rpgPaintTitle(g, time, ending){
    for(let i = 0; i < 60; i++){ g.fillStyle = "rgba(255,255,255," + (0.25 + ((i * 37 + Math.floor(time / 400)) % 7) / 10) + ")"; g.fillRect((i * 83) % 480, (i * 47) % 230, 2, 2); }
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff"; g.font = "60px serif"; g.fillText(ending ? "🧸" : "⭐", 240, 90);
    g.font = "bold 30px sans-serif"; g.fillText("ARE a.r.e.", 240, 160); g.font = "16px sans-serif"; g.fillText("〜 そういうときは、AREだ！ 〜", 240, 196);
    g.font = "13px sans-serif"; g.fillStyle = "#9db4d8"; g.fillText(ending ? "おわり　ありがとう！" : "タイムスリップ・アドベンチャー", 240, 230);
}
function rpgPaintBattle(g, time){
    const b = rpg.b, bg = rpgBgFor(rpg.s.map), gr = g.createLinearGradient(0, 0, 0, 320); gr.addColorStop(0, bg[0]); gr.addColorStop(1, bg[1]);
    g.fillStyle = gr; g.fillRect(0, 0, 480, 320);
    g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(0, 230, 480, 90);
    const n = b.foes.length, big = n === 1 ? (b.foes[0].boss ? 120 : 96) : n === 2 ? 76 : 62;
    b.foes.forEach((f, i) => {
        if(f.cur <= 0) return;
        const cx = 240 + (i - (n - 1) / 2) * (n === 1 ? 0 : 150), cy = 120 + (n === 1 ? 0 : (i % 2 ? 14 : -4)), bob = Math.sin(time / 420 + i) * 3;
        const hit = rpg.hit && rpg.hit.idx === i && time < rpg.hit.until;
        g.save(); if(hit) g.translate((Math.random() - 0.5) * 8, 0);
        g.globalAlpha = hit ? 0.55 : 1; g.font = big + "px serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#000"; g.fillText(f.e, cx, cy + bob); g.restore();
        g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(cx, cy + big / 2 + 6, big / 2.2, 6, 0, 0, 7); g.fill();
        g.fillStyle = "#1f2937"; g.fillRect(cx - 45, 218, 90, 8); g.fillStyle = f.cur / f.hp > 0.3 ? "#34d399" : "#ef4444"; g.fillRect(cx - 45, 218, 90 * f.cur / f.hp, 8);
        g.font = "bold 12px sans-serif"; g.fillStyle = "#111"; g.textAlign = "center"; g.textBaseline = "alphabetic"; g.fillText(f.label, cx, 242);
        if(f.stun > 0){ g.font = "18px serif"; g.fillText("💫", cx + 30, cy - 36); }
    });
    g.fillStyle = "rgba(0,0,0,.5)"; g.fillRect(12, 300, 120, 10); g.fillStyle = rpg.s.gauge >= 100 ? "#fbbf24" : "#60a5fa"; g.fillRect(12, 300, 120 * rpg.s.gauge / 100, 10);
    g.font = "bold 11px sans-serif"; g.fillStyle = "#fff"; g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillText("ARE ゲージ" + (rpg.s.gauge >= 100 ? "  MAX！" : ""), 12, 294);
    g.textAlign = "right"; g.fillText("ターン " + b.turn, 468, 18);
}

// ---------------------------------------------------------------- 画面（ボタン・メッセージ）
function rpgBtn(act, label, extra, cls){ return '<button type="button" class="button' + (cls ? " " + cls : "") + '" data-t="rpg:' + act + '"' + (extra || "") + '>' + label + '</button>'; }
function rpgPartyHtml(){
    const s = rpg.s; if(!s || !s.party) return "";
    return s.party.map((id) => { const st = rpgStatOf(id), m = s.m[id]; return '<span style="margin-right:10px;white-space:nowrap">' + escapeHtml(rpgName(id)) + ' Lv' + s.lv + ' <b' + (m.hp <= 0 ? ' style="color:#e03131"' : "") + '>HP ' + m.hp + '/' + st.maxhp + '</b> MP ' + m.mp + '/' + st.maxmp + '</span>'; }).join("");
}
function rpgRefresh(){
    if(!$("rpgCv")) return;
    const s = rpg.s, stat = $("rpgStat"), cmd = $("rpgCmd"), panel = $("rpgPanel"), pad = $("rpgPad");
    stat.innerHTML = s && rpg.mode !== "create" ? rpgPartyHtml() + ' <span style="white-space:nowrap">💰' + s.gold + 'G ・ メモリ ' + rpgMemCount() + '/6</span>' : "";
    panel.innerHTML = ""; cmd.innerHTML = ""; pad.style.display = "none";
    const m = rpg.mode;
    if(m === "create") rpgCreateUi();
    else if(m === "talk") cmd.innerHTML = rpgBtn("next", "▶ つぎへ");
    else if(m === "choice") cmd.innerHTML = (rpg.choices || []).map((c, i) => rpgBtn("choose", escapeHtml(rpgFmt(c[0])), ' data-i="' + i + '"', "button-secondary")).join("");
    else if(m === "battle") rpgBattleUi();
    else if(m === "shop") rpgShopUi();
    else if(m === "gate") rpgGateUi();
    else if(m === "rename") rpgRenameUi();
    else if(m === "menu") rpgMenuUi();
    else if(m === "end") cmd.innerHTML = rpgBtn("endback", "ラボに もどる");
    else pad.style.display = "grid";
    rpgPaint();
}
function rpgCreateUi(){
    rpgSetMsg("", "ARE 〜そういうときは、AREだ！〜\n\n20歳の 新社会人の 主人公を つくります。\n男の子 / 女の子 を えらんで、なまえを きめてください。（なまえは あとで かえられます）");
    $("rpgPanel").innerHTML = '<div class="admin-card"><div class="row" style="justify-content:flex-start">' +
        '<button type="button" class="button' + (rpg.sex === "m" ? "" : " button-secondary") + '" data-t="rpg:sex" data-v="m" aria-pressed="' + (rpg.sex === "m") + '">🧑 男の子</button>' +
        '<button type="button" class="button' + (rpg.sex === "f" ? "" : " button-secondary") + '" data-t="rpg:sex" data-v="f" aria-pressed="' + (rpg.sex === "f") + '">👩 女の子</button></div>' +
        '<label for="rpgName">なまえ（8文字まで・プロフィールの表示名が はじめに 入ります）</label><input id="rpgName" type="text" maxlength="8" value="' + escapeHtml(rpg.nameDraft) + '">' +
        '<div class="meta">20歳の 社会人 ・ ' + (rpg.sex === "m" ? "話し方：「俺」…すこし ぶっきらぼうで あたたかい" : "話し方：「わたし」…やさしくて 芯が つよい") + '</div></div>';
    $("rpgCmd").innerHTML = rpgBtn("start", "▶ ぼうけんを はじめる");
}
function rpgBattleUi(){
    const b = rpg.b, s = rpg.s, cmd = $("rpgCmd"); if(!b) return;
    const back = rpgBtn("cmd", "もどる", ' data-c="back"', "button-secondary");
    if(b.menu === "skill"){
        const l = Object.keys(RPG_SKILLS).filter((k) => s.lv >= RPG_SKILLS[k].lv);
        cmd.innerHTML = (l.length ? l.map((k) => rpgBtn("cmd", escapeHtml(RPG_SKILLS[k].n) + '（MP' + RPG_SKILLS[k].mp + '）', ' data-c="skill" data-a="' + k + '"')).join("") : '<span class="meta">まだ とくぎを おぼえていない</span>') + back;
    }else if(b.menu === "item"){
        const l = Object.keys(RPG_ITEMS).filter((k) => s.items[k] > 0);
        cmd.innerHTML = (l.length ? l.map((k) => rpgBtn("cmd", escapeHtml(RPG_ITEMS[k].n) + '×' + s.items[k], ' data-c="item" data-a="' + k + '"')).join("") : '<span class="meta">どうぐが ない</span>') + back;
    }else if(b.menu === "target"){
        cmd.innerHTML = b.foes.map((f, i) => f.cur > 0 ? rpgBtn("cmd", escapeHtml(f.label), ' data-c="tgt" data-a="' + i + '"') : "").join("") + back;
    }else if(b.menu === "ally"){
        cmd.innerHTML = s.party.map((id) => rpgBtn("cmd", escapeHtml(rpgName(id)), ' data-c="ally" data-a="' + id + '"')).join("") + back;
    }else{
        cmd.innerHTML = rpgBtn("cmd", "⚔️ たたかう", ' data-c="attack"') + rpgBtn("cmd", "✨ とくぎ", ' data-c="menu-skill"') + rpgBtn("cmd", "🛡️ ぼうぎょ", ' data-c="guard"', "button-secondary") + rpgBtn("cmd", "🎒 どうぐ", ' data-c="menu-item"', "button-secondary") +
            (s.gauge >= 100 ? rpgBtn("cmd", "🌟 ARE！", ' data-c="are"') : "") + (b.boss ? "" : rpgBtn("cmd", "🏃 にげる", ' data-c="run"', "button-secondary"));
    }
}
function rpgShopUi(){
    const s = rpg.s;
    rpgSetMsg("ミナ", rpg.shopMsg || "いらっしゃいませ！ 何に します？");
    const row = (id) => {
        const it = RPG_ITEMS[id] || RPG_EQUIP[id], eq = RPG_EQUIP[id], have = eq ? s.own.includes(id) : (s.items[id] || 0);
        const desc = eq ? ({w:"こうげき", a:"ぼうぎょ", c:"ぼうぎょ"}[eq.slot] + "+" + eq.v) : it.d;
        return '<div class="admin-card" style="display:flex;gap:8px;align-items:center;justify-content:space-between"><span><b>' + escapeHtml(it.n) + '</b> <span class="meta">' + escapeHtml(desc || "") + (eq ? "" : "（もっている " + have + "）") + '</span></span>' +
            (eq && have ? '<span class="meta">' + (s.eq[eq.slot] === id ? "そうびちゅう" : "もっている") + '</span>' : '<button type="button" class="button' + (s.gold < it.price ? " button-secondary" : "") + '" data-t="rpg:buy" data-id="' + id + '">' + it.price + 'G</button>') + '</div>';
    };
    $("rpgPanel").innerHTML = '<div class="meta">所持金：' + s.gold + 'G</div>' + rpgShopStock(rpgMemCount()).map(row).join("");
    $("rpgCmd").innerHTML = rpgBtn("shopclose", "店を 出る", "", "button-secondary");
}
function rpgGateUi(){
    const s = rpg.s;
    rpgSetMsg("リプレイゲート", "行き先を えらんでください。");
    $("rpgCmd").innerHTML = RPG_ERAS.filter((e) => rpgCond(e.req)).map((e) => rpgBtn("era", (s.f[e.done] ? "✅ " : "▶ ") + escapeHtml(e.n), ' data-id="' + e.id + '"')).join("") + rpgBtn("gateclose", "やめる", "", "button-secondary");
}
function rpgRenameUi(){
    rpgSetMsg("", "なまえを かえます。（8文字まで）");
    $("rpgPanel").innerHTML = '<div class="admin-card"><label for="rpgName2">あたらしい なまえ</label><input id="rpgName2" type="text" maxlength="8" value="' + escapeHtml(rpg.s.name) + '"></div>';
    $("rpgCmd").innerHTML = rpgBtn("renameok", "けってい") + rpgBtn("renamecancel", "やめる", "", "button-secondary");
}
function rpgMenuUi(){
    const s = rpg.s, panel = $("rpgPanel"), v = rpg.menu || "main";
    $("rpgCmd").innerHTML = rpgBtn("mnav", "ステータス", ' data-v="status"', "button-secondary") + rpgBtn("mnav", "どうぐ", ' data-v="items"', "button-secondary") + rpgBtn("mnav", "そうび", ' data-v="equip"', "button-secondary") + rpgBtn("mnav", "メモリ", ' data-v="mem"', "button-secondary") + rpgBtn("mnav", "せってい", ' data-v="set"', "button-secondary") + rpgBtn("mclose", "とじる");
    rpgSetMsg("", "メニュー");
    if(v === "status"){
        panel.innerHTML = s.party.map((id) => { const st = rpgStatOf(id), m = s.m[id]; return '<div class="admin-card"><b>' + escapeHtml(rpgName(id)) + '</b> Lv' + s.lv + '<div class="meta">HP ' + m.hp + '/' + st.maxhp + ' ・ MP ' + m.mp + '/' + st.maxmp + ' ・ こうげき ' + st.atk + ' ・ ぼうぎょ ' + st.def + '</div></div>'; }).join("") +
            '<div class="meta">つぎの レベルまで あと ' + (rpgNeed(s.lv) - s.exp) + 'EXP ・ たおした数 ' + s.kills + ' ・ 歩数 ' + s.steps + '</div>';
    }else if(v === "items"){
        const l = Object.keys(RPG_ITEMS).filter((k) => s.items[k] > 0);
        panel.innerHTML = (l.length ? l.map((k) => '<div class="admin-card"><b>' + escapeHtml(RPG_ITEMS[k].n) + '</b>×' + s.items[k] + ' <span class="meta">' + escapeHtml(RPG_ITEMS[k].d || "") + '</span><div class="row" style="justify-content:flex-start">' + s.party.map((id) => rpgBtn("use", escapeHtml(rpgName(id)) + 'に', ' data-id="' + k + '" data-to="' + id + '"', "button-secondary")).join("") + '</div></div>').join("") : '<div class="empty-list">どうぐは ありません</div>') + (rpg.menuMsg ? '<div class="meta">' + escapeHtml(rpg.menuMsg) + '</div>' : "");
    }else if(v === "equip"){
        panel.innerHTML = ["w", "a", "c"].map((slot) => '<div class="admin-card"><b>' + ({w:"ぶき", a:"ぼうぐ", c:"おまもり"}[slot]) + '</b><div class="row" style="justify-content:flex-start">' + s.own.filter((id) => RPG_EQUIP[id].slot === slot).map((id) => rpgBtn("equip", escapeHtml(RPG_EQUIP[id].n) + '(+' + RPG_EQUIP[id].v + ')', ' data-id="' + id + '"', s.eq[slot] === id ? "" : "button-secondary")).join("") + '</div></div>').join("");
    }else if(v === "mem"){
        panel.innerHTML = RPG_MEM_NAMES.map((n, i) => '<div class="admin-card">' + (s.mem[i] ? "✅ " : "⬜ ") + escapeHtml(rpgFmt(n)) + '</div>').join("");
    }else if(v === "set"){
        panel.innerHTML = '<div class="admin-card"><div class="row" style="justify-content:flex-start">' + rpgBtn("voice", rpg.voice ? "🔊 声：オン" : "🔇 声：オフ", "", "button-secondary") + rpgBtn("rename", "なまえを かえる", "", "button-secondary") + rpgBtn("reset", "はじめから", "", "button-secondary") + '</div>' +
            '<div class="meta">声は、ブラウザの 読み上げ機能で 流れます（ブラウザの 設定で 許可されていないと 鳴りません）。BGMは ありません。</div></div>';
    }else panel.innerHTML = '<div class="meta">項目を えらんでください。</div>';
}

// ---------------------------------------------------------------- 入口
function initRpg(){
    registerTool("rpg", onRpgAction);
    rpg.uid = state.user ? state.user.id : "x";
}
function openRpg(){
    rpg.uid = state.user ? state.user.id : "x"; rpg.voice = rpgVoicePref();
    const saved = rpgLoad();
    rpg.sc = []; rpg.b = null; rpg.menu = ""; rpg.pending = null; rpg.choices = null;
    let nm = "ユウ"; try{ nm = String(profileDisplayName(state.profile) || "ユウ"); }catch(_e){}
    rpg.nameDraft = Array.from(nm.replace(/\s+/g, "")).slice(0, 8).join("") || "ユウ";
    openSheet(toolHead("🗡️ ARE 〜そういうときは、AREだ！〜", "矢印キー/WASD または 十字ボタン。決定 Enter/Z、メニュー X/M。自動セーブ") +
        '<canvas id="rpgCv" width="480" height="320" style="width:100%;image-rendering:pixelated;background:#000;border-radius:8px;touch-action:manipulation" role="img" aria-label="RPGの画面"></canvas>' +
        '<div id="rpgStat" class="meta" aria-live="polite"></div><div id="rpgMsg" class="admin-card" style="min-height:4.6em;white-space:pre-wrap;line-height:1.55" role="status" aria-live="polite"></div>' +
        '<div id="rpgCmd" class="row" style="justify-content:flex-start;flex-wrap:wrap"></div><div id="rpgPanel"></div>' +
        '<div id="rpgPad" style="display:none;grid-template-columns:repeat(3,56px);gap:4px;justify-content:center"><span></span><button type="button" class="button-secondary" data-t="rpg:move" data-d="up" aria-label="上">▲</button><button type="button" class="button" data-t="rpg:act" aria-label="話す・調べる">話す</button>' +
        '<button type="button" class="button-secondary" data-t="rpg:move" data-d="left" aria-label="左">◀</button><button type="button" class="button-secondary" data-t="rpg:move" data-d="down" aria-label="下">▼</button><button type="button" class="button-secondary" data-t="rpg:move" data-d="right" aria-label="右">▶</button>' +
        '<button type="button" class="button-secondary" data-t="rpg:menu" aria-label="メニュー" style="grid-column:1/4">📋 メニュー</button></div>' +
        '<div class="row"><button type="button" class="button-secondary" data-pm="close">閉じる</button></div>');
    rpg.cv = $("rpgCv"); rpg.g = rpg.cv.getContext("2d");
    if(rpg.keyH) document.removeEventListener("keydown", rpg.keyH);
    rpg.keyH = (e) => {
        if(el.profileModal.hidden || !$("rpgCv")){ document.removeEventListener("keydown", rpg.keyH); rpg.keyH = null; rpgSpeakStop(); return; }
        const tg = (e.target || {}).tagName || "";
        if(/INPUT|TEXTAREA|SELECT/.test(tg)) return;
        const k = ({ArrowUp:"up", w:"up", W:"up", ArrowDown:"down", s:"down", S:"down", ArrowLeft:"left", a:"left", A:"left", ArrowRight:"right", d:"right", D:"right"})[e.key];
        if(k){ e.preventDefault(); rpgMove(k); }
        else if(e.key === "Enter" || e.key === "z" || e.key === "Z" || e.key === " "){ if(!/BUTTON/.test(tg) || rpg.mode === "map" || rpg.mode === "talk"){ e.preventDefault(); rpgAct(); } }
        else if(e.key === "x" || e.key === "X" || e.key === "m" || e.key === "M"){ e.preventDefault(); rpgMenuToggle(); }
    };
    document.addEventListener("keydown", rpg.keyH);
    rpg.cv.addEventListener("click", () => { if(rpg.mode === "talk") rpgNext(); });
    clearInterval(rpg.tick);
    rpg.tick = setInterval(() => { if(!$("rpgCv")){ clearInterval(rpg.tick); rpgSpeakStop(); return; } rpgPaint(); }, 160);
    if(saved){ rpg.s = saved; rpg.mode = "map"; rpgClampHp(); rpg.banner = {t:Date.now(), text:RPG_MAPS[saved.map].name}; rpgRefresh(); rpgSetMsg("", rpgFmt("つづきから！ {名前}（レベル" + saved.lv + "）") + (saved.f.e_future ? "\n（クリア済みです。ゲートから どの時代へも 行けます）" : "")); }
    else{ rpg.s = null; rpg.mode = "create"; rpg.sex = "m"; rpgRefresh(); }
}
function rpgMenuToggle(){
    if(!rpg.s) return;
    if(rpg.mode === "map"){ rpg.mode = "menu"; rpg.menu = "main"; rpg.menuMsg = ""; rpgRefresh(); }
    else if(rpg.mode === "menu"){ rpg.mode = "map"; rpgSetMsg("", ""); rpgRefresh(); rpgSave(); }
}
function rpgStartNew(){
    const nm = (($("rpgName") && $("rpgName").value) || rpg.nameDraft || "ユウ").trim();
    const name = Array.from(nm).slice(0, 8).join("") || "ユウ";
    rpg.s = rpgNew(rpg.sex, name); rpgHeal();
    rpg.mode = "script"; rpg.sc = []; rpgSave();
    rpg.banner = {t:Date.now(), text:RPG_MAPS.lab.name};
    rpg.sc.push({a:RPG_EV.lab_intro, i:0}); rpgPump();
}
function onRpgAction(action, node){
    if(action === "sex"){ rpg.nameDraft = ($("rpgName") && $("rpgName").value) || rpg.nameDraft; rpg.sex = node.dataset.v; rpgRefresh(); return; }
    if(action === "start"){ rpgStartNew(); return; }
    if(action === "voice"){ rpg.voice = !rpg.voice; try{ localStorage.setItem("are_rpg_voice", rpg.voice ? "on" : "off"); }catch(_e){} if(!rpg.voice) rpgSpeakStop(); rpgRefresh(); return; }
    if(action === "reset"){ if(confirm("セーブデータを消して、はじめからにしますか？")){ try{ localStorage.removeItem(rpgKey()); }catch(_e){} rpg.s = null; rpg.mode = "create"; rpg.sc = []; rpg.b = null; rpgRefresh(); } return; }
    if(!rpg.s) return;
    if(action === "move") rpgMove(node.dataset.d);
    else if(action === "act") rpgAct();
    else if(action === "next") rpgNext();
    else if(action === "choose") rpgChoose(Number(node.dataset.i));
    else if(action === "menu") rpgMenuToggle();
    else if(action === "mclose"){ rpg.mode = "map"; rpgSetMsg("", ""); rpgRefresh(); rpgSave(); }
    else if(action === "mnav"){ rpg.menu = node.dataset.v; rpg.menuMsg = ""; rpgRefresh(); }
    else if(action === "use"){ rpg.menuMsg = rpgUseItem(node.dataset.id, node.dataset.to); rpgSave(); rpgRefresh(); }
    else if(action === "equip"){ const e = RPG_EQUIP[node.dataset.id]; if(e && rpg.s.own.includes(node.dataset.id)){ rpg.s.eq[e.slot] = node.dataset.id; rpgClampHp(); rpgSave(); rpgRefresh(); } }
    else if(action === "rename"){ rpg.mode = "rename"; rpgRefresh(); }
    else if(action === "renameok"){ const v = Array.from((($("rpgName2") || {}).value || "").trim()).slice(0, 8).join(""); if(v) rpg.s.name = v; rpgSave(); if(rpg.sc.length){ rpg.mode = "script"; rpgPump(); } else { rpg.mode = "map"; rpgRefresh(); rpgSetMsg("", rpgFmt("なまえを {名前} に かえた。")); } }
    else if(action === "renamecancel"){ if(rpg.sc.length){ rpg.mode = "script"; rpgPump(); } else { rpg.mode = "map"; rpgRefresh(); } }
    else if(action === "cmd") rpgBattleCmd(node.dataset.c, node.dataset.a);
    else if(action === "buy"){ rpg.shopMsg = rpgBuy(node.dataset.id); rpgSave(); rpgRefresh(); }
    else if(action === "shopclose"){ rpg.shopMsg = ""; rpgSave(); rpg.mode = "script"; rpgPump(); }
    else if(action === "gateclose"){ rpg.mode = "map"; rpg.sc.length = 0; rpgSetMsg("", ""); rpgRefresh(); }
    else if(action === "era"){
        const e = RPG_ERAS.find((x) => x.id === node.dataset.id); if(!e) return;
        rpg.sc.length = 0; rpg.mode = "script"; rpgGoto(e.map, e.pos[0], e.pos[1]); rpgPump();
    }
    else if(action === "endback"){ rpg.mode = "script"; rpg.sc = []; rpgHeal(); rpgGoto("lab", 8, 8); rpgPump(); }
}
