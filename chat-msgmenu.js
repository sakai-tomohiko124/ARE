"use strict";
// ===== メッセージ操作メニュー（返信・転送・リアクション・固定のボタンを並べる土台） =====

function initMsgMenu(){
    addRenderHook(decorateMessages);
    el.messages.addEventListener("click",onToolClick);
}

function decorateMessages(){
    el.messages.querySelectorAll("article[data-mid]").forEach((row) => {
        const message = state.messages.find((m) => m.id === row.dataset.mid);
        const body = row.querySelector(".message-body");
        const bubble = body && body.querySelector(".bubble");
        if(!message || !bubble) return;
        const item = parseMessageContent(message.content);
        const editing = bubble.classList.contains("edit");

        const top = document.createElement("div");
        top.className = "msg-top";
        if(item.forwarded){
            const tag = document.createElement("span");
            tag.className = "fw-tag";
            tag.textContent = "↪ 転送";
            top.appendChild(tag);
        }
        if(item.replyTo && typeof item.replyTo === "object"){
            const quote = document.createElement("button");
            quote.type = "button";
            quote.className = "quote";
            quote.dataset.jump = String(item.replyTo.id || "");
            const who = document.createElement("b");
            who.textContent = String(item.replyTo.name || "");
            const what = document.createElement("span");
            what.textContent = " " + String(item.replyTo.text || "").slice(0,80);
            quote.appendChild(who);
            quote.appendChild(what);
            top.appendChild(quote);
        }
        if(top.childNodes.length) body.insertBefore(top,bubble);

        const holder = document.createElement("div");
        holder.className = "reactions";
        holder.dataset.rx = message.id;
        bubble.insertAdjacentElement("afterend",holder);

        if(!editing && msgTools.length){
            const bar = document.createElement("div");
            bar.className = "tool-row";
            msgTools.forEach((tool) => {
                if(tool.when && !tool.when(message,item)) return;
                const button = document.createElement("button");
                button.type = "button";
                button.className = "tool-icon";
                button.dataset.tool = tool.id;
                button.dataset.mid = message.id;
                const icon = typeof tool.icon === "function" ? tool.icon(message,item) : tool.icon;
                const label = typeof tool.label === "function" ? tool.label(message,item) : tool.label;
                button.textContent = icon;
                button.title = label;
                button.setAttribute("aria-label",label);
                bar.appendChild(button);
            });
            if(bar.childNodes.length) holder.insertAdjacentElement("afterend",bar);
        }
    });
}

async function onToolClick(event){
    const jump = event.target.closest("[data-jump]");
    if(jump){ if(jump.dataset.jump) jumpToMessage(jump.dataset.jump); return; }
    const button = event.target.closest("[data-tool]");
    if(!button) return;
    const message = state.messages.find((m) => m.id === button.dataset.mid);
    const tool = msgTools.find((t) => t.id === button.dataset.tool);
    if(!message || !tool) return;
    await tool.run(message,parseMessageContent(message.content),button);
}
