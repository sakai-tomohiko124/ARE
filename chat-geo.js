"use strict";
// ===== 場所つきメッセージ：目的地に着いて「到着しました」を押すと、メッセージが送られます =====
// 位置情報は、ボタンを押した瞬間にこの端末だけで距離を計算します。サーバーには目的地の座標とメッセージを保存するだけで、あなたの現在地は送りません。
// 距離の判定はこの端末の位置情報を信用する仕組みです（本気の不正対策ではありません）。
feat.geo = {rows:[], here:null, watch:false, wid:null, notified:new Set(), found:[]};
function initGeo(){
    registerTool("geo", onGeoAction);
    try{ feat.geo.watch = localStorage.getItem("are_geo_watch") === "1"; }catch(_e){ /* オフのまま */ }
    if(feat.geo.watch) geoStartWatch();
}

// 目的地の近くに来たら、画面にお知らせを出す（ARE を開いている間だけ動きます。送信は、お知らせを押したときだけ）
async function geoStartWatch(){
    const g = feat.geo;
    if(!navigator.geolocation || g.wid !== null) return;
    try{
        const r = await requireClient().from("user_geo_messages").select("id,room_id,label,lat,lng,radius_m,body,created_at").limit(100);
        if(!r.error) g.rows = r.data || [];
    }catch(_e){ /* 続行 */ }
    g.wid = navigator.geolocation.watchPosition((p) => {
        const here = {lat:p.coords.latitude, lng:p.coords.longitude, acc:p.coords.accuracy || 0};
        g.rows.forEach((row) => {
            if(g.notified.has(row.id)) return;
            if(geoDistance(here, {lat:row.lat, lng:row.lng}) - Math.min(here.acc, 100) <= row.radius_m){ g.notified.add(row.id); geoNearPopup(row); }
        });
    }, () => { /* 許可されない・取れないときは何もしない */ }, {enableHighAccuracy:true, maximumAge:30000, timeout:20000});
}
function geoStopWatch(){ const g = feat.geo; if(g.wid !== null && navigator.geolocation) navigator.geolocation.clearWatch(g.wid); g.wid = null; }
function geoNearPopup(row){
    const pop = document.createElement("button");
    pop.type = "button"; pop.className = "nf-pop";
    pop.innerHTML = '<strong>📍 「' + escapeHtml(row.label) + '」の近くに来ました</strong><span>押すと「' + escapeHtml(String(row.body).slice(0, 40)) + '」を送信します</span>';
    pop.addEventListener("click", async () => { pop.remove(); try{ await geoArrive(row, true); }catch(error){ showToast(featError(error)); } });
    document.body.appendChild(pop);
    setTimeout(() => pop.remove(), 30000);
    if("Notification" in window && Notification.permission === "granted" && document.hidden){ try{ new Notification("ARE：「" + row.label + "」の近くです", {body:"アプリを開いて、到着メッセージを送信できます。"}); }catch(_e){ /* 無視 */ } }
}
/** 到着メッセージを送って、預かりを消す。skipCheck=true は「近くに来ました」の通知から押したとき（すでに距離を確認済み） */
async function geoArrive(row, skipCheck){
    if(!skipCheck){
        showToast("現在地を確認しています…");
        const here = await geoHere();
        const dist = geoDistance(here, {lat:row.lat, lng:row.lng}), slack = Math.min(here.acc, 100);
        if(dist - slack > row.radius_m){ showToast("まだ目的地から約 " + (dist >= 1000 ? (dist / 1000).toFixed(1) + "km" : Math.round(dist) + "m") + " 離れています。"); return false; }
    }
    await sendPayloadToRoom(row.room_id, {type:"text", text:row.body});
    const d = await requireClient().from("user_geo_messages").delete().eq("id", row.id);
    if(d.error) throw d.error;
    feat.geo.rows = feat.geo.rows.filter((x) => x.id !== row.id);
    showToast("送信しました。");
    if(state.currentRoom && state.currentRoom.id === row.room_id && typeof loadMessages === "function") loadMessages().catch(() => {});
    return true;
}

