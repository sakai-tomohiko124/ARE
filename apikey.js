(function () {
    "use strict";

    // Supabaseの接続設定です。ブラウザに公開してよいPublishable Keyのみを設定してください。
    // Service Role Keyや秘密鍵は絶対に記載しないでください。データ保護はSupabase側のRLSで行います。
    window.ARE_CONFIG = Object.freeze({
        supabaseUrl: "https://xawevnvzkcoijsmwujah.supabase.co",
        supabasePublishableKey: "sb_publishable_VWeGzACdSzM80biRbTtaog_diIE_AEj",
        functions: Object.freeze({
            register: "register-user",
            login: "login-user",
            recovery: "recover-account"
        }),
        requestTimeoutMs: 20000
    });
})();
