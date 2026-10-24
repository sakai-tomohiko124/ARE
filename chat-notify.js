"use strict";
// ===== 未読バッジ・新着ポップアップ =====
// ・チャット一覧に未読件数（赤い丸の数字）、左のタブにも合計、ブラウザのタブ名にも「(3)」と表示します。
// ・新しいメッセージが来たら画面の上にポップアップ（押すとそのチャットが開く）。ブラウザの通知を許可すれば、別のタブを見ていても通知されます。
// ・「どこまで読んだか」はこの端末のブラウザに保存します（サーバーは使いません）。
// ・ARE のページを開いている間だけ動きます（アプリを閉じている間のプッシュ通知は、無料の範囲ではできません）。

feat.unread = {};
const nf = {seen:{}, key:"", baseTitle:"", rooms:"", pop:null, timer:null};

function nfLoad(){
    nf.key = "are_seen_" + state.user.id;
    try{ nf.seen = JSON.parse(localStorage.getItem(nf.key) || "{}") || {}; }catch(_e){ nf.seen = {}; }
}
function nfSave(){ try{ localStorage.setItem(nf.key, JSON.stringify(nf.seen)); }catch(_e){ /* 保存できなくても続ける */ } }

function nfMarkSeen(roomId, iso){
    if(!roomId) return;
    const now = new Date().toISOString();
    nf.seen[roomId] = iso && iso > now ? iso : now;
    nfSave();
    if(feat.unread[roomId]){ feat.unread[roomId] = 0; nfPaint(); }
}

/** 一覧にある部屋の未読数を数え直す（部屋の一覧が変わったとき・戻ってきたとき） */
async function nfRecount(){
    const rooms = state.rooms || [];
    if(!rooms.length) return;
    const now = new Date().toISOString();
    let changed = false;
    rooms.forEach((r) => { if(!nf.seen[r.id]){ nf.seen[r.id] = now; changed = true; } });   // 初めて見る部屋は「いま」から数える
    if(changed) nfSave();
    const since = rooms.map((r) => nf.seen[r.id]).sort()[0];
    try{
        const res = await requireClient().from(TABLES.messages).select("room_id,created_at,sender_id").in("room_id", rooms.map((r) => r.id)).neq("sender_id", state.user.id).gt("created_at", since).order("created_at", {ascending:false}).limit(1000);
        if(res.error) return;
        const counts = {};
        (res.data || []).forEach((m) => { if(m.created_at > (nf.seen[m.room_id] || "")) counts[m.room_id] = (counts[m.room_id] || 0) + 1; });
        const cur = state.currentRoom && !document.hidden ? state.currentRoom.id : null;
        feat.unread = {};
        Object.keys(counts).forEach((id) => { if(id !== cur) feat.unread[id] = counts[id]; });
        if(cur) nfMarkSeen(cur);
        nfPaint();
    }catch(_e){ /* 取れなければそのまま */ }
}

function nfLabel(n){ return n > 99 ? "99+" : String(n); }

function nfTotal(){ return Object.values(feat.unread).reduce((a, b) => a + b, 0); }

/** 一覧・左タブ・タブ名に反映 */
function nfPaint(){
    document.querySelectorAll("#roomList [data-room-id]").forEach((b) => {
        const n = feat.unread[b.dataset.roomId] || 0;
        let badge = b.querySelector(".nf-badge");
        if(!n){ if(badge) badge.remove(); b.classList.remove("has-unread"); return; }
        if(!badge){ badge = document.createElement("span"); badge.className = "nf-badge"; b.appendChild(badge); }
        badge.textContent = nfLabel(n); badge.setAttribute("aria-label", "未読" + n + "件");
        b.classList.add("has-unread");
    });
    const total = nfTotal(), rail = document.querySelector('.rail-btn[data-tab="chats"]');
    if(rail){
        let badge = rail.querySelector(".nf-badge");
        if(!total){ if(badge) badge.remove(); }
        else{ if(!badge){ badge = document.createElement("span"); badge.className = "nf-badge nf-rail"; rail.appendChild(badge); } badge.textContent = nfLabel(total); }
    }
    document.title = (total ? "(" + total + ") " : "") + nf.baseTitle;
    try{ if(typeof cfPaintRooms === "function") cfPaintRooms(); }catch(_e){}
}

