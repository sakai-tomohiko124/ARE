"use strict";

// ===== グループチャット（名称・注意事項・リンク・アンケート） =====
feat.pickSel = new Map();
feat.pickExclude = [];

function pickList(excludeIds){
    feat.pickSel = new Map();
    feat.pickExclude = excludeIds || [];
    return '<input id="pkQ" type="search" placeholder="名前で検索して追加" autocomplete="off"><div class="meta" id="pkSel">選んだ人：なし</div><div class="pick" id="pkRes"><div class="meta">名前を入力すると候補が表示されます。</div></div>';
}
function pickedIds(){ return [...feat.pickSel.keys()]; }
function showPickSel(){
    const box = document.getElementById("pkSel");
    if(box) box.textContent = "選んだ人：" + (feat.pickSel.size ? [...feat.pickSel.values()].join("、") : "なし");
}
let pickTimer = null;
function onPickInput(event){
    if(event.target.id !== "pkQ") return;
    clearTimeout(pickTimer);
    pickTimer = setTimeout(async () => {
        const box = document.getElementById("pkRes");
        if(!box) return;
        const text = event.target.value.trim();
        if(!text){ box.innerHTML = '<div class="meta">名前を入力すると候補が表示されます。</div>'; return; }
        const result = await requireClient().from(TABLES.profiles).select("id,display_name").ilike("display_name","%" + escLike(text) + "%").neq("id",state.user.id).limit(20);
        if(result.error){ box.innerHTML = '<div class="meta">' + escapeHtml(featError(result.error)) + '</div>'; return; }
        const rows = (result.data || []).filter((p) => !feat.pickExclude.includes(p.id));
        box.innerHTML = rows.length ? rows.map((p) => '<label><input type="checkbox" data-pick="' + escapeHtml(p.id) + '" data-name="' + escapeHtml(profileDisplayName(p)) + '"' + (feat.pickSel.has(p.id) ? ' checked' : '') + '> ' + escapeHtml(profileDisplayName(p)) + '</label>').join("") : '<div class="meta">見つかりません。</div>';
    },250);
}
function onPickChange(event){
    const box = event.target.closest("[data-pick]");
    if(!box) return;
    if(box.checked) feat.pickSel.set(box.dataset.pick,box.dataset.name); else feat.pickSel.delete(box.dataset.pick);
    showPickSel();
}

function openGroupCreator(){
    openSheet('<h3 style="margin:0">👥 グループを作成</h3>' +
        '<label for="gName">グループ名（40文字まで）</label><input id="gName" type="text" maxlength="40">' +
        '<label for="gNotice">注意事項（任意・500文字まで）</label><textarea id="gNotice" rows="3" maxlength="500" placeholder="例：個人情報は書かないでください"></textarea>' +
        '<label>メンバーを選ぶ（1人以上）</label>' + pickList([]) +
        '<div class="row"><button type="button" class="button-secondary" data-pm="close">キャンセル</button><button type="button" class="button" data-g="create">作成</button></div>');
}

async function openGroupInfo(focusPollId){
    const room = state.currentRoom;
    if(!room || !room.is_group) return;
    openSheet('<div class="empty-list">読み込み中...</div>');
    await renderGroupInfo(room.id,focusPollId);
}

