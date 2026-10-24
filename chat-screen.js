"use strict";
// ===== 通話中の画面共有 =====
// ・ビデオ通話中に「🖥️ 画面を共有」を押すと、通話の映像を、カメラから「画面」に差し替えます（相手には画面が映ります）。
// ・やめる、または共有の停止（ブラウザの「共有を停止」）で、元のカメラ（またはアバター）に戻ります。
// ・パソコンのブラウザ（Chrome・Edge・Firefox・Safari）で使えます。スマホのブラウザは、画面共有そのものに対応していないことが多いです。
// ・音声だけの通話では使えません（映像の通り道がないため）。

const scr = {track:null, sender:null, orig:null, btn:null, timer:null};

function scrSupported(){ return !!(navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === "function"); }

/** いま通話で映像を送っている接続と、その映像の送り口を探す */
function scrFind(){
    const list = (window.__arePCs || []).filter((pc) => pc.signalingState !== "closed" && pc.connectionState !== "closed" && pc.connectionState !== "failed");
    for(const pc of list){
        const s = pc.getSenders().find((x) => x.track && x.track.kind === "video");
        if(s) return {pc, sender:s};
    }
    return null;
}

function initScreen(){
    registerTool("scr", onScreenAction);
    const b = document.createElement("button");
    b.type = "button"; b.id = "scrShare"; b.className = "scr-float"; b.hidden = true; b.setAttribute("data-feature", "screen");
    b.addEventListener("click", () => runTool(scrToggle));
    document.body.appendChild(b);
    scr.btn = b;
    scr.timer = setInterval(scrTick, 1000);
}

function scrTick(){
    const found = scrFind(), b = scr.btn;
    if(scr.track && (!found || found.sender !== scr.sender)){ scrStopLocal(); }          // 通話が終わった
    const sharing = !!scr.track;
    b.hidden = !(sharing || (found && scrSupported()));
    b.textContent = sharing ? "🛑 画面共有をやめる" : "🖥️ 画面を共有";
    b.classList.toggle("on", sharing);
}

function scrStopLocal(){
    try{ if(scr.track){ scr.track.onended = null; scr.track.stop(); } }catch(_e){}
    scr.track = null; scr.sender = null; scr.orig = null;
}

async function scrStop(){
    const sender = scr.sender, orig = scr.orig;
    scrStopLocal();
    if(sender){ try{ await sender.replaceTrack(orig && orig.readyState === "live" ? orig : null); }catch(_e){ /* 通話が切れている */ } }
    showToast("画面共有をやめました。");
    scrTick();
}

async function scrToggle(){
    if(scr.track){ await scrStop(); return; }
    if(!scrSupported()){ showToast("このブラウザは画面共有に対応していません（パソコンのブラウザで使えます）。"); return; }
    const found = scrFind();
    if(!found){ showToast("ビデオ通話中に使えます。先にビデオ通話を始めてください。"); return; }
    let stream;
    try{ stream = await navigator.mediaDevices.getDisplayMedia({video:true, audio:false}); }
    catch(error){ if(error && error.name === "NotAllowedError") return; throw error; }   // 選ばずに閉じたときは何もしない
    const track = stream.getVideoTracks()[0];
    if(!track) return;
    scr.orig = found.sender.track; scr.sender = found.sender; scr.track = track;
    await found.sender.replaceTrack(track);
    track.onended = () => { scrStop(); };
    showToast("画面を共有しています。");
    scrTick();
}

function openScreenHelp(){
    const found = scrFind();
    openSheet(toolHead("🖥️ 画面共有", "ビデオ通話中に、カメラのかわりに自分の画面を相手に見せます") +
        '<div class="meta">状態：' + (scr.track ? "✅ 共有中" : found ? "🎥 ビデオ通話中（共有できます）" : "通話していません") + '</div>' +
        '<div class="meta">・パソコンのブラウザ（Chrome・Edge・Firefox・Safari）で使えます。スマホのブラウザは未対応のことが多いです。<br>・ビデオ通話中は、画面の右下に「🖥️ 画面を共有」ボタンが出ます。<br>・音声だけの通話では使えません。</div>' +
        (scrSupported() ? "" : '<div class="meta" style="color:var(--danger)">このブラウザは画面共有に対応していません。</div>') +
        '<div class="row"><button type="button" data-t="scr:toggle"' + (found || scr.track ? "" : " disabled") + '>' + (scr.track ? "共有をやめる" : "画面を共有する") + '</button><button type="button" class="button-secondary" data-pm="close">閉じる</button></div>');
}
async function onScreenAction(action){ if(action === "toggle"){ closeSheet(); await scrToggle(); } }
