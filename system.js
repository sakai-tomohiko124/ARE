// frame-busting：他のサイトの枠(iframe)の中に埋め込まれて表示されたときは、単独のページとして開き直す
try { if (window.top !== window.self) { window.top.location = window.self.location; } } catch (e) { document.documentElement.style.display = "none"; }
(function () {
    "use strict";

    const DEFAULTS = Object.freeze({
        requestTimeoutMs: 20000
    });

    let supabaseClient = null;

    function getConfig() {
        const config = window.ARE_CONFIG;

        if (!config) {
            throw new Error("Supabaseの設定が読み込まれていません。apikey.jsをsystem.jsより先に読み込んでください。");
        }

        if (!config.supabaseUrl || !config.supabasePublishableKey) {
            throw new Error("SupabaseのURLまたはPublishable Keyが未設定です。apikey.jsを確認してください。");
        }

        return {
            ...config,
            functions: {
                ...(config.functions || {})
            },
            requestTimeoutMs: Number(config.requestTimeoutMs) > 0
                ? Number(config.requestTimeoutMs)
                : DEFAULTS.requestTimeoutMs
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

        if (!functionName || typeof functionName !== "string") {
            throw new Error("Edge Function名が未設定です。");
        }

        return `${config.supabaseUrl}/functions/v1/${functionName}`;
    }

    async function parseResponse(response) {
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
                body: JSON.stringify(payload || {}),
                signal: controller.signal
            });

            return await parseResponse(response);
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

        if (!config.functions.login) {
            throw new Error("ログイン用Edge Function名が未設定です。apikey.jsのfunctions.loginを設定してください。");
        }

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

    async function register(displayName, loginId, password, phoneNumber, contactEmail) {
        const normalizedDisplayName = String(displayName || "").trim();
        const normalizedLoginId = String(loginId || "").trim();
        const normalizedPhoneNumber = String(phoneNumber || "").trim();
        const normalizedContactEmail = String(contactEmail || "").trim();

        if (!normalizedDisplayName) {
            throw new Error("表示名を入力してください。");
        }

        if (!normalizedLoginId) {
            throw new Error("ログインIDを入力してください。");
        }

        if (!normalizedPhoneNumber && !normalizedContactEmail) {
            throw new Error("電話番号かメールアドレスのどちらか一方は必ず入力してください。");
        }

        if (!password || String(password).length < 8) {
            throw new Error("パスワードは8文字以上で入力してください。");
        }

        const config = getConfig();

        if (!config.functions.register) {
            throw new Error("登録用Edge Function名が未設定です。apikey.jsのfunctions.registerを設定してください。");
        }

        return callFunction(config.functions.register, {
            displayName: normalizedDisplayName,
            loginId: normalizedLoginId,
            password: password,
            phoneNumber: normalizedPhoneNumber,
            contactEmail: normalizedContactEmail
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

        if (!config.functions.recovery) {
            throw new Error("復旧用Edge Function名が未設定です。apikey.jsのfunctions.recoveryを設定してください。");
        }

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
        const result = await getClient().auth.getSession();

        if (result.error) {
            throw result.error;
        }

        return result.data.session || null;
    }

    async function getCurrentUser() {
        const result = await getClient().auth.getUser();

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

    async function getCurrentAccessToken() {
        const session = await getSession();
        return session?.access_token || null;
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

            return await parseResponse(response);
        } catch (error) {
            if (error.name === "AbortError") {
                throw new Error("サーバーからの応答がタイムアウトしました。");
            }

            if (error instanceof TypeError) {
                throw new Error("サーバーに接続できませんでした。通信状態とEdge Functionの設定を確認してください。");
            }

            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    function getTable(tableName) {
        if (!tableName || typeof tableName !== "string") {
            throw new Error("テーブル名が未設定です。利用するテーブル名を指定してください。");
        }

        return getClient().from(tableName);
    }

    async function selectRows(tableName, options) {
        const settings = options || {};
        let query = getTable(tableName).select(settings.columns || "*");

        if (settings.filters && typeof settings.filters === "function") {
            query = settings.filters(query);
        }

        if (settings.orderBy) {
            query = query.order(settings.orderBy, { ascending: settings.ascending !== false });
        }

        if (Number.isInteger(settings.limit) && settings.limit > 0) {
            query = query.limit(settings.limit);
        }

        const result = await query;

        if (result.error) {
            throw result.error;
        }

        return result.data || [];
    }

    async function insertRow(tableName, values, options) {
        if (!values || typeof values !== "object") {
            throw new Error("登録するデータが未設定です。");
        }

        const settings = options || {};
        let query = getTable(tableName).insert(values);

        if (settings.returning !== false) {
            query = query.select(settings.columns || "*");
        }

        const result = await query;

        if (result.error) {
            throw result.error;
        }

        return result.data || null;
    }

    async function updateRows(tableName, values, filters, options) {
        if (!values || typeof values !== "object") {
            throw new Error("更新するデータが未設定です。");
        }

        if (typeof filters !== "function") {
            throw new Error("更新対象を指定するfilters関数が未設定です。安全のため更新を中止しました。");
        }

        let query = getTable(tableName).update(values);
        query = filters(query);

        const settings = options || {};

        if (settings.returning !== false) {
            query = query.select(settings.columns || "*");
        }

        const result = await query;

        if (result.error) {
            throw result.error;
        }

        return result.data || null;
    }

    async function deleteRows(tableName, filters, options) {
        if (typeof filters !== "function") {
            throw new Error("削除対象を指定するfilters関数が未設定です。安全のため削除を中止しました。");
        }

        let query = getTable(tableName).delete();
        query = filters(query);

        const settings = options || {};

        if (settings.returning !== false) {
            query = query.select(settings.columns || "*");
        }

        const result = await query;

        if (result.error) {
            throw result.error;
        }

        return result.data || null;
    }

    function getStorageBucket(bucketName) {
        if (!bucketName || typeof bucketName !== "string") {
            // TODO：未設定。実際に作成するStorageバケット名を確認し、呼び出し側から指定してください。
            throw new Error("Storageバケット名が未設定です。Supabase Storageのバケット名を指定してください。");
        }

        return getClient().storage.from(bucketName);
    }

    async function uploadFile(bucketName, filePath, file, options) {
        if (!file) {
            throw new Error("アップロードするファイルが未設定です。");
        }

        if (!filePath || typeof filePath !== "string") {
            throw new Error("アップロード先のファイルパスが未設定です。");
        }

        const settings = options || {};
        const result = await getStorageBucket(bucketName).upload(filePath, file, {
            cacheControl: settings.cacheControl || "3600",
            upsert: settings.upsert === true,
            contentType: settings.contentType || file.type || undefined
        });

        if (result.error) {
            throw result.error;
        }

        return result.data;
    }

    async function removeStorageFiles(bucketName, filePaths) {
        if (!Array.isArray(filePaths) || filePaths.length === 0) {
            throw new Error("削除するStorageファイルのパスが未設定です。");
        }

        const result = await getStorageBucket(bucketName).remove(filePaths);

        if (result.error) {
            throw result.error;
        }

        return result.data || [];
    }

    async function createSignedUrl(bucketName, filePath, expiresInSeconds, options) {
        if (!filePath || typeof filePath !== "string") {
            throw new Error("署名付きURLを作成するファイルパスが未設定です。");
        }

        const expiresIn = Number(expiresInSeconds);

        if (!Number.isInteger(expiresIn) || expiresIn <= 0) {
            throw new Error("署名付きURLの有効秒数が未設定、または不正です。");
        }

        const settings = options || {};
        const result = await getStorageBucket(bucketName).createSignedUrl(filePath, expiresIn, {
            download: settings.download === true
        });

        if (result.error) {
            throw result.error;
        }

        return result.data?.signedUrl || null;
    }

    function subscribeToTable(options, callback) {
        const settings = options || {};

        if (!settings.channelName) {
            // TODO：未設定。画面ごとに重複しないチャンネル名を指定してください。
            throw new Error("Realtimeチャンネル名が未設定です。");
        }

        if (!settings.table) {
            // TODO：未設定。監視するテーブル名を確認して指定してください。
            throw new Error("Realtime監視対象テーブルが未設定です。");
        }

        if (typeof callback !== "function") {
            throw new Error("Realtimeイベントを受け取るコールバックが未設定です。");
        }

        const event = settings.event || "*";
        const schema = settings.schema || "public";
        const filter = settings.filter;

        let channel = getClient().channel(settings.channelName);

        channel = channel.on("postgres_changes", {
            event: event,
            schema: schema,
            table: settings.table,
            ...(filter ? { filter: filter } : {})
        }, callback);

        channel.subscribe();
        return channel;
    }

    async function removeRealtimeChannel(channel) {
        if (!channel) {
            return false;
        }

        const result = await getClient().removeChannel(channel);

        if (result && result.error) {
            throw result.error;
        }

        return true;
    }

    function getDisplayError(error, fallbackMessage) {
        if (error && typeof error.message === "string" && error.message.trim()) {
            return error.message;
        }

        return fallbackMessage || "予期しないエラーが発生しました。";
    }

    const AREAuth = Object.freeze({
        login: login,
        register: register,
        recover: recover,
        logout: logout,
        getSession: getSession,
        getCurrentUser: getCurrentUser,
        requireSession: requireSession,
        onAuthStateChange: onAuthStateChange,
        getCurrentAccessToken: getCurrentAccessToken
    });

    const ARESystem = Object.freeze({
        get client() {
            return getClient();
        },
        getConfig: getConfig,
        callFunction: callFunction,
        callAuthenticatedFunction: callAuthenticatedFunction,
        getSession: getSession,
        getCurrentUser: getCurrentUser,
        requireSession: requireSession,
        onAuthStateChange: onAuthStateChange,
        getCurrentAccessToken: getCurrentAccessToken,
        selectRows: selectRows,
        insertRow: insertRow,
        updateRows: updateRows,
        deleteRows: deleteRows,
        uploadFile: uploadFile,
        removeStorageFiles: removeStorageFiles,
        createSignedUrl: createSignedUrl,
        subscribeToTable: subscribeToTable,
        removeRealtimeChannel: removeRealtimeChannel,
        getDisplayError: getDisplayError
    });

    window.AREAuth = AREAuth;
    window.ARESystem = ARESystem;
})();
