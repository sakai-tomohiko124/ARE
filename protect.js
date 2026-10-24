"use strict";
// ===== 右クリック禁止・開発者ツールの「抑止」（全画面共通・管理者も対象）=====
// 注意：これは「うっかり開く」を防ぐ抑止です。ブラウザのメニューや別の方法までは完全には止められません。
//       本当の安全は、サーバー側のルール（RLS）で守っています。
(function () {
    try { localStorage.removeItem("are_dev_ok"); } catch (_e) { /* 何もしない */ }

    function notice() {
        if (window.AREFeatures && typeof window.AREFeatures.notify === "function") window.AREFeatures.notify("この操作は無効になっています。");
    }

    document.addEventListener("keydown", function (event) {
        var key = String(event.key || "").toLowerCase();
        var ctrl = event.ctrlKey || event.metaKey;
        var blocked =
            event.key === "F12" ||
            event.key === "ContextMenu" ||
            (event.shiftKey && event.key === "F10") ||
            (ctrl && event.shiftKey && (key === "i" || key === "j" || key === "c" || key === "k" || key === "e" || key === "m")) ||
            (ctrl && event.altKey && (key === "i" || key === "j" || key === "c" || key === "u")) ||
            (event.metaKey && event.altKey && (key === "i" || key === "j" || key === "c" || key === "u")) ||
            (ctrl && !event.shiftKey && (key === "u" || key === "s"));
        if (!blocked) return;
        event.preventDefault();
        event.stopPropagation();
        notice();
    }, true);

    // 右クリック（長押しメニュー含む）：全画面で禁止。メニューは一切出さない
    function stopMenu(event) { event.preventDefault(); /* 標準メニューだけ止める。アプリ独自メニュー(長押し・コピー)は伝播させて動かす */ }
    document.addEventListener("contextmenu", stopMenu, true);
    window.addEventListener("contextmenu", stopMenu, true);
    document.addEventListener("mousedown", function (e) { if (e.button === 2) e.preventDefault(); }, true);
    document.addEventListener("auxclick", function (e) { if (e.button === 2) stopMenu(e); }, true);
    document.addEventListener("selectstart", function (e) {
        var t = e.target && e.target.nodeType === 1 ? e.target : (e.target && e.target.parentElement);
        if (t && t.tagName === "IMG") e.preventDefault();
    }, true);

    // 画像・ファイル（スクショ含む）の貼り付けは、チャット画面（相手を開いているとき）だけ
    document.addEventListener("paste", function (event) {
        var cd = event.clipboardData;
        if (!cd) return;
        var hasFile = (cd.files && cd.files.length > 0) || Array.prototype.some.call(cd.items || [], function (i) { return i.kind === "file"; });
        if (!hasFile) return;
        if (typeof window.__areAllowFilePaste === "function" && window.__areAllowFilePaste(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        if (window.AREFeatures && typeof window.AREFeatures.notify === "function") window.AREFeatures.notify("画像・ファイルの貼り付けは、チャット画面でだけ使えます。");
    }, true);

    document.addEventListener("dragstart", function (event) {
        var t = event.target;
        if (t && (t.tagName === "IMG" || t.tagName === "VIDEO" || t.tagName === "CANVAS")) event.preventDefault();
    }, true);

    // 画像・動画の長押し保存メニュー、ドラッグ、選択を出さない
    var st = document.createElement("style");
    st.textContent = "img,video,canvas,svg{-webkit-touch-callout:none!important;-webkit-user-drag:none!important;user-drag:none!important}" +
        "img,video{-webkit-user-select:none!important;user-select:none!important}";
    (document.head || document.documentElement).appendChild(st);

    // 開発者ツールを横に開いた状態（ウィンドウ内側と外側の大きさの差）を見つけたら画面を隠す。スマホでは動きません
    var coarse = false;
    try { coarse = window.matchMedia("(pointer:coarse)").matches; } catch (_e) { /* 何もしない */ }
    if (!coarse) {
        var veil = null;
        setInterval(function () {
            var w = window.outerWidth - window.innerWidth, h = window.outerHeight - window.innerHeight;
            var open = (w > 260 && window.outerWidth > 0) || (h > 300 && window.outerHeight > 0);
            if (open && !veil && document.body) {
                veil = document.createElement("div");
                veil.style.cssText = "position:fixed;inset:0;z-index:2147483646;background:#0b1020;color:#fff;display:flex;align-items:center;justify-content:center;font:16px system-ui,sans-serif;text-align:center;padding:24px";
                veil.textContent = "開発者ツールを閉じてください。閉じると元の画面に戻ります。";
                document.body.appendChild(veil);
            } else if (!open && veil) { veil.remove(); veil = null; }
        }, 1000);
    }

    window.AREProtect = { setExempt: function () { /* 管理者も含め、全員が対象です（何もしません） */ } };
})();
