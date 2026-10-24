"use strict";
// ===== ARE 〜そういうときは、AREだ！〜（2D RPG・ドラクエ風）=====
// 物語「そういうときは、AREだ！」が元です。アキトとハルキの“あれ(ARE)”が、バグ・キングの文字化けでバラバラに。
// けんきゅうしつ（村）で準備をして、草原→デバッグのほらあなで「サーバーのカギ」を手に入れ、サーバーじょうのバグ・キングをたおそう。
// ・ひとり用。セーブはこの端末のブラウザに自動で保存されます（端末をかえると引きつぎません）。
// ・操作：矢印キー / WASD、または画面の十字ボタン。決定は Enter / Z、キャンセルは X。

const RPG_MAPS = {
    world:[
        "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
        "~^^^^^^..TTT......TT....^^^^^^^~",
        "~^^^^^...TTT.....TTT.....^^^^^^~",
        "~^^^........T.....TT..........^~",
        "~^^...TTT.....~~~~.....TTT....^~",
        "~.....TTT....~~~~~~....TTT.....~",
        "~..H__......~~~~~~~~.......D...~",
        "~...._...TT...~~~~~...TT..._...~",
        "~...._...TT....~~......TT.._...~",
        "~.TT.______________________....~",
        "~.TT.._..........TT..........TT~",
        "~.....__......TT..TT....TT...TT~",
        "~^^....__.....TT..........TT...~",
        "~^^^...._____...........TT....^~",
        "~~^^.......__......TTT.......^^~",
        "~~~^^......._......TTT.....^^^^~",
        "~~~~^^...........__......^^^^^^~",
        "~~~~~^^^^....C...^.....^^^^^~~~~",
        "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
    ],
    cave:[
        "################",
        "#U:::::::::::::#",
        "#############:##",
        "#::::::::::::::#",
        "#:##############",
        "#::::::::::::::#",
        "##############:#",
        "#K:::::::::::::#",
        "################"
    ],
    castle:[
        "################",
        "#ffffffffffffff#",
        "#ffffffBfffffff#",
        "#ffffffffffffff#",
        "#ffffffffffffff#",
        "#ffffffffffffff#",
        "#fffffffffffffU#",
        "################"
    ]
};
const RPG_START = {world:[4, 6], cave:[2, 1], castle:[7, 5]};
const RPG_BLOCK = new Set(["T", "~", "^", "#"]);
const RPG_ENC = {world:0.11, cave:0.14, castle:0};
const RPG_ENEMIES = {
    world:[{n:"バグむし", e:"🐛", hp:9, atk:5, def:1, exp:5, g:5}, {n:"ヌルポ", e:"🦇", hp:13, atk:7, def:2, exp:8, g:7}, {n:"スパムくん", e:"👺", hp:22, atk:10, def:3, exp:14, g:12}],
    cave:[{n:"タイムアウト", e:"⏳", hp:34, atk:15, def:5, exp:30, g:20}, {n:"むげんループ", e:"🌀", hp:50, atk:20, def:7, exp:45, g:32}],
    boss:{n:"バグ・キング", e:"👾", hp:170, atk:30, def:9, exp:0, g:0, boss:true}
};
const RPG_SHOP = [
    {id:"herb", n:"おにぎり", price:8, desc:"HPを25回復"}, {id:"ether", n:"エナジードリンク", price:20, desc:"MPを10回復"},
    {id:"sword1", n:"デバッグぼう", price:60, atk:4, desc:"こうげき+4"}, {id:"sword2", n:"ミスリルのキーボード", price:200, atk:9, desc:"こうげき+9"},
    {id:"armor1", n:"パーカー", price:50, def:3, desc:"ぼうぎょ+3"}, {id:"armor2", n:"ノイズキャンセルヘッドホン", price:180, def:7, desc:"ぼうぎょ+7"}
];
const rpg = {s:null, mode:"map", enemy:null, msg:[], shopTab:0, keyH:null, cv:null, ctx:null, rnd:() => Math.random(), uid:"x", busy:false};

