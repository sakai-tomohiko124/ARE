"use strict";
// ===== 連絡先の共有 ＋ QRコードで友だち追加 =====
// ・「👤 連絡先」：友だち（または自分）を選んで、チャットに「連絡先カード」として送ります。受け取った人はそこから追加（チャットを開始）できます。
//   ※相手のプロフィール（名前・アイコン）が見えるだけで、メールなどの個人情報は含みません。送る前に確認が出ます。
// ・「📷 QRで友だち追加」：カメラでQRコードを読み取ります。読めるのは、このアプリのプロフィールQRだけです。
// ・カメラの映像は端末の外には送りません。

const ct = {stream:null, raf:0, det:null, jsqr:null, busy:false, found:false};
const CT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function initContact(){
    registerTool("ct", onContactAction);
    const origClose = closeSheet;
    closeSheet = function(){ ctStop(); return origClose.apply(this, arguments); };
    window.addEventListener("pagehide", ctStop);
    extraBubbles.contact = (item) => {
        const name = escapeHtml(String(item.name || "ユーザー").slice(0, 30));
        const ok = CT_UUID.test(String(item.uid || ""));
        return '<div class="bubble"><div class="meta">👤 連絡先</div><b>' + name + '</b>' + (ok ? '<div class="row" style="justify-content:flex-start;margin-top:6px"><button type="button" class="button-secondary" data-ctview="' + escapeHtml(item.uid) + '">プロフィール</button><button type="button" data-ctchat="' + escapeHtml(item.uid) + '">チャットする</button></div>' : "") + '</div>';
    };
    el.messages.addEventListener("click", (e) => {
        const v = e.target.closest("[data-ctview]"), c = e.target.closest("[data-ctchat]");
        if(v) runTool(() => ctOpenProfile(v.dataset.ctview));
        else if(c) runTool(() => ctChat(c.dataset.ctchat));
    });
    const tools = document.querySelector(".composer-tools");
    if(!tools) throw new Error("入力欄のボタン置き場が見つかりません。");
    const b = document.createElement("button");
    b.type = "button"; b.className = "tool-button"; b.id = "contactButton"; b.setAttribute("data-needs-room", ""); b.setAttribute("data-feature", "contact");
    b.textContent = "👤 連絡先"; b.disabled = !state.currentRoom;
    b.addEventListener("click", () => runTool(openContactPick));
    tools.appendChild(b);
}

async function ctProfile(uid){
    if(!CT_UUID.test(uid)) return null;
    if(feat.known.has(uid)) return feat.known.get(uid);
    const r = await requireClient().from(TABLES.profiles).select("*").eq("id", uid).maybeSingle();
    if(r.error || !r.data) return null;
    feat.known.set(uid, r.data);
    return r.data;
}
async function ctOpenProfile(uid){
    if(uid === state.user.id){ showToast("これはあなた自身です。"); return; }
    const p = await ctProfile(uid);
    if(!p){ showToast("このユーザーが見つかりませんでした。"); return; }
    openProfileView(p);
}
async function ctChat(uid){
    if(uid === state.user.id){ showToast("これはあなた自身です。"); return; }
    const p = await ctProfile(uid);
    if(!p){ showToast("このユーザーが見つかりませんでした。"); return; }
    closeSheet();
    await openOrCreateDirectChat(uid);
}

function openContactPick(){
    if(!state.currentRoom){ showToast("先にチャットを開いてください。"); return; }
    const people = [{id:state.user.id, name:"自分（" + profileDisplayName(state.profile) + "）"}];
    feat.known.forEach((p, id) => { if(id !== state.user.id) people.push({id, name:profileDisplayName(p)}); });
    openSheet(toolHead("👤 連絡先を送る", "チャットに送る人を選んでください（名前とアイコンだけが共有されます）") +
        '<div class="list">' + people.slice(0, 80).map((p) => '<button type="button" class="button-secondary" style="display:block;width:100%;text-align:left;margin:4px 0" data-t="ct:pick" data-id="' + escapeHtml(p.id) + '">' + escapeHtml(p.name) + '</button>').join("") + '</div>' + toolClose());
}

async function ctSend(uid){
    const p = uid === state.user.id ? state.profile : await ctProfile(uid);
    if(!p){ showToast("このユーザーが見つかりませんでした。"); return; }
    const name = (p.display_name || "ユーザー").slice(0, 30);
    if(!confirm("「" + name + "」さんの連絡先を、このチャットに送ります。よろしいですか？")) return;
    await sendMessagePayload({type:"contact", uid:p.id, name}, {keepInput:true});
    closeSheet(); showToast("連絡先を送りました。");
}

