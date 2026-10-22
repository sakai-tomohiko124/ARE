// パスワード欄に「目のボタン」を付け、新しいパスワード欄には条件のチェックリストを表示します。
(function () {
    "use strict";

    // パスワードの条件：8〜72文字、大文字・小文字・数字または記号をそれぞれ1文字以上
    const rules = [
        { label: "8文字以上", test: function (p) { return p.length >= 8; } },
        { label: "大文字（A〜Z）を1文字以上", test: function (p) { return /[A-Z]/.test(p); } },
        { label: "小文字（a〜z）を1文字以上", test: function (p) { return /[a-z]/.test(p); } },
        { label: "数字か記号を1文字以上", test: function (p) { return /[0-9]|[^A-Za-z0-9]/.test(p); } }
    ];
    window.AREPasswordPolicy = {
        rules: rules,
        problem: function (p) {
            p = String(p || "");
            if (p.length < 8) return "パスワードは8文字以上にしてください。";
            if (p.length > 72) return "パスワードは72文字以内にしてください。";
            if (!/[A-Z]/.test(p)) return "パスワードに大文字（A〜Z）を1文字以上含めてください。";
            if (!/[a-z]/.test(p)) return "パスワードに小文字（a〜z）を1文字以上含めてください。";
            if (!/[0-9]|[^A-Za-z0-9]/.test(p)) return "パスワードに数字または記号を1文字以上含めてください。";
            return null;
        }
    };

    const style = document.createElement("style");
    style.textContent = ".pw-wrap{position:relative;display:block;width:100%}.pw-wrap input{padding-right:52px!important;width:100%;box-sizing:border-box}" +
        ".pw-eye{position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:0;color:inherit;cursor:pointer;font-size:20px;line-height:1;padding:8px 10px;opacity:.85;min-width:44px;min-height:44px}" +
        ".pw-eye:focus-visible{outline:2px solid currentColor;border-radius:8px}" +
        ".pw-policy{list-style:none;margin:6px 0 4px;padding:0;font-size:12px;line-height:1.7}.pw-policy li.ok{color:#2e9e5b}.pw-policy li.ng{opacity:.8}" +
        ".pw-tip{font-size:12px;opacity:.8;margin:0 0 10px;line-height:1.6}";
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

        // 新しいパスワードを決める欄（確認用の欄は除く）にだけ、条件のチェックリストを出す
        if (input.getAttribute("autocomplete") === "new-password" && !/confirm/i.test(input.id)) {
            const list = document.createElement("ul");
            list.className = "pw-policy";
            list.setAttribute("aria-live", "polite");
            const items = rules.map(function (rule) {
                const li = document.createElement("li");
                list.appendChild(li);
                return li;
            });
            const tip = document.createElement("p");
            tip.className = "pw-tip";
            tip.textContent = "つくり方の例：好きな言葉を2つ続けて1文字を大文字にし、最後に数字と記号を足す（例：Nekobus24!）。この例そのものは使わず、自分だけの言葉で作ってください。パスワードは紙に控えるか、パスワード管理アプリに保存すると忘れにくくなります。";
            wrap.parentNode.insertBefore(list, wrap.nextSibling);
            list.parentNode.insertBefore(tip, list.nextSibling);
            const update = function () {
                rules.forEach(function (rule, i) {
                    const ok = rule.test(input.value);
                    items[i].className = ok ? "ok" : "ng";
                    items[i].textContent = (ok ? "✓ " : "・ ") + rule.label;
                });
            };
            input.addEventListener("input", update);
            update();
        }
    });
})();