function rpgNew(){ return {map:"world", x:4, y:6, lv:1, exp:0, hp:20, mp:4, maxhp:20, maxmp:4, atk:6, def:2, gold:30, herb:2, ether:0, sword:0, armor:0, key:false, chest:false, won:false, steps:0, kills:0, boss:false, frag:0, seen:false, talk:0}; }
function rpgSave(){ try{ localStorage.setItem("are_rpg_" + rpg.uid, JSON.stringify(rpg.s)); }catch(_e){} }
function rpgLoad(){ try{ const s = JSON.parse(localStorage.getItem("are_rpg_" + rpg.uid) || "null"); if(s && s.map && RPG_MAPS[s.map]) return Object.assign(rpgNew(), s); }catch(_e){} return null; }

// ---- ルール（画面に依存しない純粋な計算）----
function rpgWeapon(s){ return [0, 4, 9][s.sword] || 0; }
function rpgArmor(s){ return [0, 3, 7][s.armor] || 0; }
function rpgAtk(s){ return s.atk + rpgWeapon(s); }
function rpgDef(s){ return s.def + rpgArmor(s); }
function rpgNeed(lv){ return lv * lv * 4; }
function rpgDamage(atk, def, rnd){
    let d = Math.max(1, Math.round(atk - def / 2 + Math.floor(rnd() * 5) - 2));
    const crit = rnd() < 1 / 16; if(crit) d *= 2;
    return {d, crit};
}
function rpgGain(s, exp){
    s.exp += exp; const ups = [];
    while(s.exp >= rpgNeed(s.lv)){
        s.exp -= rpgNeed(s.lv); s.lv++; s.maxhp += 7; s.maxmp += 2; s.atk += 2; s.def += 1; s.hp = Math.min(s.maxhp, s.hp + 7); s.mp = Math.min(s.maxmp, s.mp + 2);
        ups.push("レベル" + s.lv + "になった！（さいだいHP+7 MP+2 こうげき+2 ぼうぎょ+1）" + (s.lv === 2 ? " 「リカバリー」をおぼえた！" : s.lv === 3 ? " 「デバッグ」をおぼえた！" : ""));
    }
    return ups;
}
function rpgSpells(s){ return [s.lv >= 2 ? {id:"heal", n:"リカバリー", mp:3} : null, s.lv >= 3 ? {id:"fire", n:"デバッグ", mp:4} : null].filter(Boolean); }

function initRpg(){
    registerTool("rpg", onRpgAction);
    rpg.uid = state.user ? state.user.id : "x";
}

function openRpg(){
    rpg.uid = state.user ? state.user.id : "x";
    const saved = rpgLoad();
    rpg.s = saved || rpgNew(); rpg.mode = "map"; rpg.enemy = null; rpg.msg = [];
    openSheet(toolHead("🗡️ ARE 〜そういうときは、AREだ！〜", "矢印キー/WASD または 十字ボタンで移動。自動セーブされます") +
        '<canvas id="rpgCv" width="320" height="240" style="width:100%;image-rendering:pixelated;background:#000;border-radius:8px" role="img" aria-label="RPGの画面"></canvas>' +
        '<div id="rpgStat" class="meta" aria-live="polite"></div><div id="rpgMsg" class="admin-card" style="min-height:3.2em;white-space:pre-wrap" role="status" aria-live="polite"></div>' +
        '<div id="rpgCmd" class="row" style="justify-content:flex-start;flex-wrap:wrap"></div>' +
        '<div id="rpgPad" style="display:grid;grid-template-columns:repeat(3,56px);gap:4px;justify-content:center"><span></span><button type="button" class="button-secondary" data-t="rpg:move" data-d="up" aria-label="上">▲</button><span></span><button type="button" class="button-secondary" data-t="rpg:move" data-d="left" aria-label="左">◀</button><button type="button" class="button-secondary" data-t="rpg:ok" aria-label="決定">●</button><button type="button" class="button-secondary" data-t="rpg:move" data-d="right" aria-label="右">▶</button><span></span><button type="button" class="button-secondary" data-t="rpg:move" data-d="down" aria-label="下">▼</button><span></span></div>' +
        '<div class="row"><button type="button" class="button-secondary" data-t="rpg:reset">はじめから</button><button type="button" class="button-secondary" data-pm="close">閉じる</button></div>');
    rpg.cv = $("rpgCv"); rpg.ctx = rpg.cv.getContext("2d");
    if(rpg.keyH) document.removeEventListener("keydown", rpg.keyH);
    rpg.keyH = (e) => {
        if(el.profileModal.hidden || !$("rpgCv")){ document.removeEventListener("keydown", rpg.keyH); rpg.keyH = null; return; }
        const k = {ArrowUp:"up", w:"up", W:"up", ArrowDown:"down", s:"down", S:"down", ArrowLeft:"left", a:"left", A:"left", ArrowRight:"right", d:"right", D:"right"}[e.key];
        if(k && !/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || "")){ e.preventDefault(); rpgMove(k); }
        else if(e.key === "Enter" || e.key === "z" || e.key === "Z"){ if(!/BUTTON/.test((e.target || {}).tagName || "")){ e.preventDefault(); rpgOk(); } }
    };
    document.addEventListener("keydown", rpg.keyH);
    if(saved && saved.seen){ rpgSay("冒険のつづきから！ レベル" + rpg.s.lv + (rpg.s.won ? "\n（クリア済みです）" : "")); rpgPaint(); }
    else rpgIntro(0);
}

