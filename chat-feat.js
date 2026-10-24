"use strict";

const STATUS_LABELS = {online:"オンライン",busy:"取り込み中",in_call:"通話中",away:"待機中"};

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

const IDLE_MS = 5 * 60 * 1000;

const FEAT_ERRORS = {
    already_requested:"すでに削除を申請済みです。", not_allowed:"この操作はできません。", only_text_editable:"テキストのメッセージのみ編集できます。",
    room_suspended:"このチャットは停止中です。", send_at_out_of_range:"送信日時は30秒後〜30日以内で指定してください。",
    too_many_scheduled:"予約は最大50件までです。", forbidden:"管理者権限がありません。", message_length_invalid:"メッセージの長さが正しくありません。",
    request_not_pending:"この申請はすでに処理されています。",
    reason_required:"理由を2文字以上で入力してください。", confirm_mismatch:"確認用の表示名が一致しません。", already_requested:"すでに削除を申請済みです。",
    group_name_invalid:"グループ名は1〜40文字で入力してください。", group_members_invalid:"メンバーは1〜49人まで選んでください。", notice_too_long:"注意事項は500文字以内です。",
    link_title_invalid:"リンクの名前は1〜60文字で入力してください。", link_url_invalid:"リンクは https:// で始まるURLを入力してください。", too_many_links:"リンクは20件までです。",
    poll_question_invalid:"質問は1〜100文字で入力してください。", poll_options_invalid:"選択肢は2〜6個（各50文字以内）で入力してください。",
    post_too_long:"投稿は500文字以内で入力してください。", post_empty:"投稿の内容を入力してください。", invalid_image_path:"画像の保存先が正しくありません。",
    bio_too_long:"自己紹介は150文字以内です。", status_too_long:"ステータスメッセージは60文字以内です。", invalid_avatar_url:"アイコン画像のURLが正しくありません。", invalid_display_name:"表示名は1〜30文字で入力してください。",
    verification_note_required:"本人確認の方法を5文字以上で入力してください。", user_not_found:"対象のユーザーが見つかりません。",
    cannot_target_admin:"管理者アカウントは再発行の対象にできません。", rate_limited:"短時間に再発行しすぎです。時間をおいてください。",
    blocked:"このユーザーにはメッセージを送れません（ブロック中）。", too_many_pins:"固定できるのは1チャットあたり10件までです。", invalid_emoji:"その絵文字は使えません。", query_invalid:"検索ワードは1〜50文字で入力してください。", room_suspended:"このチャットは停止中です。",
    story_empty:"ひとこと、または写真を入力してください。", story_too_long:"ひとことは200文字以内です。", invalid_bg:"背景色が正しくありません。", too_many_stories:"ストーリーは同時に10件までです。",
    invalid_game:"このゲームは記録できません。", invalid_score:"スコアが正しくありません。", too_many_rows:"登録できる件数の上限（500件）に達しました。", invalid_ttl:"消える時間の指定が正しくありません。"
};

const feat = {known:new Map(),readTimes:[],readKey:"",manual:"online",lastActivity:Date.now(),timers:[],partnerReadAt:null,pending:new Set(),editingId:null,isAdmin:false,adminView:"rooms"};
try{ const saved = localStorage.getItem("are_manual_status"); if(STATUS_LABELS[saved]) feat.manual = saved; }catch(_e){}

/** 指定したチャットへメッセージ（JSON）を送る。「消えるメッセージ」がオンなら、期限つきで送る */
function sendRpcContent(roomId, content){
    const ttl = Number(feat.ttl) || 0;
    return ttl > 0
        ? requireClient().rpc("send_timed_message", {p_room_id:roomId, p_content:content, p_ttl_seconds:ttl})
        : requireClient().rpc("send_message", {p_room_id:roomId, p_content:content});
}

function sendPayloadToRoom(roomId, payload){ return sendRpcContent(roomId, JSON.stringify(payload)); }

function featError(error){
    if(isMissingBackend(error)) return "この機能は未実装です（サーバー側の準備ができていません）。";
    const text = String(error?.message || "");
    for(const key in FEAT_ERRORS){ if(text.includes(key)) return FEAT_ERRORS[key]; }
    return getErrorMessage(error);
}

// ===== 機能どうしをつなぐ共通部品（各機能は別ファイル。1つ壊れても他は動く） =====
const renderHooks = [], roomHooks = [], msgTools = [], payloadDecorators = [], payloadSentHooks = [];

function addRenderHook(fn){ renderHooks.push(fn); }
function addRoomHook(fn){ roomHooks.push(fn); }
function addMsgTool(def){ msgTools.push(def); }
function addPayloadDecorator(fn){ payloadDecorators.push(fn); }
function addPayloadSentHook(fn){ payloadSentHooks.push(fn); }

function runHooks(list,arg){
    list.forEach((fn) => { try{ fn(arg); }catch(error){ console.error("[ARE hook]",error); } });
}
function afterRenderMessages(){ runHooks(renderHooks); }
function runRoomHooks(){ runHooks(roomHooks,state.currentRoom); }
function afterPayloadSent(payload){ runHooks(payloadSentHooks,payload); }

function buildTextPayload(text){
    const payload = {type:"text",text};
    payloadDecorators.forEach((fn) => { try{ fn(payload); }catch(error){ console.error("[ARE decorator]",error); } });
    return payload;
}

/** メッセージの中身を短い文字にする（返信・固定・転送・検索で共通） */
function messageSummary(item){
    if(!item) return "";
    if(item.type === "text") return String(item.text || "");
    if(item.type === "poll") return "[アンケート] " + String(item.question || "");
    if(item.type === "game") return "[対戦] " + String((VS_GAMES[item.game] || (typeof CG_GAMES !== "undefined" ? CG_GAMES[item.cg] : null) || {}).name || "ゲーム");
    if(item.type === "location") return "[位置情報] " + String(item.label || "現在地");
    const label = {image:"画像",video:"動画",audio:"音声",file:"ファイル"}[item.type] || "添付";
    return "[" + label + "] " + String(item.name || "");
}

function roomTitle(room){
    if(!room) return "";
    return room.is_group ? (room.name || "グループ") : profileDisplayName(room.partner);
}

function senderName(message){
    if(message.sender_id === state.user.id) return "あなた";
    return profileDisplayName(feat.known.get(message.sender_id) || (state.currentPartner && state.currentPartner.id === message.sender_id ? state.currentPartner : null));
}

function jumpToMessage(id){
    const row = el.messages.querySelector('article[data-mid="' + String(id).replace(/[^0-9a-f-]/gi,"") + '"]');
    if(!row){ showToast("そのメッセージは、いま表示されている範囲にありません。"); return false; }
    row.scrollIntoView({block:"center",behavior:"smooth"});
    row.classList.add("flash");
    setTimeout(() => row.classList.remove("flash"),1800);
    return true;
}

function escapeRegExp(text){ return String(text).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }
