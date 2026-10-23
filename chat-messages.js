"use strict";

async function onMessageAction(event){
    const pollBtn = event.target.closest("[data-openpoll]");
    if(pollBtn){ openGroupInfo(pollBtn.dataset.openpoll); return; }
    const button = event.target.closest("[data-act]");
    if(!button) return;
    const id = button.dataset.id, act = button.dataset.act;
    const message = state.messages.find((m) => m.id === id);
    if(!message || message.sender_id !== state.user.id) return;

    if(act === "edit"){
        feat.editingId = id; renderMessages(false);
        const box = el.messages.querySelector("textarea.edit-box");
        if(box){ box.focus(); box.setSelectionRange(box.value.length,box.value.length); }
    }else if(act === "cancel-edit"){
        feat.editingId = null; renderMessages(false);
    }else if(act === "save-edit"){
        const box = el.messages.querySelector("textarea.edit-box");
        const text = box ? box.value : "";
        if(!text.trim()){ showToast("メッセージを入力してください。"); return; }
        if(Array.from(text).length > MAX_TEXT_LENGTH){ showToast("メッセージは2,000文字以内で入力してください。"); return; }
        button.disabled = true;
        try{
            const keep = Object.assign({},parseMessageContent(message.content),{type:"text",text});
            delete keep.stamp;
            const result = await requireClient().rpc("edit_message",{p_message_id:id,p_content:JSON.stringify(keep)});
            if(result.error) throw result.error;
            feat.editingId = null;
            await loadMessages(false,true);
            showToast("編集しました。");
        }catch(error){ button.disabled = false; setStatus(featError(error),"error"); }
    }else if(act === "del"){
        if(feat.pending.has(id)) return;
        const reason = window.prompt("このメッセージの削除を管理者に申請します。\n理由（任意・500文字以内）を入力してください。","");
        if(reason === null) return;
        try{
            const result = await requireClient().rpc("request_message_delete",{p_message_id:id,p_reason:reason.slice(0,500)});
            if(result.error) throw result.error;
            feat.pending.add(id); renderMessages(false);
            showToast("削除を申請しました。管理者が承認すると削除されます。");
        }catch(error){ setStatus(featError(error),"error"); }
    }
}

function localInput(date){
    const p = (n) => String(n).padStart(2,"0");
    return date.getFullYear() + "-" + p(date.getMonth() + 1) + "-" + p(date.getDate()) + "T" + p(date.getHours()) + ":" + p(date.getMinutes());
}

function toggleSchedule(){
    if(el.scheduleButton.disabled) return;
    el.schedulePanel.hidden = !el.schedulePanel.hidden;
    if(!el.schedulePanel.hidden){
        el.scheduleAt.min = localInput(new Date(Date.now() + 60000));
        if(!el.scheduleAt.value) el.scheduleAt.value = localInput(new Date(Date.now() + 10 * 60000));
        loadScheduled();
    }
}

async function scheduleSend(){
    if(!state.currentRoom) return;
    const text = el.messageInput.value;
    if(!text.trim()){ showToast("予約するメッセージを入力欄に入力してください。"); return; }
    if(Array.from(text).length > MAX_TEXT_LENGTH){ showToast("メッセージは2,000文字以内で入力してください。"); return; }
    const when = new Date(el.scheduleAt.value);
    if(isNaN(when.getTime()) || when.getTime() < Date.now() + 45000){ showToast("送信日時は1分以上先を指定してください。"); return; }
    el.scheduleSubmit.disabled = true;
    try{
        const result = await requireClient().rpc("schedule_message",{p_room_id:state.currentRoom.id,p_content:JSON.stringify({type:"text",text}),p_send_at:when.toISOString()});
        if(result.error) throw result.error;
        el.messageInput.value = ""; updateCharCount();
        showToast(formatDate(when.toISOString()) + " に送信を予約しました。");
        await loadScheduled();
    }catch(error){ setStatus(featError(error),"error"); }
    finally{ el.scheduleSubmit.disabled = false; }
}

async function loadScheduled(){
    if(!state.currentRoom) return;
    const roomId = state.currentRoom.id;
    const result = await requireClient().from("scheduled_messages").select("id,content,send_at").eq("room_id",roomId).eq("status","pending").order("send_at",{ascending:true});
    if(result.error || state.currentRoom?.id !== roomId) return;
    const rows = result.data || [];
    el.scheduleList.innerHTML = rows.length
        ? rows.map((row) => '<div class="sched-item"><span>' + escapeHtml(formatDate(row.send_at)) + '　' + escapeHtml(String(parseMessageContent(row.content).text || "").slice(0,40)) + '</span><button type="button" class="button-danger" data-cancel="' + escapeHtml(row.id) + '">取消</button></div>').join("")
        : '<div class="empty-list">予約中のメッセージはありません。</div>';
}

async function onScheduleListClick(event){
    const button = event.target.closest("[data-cancel]");
    if(!button) return;
    try{
        const result = await requireClient().rpc("cancel_scheduled_message",{p_id:button.dataset.cancel});
        if(result.error) throw result.error;
        await loadScheduled();
    }catch(error){ setStatus(featError(error),"error"); }
}
