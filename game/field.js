"use strict";
// ===== フィールド：地図・いどう・会話イベント・メニュー・おみせ・ゲート =====
const TS = 32, VW = 20, VH = 11.25;
const DIRS = {up:[0, -1], down:[0, 1], left:[-1, 0], right:[1, 0]};
const cvEl = $("cv"), cx2 = cvEl.getContext("2d");

// ---------------------------------------------------------------- 地図の参照
function curMap(){ return RPG_MAPS[G.S.map]; }
function tileCh(mapId, x, y){ const r = RPG_MAPS[mapId].rows[y]; return r ? (r[x] || null) : null; }
function objVisible(o){ return (!o.hide || !rpgCond(o.hide)) && (!o.show || rpgCond(o.show)); }
function npcAt(x, y){ return (curMap().objs || []).find((o) => o.k === "npc" && o.x === x && o.y === y && objVisible(o)); }
function objAt(x, y, kind){ return (curMap().objs || []).find((o) => o.k === kind && o.x === x && o.y === y); }
function walkable(x, y){
    const ch = tileCh(G.S.map, x, y); if(!ch) return false;
    const t = RPG_TILES[ch]; if(!t || !t.w) return false;
    return !npcAt(x, y);
}
function gotoMap(map, x, y){
    const S = G.S; S.map = map; S.x = x; S.y = y; S.px = x; S.py = y; S.trail = []; G.tw = null;
    G.banner = {t:Date.now(), text:RPG_MAPS[map].name};
    const ev = RPG_ENTER[map];
    if(ev && RPG_EV[ev]) G.scripts.push({a:RPG_EV[ev], i:0});
    tqAutoSave();
}
// ---------------------------------------------------------------- いどう
function tryMove(dir){
    if(G.mode !== "map" || !G.S) return;
    const now = performance.now(), gap = G.S.cx.speed ? 70 : 125;
    if(now - (G.lastMv || 0) < gap) return; G.lastMv = now;
    if(G.info){ G.info = ""; render(); }
    moveStep(dir);
}
function moveStep(dir){
    const S = G.S, d = DIRS[dir]; if(!d) return;
    S.dir = dir;
    const nx = S.x + d[0], ny = S.y + d[1], npc = npcAt(nx, ny);
    if(npc){ talkTo(npc); return; }
    if(!walkable(nx, ny)){ paint(); return; }
    S.px = S.x; S.py = S.y;
    S.trail.unshift([S.x, S.y]); S.trail = S.trail.slice(0, 6);
    S.x = nx; S.y = ny; S.steps++;
    G.tw = {t:Date.now(), dx:-d[0], dy:-d[1]};
    afterStep();
}
function afterStep(){
    const S = G.S, mp = curMap();
    const warp = objAt(S.x, S.y, "warp");
    if(warp){
        if(warp.need && !rpgCond(warp.need)){ runScript(RPG_EV[warp.deny || "tk_locked"] || [["say", "", "いまは はいれない。"], ["back"]]); return; }
        const w = ["warp", warp.to[0], warp.to[1], warp.to[2]];
        runScript(warp.ev && RPG_EV[warp.ev] ? RPG_EV[warp.ev].concat([w]) : [w]); return;
    }
    const btn = objAt(S.x, S.y, "btn");
    if(btn && !S.wh[btn.id]){
        S.wh[btn.id] = 1; const n = 3 - Object.keys(S.wh).length;
        const steps = [["say", "", "ピッ！ とうめいな ボタンを 押した！" + (n > 0 ? "（のこり " + n + "こ）" : "（ぜんぶ 押した！）")]];
        if(n === 0){ S.f.wh_all = 1; steps.push(["say", "アナウンくん", "…あれ？ ぜんぶ 押された！？ アナウンくんの ところへ 行こう！"]); }
        runScript(steps); return;
    }
    const st = objAt(S.x, S.y, "step");
    if(st && RPG_EV[st.ev]){ runScript(RPG_EV[st.ev]); return; }
    const ch = tileCh(S.map, S.x, S.y), tev = mp.tev && mp.tev[ch];
    if(tev && tev[1] && RPG_EV[tev[0]]){ runScript(RPG_EV[tev[0]]); return; }
    if(mp.enc && !S.cx.noenc && !/[DGE]/.test(ch) && S.steps - G.lastEnc > 3 && G.rnd() < mp.enc.rate * (S.cx.encx3 ? 3 : 1)){
        G.lastEnc = S.steps; encounter(); return;
    }
    paint();
    if(G.mode === "map") updateHud();
}
function encounter(){
    const mp = curMap(), list = mp.enc.f, tot = list.reduce((a, b) => a + b[1], 0); let r = G.rnd() * tot, pick = list[0];
    for(const f of list){ r -= f[1]; if(r <= 0){ pick = f; break; } }
    battleStart(pick[0].slice(), null);
}
function fieldAct(){
    if(G.mode !== "map" || !G.S) return;
    const S = G.S, d = DIRS[S.dir], fx = S.x + d[0], fy = S.y + d[1];
    if(G.info){ G.info = ""; }
    const npc = npcAt(fx, fy);
    if(npc){ talkTo(npc); return; }
    const sign = objAt(fx, fy, "sign");
    if(sign && RPG_EV[sign.ev]){ runScript(RPG_EV[sign.ev]); return; }
    const ch = tileCh(S.map, fx, fy), mp = curMap(), tev = mp.tev && mp.tev[ch];
    if(tev && RPG_EV[tev[0]]){ runScript(RPG_EV[tev[0]]); return; }
    if(S.map === "white" && !S.f.wh_all){
        const btns = (mp.objs || []).filter((o) => o.k === "btn" && !S.wh[o.id]);
        if(btns.length){
            const dist = Math.min(...btns.map((b) => Math.abs(b.x - S.x) + Math.abs(b.y - S.y)));
            runScript([["say", "", dist <= 2 ? "ぴりぴり…！ すぐ ちかくに ボタンが ある 気が する！" : dist <= 5 ? "なにか ちかくに ある 気が する…" : "…とおい。この あたりには なさそうだ。"]]); return;
        }
    }
    render();
}
function talkTo(npc){
    const S = G.S; G.npcDir[npc.id] = {up:"down", down:"up", left:"right", right:"left"}[S.dir];
    const ev = RPG_EV[npc.ev]; if(ev) runScript(ev);
}
// ---------------------------------------------------------------- 会話イベントの実行
function runScript(steps){
    if(!steps) return;
    G.scripts.push({a:steps, i:0});
    if(G.mode === "map" || G.mode === "script" || G.mode === "menu" || G.mode === "shop" || G.mode === "gate"){ G.mode = "script"; pump(); }
}
function rpgNext(){ if(G.mode === "talk"){ tqSpeakStop(); pump(); } }
function pump(){
    const st = G.scripts, S = G.S;
    for(let guard = 0; guard < 5000; guard++){
        const fr = st[st.length - 1];
        if(!fr){ G.mode = "map"; G.say = null; tqAutoSave(); render(); paint(); return; }
        if(fr.i >= fr.a.length){ st.pop(); continue; }
        const op = fr.a[fr.i++], k = op[0];
        if(k === "say"){ G.mode = "talk"; G.say = {who:op[1], text:rpgFmt(op[2])}; tqSpeak(G.say.text, op[1]); render(); return; }
        if(k === "choice"){ G.mode = "choice"; G.choices = op[1]; render(); return; }
        if(k === "set") S.f[op[1]] = 1;
        else if(k === "clr") delete S.f[op[1]];
        else if(k === "if"){ const br = rpgCond(op[1]) ? op[2] : op[3]; if(br && br.length) st.push({a:br, i:0}); }
        else if(k === "run"){ if(RPG_EV[op[1]]) st.push({a:RPG_EV[op[1]], i:0}); }
        else if(k === "pick"){ const l = op[1]; st.push({a:l[Math.floor(G.rnd() * l.length) % l.length], i:0}); }
        else if(k === "warp") gotoMap(op[1], op[2], op[3]);
        else if(k === "back"){ S.x = S.px; S.y = S.py; G.tw = null; }
        else if(k === "gold") S.gold = Math.min(TQ_MAX_GOLD, S.gold + op[1]);
        else if(k === "item") S.items[op[1]] = (S.items[op[1]] || 0) + (op[2] || 1);
        else if(k === "mem") S.mem[op[1] - 1] = 1;
        else if(k === "join"){ if(!tqAddMember(op[1], false)) S.f["full_" + op[1]] = 1; }
        else if(k === "heal") tqHealAll();
        else if(k === "bg"){ G.bg = op[1] || ""; }
        else if(k === "flash") flash();
        else if(k === "battle"){ battleStart(op[1].slice(), op[2]); return; }
        else if(k === "shop"){ G.mode = "shop"; G.shopMsg = ""; render(); return; }
        else if(k === "gate"){ G.mode = "gate"; render(); return; }
        else if(k === "rename"){ G.mode = "rename"; render(); return; }
        else if(k === "recap") st.push({a:recapSteps(), i:0});
        else if(k === "end"){ rpgEnding(); return; }
    }
    G.mode = "map"; render();
}
ACT.next = () => { if(!finishTyping()) rpgNext(); };
ACT.choose = (v) => {
    if(G.mode !== "choice" || !G.choices) return;
    const c = G.choices[Number(v)]; G.choices = null; G.mode = "script";
    if(c) G.scripts.push({a:c[1], i:0});
    pump();
};
function recapSteps(){
    const f = G.S.f, L = [["say", "", "ここまでの おはなし。メモリは " + tqMemCount() + "/6 こ。"]];
    [["e_sendai", "仙台で 迷惑ボーイ 玲也の ノイズを おとなしくさせ、ひかりのメモリを 取りもどした。"], ["e_tokyo", "夜の 東京で 蒼太さんを はげまし、さえこと コピペ・パンダを 説得して メモリを 手に入れた。"],
        ["e_white", "まっしろルームで『みんなで クリア』の ルールを 取りもどした。"], ["e_xmas", "クリスマスの 東京で 紘と いっしょに USBメモリを 取りかえした。"], ["e_labn", "ARE が 生まれた 夜の 研究室で 設計図を もらった。"]].forEach((p) => { if(f[p[0]]) L.push(["say", "", p[1]]); });
    if(!f.e_sendai) L.push(["say", "", "まだ 旅は はじまったばかり。ゲートから 仙台へ 行こう。"]);
    if(f.e_future) L.push(["say", "", "そして 2035年。ノイズの 王は ARE の マスコットに なった。ARE は 完成した！"]);
    else if(tqMemCount() >= 5) L.push(["say", "", "のこりは さいごの メモリ。2035年の ARE タワーへ。"]);
    return L;
}
function tqObjective(){
    const f = G.S.f;
    if(!f.intro_done) return "ラボの アキトと ハルキに 話しかけよう";
    if(!f.e_sendai) return f.sn_ready ? "AER展望台（北の階段の先）で 玲也の ノイズを おとなしくさせよう" : "2026年9月の 仙台で 手がかりを あつめよう（駅員さん・牛タン屋さん・亜理紗）";
    if(!f.e_tokyo) return "ゲートから 2025年12月の 夜の東京へ。蒼太さんを たずねよう";
    if(!f.e_white) return "『まっしろルーム』へ。透明ボタンを 3つ さがそう";
    if(!f.e_xmas) return "2028年12月25日の クリスマスの東京へ。紘に 会おう";
    if(!f.e_labn) return "ARE が 生まれた 夜へ。若い アキトと ハルキに 会おう";
    if(!f.e_future) return "のこりの メモリは 2035年の ARE タワー。ノイズの 王が いる！";
    if(!f.xr_open) f.xr_open = 1;
    if(!f.e_xr) return "クリア おめでとう！ おまけ：『XRアドベンチャー体験会』へ（ゲート）";
    return "ぜんぶ クリア！『自動レベル上げ』で レベル99を めざそう";
}
function rpgEnding(){
    G.mode = "end"; G.scripts.length = 0; G.bg = ""; G.S.f.xr_open = 1;
    const S = G.S;
    G.endText = rpgFmt("TOMOHIKO QUEST 〜そういうときは、AREだ！〜\n\nおわり\n\n{名前}は ARE を 完成させた！\nノイズだった ものは、いま ARE の やさしい マスコットに。\nそして 今日も どこかで だれかが つぶやく。\n「そうだ！ そういうときは、あれ(ARE)を使おう！」\n\n（歩数 " + S.steps + "・たおした数 " + S.kills + "・レベル " + S.lv + "・プレイ " + tqPlayText(S.play) + "）\n\n★ おまけ『XRアドベンチャー体験会』が ゲートに ひらいたよ！");
    tqSpeak("そうだ！ そういうときは、あれ(ARE)を使おう！", "アキト");
    tqAutoSave(); render();
}
ACT.endback = () => { G.mode = "script"; G.scripts = []; tqHealAll(); gotoMap("lab", 8, 8); pump(); };

