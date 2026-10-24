"use strict";
// ===== 第2弾ツールの入口（「その他」タブ）と、シート内ボタンの共通ルーター =====
// 各ツールは別ファイル。ここは「入口のカード」と「data-t="名前:動作"」の振り分けだけを担当します。

const TOOL_LIST = [
    ["story", "📖", "ストーリー（24時間）", "フォロー中の人と自分の、24時間で消える投稿", "openStory"],
    ["album", "🖼️", "アルバム", "いま開いているチャットの写真を一覧で見る", "openAlbum"],
    ["imgedit", "🎨", "画像編集", "回転・切り抜き・明るさ・文字入れをして送信", "openImgEdit"],
    ["location", "📍", "位置情報を送る", "いまいる場所を、いまのチャットに送信", "openLocationShare"],
    ["work", "🏢", "ワークスペース（仕事）", "出勤・経費・会議室・プロジェクト・文書・共同メモ・レポート", "openWork"],
    ["sched", "📆", "予定の空き時間を提案", "予定のすき間から会議に使える時間を計算", "openSchedSuggest"],
    ["health", "❤️", "ヘルス記録", "体重・睡眠・歩数・気分を記録（自分だけ）", "openHealth"],
    ["geo", "📍", "場所で送るメッセージ", "目的地で「到着しました」を押すと送信", "openGeoMessages"],
    ["mood", "🎭", "気分・時間帯でテーマ", "朝昼夕夜や気分の言葉で、画面の色が変わる", "openMood"],
    ["cards", "🂡", "カードゲーム（手札かくし）", "ババ抜き・大富豪・インディアンポーカー・ダウト", "openCardGames"],
    ["bj", "🃏", "ブラックジャック", "ディーラー(CPU)と1人で対戦。コインは端末だけ", "openBj"],
    ["memo", "📝", "自分専用メモ（Keep）", "自分だけが見られるメモ・チェックリスト", "openMemoView"],
    ["co2", "🌱", "CO2トラッカー", "移動・食事・電気のCO2をかんたん記録", "openCo2"],
    ["avatar", "🧑‍🎤", "アバター", "自分のキャラを作る・ビデオ通話でカメラのかわりに映す", "openAvatar"],
    ["myai", "🧠", "AIともぴー", "教えると覚える・自分の返し方を学ぶ（APIキー不要・無料）", "openMyAi"],
    ["ai", "🤖", "会話の分析", "要約・キーワード・感情・分類（端末内だけで処理）", "openAi"],
    ["archive", "🗂️", "ストーリーのアーカイブ", "24時間をすぎたストーリーの保存先", "openStoryArchive"],
    ["share", "🔗", "プロフィール共有・QR", "自分のQRコードとリンクを表示", "openShare"],
    ["games", "🎮", "ゲーム", "6種類のミニゲーム・ランキング・実績", "openGames"],
    ["planner", "📅", "タスク・カレンダー", "自分だけが見られる予定表", "openPlanner"],
    ["push", "🔔", "通知・ホーム画面", "閉じていても届く通知・チャットごとのミュート・ホーム画面に追加", "openPushSettings"],
    ["stars", "⭐", "スター付きメッセージ", "あとで見返したいメッセージの一覧", "openStars"],
    ["folders", "📁", "チャットの整理", "フォルダ分け・固定・並び替え", "openFolders"],
    ["phrases", "💬", "定型文", "よく使う文を登録して、ワンタップで入力", "openPhrases"],
    ["comfort", "🔠", "見やすさ・読み上げ", "文字サイズ・高コントラスト・読み上げの速さ", "openComfort"],
    ["draw", "✏️", "お絵かき", "手書きの絵を画像にして、チャットに送る", "openDraw"],
    ["mystamp", "🖼️", "自作スタンプ", "自分の画像から作って、ワンタップで送る", "openMyStamps"],
    ["split", "💴", "割り勘計算", "合計と人数から計算して、チャットに貼る", "openSplit"],
    ["board", "📅", "日程調整ボード", "候補日に ○△× で投票して決める", "openBoardCreate"],
    ["live", "📍", "ライブ位置共有", "一定時間だけ、お互いの位置を地図で見る", "openLive"],
    ["ocr", "📝", "文字を読み取る", "画像の中の文字をテキストにする", "openOcr"],
    ["contact", "📷", "QRで友だち追加", "カメラでQRを読み取ってチャットを始める", "openQrScan"],
    ["screen", "🖥️", "通話の画面共有", "通話中に自分の画面を相手に見せる", "openScreenHelp"],
    ["diary", "📔", "日記", "気分つきで1日1つ。検索もできる", "openDiary"],
    ["habit", "✅", "習慣トラッカー", "毎日の習慣をチェック。連続日数がわかる", "openHabit"],
    ["budget", "💴", "家計簿", "収入と支出を記録して月ごとに集計", "openBudget"],
    ["timer", "⏱️", "タイマー", "カウントダウン・ポモドーロ", "openTimer"],
    ["calc", "🧮", "電卓・換算", "計算・単位換算・為替の目安", "openCalc"],
    ["shop", "🛒", "買い物リスト", "このチャットのみんなで共有", "openShop"],
    ["fun", "🎲", "じゃんけん・ルーレット・あみだ", "決めごとをみんなで", "openFun"],
    ["rpg", "🗡️", "ARE 〜そういうときは、AREだ！〜", "2D・ドラクエ風RPG。バグ・キングをたおそう（1000pt）", "openRpg"],
    ["lock", "🔒", "ロック・自動ログアウト", "PIN・放置したら画面ぼかし/ログアウト", "openLock"],
    ["announce", "📢", "お知らせ", "管理者からのお知らせ", "openAnnouncements"],
    ["prefs", "⚙️", "表示設定・言語", "気分テーマ・省データモード・English", "openPrefs"]
];

