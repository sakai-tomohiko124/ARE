"use strict";
// ===== 消えるメッセージ（時間がたつと、自動で見えなくなる）=====
// ・送る前に「⏳」ボタンで時間を選びます。選んだ時間は「次から送る分」に使われ、チャットを切り替えると自動でオフに戻ります。
// ・期限がすぎると、サーバー側（1分ごとの定期処理）で表示対象から外れます。画面でも期限になった時点で消えます。
// ・注意：管理者は安全管理のため、消えたあとも内容を確認できる場合があります（ご利用上の注意のとおり）。写真・ファイルの実体は残ることがあります。

feat.ttl = 0;
const TTL_OPTIONS = [[0, "オフ（消えない）"], [60, "1分"], [600, "10分"], [3600, "1時間"], [86400, "24時間"], [604800, "7日"]];
feat.ttlTimer = 0;

function initTimed(){
    registerTool("ttl", onTtlAction);
    const button = $("ttlButton");
    if(button) button.addEventListener("click", () => runTool(openTtlSheet));
    addRenderHook(markTimedMessages);
    addRoomHook(() => setTtl(0));
    updateTtlButton();
}

function ttlLabel(seconds){ const o = TTL_OPTIONS.find((x) => x[0] === seconds); return o ? o[1] : seconds + "秒"; }

function setTtl(seconds){
    feat.ttl = Number(seconds) || 0;
    updateTtlButton();
}

function updateTtlButton(){
    const button = $("ttlButton");
    if(!button) return;
    button.textContent = feat.ttl ? "⏳ " + ttlLabel(feat.ttl) : "⏳ 消える";
    button.classList.toggle("on", feat.ttl > 0);
}

function openTtlSheet(){
    openSheet(toolHead("⏳ 消えるメッセージ", "選んだ時間がたつと、このあと送るメッセージが自動で見えなくなります。チャットを切り替えるとオフに戻ります。") +
        '<div class="cam-choose">' + TTL_OPTIONS.map((o) => '<button type="button" class="admin-card more-item' + (o[0] === feat.ttl ? " on" : "") + '" data-t="ttl:set" data-s="' + o[0] + '">' + (o[0] === feat.ttl ? "✔ " : "") + escapeHtml(o[1]) + '</button>').join("") + '</div>' +
        '<div class="meta">※管理者は安全管理のため、消えたあとも確認できる場合があります。</div>' + toolClose());
}

function onTtlAction(action, node){
    if(action !== "set") return;
    setTtl(Number(node.dataset.s));
    closeSheet();
    showToast(feat.ttl ? "これから送るメッセージは " + ttlLabel(feat.ttl) + " で消えます。" : "消えるメッセージをオフにしました。");
}

function remainText(ms){
    if(ms <= 0) return "まもなく消えます";
    const s = Math.ceil(ms / 1000);
    if(s < 90) return "あと" + s + "秒";
    if(s < 5400) return "あと" + Math.ceil(s / 60) + "分";
    if(s < 172800) return "あと" + Math.ceil(s / 3600) + "時間";
    return "あと" + Math.ceil(s / 86400) + "日";
}

function markTimedMessages(){
    clearInterval(feat.ttlTimer);
    feat.ttlTimer = 0;
    let any = false;
    state.messages.forEach((message) => {
        if(!message.expires_at) return;
        const row = el.messages.querySelector('article[data-mid="' + String(message.id).replace(/[^0-9a-f-]/gi, "") + '"] .message-time');
        if(!row) return;
        row.insertAdjacentHTML("beforeend", ' <span class="ttl-badge" data-exp="' + escapeHtml(message.expires_at) + '" data-mid="' + escapeHtml(message.id) + '">⏳ ' + remainText(new Date(message.expires_at).getTime() - Date.now()) + '</span>');
        any = true;
    });
    if(any) feat.ttlTimer = setInterval(tickTimed, 1000);
}

/** 画面を作り直さずに、残り時間の表示を更新し、期限がきたメッセージを消す（編集中の入力を邪魔しない） */
function tickTimed(){
    const badges = el.messages.querySelectorAll(".ttl-badge");
    if(!badges.length){ clearInterval(feat.ttlTimer); feat.ttlTimer = 0; return; }
    const now = Date.now();
    badges.forEach((badge) => {
        const left = new Date(badge.dataset.exp).getTime() - now;
        if(left <= 0){
            const row = badge.closest("article");
            if(row) row.remove();
            state.messages = state.messages.filter((m) => m.id !== badge.dataset.mid);
        }else badge.textContent = "⏳ " + remainText(left);
    });
}
