"use strict";
// ===== 第2弾ツールの入口（「その他」タブ）と、シート内ボタンの共通ルーター =====
// 各ツールは別ファイル。ここは「入口のカード」と「data-t="名前:動作"」の振り分けだけを担当します。

const TOOL_LIST = [
    ["story", "📖", "ストーリー（24時間）", "フォロー中の人と自分の、24時間で消える投稿", "openStory"],
    ["album", "🖼️", "アルバム", "いま開いているチャットの写真を一覧で見る", "openAlbum"],
    ["imgedit", "🎨", "画像編集", "回転・切り抜き・明るさ・文字入れをして送信", "openImgEdit"],
    ["location", "📍", "位置情報を送る", "いまいる場所を、いまのチャットに送信", "openLocationShare"],
    ["memo", "📝", "自分専用メモ（Keep）", "自分だけが見られるメモ・チェックリスト", "openMemoView"],
    ["co2", "🌱", "CO2トラッカー", "移動・食事・電気のCO2をかんたん記録", "openCo2"],
    ["ai", "🤖", "会話の分析", "要約・キーワード・感情・分類（端末内だけで処理）", "openAi"],
    ["archive", "🗂️", "ストーリーのアーカイブ", "24時間をすぎたストーリーの保存先", "openStoryArchive"],
    ["share", "🔗", "プロフィール共有・QR", "自分のQRコードとリンクを表示", "openShare"],
    ["games", "🎮", "ゲーム", "6種類のミニゲーム・ランキング・実績", "openGames"],
    ["planner", "📅", "タスク・カレンダー", "自分だけが見られる予定表", "openPlanner"],
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
