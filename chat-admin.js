"use strict";

function attachmentText(content){
    const item = parseMessageContent(content);
    if(item.type === "text") return escapeHtml(item.text || "");
    const url = safeHttpUrl(item.url);
    const label = "[" + escapeHtml(item.type) + "] " + escapeHtml(item.name || "添付");
    return url ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>' : label;
}

async function checkAdmin(){
    try{ const result = await requireClient().rpc("is_current_user_admin"); feat.isAdmin = result.data === true; }
    catch(_e){ feat.isAdmin = false; }
    el.adminTabButton.hidden = !feat.isAdmin;
    if(window.AREProtect) window.AREProtect.setExempt(feat.isAdmin);
    if(feat.isAdmin) el.delCard.hidden = true;
    if(feat.posts && feat.posts.length) renderPosts();
    if(feat.isAdmin){ refreshAdminBadge(); feat.timers.push(setInterval(refreshAdminBadge,30000)); }
}

async function refreshAdminBadge(){
    const result = await requireClient().rpc("admin_list_delete_requests",{p_status:"pending"});
    const acct = await requireClient().rpc("admin_list_account_deletion_requests");
    const total = (result.error ? 0 : result.data.length) + (acct.error ? 0 : acct.data.length);
    el.adminBadge.textContent = total ? String(total) : "";
}

async function renderAdmin(){
    el.adminBody.innerHTML = '<div class="empty-list">読み込み中...</div>';
    document.querySelectorAll("[data-admin-view]").forEach((b) => b.classList.toggle("active",b.dataset.adminView === feat.adminView));
    try{
        const client = requireClient();
        if(feat.adminView === "security"){
            await renderAdminSecurity(client);
        }else if(feat.adminView === "acctdel"){
            await renderAdminAcctDel(client);
        }else if(feat.adminView === "backup"){
            await renderAdminBackup(client);
        }else if(feat.adminView === "users"){
            await renderAdminUsers(client);
        }else if(feat.adminView === "stats"){
            await renderAdminStats(client);
        }else if(feat.adminView === "announce"){
            await renderAdminAnnounce(client);
        }else if(feat.adminView === "shop"){
            await renderAdminShop(client);
        }else if(feat.adminView === "ng"){
            await renderAdminNg(client);
        }else if(feat.adminView === "reports"){
            await renderAdminReports(client);
        }else if(feat.adminView === "requests"){
            const result = await client.rpc("admin_list_delete_requests",{p_status:"pending"});
            if(result.error) throw result.error;
            el.adminBody.innerHTML = result.data.length ? result.data.map((r) =>
                '<div class="admin-card"><div class="meta">' + escapeHtml(r.requester_name || "ユーザー") + ' ・ ' + escapeHtml(formatDate(r.created_at)) + '</div>' +
                '<div>' + attachmentText(r.message_content) + '</div><div class="meta">理由：' + escapeHtml(r.reason || "（なし）") + '</div>' +
                '<div class="row"><button class="button" data-decide="approve" data-id="' + escapeHtml(r.id) + '" type="button">承認して削除</button>' +
                '<button class="button-secondary" data-decide="reject" data-id="' + escapeHtml(r.id) + '" type="button">却下</button>' +
                '<button class="button-secondary" data-admin-room="' + escapeHtml(r.room_id) + '" type="button">会話を見る</button></div></div>').join("")
                : '<div class="empty-list">承認待ちの削除申請はありません。</div>';
        }else{
            const result = await client.rpc("admin_list_rooms",{p_limit:100});
            if(result.error) throw result.error;
            el.adminBody.innerHTML = result.data.length ? result.data.map((r) => {
                const title = (r.members || []).map((m) => m.name || "ユーザー").join(" ⇄ ");
                return '<button class="admin-card" data-admin-room="' + escapeHtml(r.room_id) + '" data-title="' + escapeHtml(title) + '" type="button"><b>' + escapeHtml(title) + '</b>' +
                    (r.suspended_at ? ' <span class="pending">（停止中）</span>' : '') +
                    '<div class="meta">' + escapeHtml(String(r.message_count)) + '件 ・ 最終：' + escapeHtml(r.last_message_at ? formatDate(r.last_message_at) : "なし") + '</div></button>';
            }).join("") : '<div class="empty-list">会話はまだありません。</div>';
        }
    }catch(error){ el.adminBody.innerHTML = '<div class="empty-list">' + escapeHtml(featError(error)) + '</div>'; }
}

