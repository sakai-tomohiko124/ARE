"use strict";
// ===== スレッド（返信を1つの流れにまとめる）と、受け取った写真・動画・音声・ファイルの「端末に保存」ボタン =====
feat.th = {root:null};

function initThread(){
    registerTool("th", onThreadAction);
    addRenderHook(paintThreadChips);
    el.messages.addEventListener("click", (event) => {
        const chip = event.target.closest("[data-thread]");
        if(chip) runTool(() => openThread(chip.dataset.thread));
    });
    addMsgTool({id:"thread", icon:"🧵", label:"スレッドで見る", when:(message, item) => Boolean(item.replyTo) || threadMembers(message.id).length > 1,
        run:(message) => openThread(message.id)});
    addMsgTool({id:"save", icon:"💾", label:"端末に保存", when:(message, item) => ["image", "video", "audio", "file"].includes(item.type), run:(message, item) => saveMedia(message, item)});
}

function threadParent(message){
    const item = parseMessageContent(message.content);
    return item.replyTo && item.replyTo.id ? String(item.replyTo.id) : null;
}
function threadRootOf(id){
    const byId = new Map(state.messages.map((m) => [m.id, m]));
    let cur = id, guard = 0;
    while(guard++ < 200){
        const m = byId.get(cur); if(!m) break;
        const p = threadParent(m);
        if(!p || !byId.has(p)) break;
        cur = p;
    }
    return cur;
}
function threadMembers(id){
    const root = threadRootOf(id);
    return state.messages.filter((m) => threadRootOf(m.id) === root);
}

function paintThreadChips(){
    const roots = new Map();
    state.messages.forEach((m) => { const r = threadRootOf(m.id); roots.set(r, (roots.get(r) || 0) + 1); });
    el.messages.querySelectorAll("article[data-mid]").forEach((row) => {
        const n = roots.get(row.dataset.mid) || 0;
        if(n < 2 || row.querySelector(".thread-chip")) return;
        const holder = row.querySelector(".reactions") || row.querySelector(".bubble");
        if(!holder) return;
        const chip = document.createElement("button");
        chip.type = "button"; chip.className = "chip-btn thread-chip"; chip.dataset.thread = row.dataset.mid;
        chip.textContent = "🧵 スレッド " + (n - 1) + "件の返信";
        holder.insertAdjacentElement("afterend", chip);
    });
}

function openThread(id){
    const root = threadRootOf(id);
    feat.th.root = root;
    const members = threadMembers(root);
    if(!members.length){ showToast("スレッドが見つかりません。"); return; }
    openSheet(toolHead("🧵 スレッド", "この返信のつながりだけを、1つの流れで表示します。") +
        '<div id="thBody">' + members.map((m) => {
            const item = parseMessageContent(m.content), t = new Date(m.created_at);
            return '<div class="admin-card' + (m.id === root ? '" style="border-color:var(--accent)' : "") + '"><b>' + escapeHtml(senderName(m)) + '</b> <span class="meta">' + (t.getMonth() + 1) + '/' + t.getDate() + ' ' + String(t.getHours()).padStart(2, "0") + ':' + String(t.getMinutes()).padStart(2, "0") + '</span><div style="white-space:pre-wrap;overflow-wrap:anywhere">' + escapeHtml(messageSummary(item)) + '</div>' +
                '<div class="row"><button type="button" class="button-secondary" data-t="th:jump" data-id="' + escapeHtml(m.id) + '">チャットで見る</button></div></div>';
        }).join("") + '</div>' +
        '<label for="thText">このスレッドに返信</label><textarea id="thText" rows="2" maxlength="2000" placeholder="返信を入力"></textarea><div class="row"><button type="button" class="button" data-t="th:send">送信</button></div>' + toolClose());
}

async function onThreadAction(action, node){
    if(action === "jump"){ closeSheet(); jumpToMessage(node.dataset.id); return; }
    if(action === "send"){
        const text = ($("thText").value || "").trim();
        if(!text){ showToast("返信を入力してください。"); return; }
        const members = threadMembers(feat.th.root), last = members[members.length - 1];
        const payload = {type:"text", text, replyTo:{id:last.id, name:senderName(last), text:messageSummary(parseMessageContent(last.content)).slice(0, 60)}};
        await sendMessagePayload(payload, {keepInput:true});
        openThread(feat.th.root);
    }
}

async function saveMedia(message, item){
    const row = el.messages.querySelector('article[data-mid="' + String(message.id).replace(/[^0-9a-f-]/gi, "") + '"]');
    const node = row && row.querySelector("img, video, audio, a.file-card, source");
    const url = node ? (node.currentSrc || node.src || node.href) : (item.url || "");
    if(!url){ showToast("保存できるファイルが見つかりません。読み込みが終わってからもう一度押してください。"); return; }
    try{
        const response = await fetch(url);
        if(!response.ok) throw new Error("HTTP " + response.status);
        const blob = await response.blob();
        const ext = (blob.type.split("/")[1] || "").replace(/[^a-z0-9]/gi, "").slice(0, 5);
        let name = String(item.name || ("ARE-" + item.type)).replace(/[\\/:*?"<>|]/g, "_");
        if(!/\.[a-z0-9]{2,5}$/i.test(name) && ext) name += "." + ext;
        downloadBlob(blob, name);
        showToast("端末に保存しました（ダウンロードフォルダ）。");
    }catch(error){ showToast("保存できませんでした。時間をおいてもう一度お試しください。"); }
}
