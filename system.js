
(function () {
    "use strict";

    const CONFIG = Object.freeze({
        supabaseUrl: "https://xawevnvzkcoijswmujah.supabase.co",
        supabasePublishableKey: "sb_publishable_VWeGzACdSzM80biRbTtaog_diIE_AEj",
        functions: Object.freeze({
            register: "register-user",
            login: "login-user",
            recovery: "recover-account"
        }),
        requestTimeoutMs: 20000
    });

    let supabaseClient = null;

    function getConfig() {
        const existingConfig = window.ARE_CONFIG || {};

        return {
            ...CONFIG,
            ...existingConfig,
            functions: {
                ...CONFIG.functions,
                ...(existingConfig.functions || {})
            }
        };
    }

    function getClient() {
        if (supabaseClient) {
            return supabaseClient;
        }

        if (window.areSupabase) {
            supabaseClient = window.areSupabase;
            return supabaseClient;
        }

        if (!window.supabase || typeof window.supabase.createClient !== "function") {
            throw new Error("Supabaseライブラリが読み込まれていません。HTMLのscript設定を確認してください。");
        }

        const config = getConfig();

        if (!config.supabaseUrl || !config.supabasePublishableKey) {
            throw new Error("Supabaseの接続設定が不足しています。");
        }

        supabaseClient = window.supabase.createClient(
            config.supabaseUrl,
            config.supabasePublishableKey,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            }
        );

        window.areSupabase = supabaseClient;

        return supabaseClient;
    }

    function getFunctionUrl(functionName) {
        const config = getConfig();
        return `${config.supabaseUrl}/functions/v1/${functionName}`;
    }

    async function callFunction(functionName, payload) {
        const config = getConfig();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.requestTimeoutMs);

        try {
            const response = await fetch(getFunctionUrl(functionName), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": config.supabasePublishableKey
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            const responseText = await response.text();
            let result = {};

            if (responseText) {
                try {
                    result = JSON.parse(responseText);
                } catch {
                    result = { message: responseText };
                }
            }

            if (!response.ok) {
                const errorMessage = result.error || result.message || `APIリクエストに失敗しました（HTTP ${response.status}）。`;
                throw new Error(errorMessage);
            }

            if (result && result.error) {
                throw new Error(result.error);
            }

            return result;
        } catch (error) {
            if (error.name === "AbortError") {
                throw new Error("サーバーからの応答がタイムアウトしました。時間をおいて再試行してください。");
            }

            if (error instanceof TypeError) {
                throw new Error("サーバーに接続できませんでした。通信状態とEdge Functionの設定を確認してください。");
            }

            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async function login(loginId, password) {
        const normalizedLoginId = String(loginId || "").trim();

        if (!normalizedLoginId || !password) {
            throw new Error("ログインIDとパスワードを入力してください。");
        }

        const config = getConfig();
        const result = await callFunction(config.functions.login, {
            loginId: normalizedLoginId,
            password: password
        });

        const accessToken = result.accessToken || result.access_token;
        const refreshToken = result.refreshToken || result.refresh_token;

        if (!accessToken || !refreshToken) {
            throw new Error("ログインAPIからセッション情報を取得できませんでした。login-userの応答形式を確認してください。");
        }

        const sessionResult = await getClient().auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
        });

        if (sessionResult.error) {
            throw sessionResult.error;
        }

        return {
            ...result,
            session: sessionResult.data.session,
            user: sessionResult.data.user || result.user || null
        };
    }

    async function register(displayName, loginId, password, phoneNumber) {
        const normalizedDisplayName = String(displayName || "").trim();
        const normalizedLoginId = String(loginId || "").trim();
        const normalizedPhoneNumber = String(phoneNumber || "").trim();

        if (!normalizedDisplayName) {
            throw new Error("表示名を入力してください。");
        }

        if (!normalizedLoginId) {
            throw new Error("ログインIDを入力してください。");
        }

        if (!password || String(password).length < 8) {
            throw new Error("パスワードは8文字以上で入力してください。");
        }

        const config = getConfig();

        return callFunction(config.functions.register, {
            displayName: normalizedDisplayName,
            loginId: normalizedLoginId,
            password: password,
            phoneNumber: normalizedPhoneNumber
        });
    }

    async function recover(loginId, recoveryCode, newPassword) {
        const normalizedLoginId = String(loginId || "").trim();
        const normalizedRecoveryCode = String(recoveryCode || "").trim();

        if (!normalizedLoginId || !normalizedRecoveryCode || !newPassword) {
            throw new Error("ログインID、復旧コード、新しいパスワードを入力してください。");
        }

        if (String(newPassword).length < 8) {
            throw new Error("新しいパスワードは8文字以上で入力してください。");
        }

        const config = getConfig();

        return callFunction(config.functions.recovery, {
            loginId: normalizedLoginId,
            recoveryCode: normalizedRecoveryCode,
            newPassword: newPassword
        });
    }

    async function logout() {
        const client = getClient();
        const result = await client.auth.signOut();

        if (result.error) {
            throw result.error;
        }

        return true;
    }

    async function getSession() {
        const client = getClient();
        const result = await client.auth.getSession();

        if (result.error) {
            throw result.error;
        }

        return result.data.session;
    }

    async function getCurrentUser() {
        const client = getClient();
        const result = await client.auth.getUser();

        if (result.error) {
            if (result.error.name === "AuthSessionMissingError") {
                return null;
            }

            throw result.error;
        }

        return result.data.user || null;
    }

    async function requireSession(redirectUrl) {
        const session = await getSession();

        if (!session || !session.user) {
            if (redirectUrl) {
                window.location.href = redirectUrl;
            }

            return null;
        }

        return session;
    }

    function onAuthStateChange(callback) {
        if (typeof callback !== "function") {
            throw new Error("認証状態の変更を受け取る関数を指定してください。");
        }

        const result = getClient().auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });

        return result.data.subscription;
    }

    function getCurrentAccessToken() {
        return getSession().then((session) => session?.access_token || null);
    }

    async function callAuthenticatedFunction(functionName, payload) {
        const config = getConfig();
        const session = await getSession();

        if (!session?.access_token) {
            throw new Error("ログインしてください。");
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.requestTimeoutMs);

        try {
            const response = await fetch(getFunctionUrl(functionName), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": config.supabasePublishableKey,
                    "Authorization": `Bearer ${session.access_token}`
                },
                body: JSON.stringify(payload || {}),
                signal: controller.signal
            });

            const responseText = await response.text();
            let result = {};

            if (responseText) {
                try {
                    result = JSON.parse(responseText);
                } catch {
                    result = { message: responseText };
                }
            }

            if (!response.ok) {
                throw new Error(result.error || result.message || `APIリクエストに失敗しました（HTTP ${response.status}）。`);
            }

            if (result && result.error) {
                throw new Error(result.error);
            }

            return result;
        } catch (error) {
            if (error.name === "AbortError") {
                throw new Error("サーバーからの応答がタイムアウトしました。");
            }

            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    const AREAuth = Object.freeze({
        login,
        register,
        recover,
        logout,
        getSession,
        getCurrentUser,
        requireSession,
        onAuthStateChange,
        getCurrentAccessToken
    });

    const ARESystem = Object.freeze({
        get client() {
            return getClient();
        },
        getConfig,
        callFunction,
        callAuthenticatedFunction,
        getSession,
        getCurrentUser,
        requireSession,
        onAuthStateChange
    });

    window.AREAuth = AREAuth;
    window.ARESystem = ARESystem;
})();
