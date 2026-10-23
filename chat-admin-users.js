"use strict";

// ===== 管理者：アカウントの作成・編集 / Googleドライブ連携 =====
function userForm(prefix,v){
    return (v.loginId !== undefined ? '<label>ログインID</label><input id="' + prefix + 'Id" type="text" maxlength="50" autocomplete="off">' : '') +
        '<label>表示名（30文字まで）</label><input id="' + prefix + 'Name" type="text" maxlength="30" value="' + escapeHtml(v.name || "") + '">' +
        '<label>ステータスメッセージ</label><input id="' + prefix + 'Status" type="text" maxlength="60" value="' + escapeHtml(v.status || "") + '">' +
        '<label>自己紹介</label><textarea id="' + prefix + 'Bio" rows="2" maxlength="150">' + escapeHtml(v.bio || "") + '</textarea>' +
        '<label>電話番号（電話かメールのどちらかは必須）</label><input id="' + prefix + 'Phone" type="tel" maxlength="30" value="' + escapeHtml(v.phone || "") + '">' +
        '<label>メールアドレス</label><input id="' + prefix + 'Email" type="email" maxlength="254" value="' + escapeHtml(v.email || "") + '">';
}

function openCreateUser(){
    openSheet('<h3 style="margin:0">＋ 新規アカウントを作成</h3>' + userForm("cu",{loginId:""}) +
        '<label>初期パスワード（8文字以上・大文字／小文字／数字か記号を含む）</label><input id="cuPass" type="text" maxlength="72" autocomplete="off">' +
        '<div class="meta">作成後に表示される復旧コードと一緒に本人へ渡し、本人が「アカウント復旧」で自分のパスワードに変更するよう案内してください。</div>' +
        '<div class="row"><button type="button" class="button-secondary" data-pm="close">キャンセル</button><button type="button" class="button" data-a="create">作成</button></div>');
}

async function openEditUser(userId){
    openSheet('<div class="empty-list">読み込み中...</div>');
    try{
        const client = requireClient();
        const [p,contact] = await Promise.all([client.from(TABLES.profiles).select("*").eq("id",userId).maybeSingle(),client.rpc("admin_get_user_contact",{p_user_id:userId})]);
        if(p.error || !p.data) throw (p.error || new Error("ユーザーが見つかりません。"));
        const row = (contact.data && contact.data[0]) || {};
        openSheet('<h3 style="margin:0">✏️ アカウントを編集</h3><div class="meta">連絡先の閲覧は監査ログに記録されました。</div>' +
            userForm("eu",{name:p.data.display_name,status:p.data.status_message,bio:p.data.bio,phone:row.phone_number,email:row.contact_email}) +
            '<div class="row"><button type="button" class="button-secondary" data-a="resetpw" data-id="' + escapeHtml(userId) + '">パスワード再設定</button><button type="button" class="button-secondary" data-pm="close">キャンセル</button><button type="button" class="button" data-a="update" data-id="' + escapeHtml(userId) + '">保存</button></div>');
    }catch(error){ closeSheet(); showToast(featError(error)); }
}

