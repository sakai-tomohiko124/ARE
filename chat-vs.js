"use strict";
// ===== チャットの中で遊べる2人対戦ゲーム（三目並べ・四目並べ）=====
// 仕組み：「対戦を始める」「手を打つ」を、ふつうのメッセージ（type:"game"）として送ります。盤面は、そのチャットのメッセージを順に読んで毎回つくり直します（サーバーの追加設定は不要）。
// ・始めた人が先手（○／赤）。そのあと最初に有効な手を打った別の人が後手（×／黄）になります（グループでも遊べます）。
// ・順番ちがい・置けない場所・終わったあとの手は無視されます。
// ・本気の不正対策ではありません（みんなで遊ぶ用です）。

const VS_GAMES = {
    ttt:{name:"三目並べ", icon:"⭕", marks:["○", "×"]},
    c4:{name:"四目並べ", icon:"🔴", marks:["🔴", "🟡"], cols:7, rows:6}
};

function initVs(){
    registerTool("vs", onVsAction);
    const button = $("vsButton");
    if(button) button.addEventListener("click", () => runTool(openVsSheet));
    el.messages.addEventListener("click", (event) => {
        const node = event.target.closest("[data-vs]");
        if(!node || node.disabled) return;
        runTool(() => vsMove(node.dataset.vs, Number(node.dataset.i)));
    });
}

function openVsSheet(){
    if(!state.currentRoom){ showToast("先にチャットを開いてください。"); return; }
    openSheet(toolHead("🎮 対戦を始める", "相手が同じ画面から手を打つと、対戦が進みます。チャットの中に盤面が出ます。") +
        Object.keys(VS_GAMES).map((k) => '<button type="button" class="admin-card more-item" data-t="vs:start" data-g="' + k + '">' + VS_GAMES[k].icon + ' ' + VS_GAMES[k].name + '<small class="meta">' + (k === "ttt" ? "3×3。縦・横・斜めに3つそろえたら勝ち" : "7列×6段。縦・横・斜めに4つそろえたら勝ち") + '</small></button>').join("") + toolClose());
}

async function onVsAction(action, node){
    if(action !== "start") return;
    const game = node.dataset.g;
    if(!VS_GAMES[game]) return;
    if(!state.currentRoom){ showToast("先にチャットを開いてください。"); return; }
    closeSheet();
    const gid = (self.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).replace(/[^0-9a-z-]/gi, "").slice(0, 36);
    await sendMessagePayload({type:"game", game, gid, kind:"start"});
}

// ---- 盤面の計算 ----

function vsMessages(gid){
    return state.messages.map((m) => ({m, item:parseMessageContent(m.content)})).filter((x) => x.item.type === "game" && x.item.gid === gid);
}

