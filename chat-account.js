"use strict";

async function loadMySettings(){
    try{
        const mine = await requireClient().from(TABLES.profiles).select("read_receipts_enabled").eq("id",state.user.id).maybeSingle();
        if(!mine.error && mine.data) el.readReceiptToggle.checked = mine.data.read_receipts_enabled !== false;
        const notices = await requireClient().rpc("get_my_security_notices");
        if(!notices.error && notices.data && notices.data.length){
            const notice = notices.data[0];
            const when = formatDate(notice.occurred_at);
            if(notice.kind === "login_failures"){
                el.securityBanner.textContent = "⚠️ " + when + " ごろ、あなたのアカウントに複数回のログイン失敗がありました。心当たりがない場合は、「アカウント復旧」でパスワードを変更し、運営に連絡してください。";
                showToast("あなたのアカウントでログイン失敗がありました（マイページで確認）。");
            }else{
                const what = notice.kind === "password_reset_by_admin" ? "パスワードを再設定" : "復旧コードを再発行";
                el.securityBanner.textContent = "⚠️ " + when + " に、管理者があなたの" + what + "しました。心当たりがない場合は、すぐに運営に連絡してください。";
                showToast("管理者により" + what + "されました（マイページで確認）。");
            }
            el.securityBanner.hidden = false;
        }
    }catch(_e){}
}


// ===== プロフィール / ステータスメッセージ / 投稿 / アカウント削除 =====

async function loadMyDeletion(){
    try{
        const r = await requireClient().from("account_deletion_requests").select("id,status,created_at").eq("status","pending").maybeSingle();
        const pending = !r.error && r.data;
        el.delRequestButton.hidden = Boolean(pending);
        el.delCancelButton.hidden = !pending;
        el.delStatus.textContent = pending ? "削除を申請中です（" + formatDate(r.data.created_at) + "）。管理者の承認後に、アカウントとデータが完全に削除されます。" : "削除を申請すると、管理者の承認後にアカウントとデータが完全に削除されます（元に戻せません）。";
    }catch(_e){}
}

async function requestMyDeletion(){
    const reason = window.prompt("アカウントの削除を申請します。管理者が承認すると、アカウントと投稿・会話などが完全に削除され、元に戻せません。\n\n理由（任意）を入力してください。","");
    if(reason === null) return;
    if(!window.confirm("本当に削除を申請しますか？")) return;
    try{
        const r = await requireClient().rpc("request_account_deletion",{p_reason:reason});
        if(r.error) throw r.error;
        showToast("削除を申請しました。管理者の承認をお待ちください。"); loadMyDeletion();
    }catch(error){ showToast(featError(error)); }
}

async function cancelMyDeletion(){
    try{
        const r = await requireClient().rpc("cancel_account_deletion_request");
        if(r.error) throw r.error;
        showToast("申請を取り消しました。"); loadMyDeletion();
    }catch(error){ showToast(featError(error)); }
}
