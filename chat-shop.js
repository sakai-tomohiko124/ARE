"use strict";
// ===== 買い物リスト（このチャットのみんなで共有。同時に見られて、チェックもリアルタイムで反映）=====
const shop = {room:null, rows:[], chan:null, timer:null};

function initShop(){
    registerTool("shop", onShopAction);
    try{
        shop.chan = requireClient().channel("are-shop").on("postgres_changes", {event:"*", schema:"public", table:"room_shopping"}, (p) => {
            const rid = (p.new && p.new.room_id) || (p.old && p.old.room_id);
            if(shop.room && (!rid || rid === shop.room)) shopLoad();
        }).subscribe();
    }catch(_e){}
}
function shopWho(id){ return id === state.user.id ? "あなた" : profileDisplayName(feat.known.get(id) || (state.currentRoom && state.currentRoom.partner && state.currentRoom.partner.id === id ? state.currentRoom.partner : {id})); }

async function openShop(){
    const room = state.currentRoom;
    if(!room){ showToast("先にチャットを開いてください。"); return; }
    shop.room = room.id; shop.rows = [];
    openSheet(toolHead("🛒 買い物リスト", "このチャットのみんなで共有します。だれかが追加・チェックすると、すぐ反映されます") + '<div id="shBody"><div class="empty-list">読み込み中...</div></div>' + toolClose());
    clearInterval(shop.timer);
    shop.timer = setInterval(() => { if(el.profileModal.hidden || !$("shBody")){ clearInterval(shop.timer); shop.room = null; } else shopLoad(); }, 10000);
    await shopLoad();
}
async function shopLoad(){
    const room = shop.room; if(!room) return;
    const r = await requireClient().from("room_shopping").select("id,text,done,added_by,done_by,created_at").eq("room_id", room).order("created_at").limit(200);
    if(shop.room !== room || !$("shBody")) return;
    if(r.error){ $("shBody").innerHTML = '<div class="empty-list">' + escapeHtml(featError(r.error)) + '</div>'; return; }
    const sig = JSON.stringify(r.data); if(sig === shop.sig && $("shList")) return;
    shop.sig = sig; shop.rows = r.data || []; shopPaint();
}
function shopPaint(){
    const box = $("shBody"); if(!box) return;
    const keep = $("shNew") ? $("shNew").value : "", focused = document.activeElement && document.activeElement.id === "shNew";
    const todo = shop.rows.filter((x) => !x.done), done = shop.rows.filter((x) => x.done);
    const row = (x) => '<div class="admin-card" style="display:flex;gap:8px;align-items:center"><button type="button" class="' + (x.done ? "" : "button-secondary") + '" style="min-width:36px" data-t="shop:toggle" data-id="' + escapeHtml(x.id) + '" data-on="' + (x.done ? 0 : 1) + '" aria-pressed="' + x.done + '" aria-label="' + escapeHtml(x.text) + ' を' + (x.done ? "未購入に戻す" : "購入済みにする") + '">' + (x.done ? "✔" : "　") + '</button><span style="flex:1;overflow-wrap:anywhere;' + (x.done ? "text-decoration:line-through;color:var(--muted)" : "") + '">' + escapeHtml(x.text) + '<small class="meta"> ' + escapeHtml(x.done && x.done_by ? shopWho(x.done_by) + " が購入" : shopWho(x.added_by) + " が追加") + '</small></span><button type="button" class="button-secondary" data-t="shop:rm" data-id="' + escapeHtml(x.id) + '" aria-label="削除">🗑️</button></div>';
    box.innerHTML = '<div class="row" style="justify-content:flex-start"><input id="shNew" type="text" maxlength="60" placeholder="例：牛乳" style="flex:1"><button type="button" class="button" data-t="shop:add">追加</button></div>' +
        '<div id="shList">' + (todo.length ? todo.map(row).join("") : '<div class="empty-list">買うものはありません 🎉</div>') + '</div>' +
        (done.length ? '<b>購入済み（' + done.length + '）</b>' + done.map(row).join("") : "") +
        '<div class="row"><button type="button" class="button-secondary" data-t="shop:paste"' + (todo.length ? "" : " disabled") + '>チャットに貼る</button><button type="button" class="button-secondary" data-t="shop:clear"' + (done.length ? "" : " disabled") + '>購入済みを消す</button></div>';
    const inp = $("shNew"); inp.value = keep; if(focused) inp.focus();
    inp.onkeydown = (e) => { if(e.key === "Enter"){ e.preventDefault(); runTool(() => onShopAction("add")); } };
}
async function onShopAction(action, node){
    const c = requireClient();
    try{
        if(action === "add"){
            const t = $("shNew").value.trim(); if(!t) return;
            const r = await c.rpc("shop_add", {p_room:shop.room, p_text:t}); if(r.error) throw r.error; $("shNew").value = "";
        }else if(action === "toggle"){
            const r = await c.rpc("shop_set", {p_id:node.dataset.id, p_done:node.dataset.on === "1"}); if(r.error) throw r.error;
        }else if(action === "rm"){
            const r = await c.rpc("shop_remove", {p_id:node.dataset.id}); if(r.error) throw r.error;
        }else if(action === "clear"){
            const r = await c.rpc("shop_clear_done", {p_room:shop.room}); if(r.error) throw r.error;
        }else if(action === "paste"){
            const items = shop.rows.filter((x) => !x.done).map((x) => "・" + x.text);
            await sendMessagePayload({type:"text", text:"🛒 買い物リスト\n" + items.join("\n")}, {keepInput:true}); closeSheet(); return;
        }else return;
        shop.sig = ""; await shopLoad();
    }catch(e){ showToast(featError(e)); }
}
