"use strict";

const TABLES = Object.freeze({
    profiles: "profiles",
    rooms: "chat_rooms",
    members: "chat_room_members",
    messages: "messages"
});

const STORAGE_BUCKET = "chat-attachments";

const MAX_TEXT_LENGTH = 2000;

const MAX_IMAGES = 10;

const MAX_VIDEO_SECONDS = 300;

const MAX_FILE_BYTES = 50 * 1024 * 1024;

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const FILE_MIME_BY_EXT = {
    pdf:"application/pdf",
    docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",
    jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",gif:"image/gif",webp:"image/webp",heic:"image/heic",heif:"image/heif",
    mp4:"video/mp4",mov:"video/quicktime",webm:"video/webm"
};

function fileExt(file){ const m = /\.([A-Za-z0-9]+)$/.exec(file.name || ""); return m ? m[1].toLowerCase() : ""; }

function resolveMime(file){
    const byExt = FILE_MIME_BY_EXT[fileExt(file)];
    if(file.type && file.type !== "application/octet-stream") return file.type;
    return byExt || "application/octet-stream";
}

const state = {
    client: null,
    user: null,
    profile: null,
    rooms: [],
    recommendations: [],
    currentRoom: null,
    currentPartner: null,
    messages: [],
    subscription: null,
    loadingMessages: false,
    sending: false,
    loadingRooms: false,
    loadingUsers: false,
    searchText: "",
    authSubscription: null
};

const el = {};

const $ = (id) => document.getElementById(id);

function cacheElements(){
    [
        "app","logoutButton","myAvatar","myName","myLoginStatus",
        "refreshUsersButton","userSearch","recommendedUsers","refreshRoomsButton",
        "roomList","backButton","chatAvatar","chatTitle","chatSubtitle",
        "refreshMessagesButton","pageStatus","messages","imageInput","fileInput",
        "videoInput","attachmentStatus","messageInput","sendButton","charCount","toast","delCard","delStatus","delRequestButton","delCancelButton","newGroupButton","exportOldButton","exportAllButton","postFilter","toggleHiddenUsers","postBody","postImage","postImageName","postSubmit","postFeed","postMore","postsRefresh","profileText","profileEditButton","profileModal","profileSheet","sidebar","rail","readReceiptToggle","securityBanner","myStatus","scheduleButton","schedulePanel","scheduleAt","scheduleSubmit","scheduleList","scheduleClose","adminTabButton","adminBadge","adminPanel","adminBody","adminClose"
    ].forEach((id) => el[id] = $(id));
}

function safeHttpUrl(value){
    try{
        const u = new URL(String(value || ""), window.location.href);
        return u.protocol === "https:" ? u.href : "";
    }catch(_error){ return ""; }
}

function escapeHtml(value){
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    })[char]);
}

function shortName(value){
    const name = String(value || "A").trim();
    return Array.from(name)[0] || "A";
}

