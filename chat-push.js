"use strict";
// ===== 通知まわり：閉じていても届くプッシュ通知・チャットごとのミュート・ホーム画面に追加 =====
// ・プッシュ通知は Web Push（無料）。サーバー側は Supabase の関数（send-push）が送ります。
// ・iPhone / iPad は「ホーム画面に追加」したアプリからだけ受け取れます（iOS の決まり）。
// ・ミュートは「そのチャットの通知だけ止める」機能です。メッセージ自体は今までどおり届きます。
// ・鍵（公開鍵）はここに書いてあるものを使います。秘密鍵はサーバー側だけにあります。

const PUSH_VAPID_PUBLIC = "BAlH0oPT2cFnXhNuqviP5X4w3IAIT5uv8PLMv3qa15Gh136Xlhv1CNwXBRYCVRzfFWlzjoWAwugxEYFerEHjvK4";
feat.push = {reg:null, sub:null, showBody:true, mutes:new Set(), installEvent:null, ready:false};

function pushIsIos(){ return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)); }
function pushIsStandalone(){
    try{ return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; }catch(_e){ return false; }
}
function pushSupported(){ return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }

function pushKeyBytes(b64){
    const pad = "=".repeat((4 - b64.length % 4) % 4);
    const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(raw.length);
    for(let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
}

/** いまの状態：unsupported / need-install / denied / off / on */
function pushState(){
    if(!pushSupported()) return pushIsIos() && !pushIsStandalone() ? "need-install" : "unsupported";
    if(pushIsIos() && !pushIsStandalone()) return "need-install";
    if(Notification.permission === "denied") return "denied";
    return feat.push.sub ? "on" : "off";
}

async function pushRegister(){
    if(!("serviceWorker" in navigator)) return null;
    try{
        feat.push.reg = await navigator.serviceWorker.register("sw.js");
        if(pushSupported()){
            const ready = await navigator.serviceWorker.ready;
            feat.push.reg = ready || feat.push.reg;
            feat.push.sub = await feat.push.reg.pushManager.getSubscription();
        }
    }catch(error){ console.warn("[ARE push] service worker", error); }
    feat.push.ready = true;
    return feat.push.reg;
}

async function pushEnable(){
    const st = pushState();
    if(st === "need-install") throw new Error("iPhone / iPad では、先に「ホーム画面に追加」してから開き直してください。");
    if(st === "unsupported") throw new Error("このブラウザは、閉じている間のプッシュ通知に対応していません。");
    if(st === "denied") throw new Error("通知がブロックされています。ブラウザの設定で、このサイトの通知を「許可」にしてください。");
    const perm = await Notification.requestPermission();
    if(perm !== "granted") throw new Error("通知は許可されませんでした。");
    const reg = feat.push.reg || await pushRegister();
    if(!reg) throw new Error("通知の準備ができませんでした。");
    let sub = await reg.pushManager.getSubscription();
    if(!sub) sub = await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:pushKeyBytes(PUSH_VAPID_PUBLIC)});
    const j = sub.toJSON();
    const row = {endpoint:sub.endpoint, user_id:state.user.id, p256dh:j.keys.p256dh, auth:j.keys.auth, show_body:feat.push.showBody, ua:navigator.userAgent.slice(0, 120)};
    const res = await requireClient().from("push_subscriptions").upsert(row, {onConflict:"endpoint"});
    if(res.error){ try{ await sub.unsubscribe(); }catch(_e){} throw res.error; }
    feat.push.sub = sub;
    try{ localStorage.setItem("are_push_" + state.user.id, "1"); }catch(_e){}
}

async function pushDisable(){
    const sub = feat.push.sub;
    feat.push.sub = null;
    try{ localStorage.removeItem("are_push_" + state.user.id); }catch(_e){}
    if(!sub) return;
    try{ await requireClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint); }catch(_e){}
    try{ await sub.unsubscribe(); }catch(_e){}
}

