"use strict";
// ===== ゲーム画面の「抑止」（protect.js にくわえて）=====
// F12・右クリック・開発者ツールのショートカット・印刷・コピー・ドラッグ・文字の選択を止めます。
// 注意：これは「うっかり」を防ぐ抑止です。ブラウザの設定メニューなど、ほかの方法までは完全には止められません。
(function(){
    const isField = (t) => !!(t && t.nodeType === 1 && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable));
    const kill = (e) => { e.preventDefault(); e.stopPropagation(); };
    const keyBad = (e) => {
        const k = String(e.key || "").toLowerCase(), c = e.ctrlKey || e.metaKey;
        return e.key === "F12" || e.key === "ContextMenu" || (e.shiftKey && e.key === "F10") ||
            (c && e.shiftKey && "ijckem".includes(k)) || (c && e.altKey && "ijcu".includes(k)) ||
            (c && !e.shiftKey && (k === "u" || k === "s" || k === "p")) ||
            (c && k === "a" && !isField(e.target));
    };
    ["keydown", "keyup", "keypress"].forEach((t) => window.addEventListener(t, (e) => { if(keyBad(e)) kill(e); }, true));
    ["contextmenu", "dragstart", "dragover", "drop"].forEach((t) => window.addEventListener(t, (e) => { if(t === "drop" || t === "dragover" || t === "dragstart" || t === "contextmenu") kill(e); }, true));
    ["copy", "cut"].forEach((t) => window.addEventListener(t, (e) => { if(!isField(e.target)) kill(e); }, true));
    window.addEventListener("selectstart", (e) => { if(!isField(e.target)) e.preventDefault(); }, true);
    window.addEventListener("paste", (e) => { if(!isField(e.target)) kill(e); }, true);
    const st = document.createElement("style");
    st.textContent = "html,body,#stage,#stage *{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-user-drag:none}input,textarea{-webkit-user-select:text;user-select:text}" +
        "@media print{html,body{display:none!important}}";
    (document.head || document.documentElement).appendChild(st);
    // 全画面のときも同じ（全画面でも F12 は上のキー制限が効く）。開発者ツールが開いたら画面をかくす（PCのみ）
    window.addEventListener("beforeprint", () => { document.documentElement.style.display = "none"; });
    window.addEventListener("afterprint", () => { document.documentElement.style.display = ""; });
})();
