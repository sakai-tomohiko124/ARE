
/* Supabaseクライアントを初期化 */
(function () {
    const config = window.ARE_CONFIG;

    if (!window.supabase || !config) {
        throw new Error("Supabaseライブラリまたは設定を読み込めません。");
    }

    if (!config.supabasePublishableKey || config.supabasePublishableKey === "YOUR_SUPABASE_PUBLISHABLE_KEY") {
        console.warn("Supabaseの公開用キーを設定してください。");
    }

    window.areSupabase = window.supabase.createClient(
        config.supabaseUrl,
        config.supabasePublishableKey
    );
})();
