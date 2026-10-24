"use strict";
// ===== 名前の変更（チャット内：みんなに見える／プロフィールから：自分の画面だけ）と、入力中の表示 =====
// ・チャット内の名前（ニックネーム）：そのチャットに参加している全員に見えます（サーバーに保存）。
//     1対1のチャットは、2人とも自分と相手の名前を変えられます。グループは、自分の名前だけ変えられます（作成者はメンバーの名前も変えられます）。
// ・プロフィールで友だちにつける名前：この端末（自分の画面）にだけ保存。相手にも他のだれにも見えません。
// ・表示の優先順位：自分だけの名前 ＞ チャット内の名前 ＞ 本来の表示名
// ・入力中：チャットの上部と、一覧の相手の横にも「入力中…」を出します。

feat.nick = {priv:{}, room:new Map(), timer:null, loaded:false};

function nickPrivKey(){ return "are_nick_" + (state.user ? state.user.id : "x"); }
function nickPrivLoad(){ try{ const v = JSON.parse(localStorage.getItem(nickPrivKey()) || "{}"); feat.nick.priv = v && typeof v === "object" ? v : {}; }catch(_e){ feat.nick.priv = {}; } }
function nickPrivSave(){ try{ localStorage.setItem(nickPrivKey(), JSON.stringify(feat.nick.priv)); return true; }catch(_e){ showToast("この端末に保存できませんでした。"); return false; } }

async function nickLoadRoom(){
    try{
        const res = await requireClient().from("room_nicknames").select("room_id,user_id,nickname");
        if(res.error) return;
        feat.nick.room = new Map((res.data || []).map((r) => [r.room_id + ":" + r.user_id, r.nickname]));
        feat.nick.loaded = true;
        nickRefreshUi();
    }catch(_e){ /* 取れなければそのまま */ }
}

/** 名前を変えたあとの表示のつけ直し */
function nickRefreshUi(){
    try{ renderRooms(); }catch(_e){}
    try{ if(state.currentRoom){ el.chatTitle.textContent = roomTitle(state.currentRoom); renderMessages(false); } }catch(_e){}
}

function nickRoomName(roomId, userId){ return feat.nick.room.get(roomId + ":" + userId) || ""; }

function initNick(){
    registerTool("nick", onNickAction);
    nickPrivLoad();
    // どこでも「名前の表示」を通るので、ここだけ差し替えれば全画面に効く
    const orig = profileDisplayName;
    profileDisplayName = function(profile){
        const base = orig(profile);
        try{
            const id = profile && profile.id;
            if(!id || !state.user || id === state.user.id) return base;
            if(feat.nick.priv[id]) return feat.nick.priv[id];
            if(state.currentRoom){ const n = feat.nick.room.get(state.currentRoom.id + ":" + id); if(n) return n; }
        }catch(_e){ /* 元の名前を返す */ }
        return base;
    };
    // 一覧の名前は「そのチャットの名前」で出す
    const origRooms = renderRooms;
    renderRooms = function(){
        origRooms.apply(this, arguments);
        try{ nickPaintRoomList(); }catch(_e){}
    };
    // 入力中
    const origTyping = paintTyping;
    paintTyping = function(){ origTyping.apply(this, arguments); try{ nickPaintTyping(); }catch(_e){} };
    // ヘッダーのボタン
    const head = document.querySelector(".chat-header"), anchor = document.getElementById("refreshMessagesButton");
    if(!head || !anchor) throw new Error("チャットの上部が見つかりません。");
    const b = document.createElement("button");
    b.type = "button"; b.id = "nickBtn"; b.className = "button-secondary"; b.hidden = true; b.textContent = "🏷️";
    b.title = "このチャットでの名前を変更"; b.setAttribute("aria-label", b.title);
    b.addEventListener("click", () => runTool(openRoomNick));
    head.insertBefore(b, anchor);
    const sub = document.getElementById("chatSubtitle");
    if(sub){ const t = document.createElement("p"); t.id = "nkTyping"; t.className = "nk-typing"; t.hidden = true; sub.insertAdjacentElement("afterend", t); }
    addRoomHook((room) => { b.hidden = !room; nickPaintTyping(); });
    // 友だちのプロフィール画面に「自分だけの名前」欄を足す
    const origView = openProfileView;
    openProfileView = function(profile){ origView.apply(this, arguments); try{ nickProfileExtras(profile); }catch(e){ console.error("[ARE nick]", e); } };
    nickLoadRoom();
    feat.nick.timer = setInterval(() => { if(!document.hidden) nickLoadRoom(); }, 60000);
    try{ requireClient().channel("are-nick").on("postgres_changes", {event:"*", schema:"public", table:"room_nicknames"}, () => nickLoadRoom()).subscribe(); }catch(_e){}
}

function nickPaintRoomList(){
    document.querySelectorAll("#roomList [data-room-id]").forEach((btn) => {
        const room = (state.rooms || []).find((r) => r.id === btn.dataset.roomId);
        if(!room || room.is_group || !room.partner) return;
        const pid = room.partner.id;
        const name = feat.nick.priv[pid] || nickRoomName(room.id, pid);
        if(!name) return;
        const s = btn.querySelector("strong");
        if(s) s.textContent = name;
    });
    nickPaintTyping();
}

