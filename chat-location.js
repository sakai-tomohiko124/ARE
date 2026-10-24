"use strict";
// ===== 位置情報の共有（チャットに現在地を送る。地図の表示は OpenStreetMap のリンクを開く方式）=====

feat.loc = null;

function initLocation(){ registerTool("loc", onLocationAction); el.profileModal.addEventListener("change", (event) => { if(event.target && event.target.id === "lcRoom") updateLocationSendButton(); }); const b = $("locationButton"); if(b) b.addEventListener("click", () => runTool(openLocationShare)); }

/** 受け取った位置情報メッセージを安全に描画する（数値以外は表示しない） */
function renderLocationBubble(item){
    const lat = Number(item.lat), lng = Number(item.lng);
    if(!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180){
        return '<div class="bubble">📍 位置情報（形式が正しくないため表示できません）</div>';
    }
    const la = lat.toFixed(4), ln = lng.toFixed(4);
    const link = "https://www.openstreetmap.org/?mlat=" + la + "&mlon=" + ln + "#map=16/" + la + "/" + ln;
    return '<div class="bubble">📍 <b>' + escapeHtml(String(item.label || "現在地").slice(0, 60)) + '</b><br><span class="meta">緯度 ' + la + ' / 経度 ' + ln + '</span><br>' +
        '<a href="' + link + '" target="_blank" rel="noopener noreferrer">地図で開く（OpenStreetMap）</a></div>';
}

function openLocationShare(){
    feat.loc = null;
    const rooms = (state.rooms || []).filter((room) => !room.suspended_at);
    const current = state.currentRoom ? state.currentRoom.id : "";
    openSheet(toolHead("📍 位置情報", "自動では送られません。「現在地を取得」を押したときだけ位置を調べ、小数点以下4桁（約10m）に丸めます。チャットを開いていなくても使えます。") +
        '<div id="lcInfo" class="empty-list">「現在地を取得」を押すと、ブラウザが許可を求めます。</div>' +
        '<div class="row" style="justify-content:flex-start"><button type="button" class="button" data-t="loc:get">📡 現在地を取得</button></div>' +
        '<div id="lcAfter" hidden>' +
        '<div class="row" style="justify-content:flex-start"><a id="lcMap" class="button-secondary" style="text-decoration:none;padding:8px 14px;border-radius:10px" target="_blank" rel="noopener noreferrer" href="#">🗺️ 地図で開く</a><button type="button" class="button-secondary" data-t="loc:copy">📋 座標をコピー</button></div>' +
        '<label for="lcLabel">ひとこと（60文字まで・任意）</label><input id="lcLabel" type="text" maxlength="60" placeholder="例：駅の東口にいます">' +
        '<label for="lcRoom">送り先</label><select id="lcRoom" class="status-select"><option value="">（送らない）</option>' +
        rooms.map((room) => '<option value="' + escapeHtml(room.id) + '"' + (room.id === current ? " selected" : "") + '>' + escapeHtml(roomTitle(room)) + '</option>').join("") + '</select>' +
        '<div class="row"><button type="button" class="button" data-t="loc:send">このチャットに送信</button></div></div>' + toolClose());
}

function onLocationAction(action, node){
    if(action === "get") return getLocation(node);
    if(action === "send") return sendLocation(node);
    if(action === "copy") return copyLocation();
}

function mapLink(loc){
    const la = loc.lat.toFixed(4), ln = loc.lng.toFixed(4);
    return "https://www.openstreetmap.org/?mlat=" + la + "&mlon=" + ln + "#map=16/" + la + "/" + ln;
}

function getLocation(button){
    if(!navigator.geolocation){ showToast("このブラウザでは位置情報を使えません。"); return; }
    button.disabled = true;
    const info = $("lcInfo");
    if(info) info.textContent = "取得しています...";
    navigator.geolocation.getCurrentPosition((pos) => {
        feat.loc = {lat:Math.round(pos.coords.latitude * 10000) / 10000, lng:Math.round(pos.coords.longitude * 10000) / 10000, acc:Math.round(pos.coords.accuracy || 0)};
        if($("lcInfo")) $("lcInfo").textContent = "緯度 " + feat.loc.lat.toFixed(4) + " / 経度 " + feat.loc.lng.toFixed(4) + "（誤差 約" + feat.loc.acc + "m）";
        const map = $("lcMap");
        if(map) map.href = mapLink(feat.loc);
        if($("lcAfter")) $("lcAfter").hidden = false;
        button.disabled = false;
        button.textContent = "📡 取得し直す";
        updateLocationSendButton();
    }, (error) => {
        button.disabled = false;
        const reason = error && error.code === 1 ? "位置情報の利用が許可されていません。ブラウザ（またはスマホの設定）で、このサイトの位置情報を「許可」にしてください。" : "現在地を取得できませんでした。電波の良い場所でもう一度お試しください。";
        if($("lcInfo")) $("lcInfo").textContent = reason;
    }, {enableHighAccuracy:true, timeout:15000, maximumAge:30000});
}

function updateLocationSendButton(){
    const send = document.querySelector("[data-t='loc:send']"), room = $("lcRoom");
    if(send && room) send.disabled = !room.value;
}

async function copyLocation(){
    if(!feat.loc) return;
    const text = feat.loc.lat.toFixed(4) + ", " + feat.loc.lng.toFixed(4);
    try{ await navigator.clipboard.writeText(text); showToast("座標をコピーしました。"); }
    catch(_e){ showToast("コピーできませんでした：" + text); }
}

async function sendLocation(button){
    const roomId = $("lcRoom") ? $("lcRoom").value : "";
    if(!feat.loc){ showToast("先に現在地を取得してください。"); return; }
    if(!roomId){ showToast("送り先のチャットを選んでください。"); return; }
    button.disabled = true;
    const label = ($("lcLabel") ? $("lcLabel").value : "").trim().slice(0, 60);
    const payload = {type:"location", lat:feat.loc.lat, lng:feat.loc.lng, label:label || "現在地"};
    try{
        const result = await sendPayloadToRoom(roomId, payload);
        if(result && result.error) throw result.error;
        closeSheet();
        showToast("位置情報を送信しました。");
        if(state.currentRoom && state.currentRoom.id === roomId) await loadMessages(false, true);
    }catch(error){ button.disabled = false; showToast(featError(error)); }
}
