"use strict";
// ===== アルバム（いま開いているチャットの写真一覧）と、期限切れ画像の自動再取得 =====

feat.album = {items:[]};

function initAlbum(){
    registerTool("album", onAlbumAction);
    // 添付のURLは7日で切れるので、読み込みに失敗したらパスから取り直す
    document.addEventListener("error", async (event) => {
        const node = event.target;
        if(!node || !node.dataset || !node.dataset.path || node.dataset.retried) return;
        if(!["IMG", "AUDIO", "VIDEO"].includes(node.tagName)) return;
        node.dataset.retried = "1";
        try{
            const result = await requireClient().storage.from(STORAGE_BUCKET).createSignedUrl(node.dataset.path, 3600);
            if(result.data && result.data.signedUrl) node.src = result.data.signedUrl;
        }catch(_e){}
    }, true);
}

async function openAlbum(){
    if(!state.currentRoom){ showToast("先にチャットを開いてください。"); return; }
    const entries = state.messages.filter((m) => !m.deleted_at).map((m) => ({message:m, item:parseMessageContent(m.content)})).filter((x) => x.item.type === "image");
    openSheet(toolHead("🖼️ アルバム", escapeHtml(roomTitle(state.currentRoom)) + " の写真（読み込み済みのメッセージ " + entries.length + " 枚）") +
        '<div id="abBody"><div class="empty-list">読み込み中...</div></div>' + toolClose());
    const client = requireClient();
    const paths = entries.map((x) => x.item.path).filter(Boolean);
    const fresh = new Map();
    if(paths.length){
        try{
            const signed = await client.storage.from(STORAGE_BUCKET).createSignedUrls(paths, 3600);
            (signed.data || []).forEach((s) => { if(s.signedUrl) fresh.set(s.path, s.signedUrl); });
        }catch(_e){}
    }
    feat.album.items = entries.map((x) => ({
        url: safeHttpUrl(fresh.get(x.item.path) || x.item.url || ""), name: x.item.name || "画像",
        at: x.message.created_at, who: senderName(x.message)
    })).filter((x) => x.url).reverse();
    paintAlbum();
}

function paintAlbum(){
    const box = $("abBody");
    if(!box) return;
    const items = feat.album.items;
    box.innerHTML = items.length ? '<div class="ab-grid">' + items.map((x, i) =>
        '<button type="button" class="ab-thumb" data-t="album:view" data-i="' + i + '"><img src="' + escapeHtml(x.url) + '" alt="' + escapeHtml(x.name) + '" loading="lazy"></button>').join("") + '</div>'
        : '<div class="empty-list">このチャットには、まだ写真がありません。</div>';
}

function onAlbumAction(action, node){
    if(action === "view"){
        const x = feat.album.items[Number(node.dataset.i)];
        if(!x) return;
        $("abBody").innerHTML = '<img class="ab-big" src="' + escapeHtml(x.url) + '" alt="' + escapeHtml(x.name) + '">' +
            '<div class="meta">' + escapeHtml(x.who) + ' ・ ' + escapeHtml(new Date(x.at).toLocaleString("ja-JP")) + '</div>' +
            '<div class="row"><button type="button" class="button-secondary" data-t="album:back">← 一覧へ</button><a class="button" href="' + escapeHtml(x.url) + '" target="_blank" rel="noopener noreferrer" download="' + escapeHtml(x.name) + '" style="text-decoration:none">保存・開く</a></div>';
    }
    if(action === "back") paintAlbum();
}
