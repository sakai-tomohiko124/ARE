"use strict";
// ===== 写真：「画像を選択」または「写真を撮る」=====
// 「写真を撮る」は、まずブラウザの中でカメラを起動します（パソコンのカメラ・スマホの内側/外側カメラ）。
// カメラが使えない・許可されない場合は、スマホの標準カメラアプリ（capture）か、ファイル選択に切り替えます。
// 撮った写真は、送信ボタンを押すまで端末の外には出ません。

feat.cam = {stream:null, facing:"environment", opts:null, blob:null, file:null};

function initCamera(){
    registerTool("cam", onCameraAction);
    window.addEventListener("pagehide", stopCamera);
    const button = $("photoButton");
    if(button) button.addEventListener("click", () => runTool(() => openPhotoChooser({multiple:true, onFiles:(files) => handleFiles(files, "image")})));
}

/** 「画像を選択／写真を撮る」の選択シートを開く。onFiles(File[]) が呼ばれる */
function openPhotoChooser(opts){
    feat.cam.opts = opts || {};
    openSheet(toolHead("📷 写真", "どちらかを選んでください。") +
        '<div class="cam-choose"><button type="button" class="admin-card more-item" data-t="cam:pick">🖼️ 画像を選択<small class="meta">端末にある写真を選びます</small></button>' +
        '<button type="button" class="admin-card more-item" data-t="cam:shoot">📸 写真を撮る<small class="meta">カメラを起動して、その場で撮影します</small></button></div>' + toolClose());
}

function onCameraAction(action, node){
    if(action === "pick") return pickFromDevice();
    if(action === "shoot") return startCamera();
    if(action === "snap") return snapPhoto();
    if(action === "flip"){ feat.cam.facing = feat.cam.facing === "environment" ? "user" : "environment"; return startCamera(); }
    if(action === "again") return startCamera();
    if(action === "use") return usePhoto(false);
    if(action === "edit") return usePhoto(true);
    if(action === "fallback") return captureFallback();
    if(action === "cancel"){ stopCamera(); return openPhotoChooser(feat.cam.opts); }
}

function pickFromDevice(){
    const opts = feat.cam.opts || {};
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; if(opts.multiple) input.multiple = true;
    input.style.display = "none";
    input.addEventListener("change", () => {
        const files = Array.from(input.files || []);
        input.remove();
        if(files.length){ closeSheet(); callPhotoCallback(files); }
    });
    document.body.appendChild(input);
    input.click();
}

function callPhotoCallback(files){
    const cb = feat.cam.opts && feat.cam.opts.onFiles;
    if(typeof cb === "function") runTool(() => cb(files));
}

function cameraSupported(){ return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }

function stopCamera(){
    const stream = feat.cam.stream;
    feat.cam.stream = null;
    if(stream) stream.getTracks().forEach((track) => { try{ track.stop(); }catch(_e){} });
}

async function startCamera(){
    stopCamera();
    if(!cameraSupported()){ showToast("このブラウザではカメラを直接起動できないため、端末のカメラ／ファイル選択に切り替えます。"); return captureFallback(); }
    openSheet(toolHead("📸 写真を撮る", "カメラの許可を求められたら「許可」を押してください。") +
        '<div class="cam-box"><video id="camVideo" class="cam-video' + (feat.cam.facing === "user" ? " mirror" : "") + '" autoplay playsinline muted></video><div id="camMsg" class="meta">カメラを起動しています...</div></div>' +
        '<div class="row"><button type="button" class="button-secondary" data-t="cam:cancel">← 戻る</button><button type="button" class="button-secondary" data-t="cam:flip" id="camFlip" disabled>🔄 向きを切替</button><button type="button" class="button" data-t="cam:snap" id="camSnap" disabled>● 撮影</button></div>');
    const wanted = feat.cam.facing;
    try{
        let stream;
        try{ stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:wanted}, width:{ideal:1920}, height:{ideal:1080}}, audio:false}); }
        catch(first){ if(first && (first.name === "NotAllowedError" || first.name === "SecurityError")) throw first; stream = await navigator.mediaDevices.getUserMedia({video:true, audio:false}); }
        const video = $("camVideo");
        if(!video){ stream.getTracks().forEach((t) => t.stop()); return; }
        feat.cam.stream = stream;
        video.srcObject = stream;
        await video.play().catch(() => {});
        const track = stream.getVideoTracks()[0];
        const settings = track && track.getSettings ? track.getSettings() : {};
        if(settings.facingMode === "user") video.classList.add("mirror"); else if(settings.facingMode) video.classList.remove("mirror");
        if($("camMsg")) $("camMsg").textContent = "準備ができたら「撮影」を押してください。";
        if($("camSnap")) $("camSnap").disabled = false;
        if($("camFlip")) $("camFlip").disabled = false;
    }catch(error){
        stopCamera();
        const denied = error && (error.name === "NotAllowedError" || error.name === "SecurityError");
        const none = error && (error.name === "NotFoundError" || error.name === "OverconstrainedError");
        const reason = denied ? "カメラの利用が許可されていません。ブラウザのアドレスバー付近の設定でカメラを「許可」にするか、下のボタンで端末のカメラを使ってください。"
            : none ? "カメラが見つかりませんでした。" : "カメラを起動できませんでした（ほかのアプリが使用中の可能性があります）。";
        if($("camMsg")) $("camMsg").textContent = reason;
        const row = document.querySelector("#profileSheet .row");
        if(row) row.insertAdjacentHTML("afterbegin", '<button type="button" class="button" data-t="cam:fallback">📱 端末のカメラ／ファイルで撮る</button>');
    }
}

/** ブラウザ内カメラが使えないとき：スマホでは標準カメラアプリが開く（capture）。パソコンではファイル選択になる */
function captureFallback(){
    stopCamera();
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; input.setAttribute("capture", feat.cam.facing === "user" ? "user" : "environment");
    input.style.display = "none";
    input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        input.remove();
        if(file){ closeSheet(); callPhotoCallback([file]); }
    });
    document.body.appendChild(input);
    input.click();
}

function snapPhoto(){
    const video = $("camVideo");
    if(!video || !video.videoWidth){ showToast("カメラの準備ができていません。少し待ってからもう一度押してください。"); return; }
    const w = video.videoWidth, h = video.videoHeight;
    const scale = Math.min(1, 1920 / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
        if(!blob){ showToast("写真を保存できませんでした。もう一度お試しください。"); return; }
        stopCamera();
        const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
        feat.cam.file = new File([blob], "photo-" + stamp + ".jpg", {type:"image/jpeg"});
        if(feat.cam.url) URL.revokeObjectURL(feat.cam.url);
        feat.cam.url = URL.createObjectURL(blob);
        const canEdit = !!(feat.cam.opts && feat.cam.opts.allowEdit !== false) && typeof loadEditImage === "function";
        openSheet(toolHead("📸 この写真でいいですか？") + '<img class="cam-shot" id="camShot" alt="撮影した写真" src="' + feat.cam.url + '">' +
            '<div class="row"><button type="button" class="button-secondary" data-t="cam:again">🔄 撮り直す</button>' +
            (canEdit ? '<button type="button" class="button-secondary" data-t="cam:edit">🎨 編集する</button>' : "") +
            '<button type="button" class="button" data-t="cam:use">✅ 使う</button></div>');
    }, "image/jpeg", 0.9);
}

function usePhoto(edit){
    const file = feat.cam.file;
    if(!file) return;
    feat.cam.file = null;
    if(edit){
        openImgEdit();
        loadEditImage(file);
        return;
    }
    closeSheet();
    callPhotoCallback([file]);
}
