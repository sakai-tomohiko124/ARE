document.addEventListener("DOMContentLoaded", () => {
    const elements = {
        form: document.getElementById("recoveryForm"),
        loginId: document.getElementById("loginId"),
        recoveryCode: document.getElementById("recoveryCode"),
        newPassword: document.getElementById("newPassword"),
        confirmPassword: document.getElementById("confirmPassword"),
        button: document.getElementById("recoveryButton"),
        status: document.getElementById("recoveryStatus"),
        successPanel: document.getElementById("successPanel"),
        goToLogin: document.getElementById("goToLogin"),
        backToLogin: document.getElementById("backToLogin")
    };

    function showStatus(message, isError = false) {
        elements.status.textContent = message;
        elements.status.dataset.state = isError ? "error" : "success";
    }

    elements.form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const loginId = elements.loginId.value.trim();
        const recoveryCode = elements.recoveryCode.value.trim();
        const newPassword = elements.newPassword.value;
        const confirmPassword = elements.confirmPassword.value;

        if (!loginId || !recoveryCode) {
            showStatus("ログインIDと復旧コードを入力してください。", true);
            return;
        }

        const passwordProblem = window.AREPasswordPolicy ? window.AREPasswordPolicy.problem(newPassword) : (newPassword.length < 8 ? "新しいパスワードは8文字以上で入力してください。" : null);
        if (passwordProblem) {
            showStatus(passwordProblem, true);
            elements.newPassword.focus();
            return;
        }

        if (newPassword !== confirmPassword) {
            showStatus("新しいパスワードが一致しません。入力内容を確認してください。", true);
            elements.confirmPassword.focus();
            return;
        }

        if (!window.AREAuth || typeof window.AREAuth.recover !== "function") {
            showStatus("system.js の読み込み、またはアカウント復旧機能の初期化に失敗しました。", true);
            return;
        }

        elements.button.disabled = true;
        elements.successPanel.hidden = true;
        showStatus("アカウントを復旧しています...");

        try {
            await window.AREAuth.recover(loginId, recoveryCode, newPassword);
            elements.newPassword.value = "";
            elements.confirmPassword.value = "";
            elements.recoveryCode.value = "";
            elements.successPanel.hidden = false;
            showStatus("復旧処理が完了しました。新しいパスワードでログインしてください。");
        } catch (error) {
            showStatus(error?.message || "アカウント復旧に失敗しました。ログインIDと復旧コードを確認してください。", true);
        } finally {
            elements.button.disabled = false;
        }
    });

    elements.goToLogin.addEventListener("click", () => {
        window.location.replace("./login.html");
    });

    elements.backToLogin.addEventListener("click", () => {
        window.location.href = "./login.html";
    });
});
