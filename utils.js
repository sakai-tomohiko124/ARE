
/* アプリ内で共有する便利関数 */
window.AREUtils = (() => {
    /* 時刻を日本語表示に変換 */
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

    /* 文字列の必須チェック */
    function requireText(value, label) {
        if (typeof value !== "string" || !value.trim()) {
            throw new Error(`${label}を入力してください。`);
        }

        return value.trim();
    }

    /* 公開する共通関数 */
    return { formatTime, requireText };
})();
