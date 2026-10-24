"use strict";
// ===== お絵かき（手書きを画像で送る）と、自分の画像から作るスタンプ =====
// ・お絵かき：指・マウス・ペンで描いて、PNG画像としてチャットに送ります（サーバーに残るのは送った画像だけ）。
// ・自作スタンプ：写真を丸や四角に切り抜き、白っぽい背景を透明にして、この端末に最大12個まで保存。押すと画像として送ります。
// ・どちらも、外部サービスや有料APIは使いません（ブラウザのキャンバスだけ）。

const DR_COLORS = ["#111111", "#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa", "#ffffff"];
const dr = {c:null, ctx:null, color:"#111111", size:6, erase:false, down:false, last:null, undo:[], moved:false};
const STAMP_MAX = 12, STAMP_PX = 256;
const stp = {list:[], src:null, shape:"circle", zoom:1, ox:0, oy:0, bg:false, thr:40, pre:null};

// ---------- お絵かき ----------
function openDraw(){
    if(!state.currentRoom){ showToast("先にチャットを開いてください。"); return; }
    openSheet(toolHead("✏️ お絵かき", "描いた絵を、画像としてこのチャットに送れます") +
        '<canvas id="drCanvas" width="640" height="640" style="width:100%;aspect-ratio:1/1;background:#fff;border-radius:12px;touch-action:none;border:1px solid var(--line)" aria-label="お絵かきのキャンバス"></canvas>' +
        '<div class="row" style="justify-content:flex-start" id="drColors">' + DR_COLORS.map((c) => '<button type="button" data-t="draw:color" data-c="' + c + '" aria-label="色 ' + c + '" style="width:30px;height:30px;border-radius:50%;background:' + c + ';border:2px solid var(--line);padding:0"></button>').join("") +
        '<input type="color" id="drPick" data-t="draw:pick" value="#111111" aria-label="好きな色" style="width:36px;height:30px;padding:0;border:0;background:none"></div>' +
        '<div class="row" style="justify-content:flex-start;align-items:center"><label for="drSize" style="margin:0">太さ</label><input type="range" id="drSize" data-t="draw:size" min="2" max="40" value="6" style="flex:1"></div>' +
        '<div class="row" style="justify-content:flex-start"><button type="button" class="button-secondary" data-t="draw:pen" id="drPen" aria-pressed="true">🖊 ペン</button><button type="button" class="button-secondary" data-t="draw:eraser" id="drEraser" aria-pressed="false">🩹 消しゴム</button>' +
        '<button type="button" class="button-secondary" data-t="draw:undo">↶ 戻す</button><button type="button" class="button-secondary" data-t="draw:clear">全部消す</button></div>' +
        '<div class="row"><button type="button" data-t="draw:send">この絵を送る</button>' + '<button type="button" class="button-secondary" data-pm="close">閉じる</button></div>');
    const c = document.getElementById("drCanvas");
    dr.c = c; dr.ctx = c.getContext("2d"); dr.undo = []; dr.erase = false; dr.color = "#111111"; dr.size = 6; dr.moved = false;
    dr.ctx.fillStyle = "#fff"; dr.ctx.fillRect(0, 0, c.width, c.height);
    dr.ctx.lineCap = "round"; dr.ctx.lineJoin = "round";
    c.addEventListener("pointerdown", drDown); c.addEventListener("pointermove", drMove);
    ["pointerup", "pointercancel", "pointerleave"].forEach((t) => c.addEventListener(t, drUp));
}
function drPos(e){
    const r = dr.c.getBoundingClientRect();
    return {x:(e.clientX - r.left) * dr.c.width / r.width, y:(e.clientY - r.top) * dr.c.height / r.height};
}
function drSnap(){ try{ dr.undo.push(dr.ctx.getImageData(0, 0, dr.c.width, dr.c.height)); if(dr.undo.length > 25) dr.undo.shift(); }catch(_e){} }
function drDown(e){
    e.preventDefault();
    try{ dr.c.setPointerCapture(e.pointerId); }catch(_e){}
    drSnap();
    dr.down = true; dr.moved = true;
    const p = drPos(e); dr.last = p;
    dr.ctx.globalCompositeOperation = "source-over";
    dr.ctx.strokeStyle = dr.erase ? "#ffffff" : dr.color; dr.ctx.fillStyle = dr.ctx.strokeStyle;
    dr.ctx.lineWidth = dr.size * (dr.c.width / 320);
    dr.ctx.beginPath(); dr.ctx.arc(p.x, p.y, dr.ctx.lineWidth / 2, 0, Math.PI * 2); dr.ctx.fill();
}
function drMove(e){
    if(!dr.down) return;
    e.preventDefault();
    const p = drPos(e);
    dr.ctx.beginPath(); dr.ctx.moveTo(dr.last.x, dr.last.y); dr.ctx.lineTo(p.x, p.y); dr.ctx.stroke();
    dr.last = p;
}
function drUp(){ dr.down = false; dr.last = null; }