async function renderGroupInfo(roomId,focusPollId){
    const client = requireClient();
    const room = state.rooms.find((r) => r.id === roomId);
    if(!room) return;
    const owner = room.created_by === state.user.id;
    const [links,polls] = await Promise.all([
        client.from("room_links").select("id,title,url").eq("room_id",roomId).order("created_at"),
        client.from("polls").select("id,question,created_by,closed_at").eq("room_id",roomId).order("created_at",{ascending:false}).limit(10)]);
    if(links.error) throw links.error;
    if(polls.error) throw polls.error;
    await ensureMemberProfiles(room);
    const pollHtml = [];
    for(const poll of (polls.data || [])){
        const res = await client.rpc("get_poll_results",{p_poll_id:poll.id});
        const rows = res.data || [];
        const total = rows.reduce((s,r) => s + Number(r.votes),0);
        const mine = rows.find((r) => r.mine);
        pollHtml.push('<div class="admin-card" id="poll-' + escapeHtml(poll.id) + '"' + (poll.id === focusPollId ? ' style="border-color:var(--accent)"' : '') + '><b>' + escapeHtml(poll.question) + '</b>' + (poll.closed_at ? ' <span class="meta">（締切済み）</span>' : '') +
            rows.map((r) => '<div class="grp-opt"><button type="button" class="' + (r.mine ? 'button' : 'button-secondary') + '" ' + (poll.closed_at ? 'disabled' : 'data-g="vote" data-poll="' + escapeHtml(poll.id) + '" data-opt="' + escapeHtml(r.option_id) + '"') + '>' + escapeHtml(r.label) + (r.mine ? ' ✓' : '') + '　' + r.votes + '票</button><div class="grp-bar"><i style="width:' + (total ? Math.round(Number(r.votes) / total * 100) : 0) + '%"></i></div></div>').join("") +
            '<div class="meta">' + total + '票' + (mine ? ' ・ あなたの回答：' + escapeHtml(mine.label) : '') + '</div>' +
            ((!poll.closed_at && (owner || poll.created_by === state.user.id)) ? '<button type="button" class="button-secondary" data-g="closepoll" data-poll="' + escapeHtml(poll.id) + '">締め切る</button>' : '') + '</div>');
    }
    const members = (room.memberIds || []).map((id) => id === state.user.id ? "あなた" : profileDisplayName(feat.known.get(id))).join("、");
    openSheet('<h3 style="margin:0">👥 ' + escapeHtml(room.name || "グループ") + '</h3><div class="meta">メンバー ' + (room.memberIds || []).length + '人' + (owner ? ' ・ あなたが管理者です' : '') + '</div>' +
        '<div class="grp-sec"><h4>📌 注意事項</h4>' + (owner
            ? '<input id="gEditName" type="text" maxlength="40" value="' + escapeHtml(room.name || "") + '"><textarea id="gEditNotice" rows="3" maxlength="500">' + escapeHtml(room.notice || "") + '</textarea><button type="button" class="button" data-g="saveinfo">名前と注意事項を保存</button>'
            : '<div style="white-space:pre-wrap;overflow-wrap:anywhere">' + (room.notice ? escapeHtml(room.notice) : '<span class="meta">注意事項はありません。</span>') + '</div>') + '</div>' +
        '<div class="grp-sec"><h4>🔗 参考資料</h4>' + ((links.data || []).length ? links.data.map((l) => { const u = safeHttpUrl(l.url); return '<div class="grp-item"><span>' + (u ? '<a href="' + escapeHtml(u) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(l.title) + '</a>' : escapeHtml(l.title)) + '</span>' + (owner ? '<button type="button" class="hide-btn" data-g="rmlink" data-id="' + escapeHtml(l.id) + '">削除</button>' : '') + '</div>'; }).join("") : '<div class="meta">リンクはありません。</div>') +
            (owner ? '<input id="gLinkTitle" type="text" maxlength="60" placeholder="リンクの名前"><input id="gLinkUrl" type="text" maxlength="500" placeholder="https://..."><button type="button" class="button-secondary" data-g="addlink">リンクを追加</button>' : '') + '</div>' +
        '<div class="grp-sec"><h4>📊 アンケート</h4>' + (pollHtml.join("") || '<div class="meta">アンケートはありません。</div>') +
            '<input id="gPollQ" type="text" maxlength="100" placeholder="質問（例：集合はいつ？）"><textarea id="gPollOpts" rows="3" placeholder="選択肢を1行に1つ（2〜6個）"></textarea><button type="button" class="button-secondary" data-g="newpoll">アンケートを作成してチャットに投稿</button></div>' +
        '<div class="grp-sec"><h4>👤 メンバー</h4><div style="overflow-wrap:anywhere">' + escapeHtml(members) + '</div>' +
            (owner ? '<label>メンバーを追加</label>' + pickList(room.memberIds || []) + '<button type="button" class="button-secondary" data-g="addmembers">選んだ人を追加</button>' : '') + '</div>' +
        '<div class="row"><button type="button" class="button-danger" data-g="leave">グループを退出</button><button type="button" class="button-secondary" data-pm="close">閉じる</button></div>');
    if(focusPollId){ const target = document.getElementById("poll-" + focusPollId); if(target) target.scrollIntoView({block:"center"}); }
}