function geoDistance(a, b){
    const R = 6371000, rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}
function geoHere(){
    return new Promise((resolve, reject) => {
        if(!navigator.geolocation){ reject(new Error("この端末では位置情報が使えません。")); return; }
        navigator.geolocation.getCurrentPosition((p) => resolve({lat:p.coords.latitude, lng:p.coords.longitude, acc:p.coords.accuracy || 0}),
            (e) => reject(new Error(e.code === 1 ? "位置情報が許可されていません。ブラウザの設定で許可してください。" : "現在地を取得できませんでした。")), {enableHighAccuracy:true, timeout:15000, maximumAge:0});
    });
}

async function openGeoMessages(){
    openSheet(toolHead("📍 場所で送るメッセージ", "目的地を決めて、メッセージを預けます。着いたら「到着しました」を押すと送信されます。") + '<div id="geoBody"><div class="empty-list">読み込み中...</div></div>' + toolClose());
    await loadGeo();
}
async function loadGeo(){
    try{
        const r = await requireClient().from("user_geo_messages").select("id,room_id,label,lat,lng,radius_m,body,created_at").order("created_at", {ascending:false}).limit(100);
        if(r.error) throw r.error;
        feat.geo.rows = r.data || [];
        paintGeo();
    }catch(error){ if($("geoBody")) $("geoBody").innerHTML = '<div class="empty-list">' + escapeHtml(featError(error)) + '</div>'; }
}
function geoRoomName(id){ const room = state.rooms.find((x) => x.id === id); return room ? roomTitle(room) : "（不明なチャット）"; }
function paintGeo(){
    const box = $("geoBody"); if(!box) return;
    const g = feat.geo, cur = state.currentRoom;
    box.innerHTML = '<div class="admin-card"><b>新しく預ける</b>' + (cur ? '<div class="meta">送り先：' + escapeHtml(roomTitle(cur)) + '</div>' : '<div class="meta">先にチャットを開いてから、この画面を開いてください。</div>') +
        '<label for="geoLabel">目的地の名前</label><input id="geoLabel" type="text" maxlength="60" placeholder="例：駅の改札">' +
        '<label for="geoBodyText">送るメッセージ（500文字まで）</label><textarea id="geoBodyText" rows="2" maxlength="500" placeholder="例：着いたよ！"></textarea>' +
        '<label for="geoFind">地名で探す</label><div class="row" style="justify-content:flex-start"><input id="geoFind" type="text" placeholder="例：東京駅" style="flex:1"><button type="button" class="button-secondary" data-t="geo:find">探す</button></div>' +
        (g.found.length ? g.found.map((x, i) => '<button type="button" class="admin-card more-item" data-t="geo:pick" data-i="' + i + '">' + escapeHtml(x.name) + '</button>').join("") : "") +
        '<label for="geoLL">目的地の座標（緯度,経度）</label><input id="geoLL" type="text" value="' + (g.here ? g.here.lat.toFixed(6) + "," + g.here.lng.toFixed(6) : "") + '" placeholder="35.681236,139.767125">' +
        '<div class="row" style="justify-content:flex-start"><button type="button" class="button-secondary" data-t="geo:here">📍 いまの場所を目的地にする</button></div>' +
        '<label for="geoRad">到着とみなす範囲</label><select id="geoRad" class="status-select"><option value="100">100m以内</option><option value="150" selected>150m以内</option><option value="300">300m以内</option><option value="1000">1km以内</option></select>' +
        '<div class="row"><button type="button" class="button"' + (cur ? "" : " disabled") + ' data-t="geo:save">預ける</button></div></div>' +
        '<div class="row"><button type="button" class="button-secondary" data-t="geo:watch">📡 近づいたらお知らせ：' + (g.watch ? "オン" : "オフ") + '</button></div><div class="meta">オンにすると、ARE を開いている間、目的地の近くに来たときに画面にお知らせが出ます（押すと送信）。位置情報はこの端末の中だけで調べます。</div><b>預けているメッセージ</b>' + (g.rows.length ? g.rows.map((x) => '<div class="admin-card"><b>📍 ' + escapeHtml(x.label) + '</b> <span class="meta">→ ' + escapeHtml(geoRoomName(x.room_id)) + '（' + x.radius_m + 'm以内）</span><div>' + escapeHtml(x.body) + '</div><div class="row"><button type="button" class="button" data-t="geo:arrive" data-id="' + escapeHtml(x.id) + '">到着しました</button><button type="button" class="button-secondary" data-t="geo:del" data-id="' + escapeHtml(x.id) + '">取り消す</button></div></div>').join("") : '<div class="empty-list">預けているメッセージはありません。</div>');
}
async function onGeoAction(action, node){
    const g = feat.geo;
    try{
        if(action === "here"){
            showToast("現在地を取得しています…");
            g.here = await geoHere();
            const v = { label:$("geoLabel").value, body:$("geoBodyText").value };
            paintGeo(); $("geoLabel").value = v.label; $("geoBodyText").value = v.body; return;
        }
        if(action === "find"){
            const q = ($("geoFind").value || "").trim();
            if(!q){ showToast("探したい地名を入れてください。"); return; }
            const r = await fetch("https://geocoding-api.open-meteo.com/v1/search?count=5&language=ja&format=json&name=" + encodeURIComponent(q));
            if(!r.ok) throw new Error("地名を探せませんでした。");
            const j = await r.json();
            g.found = (j.results || []).map((x) => ({name:[x.name, x.admin1, x.country].filter(Boolean).join(" / "), lat:x.latitude, lng:x.longitude}));
            const v = {label:$("geoLabel").value, body:$("geoBodyText").value, find:q};
            paintGeo(); $("geoLabel").value = v.label; $("geoBodyText").value = v.body; $("geoFind").value = v.find;
            if(!g.found.length) showToast("見つかりませんでした。別の言い方や、市区町村名で試してください。");
            return;
        }
        if(action === "pick"){
            const x = g.found[Number(node.dataset.i)]; if(!x) return;
            const v = {label:$("geoLabel").value, body:$("geoBodyText").value, find:$("geoFind").value};
            g.here = {lat:x.lat, lng:x.lng, acc:0};
            g.found = [];
            paintGeo(); $("geoLabel").value = v.label || x.name.split(" / ")[0]; $("geoBodyText").value = v.body; $("geoFind").value = v.find;
            showToast("目的地を入れました。");
            return;
        }
        if(action === "watch"){
            g.watch = !g.watch;
            try{ localStorage.setItem("are_geo_watch", g.watch ? "1" : "0"); }catch(_e){ /* 無視 */ }
            if(g.watch) await geoStartWatch(); else geoStopWatch();
            paintGeo(); return;
        }
        if(action === "save"){
            const label = ($("geoLabel").value || "").trim(), body = ($("geoBodyText").value || "").trim(), m = ($("geoLL").value || "").match(/^\s*(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)\s*$/);
            if(!state.currentRoom){ showToast("先にチャットを開いてください。"); return; }
            if(!label || !body){ showToast("目的地の名前とメッセージを入力してください。"); return; }
            if(!m || Math.abs(Number(m[1])) > 90 || Math.abs(Number(m[2])) > 180){ showToast("座標は「緯度,経度」の形で入力するか、「いまの場所を目的地にする」を押してください。"); return; }
            const r = await requireClient().from("user_geo_messages").insert({user_id:state.user.id, room_id:state.currentRoom.id, label, body, lat:Number(m[1]), lng:Number(m[2]), radius_m:Number($("geoRad").value)});
            if(r.error) throw r.error;
            showToast("預けました。目的地に着いたら「到着しました」を押してください。");
        }else if(action === "del"){
            const r = await requireClient().from("user_geo_messages").delete().eq("id", node.dataset.id);
            if(r.error) throw r.error;
        }else if(action === "arrive"){
            const row = g.rows.find((x) => x.id === node.dataset.id); if(!row) return;
            if(!(await geoArrive(row, false))) return;
        }else return;
        await loadGeo();
    }catch(error){ showToast(featError(error)); }
}
