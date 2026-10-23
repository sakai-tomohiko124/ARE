"use strict";

const STATUS_LABELS = {online:"オンライン",busy:"取り込み中",in_call:"通話中",away:"待機中"};

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

const IDLE_MS = 5 * 60 * 1000;

const FEAT_ERRORS = {
    already_requested:"すでに削除を申請済みです。", not_allowed:"この操作はできません。", only_text_editable:"テキストのメッセージのみ編集できます。",
    room_suspended:"このチャットは停止中です。", send_at_out_of_range:"送信日時は30秒後〜30日以内で指定してください。",
    too_many_scheduled:"予約は最大50件までです。", forbidden:"管理者権限がありません。", message_length_invalid:"メッセージの長さが正しくありません。",
    request_not_pending:"この申請はすでに処理されています。",
    reason_required:"理由を5文字以上で入力してください。", confirm_mismatch:"確認用の表示名が一致しません。", already_requested:"すでに削除を申請済みです。",
    group_name_invalid:"グループ名は1〜40文字で入力してください。", group_members_invalid:"メンバーは1〜49人まで選んでください。", notice_too_long:"注意事項は500文字以内です。",
    link_title_invalid:"リンクの名前は1〜60文字で入力してください。", link_url_invalid:"リンクは https:// で始まるURLを入力してください。", too_many_links:"リンクは20件までです。",
    poll_question_invalid:"質問は1〜100文字で入力してください。", poll_options_invalid:"選択肢は2〜6個（各50文字以内）で入力してください。",
    post_too_long:"投稿は500文字以内で入力してください。", post_empty:"投稿の内容を入力してください。", invalid_image_path:"画像の保存先が正しくありません。",
    bio_too_long:"自己紹介は150文字以内です。", status_too_long:"ステータスメッセージは60文字以内です。", invalid_avatar_url:"アイコン画像のURLが正しくありません。", invalid_display_name:"表示名は1〜30文字で入力してください。",
    verification_note_required:"本人確認の方法を5文字以上で入力してください。", user_not_found:"対象のユーザーが見つかりません。",
    cannot_target_admin:"管理者アカウントは再発行の対象にできません。", rate_limited:"短時間に再発行しすぎです。時間をおいてください。"
};

const feat = {known:new Map(),readTimes:[],readKey:"",manual:"online",lastActivity:Date.now(),timers:[],partnerReadAt:null,pending:new Set(),editingId:null,isAdmin:false,adminView:"rooms"};
try{ const saved = localStorage.getItem("are_manual_status"); if(STATUS_LABELS[saved]) feat.manual = saved; }catch(_e){}

function featError(error){
    if(isMissingBackend(error)) return "この機能は未実装です（サーバー側の準備ができていません）。";
    const text = String(error?.message || "");
    for(const key in FEAT_ERRORS){ if(text.includes(key)) return FEAT_ERRORS[key]; }
    return getErrorMessage(error);
}
