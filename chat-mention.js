"use strict";
// ===== メンション（@名前）=====

window.AREText = window.AREText || {format:null};
feat.mention = {sig:"",regex:null,seen:new Set(),openedAt:0};

function mentionNames(){
    const names = new Set();
    const add = (profile) => { const n = profile && profileDisplayName(profile); if(n && n !== "ユーザー") names.add(n); };
    add(state.profile);
    add(state.currentPartner);
    feat.known.forEach((profile) => add(profile));
    return Array.from(names).sort((a,b) => b.length - a.length);
}

function mentionRegex(){
    const names = mentionNames();
    const sig = names.join("\u0000");
    if(sig !== feat.mention.sig){
        feat.mention.sig = sig;
        feat.mention.regex = names.length ? new RegExp("@(" + names.map((n) => escapeRegExp(escapeHtml(n))).join("|") + ")","g") : null;
    }
    return feat.mention.regex;
}

function mentionsMe(text){
    const me = profileDisplayName(state.profile);
    return Boolean(me) && String(text || "").includes("@" + me);
}

function initMention(){
    window.AREText.format = (escaped) => {
        const regex = mentionRegex();
        if(!regex) return escaped;
        const me = escapeHtml(profileDisplayName(state.profile));
        return escaped.replace(regex,(match,name) => '<span class="mention' + (name === me ? ' me' : '') + '">@' + name + '</span>');
    };
    const box = document.createElement("div");
    box.id = "mentionBox";
    box.className = "mention-box";
    box.hidden = true;
    document.querySelector(".composer .composer-bottom").insertAdjacentElement("beforebegin",box);
    box.addEventListener("click",onMentionPick);
    el.messageInput.addEventListener("input",suggestMention);
    addRoomHook(() => { feat.mention.seen = new Set(); feat.mention.openedAt = Date.now() - 5000; box.hidden = true; });
    addRenderHook(notifyMentions);
}

function suggestMention(){
    const box = document.getElementById("mentionBox");
    const before = el.messageInput.value.slice(0,el.messageInput.selectionStart ?? el.messageInput.value.length);
    const m = /@([^\s@]{0,30})$/.exec(before);
    if(!m || !state.currentRoom){ box.hidden = true; return; }
    const ids = state.currentRoom.is_group ? (state.currentRoom.memberIds || []) : [];
    const candidates = new Set();
    ids.forEach((id) => { if(id !== state.user.id && feat.known.get(id)) candidates.add(profileDisplayName(feat.known.get(id))); });
    if(!state.currentRoom.is_group && state.currentPartner) candidates.add(profileDisplayName(state.currentPartner));
    const list = Array.from(candidates).filter((name) => name.startsWith(m[1])).slice(0,6);
    if(!list.length){ box.hidden = true; return; }
    box.innerHTML = list.map((name) => '<button type="button" class="button-secondary" data-mention="' + escapeHtml(name) + '">@' + escapeHtml(name) + '</button>').join("");
    box.hidden = false;
}

function onMentionPick(event){
    const pick = event.target.closest("[data-mention]");
    if(!pick) return;
    const input = el.messageInput;
    const pos = input.selectionStart ?? input.value.length;
    const before = input.value.slice(0,pos).replace(/@[^\s@]{0,30}$/,"@" + pick.dataset.mention + " ");
    input.value = before + input.value.slice(pos);
    input.setSelectionRange(before.length,before.length);
    document.getElementById("mentionBox").hidden = true;
    updateCharCount();
    input.focus();
}

function notifyMentions(){
    state.messages.forEach((message) => {
        if(feat.mention.seen.has(message.id)) return;
        feat.mention.seen.add(message.id);
        if(message.sender_id === state.user.id) return;
        if(new Date(message.created_at).getTime() < feat.mention.openedAt) return;
        const item = parseMessageContent(message.content);
        if(item.type === "text" && mentionsMe(item.text) && feat.blocks?.get(message.sender_id) !== "mute"){
            showToast(senderName(message) + " さんがあなたをメンションしました。");
        }
    });
}
