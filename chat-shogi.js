"use strict";
// ===== 将棋（チャットの中で2人対戦）=====
// 駒の動き・成り・持ち駒（打つ）・王手放置/二歩/打ち歩詰め/行き所のない駒の反則チェック・詰み判定・投了に対応。
// 千日手（同じ局面が4回で引き分け。ただし王手をかけ続けていた側は負け）、入玉宣言（24点法）、500手で引き分けに対応。先手＝始めた人、後手＝最初に指した別の人。
// 仕組みは他の対戦と同じ（手をメッセージにして、盤面は毎回つくり直す）。みんなで遊ぶ用で、本気の不正対策ではありません。

const SG_NAMES = {P:"歩", L:"香", N:"桂", S:"銀", G:"金", B:"角", R:"飛", K:"玉"};
const SG_PROM = {P:"と", L:"杏", N:"圭", S:"全", B:"馬", R:"龍"};
const SG_HAND_ORDER = ["P", "L", "N", "S", "G", "B", "R"];
const SG_KANJI = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
let sgSel = null;

VS_GAMES.shogi = {name:"将棋", icon:"♟️", desc:"9×9。成り・持ち駒・王手・詰み・千日手・入玉宣言・投了に対応", marks:["☗先手", "☖後手"]};

function sgOwner(c){ return c === "" ? -1 : Number(c[0]); }
function sgProm(c){ return c[1] === "+"; }
function sgType(c){ return c[sgProm(c) ? 2 : 1]; }
function sgMake(o, t, p){ return String(o) + (p ? "+" : "") + t; }

function sgInitial(){
    const c = new Array(81).fill("");
    const back = ["L", "N", "S", "G", "K", "G", "S", "N", "L"];
    for(let i = 0; i < 9; i++){
        c[i] = sgMake(1, back[i]); c[72 + i] = sgMake(0, back[i]);
        c[18 + i] = sgMake(1, "P"); c[54 + i] = sgMake(0, "P");
    }
    c[9 + 1] = sgMake(1, "R"); c[9 + 7] = sgMake(1, "B");
    c[63 + 1] = sgMake(0, "B"); c[63 + 7] = sgMake(0, "R");
    return c;
}

function sgShape(t, p, o){
    const d = o === 0 ? -1 : 1, gold = [[d, -1], [d, 0], [d, 1], [0, -1], [0, 1], [-d, 0]];
    const diag = [[1, 1], [1, -1], [-1, 1], [-1, -1]], orth = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    if(p){
        if(t === "B") return {steps:orth, slides:diag};
        if(t === "R") return {steps:diag, slides:orth};
        return {steps:gold, slides:[]};
    }
    switch(t){
        case "P": return {steps:[[d, 0]], slides:[]};
        case "L": return {steps:[], slides:[[d, 0]]};
        case "N": return {steps:[[2 * d, -1], [2 * d, 1]], slides:[]};
        case "S": return {steps:[[d, -1], [d, 0], [d, 1], [-d, -1], [-d, 1]], slides:[]};
        case "G": return {steps:gold, slides:[]};
        case "K": return {steps:diag.concat(orth), slides:[]};
        case "B": return {steps:[], slides:diag};
        default: return {steps:[], slides:orth};
    }
}

/** 駒が動ける（または利いている）マス。自分の駒があるマスは除く */
function sgTargets(cells, idx){
    const c = cells[idx], o = sgOwner(c), sh = sgShape(sgType(c), sgProm(c), o), r = Math.floor(idx / 9), col = idx % 9, out = [];
    sh.steps.forEach(([dr, dc]) => {
        const nr = r + dr, nc = col + dc;
        if(nr < 0 || nr > 8 || nc < 0 || nc > 8) return;
        const t = nr * 9 + nc;
        if(sgOwner(cells[t]) !== o) out.push(t);
    });
    sh.slides.forEach(([dr, dc]) => {
        let nr = r + dr, nc = col + dc;
        while(nr >= 0 && nr <= 8 && nc >= 0 && nc <= 8){
            const t = nr * 9 + nc, oc = sgOwner(cells[t]);
            if(oc === o) break;
            out.push(t);
            if(oc !== -1) break;
            nr += dr; nc += dc;
        }
    });
    return out;
}
function sgKingPos(cells, o){ for(let i = 0; i < 81; i++) if(cells[i] && sgOwner(cells[i]) === o && sgType(cells[i]) === "K") return i; return -1; }
function sgInCheck(cells, o){
    const k = sgKingPos(cells, o);
    if(k < 0) return false;
    for(let i = 0; i < 81; i++) if(cells[i] && sgOwner(cells[i]) === 1 - o && sgTargets(cells, i).includes(k)) return true;
    return false;
}
function sgInZone(idx, o){ const r = Math.floor(idx / 9); return o === 0 ? r <= 2 : r >= 6; }
function sgDeadRank(t, to, o){
    const r = Math.floor(to / 9), far = o === 0 ? r : 8 - r;
    return ((t === "P" || t === "L") && far === 0) || (t === "N" && far <= 1);
}