// ---------------------------------------------------------------- 画面のHTML（フィールド系）
function hudHtml(){
    const S = G.S;
    const lines = S.party.map((id) => { const st = tqStat(id), m = S.m[id]; return '<div class="l' + (m.hp <= 0 ? " ko" : "") + '">' + esc(tqName(id)) + ' Lv' + S.lv + ' HP ' + m.hp + '/' + st.maxhp + ' MP ' + m.mp + '/' + st.maxmp + '</div>'; }).join("");
    return '<div id="hud" class="win">' + lines + '</div><div id="hudr" class="win">💰' + S.gold.toLocaleString() + 'G　メモリ ' + tqMemCount() + '/6' + (G.grind ? '<br>⚡れんぞく戦闘 ' + G.grind.n + '回' : "") + (S.cx.showpos ? '<br>(' + S.x + ',' + S.y + ')' : "") + '</div>';
}
function updateHud(){ const h = $("hud"); if(h && G.mode === "map"){ const d = document.createElement("div"); d.innerHTML = hudHtml(); h.innerHTML = d.firstChild.innerHTML; const r = $("hudr"); if(r) r.innerHTML = d.lastChild.innerHTML; } }
function fieldView(){
    const m = G.mode, S = G.S; let h = "";
    if(!S) return "";
    if(m === "battle") return battleView();
    if(m === "map" || m === "talk" || m === "choice" || m === "script") h += hudHtml();
    if(m === "talk") h += winMsg(G.say.who, G.say.text);
    else if(m === "choice"){
        h += (G.say ? winMsg(G.say.who, G.say.text, {next:false}) : "") + '<div id="choices" class="win">' + (G.choices || []).map((c, i) => '<button class="opt" data-a="choose" data-v="' + i + '">' + esc(rpgFmt(c[0])) + '</button>').join("") + '</div>';
    }
    else if(m === "map" && G.info) h += winMsg("", G.info, {next:false});
    else if(m === "menu") h += menuView();
    else if(m === "shop") h += shopView();
    else if(m === "gate") h += gateView();
    else if(m === "rename") h += renameView();
    else if(m === "end") h += '<div class="win panel scroll" style="text-align:center"><div style="white-space:pre-wrap;line-height:1.7">' + esc(G.endText || "") + '</div><div class="row" style="justify-content:center;margin-top:1cqw"><button class="btn" data-a="endback">ラボに もどる</button></div></div>';
    return h;
}
// ---- おみせ ----
function shopView(){
    const S = G.S;
    const row = (id) => {
        const it = RPG_ITEMS[id] || RPG_EQUIP[id], eq = RPG_EQUIP[id], have = eq ? S.own.includes(id) : (S.items[id] || 0);
        const desc = eq ? ({w:"こうげき", a:"ぼうぎょ", c:"ぼうぎょ"}[eq.slot] + "+" + eq.v) : it.d;
        return '<div class="card row" style="justify-content:space-between"><span><b>' + esc(it.n) + '</b> <span class="meta">' + esc(desc || "") + (eq ? "" : "（もっている " + have + "）") + '</span></span>' +
            (eq && have ? '<span class="meta">' + (S.eq[eq.slot] === id ? "そうびちゅう" : "もっている") + '</span>' : '<button class="btn' + (S.gold < it.price ? " sub" : "") + '" data-a="buy" data-v="' + id + '">' + it.price + 'G</button>') + '</div>';
    };
    return winMsg("ミナ", G.shopMsg || "いらっしゃいませ！ 何に します？", {next:false}).replace('id="msg"', 'id="msg" style="left:30cqw"') +
        '<div class="win panel scroll" style="left:28cqw;top:2cqw;transform:none;width:68cqw;max-height:62cqh"><div class="meta">所持金：' + S.gold.toLocaleString() + 'G</div>' + rpgShopStock(tqMemCount()).map(row).join("") + '<div class="row" style="margin-top:.6cqw"><button class="btn sub" data-a="shopclose">店を 出る</button></div></div>';
}
function buyItem(id){
    const S = G.S, def = RPG_ITEMS[id] || RPG_EQUIP[id]; if(!def) return "";
    if(S.gold < def.price) return "ゴールドが たりない！";
    if(RPG_EQUIP[id]){ const e = RPG_EQUIP[id]; if(S.own.includes(id)) return "もう もっている！"; S.gold -= def.price; S.own.push(id); if(e.v >= RPG_EQUIP[S.eq[e.slot]].v) S.eq[e.slot] = id; tqClamp(); return e.n + "を かった！" + (S.eq[e.slot] === id ? "（そうびした）" : ""); }
    if((S.items[id] || 0) >= 99) return "これいじょう もてない！";
    S.gold -= def.price; S.items[id] = (S.items[id] || 0) + 1; return def.n + "を かった！";
}
ACT.buy = (v) => { G.shopMsg = buyItem(v); tqAutoSave(); render(); };
ACT.shopclose = () => { G.shopMsg = ""; G.mode = "script"; pump(); };
// ---- ゲート ----
function eraList(){ const S = G.S; return RPG_ERAS.filter((e) => S.cx.allgate || rpgCond(e.req)); }
function gateView(){
    const S = G.S;
    return winMsg("リプレイゲート", "行き先を えらんでください。", {next:false}) + '<div class="win" id="choices" style="right:3cqw;bottom:19cqw;max-width:60cqw">' + eraList().map((e) => '<button class="opt" data-a="era" data-v="' + e.id + '">' + (S.f[e.done] ? "✅ " : "▶ ") + esc(e.n) + '</button>').join("") + '<button class="opt" data-a="gateclose">やめる</button></div>';
}
ACT.gateclose = () => { G.mode = "map"; G.scripts.length = 0; G.say = null; render(); };
ACT.era = (v) => { const e = RPG_ERAS.find((x) => x.id === v); if(!e) return; G.scripts.length = 0; G.mode = "script"; gotoMap(e.map, e.pos[0], e.pos[1]); pump(); };
// ---- なまえ変更 ----
function renameView(){ return winMsg("", "なまえを かえます。（10文字まで）", {next:false}) + '<div class="win panel sm" style="top:35%"><label for="rpgName2">あたらしい なまえ</label><input id="rpgName2" type="text" maxlength="10" value="' + esc(G.S.name) + '" style="width:100%"><div class="row" style="margin-top:.8cqw"><button class="btn" data-a="renameok">けってい</button><button class="btn sub" data-a="renamecancel">やめる</button></div></div>'; }
ACT.renameok = () => { const v = Array.from((($("rpgName2") || {}).value || "").trim()).slice(0, 10).join(""); if(v){ G.S.name = v; } tqAutoSave(); if(G.scripts.length){ G.mode = "script"; pump(); } else { G.mode = "map"; G.info = rpgFmt("なまえを {名前} に かえた。"); render(); } };
ACT.renamecancel = () => { if(G.scripts.length){ G.mode = "script"; pump(); } else { G.mode = "map"; render(); } };