async function pushLoadPrefs(){
    try{
        const res = await requireClient().from("push_subscriptions").select("endpoint,show_body");
        if(!res.error && feat.push.sub){
            const mine = (res.data || []).find((r) => r.endpoint === feat.push.sub.endpoint);
            if(mine) feat.push.showBody = mine.show_body !== false;
            else if(localStorage.getItem("are_push_" + state.user.id)) await pushEnable().catch(() => {});   // サーバー側から消えていたら登録し直す
        }
    }catch(_e){}
}

async function pushSetBody(on){
    feat.push.showBody = Boolean(on);
    if(!feat.push.sub) return;
    const res = await requireClient().from("push_subscriptions").update({show_body:feat.push.showBody}).eq("endpoint", feat.push.sub.endpoint);
    if(res.error) throw res.error;
}

// ===== ミュート =====
async function muteLoad(){
    try{
        const res = await requireClient().from("room_mutes").select("room_id");
        if(!res.error) feat.push.mutes = new Set((res.data || []).map((r) => r.room_id));
    }catch(_e){}
    muteButtonPaint();
    if(typeof renderRooms === "function") try{ renderRooms(); }catch(_e){}
}
function isMuted(roomId){ return feat.push.mutes.has(roomId); }

async function muteSet(roomId, on){
    if(!roomId) return;
    const t = requireClient().from("room_mutes");
    const res = on ? await t.upsert({user_id:state.user.id, room_id:roomId}, {onConflict:"user_id,room_id"}) : await t.delete().eq("room_id", roomId).eq("user_id", state.user.id);
    if(res.error) throw res.error;
    if(on) feat.push.mutes.add(roomId); else feat.push.mutes.delete(roomId);
    muteButtonPaint();
    try{ renderRooms(); }catch(_e){}
}

function muteButtonPaint(){
    const b = document.getElementById("muteBtn");
    if(!b) return;
    const room = state.currentRoom;
    b.hidden = !room;
    if(!room) return;
    const m = isMuted(room.id);
    b.textContent = m ? "🔕" : "🔔";
    b.title = m ? "このチャットの通知を再開" : "このチャットの通知を止める";
    b.setAttribute("aria-label", b.title);
    b.setAttribute("aria-pressed", m ? "true" : "false");
}

function roomNameById(id){
    const r = (state.rooms || []).find((x) => x.id === id);
    return r ? roomTitle(r) : "（見つからないチャット）";
}

// ===== 設定画面 =====
function openPushSettings(){
    const st = pushState();
    const stText = {on:"✅ オン（アプリを閉じていても届きます）", off:"⚪ オフ", denied:"⛔ ブラウザでブロック中", "need-install":"📲 先に「ホーム画面に追加」が必要です", unsupported:"❌ このブラウザは未対応"}[st];
    const standalone = pushIsStandalone();
    let install = "";
    if(standalone) install = '<div class="meta">✅ ホーム画面のアプリとして開いています。</div>';
    else if(feat.push.installEvent) install = '<button type="button" data-t="push:install">📲 ホーム画面に追加する</button>';
    else if(pushIsIos()) install = '<div class="meta">📲 iPhone / iPad：Safari の「共有」ボタン →「ホーム画面に追加」を押し、ホーム画面のアイコンから開いてください。</div>';
    else install = '<div class="meta">📲 ブラウザのメニュー（⋮）から「アプリをインストール」または「ホーム画面に追加」を選べます。</div>';
    const muted = Array.from(feat.push.mutes);
    openSheet(toolHead("🔔 通知・ホーム画面", "アプリを閉じていても、新着をお知らせします（無料）") +
        '<div class="meta">状態：' + stText + '</div>' +
        '<div class="row">' + (st === "on"
            ? '<button type="button" data-t="push:off">通知をオフにする</button><button type="button" class="button-secondary" data-t="push:test">テスト通知</button>'
            : '<button type="button" data-t="push:on"' + (st === "unsupported" || st === "denied" ? " disabled" : "") + '>通知をオンにする</button>') + '</div>' +
        '<label class="row" style="gap:8px"><input type="checkbox" data-t="push:body"' + (feat.push.showBody ? " checked" : "") + '> 通知に本文を表示する（オフだと「新しいメッセージ」とだけ表示）</label>' +
        '<h4 style="margin:12px 0 4px">ホーム画面に追加</h4>' + install +
        '<h4 style="margin:12px 0 4px">ミュート中のチャット</h4>' +
        (muted.length ? muted.map((id) => '<div class="row"><span>🔕 ' + escapeHtml(roomNameById(id)) + '</span><button type="button" class="button-secondary" data-t="push:unmute" data-room="' + escapeHtml(id) + '">再開</button></div>').join("") : '<div class="meta">ありません（チャット画面の 🔔 で切り替えます）</div>') +
        toolClose());
}

