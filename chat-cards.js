"use strict";
// ===== 手札をかくすカードゲーム（ババ抜き / トモヒロウ(大富豪) / インディアンポーカー / ウソダロウ(ダウト)）=====
// 手札と山札はサーバー(Supabase)の中だけにあり、画面には「自分が見てよい情報」だけが届きます。
// チャットには「始めました」のメッセージだけが出ます（中身はこの画面で確認）。2〜3秒ごとに最新の状態を取りにいきます。

const CG_GAMES = {
    baba:{name:"ババ抜き", icon:"🃏", desc:"2人。同じ数字はペアで捨てる。ジョーカーを持ったままだと負け"},
    tomo:{name:"トモヒロウ（大富豪）", icon:"👑", desc:"2人。強いカードを出して先に手札を空にする。3<…<K<A<2"},
    indian:{name:"インディアンポーカー", icon:"🎴", desc:"相手のカードだけ見える。5ラウンド、コイン10枚から"},
    uso:{name:"ウソダロウ（ダウト）", icon:"🤥", desc:"伏せて出して「A,2,3…」と言い張る。うそだと思ったらダウト！"}
};
const CG_SUIT = {S:"♠", H:"♥", D:"♦", C:"♣"};
const CG_RANK_LABEL = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
feat.cg = {gid:null, view:null, sel:[], timer:null, busy:false};

function initCards(){
    registerTool("cg", onCgAction);
    el.messages.addEventListener("click", (event) => {
        const node = event.target.closest("[data-cgopen]");
        if(!node) return;
        runTool(() => openCg(node.dataset.cgopen));
    });
}

function cgLabel(c){ return c === "JK" ? "🃏" : (CG_SUIT[c[0]] || "") + CG_RANK_LABEL[Number(c.slice(1))]; }
function cgCard(c, attrs, cls){
    const red = c !== "JK" && (c[0] === "H" || c[0] === "D");
    return '<button type="button" class="bj-card cg-card' + (red ? " red" : "") + (cls ? " " + cls : "") + '" ' + (attrs || "") + '>' + cgLabel(c) + '</button>';
}
function cgBack(attrs){ return '<button type="button" class="bj-card back cg-card" ' + (attrs || "") + '>🂠</button>'; }
function cgSortHand(h){ return (h || []).slice().sort((a, b) => (a === "JK") - (b === "JK") || Number(a.slice(1)) - Number(b.slice(1)) || a.localeCompare(b)); }

function openCardGames(){
    if(!state.currentRoom){ showToast("先にチャットを開いてください。"); return; }
    openSheet(toolHead("🂡 カードゲーム（手札かくし）", "手札はサーバーで管理され、相手には見えません。始めると、チャットに参加ボタンが出ます。") +
        Object.keys(CG_GAMES).map((k) => '<button type="button" class="admin-card more-item" data-t="cg:start" data-g="' + k + '">' + CG_GAMES[k].icon + ' ' + CG_GAMES[k].name + '<small class="meta">' + CG_GAMES[k].desc + '</small></button>').join("") + toolClose());
}

function renderCgBubble(item){
    const info = CG_GAMES[item.cg];
    if(!info) return '<div class="bubble">🂡 カードゲーム</div>';
    return '<div class="bubble">' + info.icon + ' <b>' + escapeHtml(info.name) + '</b><br><span class="meta">手札かくしの2人対戦</span><br>' +
        '<button type="button" class="button-secondary" data-cgopen="' + escapeHtml(String(item.gid || "").replace(/[^0-9a-f-]/gi, "")) + '">参加・続きを見る</button></div>';
}

async function onCgAction(action, node){
    const cg = feat.cg;
    if(action === "start"){
        const game = node.dataset.g;
        if(!CG_GAMES[game] || !state.currentRoom){ showToast("先にチャットを開いてください。"); return; }
        const result = await requireClient().rpc("cg_create", {p_room_id:state.currentRoom.id, p_game:game});
        if(result.error) throw result.error;
        const gid = result.data;
        await sendMessagePayload({type:"game", game:"cg", cg:game, gid, kind:"start"});
        await openCg(gid);
        return;
    }
    if(action === "join"){ await cgCall("cg_join", {p_game:cg.gid}); return; }
    if(action === "sel"){
        const c = node.dataset.c, i = cg.sel.indexOf(c);
        if(i >= 0) cg.sel.splice(i, 1); else cg.sel.push(c);
        paintCg(); return;
    }
    if(action === "close"){ stopCgTimer(); closeSheet(); return; }
    const map = {draw:["draw", () => ({pos:Number(node.dataset.pos)})], play:["play", () => ({cards:cg.sel.slice()})], pass:["pass", () => ({})],
        raise:["raise", () => ({})], call:["call", () => ({})], fold:["fold", () => ({})], doubt:["doubt", () => ({})], accept:["accept", () => ({})]};
    const m = map[action];
    if(!m) return;
    if(action === "play" && !cg.sel.length){ showToast("出すカードを選んでください。"); return; }
    if(action === "fold" && !confirm("ドロップすると、このラウンドの掛けコインを失います。よいですか？")) return;
    await cgCall("cg_act", {p_game:cg.gid, p_action:m[0], p_arg:m[1]()});
    cg.sel = [];
}