async function openAdminRoom(roomId,title){
    el.adminBody.innerHTML = '<div class="empty-list">読み込み中...</div>';
    try{
        const result = await requireClient().rpc("admin_get_room_messages",{p_room_id:roomId,p_limit:300});
        if(result.error) throw result.error;
        const rows = result.data.slice().reverse();
        const readsResult = await requireClient().rpc("admin_get_room_reads",{p_room_id:roomId});
        const reads = readsResult.error ? [] : readsResult.data;
        const readLabel = (m) => {
            const partner = reads.find((x) => x.user_id !== m.sender_id);
            if(!partner) return "";
            const read = partner.last_read_at && new Date(partner.last_read_at).getTime() >= new Date(m.created_at).getTime();
            return read ? " ・既読" + (partner.read_receipts_enabled === false ? "（相手に既読を表示しない設定）" : "") : " ・未読";
        };
        el.adminBody.innerHTML = '<button class="button-secondary" data-back="1" type="button">← 一覧へ戻る</button><b>' + escapeHtml(title || "会話") + '</b>' +
            (rows.length ? rows.map((m) => '<div class="admin-card admin-msg' + (m.deleted_at ? ' deleted' : '') + '"><div class="meta">' + escapeHtml(m.sender_name || "ユーザー") + ' ・ ' + escapeHtml(formatDate(m.created_at)) +
                (m.edited_at ? ' ・編集済み' : '') + (m.deleted_at ? ' ・削除済み' : '') + readLabel(m) + '</div><div>' + attachmentText(m.content) + '</div></div>').join("") : '<div class="empty-list">メッセージはありません。</div>');
    }catch(error){ el.adminBody.innerHTML = '<div class="empty-list">' + escapeHtml(featError(error)) + '</div>'; }
}

async function renderAdminUsers(client){
    const result = await client.rpc("admin_list_profiles");
    if(result.error) throw result.error;
    el.adminBody.innerHTML = '<div class="row"><button class="button" id="adminCreateUser" type="button">＋ 新規アカウントを作成</button></div><div class="admin-card meta">復旧コードを失くした利用者に対する再発行です。必ず本人確認を行ってから実行してください。新しいコードは画面に1回だけ表示され、保存されません。旧コードは無効になり、利用者本人にも再発行の通知が表示されます。</div>' +
        (result.data.length ? result.data.map((u) =>
            '<div class="admin-card"><b>' + escapeHtml(u.display_name || "ユーザー") + '</b> <span class="meta">ID：' + escapeHtml(u.login_id || "-") + (u.last_seen_at ? ' ・最終オンライン：' + escapeHtml(formatDate(u.last_seen_at)) : '') + '</span>' +
            '<div class="row"><button class="button-secondary" data-contact="' + escapeHtml(u.user_id) + '" type="button">連絡先を表示（閲覧は記録されます）</button></div>' + (u.is_admin ? '<div class="meta">管理者アカウント（再発行不可）</div>' : '<div class="row"><button class="button-secondary" data-edituser="' + escapeHtml(u.user_id) + '" type="button">編集</button><button class="button-secondary" data-reissue="' + escapeHtml(u.user_id) + '" data-name="' + escapeHtml(u.display_name || "ユーザー") + '" type="button">復旧コードを再発行</button><button class="button-danger" data-deluser="' + escapeHtml(u.user_id) + '" data-name="' + escapeHtml(u.display_name || "ユーザー") + '" type="button">アカウントを削除</button></div>') + '</div>').join("")
            : '<div class="empty-list">ユーザーがいません。</div>');
}

