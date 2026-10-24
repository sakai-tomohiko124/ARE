"use strict";
// ===== チャットの中で遊べる対戦ゲーム =====
// 仕組み：「対戦を始める」「手を打つ」を、ふつうのメッセージ（type:"game"）として送ります。盤面は、そのチャットのメッセージを順に読んで毎回つくり直します（サーバーの追加設定は不要）。
// ・始めた人が先手です。そのあと最初に有効な手を打った別の人が後手になります（グループでも遊べます）。
// ・順番ちがい・置けない場所・終わったあとの手は無視されます。
// ・本気の不正対策ではありません（みんなで遊ぶ用です）。手札を隠すゲーム（ババ抜きなど）は、別にサーバー側で処理します。

const VS_C4 = {cols:7, rows:6};
const VS_TOKENS = ["🔴", "🔵", "🟢", "🟡"];
const VS_SUGO_GOAL = 30;
const VS_SUGO_SPECIAL = {5:["🚀 3マス進む", 3], 9:["💥 2マス戻る", -2], 14:["😴 1回休み", "skip"], 18:["🚀 4マス進む", 4], 22:["💥 5マス戻る", -5], 26:["🌀 ふりだしに戻る", "start"]};
const VS_PAIR_EMOJI = ["🍎", "🍌", "🍇", "🍓", "🐶", "🐱", "🚗", "⭐"];

const VS_GAMES = {
    ttt:{name:"三目並べ", icon:"⭕", desc:"3×3。縦・横・斜めに3つそろえたら勝ち", marks:["○", "×"]},
    c4:{name:"四目並べ", icon:"🔴", desc:"7列×6段。縦・横・斜めに4つそろえたら勝ち", marks:["🔴", "🟡"]},
    rev:{name:"オセロ", icon:"⚫", desc:"8×8。はさんだ石を裏返す。置けないときは自動でパス", marks:["⚫", "⚪"]},
    sugo:{name:"すごろく", icon:"🎲", desc:"2〜4人。サイコロでゴール(30マス)をめざす", marks:VS_TOKENS},
    mem:{name:"神経衰弱（対戦）", icon:"🃏", desc:"2人で交互にめくる。ペアを取ると続けてめくれる", marks:["🅰️", "🅱️"]},
    word:{name:"協力しりとり", icon:"🔤", desc:"2人で協力。「ん」で終わらず、何語つながるか挑戦", marks:["①", "②"]}
};

function initVs(){
    registerTool("vs", onVsAction);
    const button = $("vsButton");
    if(button) button.addEventListener("click", () => runTool(openVsSheet));
    el.messages.addEventListener("click", (event) => {
        const node = event.target.closest("[data-vs]");
        if(!node || node.disabled) return;
        runTool(() => vsAction(node.dataset.vs, node.dataset.k || "move", node.dataset.i));
    });
    el.messages.addEventListener("submit", (event) => {
        const form = event.target.closest("[data-vsform]");
        if(!form) return;
        event.preventDefault();
        const input = form.querySelector("input");
        const value = input ? input.value.trim() : "";
        if(input) input.value = "";
        if(value) runTool(() => vsAction(form.dataset.vsform, "move", value));
    });
}

function openVsSheet(){
    if(!state.currentRoom){ showToast("先にチャットを開いてください。"); return; }
    openSheet(toolHead("🎮 対戦を始める", "相手が同じ画面から手を打つと、対戦が進みます。チャットの中に盤面が出ます。") +
        Object.keys(VS_GAMES).map((k) => '<button type="button" class="admin-card more-item" data-t="vs:start" data-g="' + k + '">' + VS_GAMES[k].icon + ' ' + VS_GAMES[k].name + '<small class="meta">' + VS_GAMES[k].desc + '</small></button>').join("") + toolClose());
}

async function onVsAction(action, node){
    if(action !== "start") return;
    const game = node.dataset.g;
    if(!VS_GAMES[game]) return;
    if(!state.currentRoom){ showToast("先にチャットを開いてください。"); return; }
    closeSheet();
    const gid = (self.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).replace(/[^0-9a-z-]/gi, "").slice(0, 36);
    const payload = {type:"game", game, gid, kind:"start"};
    if(game === "mem") payload.seed = Math.floor(Math.random() * 2147483647);
    await sendMessagePayload(payload);
}