const RPG_INTRO = [
    "西暦2035年。コミュニケーションツール「ARE」は、世界じゅうの人の夜をてらす、いちばん明るい星…のはずだった。",
    "ところが ある夜、ひみつの研究室で ＜文字化けの王 バグ・キング＞ が めをさました。\nAREの124の機能は「かけら」になって、世界じゅうに ちらばってしまった！",
    "あなたは アキト。口ぐせは「そうだ！ そういうときは、あれ(ARE)を使おう！」。\nそばには いつも クールな あいぼう ハルキが いる。",
    "かける。かんせいさせる。そして、バグ・キングを たおす。\nさあ、ぼうけんの はじまりだ！"
];
function rpgIntro(i){
    rpg.mode = "intro"; rpg.page = i;
    rpgSay(RPG_INTRO[i]); rpgPaint();
}
function rpgNextPage(){
    if(rpg.mode !== "intro") return;
    if(rpg.page + 1 < RPG_INTRO.length){ rpgIntro(rpg.page + 1); return; }
    rpg.s.seen = true; rpg.mode = "map"; rpgSay("まずは けんきゅうしつ（🏠）で じゅんびをしよう。\n草原を ぬけた むこうの ほらあなに カギが あるらしい。"); rpgSave(); rpgPaint();
}
function rpgSay(t){ rpg.msg = String(t).split("\n"); const m = $("rpgMsg"); if(m) m.textContent = String(t); }
function rpgTile(map, x, y){ const row = RPG_MAPS[map][y]; return row ? (row[x] || "#") : "#"; }

