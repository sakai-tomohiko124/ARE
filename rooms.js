
/* チャットルームの表示と選択 */
window.ARERooms = (() => {
    let rooms = [];
    let selectedRoom = null;

    /* ルーム一覧を画面に描画 */
    function render() {
        const list = document.getElementById("roomList");
        list.replaceChildren();

        if (rooms.length === 0) {
            const empty = document.createElement("p");
            empty.className = "muted";
            empty.textContent = "ルームはまだありません。";
            list.appendChild(empty);
            return;
        }

        rooms.forEach(room => {
            const button = document.createElement("button");
            button.className = "room-item";
            button.textContent = room.name;
            button.classList.toggle("active", selectedRoom?.id === room.id);

            button.addEventListener("click", () => {
                selectedRoom = room;
                render();
                window.dispatchEvent(new CustomEvent("are:room-selected", {
                    detail: room
                }));
            });

            list.appendChild(button);
        });
    }

    /* DBから取得したルームを設定 */
    function setRooms(nextRooms) {
        rooms = Array.isArray(nextRooms) ? nextRooms : [];
        render();
    }

    /* 選択中のルームを取得 */
    function getSelectedRoom() {
        return selectedRoom;
    }

    return { setRooms, getSelectedRoom, render };
})();