async function cgCall(fn, args){
    const cg = feat.cg;
    if(cg.busy) return;
    cg.busy = true;
    try{
        const result = await requireClient().rpc(fn, args);
        if(result.error) throw result.error;
        cg.view = result.data;
        paintCg();
    }finally{ cg.busy = false; }
}

function stopCgTimer(){ if(feat.cg.timer){ clearInterval(feat.cg.timer); feat.cg.timer = null; } }

async function openCg(gid){
    const cg = feat.cg;
    cg.gid = gid; cg.view = null; cg.sel = [];
    openSheet('<div id="cgBody" class="admin-card">読み込み中…</div>');
    await cgRefresh();
    stopCgTimer();
    cg.timer = setInterval(() => {
        if(!$("cgBody")){ stopCgTimer(); return; }
        cgRefresh().catch(() => {});
    }, 2500);
}

async function cgRefresh(){
    const cg = feat.cg;
    if(cg.busy) return;
    const result = await requireClient().rpc("cg_view", {p_game:cg.gid});
    if(result.error) throw result.error;
    const before = JSON.stringify(cg.view);
    cg.view = result.data;
    if(JSON.stringify(cg.view) !== before) paintCg();
}

function cgNames(v){ return (v.players || []).map((id) => vsName(id)); }

function paintCg(){
    const box = $("cgBody"), v = feat.cg.view;
    if(!box || !v){ if(box) box.textContent = "ゲームが見つかりません。"; return; }
    const me = state.user.id, info = CG_GAMES[v.game] || {name:"", icon:"🂡"};
    const isPlayer = (v.players || []).includes(me), myTurn = v.status === "playing" && v.turn === me;
    const opp = (v.players || []).find((id) => id !== me), pub = v.pub || {};
    let html = toolHead(info.icon + " " + escapeHtml(info.name), "") ;
    if(v.status === "waiting"){
        html += isPlayer ? '<div class="admin-card">相手が参加するのを待っています…（チャットの「参加・続きを見る」から入ってもらってください）</div>'
            : '<div class="admin-card">2人用です。参加しますか？</div><div class="row"><button type="button" class="button" data-t="cg:join">参加する</button></div>';
        box.innerHTML = html + toolClose('');
        return;
    }
    if(v.status === "done"){
        const w = v.winner;
        html += '<div class="admin-card"><b>' + (w ? (w === me ? "🎉 あなたの勝ち！" : (isPlayer ? "😢 " + escapeHtml(vsName(w)) + " の勝ち" : escapeHtml(vsName(w)) + " の勝ち")) : "引き分け") + '</b></div>';
    }else{
        html += '<div class="admin-card">' + (!isPlayer ? "観戦中" : (myTurn ? "<b>あなたの番です</b>" : escapeHtml(vsName(opp)) + " の番です…")) + '</div>';
    }
    const counts = pub.counts || {};
    if(v.game === "baba") html += cgBabaView(v, me, opp, myTurn, counts, pub);
    else if(v.game === "tomo") html += cgTomoView(v, me, opp, myTurn, counts, pub);
    else if(v.game === "uso") html += cgUsoView(v, me, opp, myTurn, counts, pub);
    else html += cgIndianView(v, me, opp, myTurn, pub);
    box.innerHTML = html + toolClose('');
}

function cgHandRow(h, selectable, selected){
    return '<div class="bj-hand">' + cgSortHand(h).map((c) => cgCard(c, selectable ? 'data-t="cg:sel" data-c="' + c + '"' : "disabled", selected.includes(c) ? "picked" : "")).join("") + '</div>';
}

function cgBabaView(v, me, opp, myTurn, counts, pub){
    let html = '<div><b>' + escapeHtml(vsName(opp)) + '</b> の手札（' + (counts[opp] || 0) + '枚）— ' + (myTurn ? "1枚えらんで引く" : "") + '<div class="bj-hand">';
    for(let i = 0; i < (counts[opp] || 0); i++) html += cgBack(myTurn && v.status === "playing" ? 'data-t="cg:draw" data-pos="' + i + '"' : "disabled");
    html += '</div></div><div><b>あなた</b>の手札（' + (counts[me] || 0) + '枚）' + cgHandRow(v.hand, false, []) + '</div>';
    if(pub.last) html += '<div class="meta">直前：' + escapeHtml(vsName(pub.last.by)) + ' が ' + cgLabel(pub.last.card) + ' を引きました' + (pub.last.paired ? "（ペアで捨てた）" : "") + '</div>';
    return html;
}

