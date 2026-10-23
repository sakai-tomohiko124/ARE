"use strict";
// ===== ブロック・ミュート =====

feat.blocks = new Map();

function initBlock(){
    const button = document.getElementById("blockBtn");
    button.addEventListener("click",openBlockSheet);
    el.profileModal.addEventListener("click",onBlockClick);
    addRoomHook((room) => { button.hidden = !room || Boolean(room.is_group); });
    addRenderHook(markMuted);
    loadBlocks();
}

async function loadBlocks(){
    const result = await requireClient().from("user_blocks").select("target_id,kind");
    if(result.error) throw result.error;
    feat.blocks = new Map((result.data || []).map((row) => [row.target_id,row.kind]));
}

function markMuted(){
    el.messages.querySelectorAll("article[data-mid]").forEach((row) => {
        const message = state.messages.find((m) => m.id === row.dataset.mid);
        const kind = message ? feat.blocks.get(message.sender_id) : null;
        row.classList.toggle("muted",kind === "mute" || kind === "block");
    });
}

function openBlockSheet(){
    const partner = state.currentPartner;
    if(!partner || !state.currentRoom || state.currentRoom.is_group) return;
    const kind = feat.blocks.get(partner.id) || "none";
    const label = {none:"設定なし",mute:"ミュート中",block:"ブロック中"}[kind];
    openSheet('<h3 style="margin:0">' + escapeHtml(profileDisplayName(partner)) + ' さん</h3><div class="meta">現在：' + label + '</div>' +
        '<div class="admin-card"><b>ミュート</b><div class="meta">相手のメッセージを薄く表示します。送受信はできます。</div><div class="row"><button type="button" class="button-secondary" data-bl="mute">ミュートする</button></div></div>' +
        '<div class="admin-card"><b>ブロック</b><div class="meta">このチャットで、お互いにメッセージを送れなくなります。相手には「送れません」とだけ表示されます。解除すればまた送れます。なお、運営管理者は安全管理のため会話を閲覧できます。</div><div class="row"><button type="button" class="button-danger" data-bl="block">ブロックする</button></div></div>' +
        (kind !== "none" ? '<div class="row"><button type="button" class="button" data-bl="none">解除する</button></div>' : '') +
        '<div class="row"><button type="button" class="button-secondary" data-pm="close">閉じる</button></div>');
}

async function onBlockClick(event){
    const button = event.target.closest("[data-bl]");
    if(!button || !state.currentPartner) return;
    const partnerId = state.currentPartner.id;
    button.disabled = true;
    try{
        const result = await requireClient().rpc("set_user_block",{p_target:partnerId,p_kind:button.dataset.bl});
        if(result.error) throw result.error;
        if(button.dataset.bl === "none") feat.blocks.delete(partnerId); else feat.blocks.set(partnerId,button.dataset.bl);
        closeSheet();
        showToast({none:"解除しました。",mute:"ミュートしました。",block:"ブロックしました。"}[button.dataset.bl]);
        renderMessages(false);
    }catch(error){ button.disabled = false; showToast(featError(error)); }
}