function drPaintTools(){
    const pen = document.getElementById("drPen"), er = document.getElementById("drEraser");
    if(pen) pen.setAttribute("aria-pressed", String(!dr.erase));
    if(er) er.setAttribute("aria-pressed", String(dr.erase));
    if(pen) pen.style.outline = dr.erase ? "" : "2px solid var(--accent)";
    if(er) er.style.outline = dr.erase ? "2px solid var(--accent)" : "";
}

async function onDrawAction(action, node){
    if(action === "color"){ dr.color = node.dataset.c; dr.erase = false; const p = document.getElementById("drPick"); if(p) p.value = dr.color; drPaintTools(); }
    else if(action === "pick"){ dr.color = node.value; dr.erase = false; drPaintTools(); }
    else if(action === "size"){ dr.size = Number(node.value) || 6; }
    else if(action === "pen"){ dr.erase = false; drPaintTools(); }
    else if(action === "eraser"){ dr.erase = true; drPaintTools(); }
    else if(action === "undo"){ const s = dr.undo.pop(); if(s) dr.ctx.putImageData(s, 0, 0); }
    else if(action === "clear"){ drSnap(); dr.ctx.fillStyle = "#fff"; dr.ctx.fillRect(0, 0, dr.c.width, dr.c.height); }
    else if(action === "send"){
        if(!dr.moved){ showToast("先に何か描いてください。"); return; }
        const blob = await new Promise((res) => dr.c.toBlob(res, "image/png"));
        if(!blob){ showToast("画像にできませんでした。"); return; }
        const file = new File([blob], "お絵かき-" + Date.now() + ".png", {type:"image/png"});
        closeSheet();
        await handleFiles([file], "image");
    }
}

// ---------- 自作スタンプ ----------
function stpKey(){ return "are_mystamps_" + (state.user ? state.user.id : "x"); }
function stpLoad(){ try{ const v = JSON.parse(localStorage.getItem(stpKey()) || "[]"); stp.list = Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.startsWith("data:image/png")).slice(0, STAMP_MAX) : []; }catch(_e){ stp.list = []; } }
function stpSave(){ try{ localStorage.setItem(stpKey(), JSON.stringify(stp.list)); return true; }catch(_e){ showToast("この端末の保存容量がいっぱいで、保存できませんでした。"); return false; } }

function initMyStamp(){
    registerTool("stamp", onStampAction);
    stpLoad();
    const tools = document.querySelector(".composer-tools");
    if(!tools) throw new Error("入力欄のボタン置き場が見つかりません。");
    const b = document.createElement("button");
    b.type = "button"; b.className = "tool-button"; b.id = "myStampButton"; b.setAttribute("data-needs-room", ""); b.setAttribute("data-feature", "mystamp");
    b.textContent = "🖼️ 自作スタンプ"; b.disabled = !state.currentRoom;
    b.addEventListener("click", () => runTool(openMyStamps));
    tools.appendChild(b);
}

function openMyStamps(){
    stp.src = null;
    openSheet(toolHead("🖼️ 自作スタンプ", "押すと、このチャットに大きめの画像として送ります（最大" + STAMP_MAX + "個。この端末に保存）") +
        '<div class="stp-grid">' + (stp.list.length ? stp.list.map((u, i) => '<div class="stp-item"><button type="button" data-t="stamp:send" data-i="' + i + '" aria-label="スタンプ' + (i + 1) + 'を送る"><img src="' + u + '" alt=""></button><button type="button" class="button-secondary" data-t="stamp:del" data-i="' + i + '" aria-label="削除">🗑</button></div>').join("") : '<div class="meta">まだありません。下の「写真からつくる」で追加します。</div>') + '</div>' +
        '<div class="row"><label class="button" style="cursor:pointer;padding:9px 14px;border-radius:10px">📷 写真からつくる<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-t="stamp:pick" hidden></label><button type="button" class="button-secondary" data-pm="close">閉じる</button></div>');
}