/** 反則を除いたすべての指し手。{src, to, promote}。src: 0〜80=盤上のマス、81〜87=持ち駒（SG_HAND_ORDER の順） */
function sgLegal(cells, hands, o, stopAtFirst, onlySrc){
    const out = [];
    const push = (m) => { out.push(m); return stopAtFirst; };
    for(let i = 0; i < 81; i++){
        if(!cells[i] || sgOwner(cells[i]) !== o || (onlySrc !== undefined && onlySrc !== i)) continue;
        const t = sgType(cells[i]), p = sgProm(cells[i]);
        for(const to of sgTargets(cells, i)){
            const opts = [];
            const canPro = !p && SG_PROM[t] && (sgInZone(i, o) || sgInZone(to, o));
            if(!sgDeadRank(t, to, o) || p) opts.push(false);
            if(canPro) opts.push(true);
            for(const pro of opts){
                const next = cells.slice(); next[to] = sgMake(o, t, p || pro); next[i] = "";
                if(sgInCheck(next, o)) continue;
                if(push({src:i, to, promote:pro})) return out;
            }
        }
    }
    const h = hands[o];
    SG_HAND_ORDER.forEach((t, k) => {
        if(!h[t] || (onlySrc !== undefined && onlySrc !== 81 + k)) return;
        if(stopAtFirst && out.length) return;
        for(let to = 0; to < 81; to++){
            if(cells[to] || sgDeadRank(t, to, o)) continue;
            if(t === "P"){
                const col = to % 9;
                let twice = false;
                for(let r = 0; r < 9; r++){ const c = cells[r * 9 + col]; if(c && sgOwner(c) === o && sgType(c) === "P" && !sgProm(c)) twice = true; }
                if(twice) continue;
            }
            const next = cells.slice(); next[to] = sgMake(o, t, false);
            if(sgInCheck(next, o)) continue;
            if(t === "P" && sgInCheck(next, 1 - o)){
                // 打ち歩詰め：歩を打って詰ませるのは反則
                const nh = [Object.assign({}, hands[0]), Object.assign({}, hands[1])]; nh[o].P--;
                if(!sgLegal(next, nh, 1 - o, true).length) continue;
            }
            if(push({src:81 + k, to, promote:false})) return;
        }
    });
    return out;
}

function sgApplyMove(cells, hands, o, m){
    const next = cells.slice(), h = [Object.assign({}, hands[0]), Object.assign({}, hands[1])];
    if(m.src >= 81){ const t = SG_HAND_ORDER[m.src - 81]; h[o][t]--; next[m.to] = sgMake(o, t, false); }
    else{
        const c = next[m.src], t = sgType(c), p = sgProm(c), cap = next[m.to];
        if(cap){ const ct = sgType(cap); h[o][ct] = (h[o][ct] || 0) + 1; }
        next[m.to] = sgMake(o, t, p || m.promote); next[m.src] = "";
    }
    return {cells:next, hands:h};
}

/** 入玉宣言（24点法）：玉が敵陣にいて王手されておらず、敵陣の玉以外の駒が10枚以上、点数（大駒5・小駒1、持ち駒を含む）が先手28／後手27以上 */
function sgDeclarable(cells, hands, o){
    const k = sgKingPos(cells, o);
    if(k < 0 || !sgInZone(k, o) || sgInCheck(cells, o)) return false;
    let n = 0, pts = 0;
    for(let i = 0; i < 81; i++){
        const c = cells[i];
        if(!c || sgOwner(c) !== o || sgType(c) === "K" || !sgInZone(i, o)) continue;
        n++; pts += (sgType(c) === "R" || sgType(c) === "B") ? 5 : 1;
    }
    if(n < 10) return false;
    SG_HAND_ORDER.forEach((t) => { const c = hands[o][t] || 0; pts += c * ((t === "R" || t === "B") ? 5 : 1); });
    return pts >= (o === 0 ? 28 : 27);
}