// ---------- QRスキャン ----------
function openQrScan(){
    openSheet(toolHead("📷 QRで友だち追加", "相手のプロフィールQR（プロフィール → 🔗 プロフィールを共有）を映してください") +
        '<video id="ctVideo" playsinline muted style="width:100%;max-height:320px;background:#000;border-radius:12px"></video><canvas id="ctCv" hidden></canvas>' +
        '<div class="admin-card" id="ctSt">カメラを起動しています…</div>' +
        '<div class="row"><label class="button-secondary" for="ctImg" style="padding:10px 14px;border-radius:12px;cursor:pointer">画像から読み取る</label><input id="ctImg" type="file" accept="image/*" hidden><button type="button" class="button-secondary" data-t="ct:stop">閉じる</button></div>');
    $("ctImg").addEventListener("change", () => { const f = $("ctImg").files[0]; if(f) ctScanFile(f); });
    ctCamera();
}

function ctSt(t){ const a = $("ctSt"); if(a) a.textContent = t; }

async function ctDecoder(){
    if(ct.det) return ct.det;
    if("BarcodeDetector" in window){
        try{
            const d = new window.BarcodeDetector({formats:["qr_code"]});
            ct.det = async (src) => { const r = await d.detect(src); return r && r[0] ? r[0].rawValue : ""; };
            return ct.det;
        }catch(_e){ /* 次の方法へ */ }
    }
    if(!window.jsQR){
        await new Promise((res, rej) => {
            const s = document.createElement("script");
            s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"; s.crossOrigin = "anonymous";
            s.onload = res; s.onerror = () => rej(new Error("jsqr_load"));
            document.head.appendChild(s);
        });
    }
    ct.det = async (src) => {
        const cv = document.createElement("canvas"), w = src.videoWidth || src.naturalWidth || src.width, h = src.videoHeight || src.naturalHeight || src.height;
        const k = Math.min(1, 800 / Math.max(w, h)); cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
        const g = cv.getContext("2d", {willReadFrequently:true}); g.drawImage(src, 0, 0, cv.width, cv.height);
        const id = g.getImageData(0, 0, cv.width, cv.height), r = window.jsQR(id.data, id.width, id.height);
        return r ? r.data : "";
    };
    return ct.det;
}

async function ctCamera(){
    ct.found = false;
    try{
        if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("nocam");
        const dec = await ctDecoder();
        ct.stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}, audio:false});
        const v = $("ctVideo"); if(!v){ ctStop(); return; }
        v.srcObject = ct.stream; await v.play();
        ctSt("QRコードを枠に映してください。");
        let last = 0;
        const loop = async (t) => {
            if(!ct.stream) return;
            if(t - last > 250 && v.videoWidth && !ct.busy && !ct.found){
                last = t; ct.busy = true;
                try{ const raw = await dec(v); if(raw){ ct.found = true; await ctHandle(raw); } }catch(_e){}
                ct.busy = false;
            }
            ct.raf = requestAnimationFrame(loop);
        };
        ct.raf = requestAnimationFrame(loop);
    }catch(e){
        console.error("[ARE qr]", e);
        const m = String(e && e.message || e);
        ctSt(m.includes("jsqr_load") ? "QR読み取り用の部品を読み込めませんでした。" : e && e.name === "NotAllowedError" ? "カメラが許可されていません。ブラウザの設定で許可するか、「画像から読み取る」を使ってください。" : "カメラを使えませんでした。「画像から読み取る」を使ってください。");
    }
}
function ctStop(){
    cancelAnimationFrame(ct.raf);
    if(ct.stream){ ct.stream.getTracks().forEach((t) => t.stop()); ct.stream = null; }
}

async function ctScanFile(file){
    try{
        const dec = await ctDecoder();
        const bmp = await createImageBitmap(file);
        const raw = await dec(bmp);
        if(!raw){ ctSt("QRコードが見つかりませんでした。"); return; }
        await ctHandle(raw);
    }catch(e){ console.error("[ARE qr]", e); ctSt("読み取れませんでした。"); }
}

/** QRの中身から、このアプリのプロフィールIDだけを取り出す（他のサイトのURLは受け付けない） */
function ctParse(raw){
    try{
        const u = new URL(String(raw).trim(), location.href);
        if(u.origin !== location.origin) return "";
        const id = u.searchParams.get("u") || "";
        return CT_UUID.test(id) ? id.toLowerCase() : "";
    }catch(_e){ return ""; }
}

async function ctHandle(raw){
    const id = ctParse(raw);
    if(!id){ ct.found = false; ctSt("このアプリのプロフィールQRではありません。"); return; }
    ctStop();
    if(id === state.user.id){ ctSt("これはあなた自身のQRです。"); return; }
    const p = await ctProfile(id);
    if(!p){ ctSt("このユーザーが見つかりませんでした。"); return; }
    openSheet(toolHead("👤 見つかりました") + bigAvatar(p) + '<h3 style="margin:0;text-align:center">' + escapeHtml(profileDisplayName(p)) + '</h3>' +
        '<div class="row"><button type="button" class="button-secondary" data-pm="close">やめる</button><button type="button" data-t="ct:add" data-id="' + escapeHtml(id) + '">友だちとしてチャットを始める</button></div>');
}

async function onContactAction(action, node){
    if(action === "pick") await ctSend(node.dataset.id);
    else if(action === "stop"){ ctStop(); closeSheet(); }
    else if(action === "add") await ctChat(node.dataset.id);
}
