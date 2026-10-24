"use strict";
// ===== アバター（無料・画像や顔の撮影は不要）=====
// ・自分だけのキャラクターを作れます（髪・目・アクセサリー・色）。画像として保存／チャットに送れます。
// ・「アバターでビデオ通話」をオンにすると、ビデオ通話のカメラ映像のかわりに、アバターが相手に映ります。
//   マイクの声の大きさに合わせて口が動き、まばたきもします。通話中は画面の左下のボタンで表情を変えられます。
//   （顔を映したくないとき・部屋を見せたくないときの代わりです。音声はそのまま届きます）
// ・ライブ配信（大人数に配る機能）は、無料の範囲では作れません。1対1のビデオ通話での代わりとして使えます。
// ・設定はこの端末のブラウザに保存します。

const AV_SKIN = ["#ffe0c8", "#ffd1a8", "#f0b98d", "#c68a5e", "#8d5a3b"];
const AV_HAIRC = ["#2b1d14", "#5a3a22", "#a5642b", "#e0b34a", "#d9d9e0", "#3a5bd9", "#d94a7a", "#2fa36b"];
const AV_BG = ["#2d3a6b", "#40306b", "#1f5b5b", "#6b3030", "#3b3b3b", "#2b5a8a"];
const AV_SHIRT = ["#5b7cff", "#ff6b81", "#34c38f", "#f5a524", "#8b5cf6", "#eeeeee"];
const AV_STYLES = ["短め", "ロング", "ボブ", "つるつる", "ツンツン"];
const AV_EYES = ["ふつう", "おおきい", "やさしい"];
const AV_ACCS = ["なし", "めがね", "リボン", "ニット帽", "ヘッドホン", "ねこ耳"];
const AV_DEFAULT = {skin:1, hairC:0, style:0, eyes:0, acc:0, bg:0, shirt:0};

feat.av = {cfg:Object.assign({}, AV_DEFAULT), call:false, emo:"normal", level:0, stream:null, loop:null, mic:null, preview:null};

function avKey(){ return "are_avatar_" + (state.user ? state.user.id : "x"); }
function avLoad(){
    try{
        const d = JSON.parse(localStorage.getItem(avKey()) || "{}") || {};
        const c = Object.assign({}, AV_DEFAULT);
        Object.keys(AV_DEFAULT).forEach((k) => { if(Number.isInteger(d.cfg && d.cfg[k]) && d.cfg[k] >= 0) c[k] = d.cfg[k]; });
        c.skin = Math.min(c.skin, AV_SKIN.length - 1); c.hairC = Math.min(c.hairC, AV_HAIRC.length - 1); c.style = Math.min(c.style, AV_STYLES.length - 1);
        c.eyes = Math.min(c.eyes, AV_EYES.length - 1); c.acc = Math.min(c.acc, AV_ACCS.length - 1); c.bg = Math.min(c.bg, AV_BG.length - 1); c.shirt = Math.min(c.shirt, AV_SHIRT.length - 1);
        feat.av.cfg = c; feat.av.call = d.call === true;
    }catch(_e){ /* 初期値 */ }
}
function avSave(){ try{ localStorage.setItem(avKey(), JSON.stringify({cfg:feat.av.cfg, call:feat.av.call})); }catch(_e){ /* 無視 */ } }

