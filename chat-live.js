"use strict";
// ===== ライブ位置共有（一定時間だけ、お互いの位置を地図で見る）=====
// ・「15分・30分・1時間」から選んで開始すると、その間だけ、あなたの位置がこのチャットのメンバーに共有されます。時間が来ると自動で終わります。
// ・いつでも「共有をやめる」で止められます（やめるとサーバーの位置も消えます）。
// ・位置を送るのは、AREをブラウザで開いている間だけです（ブラウザを閉じる／画面を消すと、位置の更新が止まります）。
// ・地図は OpenStreetMap の画像を使います（無料。出典の表示が必要です）。位置の保存先は Supabase（このチャットのメンバーだけが見られます）。

const lv = {room:null, until:0, watch:null, lastSent:0, expTimer:null, pts:[], poll:null, mapRoom:null, sig:""};
const LV_KEY = () => "are_live_" + (state.user ? state.user.id : "x");
const LV_W = 300, LV_H = 280;

function lvRad(d){ return d * Math.PI / 180; }
/** 2点間の距離（メートル） */
function lvDist(a, b){
    const R = 6371000, dLat = lvRad(b.lat - a.lat), dLng = lvRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lvRad(a.lat)) * Math.cos(lvRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function lvDistText(m){ return m < 1000 ? "約 " + Math.max(1, Math.round(m / 10) * 10) + " m" : "約 " + (m / 1000).toFixed(m < 10000 ? 1 : 0) + " km"; }
/** 緯度経度 → 地図の世界ピクセル（ズーム z） */
function lvWorld(lat, lng, z){
    const s = 256 * Math.pow(2, z), la = Math.max(-85.05, Math.min(85.05, lat));
    return {x:(lng + 180) / 360 * s, y:(1 - Math.log(Math.tan(lvRad(la)) + 1 / Math.cos(lvRad(la))) / Math.PI) / 2 * s};
}
/** 全員が収まる、いちばん大きいズームを選ぶ */
function lvZoom(pts){
    if(pts.length < 2) return 16;
    for(let z = 17; z >= 2; z--){
        const w = pts.map((p) => lvWorld(p.lat, p.lng, z)), xs = w.map((p) => p.x), ys = w.map((p) => p.y);
        if(Math.max(...xs) - Math.min(...xs) <= LV_W - 90 && Math.max(...ys) - Math.min(...ys) <= LV_H - 100) return z;
    }
    return 2;
}

function initLive(){
    registerTool("live", onLiveAction);
    extraBubbles.live = (item) => {
        const until = item.until ? new Date(item.until) : null, active = until && until.getTime() > Date.now();
        const hm = until ? String(until.getHours()).padStart(2, "0") + ":" + String(until.getMinutes()).padStart(2, "0") : "";
        return '<div class="bubble">📍 <b>ライブ位置共有' + (active ? "中" : "（終了）") + '</b>' + (hm ? '<br><span class="meta">' + hm + ' まで</span>' : "") +
            (active ? '<br><button type="button" class="button-secondary" data-openlive="1">地図を見る</button>' : "") + '</div>';
    };
    el.messages.addEventListener("click", (e) => { if(e.target.closest("[data-openlive]") && state.currentRoom) runTool(() => openLiveMap(state.currentRoom.id)); });
    // ページを開き直したとき、まだ時間が残っていれば共有を続ける
    try{
        const saved = JSON.parse(localStorage.getItem(LV_KEY()) || "null");
        if(saved && saved.room && saved.until > Date.now()) lvWatch(saved.room, saved.until);
        else localStorage.removeItem(LV_KEY());
    }catch(_e){}
    window.addEventListener("pagehide", () => { /* 位置の更新は止まるが、期限までは相手に最後の位置が見える */ });
}

function lvGeoError(e){
    return e && e.code === 1 ? "位置情報が許可されていません。ブラウザの設定で許可してください。" : e && e.code === 3 ? "位置情報の取得に時間がかかっています。もう一度お試しください。" : "位置情報を取得できませんでした。";
}
function lvGetPos(){ return new Promise((res, rej) => { if(!navigator.geolocation){ rej({code:0}); return; } navigator.geolocation.getCurrentPosition(res, rej, {enableHighAccuracy:true, timeout:15000, maximumAge:5000}); }); }

async function lvStart(minutes){
    const room = state.currentRoom;
    if(!room){ showToast("先にチャットを開いてください。"); return; }
    let pos;
    try{ pos = await lvGetPos(); }catch(e){ showToast(lvGeoError(e)); return; }
    const res = await requireClient().rpc("live_loc_update", {p_room:room.id, p_lat:pos.coords.latitude, p_lng:pos.coords.longitude, p_acc:pos.coords.accuracy || null, p_minutes:minutes});
    if(res.error) throw res.error;
    const until = new Date(res.data).getTime();
    lvWatch(room.id, until);
    try{ localStorage.setItem(LV_KEY(), JSON.stringify({room:room.id, until})); }catch(_e){}
    await sendMessagePayload({type:"live", until:new Date(until).toISOString()}, {keepInput:true});
    showToast("位置の共有を始めました。");
}

function lvWatch(roomId, until){
    lvStopWatch();
    lv.room = roomId; lv.until = until; lv.lastSent = 0;
    if(navigator.geolocation){
        lv.watch = navigator.geolocation.watchPosition((pos) => {
            const now = Date.now();
            if(now >= lv.until){ lvStop(true); return; }
            if(now - lv.lastSent < 5000) return;
            lv.lastSent = now;
            requireClient().rpc("live_loc_update", {p_room:roomId, p_lat:pos.coords.latitude, p_lng:pos.coords.longitude, p_acc:pos.coords.accuracy || null, p_minutes:null})
                .then((r) => { if(r.error && String(r.error.message || "").includes("not_sharing")) lvStop(true); }).catch(() => {});
        }, () => {}, {enableHighAccuracy:true, maximumAge:3000, timeout:20000});
    }
    lv.expTimer = setTimeout(() => lvStop(true), Math.max(1000, until - Date.now()));
}
function lvStopWatch(){
    if(lv.watch !== null && navigator.geolocation){ try{ navigator.geolocation.clearWatch(lv.watch); }catch(_e){} }
    lv.watch = null; clearTimeout(lv.expTimer); lv.expTimer = null;
}
async function lvStop(auto){
    const room = lv.room;
    lvStopWatch(); lv.room = null; lv.until = 0;
    try{ localStorage.removeItem(LV_KEY()); }catch(_e){}
    if(room){ try{ await requireClient().rpc("live_loc_stop", {p_room:room}); }catch(_e){} }
    showToast(auto ? "位置の共有が終わりました。" : "位置の共有をやめました。");
}

function openLive(){
    const room = state.currentRoom;
    if(!room){ showToast("先にチャットを開いてください。"); return; }
    const sharing = lv.room === room.id && lv.until > Date.now();
    const hm = (t) => { const d = new Date(t); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
    openSheet(toolHead("📍 ライブ位置共有", "一定時間だけ、このチャットのメンバーとお互いの位置を地図で見られます") +
        (sharing ? '<div class="admin-card">✅ 共有中（' + hm(lv.until) + ' まで）</div><div class="row"><button type="button" data-t="live:map">地図を見る</button><button type="button" class="button-danger" data-t="live:stop">共有をやめる</button></div>'
            : '<label for="lvMin">共有する時間</label><select id="lvMin" class="status-select"><option value="15">15分</option><option value="30" selected>30分</option><option value="60">1時間</option></select>' +
              '<div class="row"><button type="button" data-t="live:start">共有を開始</button><button type="button" class="button-secondary" data-t="live:map">相手の位置を見る</button></div>') +
        '<div class="meta">・時間が来ると自動で終わります。いつでもやめられます。<br>・位置を送るのは、AREを開いている間だけです。<br>・見られるのは、このチャットのメンバーだけです。</div>' + toolClose());
}

async function onLiveAction(action){
    if(action === "start"){ await lvStart(Number((document.getElementById("lvMin") || {}).value) || 30); openLive(); }
    else if(action === "stop"){ await lvStop(false); openLive(); }
    else if(action === "map"){ if(state.currentRoom) await openLiveMap(state.currentRoom.id); }
    else if(action === "stop2"){ await lvStop(false); lv.sig = ""; await lvLoad(); }
    else if(action === "start2"){ await lvStart(30); lv.sig = ""; await lvLoad(); }
}

// ---------- 地図 ----------
async function openLiveMap(roomId){
    lv.mapRoom = roomId; lv.sig = "";
    openSheet(toolHead("📍 みんなの位置") + '<div class="meta">読み込み中…</div>');
    await lvLoad();
    clearInterval(lv.poll);
    lv.poll = setInterval(() => { if(!el.profileModal.hidden && lv.mapRoom) lvLoad(); else { clearInterval(lv.poll); lv.mapRoom = null; } }, 5000);
}

async function lvLoad(){
    const room = lv.mapRoom; if(!room) return;
    const r = await requireClient().from("live_locations").select("user_id,lat,lng,accuracy,expires_at,updated_at").eq("room_id", room);
    if(lv.mapRoom !== room || el.profileModal.hidden) return;
    lv.pts = (r.data || []).filter((p) => new Date(p.expires_at).getTime() > Date.now());
    const sig = JSON.stringify(lv.pts.map((p) => [p.user_id, p.lat, p.lng, p.updated_at])) + (lv.room === room);
    if(sig === lv.sig) return;
    lv.sig = sig;
    await lvPaint(room);
}

function lvName(uid){
    if(uid === state.user.id) return "あなた";
    const p = feat.known.get(uid) || (state.currentRoom && state.currentRoom.partner && state.currentRoom.partner.id === uid ? state.currentRoom.partner : {id:uid});
    return profileDisplayName(p);
}

async function lvPaint(roomId){
    const pts = lv.pts.map((p) => ({uid:p.user_id, lat:p.lat, lng:p.lng, acc:p.accuracy, at:p.updated_at, name:lvName(p.user_id)}));
    const mine = lv.room === roomId && lv.until > Date.now();
    let body;
    if(!pts.length){
        body = '<div class="admin-card">いま位置を共有している人はいません。</div>';
    }else{
        const z = lvZoom(pts), w = pts.map((p) => lvWorld(p.lat, p.lng, z));
        const cx = (Math.min(...w.map((p) => p.x)) + Math.max(...w.map((p) => p.x))) / 2, cy = (Math.min(...w.map((p) => p.y)) + Math.max(...w.map((p) => p.y))) / 2;
        const left = cx - LV_W / 2, top = cy - LV_H / 2, n = Math.pow(2, z);
        let tiles = "";
        for(let ty = Math.floor(top / 256); ty <= Math.floor((top + LV_H) / 256); ty++){
            if(ty < 0 || ty >= n) continue;
            for(let tx = Math.floor(left / 256); tx <= Math.floor((left + LV_W) / 256); tx++){
                const wx = ((tx % n) + n) % n;
                tiles += '<img class="lv-tile" alt="" draggable="false" referrerpolicy="origin" style="left:' + Math.round(tx * 256 - left) + 'px;top:' + Math.round(ty * 256 - top) + 'px" src="https://tile.openstreetmap.org/' + z + '/' + wx + '/' + ty + '.png">';
            }
        }
        const pins = pts.map((p, i) => '<div class="lv-pin' + (p.uid === state.user.id ? " me" : "") + '" style="left:' + Math.round(w[i].x - left) + 'px;top:' + Math.round(w[i].y - top) + 'px"><span>' + escapeHtml(Array.from(p.name)[0] || "?") + '</span><em>' + escapeHtml(p.name) + '</em></div>').join("");
        const me = pts.find((p) => p.uid === state.user.id);
        body = '<div class="lv-map" style="width:' + LV_W + 'px;height:' + LV_H + 'px" role="img" aria-label="みんなの位置の地図">' + tiles + pins + '<a class="lv-attr" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a></div>' +
            pts.map((p) => {
                const ago = Math.max(0, Math.round((Date.now() - new Date(p.at).getTime()) / 1000));
                return '<div class="admin-card"><b>' + escapeHtml(p.name) + '</b> <span class="meta">' + (ago < 90 ? ago + "秒前" : Math.round(ago / 60) + "分前") + (p.acc ? " ・ 誤差 約" + Math.round(p.acc) + "m" : "") + '</span>' +
                    (me && p.uid !== state.user.id ? '<div>あなたから ' + lvDistText(lvDist(me, p)) + '</div>' : "") +
                    '<div class="row" style="justify-content:flex-start"><a class="button-secondary" style="padding:6px 10px;border-radius:10px;text-decoration:none;color:var(--text)" href="https://www.openstreetmap.org/?mlat=' + p.lat.toFixed(6) + '&mlon=' + p.lng.toFixed(6) + '#map=17/' + p.lat.toFixed(5) + '/' + p.lng.toFixed(5) + '" target="_blank" rel="noopener noreferrer">地図アプリで開く</a></div></div>';
            }).join("");
    }
    const top0 = el.profileSheet.scrollTop;
    openSheet(toolHead("📍 みんなの位置", "5秒ごとに更新します") + body +
        '<div class="row">' + (mine ? '<button type="button" class="button-danger" data-t="live:stop2">共有をやめる</button>' : '<button type="button" class="button-secondary" data-t="live:start2">自分も共有する</button>') + '<button type="button" class="button-secondary" data-pm="close">閉じる</button></div>');
    el.profileSheet.scrollTop = top0;
}
