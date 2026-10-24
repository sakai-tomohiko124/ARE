"use strict";
// ===== 多言語UI（日本語 / English）。主なメニュー・ボタンだけの部分対応です =====

const I18N_EN = {
    "チャット":"Chats", "ユーザー":"Users", "投稿":"Posts", "その他":"More", "マイページ":"My page", "ログアウト":"Log out",
    "💬 チャット":"💬 Chats", "👥 グループ作成":"👥 New group", "更新":"Refresh", "🔎 ユーザーを探す":"🔎 Find users", "非表示（0）":"Hidden (0)",
    "📷 投稿":"📷 Posts", "すべて":"All", "フォロー中":"Following", "🖼️ 写真":"🖼️ Photo", "投稿する":"Post", "さらに読み込む":"Load more",
    "🧰 その他":"🧰 More", "📖 操作方法":"📖 How to use", "🤖 AIチャットボット":"🤖 Chatbot", "☀️ 天気予報":"☀️ Weather", "🚆 交通情報":"🚆 Transit",
    "🧩 ツール":"🧩 Tools", "📖 ストーリー（24時間）":"📖 Stories (24h)", "🖼️ アルバム":"🖼️ Album", "🎨 画像編集":"🎨 Photo editor", "📍 位置情報を送る":"📍 Share location",
    "🔗 プロフィール共有・QR":"🔗 Share profile / QR", "🎮 ゲーム":"🎮 Games", "📅 タスク・カレンダー":"📅 Tasks & calendar", "⚙️ 表示設定・言語":"⚙️ Display & language",
    "✏️ プロフィールを編集":"✏️ Edit profile", "🔗 プロフィールを共有（QR）":"🔗 Share my profile (QR)", "アカウントの削除":"Delete account", "アカウント削除を申請":"Request account deletion",
    "申請を取り消す":"Cancel request", "会話履歴の保存":"Save chat history", "30日より前をZIP保存":"Save older than 30 days (ZIP)", "すべてZIP保存":"Save all (ZIP)",
    "既読を相手に表示する":"Show read receipts to others", "🛡️ 管理者パネル":"🛡️ Admin panel", "← 戻る":"← Back", "会話を始めよう":"Start a conversation", "AREへようこそ":"Welcome to ARE",
    "🖼️ 画像を選択":"🖼️ Image", "📎 ファイルを選択":"📎 File", "🎬 動画を選択":"🎬 Video", "😊 絵文字・スタンプ":"😊 Emoji & stamps", "🎤 音声":"🎤 Voice", "✖ 録音を取消":"✖ Cancel recording",
    "🕒 予約送信":"🕒 Schedule", "送信":"Send", "この日時に予約":"Schedule for this time", "閉じる":"Close", "読み込み中...":"Loading...", "接続を確認しています":"Checking connection",
    "🟢 オンライン":"🟢 Online", "🔴 取り込み中":"🔴 Busy", "📞 通話中":"📞 In a call", "🟡 待機中":"🟡 Away"
};

const I18N_EN_PLACEHOLDERS = {
    "メッセージを入力...（Enterで送信、Shift+Enterで改行）":"Type a message... (Enter to send, Shift+Enter for a new line)",
    "ユーザー名を検索...":"Search users...", "いまどうしてる？（500文字まで）":"What's up? (max 500 characters)"
};

const i18nOriginal = new WeakMap();
let i18nObserver = null, i18nTimer = 0;

function initLang(){
    registerTool("lang", () => {});
    applyLanguage(prefGet("are_lang", "ja"));
}

function i18nRoots(){ return [document.getElementById("rail"), document.getElementById("sidebar"), document.querySelector(".chat-header"), document.querySelector(".composer")].filter(Boolean); }

function translateTree(root, toEn){
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
        if(node.parentElement && node.parentElement.closest("script,style,.messages")) return;
        const original = i18nOriginal.has(node) ? i18nOriginal.get(node) : node.nodeValue;
        const key = original.trim();
        if(toEn && I18N_EN[key]){
            if(!i18nOriginal.has(node)) i18nOriginal.set(node, original);
            node.nodeValue = original.replace(key, I18N_EN[key]);
        }else if(!toEn && i18nOriginal.has(node)){
            node.nodeValue = i18nOriginal.get(node);
            i18nOriginal.delete(node);
        }
    });
    root.querySelectorAll("[placeholder]").forEach((input) => {
        const current = input.getAttribute("placeholder");
        if(toEn && I18N_EN_PLACEHOLDERS[current]){ input.dataset.jaPlaceholder = current; input.setAttribute("placeholder", I18N_EN_PLACEHOLDERS[current]); }
        else if(!toEn && input.dataset.jaPlaceholder){ input.setAttribute("placeholder", input.dataset.jaPlaceholder); delete input.dataset.jaPlaceholder; }
    });
}

function applyLanguage(lang){
    const toEn = lang === "en";
    document.documentElement.lang = toEn ? "en" : "ja";
    if(i18nObserver){ i18nObserver.disconnect(); i18nObserver = null; }
    i18nRoots().forEach((root) => translateTree(root, toEn));
    if(toEn){
        i18nObserver = new MutationObserver(() => {
            clearTimeout(i18nTimer);
            i18nTimer = setTimeout(() => {
                if(i18nObserver) i18nObserver.disconnect();
                i18nRoots().forEach((root) => translateTree(root, true));
                if(i18nObserver) i18nRoots().forEach((root) => i18nObserver.observe(root, {childList:true, subtree:true, characterData:true}));
            }, 150);
        });
        i18nRoots().forEach((root) => i18nObserver.observe(root, {childList:true, subtree:true, characterData:true}));
    }
}