function vsLines(game){
    if(game === "ttt") return [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const lines = [], cols = VS_GAMES.c4.cols, rows = VS_GAMES.c4.rows;
    for(let r = 0; r < rows; r++) for(let c = 0; c < cols; c++){
        [[0,1],[1,0],[1,1],[1,-1]].forEach(([dr, dc]) => {
            const er = r + dr * 3, ec = c + dc * 3;
            if(er < 0 || er >= rows || ec < 0 || ec >= cols) return;
            lines.push([0,1,2,3].map((k) => (r + dr * k) * cols + (c + dc * k)));
        });
    }
    return lines;
}

function vsCompute(gid){
    const list = vsMessages(gid);
    const start = list.find((x) => x.item.kind === "start");
    if(!start) return null;
    const game = start.item.game;
    if(!VS_GAMES[game]) return null;
    const cells = new Array(game === "ttt" ? 9 : VS_GAMES.c4.cols * VS_GAMES.c4.rows).fill(-1);
    const players = [start.m.sender_id, null];
    let turn = 0, winner = -1, over = false, count = 0, line = null;
    list.forEach((x) => {
        if(over || x.item.kind !== "move") return;
        const sender = x.m.sender_id;
        if(players[turn] === null){ if(sender === players[0]) return; }
        else if(sender !== players[turn]) return;
        let index = Number(x.item.i);
        if(!Number.isInteger(index)) return;
        if(game === "ttt"){
            if(index < 0 || index > 8 || cells[index] !== -1) return;
        }else{
            const cols = VS_GAMES.c4.cols, rows = VS_GAMES.c4.rows;
            if(index < 0 || index >= cols) return;
            let placed = -1;
            for(let r = rows - 1; r >= 0; r--) if(cells[r * cols + index] === -1){ placed = r * cols + index; break; }
            if(placed < 0) return;
            index = placed;
        }
        if(players[turn] === null) players[turn] = sender;
        cells[index] = turn; count++;
        const hit = vsLines(game).find((l) => l.every((c) => cells[c] === turn));
        if(hit){ winner = turn; over = true; line = hit; }
        else if(count === cells.length){ over = true; }
        else turn = 1 - turn;
    });
    return {game, cells, players, turn, winner, over, line, starter:start.m.sender_id};
}

function vsName(id){
    if(id === state.user.id) return "あなた";
    const p = feat.known.get(id) || (state.currentPartner && state.currentPartner.id === id ? state.currentPartner : null);
    return profileDisplayName(p);
}

// ---- 表示（renderMessageContent から呼ばれます）----

function renderGameBubble(item){
    const info = VS_GAMES[item.game];
    if(!info) return '<div class="bubble">🎮 対戦</div>';
    if(item.kind === "move"){
        const text = item.game === "ttt" ? "マス " + (Number(item.i) + 1) + " に置きました" : (Number(item.i) + 1) + " 列に落としました";
        return '<div class="bubble vs-move">' + info.icon + ' ' + escapeHtml(info.name) + '：' + escapeHtml(text) + '</div>';
    }
    const g = vsCompute(item.gid);
    if(!g) return '<div class="bubble">🎮 ' + escapeHtml(info.name) + '</div>';
    const myTurn = !g.over && (g.players[g.turn] === state.user.id || (g.players[g.turn] === null && g.starter !== state.user.id));
    let status;
    if(g.over) status = g.winner >= 0 ? info.marks[g.winner] + " " + vsName(g.players[g.winner]) + " の勝ち！" : "引き分け";
    else status = g.players[g.turn] === null ? "次は " + info.marks[g.turn] + "（相手の番：先に打つと後手になります）" : "次は " + info.marks[g.turn] + " " + vsName(g.players[g.turn]) + " の番";
    let board = "";
    if(item.game === "ttt"){
        board = '<div class="vs-board vs-ttt">' + g.cells.map((v, i) => '<button type="button" class="vs-cell' + (g.line && g.line.includes(i) ? " win" : "") + '" data-vs="' + escapeHtml(item.gid) + '" data-i="' + i + '"' + (v !== -1 || !myTurn ? " disabled" : "") + ' aria-label="マス' + (i + 1) + '">' + (v === -1 ? "" : info.marks[v]) + '</button>').join("") + '</div>';
    }else{
        const cols = VS_GAMES.c4.cols, rows = VS_GAMES.c4.rows;
        let top = '<div class="vs-drop">';
        for(let c = 0; c < cols; c++) top += '<button type="button" class="vs-cell vs-dropbtn" data-vs="' + escapeHtml(item.gid) + '" data-i="' + c + '"' + (!myTurn || g.cells[c] !== -1 ? " disabled" : "") + ' aria-label="' + (c + 1) + '列に落とす">▼</button>';
        top += '</div>';
        board = top + '<div class="vs-board vs-c4">' + g.cells.map((v, i) => '<span class="vs-cell' + (g.line && g.line.includes(i) ? " win" : "") + '">' + (v === -1 ? "" : info.marks[v]) + '</span>').join("") + '</div>';
    }
    return '<div class="bubble vs-bubble"><b>' + info.icon + ' ' + escapeHtml(info.name) + '</b> <span class="meta">' + escapeHtml(vsName(g.starter)) + ' が開始</span>' + board + '<div class="vs-status">' + escapeHtml(status) + '</div></div>';
}

async function vsMove(gid, index){
    const g = vsCompute(gid);
    if(!g || g.over || !state.currentRoom) return;
    const myTurn = g.players[g.turn] === state.user.id || (g.players[g.turn] === null && g.starter !== state.user.id);
    if(!myTurn){ showToast("いまは相手の番です。"); return; }
    await sendMessagePayload({type:"game", game:g.game, gid, kind:"move", i:index});
}
