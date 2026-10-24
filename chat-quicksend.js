"use strict";
// ===== スクショ・画像・PDFを「貼り付け」「ドラッグ」「画面キャプチャ」で、すばやく送る =====
// ・チャット画面（相手のチャットを開いているとき）で Ctrl+V（スマホは「📋 貼り付け」ボタン）すると、送る前の確認が出ます。Enter か「送信」で送れます。
// ・「確認なしですぐ送る」にチェックすると、次からは貼り付けた瞬間に送信します（まちがえて送らないよう、最初はオフです）。
// ・ファイルを画面にドラッグしても同じように送れます。「🖥️ 画面を撮る」は、パソコンで画面（またはウィンドウ）を1枚撮って、そのまま送信前の確認に出します。
// ・チャット画面以外では、画像・ファイルの貼り付けはできません（protect.js が止めます）。文字の貼り付けはどこでもできます。

feat.qs = {files:[], tray:null, urls:[]};

function qsAuto(){ try{ return localStorage.getItem("are_qs_auto") === "1"; }catch(_e){ return false; } }

function qsKind(file){
    const t = String(file.type || "");
    if(t.startsWith("image/") && t !== "image/svg+xml") return "image";
    if(t.startsWith("video/")) return "video";
    const ext = fileExt(file);
    if(FILE_MIME_BY_EXT[ext]) return "file";
    return null;
}

function qsStamp(){
    const d = new Date(), p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}
function qsName(file, i){
    const generic = /^(image|blob|screenshot)?\.?(png|jpe?g|gif|webp)?$/i.test(file.name || "");
    if(!file.name || generic){
        const ext = (file.type || "image/png").split("/")[1].replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "") || "png";
        return new File([file], "screenshot-" + qsStamp() + (i ? "-" + (i + 1) : "") + "." + ext, {type:file.type});
    }
    return file;
}

function qsRoomOpen(){ return Boolean(state.currentRoom) && el.profileModal.hidden && !document.body.classList.contains("modal-open"); }

function initQuickSend(){
    window.__areAllowFilePaste = (target) => {
        if(!qsRoomOpen()) return false;
        if(!target || target === document.body || target === document.documentElement) return true;
        if(target.id === "messageInput") return true;
        return !target.closest("input,textarea,select,[contenteditable='true']");
    };
    document.addEventListener("paste", (event) => {
        const cd = event.clipboardData;
        if(!cd || !qsRoomOpen()) return;
        const files = Array.from(cd.files || []);
        if(!files.length) return;
        if(!window.__areAllowFilePaste(event.target)) return;
        event.preventDefault();
        qsAdd(files);
    });
    const drop = document.querySelector("main.main") || document.body;
    drop.addEventListener("dragover", (event) => { if(qsRoomOpen() && event.dataTransfer && Array.from(event.dataTransfer.types || []).includes("Files")){ event.preventDefault(); drop.classList.add("qs-drag"); } });
    drop.addEventListener("dragleave", (event) => { if(event.target === drop) drop.classList.remove("qs-drag"); });
    drop.addEventListener("drop", (event) => {
        drop.classList.remove("qs-drag");
        if(!qsRoomOpen() || !event.dataTransfer || !event.dataTransfer.files.length) return;
        event.preventDefault();
        qsAdd(Array.from(event.dataTransfer.files));
    });
    // 送信前の確認が出ているときは、入力欄が空なら Enter で送る
    el.messageInput.addEventListener("keydown", (event) => {
        if(event.key === "Enter" && !event.shiftKey && !event.isComposing && feat.qs.files.length && !el.messageInput.value.trim()){
            event.preventDefault(); event.stopImmediatePropagation(); qsSend();
        }
    }, true);
    const tools = document.querySelector(".composer-tools");
    if(tools){
        const paste = document.createElement("button");
        paste.type = "button"; paste.className = "tool-button"; paste.id = "qsPasteButton"; paste.setAttribute("data-needs-room", ""); paste.disabled = !state.currentRoom;
        paste.textContent = "📋 貼り付け";
        paste.addEventListener("click", () => runTool(qsFromClipboard));
        tools.appendChild(paste);
        if(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia){
            const cap = document.createElement("button");
            cap.type = "button"; cap.className = "tool-button"; cap.id = "qsCaptureButton"; cap.setAttribute("data-needs-room", ""); cap.disabled = !state.currentRoom;
            cap.textContent = "🖥️ 画面を撮る";
            cap.addEventListener("click", () => runTool(qsCapture));
            tools.appendChild(cap);
        }
    }
    addRoomHook(() => qsClear());
}