async function reissueRecovery(userId,name){
    const note = window.prompt(name + " さんの復旧コードを再発行します。\n本人確認の方法を入力してください（5文字以上・監査ログに記録されます）。\n例：登録電話番号に電話して確認","");
    if(note === null) return;
    if(!window.confirm("本当に再発行しますか？\n・旧い復旧コードは使えなくなります\n・新しいコードは1回しか表示されません")) return;
    try{
        const result = await requireClient().rpc("admin_reissue_recovery_code",{p_user_id:userId,p_verification_note:note});
        if(result.error) throw result.error;
        const code = String(result.data);
        el.adminBody.innerHTML = '<div class="admin-card"><b>' + escapeHtml(name) + ' さんの新しい復旧コード</b><div class="code-box">' + escapeHtml(code) + '</div>' +
            '<div class="meta">この画面を閉じると二度と表示できません。本人確認が済んだ本人にだけ、安全な方法で伝えてください。このコードで対象アカウントのパスワードを変更できます。</div>' +
            '<div class="row"><button class="button" data-copycode="' + escapeHtml(code) + '" type="button">コピー</button><button class="button-secondary" data-codeclose="1" type="button">閉じる（再表示不可）</button></div></div>';
    }catch(error){ showToast(featError(error)); }
}

async function onAdminClick(event){
    const target = event.target.closest("button");
    if(!target) return;
    if(target.dataset.back) return renderAdmin();
    if(target.dataset.adminRoom) return openAdminRoom(target.dataset.adminRoom,target.dataset.title);
    if(target.dataset.contact){
        try{
            const result = await requireClient().rpc("admin_get_user_contact",{p_user_id:target.dataset.contact});
            if(result.error) throw result.error;
            const row = (result.data && result.data[0]) || {};
            const box = document.createElement("div");
            box.className = "meta";
            box.textContent = "電話：" + (row.phone_number || "未登録") + " ／ メール：" + (row.contact_email || "未登録");
            target.replaceWith(box);
        }catch(error){ showToast(featError(error)); }
        return;
    }
    if(target.id === "adminCreateUser") return openCreateUser();
    if(target.dataset.edituser) return openEditUser(target.dataset.edituser);
    if(target.dataset.deluser) return deleteAccount(target.dataset.deluser,target.dataset.name);
    if(target.dataset.reissue) return reissueRecovery(target.dataset.reissue,target.dataset.name);
    if(target.dataset.copycode){
        try{ await navigator.clipboard.writeText(target.dataset.copycode); showToast("コピーしました。"); }catch(_e){ showToast("コピーできませんでした。手動で選択してコピーしてください。"); }
        return;
    }
    if(target.dataset.codeclose){ feat.adminView = "users"; return renderAdmin(); }
    if(target.dataset.decide){
        const approve = target.dataset.decide === "approve";
        const note = window.prompt(approve ? "削除の理由メモ（任意）" : "却下の理由（任意）","");
        if(note === null) return;
        target.disabled = true;
        try{
            const result = await requireClient().rpc("admin_decide_delete_request",{p_request_id:target.dataset.id,p_approve:approve,p_note:note});
            if(result.error) throw result.error;
            showToast(approve ? "削除しました。" : "却下しました。");
            refreshAdminBadge(); renderAdmin();
        }catch(error){ target.disabled = false; showToast(featError(error)); }
    }
}

function deleteAccount(userId,name){
    feat.reqTarget = {uid:userId,name:name};
    openSheet('<h3 style="margin:0">アカウント削除の申請</h3><div><b>' + escapeHtml(name) + '</b> さんの削除申請を作成します。作成後に「アカウント削除」タブで承認すると完全に削除されます。</div>' +
        '<label for="drReason">削除の理由（2文字以上・記録されます）</label><textarea id="drReason" rows="3" maxlength="300"></textarea>' +
        '<div id="drErr" class="meta" style="color:#ff8a8a" role="alert"></div>' +
        '<div class="row" style="justify-content:stretch"><button type="button" class="button-danger" data-dr="submit">申請を作成</button><button type="button" class="button-secondary" data-pm="close">やめる</button></div>');
}