function nfNotifyBanner(){
    const list = el.roomList;
    if(!list || list.querySelector(".nf-ask") || !("Notification" in window) || Notification.permission !== "default") return;
    const b = document.createElement("button");
    b.type = "button"; b.className = "nf-ask button-secondary";
    b.textContent = "🔔 新着をブラウザの通知でも受け取る";
    b.addEventListener("click", async () => {
        try{ const p = await Notification.requestPermission(); showToast(p === "granted" ? "通知をオンにしました。" : "通知は許可されませんでした。"); }catch(_e){ /* 無視 */ }
        b.remove();
    });
    list.prepend(b);
}

function nfOpenRoom(roomId){
    const room = (state.rooms || []).find((r) => r.id === roomId);
    if(room) selectRoom(room, room.partner);
}

function nfPopup(room, m){
    const group = Boolean(room.is_group);
    const roomName = group ? (room.name || "グループ") : profileDisplayName(room.partner);
    const who = group ? profileDisplayName(feat.known.get(m.sender_id)) + "（" + roomName + "）" : roomName;
    let body = "";
    try{ body = contentLine(m.content); }catch(_e){ body = "新しいメッセージ"; }
    body = String(body || "").replace(/\s+/g, " ").slice(0, 80);
    if(nf.pop) nf.pop.remove();
    const pop = document.createElement("button");
    pop.type = "button"; pop.className = "nf-pop";
    pop.innerHTML = '<strong>💬 ' + escapeHtml(who) + '</strong><span>' + escapeHtml(body) + '</span>';
    pop.addEventListener("click", () => { pop.remove(); nfOpenRoom(room.id); });
    document.body.appendChild(pop); nf.pop = pop;
    clearTimeout(nf.timer);
    nf.timer = setTimeout(() => { pop.remove(); if(nf.pop === pop) nf.pop = null; }, 6000);
    if("Notification" in window && Notification.permission === "granted" && document.hidden){
        try{
            const n = new Notification("ARE：" + who, {body, tag:room.id});
            n.onclick = () => { window.focus(); nfOpenRoom(room.id); n.close(); };
        }catch(_e){ /* 通知できない端末 */ }
    }
}

function nfOnInsert(m){
    if(m && m.room_id){ try{ if(typeof cfTouch === "function") cfTouch(m.room_id, m.created_at || new Date().toISOString()); }catch(_e){} }
    if(!m || m.sender_id === state.user.id) return;
    const room = (state.rooms || []).find((r) => r.id === m.room_id);
    if(!room){ if(typeof loadRooms === "function") setTimeout(loadRooms, 500); return; }
    if(state.currentRoom && state.currentRoom.id === m.room_id && !document.hidden){ nfMarkSeen(m.room_id, m.created_at); return; }
    feat.unread[m.room_id] = (feat.unread[m.room_id] || 0) + 1;
    try{ if(typeof cfTouch === "function") cfTouch(m.room_id, m.created_at); }catch(_e){}
    nfPaint();
    nfPopup(room, m);
}

function initNotify(){
    nfLoad();
    nf.baseTitle = document.title.replace(/^\(\d+\)\s*/, "");
    // 一覧を描き直すたびにバッジをつけ直す
    const orig = renderRooms;
    renderRooms = function(){
        orig.apply(this, arguments);
        nfPaint(); nfNotifyBanner();
        const ids = (state.rooms || []).map((r) => r.id).join(",");
        if(ids !== nf.rooms){ nf.rooms = ids; nfRecount(); }
    };
    addRoomHook((room) => { if(room) nfMarkSeen(room.id); });
    document.addEventListener("visibilitychange", () => {
        if(document.hidden) return;
        if(state.currentRoom) nfMarkSeen(state.currentRoom.id);
        nfRecount();
    });
    requireClient().channel("are-inbox").on("postgres_changes", {event:"INSERT", schema:"public", table:TABLES.messages}, (payload) => nfOnInsert(payload.new)).subscribe();
    feat.timers.push(setInterval(() => { if(!document.hidden) nfRecount(); }, 60000));   // 取りこぼし対策
    if(state.rooms && state.rooms.length){ nf.rooms = state.rooms.map((r) => r.id).join(","); nfRecount(); nfNotifyBanner(); }
}
