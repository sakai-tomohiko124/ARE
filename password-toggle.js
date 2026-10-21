// すべてのパスワード欄に「目のボタン」（表示/非表示の切り替え）を付けます。
(function () {
    "use strict";
    const style = document.createElement("style");
    style.textContent = ".pw-wrap{position:relative;display:block;width:100%}.pw-wrap input{padding-right:52px!important;width:100%;box-sizing:border-box}" +
        ".pw-eye{position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:0;color:inherit;cursor:pointer;font-size:20px;line-height:1;padding:8px 10px;opacity:.85;min-width:44px;min-height:44px}" +
        ".pw-eye:focus-visible{outline:2px solid currentColor;border-radius:8px}";
    document.head.appendChild(style);

    document.querySelectorAll('input[type="password"]').forEach(function (input) {
        const wrap = document.createElement("span");
        wrap.className = "pw-wrap";
        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);

        const button = document.createElement("button");
        button.type = "button";
        button.className = "pw-eye";
        button.textContent = "👁";
        button.setAttribute("aria-label", "パスワードを表示");
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", function () {
            const show = input.type === "password";
            input.type = show ? "text" : "password";
            button.textContent = show ? "🙈" : "👁";
            button.setAttribute("aria-label", show ? "パスワードを隠す" : "パスワードを表示");
            button.setAttribute("aria-pressed", String(show));
        });
        wrap.appendChild(button);
    });
})();
