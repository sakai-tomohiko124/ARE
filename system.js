
/* ARE共通システム：Supabase接続・認証・共通処理 */
(function () {
    "use strict";

    /* Supabase接続設定 */
    const ARE_CONFIG = Object.freeze({
        supabaseUrl: "https://xawevnvzkcoijswmujah.supabase.co",
        supabasePublishableKey: "sb_publishable_VWeGzACdSzM80biRbTtaog_diIE_AEj",
        functions: Object.freeze({
            register: "register-user",
            login: "login-user",
            recovery: "recover-account"
        })
    });

    /* 共通設定を公開 */
    window.ARE_CONFIG = ARE_CONFIG;

    /* 必要なライブラリを確認 */
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
        console.error("Supabaseライブラリを読み込めません。");
        throw new Error("Supabaseライブラリを読み込めません。");
    }

    /* Supabaseクライアントを初期化 */
    const areSupabase = window.supabase.createClient(
        ARE_CONFIG.supabaseUrl,
        ARE_CONFIG.supabasePublishableKey
    );

    /* 既存コードとの互換性を維持 */
    window.areSupabase = areSupabase;

    /* APIのエラーメッセージを取得 */
    async function readResponse(response) {
        const responseText = await response.text();

        if (!responseText) {
            return {};
        }

        try {
            return JSON.parse(responseText);
        } catch {
            return {
                message: responseText
            };
        }
    }

    /* Supabase Edge Functionを呼び出す */
    async function callFunction(functionName, payload) {
        const endpointName = ARE_CONFIG.functions[functionName];

        if (!endpointName) {
            throw new Error("指定されたAPIが設定されていません。");
        }

        const response = await fetch(
            `${ARE_CONFIG.supabaseUrl}/functions/v1/${endpointName}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": ARE_CONFIG.supabasePublishableKey
                },
                body: JSON.stringify(payload)
            }
        );

        const result = await readResponse(response);

        if (!response.ok) {
            throw new Error(
                result.error ||
                result.message ||
                `APIリクエストに失敗しました。HTTP ${response.status}`
            );
        }

        if (result && typeof result === "object" && result.error) {
            throw new Error(result.error);
        }

        return result;
    }

    /* 必須文字列を検証 */
    function requireText(value, label) {
        if (typeof value !== "string" || !value.trim()) {
            throw new Error(`${label}を入力してください。`);
        }

        return value.trim();
    }

    /* 時刻を日本語形式で表示 */
    function formatTime(value) {
        if (!value) {
            return "";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return new Intl.DateTimeFormat("ja-JP", {
            hour: "2-digit",
            minute: "2-digit"
        }).format(date);
    }

    /* 新規アカウントを作成 */
    async function register(displayName, loginId, password, phoneNumber = "") {
        const normalizedDisplayName = requireText(displayName, "表示名");
        const normalizedLoginId = requireText(loginId, "ログインID");

        if (typeof password !== "string" || !password) {
            throw new Error("パスワードを入力してください。");
        }

        if (normalizedDisplayName.length > 40) {
            throw new Error("表示名は40文字以内で入力してください。");
        }

        if (normalizedLoginId.length > 80) {
            throw new Error("ログインIDは80文字以内で入力してください。");
        }

        const normalizedPhoneNumber = typeof phoneNumber === "string"
            ? phoneNumber.trim()
            : "";

        return callFunction("register", {
            displayName: normalizedDisplayName,
            loginId: normalizedLoginId,
            password,
            phoneNumber: normalizedPhoneNumber
        });
    }

    /* ログインしてSupabaseセッションを設定 */
    async function login(loginId, password) {
        const normalizedLoginId = requireText(loginId, "ログインID");

        if (typeof password !== "string" || !password) {
            throw new Error("パスワードを入力してください。");
        }

        const result = await callFunction("login", {
            loginId: normalizedLoginId,
            password
        });

        /* APIからセッション情報を取得 */
        const accessToken = result.accessToken || result.access_token;
        const refreshToken = result.refreshToken || result.refresh_token;

        if (!accessToken || !refreshToken) {
            throw new Error(
                "ログインAPIの応答にセッション情報がありません。サーバー側の応答形式を確認してください。"
            );
        }

        /* Supabase認証セッションを設定 */
        const sessionResult = await areSupabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
        });

        if (sessionResult.error) {
            throw sessionResult.error;
        }

        const session = sessionResult.data.session;
        const user = sessionResult.data.user || session?.user || result.user;

        if (!user?.id) {
            throw new Error("ログイン後のユーザー情報を取得できませんでした。");
        }

        return {
            ...result,
            session,
            user
        };
    }

    /* 復旧コードを使ってパスワードを再設定 */
    async function recover(loginId, recoveryCode, newPassword) {
        const normalizedLoginId = requireText(loginId, "ログインID");
        const normalizedRecoveryCode = requireText(recoveryCode, "復旧コード");

        if (typeof newPassword !== "string" || !newPassword) {
            throw new Error("新しいパスワードを入力してください。");
        }

        return callFunction("recovery", {
            loginId: normalizedLoginId,
            recoveryCode: normalizedRecoveryCode,
            newPassword
        });
    }

    /* ログアウトしてセッションを破棄 */
    async function logout() {
        const result = await areSupabase.auth.signOut();

        if (result.error) {
            throw result.error;
        }

        return true;
    }

    /* 現在の認証セッションを取得 */
    async function getSession() {
        const result = await areSupabase.auth.getSession();

        if (result.error) {
            throw result.error;
        }

        return result.data.session;
    }

    /* 現在のログインユーザーを取得 */
    async function getCurrentUser() {
        const result = await areSupabase.auth.getUser();

        if (result.error) {
            throw result.error;
        }

        return result.data.user;
    }

    /* 認証状態の変化を監視 */
    function onAuthStateChange(callback) {
        if (typeof callback !== "function") {
            throw new Error("認証状態のコールバックが正しくありません。");
        }

        const result = areSupabase.auth.onAuthStateChange(
            (event, session) => {
                callback(event, session);
            }
        );

        return result.data.subscription;
    }

    /* 認証機能を公開 */
    window.AREAuth = Object.freeze({
        register,
        login,
        recover,
        logout,
        getSession,
        getCurrentUser,
        onAuthStateChange
    });

    /* 共通ユーティリティを公開 */
    window.AREUtils = Object.freeze({
        formatTime,
        requireText
    });

    /* 共通システムの初期化完了を記録 */
    window.ARESystem = Object.freeze({
        config: ARE_CONFIG,
        client: areSupabase,
        callFunction,
        getSession,
        getCurrentUser,
        onAuthStateChange
    });

    console.info("ARE system.js の初期化が完了しました。");
})();
