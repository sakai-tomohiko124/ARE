"use strict";
// ===== 重要メッセージの固定 =====

feat.pins = [];
feat.pinRoom = null;

function initPin(){
    if(!window.AREFeatures.ok("msgmenu")) throw new Error("メッセージ操作メニューが起動していません。");
    addMsgTool({
        id:"pin",
        icon:(message) => isPinned(message.id) ? "📍" : "📌",
        label:(message) => isPinned(message.id) ? "固定を解除" : "チャット上部に固定",
        run:async (message) => { await setPinned(message.id,!isPinned(message.id)); }
    });
    addRenderHook(markPinned);
    addRoomHook((room) => {
        feat.pins = []; feat.pinRoom = room ? room.id : null; renderPinBar();
        if(room) loadPins(room.id);
    });
    document.getElementById("pinBar").addEventListener("click",openPinList);
    el.profileModal.addEventListener("click",onPinSheetClick);
    const client = requireClient();
    let timer = null;
    client.channel("are-pins").on("postgres_changes",{event:"*",schema:"public",table:"pinned_messages"},() => {
        clearTimeout(timer);
        timer = setTimeout(() => { if(feat.pinRoom) loadPins(feat.pinRoom); },300);
    }).subscribe();
    feat.timers.push(setInterval(() => { if(feat.pinRoom && !document.hidden) loadPins(feat.pinRoom); },20000));
}

function isPinned(id){ return feat.pins.some((pin) => pin.id === id); }

async function loadPins(roomId){
    const client = requireClient();
    const result = await client.from("pinned_messages").select("message_id,pinned_at").eq("room_id",roomId).order("pinned_at",{ascending:false});
    if(result.error || feat.pinRoom !== roomId) return;
    const rows = result.data || [];
    let messages = [];
    if(rows.length){
        const found = await client.from(TABLES.messages).select("id,sender_id,content,created_at").in("id",rows.map((row) => row.message_id));
        if(feat.pinRoom !== roomId) return;
        messages = found.data || [];
    }
    feat.pins = rows.map((row) => {
        const message = messages.find((m) => m.id === row.message_id);
        return message ? {id:row.message_id,sender_id:message.sender_id,text:messageSummary(parseMessageContent(message.content))} : null;
    }).filter(Boolean);
    renderPinBar();
    markPinned();
}

function renderPinBar(){
    const bar = document.getElementById("pinBar");
    if(!bar) return;
    if(!feat.pins.length){ bar.hidden = true; bar.textContent = ""; return; }
    const first = feat.pins[0];
    bar.textContent = "📌 " + first.text.slice(0,60) + (feat.pins.length > 1 ? "　（ほか " + (feat.pins.length - 1) + " 件）" : "");
    bar.hidden = false;
}

function markPinned(){
    el.messages.querySelectorAll("article[data-mid]").forEach((row) => {
        const pinned = isPinned(row.dataset.mid);
        row.classList.toggle("is-pinned",pinned);
    });
}

async function setPinned(id,wanted){
    try{
        const result = await requireClient().rpc("set_pin",{p_message_id:id,p_pin:wanted});
        if(result.error) throw result.error;
        showToast(wanted ? "チャット上部に固定しました。" : "固定を解除しました。");
        if(feat.pinRoom) await loadPins(feat.pinRoom);
        renderMessages(false);
    }catch(error){ showToast(featError(error)); }
}

function openPinList(){
    if(!feat.pins.length) return;
    openSheet('<h3 style="margin:0">📌 固定されたメッセージ</h3>' +
        feat.pins.map((pin) => '<div class="admin-card"><div>' + escapeHtml(pin.text.slice(0,120)) + '</div><div class="row"><button type="button" class="button-secondary" data-pin-jump="' + escapeHtml(pin.id) + '">表示</button><button type="button" class="button-secondary" data-pin-off="' + escapeHtml(pin.id) + '">解除</button></div></div>').join("") +
        '<div class="row"><button type="button" class="button-secondary" data-pm="close">閉じる</button></div>');
}

async function onPinSheetClick(event){
    const jump = event.target.closest("[data-pin-jump]");
    if(jump){ closeSheet(); jumpToMessage(jump.dataset.pinJump); return; }
    const off = event.target.closest("[data-pin-off]");
    if(off){ await setPinned(off.dataset.pinOff,false); closeSheet(); }
}