// ---- 共通の部品 ----

function vsRng(seed){
    let a = (Number(seed) || 1) >>> 0;
    return function(){ a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function vsMessages(gid){
    return state.messages.map((m) => ({m, item:parseMessageContent(m.content)})).filter((x) => x.item.type === "game" && x.item.gid === gid);
}

function vsEntitled(S, sender){
    if(S.players[S.turn] === sender) return true;
    return S.players[S.turn] === null && !S.players.includes(sender);
}
function vsClaim(S, sender){ if(S.players[S.turn] === null) S.players[S.turn] = sender; }

function vsName(id){
    if(id === state.user.id) return "あなた";
    const p = feat.known.get(id) || (state.currentPartner && state.currentPartner.id === id ? state.currentPartner : null);
    return profileDisplayName(p);
}

function vsLinesFor(game){
    if(game === "ttt") return [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const lines = [], cols = VS_C4.cols, rows = VS_C4.rows;
    for(let r = 0; r < rows; r++) for(let c = 0; c < cols; c++){
        [[0,1],[1,0],[1,1],[1,-1]].forEach(([dr, dc]) => {
            const er = r + dr * 3, ec = c + dc * 3;
            if(er < 0 || er >= rows || ec < 0 || ec >= cols) return;
            lines.push([0,1,2,3].map((k) => (r + dr * k) * cols + (c + dc * k)));
        });
    }
    return lines;
}

// ---- ゲームごとの「ルール」と「表示」----

const VS_ENGINES = {
    ttt:{
        init:() => ({players:[null, null], turn:0, over:false, winner:-1, cells:new Array(9).fill(-1), count:0, line:null}),
        apply:(S, item, sender) => {
            if(item.kind !== "move" || !vsEntitled(S, sender)) return;
            const i = Number(item.i);
            if(!Number.isInteger(i) || i < 0 || i > 8 || S.cells[i] !== -1) return;
            vsClaim(S, sender); S.cells[i] = S.turn; S.count++;
            const hit = vsLinesFor("ttt").find((l) => l.every((c) => S.cells[c] === S.turn));
            if(hit){ S.winner = S.turn; S.over = true; S.line = hit; } else if(S.count === 9) S.over = true; else S.turn = 1 - S.turn;
        },
        view:(S, ctx) => '<div class="vs-board vs-ttt">' + S.cells.map((v, i) => ctx.btn(i, v === -1 ? "" : ctx.marks[v], v === -1 && ctx.myTurn, S.line && S.line.includes(i))).join("") + '</div>',
        moveText:(item) => "マス " + (Number(item.i) + 1) + " に置きました"
    },
    c4:{
        init:() => ({players:[null, null], turn:0, over:false, winner:-1, cells:new Array(VS_C4.cols * VS_C4.rows).fill(-1), count:0, line:null}),
        apply:(S, item, sender) => {
            if(item.kind !== "move" || !vsEntitled(S, sender)) return;
            const col = Number(item.i), cols = VS_C4.cols, rows = VS_C4.rows;
            if(!Number.isInteger(col) || col < 0 || col >= cols) return;
            let at = -1;
            for(let r = rows - 1; r >= 0; r--) if(S.cells[r * cols + col] === -1){ at = r * cols + col; break; }
            if(at < 0) return;
            vsClaim(S, sender); S.cells[at] = S.turn; S.count++;
            const hit = vsLinesFor("c4").find((l) => l.every((c) => S.cells[c] === S.turn));
            if(hit){ S.winner = S.turn; S.over = true; S.line = hit; } else if(S.count === S.cells.length) S.over = true; else S.turn = 1 - S.turn;
        },
        view:(S, ctx) => {
            let top = '<div class="vs-drop">';
            for(let c = 0; c < VS_C4.cols; c++) top += ctx.btn(c, "▼", ctx.myTurn && S.cells[c] === -1, false, "vs-dropbtn");
            return top + '</div><div class="vs-board vs-c4">' + S.cells.map((v, i) => '<span class="vs-cell' + (S.line && S.line.includes(i) ? " win" : "") + '">' + (v === -1 ? "" : ctx.marks[v]) + '</span>').join("") + '</div>';
        },
        moveText:(item) => (Number(item.i) + 1) + " 列に落としました"
    },
    rev:{
        init:() => { const b = new Array(64).fill(-1); b[27] = 1; b[28] = 0; b[35] = 0; b[36] = 1; return {players:[null, null], turn:0, over:false, winner:-1, cells:b, passed:false, last:-1}; },
        apply:(S, item, sender) => {
            if(item.kind !== "move" || !vsEntitled(S, sender)) return;
            const i = Number(item.i);
            const flips = vsRevFlips(S.cells, S.turn, i);
            if(!Number.isInteger(i) || !flips.length) return;
            vsClaim(S, sender);
            S.cells[i] = S.turn; flips.forEach((f) => { S.cells[f] = S.turn; }); S.last = i; S.passed = false;
            const other = 1 - S.turn;
            if(vsRevMoves(S.cells, other).length) S.turn = other;
            else if(vsRevMoves(S.cells, S.turn).length) S.passed = true;
            else{
                S.over = true;
                const black = S.cells.filter((v) => v === 0).length, white = S.cells.filter((v) => v === 1).length;
                S.winner = black === white ? -1 : (black > white ? 0 : 1);
            }
        },
        view:(S, ctx) => {
            const legal = ctx.myTurn ? new Set(vsRevMoves(S.cells, S.turn)) : new Set();
            const black = S.cells.filter((v) => v === 0).length, white = S.cells.filter((v) => v === 1).length;
            return '<div class="vs-board vs-rev">' + S.cells.map((v, i) => {
                if(v !== -1) return '<span class="vs-cell vs-disc' + (i === S.last ? " last" : "") + '">' + ctx.marks[v] + '</span>';
                return legal.has(i) ? ctx.btn(i, "·", true, false, "vs-legal") : '<span class="vs-cell"></span>';
            }).join("") + '</div><div class="meta">' + ctx.marks[0] + ' ' + black + ' ／ ' + ctx.marks[1] + ' ' + white + (S.passed ? "　（相手は置ける場所がなく、パスしました）" : "") + '</div>';
        },
        moveText:(item) => "(" + (Number(item.i) % 8 + 1) + "," + (Math.floor(Number(item.i) / 8) + 1) + ") に置きました"
    },
    mem:{
        init:(start) => {
            const rnd = vsRng(start.seed), deck = [];
            for(let k = 0; k < 8; k++) deck.push(k, k);
            for(let i = deck.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
            return {players:[null, null], turn:0, over:false, winner:-1, deck, taken:new Array(16).fill(-1), pending:-1, shown:[], score:[0, 0]};
        },
        apply:(S, item, sender) => {
            if(item.kind !== "move" || !vsEntitled(S, sender)) return;
            const i = Number(item.i);
            if(!Number.isInteger(i) || i < 0 || i > 15 || S.taken[i] !== -1 || i === S.pending) return;
            vsClaim(S, sender);
            if(S.pending === -1){ S.pending = i; S.shown = [i]; return; }
            const first = S.pending; S.pending = -1;
            if(S.deck[first] === S.deck[i]){
                S.taken[first] = S.turn; S.taken[i] = S.turn; S.score[S.turn]++; S.shown = [];
                if(S.taken.every((v) => v !== -1)){ S.over = true; S.winner = S.score[0] === S.score[1] ? -1 : (S.score[0] > S.score[1] ? 0 : 1); }
            }else{ S.shown = [first, i]; S.turn = 1 - S.turn; }
        },
        view:(S, ctx) => '<div class="vs-board vs-mem">' + S.deck.map((v, i) => {
            if(S.taken[i] !== -1) return '<span class="vs-cell vs-taken">' + VS_PAIR_EMOJI[v] + '</span>';
            if(S.shown.includes(i)) return '<span class="vs-cell vs-open">' + VS_PAIR_EMOJI[v] + '</span>';
            return ctx.btn(i, "？", ctx.myTurn, false);
        }).join("") + '</div><div class="meta">' + ctx.marks[0] + ' ' + S.score[0] + '組 ／ ' + ctx.marks[1] + ' ' + S.score[1] + '組</div>',
        moveText:(item) => (Number(item.i) + 1) + "番目をめくりました"
    },
    sugo:{
        init:() => ({players:[], maxp:4, phase:"join", turn:0, over:false, winner:-1, pos:[], skip:[], dice:0, note:"", log:[]}),
        apply:(S, item, sender, starter) => {
            if(S.phase === "join"){
                if(item.kind === "join" && !S.players.includes(sender) && S.players.length < S.maxp){ S.players.push(sender); S.pos.push(0); S.skip.push(0); }
                else if(item.kind === "go" && sender === starter && S.players.length >= 2) S.phase = "play";
                return;
            }
            if(item.kind !== "roll" || S.players[S.turn] !== sender) return;
            const d = Number(item.i);
            if(!Number.isInteger(d) || d < 1 || d > 6) return;
            const t = S.turn; let p = S.pos[t] + d; S.dice = d; S.note = "";
            if(p > VS_SUGO_GOAL) p = VS_SUGO_GOAL - (p - VS_SUGO_GOAL);
            const sp = VS_SUGO_SPECIAL[p];
            if(sp){
                S.note = sp[0];
                if(sp[1] === "skip") S.skip[t] = 1; else if(sp[1] === "start") p = 0; else p = Math.max(0, Math.min(VS_SUGO_GOAL, p + sp[1]));
            }
            S.pos[t] = p;
            if(p >= VS_SUGO_GOAL){ S.over = true; S.winner = t; return; }
            for(let k = 0; k < S.players.length; k++){
                S.turn = (S.turn + 1) % S.players.length;
                if(S.skip[S.turn] > 0){ S.skip[S.turn]--; continue; }
                break;
            }
        },
        view:(S, ctx) => {
            let html = '';
            if(S.phase === "join"){
                html += '<div class="meta">参加者：' + S.players.map((id, i) => VS_TOKENS[i] + ' ' + escapeHtml(vsName(id))).join("、") + '（2〜4人）</div><div class="row" style="justify-content:flex-start">';
                if(!S.players.includes(state.user.id) && S.players.length < S.maxp) html += '<button type="button" class="button-secondary" data-vs="' + ctx.gid + '" data-k="join">✋ 参加する</button>';
                if(S.players[0] === state.user.id && S.players.length >= 2) html += '<button type="button" class="button" data-vs="' + ctx.gid + '" data-k="go">▶ スタート</button>';
                return html + '</div>';
            }
            const cells = [];
            for(let n = 0; n <= VS_SUGO_GOAL; n++){
                const here = S.players.map((id, i) => S.pos[i] === n ? VS_TOKENS[i] : "").join("");
                const sp = VS_SUGO_SPECIAL[n];
                cells.push('<span class="vs-cell vs-sg' + (sp ? " sp" : "") + (n === VS_SUGO_GOAL ? " goal" : "") + '" title="' + escapeHtml(sp ? sp[0] : "") + '"><small>' + (n === 0 ? "S" : n === VS_SUGO_GOAL ? "G" : n) + '</small>' + here + '</span>');
            }
            html += '<div class="vs-board vs-sugo">' + cells.join("") + '</div>';
            if(S.dice) html += '<div class="meta">直前のサイコロ：🎲 ' + S.dice + (S.note ? "　" + escapeHtml(S.note) : "") + '</div>';
            if(ctx.myTurn) html += '<button type="button" class="button" data-vs="' + ctx.gid + '" data-k="roll" data-i="' + (1 + Math.floor(Math.random() * 6)) + '">🎲 サイコロを振る</button>';
            return html;
        },
        moveText:(item) => item.kind === "join" ? "参加しました" : item.kind === "go" ? "スタートしました" : "サイコロ：" + item.i
    },
    word:{
        init:() => ({players:[null, null], turn:0, over:false, winner:-1, words:[], reason:""}),
        apply:(S, item, sender) => {
            if(item.kind === "end" && S.players.includes(sender) && S.words.length){ S.over = true; S.reason = "おわりにしました"; return; }
            if(item.kind !== "move" || !vsEntitled(S, sender)) return;
            const w = vsKana(String(item.i || ""));
            const bad = vsWordCheck(S.words, w);
            if(bad) return;
            vsClaim(S, sender);
            S.words.push(w);
            if(w.endsWith("ん")){ S.over = true; S.reason = "「ん」で終わりました"; return; }
            S.turn = 1 - S.turn;
        },
        view:(S, ctx) => {
            let html = '<div class="vs-words">' + (S.words.length ? S.words.map((w, i) => '<span class="chip">' + (i + 1) + '. ' + escapeHtml(w) + '</span>').join(" ") : '<span class="meta">最初のことばを入れてください</span>') + '</div>';
            if(S.over) return html + '<div class="meta">' + escapeHtml(S.reason) + '</div>';
            if(ctx.myTurn){
                const need = S.words.length ? vsWordTail(S.words[S.words.length - 1]) : "";
                html += '<form class="row" data-vsform="' + ctx.gid + '" style="flex-wrap:nowrap"><input type="text" maxlength="20" placeholder="' + (need ? "「" + need + "」から始まることば" : "ひらがな・カタカナで") + '" aria-label="ことば" style="flex:1;min-width:0"><button type="submit" class="button">送る</button></form>';
                if(S.words.length) html += '<button type="button" class="button-secondary" data-vs="' + ctx.gid + '" data-k="end">ここでおわり</button>';
            }
            return html;
        },
        moveText:(item) => item.kind === "end" ? "おわりにしました" : "「" + String(item.i || "") + "」",
        score:(S) => S.words.length + "語つながりました"
    }
};

// しりとりの下ごしらえ
function vsKana(text){
    return text.normalize("NFKC").replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/\s+/g, "");
}
const VS_SMALL = {"ぁ":"あ","ぃ":"い","ぅ":"う","ぇ":"え","ぉ":"お","ゃ":"や","ゅ":"ゆ","ょ":"よ","っ":"つ","ゎ":"わ"};
function vsWordTail(w){
    let chars = Array.from(w);
    while(chars.length && chars[chars.length - 1] === "ー") chars.pop();
    const last = chars[chars.length - 1] || "";
    return VS_SMALL[last] || last;
}
function vsWordHead(w){ const c = Array.from(w)[0] || ""; return VS_SMALL[c] || c; }
function vsWordCheck(words, w){
    if(!/^[ぁ-ゖー]{2,20}$/.test(w)) return "ひらがな・カタカナで2文字以上入れてください。";
    if(w.startsWith("ー")) return "最初に「ー」は使えません。";
    if(words.includes(w)) return "同じことばはもう使われています。";
    if(words.length){ const need = vsWordTail(words[words.length - 1]); if(vsWordHead(w) !== need) return "「" + need + "」から始まることばにしてください。"; }
    return "";
}

// オセロの下ごしらえ
function vsRevFlips(cells, player, i){
    if(!Number.isInteger(i) || i < 0 || i > 63 || cells[i] !== -1) return [];
    const r0 = Math.floor(i / 8), c0 = i % 8, out = [];
    for(let dr = -1; dr <= 1; dr++) for(let dc = -1; dc <= 1; dc++){
        if(!dr && !dc) continue;
        const line = [];
        let r = r0 + dr, c = c0 + dc;
        while(r >= 0 && r < 8 && c >= 0 && c < 8 && cells[r * 8 + c] === 1 - player){ line.push(r * 8 + c); r += dr; c += dc; }
        if(line.length && r >= 0 && r < 8 && c >= 0 && c < 8 && cells[r * 8 + c] === player) out.push(...line);
    }
    return out;
}
function vsRevMoves(cells, player){
    const out = [];
    for(let i = 0; i < 64; i++) if(cells[i] === -1 && vsRevFlips(cells, player, i).length) out.push(i);
    return out;
}

// ---- 盤面の計算 ----

function vsCompute(gid){
    const list = vsMessages(gid);
    const start = list.find((x) => x.item.kind === "start");
    if(!start) return null;
    const game = start.item.game, E = VS_ENGINES[game];
    if(!E) return null;
    const S = E.init(start.item);
    S.game = game; S.starter = start.m.sender_id;
    if(game === "sugo"){ S.players.push(S.starter); S.pos.push(0); S.skip.push(0); }
    else S.players[0] = S.starter;
    list.forEach((x) => {
        if(S.over || x.item.kind === "start") return;
        E.apply(S, x.item, x.m.sender_id, S.starter);
    });
    return S;
}

function vsMyTurn(S){
    if(S.over) return false;
    if(S.game === "sugo") return S.phase === "play" && S.players[S.turn] === state.user.id;
    return S.players[S.turn] === state.user.id || (S.players[S.turn] === null && !S.players.includes(state.user.id));
}

// ---- 表示（renderMessageContent から呼ばれます）----

function renderGameBubble(item){
    if(item.game === "cg" && typeof renderCgBubble === "function") return renderCgBubble(item);
    const info = VS_GAMES[item.game], E = VS_ENGINES[item.game];
    if(!info || !E) return '<div class="bubble">🎮 対戦</div>';
    if(item.kind !== "start"){
        let text = "手を打ちました";
        try{ text = E.moveText(item); }catch(_e){ /* そのまま */ }
        return '<div class="bubble vs-move">' + info.icon + ' ' + escapeHtml(info.name) + '：' + escapeHtml(text) + '</div>';
    }
    const S = vsCompute(item.gid);
    if(!S) return '<div class="bubble">🎮 ' + escapeHtml(info.name) + '</div>';
    S.gidKey = item.gid;
    const gid = escapeHtml(item.gid), myTurn = vsMyTurn(S), marks = info.marks;
    const ctx = {gid, myTurn, marks, btn:(i, label, enabled, win, extra) => '<button type="button" class="vs-cell' + (extra ? " " + extra : "") + (win ? " win" : "") + '" data-vs="' + gid + '" data-i="' + i + '"' + (enabled ? "" : " disabled") + ' aria-label="' + (Number(i) + 1) + '">' + label + '</button>'};
    let status;
    if(item.game === "sugo" && S.phase === "join") status = "参加者をぼしゅう中";
    else if(S.over){
        if(E.score) status = E.score(S) + (S.reason ? "（" + S.reason + "）" : "");
        else status = S.winner >= 0 ? marks[S.winner] + " " + vsName(S.players[S.winner]) + " の勝ち！" : "引き分け";
    }else if(S.players[S.turn] === null) status = "次は " + marks[S.turn] + "（相手の番：先に打つと後手になります）";
    else status = "次は " + marks[S.turn] + " " + vsName(S.players[S.turn]) + " の番";
    return '<div class="bubble vs-bubble"><b>' + info.icon + ' ' + escapeHtml(info.name) + '</b> <span class="meta">' + escapeHtml(vsName(S.starter)) + ' が開始</span>' + E.view(S, ctx) + '<div class="vs-status">' + escapeHtml(status) + '</div></div>';
}

async function vsAction(gid, kind, value){
    if(kind === "sel" || kind === "selhand"){ if(typeof shogiSelect === "function") shogiSelect(gid, kind, value); return; }
    if(kind === "resign" && !confirm("投了しますか？")) return;
    const S = vsCompute(gid);
    if(!S || !state.currentRoom) return;
    if(kind === "move" || kind === "roll"){
        if(S.over) return;
        if(!vsMyTurn(S)){ showToast("いまは相手の番です。"); return; }
    }
    if(S.game === "word" && kind === "move"){
        const w = vsKana(String(value));
        const bad = vsWordCheck(S.words, w);
        if(bad){ showToast(bad); return; }
        value = w;
    }
    const payload = {type:"game", game:S.game, gid, kind};
    if(value !== undefined && value !== "") payload.i = (S.game === "word" && kind === "move") ? value : Number(value);
    await sendMessagePayload(payload);
}
