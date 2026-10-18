
const AREMessages = (() => {
    let currentUser = null;
    let currentRoomId = null;
    let messages = [];

    function setCurrentUser(user) {
        currentUser = user;
    }

    function setCurrentRoom(roomId) {
        currentRoomId = roomId;
        messages = [];
        render();
    }

    function getMessages() {
        return messages;
    }

    function normalizeMessage(row) {
        return {
            id: row.id,
            roomId: row.room_id,
            senderId: row.sender_id,
            content: row.content,
            createdAt: row.created_at
        };
    }

    function addMessage(row) {
        if (!row || row.room_id !== currentRoomId) {
            return;
        }

        if (messages.some((message) => message.id === row.id)) {
            return;
        }

        messages.push(normalizeMessage(row));
        messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        render();
    }

    async function load(roomId) {
        currentRoomId = roomId;

        const result = await window.areSupabase
            .from("messages")
            .select("id, room_id, sender_id, content, created_at")
            .eq("room_id", roomId)
            .order("created_at", { ascending: true })
            .limit(200);

        if (result.error) {
            throw result.error;
        }

        messages = result.data.map(normalizeMessage);
        render();

        return messages;
    }

    async function send(content) {
        if (!currentUser?.id) {
            throw new Error("ログイン状態を確認してください。");
        }

        if (!currentRoomId) {
            throw new Error("送信先のルームを選択してください。");
        }

        const normalizedContent = String(content || "").trim();

        if (!normalizedContent) {
            throw new Error("メッセージを入力してください。");
        }

        if (normalizedContent.length > 2000) {
            throw new Error("メッセージは2000文字以内で入力してください。");
        }

        // DB関数側で認証・参加者・本文を検証して保存する
        const result = await window.areSupabase.rpc("send_message", {
            p_room_id: currentRoomId,
            p_content: normalizedContent
        });

        if (result.error) {
            throw result.error;
        }

        // RPCが保存済みメッセージを返した場合は画面へ反映する
        const savedMessage = Array.isArray(result.data) ? result.data[0] : result.data;

        if (savedMessage?.id && savedMessage?.room_id) {
            addMessage(savedMessage);
        } else {
            // 戻り値がbooleanなどの場合はDBから読み直す
            await load(currentRoomId);
        }

        return result.data;
    }

    function render() {
        const messageList = document.getElementById("messageList");

        if (!messageList) {
            return;
        }

        messageList.replaceChildren();

        for (const message of messages) {
            const item = document.createElement("div");
            const isOwnMessage = message.senderId === currentUser?.id;
            const content = document.createElement("p");
            const time = document.createElement("small");

            item.className = isOwnMessage ? "message own-message" : "message";
            content.textContent = message.content;
            time.textContent = window.AREUtils?.formatTime(message.createdAt) || "";

            item.append(content, time);
            messageList.appendChild(item);
        }

        messageList.scrollTop = messageList.scrollHeight;
    }

    return {
        setCurrentUser,
        setCurrentRoom,
        getMessages,
        load,
        send,
        addMessage,
        render
    };
})();

window.AREMessages = AREMessages;
