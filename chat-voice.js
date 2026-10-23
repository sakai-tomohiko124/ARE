"use strict";
// ===== 音声メッセージ（ブラウザの録音機能を使用。無料） =====

feat.voice = {recorder:null,stream:null,chunks:[],timer:null,seconds:0,cancelled:false};
const VOICE_MAX_SECONDS = 120;

function initVoice(){
    if(typeof uploadAndSend !== "function") throw new Error("添付の送信機能が読み込まれていません。");
    document.getElementById("voiceButton").addEventListener("click",toggleRecording);
    document.getElementById("voiceCancel").addEventListener("click",() => stopRecording(false));
    addRoomHook(() => { if(feat.voice.recorder) stopRecording(false,true); });
}

function voiceLabel(){
    const v = feat.voice, button = document.getElementById("voiceButton"), cancel = document.getElementById("voiceCancel");
    if(v.recorder){
        const m = Math.floor(v.seconds / 60), s = String(v.seconds % 60).padStart(2,"0");
        button.textContent = "⏹ 録音中 " + m + ":" + s + "（押して送信）";
        cancel.hidden = false;
    }else{
        button.textContent = "🎤 音声";
        cancel.hidden = true;
    }
}

async function toggleRecording(){
    const v = feat.voice;
    if(v.recorder){ stopRecording(true); return; }
    if(!state.currentRoom){ showToast("先にチャット相手を選択してください。"); return; }
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === "undefined"){
        showToast("この端末・ブラウザでは音声の録音が使えません。");
        return;
    }
    try{
        v.stream = await navigator.mediaDevices.getUserMedia({audio:true});
    }catch(error){
        showToast(error && error.name === "NotAllowedError" ? "マイクの使用が許可されていません。ブラウザの設定で許可してください。" : "マイクを使用できませんでした。");
        return;
    }
    const mime = ["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) || "";
    v.chunks = []; v.seconds = 0; v.cancelled = false;
    v.recorder = mime ? new MediaRecorder(v.stream,{mimeType:mime}) : new MediaRecorder(v.stream);
    const baseMime = String(v.recorder.mimeType || mime || "audio/webm").split(";")[0];
    v.recorder.addEventListener("dataavailable",(event) => { if(event.data && event.data.size) v.chunks.push(event.data); });
    v.recorder.addEventListener("stop",() => finishRecording(baseMime));
    v.recorder.start();
    v.timer = setInterval(() => {
        v.seconds += 1; voiceLabel();
        if(v.seconds >= VOICE_MAX_SECONDS) stopRecording(true);
    },1000);
    voiceLabel();
}

function stopRecording(send,silent){
    const v = feat.voice;
    if(!v.recorder) return;
    v.cancelled = !send;
    clearInterval(v.timer); v.timer = null;
    try{ v.recorder.stop(); }catch(_e){ finishRecording("audio/webm"); }
    if(!send && !silent) showToast("録音を取り消しました。");
}

async function finishRecording(baseMime){
    const v = feat.voice;
    if(v.stream){ v.stream.getTracks().forEach((track) => track.stop()); v.stream = null; }
    const chunks = v.chunks, cancelled = v.cancelled;
    v.recorder = null; v.chunks = [];
    voiceLabel();
    if(cancelled || !chunks.length) return;
    const ext = baseMime.includes("mp4") ? "m4a" : (baseMime.includes("ogg") ? "ogg" : "webm");
    const d = new Date(), p = (n) => String(n).padStart(2,"0");
    const name = "ボイス_" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + "." + ext;
    const file = new File([new Blob(chunks,{type:baseMime})],name,{type:baseMime});
    await uploadAndSend(file,"audio");
}
