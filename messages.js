
/* メッセージの描画と送信 */
window.AREMessages = (() => {
    let currentUserId = null;

    /* 現在のユーザーIDを設定 */
    function setCurrentUser(userId) {
        currentUserId = userId;
    }

    /* メッセージ一覧を描画 */
    function render(messages) {
        const list = document.getElementById("messageList");
        list.replaceChildren();

        if (!messages.length) {
            const empty = document.createElement("p");
            empty.className = "muted";
            empty.textContent = "最初のメッセージを送ってみましょう。";
            list.appendChild(empty);
            return;
        }

        messages.forEach(message => {
            const item = document.createElement("article");
            item.className = "message";
            item.classList.toggle("own", message.sender_id === currentUserId);

            const author = document.createElement("div");
            author.className = "message-author";
            author.textContent = message.display_name || "ユーザー";

            const content = document.createElement("div");
            content.textContent = message.content;

            const time = document.createElement("div");
            time.className = "message-time";
            time.textContent = window.AREUtils.formatTime(message.created_at);

            item.append(author, content, time);
            list.appendChild(item);
        });

        list.scrollTop = list.scrollHeight;
    }

    /* メッセージ送信を受け付ける */
    async function send(roomId, content) {
        if (!roomId || !content.trim()) {
            throw new Error("ルームとメッセージを指定してください。");
        }

        /* 実際のINSERT処理はDBスキーマ確認後に接続 */
        throw new Error("メッセージ保存用テーブルとの接続が未設定です。");
    }

    return { render, send, setCurrentUser };
})();
