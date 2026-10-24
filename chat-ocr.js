"use strict";
// ===== 画像の中の文字を読み取る（OCR）=====
// ・画像メッセージの 📝 か、「📝 文字を読み取る」から、画像の中の文字を取り出します。
// ・読み取りは、あなたの端末の中で行います（画像を外部のサービスに送りません）。
// ・初回だけ、読み取り用の部品（tesseract.js と日本語・英語の辞書、数MB）を jsDelivr から読み込みます。
// ・手書きや、斜めの写真、小さい文字は、うまく読めないことがあります。

const OCR_VER = "5.1.1";
const OCR_BASE = "https://cdn.jsdelivr.net/npm/tesseract.js@" + OCR_VER + "/dist/";
const OCR_CORE = "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.0/";
const OCR_LANG = "https://cdn.jsdelivr.net/npm/@tesseract.js-data/";
const ocr = {lib:null, busy:false, text:"", file:null};

function ocrLoadLib(){
    if(window.Tesseract) return Promise.resolve(window.Tesseract);
    if(ocr.lib) return ocr.lib;
    ocr.lib = new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = OCR_BASE + "tesseract.min.js"; s.crossOrigin = "anonymous";
        s.onload = () => window.Tesseract ? res(window.Tesseract) : rej(new Error("tesseract_missing"));
        s.onerror = () => { ocr.lib = null; rej(new Error("tesseract_load")); };
        document.head.appendChild(s);
    });
    return ocr.lib;
}

function initOcr(){
    registerTool("ocr", onOcrAction);
    addMsgTool({id:"ocr", icon:"📝", label:"画像の文字を読み取る", when:(m, item) => item.type === "image" && !!item.url && !item.stamp, run:(m, item) => runTool(() => ocrStart(item.url))});
}

function openOcr(){
    openSheet(toolHead("📝 文字を読み取る", "写真や画像の中の文字を、テキストにします（端末の中で処理します）") +
        '<label class="button" for="ocrPick" style="display:block;text-align:center">画像を選ぶ・撮影する</label><input id="ocrPick" type="file" accept="image/*" hidden>' +
        '<div class="meta">・初回は読み取り用の部品（数MB）を読み込むため、時間がかかります。<br>・チャットの画像は、画像の📝ボタンからも読み取れます。<br>・手書きや斜めの写真は、うまく読めないことがあります。</div>' + toolClose());
    const inp = $("ocrPick");
    inp.addEventListener("change", () => { const f = inp.files && inp.files[0]; if(f) runTool(() => ocrStart(f)); });
}

async function ocrStart(src){
    if(ocr.busy){ showToast("読み取り中です。少しお待ちください。"); return; }
    ocr.busy = true; ocr.text = "";
    openSheet(toolHead("📝 文字を読み取る") + '<div class="admin-card" id="ocrSt">部品を読み込み中…</div><progress id="ocrPg" max="100" value="0" style="width:100%"></progress><div class="row"><button type="button" class="button-secondary" data-pm="close">閉じる</button></div>');
    const st = (t, p) => { const a = $("ocrSt"), b = $("ocrPg"); if(a) a.textContent = t; if(b && p != null) b.value = Math.round(p * 100); };
    let worker = null;
    try{
        let blob = src;
        if(typeof src === "string"){
            const r = await fetch(src);
            if(!r.ok) throw new Error("image_fetch");
            blob = await r.blob();
        }
        const T = await ocrLoadLib();
        st("辞書を読み込み中…（初回のみ時間がかかります）");
        worker = await T.createWorker("jpn+eng", 1, {
            workerPath:OCR_BASE + "worker.min.js", corePath:OCR_CORE, langPath:OCR_LANG + "jpn@1.0.0/4.0.0_best_int",
            workerBlobURL:true,
            logger:(m) => { if(m && m.status) st(m.status === "recognizing text" ? "文字を読み取り中…" : "準備中…（" + m.status + "）", m.progress); }
        });
        const r = await worker.recognize(blob);
        const text = String((r && r.data && r.data.text) || "").replace(/[ \t]+\n/g, "\n").trim();
        ocr.text = text;
        ocrShow(text, r && r.data ? r.data.confidence : null);
    }catch(e){
        console.error("[ARE ocr]", e);
        const m = String(e && e.message || e);
        const a = $("ocrSt");
        if(a) a.textContent = m.includes("tesseract_load") ? "読み取り用の部品を読み込めませんでした。通信状況を確認して、もう一度お試しください。" : m.includes("image_fetch") ? "画像を取得できませんでした。" : "読み取りに失敗しました。";
    }finally{
        if(worker){ try{ await worker.terminate(); }catch(_e){} }
        ocr.busy = false;
    }
}

function ocrShow(text, conf){
    openSheet(toolHead("📝 読み取り結果", conf != null ? "確からしさ：約" + Math.round(conf) + "%（目安）" : "") +
        (text ? '<textarea id="ocrOut" rows="8" style="width:100%">' + escapeHtml(text) + '</textarea>' : '<div class="admin-card">文字が見つかりませんでした。</div>') +
        '<div class="row">' + (text ? '<button type="button" data-t="ocr:copy">コピー</button><button type="button" class="button-secondary" data-t="ocr:input">入力欄に入れる</button>' : '') + '<button type="button" class="button-secondary" data-pm="close">閉じる</button></div>');
}

async function onOcrAction(action){
    const box = $("ocrOut"), text = box ? box.value : ocr.text;
    if(action === "copy"){
        try{ await navigator.clipboard.writeText(text); showToast("コピーしました。"); }catch(_e){ if(box){ box.select(); showToast("選択しました。コピーしてください。"); } }
    }else if(action === "input"){
        const inp = el.messageInput || $("messageInput");
        if(inp){ inp.value = (inp.value ? inp.value + "\n" : "") + text; inp.dispatchEvent(new Event("input", {bubbles:true})); }
        closeSheet(); showToast("入力欄に入れました。");
    }
}
