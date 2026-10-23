"use strict";
// ===== 絵文字リアクション =====

const REACTION_EMOJIS = ["👍","❤️","😂","😮","😢","🙏","🎉","👀"];

feat.reactions = new Map();
feat.reactPicker = null;
feat.reactRoom = null;

function initReact(){
    if(!window.AREFeatures.ok("msgmenu")) throw new Error("メッセージ操作メニューが起動していません。");
    addMsgTool({id:"react",icon:"😀",label:"リアクション",run:(message) => {
        feat.reactPicker = feat.reactPicker === message.id ? null : message.id;
        paintReactions();
    }});
    addRenderHook(paintReactions);
    addRoomHook((room) => {
        feat.reactions = new Map(); feat.reactPicker = null;
        feat.reactRoom = room ? room.id : null;
        if(room) loadReactions(room.id);
    });
    el.messages.addEventListener("click",onReactClick);
    const client = requireClient();
    let timer = null;
    client.channel("are-reactions").on("postgres_changes",{event:"*",schema:"public",table:"message_reactions"},() => {
        clearTimeout(timer);
        timer = setTimeout(() => { if(feat.reactRoom) loadReactions(feat.reactRoom); },300);
    }).subscribe();
    feat.timers.push(setInterval(() => { if(feat.reactRoom && !document.hidden) loadReactions(feat.reactRoom); },15000));
}

async function loadReactions(roomId){
    const result = await requireClient().from("message_reactions").select("message_id,user_id,emoji").eq("room_id",roomId).limit(5000);
    if(result.error || feat.reactRoom !== roomId) return;
    const map = new Map();
    (result.data || []).forEach((row) => {
        if(!map.has(row.message_id)) map.set(row.message_id,new Map());
        const inner = map.get(row.message_id);
        const entry = inner.get(row.emoji) || {n:0,mine:false};
        entry.n += 1;
        if(row.user_id === state.user.id) entry.mine = true;
        inner.set(row.emoji,entry);
    });
    feat.reactions = map;
    paintReactions();
}

function paintReactions(){
    el.messages.querySelectorAll(".reactions[data-rx]").forEach((holder) => {
        const id = holder.dataset.rx;
        const inner = feat.reactions.get(id);
        const parts = [];
        if(inner){
            inner.forEach((entry,emoji) => {
                parts.push('<button type="button" class="rx-chip' + (entry.mine ? ' mine' : '') + '" data-rx-emoji="' + escapeHtml(emoji) + '" data-mid="' + escapeHtml(id) + '">' + escapeHtml(emoji) + ' ' + entry.n + '</button>');
            });
        }
        if(feat.reactPicker === id){
            parts.push('<span class="rx-picker">' + REACTION_EMOJIS.map((emoji) => '<button type="button" class="rx-pick" data-rx-emoji="' + escapeHtml(emoji) + '" data-mid="' + escapeHtml(id) + '">' + escapeHtml(emoji) + '</button>').join("") + '</span>');
        }
        holder.innerHTML = parts.join("");
    });
}

async function onReactClick(event){
    const button = event.target.closest("[data-rx-emoji]");
    if(!button) return;
    button.disabled = true;
    try{
        const result = await requireClient().rpc("toggle_reaction",{p_message_id:button.dataset.mid,p_emoji:button.dataset.rxEmoji});
        if(result.error) throw result.error;
        feat.reactPicker = null;
        if(feat.reactRoom) await loadReactions(feat.reactRoom);
    }catch(error){ button.disabled = false; showToast(featError(error)); }
}
