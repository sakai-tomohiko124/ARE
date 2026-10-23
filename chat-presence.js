"use strict";

function relativeAgo(ms){
    const minutes = Math.floor(ms / 60000);
    if(minutes < 1) return "1分未満前";
    if(minutes < 60) return minutes + "分前";
    const hours = Math.floor(minutes / 60);
    return hours < 24 ? hours + "時間前" : Math.floor(hours / 24) + "日前";
}

function presenceOf(profile){
    const seen = profile?.last_seen_at ? new Date(profile.last_seen_at).getTime() : 0;
    const age = Date.now() - seen;
    const status = profile?.presence_status;
    if(!seen || age > ONLINE_WINDOW_MS || !STATUS_LABELS[status]){
        return {cls:"offline",text:seen ? "オフライン（最終オンライン " + relativeAgo(age) + "）" : "オフライン"};
    }
    return {cls:status,text:STATUS_LABELS[status]};
}

function presenceHtml(profile){
    const p = presenceOf(profile);
    return '<span class="dot ' + p.cls + '"></span>' + escapeHtml(p.text);
}

function updateHeaderPresence(){
    if(state.currentRoom && !state.currentRoom.suspended_at){
        el.chatSubtitle.innerHTML = state.currentRoom.is_group
            ? 'メンバー ' + (state.currentRoom.memberIds || []).length + '人 ・ タップでグループ情報'
            : presenceHtml(state.currentPartner);
    }
}

async function sendPresence(){
    let status = feat.inCall ? "in_call" : feat.manual;
    if(status === "online" && Date.now() - feat.lastActivity > IDLE_MS) status = "away";
    try{
        const result = await requireClient().rpc("set_my_presence",{p_status:status});
        if(result.error) throw result.error;
    }catch(error){ console.warn("Presence update failed:",error); }
}

async function refreshPresence(){
    const ids = [...new Set([...state.rooms.map((room) => room.partnerId),...state.recommendations.map((p) => p.id)].filter(Boolean))].slice(0,150);
    if(!ids.length) return;
    const result = await requireClient().from(TABLES.profiles).select("id,presence_status,last_seen_at,status_message,avatar_url").in("id",ids);
    if(result.error) return;
    const map = new Map((result.data || []).map((p) => [p.id,p]));
    const apply = (p) => { const n = p && map.get(p.id); if(n){ p.presence_status = n.presence_status; p.last_seen_at = n.last_seen_at; p.status_message = n.status_message; p.avatar_url = n.avatar_url; } };
    state.rooms.forEach((room) => apply(room.partner));
    state.recommendations.forEach(apply);
    apply(state.currentPartner);
    renderRooms(); renderRecommendations(); updateHeaderPresence();
}

function onActivity(){
    const wasIdle = Date.now() - feat.lastActivity > IDLE_MS;
    feat.lastActivity = Date.now();
    if(wasIdle) sendPresence();
}

async function markRead(){
    if(!state.currentRoom || document.hidden) return;
    try{ await requireClient().rpc("mark_room_read",{p_room_id:state.currentRoom.id}); }catch(_e){}
}

async function loadPartnerRead(){
    if(!state.currentRoom) return;
    const roomId = state.currentRoom.id;
    const result = await requireClient().rpc("get_room_reads",{p_room_id:roomId});
    if(result.error || state.currentRoom?.id !== roomId) return;
    const times = (result.data || []).map((row) => new Date(row.last_read_at).getTime()).filter(Number.isFinite).sort();
    const key = times.join(",");
    if(key !== feat.readKey){ feat.readKey = key; feat.readTimes = times; if(feat.editingId === null) renderMessages(false); }
}

async function ensureMemberProfiles(room){
    const ids = (room.memberIds || []).filter((id) => id !== state.user.id && !feat.known.has(id));
    if(!ids.length) return;
    const result = await requireClient().from(TABLES.profiles).select("*").in("id",ids);
    (result.data || []).forEach((p) => feat.known.set(p.id,p));
}

async function loadPending(roomId){
    const result = await requireClient().from("message_delete_requests").select("message_id").eq("room_id",roomId).eq("requester_id",state.user.id).eq("status","pending");
    if(!result.error && state.currentRoom?.id === roomId) feat.pending = new Set((result.data || []).map((row) => row.message_id));
}

async function pollRoom(){
    if(!state.currentRoom || document.hidden) return;
    if(feat.editingId === null) await loadMessages(false,true);
    await Promise.all([loadPartnerRead(),loadScheduled()]);
    markRead();
}
