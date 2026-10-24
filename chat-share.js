"use strict";
// ===== プロフィール共有（リンク・QRコード）=====
// QRは qr.js（外部ライブラリなし）で作ります。相手が読み取ると、このアプリのプロフィール画面が開きます。

function initShare(){
    registerTool("share", onShareAction);
    const card = document.getElementById("profileEditButton");
    if(card && card.parentElement){
        const button = document.createElement("button");
        button.type = "button"; button.className = "button-secondary"; button.dataset.feature = "share"; button.id = "shareProfileButton";
        button.textContent = "🔗 プロフィールを共有（QR）";
        button.addEventListener("click", () => runTool(openShare));
        card.insertAdjacentElement("afterend", button);
    }
    openSharedProfileFromUrl();
}

function shareUrl(){
    return new URL("chat.html?u=" + encodeURIComponent(state.user.id), location.href).href;
}

function openShare(){
    const url = shareUrl();
    openSheet(toolHead("🔗 プロフィール共有", "このQRコードを相手のスマホで読み取ると、あなたのプロフィールが開きます（相手もログインが必要です）。") +
        '<div class="qr-box"><canvas id="shQr" aria-label="プロフィールのQRコード"></canvas></div>' +
        '<div class="meta" style="text-align:center">' + escapeHtml(profileDisplayName(state.profile)) + '</div>' +
        '<input id="shUrl" type="text" readonly value="' + escapeHtml(url) + '">' +
        '<div class="row"><button type="button" class="button-secondary" data-t="share:copy">リンクをコピー</button><button type="button" class="button-secondary" data-t="share:png">QR画像を保存</button><button type="button" class="button" data-t="share:native">共有...</button></div>' + toolClose());
    if(!window.AREQR) throw new Error("QRコード部品を読み込めませんでした。");
    window.AREQR.draw($("shQr"), url, 240);
}

async function onShareAction(action){
    const url = shareUrl();
    if(action === "copy"){
        try{ await navigator.clipboard.writeText(url); showToast("リンクをコピーしました。"); }
        catch(_e){ const input = $("shUrl"); if(input){ input.select(); showToast("リンクを選択しました。コピーしてください。"); } }
    }else if(action === "png"){
        const canvas = $("shQr");
        if(canvas) canvas.toBlob((blob) => { if(blob) downloadBlob(blob, "ARE-profile-qr.png"); });
    }else if(action === "native"){
        if(navigator.share){ try{ await navigator.share({title:"AREのプロフィール", url}); }catch(_e){} }
        else showToast("このブラウザには共有機能がありません。「リンクをコピー」を使ってください。");
    }
}

async function openSharedProfileFromUrl(){
    let id = "";
    try{ id = new URLSearchParams(location.search).get("u") || ""; }catch(_e){}
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return;
    try{ history.replaceState(null, "", location.pathname); }catch(_e){}
    if(id === state.user.id){ showToast("これはあなた自身のプロフィールです。"); return; }
    const result = await requireClient().from(TABLES.profiles).select("*").eq("id", id).maybeSingle();
    if(result.error || !result.data){ showToast("共有されたユーザーが見つかりませんでした。"); return; }
    feat.known.set(result.data.id, result.data);
    openProfileView(result.data);
}
