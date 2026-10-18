
/* Supabaseの公開接続設定 */
window.ARE_CONFIG = Object.freeze({
    supabaseUrl: "https://xawevnvzkcoijswmujah.supabase.co",
    supabasePublishableKey: "YOUR_SUPABASE_PUBLISHABLE_KEY",
    functions: {
        register: "register-user",
        login: "login-user",
        recovery: "recover-account"
    }
});