function cgTomoView(v, me, opp, myTurn, counts, pub){
    const f = pub.field;
    let html = '<div class="meta">' + escapeHtml(vsName(opp)) + ' の手札：' + (counts[opp] || 0) + '枚</div>';
    html += '<div><b>場</b>' + (f && f.cards ? '<div class="bj-hand">' + f.cards.map((c) => cgCard(c, "disabled")).join("") + '</div><div class="meta">' + escapeHtml(vsName(f.by)) + ' が出しました</div>' : '<div class="meta">（なし。好きなカードを出せます）</div>') + '</div>';
    html += '<div><b>あなた</b>の手札（' + (counts[me] || 0) + '枚）' + cgHandRow(v.hand, myTurn, feat.cg.sel) + '</div>';
    if(myTurn) html += '<div class="row"><button type="button" class="button" data-t="cg:play">選んだカードを出す</button>' + (f && f.cards ? '<button type="button" class="button-secondary" data-t="cg:pass">パス</button>' : "") + '</div><div class="meta">同じ数字を同じ枚数で、場より強く。（パスすると場が流れ、出した人が先攻に）</div>';
    return html;
}

function cgUsoView(v, me, opp, myTurn, counts, pub){
    const rank = CG_RANK_LABEL[pub.rank || 1];
    let html = '<div class="meta">' + escapeHtml(vsName(opp)) + ' の手札：' + (counts[opp] || 0) + '枚　場にたまった伏せカード：' + (pub.pile || 0) + '枚</div>';
    html += '<div class="admin-card">いまの数字：<b style="font-size:1.4em">' + rank + '</b></div>';
    if(pub.last && pub.phase === "respond") html += '<div class="meta">' + escapeHtml(vsName(pub.last.by)) + ' が「' + rank + '」を ' + pub.last.n + '枚 出しました</div>';
    if(pub.result && pub.result.doubt) html += '<div class="meta">直前のダウト：' + escapeHtml(vsName(pub.result.by)) + ' → ' + (pub.result.truthful ? "ほんとうでした（ダウトした人が場を全部引き取り）" : "うそでした！（出した人が場を全部引き取り）") + '：' + (pub.result.cards || []).map(cgLabel).join(" ") + '</div>';
    html += '<div><b>あなた</b>の手札（' + (counts[me] || 0) + '枚）' + cgHandRow(v.hand, myTurn && pub.phase === "play", feat.cg.sel) + '</div>';
    if(myTurn && pub.phase === "play") html += '<div class="row"><button type="button" class="button" data-t="cg:play">「' + rank + '」として伏せて出す（1〜4枚）</button></div>';
    if(myTurn && pub.phase === "respond") html += '<div class="row"><button type="button" class="button" data-t="cg:doubt">ダウト！</button><button type="button" class="button-secondary" data-t="cg:accept">信じる</button></div>';
    return html;
}

function cgIndianView(v, me, opp, myTurn, pub){
    const chips = pub.chips || {}, contrib = pub.contrib || {}, last = pub.last;
    let html = '<div class="meta">ラウンド ' + (pub.round || 0) + ' / ' + (pub.rounds || 5) + '　場のコイン：' + (pub.pot || 0) + '</div>' +
        '<div class="meta">コイン：あなた ' + (chips[me] ?? "-") + ' ／ ' + escapeHtml(vsName(opp)) + ' ' + (chips[opp] ?? "-") + '</div>';
    if(v.status === "playing"){
        html += '<div><b>' + escapeHtml(vsName(opp)) + '</b> のカード（見えます）<div class="bj-hand">' + (v.seen || []).map((c) => cgCard(c, "disabled")).join("") + '</div></div>' +
            '<div><b>あなた</b>のカード（見えません）<div class="bj-hand">' + cgBack("disabled") + '</div></div>' +
            '<div class="meta">掛け：あなた ' + (contrib[me] || 0) + ' ／ 相手 ' + (contrib[opp] || 0) + '（上限4）。数字が大きい方が勝ち（A=1が最小、Kが最大）。</div>';
        if(myTurn) html += '<div class="row"><button type="button" class="button" data-t="cg:raise">レイズ（+1）</button><button type="button" class="button-secondary" data-t="cg:call">' + ((contrib[opp] || 0) > (contrib[me] || 0) ? "コール（勝負）" : "勝負する") + '</button><button type="button" class="button-secondary" data-t="cg:fold">ドロップ</button></div>';
    }
    if(last){
        if(last.folded) html += '<div class="admin-card">直前：' + escapeHtml(vsName(last.folded)) + ' がドロップ</div>';
        if(last.showdown) html += '<div class="admin-card">直前の勝負：' + Object.keys(last.cards || {}).map((id) => escapeHtml(vsName(id)) + ' = ' + CG_RANK_LABEL[last.cards[id]]).join(' ／ ') + ' → ' + (last.winner ? escapeHtml(vsName(last.winner)) + " の勝ち" : "引き分け") + '（' + last.pot + 'コイン）</div>';
    }
    return html;
}
