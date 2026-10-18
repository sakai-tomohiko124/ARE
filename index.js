(function () {
    "use strict";

    // 起動画面を5秒間表示してからログイン画面へ移動します。
    const redirectDelayMs = 5000;
    const loginPageUrl = "./login.html";

    window.setTimeout(function () {
        window.location.replace(loginPageUrl);
    }, redirectDelayMs);
})();
