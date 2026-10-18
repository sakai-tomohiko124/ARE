
const AREAuth = (() => {
    const functionUrl = (name) => `${ARE_CONFIG.supabaseUrl}/functions/v1/${name}`;

    async function callFunction(name, payload) {
        const response = await fetch(functionUrl(name), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": ARE_CONFIG.supabaseKey
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || result.message || "リクエストに失敗しました。");
        }

        return result;
    }

    async function login(loginId, password) {
        const result = await callFunction("login-user", {
            loginId,
            password
        });

        // Edge FunctionのcamelCaseをSupabase JSの形式へ変換する
        const accessToken = result.accessToken;
        const refreshToken = result.refreshToken;

        if (!accessToken || !refreshToken) {
            throw new Error("ログインAPIのセッション情報が不足しています。");
        }

        const expiresAtValue = result.expiresAt;
        let expiresAt = Number(expiresAtValue);

        if (!Number.isFinite(expiresAt)) {
            expiresAt = Math.floor(new Date(expiresAtValue).getTime() / 1000);
        }

        if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
            expiresAt = undefined;
        }

        const sessionResult = await window.areSupabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
        });

        if (sessionResult.error) {
            throw sessionResult.error;
        }

        return {
            ...result,
            session: sessionResult.data.session,
            user: sessionResult.data.user || result.user
        };
    }

    async function register(displayName, loginId, password, phoneNumber) {
        return callFunction("register-user", {
            displayName,
            loginId,
            password,
            phoneNumber
        });
    }

    async function recover(loginId, recoveryCode, newPassword) {
        return callFunction("recover-account", {
            loginId,
            recoveryCode,
            newPassword
        });
    }

    async function logout() {
        const result = await window.areSupabase.auth.signOut();

        if (result.error) {
            throw result.error;
        }
    }

    return {
        login,
        register,
        recover,
        logout
    };
})();

window.AREAuth = AREAuth;
