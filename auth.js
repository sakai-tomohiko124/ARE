
/* 認証APIとの通信処理 */
window.AREAuth = (() => {
    const config = window.ARE_CONFIG;

    /* Edge FunctionをJSONで呼び出す */
    async function callFunction(functionName, payload) {
        const response = await fetch(
            `${config.supabaseUrl}/functions/v1/${functionName}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": config.supabasePublishableKey
                },
                body: JSON.stringify(payload)
            }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.message || result.error || "API通信に失敗しました。");
        }

        return result;
    }

    /* ログイン */
    async function login(loginId, password) {
        return callFunction(config.functions.login, {
            loginId,
            password
        });
    }

    /* 新規登録 */
    async function register(displayName, loginId, password, phone) {
        return callFunction(config.functions.register, {
            displayName,
            loginId,
            password,
            phone
        });
    }

    /* アカウント復旧 */
    async function recover(loginId, recoveryCode, newPassword) {
        return callFunction(config.functions.recovery, {
            loginId,
            recoveryCode,
            newPassword
        });
    }

    /* 公開する認証メソッド */
    return { login, register, recover };
})();