async function onAdminAction(event){
    const b = event.target.closest("[data-a]");
    if(!b) return;
    const v = (id) => document.getElementById(id)?.value || "";
    const call = (payload) => window.ARESystem.callAuthenticatedFunction("admin-manage-user",payload);
    b.disabled = true;
    try{
        if(b.dataset.a === "create"){
            const problem = window.AREPasswordPolicy ? window.AREPasswordPolicy.problem(v("cuPass")) : null;
            if(problem){ showToast(problem); b.disabled = false; return; }
            const res = await call({action:"create",loginId:v("cuId"),password:v("cuPass"),displayName:v("cuName"),phoneNumber:v("cuPhone"),contactEmail:v("cuEmail")});
            if(v("cuStatus") || v("cuBio")) await call({action:"update",userId:res.userId,statusMessage:v("cuStatus"),bio:v("cuBio")});
            const code = escapeHtml(String(res.recoveryCode));
            openSheet('<h3 style="margin:0">アカウントを作成しました</h3><div class="meta">この復旧コードは、この画面を閉じると二度と表示できません。本人にだけ安全な方法で伝えてください。</div><div class="code-box">' + code + '</div><div class="row"><button type="button" class="button" data-copycode="' + code + '">コピー</button><button type="button" class="button-secondary" data-pm="close">閉じる（再表示不可）</button></div>');
            renderAdmin();
        }else if(b.dataset.a === "update"){
            await call({action:"update",userId:b.dataset.id,displayName:v("euName"),statusMessage:v("euStatus"),bio:v("euBio"),phoneNumber:v("euPhone"),contactEmail:v("euEmail")});
            closeSheet();
            showToast("更新しました。");
            renderAdmin();
        }else if(b.dataset.a === "resetpw"){
            const pw = window.prompt("新しいパスワード（8文字以上・大文字／小文字／数字か記号を含む）を入力してください。本人には通知が表示されます。","");
            if(pw === null){ b.disabled = false; return; }
            const note = window.prompt("本人確認の方法を入力してください（5文字以上・監査ログに記録されます）。","");
            if(note === null){ b.disabled = false; return; }
            await call({action:"reset-password",userId:b.dataset.id,newPassword:pw,note:note});
            showToast("パスワードを再設定しました。");
            b.disabled = false;
        }
    }catch(error){ b.disabled = false; showToast(isMissingBackend(error) ? "この機能は未実装です（サーバー側の準備ができていません）。" : (error?.message || "処理に失敗しました。")); }
}

async function renderAdminBackup(client){
    const st = await client.rpc("admin_export_token_status");
    if(st.error) throw st.error;
    const row = (st.data && st.data[0]) || null;
    el.adminBody.innerHTML = '<div class="admin-card"><b>Googleドライブ自動バックアップ（毎日）</b><div class="meta">Googleスプレッドシートの Apps Script（GAS）が毎日深夜0時台に、前日分の会話とログイン失敗の記録をZIPにして、指定のドライブフォルダへ保存します。設定手順は同梱の「GAS設定手順」を見てください。</div>' +
        '<div class="meta" style="margin-top:8px">現在のトークン：' + (row ? (row.active ? '有効（発行 ' + escapeHtml(formatDate(row.created_at)) + (row.last_used_at ? ' ・最終使用 ' + escapeHtml(formatDate(row.last_used_at)) : ' ・未使用') + '）' : '無効') : '未発行') + '</div>' +
        '<div class="row"><button class="button" data-bk="issue" type="button">トークンを発行（古いものは無効）</button><button class="button-secondary" data-bk="revoke" type="button">トークンを無効にする</button></div></div>' +
        '<div class="admin-card meta">トークンは発行時に1回だけ表示されます。GAS の「スクリプト プロパティ」にだけ保存し、他人に渡さないでください。このトークンを知っている人は、全会話の内容を読み出せます。ドライブのフォルダも、共有範囲を必要な人だけに限定してください。</div>';
}

async function onBackupClick(event){
    const b = event.target.closest("[data-bk]");
    if(!b) return;
    try{
        if(b.dataset.bk === "issue"){
            if(!window.confirm("トークンを新しく発行します。以前のトークンは使えなくなります。よろしいですか？")) return;
            const r = await requireClient().rpc("admin_issue_export_token");
            if(r.error) throw r.error;
            const code = escapeHtml(String(r.data));
            el.adminBody.innerHTML = '<div class="admin-card"><b>新しいバックアップ用トークン</b><div class="code-box">' + code + '</div><div class="meta">この画面を離れると二度と表示できません。GAS の「スクリプト プロパティ」の EXPORT_TOKEN に貼り付けてください。</div><div class="row"><button class="button" data-copycode="' + code + '" type="button">コピー</button><button class="button-secondary" data-admin-view="backup" type="button">完了（再表示不可）</button></div></div>';
        }else{
            if(!window.confirm("トークンを無効にします。GASによる自動バックアップは止まります。")) return;
            const r = await requireClient().rpc("admin_revoke_export_tokens");
            if(r.error) throw r.error;
            showToast("トークンを無効にしました。");
            renderAdmin();
        }
    }catch(error){ showToast(featError(error)); }
}
