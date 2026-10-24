"use strict";
// ===== 開発者ツール・ソース表示の「抑止」（F12 / Ctrl+Shift+I など）=====
// 注意：これは「うっかり開く」を防ぐ程度の仕組みです。ブラウザのメニューや別の方法までは止められません。
//       本当の安全は、サーバー側のルール（RLS）で守っています。画面上で見た目を書き換えても、本人の画面が変わるだけで、データは守られます。
// 管理者としてログインすると、この端末だけ解除されます（開発・点検のため）。
(function () {
    function exempt() { try { return localStorage.getItem("are_dev_ok") === "1"; } catch (_e) { return false; } }

    function notice() {
        if (window.AREFeatures && typeof window.AREFeatures.notify === "function") window.AREFeatures.notify("この操作は無効になっています。");
    }

    document.addEventListener("keydown", function (event) {
        if (exempt()) return;
        var key = String(event.key || "").toLowerCase();
        var ctrl = event.ctrlKey || event.metaKey;
        var blocked =
            event.key === "F12" ||
            (ctrl && event.shiftKey && (key === "i" || key === "j" || key === "c" || key === "k")) ||
            (event.metaKey && event.altKey && (key === "i" || key === "j" || key === "c" || key === "u")) ||
            (ctrl && !event.shiftKey && (key === "u" || key === "s"));
        if (!blocked) return;
        event.preventDefault();
        event.stopPropagation();
        notice();
    }, true);

    // 右クリック：ブラウザ標準のメニュー（「検証」など）は出さず、選んだ文字の「コピー」だけを出します
    var menu = null;
    function hideMenu() { if (menu) { menu.remove(); menu = null; } }
    function selectedText(target) {
        try {
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA") && typeof target.selectionStart === "number" && target.selectionStart !== target.selectionEnd) {
                return target.value.slice(target.selectionStart, target.selectionEnd);
            }
            return String(window.getSelection ? window.getSelection().toString() : "");
        } catch (_e) { return ""; }
    }
    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(function () { legacyCopy(text); });
        legacyCopy(text);
    }
    function legacyCopy(text) {
        var t = document.createElement("textarea");
        t.value = text; t.style.cssText = "position:fixed;left:-9999px;top:0";
        document.body.appendChild(t); t.select();
        try { document.execCommand("copy"); } catch (_e) { /* 何もしない */ }
        t.remove();
    }
    document.addEventListener("contextmenu", function (event) {
        if (exempt()) return;
        event.preventDefault();
        hideMenu();
        var text = selectedText(event.target);
        if (!text) return;
        menu = document.createElement("div");
        menu.setAttribute("role", "menu");
        menu.style.cssText = "position:fixed;z-index:2147483647;background:#1d2538;color:#fff;border:1px solid #3a4666;border-radius:10px;padding:4px;box-shadow:0 6px 24px rgba(0,0,0,.5);font:14px system-ui,sans-serif";
        var b = document.createElement("button");
        b.type = "button"; b.textContent = "コピー"; b.setAttribute("role", "menuitem");
        b.style.cssText = "display:block;background:transparent;color:inherit;border:0;padding:8px 22px;border-radius:8px;cursor:pointer;font:inherit";
        b.addEventListener("click", function (e) { e.stopPropagation(); copyText(text); hideMenu(); });
        menu.appendChild(b);
        document.body.appendChild(menu);
        var x = Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8), y = Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8);
        menu.style.left = Math.max(4, x) + "px"; menu.style.top = Math.max(4, y) + "px";
    }, true);
    document.addEventListener("click", hideMenu, true);
    document.addEventListener("scroll", hideMenu, true);
    window.addEventListener("blur", hideMenu);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") hideMenu(); }, true);

    // 画像・ファイル（スクショ含む）の貼り付けは、チャット画面（相手を開いているとき）だけ。それ以外の場所では貼り付けられません
    document.addEventListener("paste", function (event) {
        if (exempt()) return;
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
        if (exempt()) return;
        if (event.target && event.target.tagName === "IMG") event.preventDefault();
    }, true);

    window.AREProtect = {
        setExempt: function (on) { try { if (on) localStorage.setItem("are_dev_ok", "1"); else localStorage.removeItem("are_dev_ok"); } catch (_e) { /* 何もしない */ } }
    };
})();
