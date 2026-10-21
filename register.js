document.addEventListener("DOMContentLoaded", () => {
    const elements = {
        form: document.getElementById("registerForm"),
        displayName: document.getElementById("displayName"),
        loginId: document.getElementById("loginId"),
        phoneNumber: document.getElementById("phoneNumber"),
        password: document.getElementById("password"),
        confirmPassword: document.getElementById("confirmPassword"),
        button: document.getElementById("registerButton"),
        status: document.getElementById("registerStatus"),
        recoveryPanel: document.getElementById("recoveryCodePanel"),
        recoveryCode: document.getElementById("recoveryCode"),
        copyButton: document.getElementById("copyRecoveryCode"),
        copyStatus: document.getElementById("copyStatus"),
        continueButton: document.getElementById("continueButton"),
        backButton: document.getElementById("backToLogin")
    };

    function showStatus(element, message, isError = false) {
        element.textContent = message;
        element.dataset.state = isError ? "error" : "success";
    }

    function findRecoveryCode(result) {
        const candidates = [
            result?.recoveryCode,
            result?.recovery_code,
            result?.data?.recoveryCode,
            result?.data?.recovery_code,
            result?.user?.recoveryCode,
            result?.user?.recovery_code
        ];
        return candidates.find((value) => typeof value === "string" && value.trim()) || "";
    }

    elements.form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const displayName = elements.displayName.value.trim();
        const loginId = elements.loginId.value.trim();
        const phoneNumber = elements.phoneNumber.value.trim();
        const password = elements.password.value;
        const confirmPassword = elements.confirmPassword.value;

        if (!displayName || !loginId) {
            showStatus(elements.status, "表示名とログインIDを入力してください。", true);
            return;
        }

        if (password.length < 8) {
            showStatus(elements.status, "パスワードは8文字以上で入力してください。", true);
            return;
        }

        if (password !== confirmPassword) {
            showStatus(elements.status, "パスワードが一致しません。入力内容を確認してください。", true);
            elements.confirmPassword.focus();
            return;
        }

        if (!window.AREAuth || typeof window.AREAuth.register !== "function") {
            showStatus(elements.status, "system.js の読み込み、または登録機能の初期化に失敗しました。", true);
            return;
        }

        elements.button.disabled = true;
        showStatus(elements.status, "アカウントを作成しています...");
        elements.recoveryPanel.hidden = true;

        try {
            const result = await window.AREAuth.register(displayName, loginId, password, phoneNumber);
            const recoveryCode = findRecoveryCode(result);

            elements.password.value = "";
            elements.confirmPassword.value = "";

            if (recoveryCode) {
                elements.recoveryCode.textContent = recoveryCode;
                elements.recoveryPanel.hidden = false;
                showStatus(elements.status, "登録が完了しました。復旧コードを安全な場所に保存してください。");
            } else {
                showStatus(elements.status, "登録処理は完了しましたが、復旧コードが応答に含まれていません。Edge Function の返却形式を確認してください。", true);
            }
        } catch (error) {
            showStatus(elements.status, error?.message || "登録に失敗しました。入力内容を確認してください。", true);
        } finally {
            elements.button.disabled = false;
        }
    });

    elements.copyButton.addEventListener("click", async () => {
        const recoveryCode = elements.recoveryCode.textContent;
        if (!recoveryCode) {
            showStatus(elements.copyStatus, "コピーする復旧コードがありません。", true);
            return;
        }

        try {
            await navigator.clipboard.writeText(recoveryCode);
            showStatus(elements.copyStatus, "復旧コードをコピーしました。");
        } catch (error) {
            showStatus(elements.copyStatus, "自動コピーできませんでした。コードを選択して手動でコピーしてください。", true);
        }
    });

    elements.continueButton.addEventListener("click", () => {
        window.location.replace("./login.html");
    });

    elements.backButton.addEventListener("click", () => {
        window.location.href = "./login.html";
    });
});
