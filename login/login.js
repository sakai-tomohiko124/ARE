document.addEventListener("DOMContentLoaded", () => {
            const elements = {
                loginView: document.getElementById("loginView"),
                loginForm: document.getElementById("loginForm"),
                loginButton: document.getElementById("loginButton"),
                loginStatus: document.getElementById("loginStatus"),
                loginId: document.getElementById("loginId"),
                loginPassword: document.getElementById("loginPassword"),
                chatView: document.getElementById("chatView"),
                signedInUser: document.getElementById("signedInUser"),
                chatStatus: document.getElementById("chatStatus"),
                logoutButton: document.getElementById("logoutButton")
            };

            function showStatus(element, message, isError = false) {
                element.textContent = message;
                element.dataset.state = isError ? "error" : "success";
            }

            function showView(viewName) {
                elements.loginView.hidden = viewName !== "login";
                elements.chatView.hidden = viewName !== "chat";
            }

            function openRegistration() {
                window.location.href = "./register.html";
            }

            function openRecovery() {
                window.location.href = "./recovery.html";
            }

            function showChat(user) {
                showView("chat");

                const displayName = user?.user_metadata?.display_name
                    || user?.user_metadata?.displayName
                    || user?.email
                    || "ログインユーザー";

                elements.signedInUser.textContent = `${displayName} さん`;
                showStatus(elements.chatStatus, "ログインしました。");
            }

            document.getElementById("showRegister").addEventListener("click", openRegistration);
            document.getElementById("showRecovery").addEventListener("click", openRecovery);

            elements.loginForm.addEventListener("submit", async (event) => {
                event.preventDefault();

                if (!window.AREAuth || typeof window.AREAuth.login !== "function") {
                    showStatus(
                        elements.loginStatus,
                        "system.js の読み込み、またはログイン機能の初期化に失敗しました。",
                        true
                    );
                    return;
                }

                const loginId = elements.loginId.value.trim();
                const password = elements.loginPassword.value;

                elements.loginButton.disabled = true;
                showStatus(elements.loginStatus, "ログインしています...");

                try {
                    const result = await window.AREAuth.login(loginId, password);
                    const user = result?.user || result?.session?.user;

                    if (!user?.id) {
                        throw new Error("ログイン結果からユーザー情報を取得できませんでした。");
                    }

                    elements.loginPassword.value = "";
                    showChat(user);
                } catch (error) {
                    showStatus(
                        elements.loginStatus,
                        error?.message || "ログインに失敗しました。",
                        true
                    );
                } finally {
                    elements.loginButton.disabled = false;
                }
            });

            elements.logoutButton.addEventListener("click", async () => {
                try {
                    if (window.AREAuth && typeof window.AREAuth.logout === "function") {
                        await window.AREAuth.logout();
                    }

                    elements.loginForm.reset();
                    showView("login");
                    showStatus(elements.loginStatus, "ログアウトしました。");
                } catch (error) {
                    showStatus(
                        elements.chatStatus,
                        error?.message || "ログアウトに失敗しました。",
                        true
                    );
                }
            });

            // 保存済みセッションがあればログイン画面を省略する
            async function restoreSession() {
                try {
                    if (!window.AREAuth || typeof window.AREAuth.getSession !== "function") {
                        showView("login");
                        return;
                    }

                    const result = await window.AREAuth.getSession();
                    const session = result?.session || result?.data?.session;
                    const user = session?.user || result?.user;

                    if (user?.id) {
                        showChat(user);
                    } else {
                        showView("login");
                    }
                } catch (error) {
                    showView("login");
                    showStatus(
                        elements.loginStatus,
                        "保存済みのログイン状態を確認できませんでした。再度ログインしてください。",
                        true
                    );
                }
            }

            restoreSession();
        });
