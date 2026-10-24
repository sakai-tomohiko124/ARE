"use strict";
// ===== 対戦ゲーム 第2弾：五目並べ・チェス・ヒット＆ブロー・連想ゲーム・絵しりとり =====
// 仕組みは chat-vs.js と同じです（手をメッセージとして送り、盤面はメッセージから毎回つくり直す）。
// ・ヒット＆ブロー／絵しりとりは、答えがメッセージの中に入っているため、技術的には読めてしまいます（みんなで遊ぶ用）。

VS_GAMES.gomoku = {name:"五目並べ", icon:"⚫", desc:"15×15。縦・横・斜めに5つそろえたら勝ち", marks:["⚫", "⚪"]};
VS_GAMES.chess = {name:"チェス", icon:"♞", desc:"ふつうのルール（キャスリング・アンパッサン・プロモーション・チェックメイト）", marks:["白", "黒"]};
VS_GAMES.hb = {name:"ヒット＆ブロー", icon:"🎯", desc:"4けたの数字（重なりなし）を先に当てた人の勝ち", marks:["①", "②"]};
VS_GAMES.assoc = {name:"連想ゲーム", icon:"💭", desc:"前のことばから連想することばを交互に。何語続くか挑戦（協力）", marks:["①", "②"]};
VS_GAMES.esh = {name:"絵しりとり", icon:"🖍️", desc:"ことばを絵で描いて、相手が当てる。当てたら、次の絵を描く", marks:["①", "②"]};
const VS2 = {gomoku:1, chess:1, hb:1, assoc:1, esh:1};

function vs2Resign(S, sender){
    const idx = S.players.indexOf(sender);
    if(idx < 0 || S.over) return;
    S.over = true; S.winner = 1 - idx; S.reason = "投了";
}

// ---------- 五目並べ ----------
const GM_N = 15;
function gmWin(cells, i, p){
    const r0 = Math.floor(i / GM_N), c0 = i % GM_N;
    for(const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]){
        const line = [i];
        for(const s of [1, -1]){
            let r = r0 + dr * s, c = c0 + dc * s;
            while(r >= 0 && r < GM_N && c >= 0 && c < GM_N && cells[r * GM_N + c] === p){ line.push(r * GM_N + c); r += dr * s; c += dc * s; }
        }
        if(line.length >= 5) return line;
    }
    return null;
}
VS_ENGINES.gomoku = {
    init:() => ({players:[null, null], turn:0, over:false, winner:-1, cells:new Array(GM_N * GM_N).fill(-1), count:0, line:null, last:-1, reason:""}),
    apply:(S, item, sender) => {
        if(item.kind === "resign") return vs2Resign(S, sender);
        if(item.kind !== "move" || !vsEntitled(S, sender)) return;
        const i = Number(item.i);
        if(!Number.isInteger(i) || i < 0 || i >= GM_N * GM_N || S.cells[i] !== -1) return;
        vsClaim(S, sender); S.cells[i] = S.turn; S.count++; S.last = i;
        const hit = gmWin(S.cells, i, S.turn);
        if(hit){ S.winner = S.turn; S.over = true; S.line = hit; }
        else if(S.count === GM_N * GM_N){ S.over = true; }
        else S.turn = 1 - S.turn;
    },
    view:(S, ctx) => '<div class="vs-gm">' + S.cells.map((v, i) => '<button type="button" class="vs-gm-c' + (i === S.last ? " last" : "") + (S.line && S.line.includes(i) ? " win" : "") + '"' + (v === -1 && ctx.myTurn ? ' data-vs="' + ctx.gid + '" data-i="' + i + '" aria-label="' + (Math.floor(i / GM_N) + 1) + '行' + (i % GM_N + 1) + '列"' : " disabled") + '>' + (v === -1 ? "" : ctx.marks[v]) + '</button>').join("") + '</div>' + vs2ResignBtn(S, ctx),
    moveText:(item) => item.kind === "resign" ? "投了しました" : (Math.floor(Number(item.i) / GM_N) + 1) + "行" + (Number(item.i) % GM_N + 1) + "列に置きました"
};
function vs2ResignBtn(S, ctx){
    const me = state.user.id;
    return !S.over && S.players.includes(me) && S.players[1] !== null ? '<div class="row"><button type="button" class="button-secondary" data-vs="' + ctx.gid + '" data-k="resign">投了</button></div>' : "";
}