function nickPaintTyping(){
    const who = [];
    const t = feat.typing;
    if(t && t.who){ const now = Date.now(); t.who.forEach((e, uid) => { if(e.until > now) who.push({uid, name:e.name}); }); }
    const names = who.map((w) => profileDisplayName({id:w.uid, display_name:w.name}));
    const line = document.getElementById("typingLine");
    if(line) line.textContent = names.length ? names.slice(0, 3).join("、") + " さんが入力中…" : "";
    const h = document.getElementById("nkTyping"), sub = document.getElementById("chatSubtitle");
    if(h){ h.hidden = !names.length; h.textContent = names.length ? "✏️ 入力中…" : ""; }
    if(sub) sub.hidden = !!names.length;
    // 一覧の、いま開いているチャットの横にも出す
    document.querySelectorAll("#roomList .nk-ty").forEach((n) => n.remove());
    if(names.length && state.currentRoom){
        const btn = document.querySelector('#roomList [data-room-id="' + state.currentRoom.id + '"]');
        if(btn){ const s = document.createElement("span"); s.className = "nk-ty"; s.textContent = "✏️ 入力中…"; btn.appendChild(s); }
    }
}

// ---------- チャット内の名前（みんなに見える） ----------
function nickMembers(room){
    const ids = (room.memberIds && room.memberIds.length ? room.memberIds : [state.user.id, room.partnerId].filter(Boolean));
    return ids.map((id) => {
        const p = id === state.user.id ? state.profile : (feat.known.get(id) || (room.partner && room.partner.id === id ? room.partner : {id}));
        const real = (p && (p.display_name || p.displayName)) || "ユーザー";
        const can = !room.is_group || id === state.user.id || room.created_by === state.user.id;
        return {id, real, can, nick:nickRoomName(room.id, id), me:id === state.user.id};
    });
}

function openRoomNick(){
    const room = state.currentRoom;
    if(!room) return;
    const rows = nickMembers(room);
    openSheet(toolHead("🏷️ このチャットでの名前", "ここで変えた名前は、<b>このチャットの全員に表示されます</b>（相手にも分かります）。自分だけに見せたいときは、友だちのプロフィールから変えてください。") +
        rows.map((m) => '<div class="admin-card"><div class="meta">' + (m.me ? "あなた" : "メンバー") + '（本来の名前：' + escapeHtml(m.real) + '）</div>' +
            (m.can ? '<div class="row" style="flex-wrap:nowrap"><input type="text" id="nk_' + escapeHtml(m.id) + '" maxlength="20" value="' + escapeHtml(m.nick) + '" placeholder="（変更なし）" style="flex:1">' +
                '<button type="button" data-t="nick:save" data-id="' + escapeHtml(m.id) + '">保存</button></div>'
                : '<div class="meta">グループでは、他の人の名前は変えられません。</div>') + '</div>').join("") + toolClose());
}

async function onNickAction(action, node){
    if(action === "save"){
        const room = state.currentRoom; if(!room) return;
        const id = node.dataset.id, input = document.getElementById("nk_" + id);
        const name = String((input && input.value) || "").trim().slice(0, 20);
        const res = await requireClient().rpc("set_room_nickname", {p_room:room.id, p_user:id, p_name:name});
        if(res.error) throw res.error;
        if(name) feat.nick.room.set(room.id + ":" + id, name); else feat.nick.room.delete(room.id + ":" + id);
        showToast(name ? "名前を変えました（このチャットの全員に表示されます）。" : "名前を元に戻しました。");
        nickRefreshUi();
    }else if(action === "savepriv"){
        const id = node.dataset.id, input = document.getElementById("nkPriv");
        const name = String((input && input.value) || "").trim().slice(0, 20);
        if(name) feat.nick.priv[id] = name; else delete feat.nick.priv[id];
        if(!nickPrivSave()) return;
        showToast(name ? "あなたの画面だけで、この名前で表示します。" : "元の名前に戻しました。");
        nickRefreshUi();
        const p = feat.known.get(id) || (state.rooms || []).map((r) => r.partner).find((x) => x && x.id === id);
        if(p) openProfileView(p);
    }else if(action === "room"){ openRoomNick(); }
}

function nickProfileExtras(profile){
    if(!profile || !profile.id || profile.id === state.user.id) return;
    const real = profile.display_name || profile.displayName || "ユーザー";
    const box = document.createElement("div");
    box.className = "nk-box";
    box.innerHTML = '<label for="nkPriv">自分だけに表示する名前（相手には見えません）</label>' +
        '<div class="row" style="flex-wrap:nowrap"><input type="text" id="nkPriv" maxlength="20" placeholder="本来の名前：' + escapeHtml(real) + '" value="' + escapeHtml(feat.nick.priv[profile.id] || "") + '" style="flex:1">' +
        '<button type="button" data-t="nick:savepriv" data-id="' + escapeHtml(profile.id) + '">保存</button></div>' +
        '<div class="meta">この端末のブラウザにだけ保存します。空にして保存すると元に戻ります。</div>';
    const follow = document.getElementById("pmFollow");
    if(follow) follow.insertAdjacentElement("afterend", box); else el.profileSheet.appendChild(box);
}