async function qsFromClipboard(){
    if(!state.currentRoom){ showToast("先にチャットを開いてください。"); return; }
    if(!navigator.clipboard || !navigator.clipboard.read){ showToast("このブラウザでは、ボタンからの貼り付けに対応していません。Ctrl+V（または長押し→貼り付け）をお使いください。"); return; }
    let items;
    try{ items = await navigator.clipboard.read(); }
    catch(_e){ showToast("クリップボードを読めませんでした。許可を確認してください。"); return; }
    const files = [];
    for(const item of items){
        const type = item.types.find((t) => t.startsWith("image/") || t === "application/pdf");
        if(!type) continue;
        const blob = await item.getType(type);
        files.push(new File([blob], type === "application/pdf" ? "clipboard-" + qsStamp() + ".pdf" : "image." + type.split("/")[1], {type}));
    }
    if(!files.length){ showToast("クリップボードに画像やPDFがありません。"); return; }
    qsAdd(files);
}

async function qsCapture(){
    if(!state.currentRoom){ showToast("先にチャットを開いてください。"); return; }
    let stream;
    try{ stream = await navigator.mediaDevices.getDisplayMedia({video:true, audio:false}); }
    catch(_e){ showToast("画面を撮れませんでした（許可されなかった可能性があります）。"); return; }
    try{
        const video = document.createElement("video");
        video.srcObject = stream; video.muted = true;
        await video.play();
        await new Promise((r) => setTimeout(r, 350));
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        if(!blob) throw new Error("画像にできませんでした。");
        qsAdd([new File([blob], "screenshot-" + qsStamp() + ".png", {type:"image/png"})]);
    }finally{ stream.getTracks().forEach((t) => t.stop()); }
}

function qsAdd(files){
    const ok = [], bad = [];
    files.forEach((f, i) => { const k = qsKind(f); if(k) ok.push(qsName(f, i)); else bad.push(f.name || "ファイル"); });
    if(bad.length) showToast("送れない形式です：" + bad.join("、") + "（画像・動画・PDF・Word・Excel・PowerPointが送れます）");
    if(!ok.length) return;
    feat.qs.files = feat.qs.files.concat(ok).slice(0, 10);
    if(qsAuto()){ qsSend(); return; }
    qsPaint();
}

function qsClear(){
    feat.qs.files = [];
    feat.qs.urls.forEach((u) => URL.revokeObjectURL(u)); feat.qs.urls = [];
    if(feat.qs.tray){ feat.qs.tray.remove(); feat.qs.tray = null; }
}

function qsPaint(){
    feat.qs.urls.forEach((u) => URL.revokeObjectURL(u)); feat.qs.urls = [];
    if(!feat.qs.tray){
        const tray = document.createElement("div");
        tray.className = "qs-tray"; tray.id = "qsTray";
        const composer = document.querySelector(".composer");
        composer.insertBefore(tray, composer.querySelector(".composer-tools"));
        tray.addEventListener("click", (event) => {
            const b = event.target.closest("[data-qs]"); if(!b) return;
            if(b.dataset.qs === "send") runTool(qsSend);
            else if(b.dataset.qs === "cancel") qsClear();
            else if(b.dataset.qs === "rm"){ feat.qs.files.splice(Number(b.dataset.i), 1); if(feat.qs.files.length) qsPaint(); else qsClear(); }
        });
        tray.addEventListener("change", (event) => { if(event.target.id === "qsAuto"){ try{ localStorage.setItem("are_qs_auto", event.target.checked ? "1" : "0"); }catch(_e){ /* 無視 */ } } });
        feat.qs.tray = tray;
    }
    feat.qs.tray.innerHTML = '<div class="qs-items">' + feat.qs.files.map((f, i) => {
        let thumb = '<span class="qs-doc">📄</span>';
        if((f.type || "").startsWith("image/")){ const u = URL.createObjectURL(f); feat.qs.urls.push(u); thumb = '<img src="' + u + '" alt="">'; }
        else if((f.type || "").startsWith("video/")) thumb = '<span class="qs-doc">🎞️</span>';
        return '<div class="qs-item">' + thumb + '<small>' + escapeHtml(f.name) + '</small><button type="button" class="qs-x" data-qs="rm" data-i="' + i + '" aria-label="外す">×</button></div>';
    }).join("") + '</div><div class="qs-bar"><button type="button" class="button" data-qs="send">' + feat.qs.files.length + '件を送信（Enter）</button><button type="button" class="button-secondary" data-qs="cancel">やめる</button><label class="meta"><input type="checkbox" id="qsAuto"' + (qsAuto() ? " checked" : "") + '> 次から確認なしですぐ送る</label></div>';
}

async function qsSend(){
    const files = feat.qs.files.slice();
    if(!files.length || !state.currentRoom) return;
    qsClear();
    const groups = {image:[], video:[], file:[]};
    files.forEach((f) => groups[qsKind(f)].push(f));
    if(groups.image.length) await handleFiles(groups.image, "image");
    for(const v of groups.video) await handleFiles([v], "video");
    if(groups.file.length) await handleFiles(groups.file, "file");
}
