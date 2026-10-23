"use strict";
// ===== メッセージ検索（自分が参加しているチャットの中だけ） =====

function initSearch(){
    document.getElementById("searchBtn").addEventListener("click",openSearch);
    el.profileModal.addEventListener("input",onSearchInput);
    el.profileModal.addEventListener("click",onSearchClick);
}

function openSearch(){
    openSheet('<h3 style="margin:0">🔍 メッセージを検索</h3>' +
        '<input id="srQuery" type="text" maxlength="50" placeholder="探したい言葉（自分が参加しているチャットの中だけ）" autocomplete="off">' +
        '<div id="srResults" class="sr-results"><div class="empty-list">言葉を入力すると、新しい順に表示します。</div></div>' +
        '<div class="row"><button type="button" class="button-secondary" data-pm="close">閉じる</button></div>');
    const input = document.getElementById("srQuery");
    if(input) input.focus();
}

function onSearchInput(event){
    if(event.target.id !== "srQuery") return;
    clearTimeout(feat.srTimer);
    feat.srTimer = setTimeout(runSearch,350);
}

async function runSearch(){
    const input = document.getElementById("srQuery");
    const box = document.getElementById("srResults");
    if(!input || !box) return;
    const q = input.value.trim();
    if(!q){ box.innerHTML = '<div class="empty-list">言葉を入力すると、新しい順に表示します。</div>'; return; }
    box.innerHTML = '<div class="empty-list">検索しています…</div>';
    try{
        const result = await requireClient().rpc("search_messages",{p_query:q,p_limit:30});
        if(result.error) throw result.error;
        if(!document.getElementById("srResults")) return;
        const rows = result.data || [];
        box.innerHTML = rows.length ? rows.map((row) => {
            const room = state.rooms.find((r) => r.id === row.room_id);
            return '<button type="button" class="admin-card sr-item" data-sr-room="' + escapeHtml(row.room_id) + '" data-sr-msg="' + escapeHtml(row.message_id) + '">' +
                '<span class="meta">' + escapeHtml(room ? roomTitle(room) : "チャット") + ' ・ ' + escapeHtml(row.sender_name || "") + ' ・ ' + escapeHtml(new Date(row.created_at).toLocaleString("ja-JP")) + '</span><br>' + escapeHtml(String(row.snippet || "")) + '</button>';
        }).join("") : '<div class="empty-list">見つかりませんでした。</div>';
    }catch(error){ box.innerHTML = '<div class="empty-list">' + escapeHtml(featError(error)) + '</div>'; }
}

async function onSearchClick(event){
    const item = event.target.closest("[data-sr-room]");
    if(!item) return;
    const room = state.rooms.find((r) => r.id === item.dataset.srRoom);
    if(!room){ showToast("そのチャットを開けませんでした。チャット一覧の「更新」を押してください。"); return; }
    closeSheet();
    await selectRoom(room,room.partner);
    setTimeout(() => { jumpToMessage(item.dataset.srMsg); },200);
}
