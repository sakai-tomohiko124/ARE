
/* AREアプリの初期化と画面制御 */
document.addEventListener("DOMContentLoaded", () => {
    const viewIds = ["loginView", "registerView", "recoveryView", "chatView"];
    const statusElement = document.getElementById("statusMessage");

    /* 指定画面だけを表示 */
    function showView(viewId) {
        viewIds.forEach(id => {
            document.getElementById(id).classList.toggle("hidden", id !== viewId);
        });
    }

    /* 結果メッセージを表示 */
    function showStatus(text) {
        statusElement.textContent = text;
    }

    /* 二重送信を防ぎながら処理 */
    async function run(button, action) {
        button.disabled = true;

        try {
            await action();
        } catch (error) {
            showStatus(error.message || "処理に失敗しました。");
        } finally {
            button.disabled = false;
        }
    }

    /* ログイン */
    document.getElementById("loginForm").addEventListener("submit", event => {
        event.preventDefault();

        run(document.getElementById("loginButton"), async () => {
            const loginId = document.getElementById("loginId").value.trim();
            const password = document.getElementById("loginPassword").value;
            const result = await window.AREAuth.login(loginId, password);

            /* APIの応答形式を確認してからセッション処理を接続 */
            if (!result.access_token || !result.refresh_token) {
                showStatus("API応答を受信しました。認証セッション形式の確認が必要です。");
                return;
            }

            const { error } = await window.areSupabase.auth.setSession({
                access_token: result.access_token,
                refresh_token: result.refresh_token
            });

            if (error) {
                throw error;
            }

            showView("chatView");
            showStatus("ログインしました。ルーム接続は次の設定で有効化します。");
        });
    });

    /* 新規登録 */
    document.getElementById("registerForm").addEventListener("submit", event => {
        event.preventDefault();

        run(document.getElementById("registerButton"), async () => {
            const result = await window.AREAuth.register(
                document.getElementById("displayName").value.trim(),
                document.getElementById("newLoginId").value.trim(),
                document.getElementById("newPassword").value,
                document.getElementById("phone").value.trim()
            );

            showStatus(
                result.recoveryCode
                    ? `登録成功。復旧コードを安全な場所に保存してください: ${result.recoveryCode}`
                    : result.message || "登録リクエストが完了しました。"
            );

            showView("loginView");
        });
    });

    /* アカウント復旧 */
    document.getElementById("recoveryForm").addEventListener("submit", event => {
        event.preventDefault();

        run(document.getElementById("recoveryButton"), async () => {
            await window.AREAuth.recover(
                document.getElementById("recoveryLoginId").value.trim(),
                document.getElementById("recoveryCode").value.trim(),
                document.getElementById("recoveryPassword").value
            );

            showStatus("復旧リクエストが完了しました。新しいパスワードでログインしてください。");
            showView("loginView");
        });
    });

    /* 画面切り替えボタン */
    document.getElementById("showRegister").addEventListener("click", () => showView("registerView"));
    document.getElementById("showRecovery").addEventListener("click", () => showView("recoveryView"));

    document.querySelectorAll("[data-view]").forEach(button => {
        button.addEventListener("click", () => showView(button.dataset.view));
    });

    /* ログアウト */
    document.getElementById("logoutButton").addEventListener("click", async () => {
        window.ARERealtime.unsubscribe();
        await window.areSupabase.auth.signOut();
        showView("loginView");
        showStatus("ログアウトしました。");
    });

    /* ルーム作成はDBの仕様確認後に接続 */
    document.getElementById("createRoomButton").addEventListener("click", () => {
        showStatus("ルーム作成機能はDBスキーマ確認後に有効化します。");
    });

    /* メッセージ送信 */
    document.getElementById("messageForm").addEventListener("submit", event => {
        event.preventDefault();

        const room = window.ARERooms.getSelectedRoom();
        const input = document.getElementById("messageInput");

        run(document.getElementById("sendButton"), async () => {
            await window.AREMessages.send(room?.id, input.value);
            input.value = "";
        });
    });

    /* 初期画面 */
    showView("loginView");
});