function sgEncode(m){ return (m.src * 81 + m.to) * 2 + (m.promote ? 1 : 0); }
function sgDecode(i){ i = Number(i); if(!Number.isInteger(i) || i < 0) return null; const promote = i % 2 === 1, rest = (i - (promote ? 1 : 0)) / 2; return {src:Math.floor(rest / 81), to:rest % 81, promote}; }
function sgSquare(idx){ return (9 - (idx % 9)) + SG_KANJI[Math.floor(idx / 9) + 1]; }

/** 千日手：同じ局面（持ち駒・手番とも同じ）が4回目になったら終局。連続王手をかけ続けた側がいれば、その側の負け */
function sgRepetition(S, mover){
    const key = S.cells.join(",") + "|" + JSON.stringify(SG_HAND_ORDER.map((t) => [S.hands[0][t] || 0, S.hands[1][t] || 0])) + "|" + S.turn;
    S.plies.push({key, mover, check:S.check});
    let first = -1, count = 0;
    S.plies.forEach((p, i) => { if(p.key === key){ count++; if(first < 0) first = i; } });
    if(count < 4) return false;
    const cycle = S.plies.slice(first + 1);
    const allCheck = (side) => { const mine = cycle.filter((p) => p.mover === side); return mine.length > 0 && mine.every((p) => p.check); };
    const a = allCheck(0), b = allCheck(1);
    S.over = true;
    if(a && !b){ S.winner = 1; S.reason = "千日手（連続王手のため先手の負け）"; }
    else if(b && !a){ S.winner = 0; S.reason = "千日手（連続王手のため後手の負け）"; }
    else{ S.winner = -1; S.reason = "千日手"; }
    return true;
}