function rpgMove(dir){
    if(rpg.mode === "intro"){ rpgNextPage(); return; }
    if(rpg.mode !== "map" || !rpg.s) return;
    const s = rpg.s, d = {up:[0, -1], down:[0, 1], left:[-1, 0], right:[1, 0]}[dir]; if(!d) return;
    const nx = s.x + d[0], ny = s.y + d[1], t = rpgTile(s.map, nx, ny);
    if(RPG_BLOCK.has(t)) return;
    s.x = nx; s.y = ny; s.steps++;
    if(t === "H"){ rpgPaint(); rpgTown(); return; }
    if(t === "D"){ s.map = "cave"; [s.x, s.y] = RPG_START.cave; rpgSay("デバッグのほらあなに はいった。くらくて、ときどき ノイズが はしる…"); rpgSave(); rpgPaint(); return; }
    if(t === "U"){ if(s.map === "cave"){ s.map = "world"; s.x = 27; s.y = 7; rpgSay("ほらあなを でた。"); } else { s.map = "world"; s.x = 13; s.y = 16; rpgSay("サーバーじょうを あとにした。"); } rpgSave(); rpgPaint(); return; }
    if(t === "C"){
        if(!s.key){ s.y--; rpgSay("サーバーじょうの門は とじている。\n「サーバーのカギ」が ひつようだ。デバッグのほらあなを さがそう。"); rpgPaint(); return; }
        s.map = "castle"; [s.x, s.y] = RPG_START.castle; rpgSay("カギで門が ひらいた！ バグ・キングは この奥だ。\nHPとMPを よく たしかめて…"); rpgSave(); rpgPaint(); return;
    }
    if(t === "K" && !s.chest){ s.chest = true; s.key = true; rpgSay("たからばこを あけた！\n「サーバーのカギ」を てにいれた！\n（ハルキ「それがあれば あの城に はいれる。いこう、アキト」）"); rpgSave(); rpgPaint(); return; }
    if(t === "K"){ rpgSay("たからばこは からっぽだ。"); rpgPaint(); return; }
    if(t === "B" && !s.won){ rpg.enemy = Object.assign({}, RPG_ENEMIES.boss, {cur:RPG_ENEMIES.boss.hp}); rpgBattleStart("バグ・キングが あらわれた！\n「ぜんぶ 文字化けに してやる…！」"); return; }
    const rate = RPG_ENC[s.map] || 0;
    if(rate && t !== "_" && rpg.rnd() < rate){
        const list = RPG_ENEMIES[s.map === "world" ? "world" : "cave"], idx = Math.min(list.length - 1, Math.floor(rpg.rnd() * (s.map === "world" ? Math.min(list.length, 1 + Math.floor(s.lv / 2)) : list.length)));
        rpg.enemy = Object.assign({}, list[idx], {cur:list[idx].hp}); rpgBattleStart(list[idx].n + "が あらわれた！"); return;
    }
    rpgSay(""); rpgPaint();
}
function rpgOk(){ if(rpg.mode === "intro"){ rpgNextPage(); return; } if(rpg.mode === "over") { rpg.s = rpgNew(); rpg.mode = "map"; rpgSay("ふたたび ぼうけんへ！"); rpgPaint(); } }