// ---------- 描画 ----------
function avDraw(ctx, W, H, cfg, st){
    const skin = AV_SKIN[cfg.skin], hair = AV_HAIRC[cfg.hairC], t = st.t || 0, bob = Math.sin(t * 2.2) * (1.5 + (st.mouth || 0) * 4);
    const cx = W / 2, cy = H * 0.46 + bob, rx = W * 0.2, ry = H * 0.3;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, AV_BG[cfg.bg]); g.addColorStop(1, "#0b1020");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save();
    // 体・首
    ctx.fillStyle = AV_SHIRT[cfg.shirt]; ctx.beginPath(); ctx.ellipse(cx, H * 1.02 + bob * 0.4, W * 0.34, H * 0.22, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = skin; ctx.fillRect(cx - rx * 0.28, cy + ry * 0.75, rx * 0.56, ry * 0.5);
    // 後ろ髪
    ctx.fillStyle = hair;
    if(cfg.style === 1){ ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.35, rx * 1.18, ry * 1.18, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(cx - rx * 1.18, cy, rx * 2.36, ry * 1.1); }
    if(cfg.style === 2){ ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.2, rx * 1.15, ry * 1.08, 0, 0, Math.PI * 2); ctx.fill(); }
    // ねこ耳・ヘッドホンの後ろ側
    if(cfg.acc === 5){ ctx.fillStyle = hair; [-1, 1].forEach((s) => { ctx.beginPath(); ctx.moveTo(cx + s * rx * 0.25, cy - ry * 0.85); ctx.lineTo(cx + s * rx * 0.95, cy - ry * 1.35); ctx.lineTo(cx + s * rx * 0.98, cy - ry * 0.45); ctx.fill(); }); }
    // 顔
    ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    [-1, 1].forEach((s) => { ctx.beginPath(); ctx.ellipse(cx + s * rx * 0.98, cy + ry * 0.05, rx * 0.12, ry * 0.16, 0, 0, Math.PI * 2); ctx.fill(); });
    // 前髪
    ctx.fillStyle = hair;
    if(cfg.style !== 3){
        ctx.beginPath(); ctx.ellipse(cx, cy - ry * 0.18, rx * 1.04, ry * 0.86, 0, Math.PI, 0); ctx.fill();
        if(cfg.style === 4){ for(let i = -3; i <= 3; i++){ ctx.beginPath(); ctx.moveTo(cx + i * rx * 0.3 - rx * 0.16, cy - ry * 0.85); ctx.lineTo(cx + i * rx * 0.3, cy - ry * 1.25); ctx.lineTo(cx + i * rx * 0.3 + rx * 0.16, cy - ry * 0.85); ctx.fill(); } }
        // 前髪のすき間（おでこ）
        ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(cx, cy - ry * 0.28, rx * 0.78, ry * 0.5, 0, 0, Math.PI); ctx.fill();
        ctx.fillStyle = hair; ctx.beginPath(); ctx.ellipse(cx - rx * 0.35, cy - ry * 0.55, rx * 0.5, ry * 0.3, -0.3, 0, Math.PI * 2); ctx.ellipse(cx + rx * 0.35, cy - ry * 0.55, rx * 0.5, ry * 0.3, 0.3, 0, Math.PI * 2); ctx.fill();
    }
    // 目
    const emo = st.emo || "normal", blink = st.blink || 0, eyeY = cy + ry * 0.02, ex = rx * 0.42;
    ctx.strokeStyle = "#2a1c14"; ctx.fillStyle = "#2a1c14"; ctx.lineWidth = Math.max(2, W * 0.007); ctx.lineCap = "round";
    [-1, 1].forEach((s) => {
        const x = cx + s * ex;
        if(emo === "happy" || cfg.eyes === 2 && emo === "normal"){ ctx.beginPath(); ctx.arc(x, eyeY + ry * 0.04, rx * 0.17, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
        else if(blink > 0.6){ ctx.beginPath(); ctx.moveTo(x - rx * 0.15, eyeY); ctx.lineTo(x + rx * 0.15, eyeY); ctx.stroke(); }
        else{
            const big = emo === "surprised" || cfg.eyes === 1, r = rx * (big ? 0.2 : 0.12);
            ctx.fillStyle = "#fff"; if(big){ ctx.beginPath(); ctx.ellipse(x, eyeY, r * 1.15, r * 1.3, 0, 0, Math.PI * 2); ctx.fill(); }
            ctx.fillStyle = "#2a1c14"; ctx.beginPath(); ctx.ellipse(x, eyeY, r * (big ? 0.7 : 1), r * (big ? 0.9 : 1.25), 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x - r * 0.25, eyeY - r * 0.35, r * 0.28, 0, Math.PI * 2); ctx.fill();
        }
        // まゆ
        ctx.strokeStyle = hair; ctx.lineWidth = Math.max(3, W * 0.009); ctx.beginPath();
        const by = eyeY - ry * 0.2 - (emo === "surprised" ? ry * 0.08 : 0);
        if(emo === "sad"){ ctx.moveTo(x - s * rx * 0.2, by - ry * 0.06); ctx.lineTo(x + s * rx * 0.2, by + ry * 0.04); }
        else{ ctx.moveTo(x - rx * 0.16, by); ctx.lineTo(x + rx * 0.16, by); }
        ctx.stroke(); ctx.strokeStyle = "#2a1c14"; ctx.lineWidth = Math.max(2, W * 0.007);
    });
    // ほっぺ
    ctx.fillStyle = "rgba(255,120,120,.28)"; [-1, 1].forEach((s) => { ctx.beginPath(); ctx.ellipse(cx + s * rx * 0.62, cy + ry * 0.3, rx * 0.16, ry * 0.08, 0, 0, Math.PI * 2); ctx.fill(); });
    // 口（声の大きさで開く）
    const m = Math.max(0, Math.min(1, st.mouth || 0)), my = cy + ry * 0.52;
    ctx.fillStyle = "#7a2a2a"; ctx.strokeStyle = "#7a2a2a";
    if(m > 0.08){ ctx.beginPath(); ctx.ellipse(cx, my + m * ry * 0.06, rx * (0.16 + m * 0.1), ry * (0.03 + m * 0.12), 0, 0, Math.PI * 2); ctx.fill(); }
    else{
        ctx.beginPath();
        if(emo === "happy"){ ctx.arc(cx, my - ry * 0.05, rx * 0.22, 0.1 * Math.PI, 0.9 * Math.PI); }
        else if(emo === "sad"){ ctx.arc(cx, my + ry * 0.12, rx * 0.16, 1.15 * Math.PI, 1.85 * Math.PI); }
        else if(emo === "surprised"){ ctx.ellipse(cx, my, rx * 0.07, ry * 0.07, 0, 0, Math.PI * 2); ctx.fill(); }
        else{ ctx.arc(cx, my - ry * 0.02, rx * 0.15, 0.15 * Math.PI, 0.85 * Math.PI); }
        if(emo !== "surprised") ctx.stroke();
    }
    // アクセサリー
    ctx.lineWidth = Math.max(3, W * 0.008);
    if(cfg.acc === 1){ ctx.strokeStyle = "#222"; [-1, 1].forEach((s) => { ctx.beginPath(); ctx.ellipse(cx + s * ex, eyeY, rx * 0.26, rx * 0.22, 0, 0, Math.PI * 2); ctx.stroke(); }); ctx.beginPath(); ctx.moveTo(cx - ex + rx * 0.26, eyeY); ctx.lineTo(cx + ex - rx * 0.26, eyeY); ctx.stroke(); }
    if(cfg.acc === 2){ ctx.fillStyle = "#ff5c8a"; const rxp = cx + rx * 0.7, ryp = cy - ry * 0.78; [-1, 1].forEach((s) => { ctx.beginPath(); ctx.moveTo(rxp, ryp); ctx.lineTo(rxp + s * rx * 0.4, ryp - ry * 0.18); ctx.lineTo(rxp + s * rx * 0.4, ryp + ry * 0.18); ctx.fill(); }); ctx.beginPath(); ctx.arc(rxp, ryp, rx * 0.07, 0, Math.PI * 2); ctx.fill(); }
    if(cfg.acc === 3){ ctx.fillStyle = "#e5484d"; ctx.beginPath(); ctx.ellipse(cx, cy - ry * 0.6, rx * 1.05, ry * 0.55, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(cx - rx * 1.05, cy - ry * 0.62, rx * 2.1, ry * 0.14); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, cy - ry * 1.16, rx * 0.12, 0, Math.PI * 2); ctx.fill(); }
    if(cfg.acc === 4){ ctx.strokeStyle = "#222"; ctx.lineWidth = Math.max(5, W * 0.014); ctx.beginPath(); ctx.arc(cx, cy - ry * 0.05, rx * 1.08, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); ctx.fillStyle = "#333"; [-1, 1].forEach((s) => { ctx.beginPath(); ctx.ellipse(cx + s * rx * 1.08, cy + ry * 0.05, rx * 0.15, ry * 0.22, 0, 0, Math.PI * 2); ctx.fill(); }); }
    ctx.restore();
}

// ---------- マイクの声の大きさ ----------
function avMicLevel(audioStream, state){
    try{
        const AC = window.AudioContext || window.webkitAudioContext;
        const ctx = new AC(), src = ctx.createMediaStreamSource(audioStream), an = ctx.createAnalyser();
        an.fftSize = 512; src.connect(an);
        const buf = new Uint8Array(an.fftSize);
        const tick = () => {
            an.getByteTimeDomainData(buf);
            let sum = 0; for(let i = 0; i < buf.length; i++){ const v = (buf[i] - 128) / 128; sum += v * v; }
            const rms = Math.sqrt(sum / buf.length);
            state.level = Math.min(1, rms * 6);
        };
        return {tick, close:() => { try{ ctx.close(); }catch(_e){ /* 無視 */ } }};
    }catch(_e){ return {tick:() => {}, close:() => {}}; }
}

/** アバター映像（canvas）＋マイク音声のストリームを作る。ビデオ通話のカメラのかわりに使う */
function avBuildStream(audioStream){
    const W = 480, H = 360, canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d"), st = {t:0, mouth:0, blink:0, emo:feat.av.emo, level:0};
    const mic = audioStream ? avMicLevel(audioStream, st) : {tick:() => {}, close:() => {}};
    const out = canvas.captureStream(24);
    if(audioStream) audioStream.getAudioTracks().forEach((t) => out.addTrack(t));
    let nextBlink = performance.now() + 2500, last = performance.now(), run = true;
    const frame = () => {
        if(!run) return;
        const vt = out.getVideoTracks()[0];
        if(!vt || vt.readyState === "ended"){ run = false; mic.close(); if(feat.av.stream === out) feat.av.stream = null; avHideEmoBar(); return; }
        const now = performance.now(), dt = (now - last) / 1000; last = now; st.t += dt;
        mic.tick();
        st.mouth += (Math.min(1, st.level * 1.4) - st.mouth) * 0.5;
        if(now > nextBlink){ st.blink = 1; if(now > nextBlink + 140){ st.blink = 0; nextBlink = now + 2000 + Math.random() * 3500; } }
        st.emo = feat.av.emo;
        avDraw(ctx, W, H, feat.av.cfg, st);
        setTimeout(frame, 1000 / 24);
    };
    frame();
    feat.av.stream = out; avShowEmoBar();
    return out;
}

function avShowEmoBar(){
    avHideEmoBar();
    const bar = document.createElement("div");
    bar.id = "avEmoBar"; bar.className = "av-emo";
    bar.innerHTML = [["normal", "😐"], ["happy", "😄"], ["surprised", "😲"], ["sad", "😢"]].map((e) => '<button type="button" data-emo="' + e[0] + '" aria-label="' + e[0] + '">' + e[1] + '</button>').join("");
    bar.addEventListener("click", (event) => { const b = event.target.closest("[data-emo]"); if(b) feat.av.emo = b.dataset.emo; });
    document.body.appendChild(bar);
}
function avHideEmoBar(){ const b = document.getElementById("avEmoBar"); if(b) b.remove(); feat.av.emo = "normal"; }

function initAvatar(){
    registerTool("av", onAvAction);
    avLoad();
    el.profileSheet.addEventListener("change", avOnChange);
    const md = navigator.mediaDevices;
    if(md && typeof md.getUserMedia === "function"){
        const orig = md.getUserMedia.bind(md);
        md.getUserMedia = async function(constraints){
            // 通話（マイクとカメラを同時に要求）で、アバターがオンのときだけ、カメラのかわりにアバターを使う
            if(feat.av.call && constraints && constraints.video && constraints.audio){
                let audio = null;
                try{ audio = await orig({audio:constraints.audio}); }catch(error){ throw error; }
                return avBuildStream(audio);
            }
            return orig(constraints);
        };
    }
}

// ---------- 作る画面 ----------
function openAvatar(){
    const a = feat.av;
    const opt = (list, cur) => list.map((n, i) => '<option value="' + i + '"' + (i === cur ? " selected" : "") + '>' + escapeHtml(n) + '</option>').join("");
    const sw = (key, list) => '<div class="av-sw">' + list.map((c, i) => '<button type="button" class="av-c' + (a.cfg[key] === i ? " on" : "") + '" style="background:' + c + '" data-t="av:set" data-k="' + key + '" data-v="' + i + '" aria-label="色' + (i + 1) + '"></button>').join("") + '</div>';
    openSheet(toolHead("🧑‍🎤 アバター", "自分だけのキャラクターを作れます。ビデオ通話でカメラのかわりに映すこともできます（無料）。") +
        '<canvas id="avCanvas" width="480" height="360" class="av-preview" aria-label="アバターのプレビュー"></canvas>' +
        '<div class="row" style="justify-content:center">' + [["normal", "😐"], ["happy", "😄"], ["surprised", "😲"], ["sad", "😢"]].map((e) => '<button type="button" class="button-secondary" data-t="av:emo" data-v="' + e[0] + '">' + e[1] + '</button>').join("") + '</div>' +
        '<label>髪型</label><select id="avStyle" class="status-select">' + opt(AV_STYLES, a.cfg.style) + '</select>' +
        '<label>髪の色</label>' + sw("hairC", AV_HAIRC) + '<label>肌の色</label>' + sw("skin", AV_SKIN) +
        '<label>目</label><select id="avEyes" class="status-select">' + opt(AV_EYES, a.cfg.eyes) + '</select>' +
        '<label>アクセサリー</label><select id="avAcc" class="status-select">' + opt(AV_ACCS, a.cfg.acc) + '</select>' +
        '<label>服の色</label>' + sw("shirt", AV_SHIRT) + '<label>背景の色</label>' + sw("bg", AV_BG) +
        '<hr class="sep"><label class="me-toggle"><input type="checkbox" id="avCall"' + (a.call ? " checked" : "") + '> アバターでビデオ通話（カメラのかわりに映す）<small>オンにすると、次のビデオ通話から、あなたのカメラのかわりにアバターが相手に映ります。声に合わせて口が動きます。</small></label>' +
        '<div class="row"><button type="button" class="button" data-t="av:send">チャットに画像で送る</button><button type="button" class="button-secondary" data-t="av:png">画像を保存</button></div>' + toolClose());
    avStartPreview();
}
function avOnChange(event){
    const t = event.target, a = feat.av;
    if(t.id === "avStyle") a.cfg.style = Number(t.value);
    else if(t.id === "avEyes") a.cfg.eyes = Number(t.value);
    else if(t.id === "avAcc") a.cfg.acc = Number(t.value);
    else if(t.id === "avCall"){ a.call = t.checked; if(a.call) showToast("次のビデオ通話から、カメラのかわりにアバターが映ります。"); }
    else return;
    avSave();
}
function avStartPreview(){
    const a = feat.av;
    if(a.preview) clearInterval(a.preview);
    const st = {t:0, mouth:0, blink:0, emo:"normal"};
    a.previewState = st;
    a.preview = setInterval(() => {
        const c = $("avCanvas");
        if(!c){ clearInterval(a.preview); a.preview = null; return; }
        st.t += 0.05; st.emo = a.emo === "normal" ? "normal" : a.emo; st.blink = (Math.floor(st.t * 20) % 70) < 2 ? 1 : 0;
        avDraw(c.getContext("2d"), c.width, c.height, a.cfg, st);
    }, 50);
}
async function onAvAction(action, node){
    const a = feat.av;
    try{
        if(action === "set"){ a.cfg[node.dataset.k] = Number(node.dataset.v); avSave(); node.parentElement.querySelectorAll(".av-c").forEach((b) => b.classList.toggle("on", b === node)); }
        else if(action === "emo"){ a.emo = node.dataset.v; }
        else if(action === "png" || action === "send"){
            const c = document.createElement("canvas"); c.width = 480; c.height = 360;
            avDraw(c.getContext("2d"), 480, 360, a.cfg, {t:0, mouth:0, blink:0, emo:a.emo});
            const blob = await new Promise((r) => c.toBlob(r, "image/png"));
            if(!blob) throw new Error("画像にできませんでした。");
            if(action === "png"){ const u = URL.createObjectURL(blob), l = document.createElement("a"); l.href = u; l.download = "avatar.png"; l.click(); setTimeout(() => URL.revokeObjectURL(u), 3000); return; }
            if(!state.currentRoom){ showToast("先にチャットを開いてください。"); return; }
            closeSheet();
            await handleFiles([new File([blob], "avatar-" + Date.now() + ".png", {type:"image/png"})], "image");
        }
    }catch(error){ showToast(featError(error)); }
}
