"use strict";
// ===== 日程調整ボード（候補日に ○ △ × で投票）=====
// ・チャットに「日程調整」を貼ると、みんなが候補ごとに ○（行ける）△（たぶん）×（無理）を選べます。
// ・いちばん ○ が多い候補（同数なら △ が多い方）に「いちばん合う」と出ます。作った人は締め切れます。
// ・投票はサーバーに保存され、そのチャットのメンバーだけが見られます。

const bd = {id:null, board:null, votes:[], names:new Map(), timer:null, opts:[], chan:null};
const BD_MARK = {o:"○", t:"△", x:"×"};

function initBoard(){
    registerTool("board", onBoardAction);
    extraBubbles.board = (item) => '<div class="bubble">📅 <b>' + escapeHtml(item.title || "日程調整") + '</b><br><span class="meta">候補に ○△× で答えてください</span><br>' +
        '<button type="button" class="button-secondary" data-openboard="' + escapeHtml(item.boardId || "") + '">開く・投票する</button></div>';
    el.messages.addEventListener("click", (e) => { const b = e.target.closest("[data-openboard]"); if(b) runTool(() => openBoard(b.dataset.openboard)); });
    try{ bd.chan = requireClient().channel("are-board").on("postgres_changes", {event:"*", schema:"public", table:"schedule_votes"}, (p) => {
        const id = (p.new && p.new.board_id) || (p.old && p.old.board_id);
        if(bd.id && (!id || id === bd.id)) boardRefresh();
    }).subscribe(); }catch(_e){}
}

function boardDay(d){
    const w = "日月火水木金土"[d.getDay()];
    return (d.getMonth() + 1) + "/" + d.getDate() + "(" + w + ")";
}

// ---------- 作る ----------
function openBoardCreate(){
    if(!state.currentRoom){ showToast("先にチャットを開いてください。"); return; }
    bd.opts = [];
    boardCreateView();
}
function boardCreateView(){
    openSheet(toolHead("📅 日程調整をつくる", "候補を2〜10個。作るとチャットに貼られます") +
        '<label for="bdTitle">タイトル</label><input type="text" id="bdTitle" maxlength="60" placeholder="例：忘年会の日" value="' + escapeHtml((document.getElementById("bdTitle") || {}).value || "") + '">' +
        '<label>候補（日付と時間を選んで「追加」）</label>' +
        '<div class="row" style="flex-wrap:nowrap"><input type="datetime-local" id="bdDt" style="flex:1;background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:9px"><button type="button" class="button-secondary" data-t="board:add">追加</button></div>' +
        '<div class="row" style="flex-wrap:nowrap"><input type="text" id="bdFree" maxlength="30" placeholder="または文字で（例：来週末の夜）" style="flex:1"><button type="button" class="button-secondary" data-t="board:addtext">追加</button></div>' +
        '<div id="bdList">' + (bd.opts.length ? bd.opts.map((o, i) => '<div class="row" style="justify-content:space-between"><span>' + (i + 1) + '. ' + escapeHtml(o) + '</span><button type="button" class="button-secondary" data-t="board:rm" data-i="' + i + '" aria-label="削除">🗑</button></div>').join("") : '<div class="meta">まだ候補がありません。</div>') + '</div>' +
        '<div class="row"><button type="button" data-t="board:create">チャットに貼る</button><button type="button" class="button-secondary" data-pm="close">閉じる</button></div>');
}

async function boardAddOpt(text){
    const t = String(text || "").trim().slice(0, 30);
    if(!t) return;
    if(bd.opts.length >= 10){ showToast("候補は10個までです。"); return; }
    if(bd.opts.includes(t)){ showToast("同じ候補があります。"); return; }
    bd.opts.push(t); boardCreateView();
}

// ---------- 開く・投票 ----------
async function openBoard(id){
    if(!/^[0-9a-f-]{36}$/i.test(String(id || ""))){ showToast("日程調整が見つかりません。"); return; }
    bd.id = id; bd.sig = ""; bd.shown = null;
    openSheet(toolHead("📅 日程調整") + '<div class="meta">読み込み中…</div>');
    await boardRefresh();
    clearInterval(bd.timer);
    bd.timer = setInterval(() => { if(!el.profileModal.hidden && bd.id) boardRefresh(); else { clearInterval(bd.timer); bd.id = null; } }, 8000);
}

async function boardRefresh(){
    const id = bd.id; if(!id) return;
    const c = requireClient();
    const [b, v] = await Promise.all([c.from("schedule_boards").select("id,room_id,created_by,title,options,closed").eq("id", id).maybeSingle(), c.from("schedule_votes").select("user_id,option_idx,vote").eq("board_id", id)]);
    if(bd.id !== id) return;
    if(b.error || !b.data){ openSheet(toolHead("📅 日程調整") + '<div class="meta">この日程調整は見つからないか、見る権限がありません。</div>' + toolClose()); return; }
    const sig = JSON.stringify([b.data, v.data]);
    const same = sig === bd.sig && bd.shown === id && !el.profileModal.hidden;
    bd.sig = sig; bd.board = b.data; bd.votes = v.data || [];
    if(same) return;
    const ids = Array.from(new Set(bd.votes.map((x) => x.user_id).concat(b.data.created_by))).filter((u) => u !== state.user.id && !bd.names.has(u));
    if(ids.length){
        const p = await c.from(TABLES.profiles).select("id,display_name").in("id", ids);
        (p.data || []).forEach((x) => bd.names.set(x.id, x.display_name || "ユーザー"));
    }
    if(bd.id === id && !el.profileModal.hidden){ const top = el.profileSheet.scrollTop; boardPaint(); bd.shown = id; el.profileSheet.scrollTop = top; }
}

