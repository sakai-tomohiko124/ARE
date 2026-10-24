"use strict";
// ===== 画像編集（端末の中だけで処理。回転・反転・切り抜き（ドラッグで範囲指定）・明るさ・コントラスト・白黒・文字入れ）=====

feat.ie = null;

const IE_ASPECTS = {free:null, "1:1":[1, 1], "4:3":[4, 3], "3:4":[3, 4], "16:9":[16, 9], "9:16":[9, 16]};
const IE_COLORS = {white:"#ffffff", black:"#000000", yellow:"#ffe14d", red:"#ff4d4d"};
const IE_MIN_CROP = 0.06;

function initImgEdit(){ registerTool("ie", onImgEditAction); }

function openImgEdit(){
    feat.ie = null;
    openSheet(toolHead("🎨 画像編集", "画像は端末の中で加工します。送信するまで外には出ません。") +
        '<div class="row" style="justify-content:flex-start"><label class="tool-button">🖼️ 画像を選ぶ<input class="file-input" id="ieFile" type="file" accept="image/*" data-t="ie:file"></label>' +
        '<button type="button" class="tool-button" data-t="ie:camera">📸 写真を撮る</button></div>' +
        '<div id="ieBody"></div>' + toolClose());
}

function onImgEditAction(action, node){
    const s = feat.ie;
    if(action === "file"){ const file = node.files && node.files[0]; if(file) loadEditImage(file); return; }
    if(action === "camera"){ return openPhotoChooser({multiple:false, allowEdit:false, onFiles:(files) => { openImgEdit(); loadEditImage(files[0]); }}); }
    if(!s) return;
    if(action === "rotl"){ if(s.crop) cropCancel(); s.rot = (s.rot + 3) % 4; }
    else if(action === "rotr"){ if(s.crop) cropCancel(); s.rot = (s.rot + 1) % 4; }
    else if(action === "flip"){ if(s.crop) cropCancel(); s.flip = !s.flip; }
    else if(action === "crop"){ return cropStart(); }
    else if(action === "cropok"){ return cropCommit(); }
    else if(action === "cropno"){ return cropCancel(); }
    else if(action === "aspect"){ s.aspect = IE_ASPECTS[node.value] || null; return cropSetAspect(); }
    else if(action === "undo"){ return undoEdit(); }
    else if(action === "b"){ s.bright = Number(node.value); }
    else if(action === "c"){ s.contrast = Number(node.value); }
    else if(action === "gray"){ s.gray = node.checked; }
    else if(action === "filter"){ s.filter = node.value; }
    else if(action === "text"){ s.text = node.value.slice(0, 40); }
    else if(action === "tpos"){ s.tpos = node.value; }
    else if(action === "tcolor"){ s.tcolor = node.value; }
    else if(action === "reset"){ resetEdit(); return; }
    else if(action === "send"){ return sendEdited(node); }
    else if(action === "save"){ return saveEdited(); }
    renderEdit();
    if(action === "rotl" || action === "rotr" || action === "flip") paintCropBar();
}

function loadEditImage(file){
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
        const src = document.createElement("canvas");
        src.width = Math.max(1, Math.round(img.width * scale)); src.height = Math.max(1, Math.round(img.height * scale));
        src.getContext("2d").drawImage(img, 0, 0, src.width, src.height);
        feat.ie = {src, orig:src, rot:0, flip:false, aspect:null, bright:0, contrast:0, gray:false, filter:"none", text:"", tpos:"bottom", tcolor:"white", name:file.name, crop:null, history:[]};
        paintEditControls();
        renderEdit();
    };
    img.onerror = () => { URL.revokeObjectURL(url); showToast("この画像は読み込めません。JPEG・PNG・WebP・GIFを選んでください。"); };
    img.src = url;
}

function resetEdit(){
    const s = feat.ie;
    Object.assign(s, {src:s.orig, rot:0, flip:false, aspect:null, bright:0, contrast:0, gray:false, filter:"none", text:"", crop:null, history:[]});
    paintEditControls();
    renderEdit();
}