async function onPushAction(action, node){
    if(action === "on"){ await pushEnable(); showToast("通知をオンにしました。"); openPushSettings(); }
    else if(action === "off"){ await pushDisable(); showToast("通知をオフにしました。"); openPushSettings(); }
    else if(action === "body"){ await pushSetBody(node.checked); showToast(node.checked ? "本文を表示します。" : "本文を隠します。"); }
    else if(action === "unmute"){ await muteSet(node.dataset.room, false); openPushSettings(); }
    else if(action === "test"){
        const reg = feat.push.reg || await navigator.serviceWorker.ready;
        await reg.showNotification("ARE テスト通知", {body:"このように表示されます。", icon:"icon-192.png", tag:"are-test"});
    }else if(action === "install"){
        const ev = feat.push.installEvent;
        if(!ev) return;
        ev.prompt();
        try{ await ev.userChoice; }catch(_e){}
        feat.push.installEvent = null;
        openPushSettings();
    }
}

function pushOpenFromUrl(){
    let id = null;
    try{ id = new URLSearchParams(location.search).get("room"); }catch(_e){}
    if(!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    const room = (state.rooms || []).find((r) => r.id === id);
    if(room){ selectRoom(room, room.partner); history.replaceState(null, "", location.pathname); }
}

function initPush(){
    registerTool("push", onPushAction);
    // ヘッダーの 🔔 ボタン
    const head = document.querySelector(".chat-header");
    const anchor = document.getElementById("refreshMessagesButton");
    if(!head || !anchor) throw new Error("チャットの上部が見つかりません。");
    const b = document.createElement("button");
    b.type = "button"; b.id = "muteBtn"; b.className = "button-secondary"; b.hidden = true; b.textContent = "🔔";
    b.addEventListener("click", () => { if(state.currentRoom) runTool(() => muteSet(state.currentRoom.id, !isMuted(state.currentRoom.id)).then(() => showToast(isMuted(state.currentRoom.id) ? "このチャットの通知を止めました。" : "このチャットの通知を再開しました。"))); });
    head.insertBefore(b, anchor);
    addRoomHook(() => muteButtonPaint());
    // 画面内ポップアップ・ブラウザ通知もミュートに従う
    if(typeof nfPopup === "function"){
        const orig = nfPopup;
        nfPopup = function(room, m){ if(room && isMuted(room.id)) return; return orig.apply(this, arguments); };
    }
    // ホーム画面に追加
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); feat.push.installEvent = e; });
    window.addEventListener("appinstalled", () => { feat.push.installEvent = null; });
    // 通知をタップして開いたとき
    if("serviceWorker" in navigator){
        navigator.serviceWorker.addEventListener("message", (e) => {
            const d = e.data || {};
            if(d.type === "open-room" && d.room){ const r = (state.rooms || []).find((x) => x.id === d.room); if(r) selectRoom(r, r.partner); }
        });
    }
    const orig2 = renderRooms;
    let opened = false;
    renderRooms = function(){ orig2.apply(this, arguments); if(!opened && (state.rooms || []).length){ opened = true; pushOpenFromUrl(); } };
    pushRegister().then(pushLoadPrefs);
    muteLoad();
    if(state.rooms && state.rooms.length){ opened = true; pushOpenFromUrl(); }
}