async function submitDeleteRequest(button){
    const t = feat.reqTarget, err = document.getElementById("drErr");
    const reason = (document.getElementById("drReason")?.value || "").trim();
    if(!t) return;
    if(reason.length < 2){ err.textContent = "理由を2文字以上で入力してください。"; return; }
    button.disabled = true; err.textContent = "申請を作成しています…";
    try{
        const result = await requireClient().rpc("admin_request_account_deletion",{p_user_id:t.uid,p_reason:reason});
        if(result.error) throw result.error;
        // 本当に保存されたか、一覧を取り直して確認する
        const check = await requireClient().rpc("admin_list_account_deletion_requests");
        if(check.error) throw check.error;
        if(!(check.data || []).some((r) => r.user_id === t.uid)) throw new Error("申請が一覧に反映されませんでした。");
        feat.reqTarget = null; closeSheet();
        feat.adminView = "acctdel"; renderAdmin(); refreshAdminBadge();
        showToast("削除申請を作成しました。内容を確認して「承認して完全削除」を押してください。");
    }catch(error){ button.disabled = false; err.textContent = "申請できませんでした：" + featError(error); }
}

async function renderAdminSecurity(client){
    const result = await client.rpc("admin_list_login_events",{p_limit:100});
    if(result.error) throw result.error;
    el.adminBody.innerHTML = '<div class="admin-card meta">既存のアカウントに対して、ログインに2回以上失敗した記録です（直近90日）。5回ごとに、回数と同じ分数（5回=5分、10回=10分…）だけ、ログインできなくなります。顔写真などは取得していません。入力されたパスワードも記録していません。本人にもマイページで通知されます。</div>' +
        (result.data.length ? result.data.map((r) => '<div class="admin-card"><b>' + escapeHtml(r.display_name || "ユーザー") + '</b> <span class="meta">ID：' + escapeHtml(r.login_id || "-") + ' ・ ' + escapeHtml(formatDate(r.occurred_at)) + '</span><div>' + escapeHtml(String(r.failed_count)) + '回失敗' + (r.lock_minutes > 0 ? '　→　' + escapeHtml(String(r.lock_minutes)) + '分間ログイン不可' : '') + '</div></div>').join("") : '<div class="empty-list">ログイン失敗の記録はありません。</div>');
}

async function renderAdminAcctDel(client){
    const result = await client.rpc("admin_list_account_deletion_requests");
    if(result.error) throw result.error;
    el.adminBody.innerHTML = '<div class="admin-card meta">承認すると、そのアカウントと関連データが完全に削除されます（元に戻せません）。承認前に、追跡ログをZIPで保存するかどうかを必ず確認します。</div>' +
        (result.data.length ? result.data.map((r) =>
            '<div class="admin-card"><b>' + escapeHtml(r.display_name || "ユーザー") + '</b> <span class="meta">ID：' + escapeHtml(r.login_id || "-") + ' ・ ' + (r.requested_by_admin ? '管理者が申請' : '本人が申請') + ' ・ ' + escapeHtml(formatDate(r.created_at)) + '</span>' +
            '<div class="meta">理由：' + escapeHtml(r.reason || "（記載なし）") + '</div><div class="row">' +
            '<button class="button-danger" data-acctdel="approve" data-id="' + escapeHtml(r.id) + '" data-uid="' + escapeHtml(r.user_id) + '" data-name="' + escapeHtml(r.display_name || "") + '" data-reason="' + escapeHtml(r.reason || "") + '" type="button">承認して完全削除</button>' +
            '<button class="button-secondary" data-acctdel="reject" data-id="' + escapeHtml(r.id) + '" type="button">却下</button></div></div>').join("")
            : '<div class="empty-list">承認待ちのアカウント削除申請はありません。</div>');
}