async function stpLoadImage(file){
    if(!file || !/^image\/(png|jpeg|webp|gif)$/.test(file.type)){ showToast("PNG・JPEG・WebP・GIFの画像を選んでください。"); return; }
    if(file.size > 10 * 1024 * 1024){ showToast("画像は10MB以下にしてください。"); return; }
    stp.src = await createImageBitmap(file);
    stp.zoom = 1; stp.ox = 0; stp.oy = 0; stp.shape = "circle"; stp.bg = false; stp.thr = 40;
    openSheet(toolHead("🖼️ スタンプをつくる", "形・大きさ・位置を決めて保存します") +
        '<canvas id="stpCanvas" width="' + STAMP_PX + '" height="' + STAMP_PX + '" style="width:240px;height:240px;align-self:center;border-radius:12px;border:1px solid var(--line);background:repeating-conic-gradient(#ccc 0 25%,#fff 0 50%) 0 0/16px 16px"></canvas>' +
        '<div class="row" style="justify-content:center">' + [["circle", "● 丸"], ["round", "▢ 角丸"], ["none", "そのまま"]].map((s) => '<button type="button" class="button-secondary" data-t="stamp:shape" data-v="' + s[0] + '" id="stpShape_' + s[0] + '">' + s[1] + '</button>').join("") + '</div>' +
        '<label for="stpZoom">大きさ</label><input type="range" id="stpZoom" data-t="stamp:zoom" min="1" max="3" step="0.05" value="1">' +
        '<label for="stpX">横の位置</label><input type="range" id="stpX" data-t="stamp:ox" min="-100" max="100" value="0">' +
        '<label for="stpY">縦の位置</label><input type="range" id="stpY" data-t="stamp:oy" min="-100" max="100" value="0">' +
        '<label class="row" style="gap:8px;justify-content:flex-start"><input type="checkbox" data-t="stamp:bg"> 白っぽい背景を透明にする</label>' +
        '<label for="stpThr">背景を消す強さ</label><input type="range" id="stpThr" data-t="stamp:thr" min="5" max="120" value="40">' +
        '<div class="row"><button type="button" data-t="stamp:save">保存する</button><button type="button" class="button-secondary" data-t="stamp:list">もどる</button></div>');
    stpDraw(); stpShapeMark();
}

/** data:URL → Blob（fetch は通信の許可設定に引っかかるので使わない） */
function stpToBlob(url){
    const m = /^data:([^;,]+);base64,(.*)$/.exec(url);
    if(!m) throw new Error("スタンプの画像が壊れています。");
    const bin = atob(m[2]), arr = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], {type:m[1]});
}

function stpShapeMark(){ ["circle", "round", "none"].forEach((s) => { const b = document.getElementById("stpShape_" + s); if(b) b.style.outline = stp.shape === s ? "2px solid var(--accent)" : ""; }); }

function stpDraw(){
    const c = document.getElementById("stpCanvas"); if(!c || !stp.src) return;
    const ctx = c.getContext("2d"), S = STAMP_PX, img = stp.src;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    if(stp.shape === "circle") ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    else if(stp.shape === "round"){ const r = S * 0.2; ctx.moveTo(r, 0); ctx.arcTo(S, 0, S, S, r); ctx.arcTo(S, S, 0, S, r); ctx.arcTo(0, S, 0, 0, r); ctx.arcTo(0, 0, S, 0, r); ctx.closePath(); }
    else ctx.rect(0, 0, S, S);
    ctx.clip();
    const base = stp.shape === "none" ? Math.min(S / img.width, S / img.height) : Math.max(S / img.width, S / img.height);
    const sc = base * stp.zoom, w = img.width * sc, h = img.height * sc;
    ctx.drawImage(img, (S - w) / 2 + stp.ox * S / 200 * stp.zoom, (S - h) / 2 + stp.oy * S / 200 * stp.zoom, w, h);
    ctx.restore();
    if(stp.bg){
        const d = ctx.getImageData(0, 0, S, S), px = d.data, t = 255 - stp.thr;
        for(let i = 0; i < px.length; i += 4){ if(px[i] >= t && px[i + 1] >= t && px[i + 2] >= t) px[i + 3] = 0; }
        ctx.putImageData(d, 0, 0);
    }
}

async function onStampAction(action, node){
    if(action === "pick"){ const f = node.files && node.files[0]; node.value = ""; await stpLoadImage(f); }
    else if(action === "shape"){ stp.shape = node.dataset.v; stpShapeMark(); stpDraw(); }
    else if(action === "zoom"){ stp.zoom = Number(node.value) || 1; stpDraw(); }
    else if(action === "ox"){ stp.ox = Number(node.value) || 0; stpDraw(); }
    else if(action === "oy"){ stp.oy = Number(node.value) || 0; stpDraw(); }
    else if(action === "bg"){ stp.bg = !!node.checked; stpDraw(); }
    else if(action === "thr"){ stp.thr = Number(node.value) || 40; stpDraw(); }
    else if(action === "list"){ openMyStamps(); }
    else if(action === "save"){
        if(stp.list.length >= STAMP_MAX){ showToast("スタンプは" + STAMP_MAX + "個までです。いらないものを消してください。"); return; }
        const c = document.getElementById("stpCanvas"); if(!c) return;
        stp.list.push(c.toDataURL("image/png"));
        if(!stpSave()){ stp.list.pop(); return; }
        showToast("スタンプを保存しました。"); openMyStamps();
    }else if(action === "del"){ stp.list.splice(Number(node.dataset.i), 1); stpSave(); openMyStamps(); }
    else if(action === "send"){
        if(!state.currentRoom){ showToast("先にチャットを開いてください。"); return; }
        const url = stp.list[Number(node.dataset.i)]; if(!url) return;
        const blob = stpToBlob(url);
        const file = new File([blob], "stamp.png", {type:"image/png"});
        closeSheet();
        feat.pendingStamp = true;
        try{ await uploadAndSend(file, "image"); }finally{ feat.pendingStamp = false; }
    }
}

function initDraw(){
    registerTool("draw", onDrawAction);
    registerTool("stamp", onStampAction);
}