// ---------------------------------------------------------------- メニュー
function openMenu(){ if(G.mode !== "map") return; G.mode = "menu"; G.menuTab = "main"; G.menuMsg = ""; render(); }
function fieldMenuBack(){ if(G.menuTab && G.menuTab !== "main"){ G.menuTab = "main"; render(); } else { G.mode = "map"; tqAutoSave(); render(); } }
ACT.mclose = () => { G.mode = "map"; tqAutoSave(); render(); };
function menuView(){
    const S = G.S, t = G.menuTab || "main";
    const left = '<div id="mm" class="win">' + [["status", "ステータス"], ["items", "どうぐ"], ["equip", "そうび"], ["mem", "メモリ・もくてき"], ["auto", "⚡ じどう（オート）"], ["save", "📖 ぼうけんのしょ"], ["cheat", "🔑 チート"], ["settings", "せってい"], ["help", "あそびかた"]].map((x) => '<button class="opt" data-a="mnav" data-v="' + x[0] + '">' + x[1] + '</button>').join("") + '<button class="opt" data-a="mclose">とじる</button></div>';
    let body = "";
    if(t === "main"){
        body = '<h2>' + esc(S.name) + ' たち</h2>' + S.party.map((id) => { const st = tqStat(id), m = S.m[id]; return '<div class="card"><b>' + esc(tqName(id)) + '</b> Lv' + S.lv + '　HP ' + m.hp + '/' + st.maxhp + '　MP ' + m.mp + '/' + st.maxmp + '</div>'; }).join("") +
            '<div class="card"><b>🎯 いまの もくてき</b><div>' + esc(tqObjective()) + '</div></div><div class="meta">💰' + S.gold.toLocaleString() + 'G　プレイ ' + tqPlayText(S.play) + '　' + esc(curMap().name) + '</div>';
    }else if(t === "status"){
        const pr = S.prof || {};
        body = '<h2>ステータス</h2>' + S.party.map((id) => { const st = tqStat(id), m = S.m[id]; return '<div class="card"><b>' + esc(tqName(id)) + '</b> Lv' + S.lv + '<div class="meta">HP ' + m.hp + '/' + st.maxhp + '　MP ' + m.mp + '/' + st.maxmp + '　こうげき ' + st.atk + '　ぼうぎょ ' + st.def + '　すばやさ ' + st.agi + '</div></div>'; }).join("") +
            '<div class="card meta">つぎの レベルまで あと ' + (S.lv >= TQ_MAX_LV ? "—（最大）" : (rpgNeed(S.lv) - S.exp) + "EXP") + '　たおした数 ' + S.kills + '　歩数 ' + S.steps + (S.expmul > 1 ? "　経験値 ×" + S.expmul : "") + '</div>' +
            (pr.zodiac ? '<div class="card meta">' + pr.zodiac.mark + ' ' + esc(pr.zodiac.name) + '　性格：' + esc(pr.pers ? pr.pers.name : "—") + '</div>' : "");
    }else if(t === "items"){
        const l = Object.keys(RPG_ITEMS).filter((k) => S.items[k] > 0);
        body = '<h2>どうぐ</h2>' + (l.length ? l.map((k) => '<div class="card"><b>' + esc(RPG_ITEMS[k].n) + '</b>×' + S.items[k] + ' <span class="meta">' + esc(RPG_ITEMS[k].d || "") + '</span><div class="row">' + S.party.map((id) => '<button class="btn sub" data-a="use" data-v="' + k + '|' + id + '">' + esc(tqName(id)) + 'に</button>').join("") + '</div></div>').join("") : '<div class="meta">どうぐは ありません</div>') + (G.menuMsg ? '<div class="okc">' + esc(G.menuMsg) + '</div>' : "");
    }else if(t === "equip"){
        body = '<h2>そうび</h2>' + ["w", "a", "c"].map((slot) => '<div class="card"><b>' + ({w:"ぶき", a:"ぼうぐ", c:"おまもり"}[slot]) + '</b><div class="row">' + S.own.filter((id) => RPG_EQUIP[id].slot === slot).map((id) => '<button class="btn' + (S.eq[slot] === id ? "" : " sub") + '" data-a="equip" data-v="' + id + '">' + esc(RPG_EQUIP[id].n) + '(+' + RPG_EQUIP[id].v + ')</button>').join("") + '</div></div>').join("");
    }else if(t === "mem"){
        body = '<h2>メモリ・もくてき</h2><div class="card"><b>🎯 もくてき</b><div>' + esc(tqObjective()) + '</div></div>' + RPG_MEM_NAMES.map((n, i) => '<div class="card">' + (S.mem[i] ? "✅ " : "⬜ ") + esc(rpgFmt(n)) + '</div>').join("");
    }else if(t === "auto"){
        body = '<h2>⚡ じどう（オート）</h2><div class="card"><b>オート戦闘：' + (G.autoPref ? "ON" : "OFF") + '</b><div class="meta">ONに すると、戦闘が 自動で すすみます。戦闘中の ボタンでも 切りかえ できます。</div><div class="row"><button class="btn" data-a="autoPref">オート戦闘を ' + (G.autoPref ? "OFF" : "ON") + ' に する</button></div></div>' +
            '<div class="card"><b>れんぞく戦闘（自動レベル上げ）</b><div class="meta">いまの 地図で、敵と 自動で たたかいつづけます。HPが 少なくなると おにぎりを つかい、足りなければ ストップ。' + (curMap().enc ? "" : "<br>※ この場所では できません（敵の出る場所へ いこう）") + '</div><div class="row"><button class="btn" data-a="grindStart"' + (curMap().enc ? "" : " disabled") + '>▶ スタート</button></div></div>' + (G.menuMsg ? '<div class="okc">' + esc(G.menuMsg) + '</div>' : "");
    }
    return left + '<div id="mc" class="win">' + body + '</div>';
}
ACT.mnav = (v) => {
    if(v === "save"){ G.slotCtx = "save"; G.slotFrom = "menu"; G.slotPick = null; G.mode = "slots"; render(); return; }
    if(v === "cheat"){ G.cheatFrom = "menu"; G.cheatMsg = ""; G.mode = "cheat"; render(); return; }
    if(v === "settings"){ G.setFrom = "menu"; G.mode = "settings"; render(); return; }
    if(v === "help"){ G.helpFrom = "menu"; G.mode = "help"; render(); return; }
    G.menuTab = v; G.menuMsg = ""; render();
};
ACT.use = (v) => { const [k, id] = v.split("|"); G.menuMsg = useItem(k, id); tqAutoSave(); render(); };
ACT.equip = (v) => { const e = RPG_EQUIP[v]; if(e && G.S.own.includes(v)){ G.S.eq[e.slot] = v; tqClamp(); tqAutoSave(); render(); } };
function useItem(id, to){
    const S = G.S, it = RPG_ITEMS[id]; if(!it || !S.items[id]) return "もっていない！";
    const mm = S.m[to], mx = tqStat(to);
    if(it.revive){ if(mm.hp > 0) return "たおれて いない！"; S.items[id]--; mm.hp = Math.ceil(mx.maxhp / 2); return tqName(to) + "は ふっかつした！"; }
    if(mm.hp <= 0) return "たおれていて つかえない！";
    if(it.hp){ if(mm.hp >= mx.maxhp) return "HPは まんたん だ！"; S.items[id]--; const b = mm.hp; mm.hp = Math.min(mx.maxhp, mm.hp + it.hp); return tqName(to) + "の HPが " + (mm.hp - b) + " かいふく！"; }
    if(it.mp){ if(mm.mp >= mx.maxmp) return "MPは まんたん だ！"; S.items[id]--; const b = mm.mp; mm.mp = Math.min(mx.maxmp, mm.mp + it.mp); return tqName(to) + "の MPが " + (mm.mp - b) + " かいふく！"; }
    return "";
}

