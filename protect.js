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

    function isEditable(node) {
        return !!(node && node.closest && node.closest("input,textarea,select,[contenteditable='true']"));
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

    document.addEventListener("contextmenu", function (event) {
        if (exempt() || isEditable(event.target)) return;
        event.preventDefault();
    }, true);

    document.addEventListener("dragstart", function (event) {
        if (exempt()) return;
        if (event.target && event.target.tagName === "IMG") event.preventDefault();
    }, true);

    window.AREProtect = {
        setExempt: function (on) { try { if (on) localStorage.setItem("are_dev_ok", "1"); else localStorage.removeItem("are_dev_ok"); } catch (_e) { /* 何もしない */ } }
    };
})();
