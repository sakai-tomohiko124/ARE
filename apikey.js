(function () {
    "use strict";

    // Supabaseの接続設定です。ブラウザに公開してよいPublishable Keyのみを設定してください。
    // TODO：未設定。Service Role Keyや秘密鍵は絶対に記載しないでください。
    window.ARE_CONFIG = Object.freeze({
        supabaseUrl: "https://xawevnvzkcoijswmujah.supabase.co",
        supabasePublishableKey: "sb_publishable_VWeGzACdSzM80biRbTtaog_diIE_AEj",
        functions: Object.freeze({
            register: "register-user",
            login: "login-user",
            recovery: "recover-account"
        }),
        requestTimeoutMs: 20000
    });
})();