// ---------- チェス ----------
const CH_GLYPH = {k:"♚", q:"♛", r:"♜", b:"♝", n:"♞", p:"♟"};
const CH_NAME = {k:"キング", q:"クイーン", r:"ルーク", b:"ビショップ", n:"ナイト", p:"ポーン"};
const CH_PROMO = ["", "q", "r", "b", "n"];
function chOwner(c){ return !c ? -1 : (c === c.toUpperCase() ? 0 : 1); }
function chStart(){
    const back = "rnbqkbnr".split("");
    return back.concat(new Array(8).fill("p"), new Array(32).fill(""), new Array(8).fill("P"), back.map((x) => x.toUpperCase()));
}
const CH_KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const CH_KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const CH_DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]], CH_ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
function chAttacked(cells, sq, by){
    const r0 = Math.floor(sq / 8), c0 = sq % 8, at = (r, c) => (r < 0 || r > 7 || c < 0 || c > 7) ? "" : cells[r * 8 + c];
    const mine = (ch, t) => ch && chOwner(ch) === by && ch.toLowerCase() === t;
    const pr = by === 0 ? r0 + 1 : r0 - 1;
    if(mine(at(pr, c0 - 1), "p") || mine(at(pr, c0 + 1), "p")) return true;
    if(CH_KN.some(([dr, dc]) => mine(at(r0 + dr, c0 + dc), "n"))) return true;
    if(CH_KG.some(([dr, dc]) => mine(at(r0 + dr, c0 + dc), "k"))) return true;
    for(const [dirs, types] of [[CH_DIAG, "bq"], [CH_ORTH, "rq"]]){
        for(const [dr, dc] of dirs){
            let r = r0 + dr, c = c0 + dc;
            while(r >= 0 && r < 8 && c >= 0 && c < 8){
                const ch = cells[r * 8 + c];
                if(ch){ if(chOwner(ch) === by && types.includes(ch.toLowerCase())) return true; break; }
                r += dr; c += dc;
            }
        }
    }
    return false;
}
function chKing(cells, color){ const k = color === 0 ? "K" : "k"; return cells.indexOf(k); }
/** 動かせる手（王が取られる手は除く）。{from,to,promo,ep,castle} */
function chLegal(S, color){
    const cells = S.cells, out = [];
    const push = (from, to, extra) => out.push(Object.assign({from, to, promo:"", ep:false, castle:""}, extra || {}));
    for(let from = 0; from < 64; from++){
        const ch = cells[from]; if(!ch || chOwner(ch) !== color) continue;
        const t = ch.toLowerCase(), r0 = Math.floor(from / 8), c0 = from % 8;
        if(t === "p"){
            const dir = color === 0 ? -1 : 1, startRow = color === 0 ? 6 : 1, last = color === 0 ? 0 : 7, r1 = r0 + dir;
            const add = (to, ep) => { if(Math.floor(to / 8) === last) ["q", "r", "b", "n"].forEach((p) => push(from, to, {promo:p})); else push(from, to, {ep:!!ep}); };
            if(r1 >= 0 && r1 < 8 && !cells[r1 * 8 + c0]){
                add(r1 * 8 + c0);
                if(r0 === startRow && !cells[(r0 + 2 * dir) * 8 + c0]) push(from, (r0 + 2 * dir) * 8 + c0);
            }
            for(const dc of [-1, 1]){
                const c1 = c0 + dc; if(c1 < 0 || c1 > 7 || r1 < 0 || r1 > 7) continue;
                const to = r1 * 8 + c1;
                if(cells[to] && chOwner(cells[to]) === 1 - color) add(to);
                else if(to === S.ep && !cells[to]) add(to, true);
            }
        }else if(t === "n" || t === "k"){
            for(const [dr, dc] of (t === "n" ? CH_KN : CH_KG)){
                const r = r0 + dr, c = c0 + dc; if(r < 0 || r > 7 || c < 0 || c > 7) continue;
                const tc = cells[r * 8 + c]; if(!tc || chOwner(tc) !== color) push(from, r * 8 + c);
            }
            if(t === "k"){
                const row = color === 0 ? 7 : 0, ks = color === 0 ? "K" : "k", qs = color === 0 ? "Q" : "q", rook = color === 0 ? "R" : "r";
                if(from === row * 8 + 4 && !chAttacked(cells, from, 1 - color)){
                    if(S.castle[ks] && cells[row * 8 + 7] === rook && !cells[row * 8 + 5] && !cells[row * 8 + 6] && !chAttacked(cells, row * 8 + 5, 1 - color) && !chAttacked(cells, row * 8 + 6, 1 - color)) push(from, row * 8 + 6, {castle:"K"});
                    if(S.castle[qs] && cells[row * 8] === rook && !cells[row * 8 + 1] && !cells[row * 8 + 2] && !cells[row * 8 + 3] && !chAttacked(cells, row * 8 + 3, 1 - color) && !chAttacked(cells, row * 8 + 2, 1 - color)) push(from, row * 8 + 2, {castle:"Q"});
                }
            }
        }else{
            const dirs = t === "b" ? CH_DIAG : t === "r" ? CH_ORTH : CH_DIAG.concat(CH_ORTH);
            for(const [dr, dc] of dirs){
                let r = r0 + dr, c = c0 + dc;
                while(r >= 0 && r < 8 && c >= 0 && c < 8){
                    const tc = cells[r * 8 + c];
                    if(!tc) push(from, r * 8 + c);
                    else{ if(chOwner(tc) !== color) push(from, r * 8 + c); break; }
                    r += dr; c += dc;
                }
            }
        }
    }
    return out.filter((m) => { const n = chMake(S, m, color); return !chAttacked(n.cells, chKing(n.cells, color), 1 - color); });
}
/** 手を指した後の盤面（S は変えない） */
function chMake(S, m, color){
    const cells = S.cells.slice(), ch = cells[m.from], t = ch.toLowerCase();
    const castle = Object.assign({}, S.castle);
    let ep = -1, capture = !!cells[m.to];
    cells[m.to] = m.promo ? (color === 0 ? m.promo.toUpperCase() : m.promo) : ch; cells[m.from] = "";
    if(m.ep){ cells[m.to + (color === 0 ? 8 : -8)] = ""; capture = true; }
    if(m.castle){ const row = color === 0 ? 7 : 0; if(m.castle === "K"){ cells[row * 8 + 5] = cells[row * 8 + 7]; cells[row * 8 + 7] = ""; } else { cells[row * 8 + 3] = cells[row * 8]; cells[row * 8] = ""; } }
    if(t === "p" && Math.abs(m.to - m.from) === 16) ep = (m.from + m.to) / 2;
    if(t === "k"){ if(color === 0){ castle.K = 0; castle.Q = 0; } else { castle.k = 0; castle.q = 0; } }
    [[56, "Q"], [63, "K"], [0, "q"], [7, "k"]].forEach(([sq, k]) => { if(m.from === sq || m.to === sq) castle[k] = 0; });
    return {cells, castle, ep, half:(t === "p" || capture) ? 0 : S.half + 1};
}
function chEncode(m){ return m.from * 64 + m.to + 4096 * Math.max(0, CH_PROMO.indexOf(m.promo || "")); }
function chDecode(i){ i = Number(i); if(!Number.isInteger(i) || i < 0 || i >= 4096 * 5) return null; const p = Math.floor(i / 4096), r = i % 4096; return {from:Math.floor(r / 64), to:r % 64, promo:CH_PROMO[p]}; }
function chSquare(sq){ return "abcdefgh"[sq % 8] + (8 - Math.floor(sq / 8)); }
function chInsufficient(cells){
    const rest = cells.filter((c) => c && c.toLowerCase() !== "k").map((c) => c.toLowerCase());
    return rest.length === 0 || (rest.length === 1 && (rest[0] === "b" || rest[0] === "n"));
}
VS_ENGINES.chess = {
    init:() => ({players:[null, null], turn:0, over:false, winner:-1, cells:chStart(), castle:{K:1, Q:1, k:1, q:1}, ep:-1, half:0, last:null, check:false, reason:"", moves:0}),
    apply:(S, item, sender) => {
        if(item.kind === "resign") return vs2Resign(S, sender);
        if(item.kind !== "move" || !vsEntitled(S, sender)) return;
        const d = chDecode(item.i); if(!d) return;
        const m = chLegal(S, S.turn).find((x) => x.from === d.from && x.to === d.to && x.promo === d.promo);
        if(!m) return;
        vsClaim(S, sender);
        const n = chMake(S, m, S.turn), mover = S.turn;
        S.cells = n.cells; S.castle = n.castle; S.ep = n.ep; S.half = n.half; S.last = {from:m.from, to:m.to}; S.moves++;
        S.turn = 1 - S.turn;
        S.check = chAttacked(S.cells, chKing(S.cells, S.turn), mover);
        if(!chLegal(S, S.turn).length){ S.over = true; if(S.check){ S.winner = mover; S.reason = "チェックメイト"; } else { S.winner = -1; S.reason = "ステイルメイト（引き分け）"; } }
        else if(chInsufficient(S.cells)){ S.over = true; S.reason = "駒が足りず引き分け"; }
        else if(S.half >= 100){ S.over = true; S.reason = "50手ルールで引き分け"; }
    },
    score:(S) => S.winner >= 0 ? VS_GAMES.chess.marks[S.winner] + " " + vsName(S.players[S.winner]) + " の勝ち！" : "引き分け",
    view:(S, ctx) => {
        const me = state.user.id, myIdx = S.players[0] === me ? 0 : (S.players[1] === me || (S.players[1] === null && S.players[0] !== me) ? 1 : -1);
        const flip = myIdx === 1, sel = chSel && chSel.gid === S.gidKey ? chSel : null;
        const legal = ctx.myTurn ? chLegal(S, S.turn) : [], from = new Set(legal.map((m) => m.from)), tgt = new Set(sel ? legal.filter((m) => m.from === sel.src).map((m) => m.to) : []);
        const order = [...Array(64).keys()]; if(flip) order.reverse();
        const kingSq = S.check ? chKing(S.cells, S.turn) : -1;
        const cellsHtml = order.map((i) => {
            const ch = S.cells[i], dark = (Math.floor(i / 8) + i % 8) % 2 === 1;
            const cls = "vs-ch-c" + (dark ? " d" : "") + (S.last && (S.last.from === i || S.last.to === i) ? " last" : "") + (sel && sel.src === i ? " sel" : "") + (tgt.has(i) ? " tgt" : "") + (i === kingSq ? " chk" : "");
            const active = ctx.myTurn && (tgt.has(i) || from.has(i));
            return '<button type="button" class="' + cls + '"' + (active ? ' data-vs="' + ctx.gid + '" data-k="sel" data-i="' + i + '"' : " disabled") + ' aria-label="' + chSquare(i) + (ch ? " " + (chOwner(ch) === 0 ? "白" : "黒") + CH_NAME[ch.toLowerCase()] : "") + '">' + (ch ? '<span class="vs-ch-p ' + (chOwner(ch) === 0 ? "w" : "b") + '">' + CH_GLYPH[ch.toLowerCase()] + '</span>' : "") + '</button>';
        }).join("");
        return '<div class="vs-ch">' + cellsHtml + '</div>' + (S.check && !S.over ? '<div class="vs-status"><b>チェック！</b></div>' : "") + '<div class="meta">' + S.moves + '手目' + (S.last ? '　直前：' + chSquare(S.last.from) + '→' + chSquare(S.last.to) : "") + (myIdx >= 0 ? '　あなたは' + (myIdx === 0 ? "白" : "黒") : "") + '</div>' + vs2ResignBtn(S, ctx);
    },
    moveText:(item) => { if(item.kind === "resign") return "投了しました"; const d = chDecode(item.i); return d ? chSquare(d.from) + " → " + chSquare(d.to) + (d.promo ? "（" + CH_NAME[d.promo] + "に昇格）" : "") : "指しました"; }
};
let chSel = null;
function chessSelect(gid, value){
    const S = vsCompute(gid);
    if(!S || S.game !== "chess" || !vsMyTurn(S)) return;
    S.gidKey = gid;
    const legal = chLegal(S, S.turn), idx = Number(value);
    if(chSel && chSel.gid === gid){
        const moves = legal.filter((m) => m.from === chSel.src && m.to === idx);
        if(moves.length){
            let m = moves[0];
            if(moves.length > 1){
                m = moves.find((x) => x.promo === "q");
                if(!confirm("ポーンが昇格します。クイーンにしますか？\n［キャンセル］で別の駒を選びます")){
                    const a = (prompt("昇格する駒：1=ルーク 2=ビショップ 3=ナイト", "1") || "").trim();
                    const p = {"1":"r", "2":"b", "3":"n"}[a];
                    if(!p) return;
                    m = moves.find((x) => x.promo === p);
                }
            }
            chSel = null;
            return vsAction(gid, "move", chEncode(m));
        }
    }
    chSel = S.cells[idx] && chOwner(S.cells[idx]) === S.turn ? {gid, src:idx} : null;
    if(typeof renderMessages === "function") renderMessages(false);
}