// ---- 戦闘 ----
function rpgBattleStart(text){ rpg.mode = "battle"; rpg.menu = "top"; rpgSay(text); rpgPaint(); }
function rpgEnemyTurn(){
    const s = rpg.s, e = rpg.enemy; let log = "";
    if(e.boss && rpg.rnd() < 0.25){ const d = Math.max(8, 32 - Math.floor(rpgDef(s) / 3)); s.hp -= d; log = "文字化けビーム！ " + d + "のダメージ！"; }
    else{ const r = rpgDamage(e.atk, rpgDef(s), rpg.rnd); s.hp -= r.d; log = e.n + "の こうげき！" + (r.crit ? "（かいしんのいちげき！）" : "") + " " + r.d + "のダメージ！"; }
    if(s.hp <= 0){ s.hp = 0; return {dead:true, log}; }
    return {dead:false, log};
}
function rpgLose(log){
    const s = rpg.s;
    s.gold = Math.floor(s.gold / 2); s.hp = s.maxhp; s.mp = s.maxmp; s.map = "world"; [s.x, s.y] = [4, 6];
    rpg.mode = "map"; rpg.enemy = null; rpgSay(log + "\nアキトは たおれた…\n「そうだ…そういうときは…あれ(ARE)を…」\nけんきゅうしつで めをさました。（ゴールドが半分になった）"); rpgSave(); rpgPaint();
}
function rpgWin(log){
    const s = rpg.s, e = rpg.enemy;
    if(e.boss){
        s.won = true; rpg.mode = "map"; rpg.enemy = null; s.map = "world"; [s.x, s.y] = [13, 16];
        s.frag = 124;
        rpgSay(log + "\n\n🎉 バグ・キングを たおした！ 124の「かけら」が ぜんぶ もどった！\nハルキ「…できたな。僕たちの ARE が。」\nアキト「ああ！ いつか誰の目にも届く、いちばん明るい星に なろうぜ！」\nクリアおめでとう！（歩数 " + s.steps + "・たおした数 " + s.kills + "）"); rpgSave(); rpgPaint(); return;
    }
    s.gold += e.g; s.kills++; s.frag = Math.min(123, s.frag + 1);
    const ups = rpgGain(s, e.exp);
    rpg.mode = "map"; rpg.enemy = null;
    rpgSay(log + "\n" + e.n + "を たおした！ " + e.exp + "EXP と " + e.g + "G を てにいれた。\n機能の「かけら」を 1つ ひろった！（" + s.frag + "/124）" + (s.frag === 10 ? "\nハルキ「10個…まだ はじまりだ。でも ここから だ」" : s.frag === 50 ? "\nハルキ「半分近く もどってきたな」" : "") + (ups.length ? "\n" + ups.join("\n") : "")); rpgSave(); rpgPaint();
}
function rpgCmd(c){
    if(rpg.mode === "intro"){ if(c === "next") rpgNextPage(); else if(c === "skip"){ rpg.page = RPG_INTRO.length - 1; rpgNextPage(); } return; }
    if(rpg.mode !== "battle") return;
    const s = rpg.s, e = rpg.enemy; let log = "";
    if(c === "menu-magic"){ rpg.menu = "magic"; rpgPaint(); return; }
    if(c === "menu-item"){ rpg.menu = "item"; rpgPaint(); return; }
    if(c === "back"){ rpg.menu = "top"; rpgPaint(); return; }
    if(c === "attack"){
        const r = rpgDamage(rpgAtk(s), e.def, rpg.rnd); e.cur -= r.d; log = "アキトの こうげき！" + (r.crit ? "（かいしんのいちげき！）" : "") + " " + e.n + "に " + r.d + "のダメージ！";
    }else if(c === "heal" || c === "fire"){
        const sp = rpgSpells(s).find((x) => x.id === c); if(!sp){ return; }
        if(s.mp < sp.mp){ rpgSay("MPが たりない！"); return; }
        s.mp -= sp.mp;
        if(c === "heal"){ const h = 20 + s.lv * 2, before = s.hp; s.hp = Math.min(s.maxhp, s.hp + h); log = "「そういうときは、あれ(ARE)を使おう！」リカバリー！ HPが " + (s.hp - before) + " かいふくした！"; }
        else{ const d = 12 + s.lv * 2 + Math.floor(rpg.rnd() * 5); e.cur -= d; log = "デバッグ！ " + e.n + "に " + d + "のダメージ！"; }
    }else if(c === "herb" || c === "ether"){
        if(!s[c]){ rpgSay("もっていない！"); return; }
        s[c]--; if(c === "herb"){ const before = s.hp; s.hp = Math.min(s.maxhp, s.hp + 25); log = "おにぎりを たべた。HPが " + (s.hp - before) + " かいふく！"; } else { const before = s.mp; s.mp = Math.min(s.maxmp, s.mp + 10); log = "せいすいを つかった。MPが " + (s.mp - before) + " かいふく！"; }
    }else if(c === "run"){
        if(e.boss){ rpgSay("バグ・キングからは にげられない！"); return; }
        if(rpg.rnd() < 0.6){ rpg.mode = "map"; rpg.enemy = null; rpgSay("うまく にげきれた！"); rpgPaint(); return; }
        log = "しかし まわりこまれてしまった！";
    }else return;
    rpg.menu = "top";
    if(e.cur <= 0){ e.cur = 0; rpgWin(log); return; }
    const t = rpgEnemyTurn();
    if(t.dead){ rpgLose(log + "\n" + t.log); return; }
    rpgSay(log + "\n" + t.log); rpgPaint();
}

