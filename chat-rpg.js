"use strict";
// RPG「ARE 〜そういうときは、AREだ！〜」ランチャー。ゲーム本体は ./game/ にあります（別ページで全画面）。
function openRpg(){
    let nm = "";
    try{ nm = Array.from(String(profileDisplayName(state.profile) || "").replace(/\s+/g, "")).slice(0, 8).join(""); }catch(_e){}
    const href = "./game/index.html" + (nm ? "?name=" + encodeURIComponent(nm) : "");
    openSheet(toolHead("🗡️ ARE 〜そういうときは、AREだ！〜", "ドラクエ7ふうRPG。セーブ3つ・自動戦闘・自動レベル上げ。スマホ・タブレットは横向き推奨、パソコンは大きな画面で") +
        '<div class="admin-card">プロフィールの名前「' + escapeHtml(nm || "主人公") + '」を主人公の名前に使えます（ゲーム内で変更もOK）。セーブはこの端末のブラウザに保存されます。</div>' +
        '<div class="row"><a class="button" href="' + escapeHtml(href) + '" target="_blank" rel="noopener">▶ ゲームをひらく</a><button type="button" class="button-secondary" data-pm="close">閉じる</button></div>');
}
function initRpg(){ /* ゲーム本体は ./game/ に独立。チャット側の初期化は不要 */ }