function paintEditControls(){
    const box = $("ieBody");
    if(!box || !feat.ie) return;
    const s = feat.ie;
    box.innerHTML = '<div class="ie-wrap" id="ieWrap"><canvas id="ieCanvas" class="ie-canvas"></canvas><div class="ie-crop" id="ieCrop" hidden>' +
        ["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((h) => '<i class="ie-h ie-h-' + h + '" data-h="' + h + '"></i>').join("") + '</div></div>' +
        '<div class="row" style="justify-content:flex-start"><button type="button" class="button-secondary" data-t="ie:rotl">⟲ 左回転</button><button type="button" class="button-secondary" data-t="ie:rotr">⟳ 右回転</button><button type="button" class="button-secondary" data-t="ie:flip">⇋ 左右反転</button></div>' +
        '<div id="ieCropBar" class="row" style="justify-content:flex-start;align-items:center"></div>' +
        '<label>明るさ <input type="range" min="-50" max="50" value="' + s.bright + '" data-t="ie:b"></label>' +
        '<label>コントラスト <input type="range" min="-50" max="50" value="' + s.contrast + '" data-t="ie:c"></label>' +
        '<label>フィルター <select class="status-select" data-t="ie:filter" aria-label="フィルター">' + IE_FILTERS.map((f) => '<option value="' + f[0] + '"' + ((s.filter || "none") === f[0] ? " selected" : "") + '>' + f[1] + '</option>').join("") + '</select></label>' +
        '<label><input type="checkbox" data-t="ie:gray"' + (s.gray ? " checked" : "") + '> 白黒にする</label>' +
        '<label>文字を入れる（40文字まで）<input type="text" maxlength="40" data-live="1" data-t="ie:text" value="' + escapeHtml(s.text) + '"></label>' +
        '<div class="row" style="justify-content:flex-start"><select class="status-select" data-t="ie:tpos" aria-label="文字の位置"><option value="top">上</option><option value="center">中央</option><option value="bottom" selected>下</option></select>' +
        '<select class="status-select" data-t="ie:tcolor" aria-label="文字の色"><option value="white">白</option><option value="black">黒</option><option value="yellow">黄</option><option value="red">赤</option></select></div>' +
        '<div class="row"><button type="button" class="button-secondary" data-t="ie:reset">最初に戻す</button><button type="button" class="button-secondary" data-t="ie:save">端末に保存</button><button type="button" class="button" data-t="ie:send"' + (state.currentRoom ? "" : " disabled") + '>このチャットに送る</button></div>' +
        (state.currentRoom ? "" : '<div class="meta">チャットに送るには、先にチャットを開いてください（「端末に保存」はいつでも使えます）。</div>');
    paintCropBar();
    bindCropDrag();
}

/** 回転・反転を反映した、加工前の画像（切り抜きの基準になる） */
function transformedCanvas(s){
    const sw = s.src.width, sh = s.src.height, odd = s.rot % 2 === 1;
    const w = odd ? sh : sw, h = odd ? sw : sh;
    const tmp = document.createElement("canvas");
    tmp.width = w; tmp.height = h;
    const t = tmp.getContext("2d");
    t.translate(w / 2, h / 2); t.rotate(s.rot * Math.PI / 2);
    if(s.flip) t.scale(-1, 1);
    t.drawImage(s.src, -sw / 2, -sh / 2);
    return tmp;
}

function renderEdit(){
    const s = feat.ie, canvas = $("ieCanvas");
    if(!s || !canvas) return;
    const tmp = transformedCanvas(s), cw = tmp.width, ch = tmp.height;
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(tmp, 0, 0);
    if(s.bright || s.contrast || s.gray || (s.filter && s.filter !== "none")){
        const data = ctx.getImageData(0, 0, cw, ch), px = data.data;
        const c = s.contrast * 2.55, f = (259 * (c + 255)) / (255 * (259 - c)), add = s.bright * 2.55;
        for(let i = 0; i < px.length; i += 4){
            let r = px[i], g = px[i + 1], b = px[i + 2];
            if(s.gray){ r = g = b = 0.299 * r + 0.587 * g + 0.114 * b; }
            if(s.filter && s.filter !== "none"){ const o = ieApplyFilter(s.filter, r, g, b); r = o[0]; g = o[1]; b = o[2]; }
            px[i] = Math.max(0, Math.min(255, f * (r - 128) + 128 + add));
            px[i + 1] = Math.max(0, Math.min(255, f * (g - 128) + 128 + add));
            px[i + 2] = Math.max(0, Math.min(255, f * (b - 128) + 128 + add));
        }
        ctx.putImageData(data, 0, 0);
    }
    if(s.text){
        const size = Math.max(12, Math.round(ch / 10));
        ctx.font = "700 " + size + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(2, size / 8); ctx.lineJoin = "round";
        ctx.strokeStyle = s.tcolor === "black" ? "#ffffff" : "#000000"; ctx.fillStyle = IE_COLORS[s.tcolor] || "#ffffff";
        const y = s.tpos === "top" ? size : s.tpos === "center" ? ch / 2 : ch - size;
        ctx.strokeText(s.text, cw / 2, y, cw * 0.92); ctx.fillText(s.text, cw / 2, y, cw * 0.92);
    }
    paintCropBox();
}

// ----- 切り抜き（ドラッグで範囲を決める。スマホは指、パソコンはマウス）-----

function paintCropBar(){
    const bar = $("ieCropBar"), s = feat.ie;
    if(!bar || !s) return;
    if(!s.crop){
        bar.innerHTML = '<button type="button" class="button-secondary" data-t="ie:crop">✂️ 切り抜く</button>' +
            (s.history.length ? '<button type="button" class="button-secondary" data-t="ie:undo">↶ 切り抜きを1つ戻す</button>' : "");
        return;
    }
    const keys = Object.keys(IE_ASPECTS), current = keys.find((k) => IE_ASPECTS[k] === s.aspect) || "free";
    bar.innerHTML = '<label style="display:inline-flex;gap:6px;align-items:center">比率<select class="status-select" data-t="ie:aspect" aria-label="切り抜きの比率">' +
        keys.map((k) => '<option value="' + k + '"' + (k === current ? " selected" : "") + '>' + (k === "free" ? "自由" : k) + '</option>').join("") + '</select></label>' +
        '<button type="button" class="button" data-t="ie:cropok">✅ 切り抜きを確定</button><button type="button" class="button-secondary" data-t="ie:cropno">✖ やめる</button>' +
        '<div class="meta" style="flex-basis:100%">枠をドラッグで移動、四隅・辺をドラッグで大きさを変えます。</div>';
}

function cropStart(){
    const s = feat.ie;
    if(!s) return;
    s.crop = {x:0.1, y:0.1, w:0.8, h:0.8};
    cropSetAspect();
    paintCropBar();
}

function cropSetAspect(){
    const s = feat.ie;
    if(!s || !s.crop) return;
    if(s.aspect){
        const tmp = transformedCanvas(s), W = tmp.width, H = tmp.height, r = s.aspect[0] / s.aspect[1];
        let w = Math.min(0.9, 0.9 * H * r / W), h = w * W / (r * H);
        if(h > 0.9){ h = 0.9; w = h * r * H / W; }
        s.crop = {x:(1 - w) / 2, y:(1 - h) / 2, w, h};
    }
    paintCropBar();
    paintCropBox();
}

function cropCancel(){
    const s = feat.ie;
    if(!s) return;
    s.crop = null; s.aspect = null;
    paintCropBar(); paintCropBox();
}

function cropCommit(){
    const s = feat.ie;
    if(!s || !s.crop) return;
    const tmp = transformedCanvas(s), W = tmp.width, H = tmp.height, c = s.crop;
    const x = Math.round(c.x * W), y = Math.round(c.y * H), w = Math.max(1, Math.round(c.w * W)), h = Math.max(1, Math.round(c.h * H));
    const out = document.createElement("canvas");
    out.width = w; out.height = h;
    out.getContext("2d").drawImage(tmp, x, y, w, h, 0, 0, w, h);
    s.history.push({src:s.src, rot:s.rot, flip:s.flip});
    if(s.history.length > 8) s.history.shift();
    s.src = out; s.rot = 0; s.flip = false; s.crop = null; s.aspect = null;
    paintCropBar(); renderEdit();
}

function undoEdit(){
    const s = feat.ie;
    if(!s || !s.history.length) return;
    const back = s.history.pop();
    s.src = back.src; s.rot = back.rot; s.flip = back.flip; s.crop = null; s.aspect = null;
    paintCropBar(); renderEdit();
}

function paintCropBox(){
    const box = $("ieCrop"), s = feat.ie;
    if(!box) return;
    if(!s || !s.crop){ box.hidden = true; return; }
    const c = s.crop;
    box.hidden = false;
    box.style.left = (c.x * 100) + "%"; box.style.top = (c.y * 100) + "%";
    box.style.width = (c.w * 100) + "%"; box.style.height = (c.h * 100) + "%";
    box.classList.toggle("locked", !!s.aspect);
}

function bindCropDrag(){
    const box = $("ieCrop"), wrap = $("ieWrap");
    if(!box || !wrap) return;
    let drag = null;
    box.addEventListener("pointerdown", (event) => {
        const s = feat.ie;
        if(!s || !s.crop) return;
        const handle = event.target.closest("[data-h]");
        const rect = wrap.getBoundingClientRect();
        drag = {mode:handle ? handle.dataset.h : "move", rect, px:event.clientX, py:event.clientY, start:Object.assign({}, s.crop), id:event.pointerId};
        try{ box.setPointerCapture(event.pointerId); }catch(_e){}
        event.preventDefault();
    });
    box.addEventListener("pointermove", (event) => {
        const s = feat.ie;
        if(!drag || !s || !s.crop || event.pointerId !== drag.id) return;
        const dx = (event.clientX - drag.px) / drag.rect.width, dy = (event.clientY - drag.py) / drag.rect.height;
        s.crop = cropDrag(drag, dx, dy, s);
        paintCropBox();
    });
    const end = (event) => { if(drag && event.pointerId === drag.id) drag = null; };
    box.addEventListener("pointerup", end);
    box.addEventListener("pointercancel", end);
}

function cropDrag(drag, dx, dy, s){
    const o = drag.start, m = drag.mode, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    if(m === "move") return {x:clamp(o.x + dx, 0, 1 - o.w), y:clamp(o.y + dy, 0, 1 - o.h), w:o.w, h:o.h};
    let left = o.x, top = o.y, right = o.x + o.w, bottom = o.y + o.h;
    const corner = m.length === 2;
    if(s.aspect && corner){
        const tmp = transformedCanvas(s), r = s.aspect[0] / s.aspect[1], k = tmp.width / (r * tmp.height); // h = w * k
        const ax = m.includes("w") ? right : left, ay = m.includes("n") ? bottom : top;
        const mx = clamp((m.includes("w") ? left : right) + dx, 0, 1);
        const sx = mx >= ax ? 1 : -1;
        const maxW = sx > 0 ? 1 - ax : ax, sy = m.includes("n") ? -1 : 1, maxH = sy > 0 ? 1 - ay : ay;
        let w = clamp(Math.abs(mx - ax), IE_MIN_CROP, Math.min(maxW, maxH / k));
        const h = w * k;
        const nx = m.includes("w") ? ax - w : ax, ny = m.includes("n") ? ay - h : ay;
        return {x:nx, y:ny, w, h};
    }
    if(s.aspect) return o;
    if(m.includes("w")) left = clamp(o.x + dx, 0, right - IE_MIN_CROP);
    if(m.includes("e")) right = clamp(o.x + o.w + dx, left + IE_MIN_CROP, 1);
    if(m.includes("n")) top = clamp(o.y + dy, 0, bottom - IE_MIN_CROP);
    if(m.includes("s")) bottom = clamp(o.y + o.h + dy, top + IE_MIN_CROP, 1);
    return {x:left, y:top, w:right - left, h:bottom - top};
}

// ----- 書き出し -----

function editedBlob(){
    if(feat.ie && feat.ie.crop) cropCommit();
    return new Promise((resolve, reject) => {
        const canvas = $("ieCanvas");
        if(!canvas) { reject(new Error("画像を選んでください。")); return; }
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("画像を書き出せませんでした。")), "image/jpeg", 0.9);
    });
}