function formatDate(value){
    if(!value) return "";
    const date = new Date(value);
    if(Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ja-JP",{hour:"2-digit",minute:"2-digit"}).format(date);
}

function formatBytes(bytes){
    if(!Number.isFinite(bytes) || bytes < 0) return "";
    if(bytes < 1024) return bytes + " B";
    if(bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if(bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

function setStatus(message, type){
    el.pageStatus.textContent = message || "";
    el.pageStatus.className = "status" + (message ? " show " + (type || "info") : "");
}

function showToast(message){
    el.toast.textContent = message;
    el.toast.classList.add("show");
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => el.toast.classList.remove("show"), 3500);
}

function setBusy(button, busy, busyText){
    if(!button.dataset.originalText) button.dataset.originalText = button.textContent;
    button.disabled = busy;
    button.textContent = busy ? (busyText || "処理中...") : button.dataset.originalText;
}

function isMissingBackend(error){
    const code = String(error?.code || "");
    const text = String(error?.message || "") + " " + String(error?.details || "");
    return ["PGRST202","PGRST205","42883","42P01"].includes(code) ||
        /could not find the (function|table)|schema cache|function was not found|requested function was not found|relation .* does not exist|function .* does not exist/i.test(text);
}

function getErrorMessage(error){
    if(isMissingBackend(error)){
        return "この機能は未実装です（サーバー側の準備ができていません）。";
    }
    const message = error?.message || String(error || "不明なエラー");
    if(/row-level security|permission denied|not allowed|42501/i.test(message)){
        return "データベースのアクセス権限で拒否されました。SupabaseのRLSポリシーを確認してください。";
    }
    if(/relation .* does not exist|could not find the table/i.test(message)){
        return "必要なテーブルが見つかりません。テーブル名とSupabaseの構造を確認してください。";
    }
    if(/bucket not found|no such bucket/i.test(message)){
        return "添付ファイル用のStorageバケットがありません。chat-attachmentsを作成してください。";
    }
    if(/JWT|auth session missing|not authenticated/i.test(message)){
        return "ログイン状態を確認できません。再度ログインしてください。";
    }
    return message;
}

function requireClient(){
    if(!state.client) throw new Error("Supabaseクライアントが初期化されていません。");
    return state.client;
}

async function getProfile(userId){
    const client = requireClient();
    const result = await client.from(TABLES.profiles).select("*").eq("id",userId).maybeSingle();
    if(result.error) throw result.error;
    return result.data;
}

function profileDisplayName(profile){
    return profile?.display_name || profile?.displayName || profile?.username || profile?.login_id || "ユーザー";
}

function setAvatar(target, profile){
    const name = profileDisplayName(profile);
    const avatarUrl = profile?.avatar_url || profile?.avatarUrl || profile?.photo_url || "";
    if(avatarUrl){
        target.innerHTML = '<img src="' + escapeHtml(safeHttpUrl(avatarUrl)) + '" alt="">';
    }else{
        target.textContent = shortName(name);
    }
}

function setTab(tab){
    el.sidebar.dataset.tab = tab;
    if(tab === "posts" && typeof feat !== "undefined" && el.postFeed && Date.now() - feat.postsLoadedAt > 10000) loadPosts(true);
    el.rail.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("active",b.dataset.tab === tab));
}

function setChatEnabled(enabled){
    el.messageInput.disabled = !enabled;
    el.sendButton.disabled = !enabled;
    el.refreshMessagesButton.disabled = !enabled;
    el.scheduleButton.disabled = !enabled;
    document.querySelectorAll("[data-needs-room]").forEach((node) => { node.disabled = !enabled; });
    if(!enabled) el.schedulePanel.hidden = true;
    if(!enabled) el.messageInput.value = "";
    updateCharCount();
}

function updateCharCount(){
    const length = Array.from(el.messageInput.value).length;
    el.charCount.textContent = String(length);
    el.charCount.style.color = length > MAX_TEXT_LENGTH ? "var(--danger)" : "var(--muted)";
    el.messageInput.style.height = "auto";
    el.messageInput.style.height = Math.min(el.messageInput.scrollHeight,140) + "px";
    el.sendButton.disabled = !state.currentRoom || state.sending || length > MAX_TEXT_LENGTH;
}

async function initialize(){
    cacheElements();

    try{
        if(!window.ARESystem || !window.AREAuth){
            throw new Error("system.jsが読み込まれていません。");
        }

        state.client = window.ARESystem.client;

        const session = await window.AREAuth.getSession();
        if(!session?.user){
            window.location.replace("./index.html");
            return;
        }

        state.user = session.user;
        state.profile = await getProfile(state.user.id).catch(() => null);

        el.myName.textContent = profileDisplayName(state.profile);
        el.myLoginStatus.textContent = "ログイン中";
        setAvatar(el.myAvatar,state.profile);

        bindEvents();
        await Promise.all([loadRecommendations(),loadRooms()]);
        setStatus("チャットの準備ができました。ユーザーを選択してください。","success");
        startFeatures();

        state.authSubscription = window.AREAuth.onAuthStateChange((event, sessionValue) => {
            if(event === "SIGNED_OUT" || !sessionValue){
                window.location.replace("./index.html");
            }
        });
    }catch(error){
        console.error("ARE initialization error:",error);
        setStatus(getErrorMessage(error),"error");
        if(/ログイン|session|認証/i.test(error?.message || "")){
            window.setTimeout(() => window.location.replace("./index.html"),1200);
        }
    }
}

function bindEvents(){
    el.logoutButton.addEventListener("click",logout);
    el.refreshUsersButton.addEventListener("click",loadRecommendations);
    el.refreshRoomsButton.addEventListener("click",loadRooms);
    el.refreshMessagesButton.addEventListener("click",() => loadMessages(true));
    let searchTimer = null;
    el.userSearch.addEventListener("input",() => {
        state.searchText = el.userSearch.value.trim().toLocaleLowerCase();
        clearTimeout(searchTimer);
        searchTimer = setTimeout(loadRecommendations,250);
    });
    el.sendButton.addEventListener("click",sendTextMessage);
    el.messageInput.addEventListener("input",updateCharCount);
    el.messageInput.addEventListener("keydown",(event) => {
        if(event.key === "Enter" && !event.shiftKey && !event.isComposing){
            event.preventDefault();
            sendTextMessage();
        }
    });
    el.imageInput.addEventListener("change",() => handleFiles(el.imageInput.files,"image"));
    el.fileInput.addEventListener("change",() => handleFiles(el.fileInput.files,"file"));
    el.videoInput.addEventListener("change",() => handleFiles(el.videoInput.files,"video"));
    el.backButton.addEventListener("click",() => el.app.classList.remove("chat-open"));
    el.rail.addEventListener("click",(event) => {
        const tab = event.target.closest("[data-tab]");
        if(tab) setTab(tab.dataset.tab);
    });
    if(window.visualViewport){
        const mobile = window.matchMedia("(max-width:700px)");
        const fit = () => {
            el.app.style.height = mobile.matches ? window.visualViewport.height + "px" : "";
            if(mobile.matches) window.scrollTo(0,0);
        };
        window.visualViewport.addEventListener("resize",fit);
        window.visualViewport.addEventListener("scroll",fit);
        fit();
    }
    window.addEventListener("beforeunload",cleanupSubscription);
}

const escLike = (text) => text.replace(/[\\%_]/g,(ch) => "\\" + ch);

async function loadRecommendations(){
    if(state.loadingUsers) return;
    state.loadingUsers = true;
    try{
        const client = requireClient();
        const hiddenResult = await client.from("hidden_recommendations").select("hidden_user_id");
        if(!hiddenResult.error) state.hiddenIds = new Set((hiddenResult.data || []).map((row) => row.hidden_user_id));
        const text = el.userSearch.value.trim();
        let result = {data:[]};
        if(text){
            result = await client.from(TABLES.profiles).select("*").ilike("display_name","%" + escLike(text) + "%").neq("id",state.user.id).order("display_name",{ascending:true}).limit(30);
        }else if(state.showHidden && state.hiddenIds.size){
            result = await client.from(TABLES.profiles).select("*").in("id",[...state.hiddenIds]).limit(100);
        }
        if(result.error) throw result.error;
        state.recommendations = result.data || [];
        renderRecommendations();
    }catch(error){
        console.error("User search error:",error);
        el.recommendedUsers.innerHTML = '<div class="empty-list">ユーザーを検索できませんでした。<br>' + escapeHtml(getErrorMessage(error)) + '</div>';
    }finally{
        state.loadingUsers = false;
    }
}

function renderRecommendations(){
    const list = state.recommendations.filter((profile) => {
        return state.showHidden || !state.hiddenIds.has(profile.id);
    });
    el.toggleHiddenUsers.textContent = state.showHidden ? "非表示を隠す" : "非表示（" + state.hiddenIds.size + "）";

    if(!list.length){
        el.recommendedUsers.innerHTML = '<div class="empty-list">' + (el.userSearch.value.trim()
            ? '該当するユーザーが見つかりません。'
            : '上の検索バーに名前を入力すると、ユーザーが表示されます。') + '</div>';
        return;
    }

    el.recommendedUsers.innerHTML = list.map((profile) => {
        const name = profileDisplayName(profile);
        const avatar = safeHttpUrl(profile?.avatar_url || profile?.avatarUrl || profile?.photo_url || "");
        const hidden = state.hiddenIds.has(profile.id);
        const avatarHtml = avatar
            ? '<div class="avatar"><img src="' + escapeHtml(avatar) + '" alt=""></div>'
            : '<div class="avatar">' + escapeHtml(shortName(name)) + '</div>';

        return '<div class="person-wrap' + (hidden ? ' is-hidden' : '') + '"><button class="person" type="button" data-user-id="' + escapeHtml(profile.id) + '">' +
            avatarHtml +
            '<span class="person-text"><strong>' + escapeHtml(name) + '</strong><small>' + presenceHtml(profile) + '</small>' + statusLine(profile) + '</span>' +
            '<span class="add" aria-hidden="true">＋</span></button>' +
            '<button class="hide-btn" type="button" data-hide="' + escapeHtml(profile.id) + '" data-action="' + (hidden ? 'show' : 'hide') + '">' + (hidden ? '再表示' : '非表示') + '</button></div>';
    }).join("");

    el.recommendedUsers.querySelectorAll("[data-user-id]").forEach((button) => {
        button.addEventListener("click",() => openOrCreateDirectChat(button.dataset.userId));
    });
    el.recommendedUsers.querySelectorAll("[data-hide]").forEach((button) => {
        button.addEventListener("click",() => toggleHideUser(button.dataset.hide,button.dataset.action === "hide"));
    });
}

async function loadRooms(){
    if(state.loadingRooms) return;
    state.loadingRooms = true;
    el.roomList.innerHTML = '<div class="empty-list">チャットを読み込んでいます...</div>';

    try{
        const client = requireClient();
        const membershipResult = await client.from(TABLES.members).select("room_id").eq("user_id",state.user.id);
        if(membershipResult.error) throw membershipResult.error;

        const roomIds = [...new Set((membershipResult.data || []).map((row) => row.room_id).filter(Boolean))];
        if(!roomIds.length){
            state.rooms = [];
            renderRooms();
            return;
        }

        const roomsResult = await client.from(TABLES.rooms).select("*").in("id",roomIds).order("created_at",{ascending:false});
        if(roomsResult.error) throw roomsResult.error;

        const roomRows = roomsResult.data || [];
        const membersResult = await client.from(TABLES.members).select("room_id,user_id").in("room_id",roomIds);
        if(membersResult.error) throw membersResult.error;

        const otherIds = [...new Set((membersResult.data || []).map((row) => row.user_id).filter((id) => id && id !== state.user.id))];
        let profiles = [];

        if(otherIds.length){
            const profilesResult = await client.from(TABLES.profiles).select("*").in("id",otherIds);
            if(profilesResult.error) throw profilesResult.error;
            profiles = profilesResult.data || [];
        }

        profiles.forEach((p) => feat.known.set(p.id,p));
        state.rooms = roomRows.map((room) => {
            const memberIds = (membersResult.data || []).filter((row) => row.room_id === room.id).map((row) => row.user_id);
            const partnerId = room.is_group ? null : (memberIds.find((id) => id !== state.user.id) || null);
            const partner = room.is_group ? null : (profiles.find((profile) => profile.id === partnerId) || null);
            return {...room,partner,partnerId,memberIds};
        });

        renderRooms();
    }catch(error){
        console.error("Room list error:",error);
        el.roomList.innerHTML = '<div class="empty-list">チャット一覧を取得できませんでした。<br>' + escapeHtml(getErrorMessage(error)) + '</div>';
    }finally{
        state.loadingRooms = false;
    }
}

function renderRooms(){
    if(!state.rooms.length){
        el.roomList.innerHTML = '<div class="empty-list">まだチャットがありません。<br>おすすめユーザーから相手を選ぶか、グループを作成してください。</div>';
        return;
    }

    el.roomList.innerHTML = state.rooms.map((room) => {
        const group = Boolean(room.is_group);
        const name = group ? (room.name || "グループ") : profileDisplayName(room.partner);
        const avatar = group ? "" : safeHttpUrl(room.partner?.avatar_url || room.partner?.avatarUrl || "");
        const avatarHtml = group
            ? '<div class="avatar">👥</div>'
            : (avatar ? '<div class="avatar"><img src="' + escapeHtml(avatar) + '" alt=""></div>' : '<div class="avatar">' + escapeHtml(shortName(name)) + '</div>');
        const active = state.currentRoom?.id === room.id ? " active" : "";
        const sub = group ? 'グループ ・ メンバー ' + (room.memberIds || []).length + '人' : presenceHtml(room.partner);

        return '<button class="room-item' + active + '" type="button" data-room-id="' + escapeHtml(room.id) + '">' +
            avatarHtml + '<span class="person-text"><strong>' + escapeHtml(name) + '</strong><small>' + sub + '</small>' + (group ? '' : statusLine(room.partner)) + '</span></button>';
    }).join("");

    el.roomList.querySelectorAll("[data-room-id]").forEach((button) => {
        button.addEventListener("click",() => {
            const room = state.rooms.find((item) => item.id === button.dataset.roomId);
            if(room) selectRoom(room,room.partner);
        });
    });
}

async function openOrCreateDirectChat(partnerId){
    if(!partnerId || partnerId === state.user.id) return;

    try{
        setStatus("チャットを開いています...","info");
        const client = requireClient();
        const partner = state.recommendations.find((profile) => profile.id === partnerId) || await getProfile(partnerId);
        if(!partner) throw new Error("相手のプロフィールが見つかりません。");

        const rpcResult = await client.rpc("create_or_get_direct_room",{p_partner_id:partnerId});
        if(rpcResult.error) throw rpcResult.error;

        const roomResult = await client.from(TABLES.rooms).select("*").eq("id",rpcResult.data).maybeSingle();
        if(roomResult.error) throw roomResult.error;
        if(!roomResult.data) throw new Error("ルームを取得できませんでした。");

        await loadRooms();
        const room = state.rooms.find((item) => item.id === roomResult.data.id) || {...roomResult.data,partner,partnerId};
        await selectRoom(room,partner);
    }catch(error){
        console.error("Open direct chat error:",error);
        setStatus(getErrorMessage(error),"error");
    }
}

async function selectRoom(room,partner){
    if(!room?.id) return;
    cleanupSubscription();
    setTab("chats");

    state.currentRoom = room;
    state.currentPartner = partner || room.partner || null;
    state.messages = [];
    if(typeof runRoomHooks === "function") runRoomHooks();
    feat.partnerReadAt = null; feat.readTimes = []; feat.readKey = ""; feat.pending = new Set(); feat.editingId = null; el.schedulePanel.hidden = true;

    const name = room.is_group ? (room.name || "グループ") : profileDisplayName(state.currentPartner);
    el.chatTitle.textContent = name;
    if(room.suspended_at){ el.chatSubtitle.textContent = "このチャットは停止中です"; }else{ updateHeaderPresence(); }
    if(room.is_group){ el.chatAvatar.textContent = "👥"; }else{ setAvatar(el.chatAvatar,state.currentPartner); }
    document.getElementById("callAudioBtn").hidden = Boolean(room.is_group);
    document.getElementById("callVideoBtn").hidden = Boolean(room.is_group);
    await ensureMemberProfiles(room);
    el.app.classList.add("chat-open");

    const suspended = Boolean(room.suspended_at);
    setChatEnabled(!suspended);
    if(suspended){
        setStatus("このチャットルームは停止されているため、送信できません。","error");
    }else{
        setStatus("メッセージを読み込んでいます...","info");
    }

    renderRooms();
    subscribeToMessages();
    await loadMessages(false);
    markRead(); loadPartnerRead();
    setStatus(suspended ? "このチャットルームは停止中です。" : "チャットに接続しました。",suspended ? "error" : "success");
    el.messageInput.focus();
}

async function loadMessages(showFeedback,quiet){
    if(!state.currentRoom || state.loadingMessages) return;
    state.loadingMessages = true;
    const requestedRoomId = state.currentRoom.id;

    try{
        const result = await requireClient()
            .from(TABLES.messages)
            .select("id,room_id,sender_id,content,created_at,edited_at,expires_at")
            .eq("room_id",state.currentRoom.id)
            .order("created_at",{ascending:false})
            .limit(500);

        if(result.error) throw result.error;
        if(!state.currentRoom || state.currentRoom.id !== requestedRoomId) return;
        const loaded = (result.data || []).slice().reverse();
        const loadedIds = new Set(loaded.map((m) => m.id));
        const newest = loaded.length ? new Date(loaded[loaded.length - 1].created_at).getTime() : 0;
        const arrived = state.messages.filter((m) => !loadedIds.has(m.id) && new Date(m.created_at).getTime() > newest);
        state.messages = loaded.concat(arrived);
        await loadPending(requestedRoomId);
        if(!state.currentRoom || state.currentRoom.id !== requestedRoomId) return;
        renderMessages(!quiet);
        if(showFeedback) showToast("メッセージを更新しました。");
    }catch(error){
        console.error("Message loading error:",error);
        setStatus(getErrorMessage(error),"error");
    }finally{
        state.loadingMessages = false;
    }
}

function subscribeToMessages(){
    if(!state.currentRoom) return;

    const roomId = state.currentRoom.id;
    state.subscription = requireClient()
        .channel("are-messages-" + roomId)
        .on("postgres_changes",{
            event:"INSERT",
            schema:"public",
            table:TABLES.messages,
            filter:"room_id=eq." + roomId
        },(payload) => {
            if(!payload.new) return;
            const exists = state.messages.some((message) => message.id === payload.new.id);
            if(!exists){
                state.messages.push(payload.new);
                state.messages.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
                renderMessages(true);
                markRead();
            }
        })
        .on("postgres_changes",{event:"UPDATE",schema:"public",table:TABLES.messages,filter:"room_id=eq." + roomId},(payload) => {
            if(!payload.new || feat.editingId !== null) return;
            const index = state.messages.findIndex((message) => message.id === payload.new.id);
            if(index >= 0 && !payload.new.deleted_at){ state.messages[index] = {...state.messages[index],...payload.new}; renderMessages(false); }
        })
        .subscribe((status) => {
            if(status === "CHANNEL_ERROR" || status === "TIMED_OUT"){
                console.warn("Realtime subscription status:",status);
            }
        });
}

function cleanupSubscription(){
    if(state.subscription && state.client){
        state.client.removeChannel(state.subscription);
        state.subscription = null;
    }
}

function parseMessageContent(content){
    if(typeof content !== "string") return {type:"text",text:String(content ?? "")};
    try{
        const parsed = JSON.parse(content);
        if(parsed && typeof parsed === "object" && ["text","image","file","video","audio","poll","location","game","board","contact","live"].includes(parsed.type)){
            return parsed;
        }
    }catch(_error){}
    return {type:"text",text:content};
}

function renderMessageContent(content){
    const item = parseMessageContent(content);

    if(item.type === "text"){
        const escaped = escapeHtml(item.text || "");
        const html = (window.AREText && typeof window.AREText.format === "function") ? window.AREText.format(escaped,item) : escaped;
        return '<div class="bubble' + (item.stamp ? ' stamp' : '') + '">' + html + '</div>';
    }
    if(item.type === "poll"){
        return '<div class="bubble">📊 <b>アンケート</b><br>' + escapeHtml(item.question || "") + '<br><button type="button" class="button-secondary" data-openpoll="' + escapeHtml(item.pollId || "") + '">回答・結果を見る</button></div>';
    }

    if(item.type === "game"){
        return typeof renderGameBubble === "function" ? renderGameBubble(item) : '<div class="bubble">🎮 対戦</div>';
    }
    if(item.type === "board" || item.type === "contact" || item.type === "live"){
        return typeof renderExtraBubble === "function" ? renderExtraBubble(item) : '<div class="bubble">（この版では表示できません）</div>';
    }
    if(item.type === "location"){
        return typeof renderLocationBubble === "function" ? renderLocationBubble(item) : '<div class="bubble">📍 位置情報</div>';
    }

    const url = item.url || "";
    const name = item.name || "添付ファイル";
    const dataPath = item.path ? ' data-path="' + escapeHtml(String(item.path)) + '"' : "";
    const safeUrl = escapeHtml(safeHttpUrl(url));
    if(!safeUrl){
        return '<div class="bubble">' + escapeHtml(name) + '（添付ファイルのURLが不正なため表示できません）</div>';
    }
    const safeName = escapeHtml(name);
    const size = item.size ? '<div class="file-meta">' + escapeHtml(formatBytes(Number(item.size))) + '</div>' : "";

    if(item.type === "audio"){
        return '<div class="bubble"><div class="attachment">🎤 ボイスメッセージ<audio controls preload="metadata"' + dataPath + ' src="' + safeUrl + '"></audio>' + size + '</div></div>';
    }

    if(item.type === "image"){
        return '<div class="bubble' + (item.stamp ? ' stamp-img' : '') + '"><div class="attachment"><a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer"><img' + dataPath + ' src="' + safeUrl + '" alt="' + safeName + '" loading="lazy"></a><div class="file-meta">' + safeName + '</div></div></div>';
    }

    if(item.type === "video"){
        return '<div class="bubble"><div class="attachment"><video controls preload="metadata"' + dataPath + ' src="' + safeUrl + '"></video><a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer">' + safeName + '</a>' + size + '</div></div>';
    }

    return '<div class="bubble"><div class="attachment"><a class="file-card" href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" download="' + safeName + '"><span class="file-icon">📄</span><span><span class="file-name">' + safeName + '</span>' + size + '</span></a></div></div>';
}

function renderMessages(scrollToBottom){
    const nowMs = Date.now();
    state.messages = state.messages.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > nowMs);
    if(!state.messages.length){
        el.messages.innerHTML = '<div class="welcome"><div class="welcome-icon">✉️</div><h2>最初のメッセージを送ろう</h2><div>メッセージやファイルを送信すると、ここに表示されます。</div></div>';
        return;
    }

    const prevTop = el.messages.scrollTop;
    const stick = scrollToBottom || (el.messages.scrollHeight - prevTop - el.messages.clientHeight < 80);
    const readAt = feat.partnerReadAt ? new Date(feat.partnerReadAt).getTime() : 0;

    el.messages.innerHTML = state.messages.map((message) => {
        const own = message.sender_id === state.user.id;
        const profile = own ? state.profile : (feat.known.get(message.sender_id) || state.currentPartner);
        const name = own ? "あなた" : profileDisplayName(profile);
        const avatarUrl = profile?.avatar_url || profile?.avatarUrl || "";
        const avatar = avatarUrl
            ? '<div class="message-avatar"><img src="' + escapeHtml(safeHttpUrl(avatarUrl)) + '" alt=""></div>'
            : '<div class="message-avatar">' + escapeHtml(shortName(name)) + '</div>';
        const id = escapeHtml(message.id);
        const item = parseMessageContent(message.content);
        const editing = own && feat.editingId === message.id;

        const body = editing
            ? '<div class="bubble edit"><textarea class="edit-box" maxlength="2000">' + escapeHtml(item.text || "") + '</textarea><div class="edit-actions"><button type="button" class="button-secondary" data-act="cancel-edit" data-id="' + id + '">キャンセル</button><button type="button" class="button" data-act="save-edit" data-id="' + id + '">保存</button></div></div>'
            : renderMessageContent(message.content);

        let meta = escapeHtml(formatDate(message.created_at));
        if(message.edited_at) meta += " ・編集済み";
        if(own){
            const created = new Date(message.created_at).getTime();
            const readers = feat.readTimes.filter((t) => t >= created).length;
            meta += readers > 0 ? (state.currentRoom?.is_group ? " ・既読 " + readers : " ・既読") : " ・送信済み";
        }

        let actions = "";
        if(own && !editing){
            actions = '<div class="message-actions">' +
                (item.type === "text" ? '<button type="button" data-act="edit" data-id="' + id + '">編集</button>' : '') +
                (feat.pending.has(message.id) ? '<span class="pending">削除申請中（管理者の承認待ち）</span>' : '<button type="button" data-act="del" data-id="' + id + '">削除申請</button>') +
                '</div>';
        }

        return '<article class="message-row' + (own ? ' own' : '') + '" data-mid="' + id + '">' +
            avatar +
            '<div class="message-body"><div class="message-sender">' + escapeHtml(name) + '</div>' +
            body + '<div class="message-time">' + meta + '</div>' + actions + '</div></article>';
    }).join("");

    if(typeof afterRenderMessages === "function") afterRenderMessages();
    el.messages.scrollTop = stick ? el.messages.scrollHeight : prevTop;
}

async function sendTextMessage(){
    if(!state.currentRoom || state.sending) return;

    const text = el.messageInput.value;
    if(!text.trim()){
        showToast("メッセージを入力してください。");
        return;
    }

    if(Array.from(text).length > MAX_TEXT_LENGTH){
        showToast("メッセージは2,000文字以内で入力してください。");
        return;
    }

    await sendMessagePayload(buildTextPayload(text));
}

async function sendMessagePayload(payload,options){
    if(!state.currentRoom || state.sending) return;

    state.sending = true;
    el.sendButton.disabled = true;

    try{
        const client = requireClient();
        const content = JSON.stringify(payload);
        const result = await sendRpcContent(state.currentRoom.id,content);

        if(result.error) throw result.error;

        if(payload.type === "text" && !(options && options.keepInput)){
            el.messageInput.value = "";
            updateCharCount();
        }
        if(typeof afterPayloadSent === "function") afterPayloadSent(payload);

        await loadMessages(false);
    }catch(error){
        console.error("Send message error:",error);
        setStatus(typeof featError === "function" ? featError(error) : getErrorMessage(error),"error");
    }finally{
        state.sending = false;
        updateCharCount();
    }
}

async function handleFiles(fileList,kind){
    const files = Array.from(fileList || []);
    if(!files.length) return;

    if(!state.currentRoom){
        showToast("先にチャット相手を選択してください。");
        clearFileInputs();
        return;
    }

    if(kind === "image" && files.length > MAX_IMAGES){
        showToast("画像は一度に最大10枚まで選択できます。");
        clearFileInputs();
        return;
    }

    if(kind === "video" && files.length > 1){
        showToast("動画は一度に1本ずつ送信してください。");
        clearFileInputs();
        return;
    }

    if(kind === "image" && files.some((file) => !file.type.startsWith("image/"))){
        showToast("画像ファイルを選択してください。");
        clearFileInputs();
        return;
    }

    if(kind === "video" && files.some((file) => !file.type.startsWith("video/"))){
        showToast("動画ファイルを選択してください。");
        clearFileInputs();
        return;
    }

    if(kind === "file"){
        const rejected = files.filter((file) => !FILE_MIME_BY_EXT[fileExt(file)]);
        if(rejected.length){
            showToast("対応形式は PDF・Word(.docx)・Excel(.xlsx)・PowerPoint(.pptx) です：" + rejected.map((f) => f.name).join("、"));
            clearFileInputs();
            return;
        }
    }

    if(kind === "image" && files.some((file) => file.type === "image/svg+xml")){
        showToast("SVG画像は安全上の理由で送信できません。");
        clearFileInputs();
        return;
    }

    for(const file of files){
        if(kind === "video"){
            if(file.size > MAX_VIDEO_BYTES){
                showToast("動画は1本50MB以下にしてください。");
                continue;
            }

            try{
                const duration = await getVideoDuration(file);
                if(duration > MAX_VIDEO_SECONDS){
                    showToast(file.name + " は5分を超えているため送信できません。");
                    continue;
                }
            }catch(error){
                showToast(file.name + " の動画時間を確認できませんでした。");
                continue;
            }
        }else if(file.size > MAX_FILE_BYTES){
            showToast(file.name + " は50MBを超えているため送信できません。");
            continue;
        }

        await uploadAndSend(file,kind);
    }

    clearFileInputs();
}

function clearFileInputs(){
    el.imageInput.value = "";
    el.fileInput.value = "";
    el.videoInput.value = "";
    el.attachmentStatus.textContent = "";
}

function getVideoDuration(file){
    return new Promise((resolve,reject) => {
        const video = document.createElement("video");
        const objectUrl = URL.createObjectURL(file);
        video.preload = "metadata";
        video.onloadedmetadata = () => {
            const duration = video.duration;
            URL.revokeObjectURL(objectUrl);
            resolve(duration);
        };
        video.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("動画メタデータを読み込めません。"));
        };
        video.src = objectUrl;
    });
}