// ---------------------------------------------------------------- ゲーム開始
function enterGame(msg){
    G.mode = "map"; G.bg = ""; G.say = null; G.info = msg || "";
    const outs = tqFlushCheatQueue();
    if(outs.length) G.info = (G.info ? G.info + "\n" : "") + outs.join("\n");
    G.banner = {t:Date.now(), text:curMap().name};
    if(G.afterCheat === "end"){ G.afterCheat = null; rpgEnding(); return; }
    render(); paint();
}

// ---------------------------------------------------------------- 絵（ドット絵ふうの描画）
function rng(x, y, n){ return (((x * 73856093) ^ (y * 19349663)) >>> 0) % n; }
function rr(g, x, y, w, h, r){ g.beginPath(); if(g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); g.fill(); }
function drawTile(g, ch, X, Y, tx, ty, time){
    const t = RPG_TILES[ch] || RPG_TILES["."], S = TS;
    g.fillStyle = t.c; g.fillRect(X, Y, S, S);
    const r = rng(tx, ty, 8);
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
        case "bldg": g.fillStyle = "rgba(255,230,120,.85)"; for(let i = 0; i < 2; i++) for(let j = 0; j < 2; j++) if(rng(tx + i, ty + j, 3) > 0) g.fillRect(X + 4 + i * 14, Y + 5 + j * 14, 8, 8); break;
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
function rpgSprite(g, look, px, py, dir, bob, sec, rainbow){
    const L = RPG_LOOKS[look] || RPG_LOOKS.citizen, cx = px + 16, b = bob || 0, up = dir === "up";
    if(rainbow) g.save(), g.filter = "hue-rotate(" + (Date.now() / 6 % 360) + "deg) saturate(1.6)";
    g.fillStyle = "rgba(0,0,0,.22)"; g.beginPath(); g.ellipse(cx, py + 29, 9, 3.5, 0, 0, 7); g.fill();
    const step = sec ? (Math.floor(sec) % 2) : 0;
    g.fillStyle = L.bot; g.fillRect(cx - 6, py + 22 + b, 5, 7 - (step ? 1 : 0)); g.fillRect(cx + 1, py + 22 + b, 5, 7 - (step ? 0 : 1));
    g.fillStyle = L.top; rr(g, cx - 8, py + 12 + b, 16, 12, 3);
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
    if(rainbow) g.restore();
}
function paint(){
    const g = cx2, S = G.S, time = Date.now();
    g.setTransform(2, 0, 0, 2, 0, 0);
    if(G.mode === "battle" && G.b){ paintBattle(g, time); return; }
    if(!S || !RPG_MAPS[S.map]) return;
    g.fillStyle = "#0b1020"; g.fillRect(0, 0, 640, 360);
    const mp = curMap(), W = mp.rows[0].length, H = mp.rows.length;
    let fx = S.x, fy = S.y;
    if(G.tw){ const t = Math.min(1, (time - G.tw.t) / 120); fx += G.tw.dx * (1 - t); fy += G.tw.dy * (1 - t); if(t >= 1) G.tw = null; }
    const camX = W <= VW ? -(VW - W) / 2 : Math.max(0, Math.min(W - VW, fx - VW / 2 + 0.5));
    const camY = H <= VH ? -(VH - H) / 2 : Math.max(0, Math.min(H - VH, fy - VH / 2 + 0.5));
    for(let ty = Math.floor(camY) - 1; ty <= camY + VH + 1; ty++) for(let tx = Math.floor(camX) - 1; tx <= camX + VW + 1; tx++){
        const ch = tileCh(S.map, tx, ty); if(!ch) continue;
        drawTile(g, ch, Math.round((tx - camX) * TS), Math.round((ty - camY) * TS), tx, ty, time);
    }
    (mp.objs || []).forEach((o) => { if(o.k === "btn" && S.wh[o.id]){ g.fillStyle = "rgba(80,170,255,.65)"; g.beginPath(); g.arc((o.x - camX) * TS + 16, (o.y - camY) * TS + 16, 9, 0, 7); g.fill(); } });
    const items = [];
    (mp.objs || []).forEach((o) => { if(o.k === "npc" && objVisible(o)) items.push({y:o.y, f:() => rpgSprite(g, o.look, Math.round((o.x - camX) * TS), Math.round((o.y - camY) * TS) - 4, G.npcDir[o.id] || "down", Math.sin(time / 600 + o.x) > 0.6 ? -1 : 0, 0)}); });
    const hx = Math.round((fx - camX) * TS), hy = Math.round((fy - camY) * TS) - 4;
    S.party.slice(1).forEach((id, i) => { const tr = S.trail[i]; if(tr) items.push({y:tr[1] - 0.01 * (i + 1), f:() => rpgSprite(g, tqLookOf(id), Math.round((tr[0] - camX) * TS), Math.round((tr[1] - camY) * TS) - 4, S.dir, 0, G.tw ? time / 120 : 0)}); });
    items.push({y:fy, f:() => rpgSprite(g, tqLookOf("hero"), hx, hy, S.dir, 0, G.tw ? time / 120 : 0, S.cx.rainbow)});
    items.sort((a, c) => a.y - c.y).forEach((it) => it.f());
    if(mp.tint){ g.fillStyle = mp.tint; g.fillRect(0, 0, 640, 360); }
    if(G.banner){
        const a = (time - G.banner.t) / 2600;
        if(a < 1){ g.globalAlpha = a < 0.8 ? 1 : (1 - a) / 0.2; g.fillStyle = "rgba(10,16,40,.78)"; rr(g, 12, 70, Math.min(456, 40 + G.banner.text.length * 16), 30, 8); g.fillStyle = "#fff"; g.font = "bold 16px sans-serif"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(G.banner.text, 26, 86); g.globalAlpha = 1; }
        else G.banner = null;
    }
}
setInterval(() => { if(["map", "talk", "choice", "script", "shop", "gate", "menu", "rename", "battle", "end"].includes(G.mode)) paint(); }, 90);
setInterval(() => { if(G.S && ["map", "talk", "choice", "script", "shop", "gate", "menu", "battle"].includes(G.mode)) G.S.play++; }, 1000);
setInterval(() => { if(G.S && G.mode === "map") tqAutoSave(); }, 30000);
