"use strict";
// ===== 画像編集（端末の中だけで処理。回転・反転・切り抜き・明るさ・コントラスト・白黒・文字入れ）=====

feat.ie = null;

const IE_ASPECTS = {free:null, "1:1":[1, 1], "4:3":[4, 3], "3:4":[3, 4], "16:9":[16, 9]};
const IE_COLORS = {white:"#ffffff", black:"#000000", yellow:"#ffe14d", red:"#ff4d4d"};

function initImgEdit(){ registerTool("ie", onImgEditAction); }

function openImgEdit(){
    feat.ie = null;
    openSheet(toolHead("🎨 画像編集", "画像は端末の中で加工します。送信するまで外には出ません。") +
        '<label class="tool-button">🖼️ 画像を選ぶ<input class="file-input" id="ieFile" type="file" accept="image/*" data-t="ie:file"></label>' +
        '<div id="ieBody"></div>' + toolClose());
}

function onImgEditAction(action, node){
    const s = feat.ie;
    if(action === "file"){ const file = node.files && node.files[0]; if(file) loadEditImage(file); return; }
    if(!s) return;
    if(action === "rotl"){ s.rot = (s.rot + 3) % 4; }
    else if(action === "rotr"){ s.rot = (s.rot + 1) % 4; }
    else if(action === "flip"){ s.flip = !s.flip; }
    else if(action === "aspect"){ s.aspect = IE_ASPECTS[node.value] || null; }
    else if(action === "b"){ s.bright = Number(node.value); }
    else if(action === "c"){ s.contrast = Number(node.value); }
    else if(action === "gray"){ s.gray = node.checked; }
    else if(action === "text"){ s.text = node.value.slice(0, 40); }
    else if(action === "tpos"){ s.tpos = node.value; }
    else if(action === "tcolor"){ s.tcolor = node.value; }
    else if(action === "reset"){ Object.assign(s, {rot:0, flip:false, aspect:null, bright:0, contrast:0, gray:false, text:""}); paintEditControls(); }
    else if(action === "send"){ return sendEdited(node); }
    else if(action === "save"){ return saveEdited(); }
    renderEdit();
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
        feat.ie = {src, rot:0, flip:false, aspect:null, bright:0, contrast:0, gray:false, text:"", tpos:"bottom", tcolor:"white", name:file.name};
        paintEditControls();
        renderEdit();
    };
    img.onerror = () => { URL.revokeObjectURL(url); showToast("この画像は読み込めません。JPEG・PNG・WebP・GIFを選んでください。"); };
    img.src = url;
}

function paintEditControls(){
    const box = $("ieBody");
    if(!box || !feat.ie) return;
    const s = feat.ie;
    box.innerHTML = '<canvas id="ieCanvas" class="ie-canvas"></canvas>' +
        '<div class="row" style="justify-content:flex-start"><button type="button" class="button-secondary" data-t="ie:rotl">⟲ 左回転</button><button type="button" class="button-secondary" data-t="ie:rotr">⟳ 右回転</button><button type="button" class="button-secondary" data-t="ie:flip">⇋ 左右反転</button></div>' +
        '<label>切り抜き（中央）<select id="ieAspect" data-t="ie:aspect" class="status-select">' + Object.keys(IE_ASPECTS).map((k) => '<option value="' + k + '">' + (k === "free" ? "そのまま" : k) + '</option>').join("") + '</select></label>' +
        '<label>明るさ <input type="range" min="-50" max="50" value="' + s.bright + '" data-t="ie:b"></label>' +
        '<label>コントラスト <input type="range" min="-50" max="50" value="' + s.contrast + '" data-t="ie:c"></label>' +
        '<label><input type="checkbox" data-t="ie:gray"' + (s.gray ? " checked" : "") + '> 白黒にする</label>' +
        '<label>文字を入れる（40文字まで）<input type="text" maxlength="40" data-live="1" data-t="ie:text" value="' + escapeHtml(s.text) + '"></label>' +
        '<div class="row" style="justify-content:flex-start"><select class="status-select" data-t="ie:tpos" aria-label="文字の位置"><option value="top">上</option><option value="center">中央</option><option value="bottom" selected>下</option></select>' +
        '<select class="status-select" data-t="ie:tcolor" aria-label="文字の色"><option value="white">白</option><option value="black">黒</option><option value="yellow">黄</option><option value="red">赤</option></select></div>' +
        '<div class="row"><button type="button" class="button-secondary" data-t="ie:reset">元に戻す</button><button type="button" class="button-secondary" data-t="ie:save">端末に保存</button><button type="button" class="button" data-t="ie:send"' + (state.currentRoom ? "" : " disabled") + '>このチャットに送る</button></div>' +
        (state.currentRoom ? "" : '<div class="meta">送信するには、先にチャットを開いてください。</div>');
}

function renderEdit(){
    const s = feat.ie, canvas = $("ieCanvas");
    if(!s || !canvas) return;
    const sw = s.src.width, sh = s.src.height, odd = s.rot % 2 === 1;
    const w = odd ? sh : sw, h = odd ? sw : sh;
    const tmp = document.createElement("canvas");
    tmp.width = w; tmp.height = h;
    const t = tmp.getContext("2d");
    t.translate(w / 2, h / 2); t.rotate(s.rot * Math.PI / 2);
    if(s.flip) t.scale(-1, 1);
    t.drawImage(s.src, -sw / 2, -sh / 2);
    let cw = w, ch = h;
    if(s.aspect){
        const ratio = s.aspect[0] / s.aspect[1];
        if(w / h > ratio) cw = Math.round(h * ratio); else ch = Math.round(w / ratio);
    }
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(tmp, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, cw, ch);
    if(s.bright || s.contrast || s.gray){
        const data = ctx.getImageData(0, 0, cw, ch), px = data.data;
        const c = s.contrast * 2.55, f = (259 * (c + 255)) / (255 * (259 - c)), add = s.bright * 2.55;
        for(let i = 0; i < px.length; i += 4){
            let r = px[i], g = px[i + 1], b = px[i + 2];
            if(s.gray){ r = g = b = 0.299 * r + 0.587 * g + 0.114 * b; }
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
}

function editedBlob(){
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