// ---- 村 ----
function rpgTown(){
    rpg.mode = "town"; rpg.shopTab = 0;
    rpgSay("ちいさな けんきゅうしつに ついた。\nハルキ「おかえり。コーヒーでも のんで やすんでいけ」"); rpgPaint();
}
function rpgTalk(){
    const s = rpg.s; s.talk = (s.talk || 0) + 1;
    let t;
    if(s.won) t = ["ハルキ「ARE は 2035年の コミュニケーションツールに なる。残りの機能も つくっていこう」", "アキト「1月24日が たんじょうびだから 124機能だ！ …って言ったら 笑われたっけ」"][s.talk % 2];
    else if(s.key) t = "ハルキ「カギは てにいれたな。サーバーじょうは 南の 門だ。HPとMPを たっぷり 回復してから いけ」";
    else if(s.lv < 3) t = "ハルキ「まずは 草原で バグむしを たおして レベルを あげろ。レベル2で リカバリー、3で デバッグを おぼえる」";
    else t = "ハルキ「東の ほらあなに『サーバーのカギ』が ある。敵が つよいから、おにぎりを 多めに もっていけ」";
    rpgSay(t + "\n（アキト「そうだ！ そういうときは、あれ(ARE)を使おう！」）"); rpgPaint();
}
function rpgInn(){
    const s = rpg.s;
    if(s.gold < 10){ rpgSay("ゴールドが たりない（10G）"); return; }
    s.gold -= 10; s.hp = s.maxhp; s.mp = s.maxmp; rpgSay("ソファで ぐっすり ねむった。HPとMPが ぜんかいふくした！"); rpgSave(); rpgPaint();
}
function rpgBuy(id){
    const s = rpg.s, it = RPG_SHOP.find((x) => x.id === id); if(!it) return;
    if(s.gold < it.price){ rpgSay("ゴールドが たりない！"); return; }
    if(it.atk){ const lv = it.atk === 4 ? 1 : 2; if(s.sword >= lv){ rpgSay("もう もっている（もっと強い剣をもっている）"); return; } s.sword = lv; }
    else if(it.def){ const lv = it.def === 3 ? 1 : 2; if(s.armor >= lv){ rpgSay("もう もっている"); return; } s.armor = lv; }
    else s[id]++;
    s.gold -= it.price; rpgSay(it.n + "を かった！"); rpgSave(); rpgPaint();
}