async function sendEdited(button){
    if(!state.currentRoom){ showToast("先にチャットを開いてください。"); return; }
    button.disabled = true;
    try{
        const blob = await editedBlob();
        const base = String(feat.ie.name || "edited").replace(/\.[^.]+$/, "").slice(0, 40) || "edited";
        const file = new File([blob], base + "-edit.jpg", {type:"image/jpeg"});
        closeSheet();
        await uploadAndSend(file, "image");
    }catch(error){ showToast(featError(error)); button.disabled = false; }
}

async function saveEdited(){
    const blob = await editedBlob();
    downloadBlob(blob, "ARE-edit-" + dayKey(new Date()) + ".jpg");
}

const IE_FILTERS = [["none", "なし"], ["sepia", "セピア"], ["vivid", "あざやか"], ["fade", "フェード"], ["warm", "あたたかい"], ["cool", "つめたい"], ["invert", "ネガ（反転）"], ["vintage", "ビンテージ"]];
function ieApplyFilter(name, r, g, b){
    const clamp = (v) => Math.max(0, Math.min(255, v));
    if(name === "sepia") return [clamp(0.393 * r + 0.769 * g + 0.189 * b), clamp(0.349 * r + 0.686 * g + 0.168 * b), clamp(0.272 * r + 0.534 * g + 0.131 * b)];
    if(name === "invert") return [255 - r, 255 - g, 255 - b];
    if(name === "warm") return [clamp(r * 1.1 + 10), g, clamp(b * 0.88)];
    if(name === "cool") return [clamp(r * 0.9), g, clamp(b * 1.12 + 10)];
    if(name === "fade") return [clamp(r * 0.8 + 45), clamp(g * 0.8 + 45), clamp(b * 0.8 + 50)];
    if(name === "vivid"){ const l = 0.299 * r + 0.587 * g + 0.114 * b; return [clamp(l + (r - l) * 1.5), clamp(l + (g - l) * 1.5), clamp(l + (b - l) * 1.5)]; }
    if(name === "vintage"){ const s = [clamp(0.393 * r + 0.769 * g + 0.189 * b), clamp(0.349 * r + 0.686 * g + 0.168 * b), clamp(0.272 * r + 0.534 * g + 0.131 * b)]; return [clamp(r * 0.4 + s[0] * 0.6 + 8), clamp(g * 0.4 + s[1] * 0.6), clamp(b * 0.4 + s[2] * 0.6 - 8)]; }
    return [r, g, b];
}