VS_ENGINES.shogi = {
    init:() => ({players:[null, null], turn:0, over:false, winner:-1, cells:sgInitial(), hands:[{}, {}], last:null, moves:0, check:false, reason:"", plies:[]}),
    apply:(S, item, sender) => {
        if(item.kind === "resign"){
            const idx = S.players.indexOf(sender);
            if(idx < 0) return;
            S.over = true; S.winner = 1 - idx; S.reason = "投了";
            return;
        }
        if(item.kind === "declare"){
            if(!vsEntitled(S, sender) || !sgDeclarable(S.cells, S.hands, S.turn)) return;
            vsClaim(S, sender);
            S.over = true; S.winner = S.turn; S.reason = "入玉宣言"; return;
        }
        if(item.kind !== "move" || !vsEntitled(S, sender)) return;
        const m = sgDecode(item.i);
        if(!m || m.src > 87 || m.to > 80) return;
        const legal = sgLegal(S.cells, S.hands, S.turn, false, m.src);
        if(!legal.some((x) => x.src === m.src && x.to === m.to && x.promote === m.promote)) return;
        vsClaim(S, sender);
        const r = sgApplyMove(S.cells, S.hands, S.turn, m);
        S.cells = r.cells; S.hands = r.hands; S.last = {src:m.src, to:m.to}; S.moves++;
        const mover = S.turn; S.turn = 1 - S.turn;
        S.check = sgInCheck(S.cells, S.turn);
        if(!sgLegal(S.cells, S.hands, S.turn, true).length){ S.over = true; S.winner = mover; S.reason = S.check ? "詰み" : "指せる手なし"; }
        else if(sgRepetition(S, mover)) return;
        else if(S.moves >= 500){ S.over = true; S.winner = -1; S.reason = "500手で引き分け"; }
    },
    score:(S) => S.winner >= 0 ? VS_GAMES.shogi.marks[S.winner] + " " + vsName(S.players[S.winner]) + " の勝ち！" : "引き分け",
    view:(S, ctx) => {
        const me = state.user.id;
        const myIdx = S.players[0] === me ? 0 : (S.players[1] === me || (S.players[1] === null && S.players[0] !== me) ? 1 : -1);
        const flip = myIdx === 1, gid = ctx.gid;
        const sel = sgSel && sgSel.gid === S.gidKey ? sgSel : null;
        const legal = ctx.myTurn ? sgLegal(S.cells, S.hands, S.turn) : [];
        const targets = new Set(sel ? legal.filter((m) => m.src === sel.src).map((m) => m.to) : []);
        const canSrc = new Set(legal.map((m) => m.src));
        const handHtml = (o, mine) => '<div class="vs-sg-hand">' + VS_GAMES.shogi.marks[o].slice(0, 1) + (o === 0 ? "先手" : "後手") + '：' +
            (SG_HAND_ORDER.some((t) => S.hands[o][t]) ? SG_HAND_ORDER.map((t, k) => S.hands[o][t] ? '<button type="button" class="vs-sg-hp' + (sel && sel.src === 81 + k && mine ? " sel" : "") + '"' + (mine && ctx.myTurn && canSrc.has(81 + k) ? ' data-vs="' + gid + '" data-k="selhand" data-i="' + k + '"' : " disabled") + '>' + SG_NAMES[t] + (S.hands[o][t] > 1 ? S.hands[o][t] : "") + '</button>' : "").join("") : "なし") + '</div>';
        const order = [...Array(81).keys()];
        if(flip) order.reverse();
        const cellsHtml = order.map((i) => {
            const c = S.cells[i], o = sgOwner(c);
            const cls = "vs-sg-cell" + (i === (S.last && S.last.to) ? " last" : "") + (sel && sel.src === i ? " sel" : "") + (targets.has(i) ? " tgt" : "");
            const label = c ? '<span class="vs-sg-piece' + (sgProm(c) ? " pro" : "") + (o === 1 ? " gote" : "") + '">' + (sgProm(c) ? SG_PROM[sgType(c)] : (sgType(c) === "K" ? (o === 0 ? "玉" : "王") : SG_NAMES[sgType(c)])) + '</span>' : "";
            const active = ctx.myTurn && (targets.has(i) || (c && o === S.turn && canSrc.has(i)));
            return '<button type="button" class="' + cls + '"' + (active ? ' data-vs="' + gid + '" data-k="sel" data-i="' + i + '"' : " disabled") + '>' + label + '</button>';
        }).join("");
        const top = flip ? 0 : 1, bottom = flip ? 1 : 0;
        return handHtml(top, myIdx === top) + '<div class="vs-sg-board">' + cellsHtml + '</div>' + handHtml(bottom, myIdx === bottom) +
            (S.check && !S.over ? '<div class="vs-status"><b>王手！</b></div>' : "") + '<div class="meta">' + S.moves + '手目' + (S.last ? '　直前：' + sgSquare(S.last.to) : "") + '</div>' +
            (myIdx >= 0 && ctx.myTurn && sgDeclarable(S.cells, S.hands, S.turn) ? '<button type="button" class="button" data-vs="' + gid + '" data-k="declare">入玉宣言（24点）</button> ' : "") +
            (myIdx >= 0 && !S.over && S.players[1] !== null ? '<button type="button" class="button-secondary" data-vs="' + gid + '" data-k="resign">投了</button>' : "");
    },
    moveText:(item) => {
        if(item.kind === "resign") return "投了しました";
        if(item.kind === "declare") return "入玉宣言をしました";
        const m = sgDecode(item.i);
        if(!m) return "指しました";
        return sgSquare(m.to) + (m.src >= 81 ? "に " + SG_NAMES[SG_HAND_ORDER[m.src - 81]] + " を打ちました" : "へ指しました" + (m.promote ? "（成り）" : ""));
    }
};

/** 駒・持ち駒の選択（盤面の再描画だけ。サーバーには何も送りません） */
function shogiSelect(gid, kind, value){
    const S = vsCompute(gid);
    if(!S || S.game !== "shogi" || !vsMyTurn(S)) return;
    S.gidKey = gid;
    const legal = sgLegal(S.cells, S.hands, S.turn);
    const idx = Number(value);
    if(kind === "selhand"){ sgSel = {gid, src:81 + idx}; if(typeof renderMessages === "function") renderMessages(false); return; }
    if(sgSel && sgSel.gid === gid){
        const moves = legal.filter((m) => m.src === sgSel.src && m.to === idx);
        if(moves.length){
            let m = moves[0];
            if(moves.length > 1) m = moves.find((x) => x.promote === confirm("成りますか？\n［OK］成る　［キャンセル］成らない")) || moves[0];
            sgSel = null;
            return vsAction(gid, "move", sgEncode(m));
        }
    }
    sgSel = S.cells[idx] && sgOwner(S.cells[idx]) === S.turn ? {gid, src:idx} : null;
    if(typeof renderMessages === "function") renderMessages(false);
}