// ---- 描画 ----
const RPG_COLORS = {".":"#4caf50", "_":"#c9a66b", "T":"#1b5e20", "~":"#1e88e5", "^":"#8d6e63", "H":"#c9a66b", "D":"#c9a66b", "C":"#9e9e9e", "#":"#37474f", ":":"#5d4037", "U":"#c9a66b", "K":"#5d4037", "B":"#7b1fa2", "f":"#b0bec5"};
const RPG_ICON = {T:"🌲", "~":"🌊", "^":"⛰️", H:"🏘️", D:"🕳️", C:"🖥️", K:"🎁", B:"👑", U:"🪜"};
function rpgPaint(){
    const s = rpg.s, cv = rpg.cv, g = rpg.ctx; if(!cv || !$("rpgCv")) return;
    g.fillStyle = "#000"; g.fillRect(0, 0, 320, 240);
    if(rpg.mode === "intro"){
        g.fillStyle = "#0b1020"; g.fillRect(0, 0, 320, 240);
        for(let i = 0; i < 40; i++){ g.fillStyle = "rgba(255,255,255," + (0.3 + (i * 37 % 7) / 10) + ")"; g.fillRect((i * 83) % 320, (i * 47) % 150, 2, 2); }
        g.font = "56px serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff"; g.fillText("⭐", 160, 70);
        g.font = "bold 22px sans-serif"; g.fillText("ARE a.r.e.", 160, 130); g.font = "13px sans-serif"; g.fillText("〜 そういうときは、AREだ！ 〜", 160, 160); g.fillText("ページ " + (rpg.page + 1) + " / " + RPG_INTRO.length, 160, 200);
    }else if(rpg.mode === "battle" && rpg.enemy){
        g.fillStyle = "#1a237e"; g.fillRect(0, 0, 320, 240);
        g.font = "84px serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff"; g.fillText(rpg.enemy.e, 160, 100);
        g.font = "bold 16px sans-serif"; g.fillText(rpg.enemy.n, 160, 170);
        g.fillStyle = "#555"; g.fillRect(80, 190, 160, 10); g.fillStyle = "#e53935"; g.fillRect(80, 190, 160 * Math.max(0, rpg.enemy.cur) / rpg.enemy.hp, 10);
    }else if(rpg.mode === "town"){
        g.fillStyle = "#6d4c41"; g.fillRect(0, 0, 320, 240); g.font = "64px serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff"; g.fillText("🏘️", 160, 100); g.font = "bold 16px sans-serif"; g.fillText("ちいさな けんきゅうしつ", 160, 170);
    }else{
        const map = RPG_MAPS[s.map], W = map[0].length, H = map.length, VW = 10, VH = 7.5, ts = 32;
        const cx = Math.max(0, Math.min(W - 10, s.x - 5)), cy = Math.max(0, Math.min(H - 8, s.y - 4));
        g.font = "22px serif"; g.textAlign = "center"; g.textBaseline = "middle";
        for(let y = 0; y < 8; y++) for(let x = 0; x < 10; x++){
            const t = rpgTile(s.map, cx + x, cy + y);
            g.fillStyle = RPG_COLORS[t] || "#000"; g.fillRect(x * ts, y * ts, ts, ts);
            if(RPG_ICON[t]){ g.fillStyle = "#fff"; g.fillText(RPG_ICON[t], x * ts + ts / 2, y * ts + ts / 2 + 1); }
        }
        g.fillText("🧑‍💻", (s.x - cx) * ts + ts / 2, (s.y - cy) * ts + ts / 2 + 1);
        void VW; void VH;
    }
    const st = $("rpgStat");
    if(st) st.textContent = "Lv" + s.lv + "　HP " + s.hp + "/" + s.maxhp + "　MP " + s.mp + "/" + s.maxmp + "　" + s.gold + "G　EXP " + s.exp + "/" + rpgNeed(s.lv) + "　こうげき" + rpgAtk(s) + " ぼうぎょ" + rpgDef(s) + (s.key ? "　🗝️" : "") + "　かけら" + (s.frag || 0) + "/124";
    const cmd = $("rpgCmd"); if(!cmd) return;
    const b = (c, t, extra) => '<button type="button" class="button' + (extra ? " " + extra : "") + '" data-t="rpg:cmd" data-c="' + c + '">' + t + '</button>';
    if(rpg.mode === "intro"){
        cmd.innerHTML = b("next", "▶ つぎへ") + b("skip", "スキップ", "button-secondary");
        $("rpgPad").style.display = "none";
    }else if(rpg.mode === "battle"){
        if(rpg.menu === "magic") cmd.innerHTML = (rpgSpells(s).length ? rpgSpells(s).map((sp) => b(sp.id, sp.n + "（MP" + sp.mp + "）")).join("") : '<span class="meta">まだ じゅもんをおぼえていない</span>') + b("back", "もどる", "button-secondary");
        else if(rpg.menu === "item") cmd.innerHTML = b("herb", "おにぎり×" + s.herb) + b("ether", "エナジー×" + s.ether) + b("back", "もどる", "button-secondary");
        else cmd.innerHTML = b("attack", "⚔️ たたかう") + b("menu-magic", "✨ じゅもん") + b("menu-item", "🎒 どうぐ") + b("run", "🏃 にげる", "button-secondary");
        $("rpgPad").style.display = "none";
    }else if(rpg.mode === "town"){
        cmd.innerHTML = '<button type="button" class="button" data-t="rpg:talk">💬 ハルキと話す</button><button type="button" class="button" data-t="rpg:inn">🛏️ ソファで休む（10G）</button>' + RPG_SHOP.map((it) => '<button type="button" class="button-secondary" data-t="rpg:buy" data-id="' + it.id + '">' + escapeHtml(it.n) + ' ' + it.price + 'G<small class="meta"> ' + escapeHtml(it.desc) + '</small></button>').join("") + '<button type="button" class="button" data-t="rpg:leave">むらを出る</button>';
        $("rpgPad").style.display = "none";
    }else{
        cmd.innerHTML = s.won ? '<span class="meta">🎉 クリア済み。草原を歩きまわってレベルあげもできます。</span>' : "";
        $("rpgPad").style.display = "grid";
    }
}

function onRpgAction(action, node){
    if(!rpg.s) return;
    if(action === "move") rpgMove(node.dataset.d);
    else if(action === "ok") rpgOk();
    else if(action === "talk") rpgTalk();
    else if(action === "cmd") rpgCmd(node.dataset.c);
    else if(action === "inn") rpgInn();
    else if(action === "buy") rpgBuy(node.dataset.id);
    else if(action === "leave"){ rpg.mode = "map"; const s = rpg.s; s.y++; rpgSay(""); rpgSave(); rpgPaint(); }
    else if(action === "reset"){ if(confirm("セーブデータを消して、はじめからにしますか？")){ rpg.s = rpgNew(); rpgIntro(0); } }
}
