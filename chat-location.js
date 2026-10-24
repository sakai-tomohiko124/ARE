"use strict";
// ===== 位置情報の共有（チャットに現在地を送る。地図の表示は OpenStreetMap のリンクを開く方式）=====

feat.loc = null;

function initLocation(){ registerTool("loc", onLocationAction); }

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
    if(!state.currentRoom){ showToast("先にチャットを開いてください。"); return; }
    feat.loc = null;
    openSheet(toolHead("📍 位置情報を送る", "送り先：" + escapeHtml(roomTitle(state.currentRoom)) + "。位置は小数点以下4桁（約10m）に丸めて送ります。自動では送られず、下のボタンを押したときだけ取得します。") +
        '<div id="lcInfo" class="empty-list">「現在地を取得」を押すと、ブラウザが許可を求めます。</div>' +
        '<label for="lcLabel">ひとこと（60文字まで・任意）</label><input id="lcLabel" type="text" maxlength="60" placeholder="例：駅の東口にいます">' +
        '<div class="row"><button type="button" class="button-secondary" data-t="loc:get">現在地を取得</button><button type="button" class="button" data-t="loc:send" disabled>送信</button></div>' + toolClose());
}

function onLocationAction(action, node){
    if(action === "get") return getLocation(node);
    if(action === "send") return sendLocation(node);
}

function getLocation(button){
    if(!navigator.geolocation){ showToast("このブラウザでは位置情報を使えません。"); return; }
    button.disabled = true;
    const info = $("lcInfo");
    if(info) info.textContent = "取得しています...";
    navigator.geolocation.getCurrentPosition((pos) => {
        feat.loc = {lat:Math.round(pos.coords.latitude * 10000) / 10000, lng:Math.round(pos.coords.longitude * 10000) / 10000, acc:Math.round(pos.coords.accuracy || 0)};
        if($("lcInfo")) $("lcInfo").innerHTML = '緯度 ' + feat.loc.lat.toFixed(4) + ' / 経度 ' + feat.loc.lng.toFixed(4) + '（誤差 約' + feat.loc.acc + 'm）<br><a href="https://www.openstreetmap.org/?mlat=' + feat.loc.lat.toFixed(4) + '&mlon=' + feat.loc.lng.toFixed(4) + '#map=16/' + feat.loc.lat.toFixed(4) + '/' + feat.loc.lng.toFixed(4) + '" target="_blank" rel="noopener noreferrer">地図で確認する</a>';
        const send = document.querySelector("[data-t='loc:send']");
        if(send) send.disabled = false;
        button.disabled = false;
    }, (error) => {
        button.disabled = false;
        const reason = error && error.code === 1 ? "位置情報の利用が許可されていません。ブラウザの設定を確認してください。" : "現在地を取得できませんでした。電波の良い場所でもう一度お試しください。";
        if($("lcInfo")) $("lcInfo").textContent = reason;
    }, {enableHighAccuracy:true, timeout:15000, maximumAge:30000});
}

async function sendLocation(button){
    if(!feat.loc || !state.currentRoom) return;
    button.disabled = true;
    const label = ($("lcLabel") ? $("lcLabel").value : "").trim().slice(0, 60);
    const payload = {type:"location", lat:feat.loc.lat, lng:feat.loc.lng, label:label || "現在地"};
    closeSheet();
    await sendMessagePayload(payload, {keepInput:true});
}
