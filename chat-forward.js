"use strict";
// ===== メッセージの転送 =====

function initForward(){
    if(!window.AREFeatures.ok("msgmenu")) throw new Error("メッセージ操作メニューが起動していません。");
    addMsgTool({id:"forward",icon:"↪",label:"転送",when:(message,item) => item.type !== "poll",run:(message,item) => openForward(message,item)});
    el.profileModal.addEventListener("click",onForwardClick);
}

function openForward(message,item){
    feat.forwardItem = item;
    const rooms = state.rooms.filter((room) => !room.suspended_at);
    if(!rooms.length){ showToast("転送できるチャットがありません。"); return; }
    openSheet('<h3 style="margin:0">転送先を選んでください</h3><div class="meta">' + escapeHtml(messageSummary(item).slice(0,80)) + '</div>' +
        '<div class="pick">' + rooms.map((room) => '<button type="button" class="button-secondary" data-fw-room="' + escapeHtml(room.id) + '">' + escapeHtml(roomTitle(room)) + '</button>').join("") + '</div>' +
        '<div class="row"><button type="button" class="button-secondary" data-pm="close">やめる</button></div>');
}

async function onForwardClick(event){
    const button = event.target.closest("[data-fw-room]");
    if(!button || !feat.forwardItem) return;
    const payload = Object.assign({},feat.forwardItem,{forwarded:true});
    delete payload.replyTo;
    button.disabled = true;
    try{
        const result = await requireClient().rpc("send_message",{p_room_id:button.dataset.fwRoom,p_content:JSON.stringify(payload)});
        if(result.error) throw result.error;
        feat.forwardItem = null;
        closeSheet();
        showToast("転送しました。");
        if(state.currentRoom && state.currentRoom.id === button.dataset.fwRoom) await loadMessages(false,true);
    }catch(error){ button.disabled = false; showToast(featError(error)); }
}