async function uploadAndSend(file,kind){
    el.attachmentStatus.textContent = file.name + " をアップロード中...";
    el.app.classList.add("loading");

    try{
        const client = requireClient();
        // Storageのキーは英数字のみ（日本語などを含むと "Invalid key" になる）。表示名はメッセージ側に保持する。
        const ext = fileExt(file);
        const objectPath = state.currentRoom.id + "/" + state.user.id + "/" + crypto.randomUUID() + (ext ? "." + ext : "");

        const uploadResult = await client.storage.from(STORAGE_BUCKET).upload(objectPath,file,{
            cacheControl:"3600",
            contentType:resolveMime(file),
            upsert:false
        });

        if(uploadResult.error) throw uploadResult.error;

        const signedResult = await client.storage.from(STORAGE_BUCKET).createSignedUrl(objectPath,60 * 60 * 24 * 7);
        if(signedResult.error) throw signedResult.error;

        let payload = {
            type:kind,
            name:String(file.name || "attachment").slice(0,120),
            url:signedResult.data.signedUrl,
            path:objectPath,
            mimeType:resolveMime(file),
            size:file.size
        };
        if(feat.pendingStamp && kind === "image") payload.stamp = true;
        if(feat.pendingGame && kind === "image") payload = Object.assign({}, feat.pendingGame, {type:"game", name:payload.name, url:payload.url, path:payload.path, size:payload.size});

        await sendMessagePayload(payload);
    }catch(error){
        console.error("Attachment upload error:",error);
        setStatus(getErrorMessage(error),"error");
    }finally{
        el.app.classList.remove("loading");
        el.attachmentStatus.textContent = "";
    }
}

async function logout(){
    if(!confirm("ログアウトしますか？")) return;

    setBusy(el.logoutButton,true,"ログアウト中...");
    try{
        feat.timers.forEach(clearInterval);
        try{ await requireClient().rpc("set_my_presence",{p_status:"offline"}); }catch(_e){}
        cleanupSubscription();
        if(state.authSubscription){
            state.authSubscription.unsubscribe();
            state.authSubscription = null;
        }
        await window.AREAuth.logout();
        window.location.replace("./index.html");
    }catch(error){
        console.error("Logout error:",error);
        setStatus(getErrorMessage(error),"error");
        setBusy(el.logoutButton,false);
    }
}

// ===== 追加機能：在席状況 / 既読 / 編集・削除申請 / 予約送信 / 管理者パネル =====
