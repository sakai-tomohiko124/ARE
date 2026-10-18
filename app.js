document.addEventListener("DOMContentLoaded", () => {
    const elements = {
        loginForm: document.getElementById("loginForm"),
        registerForm: document.getElementById("registerForm"),
        recoveryForm: document.getElementById("recoveryForm"),
        messageForm: document.getElementById("messageForm"),
        loginView: document.getElementById("loginView"),
        registerView: document.getElementById("registerView"),
        recoveryView: document.getElementById("recoveryView"),
        chatView: document.getElementById("chatView"),
        statusMessage: document.getElementById("statusMessage"),
        messageInput: document.getElementById("messageInput"),
        currentRoomName: document.getElementById("currentRoomName")
    };

    function showStatus(message, isError = false) {
        if (!elements.statusMessage) {
            return;
        }

        elements.statusMessage.textContent = message;
        elements.statusMessage.dataset.state = isError ? "error" : "success";
    }

    function showView(viewName) {
        const views = {
            login: elements.loginView,
            register: elements.registerView,
            recovery: elements.recoveryView,
            chat: elements.chatView
        };

        Object.entries(views).forEach(([name, element]) => {
            if (element) {
                element.hidden = name !== viewName;
            }
        });
    }

    async function openChat(user) {
        if (!user?.id) {
            throw new Error("ログインユーザー情報を取得できませんでした。");
        }

        AREMessages.setCurrentUser(user);
        ARERooms.setCurrentUser(user.id);

        showView("chat");
        showStatus("ルーム一覧を読み込んでいます...");

        await ARERooms.loadRooms();

        showStatus("ログインしました。");
    }

    if (elements.loginForm) {
        elements.loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const formData = new FormData(elements.loginForm);
            const loginId = String(formData.get("loginId") || "").trim();
            const password = String(formData.get("password") || "");

            try {
                showStatus("ログインしています...");

                const result = await AREAuth.login(loginId, password);
                const user = result.user || result.session?.user;

                if (!user?.id) {
                    throw new Error("ログインAPIからユーザーIDを取得できませんでした。");
                }

                await openChat(user);
            } catch (error) {
                showStatus(error.message || "ログインに失敗しました。", true);
            }
        });
    }

    if (elements.registerForm) {
        elements.registerForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const formData = new FormData(elements.registerForm);

            try {
                showStatus("アカウントを作成しています...");

                const result = await AREAuth.register(
                    String(formData.get("displayName") || "").trim(),
                    String(formData.get("loginId") || "").trim(),
                    String(formData.get("password") || ""),
                    String(formData.get("phoneNumber") || "").trim()
                );

                showStatus(
                    result.recoveryCode
                        ? `登録完了。復旧コードを安全な場所に保存してください: ${result.recoveryCode}`
                        : result.message || "登録が完了しました。"
                );
            } catch (error) {
                showStatus(error.message || "登録に失敗しました。", true);
            }
        });
    }

    if (elements.recoveryForm) {
        elements.recoveryForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const formData = new FormData(elements.recoveryForm);

            try {
                showStatus("アカウントを復旧しています...");

                const result = await AREAuth.recover(
                    String(formData.get("loginId") || "").trim(),
                    String(formData.get("recoveryCode") || "").trim(),
                    String(formData.get("newPassword") || "")
                );

                showStatus(result.message || "パスワードを更新しました。");
            } catch (error) {
                showStatus(error.message || "アカウント復旧に失敗しました。", true);
            }
        });
    }

    if (elements.messageForm) {
        elements.messageForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const content = elements.messageInput?.value || "";

            try {
                await AREMessages.send(content);
                elements.messageInput.value = "";
                elements.messageInput.focus();
            } catch (error) {
                showStatus(error.message || "メッセージを送信できませんでした。", true);
            }
        });
    }

    window.addEventListener("are:room-selected", async (event) => {
        const room = event.detail?.room;

        if (!room) {
            return;
        }

        if (elements.currentRoomName) {
            elements.currentRoomName.textContent = room.name;
        }

        try {
            AREMessages.setCurrentRoom(room.id);
            showStatus("メッセージを読み込んでいます...");

            await AREMessages.load(room.id);
            await ARERealtime.subscribeToMessages(room.id);

            showStatus("ルームに接続しました。");
        } catch (error) {
            showStatus(error.message || "ルームを開けませんでした。", true);
        }
    });

    // 既存のログアウトボタンがある場合に利用する
    document.getElementById("logoutButton")?.addEventListener("click", async () => {
        try {
            await ARERealtime.unsubscribe();
            await AREAuth.logout();

            ARERooms.setCurrentUser(null);
            AREMessages.setCurrentUser(null);

            showView("login");
            showStatus("ログアウトしました。");
        } catch (error) {
            showStatus(error.message || "ログアウトに失敗しました。", true);
        }
    });

    // ページ再読み込み後も有効なセッションがあれば復元する
    window.areSupabase.auth.getSession().then(async ({ data, error }) => {
        if (error) {
            showStatus("セッションを確認できませんでした。", true);
            return;
        }

        if (data.session?.user) {
            try {
                await openChat(data.session.user);
            } catch (sessionError) {
                showStatus(sessionError.message || "チャットを初期化できませんでした。", true);
            }
        } else {
            showView("login");
        }
    });
});
