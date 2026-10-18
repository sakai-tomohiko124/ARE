
const ARERooms = (() => {
    let rooms = [];
    let selectedRoom = null;
    let currentUserId = null;

    function setCurrentUser(userId) {
        currentUserId = userId;
    }

    function setRooms(nextRooms) {
        rooms = nextRooms;
        render();
    }

    function getSelectedRoom() {
        return selectedRoom;
    }

    function getRooms() {
        return rooms;
    }

    async function loadRooms() {
        if (!currentUserId) {
            throw new Error("ログインユーザーが設定されていません。");
        }

        const client = window.areSupabase;

        // 自分が参加しているルームIDを取得する
        const memberResult = await client
            .from("chat_room_members")
            .select("room_id")
            .eq("user_id", currentUserId);

        if (memberResult.error) {
            throw memberResult.error;
        }

        const roomIds = [...new Set(memberResult.data.map((row) => row.room_id))];

        if (roomIds.length === 0) {
            setRooms([]);
            return [];
        }

        // 参加中のルーム情報を取得する
        const roomResult = await client
            .from("chat_rooms")
            .select("id, created_at")
            .in("id", roomIds)
            .order("created_at", { ascending: false });

        if (roomResult.error) {
            throw roomResult.error;
        }

        // 各ルームの参加者を取得する
        const allMembersResult = await client
            .from("chat_room_members")
            .select("room_id, user_id")
            .in("room_id", roomIds);

        if (allMembersResult.error) {
            throw allMembersResult.error;
        }

        const otherUserIds = [
            ...new Set(
                allMembersResult.data
                    .map((member) => member.user_id)
                    .filter((userId) => userId !== currentUserId)
            )
        ];

        let profiles = [];

        if (otherUserIds.length > 0) {
            const profileResult = await client
                .from("profiles")
                .select("id, display_name")
                .in("id", otherUserIds);

            if (profileResult.error) {
                throw profileResult.error;
            }

            profiles = profileResult.data;
        }

        const profileMap = new Map(
            profiles.map((profile) => [profile.id, profile.display_name])
        );

        const membersByRoom = new Map();

        for (const member of allMembersResult.data) {
            if (!membersByRoom.has(member.room_id)) {
                membersByRoom.set(member.room_id, []);
            }

            membersByRoom.get(member.room_id).push(member.user_id);
        }

        const nextRooms = roomResult.data.map((room) => {
            const memberIds = membersByRoom.get(room.id) || [];
            const otherUserId = memberIds.find((userId) => userId !== currentUserId);
            const displayName = profileMap.get(otherUserId) || "ユーザー";

            return {
                id: room.id,
                createdAt: room.created_at,
                otherUserId,
                name: displayName
            };
        });

        setRooms(nextRooms);

        if (selectedRoom) {
            selectedRoom = nextRooms.find((room) => room.id === selectedRoom.id) || null;
        }

        render();
        return nextRooms;
    }

    function selectRoom(roomId) {
        selectedRoom = rooms.find((room) => room.id === roomId) || null;
        render();

        if (selectedRoom) {
            window.dispatchEvent(
                new CustomEvent("are:room-selected", {
                    detail: { room: selectedRoom }
                })
            );
        }
    }

    function render() {
        const roomList = document.getElementById("roomList");

        if (!roomList) {
            return;
        }

        roomList.replaceChildren();

        if (rooms.length === 0) {
            const emptyItem = document.createElement("li");
            emptyItem.textContent = "ルームがありません";
            roomList.appendChild(emptyItem);
            return;
        }

        for (const room of rooms) {
            const item = document.createElement("li");
            const button = document.createElement("button");

            button.type = "button";
            button.textContent = room.name;
            button.className = room.id === selectedRoom?.id ? "active" : "";
            button.addEventListener("click", () => selectRoom(room.id));

            item.appendChild(button);
            roomList.appendChild(item);
        }
    }

    return {
        setCurrentUser,
        setRooms,
        getRooms,
        getSelectedRoom,
        loadRooms,
        selectRoom,
        render
    };
})();

window.ARERooms = ARERooms;