function boardName(uid){
    if(uid === state.user.id) return "あなた";
    return profileDisplayName({id:uid, display_name:bd.names.get(uid) || (feat.known.get(uid) || {}).display_name});
}

function boardTally(){
    const opts = bd.board.options || [];
    return opts.map((label, i) => {
        const vs = bd.votes.filter((x) => x.option_idx === i);
        return {label, i, o:vs.filter((x) => x.vote === "o").length, t:vs.filter((x) => x.vote === "t").length, x:vs.filter((x) => x.vote === "x").length, vs};
    });
}

function boardPaint(){
    const b = bd.board, rows = boardTally();
    const best = rows.slice().sort((a, c) => (c.o - a.o) || (c.t - a.t) || (a.x - c.x))[0];
    const hasVotes = bd.votes.length > 0;
    const mine = (i) => (bd.votes.find((x) => x.option_idx === i && x.user_id === state.user.id) || {}).vote || "";
    const mineOwner = b.created_by === state.user.id;
    openSheet(toolHead("📅 " + escapeHtml(b.title), (b.closed ? "締め切り済み ・ " : "") + "作成：" + escapeHtml(boardName(b.created_by)) + " ・ 回答した人：" + new Set(bd.votes.map((x) => x.user_id)).size + "人") +
        rows.map((r) => {
            const isBest = hasVotes && best && best.i === r.i && r.o > 0;
            return '<div class="admin-card" style="' + (isBest ? "border-color:var(--success)" : "") + '"><div><b>' + escapeHtml(r.label) + '</b>' + (isBest ? ' <span class="meta" style="color:var(--success)">★ いちばん合う</span>' : "") + '</div>' +
                '<div class="meta">○ ' + r.o + ' ・ △ ' + r.t + ' ・ × ' + r.x + '</div>' +
                '<div class="row" style="justify-content:flex-start">' + ["o", "t", "x"].map((k) => '<button type="button" class="' + (mine(r.i) === k ? "" : "button-secondary") + '" data-t="board:vote" data-i="' + r.i + '" data-v="' + k + '"' + (b.closed ? " disabled" : "") + ' aria-pressed="' + (mine(r.i) === k) + '" aria-label="' + escapeHtml(r.label) + 'に' + BD_MARK[k] + '">' + BD_MARK[k] + '</button>').join("") + '</div>' +
                (r.vs.length ? '<div class="meta">' + r.vs.map((x) => escapeHtml(boardName(x.user_id)) + BD_MARK[x.vote]).join(" ・ ") + '</div>' : "") + '</div>';
        }).join("") +
        '<div class="row"><button type="button" class="button-secondary" data-t="board:reload">最新にする</button>' + (mineOwner ? '<button type="button" class="button-secondary" data-t="board:close" data-v="' + (b.closed ? "0" : "1") + '">' + (b.closed ? "再開する" : "締め切る") + '</button>' : "") + '<button type="button" class="button-secondary" data-pm="close">閉じる</button></div>');
}

async function onBoardAction(action, node){
    const c = requireClient();
    if(action === "add"){ const v = (document.getElementById("bdDt") || {}).value; if(!v){ showToast("日付と時間を選んでください。"); return; } const d = new Date(v); if(isNaN(d)) return; await boardAddOpt(boardDay(d) + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0")); }
    else if(action === "addtext"){ await boardAddOpt((document.getElementById("bdFree") || {}).value); }
    else if(action === "rm"){ bd.opts.splice(Number(node.dataset.i), 1); boardCreateView(); }
    else if(action === "create"){
        const title = String((document.getElementById("bdTitle") || {}).value || "").trim();
        if(!title){ showToast("タイトルを入力してください。"); return; }
        if(bd.opts.length < 2){ showToast("候補を2個以上入れてください。"); return; }
        const room = state.currentRoom; if(!room) return;
        const res = await c.rpc("sb_create", {p_room:room.id, p_title:title, p_options:bd.opts});
        if(res.error) throw res.error;
        closeSheet();
        await sendMessagePayload({type:"board", boardId:res.data, title}, {keepInput:true});
    }else if(action === "vote"){
        const i = Number(node.dataset.i), v = node.dataset.v;
        const cur = (bd.votes.find((x) => x.option_idx === i && x.user_id === state.user.id) || {}).vote || "";
        const res = await c.rpc("sb_vote", {p_board:bd.id, p_idx:i, p_vote:cur === v ? "" : v});
        if(res.error) throw res.error;
        await boardRefresh();
    }else if(action === "reload"){ await boardRefresh(); }
    else if(action === "close"){
        const res = await c.rpc("sb_close", {p_board:bd.id, p_closed:node.dataset.v === "1"});
        if(res.error) throw res.error;
        await boardRefresh();
    }
}