// ---------- ヒット＆ブロー ----------
function hbSecret(gid){
    let h = 2166136261; for(const ch of String(gid)){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const rnd = vsRng(h), d = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for(let i = 9; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    return d.slice(0, 4).join("");
}
function hbCount(secret, guess){
    let hit = 0, blow = 0;
    for(let i = 0; i < 4; i++){ if(guess[i] === secret[i]) hit++; else if(secret.includes(guess[i])) blow++; }
    return {hit, blow};
}
function hbValid(g){ return /^\d{4}$/.test(g) && new Set(g).size === 4; }
VS_ENGINES.hb = {
    init:(start) => ({players:[null, null], turn:0, over:false, winner:-1, secret:hbSecret(start.gid), guesses:[], reason:""}),
    apply:(S, item, sender) => {
        if(item.kind === "resign") return vs2Resign(S, sender);
        if(item.kind !== "move" || !vsEntitled(S, sender)) return;
        const g = String(item.i == null ? "" : item.i);
        if(!hbValid(g)) return;
        vsClaim(S, sender);
        const r = hbCount(S.secret, g);
        S.guesses.push({p:S.turn, g, hit:r.hit, blow:r.blow});
        if(r.hit === 4){ S.over = true; S.winner = S.turn; S.reason = S.guesses.length + "回目で正解"; }
        else if(S.guesses.length >= 24){ S.over = true; S.reason = "24回で決着つかず"; }
        else S.turn = 1 - S.turn;
    },
    score:(S) => S.winner >= 0 ? VS_GAMES.hb.marks[S.winner] + " " + vsName(S.players[S.winner]) + " の勝ち！" : "引き分け",
    view:(S, ctx) => {
        let html = '<div class="meta">0〜9の数字4つ（重なりなし）。ヒット＝数字も場所も合っている／ブロー＝数字だけ合っている</div><div class="vs-hb">' +
            (S.guesses.length ? S.guesses.map((x) => '<div><span class="chip">' + VS_GAMES.hb.marks[x.p] + '</span> <b>' + x.g + '</b> → ' + x.hit + 'ヒット ' + x.blow + 'ブロー</div>').join("") : '<span class="meta">まだ予想がありません</span>') + '</div>';
        if(S.over) return html + '<div class="meta">答え：<b>' + S.secret + '</b></div>' + vs2ResignBtn(S, ctx);
        if(ctx.myTurn) html += '<form class="row" data-vsform="' + ctx.gid + '" style="flex-wrap:nowrap"><input type="text" inputmode="numeric" maxlength="4" pattern="\\d{4}" placeholder="例：0123" aria-label="予想する4けた" style="flex:1;min-width:0"><button type="submit" class="button">予想</button></form>';
        return html + vs2ResignBtn(S, ctx);
    },
    moveText:(item) => item.kind === "resign" ? "投了しました" : "予想：" + String(item.i)
};

// ---------- 連想ゲーム（協力）----------
VS_ENGINES.assoc = {
    init:() => ({players:[null, null], turn:0, over:false, winner:-1, words:[], norm:[], reason:""}),
    apply:(S, item, sender) => {
        if(item.kind === "end" && S.players.includes(sender) && S.words.length){ S.over = true; S.reason = "おわりにしました"; return; }
        if(item.kind !== "move" || !vsEntitled(S, sender)) return;
        const w = String(item.i == null ? "" : item.i).trim().slice(0, 20), n = vsKana(w);
        if(!w || S.norm.includes(n)) return;
        vsClaim(S, sender); S.words.push(w); S.norm.push(n); S.turn = 1 - S.turn;
    },
    score:(S) => S.words.length + "語つながりました",
    view:(S, ctx) => {
        let html = '<div class="vs-words">' + (S.words.length ? S.words.map((w, i) => '<span class="chip">' + (i + 1) + '. ' + escapeHtml(w) + '</span>').join(" → ") : '<span class="meta">最初のことばを入れてください（お題は自由）</span>') + '</div>';
        if(S.over) return html + '<div class="meta">' + escapeHtml(S.reason) + '</div>';
        if(ctx.myTurn){
            html += '<form class="row" data-vsform="' + ctx.gid + '" style="flex-wrap:nowrap"><input type="text" maxlength="20" placeholder="' + (S.words.length ? "「" + escapeHtml(S.words[S.words.length - 1]) + "」から連想することば" : "ことば") + '" aria-label="ことば" style="flex:1;min-width:0"><button type="submit" class="button">送る</button></form>';
            if(S.words.length) html += '<button type="button" class="button-secondary" data-vs="' + ctx.gid + '" data-k="end">ここでおわり</button>';
        }
        return html;
    },
    moveText:(item) => item.kind === "end" ? "おわりにしました" : "「" + String(item.i || "") + "」"
};

// ---------- 絵しりとり ----------
VS_ENGINES.esh = {
    init:() => ({players:[null, null], turn:0, over:false, winner:-1, rounds:[], phase:"draw", reason:"", tries:0}),
    apply:(S, item, sender) => {
        if(item.kind === "resign") return vs2Resign(S, sender);
        if(!vsEntitled(S, sender)) return;
        const cur = S.rounds[S.rounds.length - 1];
        if(item.kind === "draw" && S.phase === "draw"){
            const w = vsKana(String(item.w || ""));
            if(!/^[ぁ-ゖー]{1,12}$/.test(w) || !item.url) return;
            if(S.rounds.some((r) => r.w === w)) return;
            if(cur && vsWordHead(w) !== vsWordTail(cur.w)) return;
            vsClaim(S, sender);
            S.rounds.push({by:sender, w, url:String(item.url), solved:false, gaveUp:false, wrong:[]});
            if(w.endsWith("ん")){ S.over = true; S.winner = 1 - S.turn; S.reason = "「ん」で終わりました"; return; }
            S.phase = "guess"; S.turn = 1 - S.turn; S.tries = 0;
        }else if(item.kind === "guess" && S.phase === "guess" && cur){
            if(cur.by === sender) return;
            const g = vsKana(String(item.i || "")); if(!g) return;
            vsClaim(S, sender);
            if(g === cur.w){ cur.solved = true; S.phase = "draw"; }
            else{ cur.wrong.push(String(item.i).slice(0, 20)); S.tries++; if(S.tries >= 5){ cur.gaveUp = true; S.phase = "draw"; } }
        }else if(item.kind === "giveup" && S.phase === "guess" && cur && cur.by !== sender){
            vsClaim(S, sender); cur.gaveUp = true; S.phase = "draw";
        }
    },
    score:(S) => S.winner >= 0 ? VS_GAMES.esh.marks[S.winner] + " " + vsName(S.players[S.winner]) + " の勝ち！（" + S.rounds.length + "枚）" : S.rounds.length + "枚つながりました",
    view:(S, ctx) => {
        const me = state.user.id;
        const html = '<div class="vs-esh">' + S.rounds.map((r, i) => {
            const show = r.solved || r.gaveUp || r.by === me || S.over, last = i === S.rounds.length - 1;
            const url = typeof safeHttpUrl === "function" ? safeHttpUrl(r.url) : "";
            return '<div class="vs-esh-r">' + (url ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer"><img src="' + escapeHtml(url) + '" alt="' + (show ? escapeHtml(r.w) + "の絵" : (i + 1) + "枚目の絵") + '" loading="lazy"></a>' : "") +
                '<div class="meta">' + (i + 1) + '. ' + escapeHtml(vsName(r.by)) + 'の絵：' + (show ? '<b>' + escapeHtml(r.w) + '</b>' + (r.gaveUp ? "（降参）" : r.solved ? " ✔" : "") : "？".repeat(Array.from(r.w).length) + (last ? "（" + Array.from(r.w).length + "文字）" : "")) + (r.wrong.length ? '<br>はずれ：' + r.wrong.map(escapeHtml).join("、") : "") + '</div></div>';
        }).join("") + '</div>';
        if(S.over) return html + '<div class="meta">' + escapeHtml(S.reason) + '</div>';
        const cur = S.rounds[S.rounds.length - 1];
        if(!ctx.myTurn) return html + vs2ResignBtn(S, ctx);
        if(S.phase === "draw"){
            const need = cur ? vsWordTail(cur.w) : "";
            return html + '<div class="meta">' + (need ? "「" + escapeHtml(need) + "」から始まることばを絵にしてください。" : "好きなことばを絵にしてください。") + '「ん」で終わると負けです。</div><button type="button" class="button" data-vs="' + ctx.gid + '" data-k="paint">🖍️ 絵を描く</button>' + vs2ResignBtn(S, ctx);
        }
        return html + '<form class="row" data-vsform="' + ctx.gid + '" style="flex-wrap:nowrap"><input type="text" maxlength="20" placeholder="なんの絵？（ひらがな）" aria-label="答え" style="flex:1;min-width:0"><button type="submit" class="button">答える</button></form><div class="meta">あと' + (5 - S.tries) + '回まで</div><button type="button" class="button-secondary" data-vs="' + ctx.gid + '" data-k="giveup">降参（答えを見る）</button>' + vs2ResignBtn(S, ctx);
    },
    moveText:(item) => item.kind === "draw" ? "絵を描きました" : item.kind === "guess" ? "答え：「" + String(item.i || "") + "」" : item.kind === "giveup" ? "降参しました" : "投了しました"
};

// ---------- 操作（chat-vs.js の vsAction を拡張）----------
const vsActionOrig = vsAction;
vsAction = async function(gid, kind, value){
    const S = vsCompute(gid);
    if(!S || !VS2[S.game] || !state.currentRoom) return vsActionOrig.apply(this, arguments);
    if(kind === "sel"){ if(S.game === "chess") chessSelect(gid, value); return; }
    if(kind === "resign"){ if(!confirm("投了しますか？")) return; return sendMessagePayload({type:"game", game:S.game, gid, kind:"resign"}); }
    if(S.over) return;
    if(!vsMyTurn(S)){ showToast("いまは相手の番です。"); return; }
    const send = (extra) => sendMessagePayload(Object.assign({type:"game", game:S.game, gid, kind}, extra));
    if(S.game === "hb"){
        const g = String(value || "").trim();
        if(!hbValid(g)){ showToast("0〜9の数字4つを、重ならないように入れてください。"); return; }
        return send({i:g});
    }
    if(S.game === "assoc"){
        if(kind === "end") return send({});
        const w = String(value || "").trim().slice(0, 20), n = vsKana(w);
        if(!w){ return; }
        if(S.norm.includes(n)){ showToast("同じことばはもう使われています。"); return; }
        return send({i:w});
    }
    if(S.game === "esh"){
        if(kind === "giveup") return send({});
        if(kind === "guess" || kind === "move"){ const g = String(value || "").trim(); if(!g) return; kind = "guess"; return sendMessagePayload({type:"game", game:"esh", gid, kind:"guess", i:g.slice(0, 20)}); }
        if(kind === "paint"){
            const cur = S.rounds[S.rounds.length - 1], need = cur ? vsWordTail(cur.w) : "";
            const w = vsKana(prompt((need ? "「" + need + "」から始まる" : "") + "描きたいことばを、ひらがなで入れてください（相手には見えません）") || "");
            if(!w) return;
            if(!/^[ぁ-ゖー]{1,12}$/.test(w)){ showToast("ひらがな12文字までで入れてください。"); return; }
            if(S.rounds.some((r) => r.w === w)){ showToast("同じことばはもう使われています。"); return; }
            if(cur && vsWordHead(w) !== need){ showToast("「" + need + "」から始まることばにしてください。"); return; }
            return openDraw({game:{game:"esh", gid, kind:"draw", w}});
        }
        return;
    }
    // gomoku
    return send({i:Number(value)});
};