const toolHandlers = {};

function registerTool(ns, fn){ toolHandlers[ns] = fn; }

function toolHead(title, note){
    return '<h3 style="margin:0">' + title + '</h3>' + (note ? '<div class="meta">' + note + '</div>' : "");
}

function toolClose(extra){
    return '<div class="row">' + (extra || "") + '<button type="button" class="button-secondary" data-pm="close">閉じる</button></div>';
}

function initTools(){
    const pane = document.querySelector(".pane-more");
    if(!pane) throw new Error("「その他」タブが見つかりません。");
    pane.insertAdjacentHTML("beforeend", '<div class="section-heading" style="margin-top:10px"><h2>🧩 ツール</h2></div>' +
        TOOL_LIST.map((t) => '<button type="button" class="admin-card more-item" data-tool="' + t[0] + '" data-feature="' + t[0] + '">' + t[1] + ' ' + t[2] + '<small class="meta">' + t[3] + '</small></button>').join(""));
    pane.addEventListener("click", (event) => {
        const button = event.target.closest("[data-tool]");
        if(!button) return;
        const tool = TOOL_LIST.find((t) => t[0] === button.dataset.tool);
        const opener = tool && window[tool[4]];
        if(typeof opener !== "function"){ showToast("この機能は未実装です。"); return; }
        runTool(() => opener());
    });
    ["click", "change", "input"].forEach((type) => el.profileModal.addEventListener(type, dispatchTool));
}

function runTool(fn){
    try{
        const result = fn();
        if(result && typeof result.catch === "function") result.catch((error) => { console.error("[ARE tool]", error); showToast(featError(error)); });
    }catch(error){ console.error("[ARE tool]", error); showToast(featError(error)); }
}

function dispatchTool(event){
    const node = event.target.closest("[data-t]");
    if(!node) return;
    const tag = node.tagName, type = node.type;
    if(event.type === "click"){ if(tag !== "BUTTON") return; }
    else if(event.type === "input"){ if(!(type === "range" || node.dataset.live)) return; }
    else if(event.type === "change"){ if(type === "range" || node.dataset.live || !(tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA")) return; }
    const parts = String(node.dataset.t).split(":");
    const handler = toolHandlers[parts[0]];
    if(!handler) return;
    runTool(() => handler(parts[1], node, event));
}

function dayKey(date){
    const d = date instanceof Date ? date : new Date(date);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
