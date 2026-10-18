
/* Supabase Realtimeの購読管理 */
window.ARERealtime = (() => {
    let activeChannel = null;

    /* メッセージ変更を購読 */
    function subscribeToMessages(roomId, onMessage) {
        unsubscribe();

        activeChannel = window.areSupabase
            .channel(`are-room-${roomId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "messages",
                    filter: `room_id=eq.${roomId}`
                },
                payload => onMessage(payload)
            )
            .subscribe(status => {
                const statusElement = document.getElementById("connectionStatus");
                statusElement.textContent = `Realtime: ${status}`;
            });

        return activeChannel;
    }

    /* 購読を解除 */
    function unsubscribe() {
        if (activeChannel) {
            window.areSupabase.removeChannel(activeChannel);
            activeChannel = null;
        }
    }

    return { subscribeToMessages, unsubscribe };
})();