async function onGroupAction(event){
    const b = event.target.closest("[data-g]");
    if(!b) return;
    const client = requireClient(), act = b.dataset.g, room = state.currentRoom;
    const val = (id) => (document.getElementById(id)?.value || "");
    b.disabled = true;
    try{
        if(act === "create"){
            const r = await client.rpc("create_group",{p_name:val("gName"),p_member_ids:pickedIds(),p_notice:val("gNotice")});
            if(r.error) throw r.error;
            closeSheet();
            await loadRooms();
            const created = state.rooms.find((x) => x.id === r.data);
            if(created) await selectRoom(created,null);
            showToast("グループを作成しました。");
            return;
        }
        if(!room) return;
        if(act === "saveinfo"){
            const r = await client.rpc("update_group_info",{p_room_id:room.id,p_name:val("gEditName"),p_notice:val("gEditNotice")});
            if(r.error) throw r.error;
            await loadRooms();
            const fresh = state.rooms.find((x) => x.id === room.id);
            if(fresh){ state.currentRoom = fresh; el.chatTitle.textContent = fresh.name; }
            showToast("保存しました。");
        }else if(act === "addlink"){
            const r = await client.rpc("add_room_link",{p_room_id:room.id,p_title:val("gLinkTitle"),p_url:val("gLinkUrl")});
            if(r.error) throw r.error;
        }else if(act === "rmlink"){
            const r = await client.rpc("remove_room_link",{p_link_id:b.dataset.id});
            if(r.error) throw r.error;
        }else if(act === "newpoll"){
            const options = val("gPollOpts").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
            const r = await client.rpc("create_poll",{p_room_id:room.id,p_question:val("gPollQ"),p_options:options});
            if(r.error) throw r.error;
            await sendMessagePayload({type:"poll",pollId:r.data,question:val("gPollQ").trim()});
        }else if(act === "vote"){
            const r = await client.rpc("vote_poll",{p_poll_id:b.dataset.poll,p_option_id:b.dataset.opt});
            if(r.error) throw r.error;
        }else if(act === "closepoll"){
            const r = await client.rpc("close_poll",{p_poll_id:b.dataset.poll});
            if(r.error) throw r.error;
        }else if(act === "addmembers"){
            const ids = pickedIds();
            if(!ids.length){ showToast("追加する人を選んでください。"); b.disabled = false; return; }
            const r = await client.rpc("add_group_members",{p_room_id:room.id,p_member_ids:ids});
            if(r.error) throw r.error;
            await loadRooms();
            const fresh = state.rooms.find((x) => x.id === room.id);
            if(fresh) state.currentRoom = fresh;
            updateHeaderPresence();
        }else if(act === "leave"){
            if(!window.confirm("このグループを退出しますか？")){ b.disabled = false; return; }
            const r = await client.rpc("leave_group",{p_room_id:room.id});
            if(r.error) throw r.error;
            closeSheet();
            cleanupSubscription();
            state.currentRoom = null;
            state.currentPartner = null;
            el.app.classList.remove("chat-open");
            setChatEnabled(false);
            await loadRooms();
            showToast("グループを退出しました。");
            return;
        }
        await renderGroupInfo(room.id);
    }catch(error){ b.disabled = false; showToast(featError(error)); }
}