feat.delTarget = null;

function onAcctDelClick(event){
    const b = event.target.closest("[data-acctdel]");
    if(!b) return;
    if(b.dataset.acctdel === "reject"){
        const note = window.prompt("却下の理由（任意）","");
        if(note === null) return;
        requireClient().rpc("admin_reject_account_deletion",{p_request_id:b.dataset.id,p_note:note}).then((r) => {
            if(r.error) showToast(featError(r.error)); else { showToast("却下しました。"); renderAdmin(); refreshAdminBadge(); }
        });
        return;
    }
    feat.delTarget = {id:b.dataset.id,uid:b.dataset.uid,name:b.dataset.name,reason:b.dataset.reason};
    openSheet('<h3 style="margin:0">⚠️ アカウントの完全削除</h3><div><b>' + escapeHtml(b.dataset.name) + '</b> さんのアカウント、投稿、1対1の会話、添付ファイル、追跡ログを完全に削除します。元に戻せません。</div>' +
        '<label for="delConfirmName">確認のため、表示名「' + escapeHtml(b.dataset.name) + '」をそのまま入力してください</label><input id="delConfirmName" type="text" autocomplete="off">' +
        '<div class="admin-card"><b>追跡ログ（このアカウントに関する操作記録・復旧の試行記録）を、ZIPで保存しますか？</b><div class="meta">削除と同時に、サーバー上の追跡ログも消えます。残したい場合は先にZIPで保存してください。</div></div>' +
        '<div class="row" style="justify-content:stretch"><button type="button" class="button" data-d="zip">ZIPを保存してから削除</button><button type="button" class="button-danger" data-d="nozip">保存せずに削除</button><button type="button" class="button-secondary" data-pm="close">やめる</button></div>');
}

async function onDelSheet(event){
    const dr = event.target.closest("[data-dr]");
    if(dr) return submitDeleteRequest(dr);
    const b = event.target.closest("[data-d]");
    if(!b || !feat.delTarget) return;
    const t = feat.delTarget, typed = (document.getElementById("delConfirmName")?.value || "");
    if(typed !== t.name){ showToast("表示名が一致しないため、削除を中止しました。"); return; }
    el.profileSheet.querySelectorAll("button").forEach((x) => { x.disabled = true; });
    try{
        if(b.dataset.d === "zip"){
            const logs = await requireClient().rpc("admin_get_user_logs",{p_user_id:t.uid});
            if(logs.error) throw logs.error;
            const readme = "削除したアカウント（表示名）：" + t.name + "\nユーザーID：" + t.uid + "\n保存日時：" + new Date().toLocaleString("ja-JP") + "\n\naccount-logs.json に、このアカウントに関する操作記録（監査ログ）と復旧の試行記録を保存しています。\n";
            const enc = new TextEncoder();
            const blob = makeZip([{name:"README.txt",data:enc.encode("\uFEFF" + readme)},{name:"account-logs.json",data:enc.encode(JSON.stringify(logs.data,null,2))}]);
            const url = URL.createObjectURL(blob), a = document.createElement("a");
            a.href = url; a.download = "ARE追跡ログ_" + t.name.replace(/[\\/:*?"<>|]/g,"_") + "_" + new Date().toISOString().slice(0,10) + ".zip"; document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url),60000);
        }
        await window.ARESystem.callAuthenticatedFunction("admin-delete-user",{requestId:t.id,userId:t.uid,confirmName:t.name,reason:(t.reason && t.reason.length >= 5) ? t.reason : "利用者本人の申請による削除"});
        closeSheet(); feat.delTarget = null;
        showToast(t.name + " さんのアカウントを完全に削除しました。");
        renderAdmin(); refreshAdminBadge();
    }catch(error){
        el.profileSheet.querySelectorAll("button").forEach((x) => { x.disabled = false; });
        showToast(error?.message || featError(error));
    }
}
