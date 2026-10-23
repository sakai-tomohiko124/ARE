"use strict";
// ===== 返信・引用 =====

feat.reply = null;

function initReply(){
    if(!window.AREFeatures.ok("msgmenu")) throw new Error("メッセージ操作メニューが起動していません。");
    const bar = document.createElement("div");
    bar.id = "replyBar";
    bar.className = "reply-bar";
    bar.hidden = true;
    const text = document.createElement("span");
    text.id = "replyText";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "button-secondary";
    cancel.textContent = "✕";
    cancel.setAttribute("aria-label","返信をやめる");
    cancel.addEventListener("click",clearReply);
    bar.appendChild(text);
    bar.appendChild(cancel);
    document.querySelector(".composer .composer-bottom").insertAdjacentElement("beforebegin",bar);

    addMsgTool({id:"reply",icon:"↩",label:"返信",run:(message,item) => {
        feat.reply = {id:message.id,name:senderName(message),text:messageSummary(item).slice(0,60)};
        showReply();
        el.messageInput.focus();
    }});
    addPayloadDecorator((payload) => { if(feat.reply) payload.replyTo = {id:feat.reply.id,name:feat.reply.name,text:feat.reply.text}; });
    addPayloadSentHook(() => clearReply());
    addRoomHook(() => clearReply());
}

function showReply(){
    const bar = document.getElementById("replyBar");
    if(!bar || !feat.reply) return;
    document.getElementById("replyText").textContent = "↩ " + feat.reply.name + "：" + feat.reply.text;
    bar.hidden = false;
}

function clearReply(){
    feat.reply = null;
    const bar = document.getElementById("replyBar");
    if(bar) bar.hidden = true;
}
