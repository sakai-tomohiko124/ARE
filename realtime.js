
const ARERealtime = (() => {
    let activeChannel = null;

    async function unsubscribe() {
        if (!activeChannel) {
            return;
        }

        const channel = activeChannel;
        activeChannel = null;

        await window.areSupabase.removeChannel(channel);
    }

    async function subscribeToMessages(roomId) {
        await unsubscribe();

        const channel = window.areSupabase
            .channel(`are-messages-${roomId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `room_id=eq.${roomId}`
                },
                (payload) => {
                    window.AREMessages.addMessage(payload.new);
                }
            )
            .subscribe((status) => {
                const statusElement = document.getElementById("connectionStatus");

                if (!statusElement) {
                    return;
                }

                if (status === "SUBSCRIBED") {
                    statusElement.textContent = "リアルタイム接続中";
                } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                    statusElement.textContent = "リアルタイム接続エラー";
                } else {
                    statusElement.textContent = "接続中...";
                }
            });

        activeChannel = channel;
        return channel;
    }

    return {
        subscribeToMessages,
        unsubscribe
    };
})();

window.ARERealtime = ARERealtime;
