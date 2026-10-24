"use strict";
// ===== ゲーム：メニュー・ランキング・実績 =====
// スコアはブラウザから送る方式です（サーバーは上限と連続送信だけを検査）。本気の不正対策はできないので「みんなで遊ぶ用」と考えてください。

const GAME_LIST = [
    ["janken", "✊", "じゃんけん", "何連勝できるか（負けたら終了）"],
    ["number", "🔢", "数当て", "1〜100の数字を少ない回数で当てる"],
    ["tictactoe", "⭕", "三目並べ", "CPUと対戦。勝ち3点・引き分け1点（合計で競う）"],
    ["memory", "🃏", "神経衰弱", "少ない手数でペアを全部そろえる"],
    ["emoji_quiz", "🤔", "絵文字クイズ", "10問。正解数がスコア"],
    ["shiritori", "🔤", "しりとり", "CPUと何往復できるか"]
];

const GAME_ACHIEVEMENTS = [
    ["🎮", "はじめてのプレイ", (s) => s.totalPlays >= 1],
    ["✊", "じゃんけん5連勝", (s) => (s.janken?.best || 0) >= 5],
    ["🔢", "数当て名人（80点以上）", (s) => (s.number?.best || 0) >= 80],
    ["⭕", "三目並べ10点", (s) => (s.tictactoe?.total || 0) >= 10],
    ["🃏", "記憶力抜群（80点以上）", (s) => (s.memory?.best || 0) >= 80],
    ["🤔", "絵文字博士（10問全問正解）", (s) => (s.emoji_quiz?.best || 0) >= 10],
    ["🔤", "しりとり10往復", (s) => (s.shiritori?.best || 0) >= 10],
    ["🏅", "6種類すべてで遊んだ", (s) => GAME_LIST.every((g) => (s[g[0]]?.plays || 0) >= 1)]
];

feat.g = null;

function initGames(){ registerTool("game", onGameAction); }

function openGames(){
    feat.g = null;
    openSheet(toolHead("🎮 ゲーム", "遊ぶとスコアが記録され、ランキングに載ります。") +
        '<div id="gBody">' + gameMenuHtml() + '</div>' + toolClose());
}

function gameMenuHtml(){
    return GAME_LIST.map((g) => '<button type="button" class="admin-card more-item" data-t="game:play" data-g="' + g[0] + '">' + g[1] + ' ' + g[2] + '<small class="meta">' + g[3] + '</small></button>').join("") +
        '<div class="row" style="justify-content:flex-start"><button type="button" class="button-secondary" data-t="game:rank" data-g="janken">🏆 ランキング</button><button type="button" class="button-secondary" data-t="game:stats">📊 成績・実績</button></div>';
}

function gameBack(){ return '<div class="row" style="justify-content:flex-start"><button type="button" class="button-secondary" data-t="game:menu">← ゲーム一覧</button></div>'; }

function onGameAction(action, node){
    const body = $("gBody");
    if(!body) return;
    if(action === "menu"){ feat.g = null; body.innerHTML = gameMenuHtml(); return; }
    if(action === "play"){ return startGame(node.dataset.g); }
    if(action === "rank"){ return showRanking(node.dataset.g || (node.value)); }
    if(action === "stats") return showStats();
    if(feat.g && typeof gamePlayAction === "function") return gamePlayAction(action, node);
}

async function submitScore(game, score){
    try{
        const result = await requireClient().rpc("submit_game_score", {p_game:game, p_score:Math.max(0, Math.round(score))});
        if(result.error) throw result.error;
        return "スコア " + Math.round(score) + " を記録しました。";
    }catch(error){
        if(String(error?.message || "").includes("rate_limited")) return "続けて送信したため、今回のスコアは記録されませんでした（3秒以上あけてください）。";
        return "スコアを記録できませんでした：" + featError(error);
    }
}

async function showRanking(game){
    const body = $("gBody");
    if(!body) return;
    body.innerHTML = gameBack() + '<select class="status-select" data-t="game:rank" aria-label="ゲームを選ぶ">' +
        GAME_LIST.map((g) => '<option value="' + g[0] + '"' + (g[0] === game ? " selected" : "") + '>' + g[2] + '</option>').join("") + '</select>' +
        '<div id="gRank" class="empty-list">読み込み中...</div>';
    try{
        const result = await requireClient().rpc("game_ranking", {p_game:game});
        if(result.error) throw result.error;
        const rows = result.data || [];
        const unit = game === "tictactoe" ? "点（合計）" : "点（自己ベスト）";
        if($("gRank")) $("gRank").innerHTML = rows.length ? '<ol class="rank-list">' + rows.map((r) =>
            '<li><b>' + escapeHtml(r.display_name || "名無し") + '</b> ' + Number(r.score) + unit + ' <span class="meta">（' + Number(r.plays) + '回）</span></li>').join("") + '</ol>'
            : '<div class="empty-list">まだ記録がありません。一番乗りになろう！</div>';
    }catch(error){ if($("gRank")) $("gRank").textContent = featError(error); }
}

async function showStats(){
    const body = $("gBody");
    if(!body) return;
    body.innerHTML = gameBack() + '<div id="gStats" class="empty-list">読み込み中...</div>';
    try{
        const result = await requireClient().rpc("my_game_stats");
        if(result.error) throw result.error;
        const stats = {totalPlays:0};
        (result.data || []).forEach((r) => { stats[r.game] = {plays:Number(r.plays), best:Number(r.best), total:Number(r.total)}; stats.totalPlays += Number(r.plays); });
        const rows = GAME_LIST.map((g) => {
            const s = stats[g[0]];
            return '<li>' + g[1] + ' ' + g[2] + '：' + (s ? s.plays + '回 / ベスト ' + s.best + '点 / 合計 ' + s.total + '点' : '<span class="meta">まだ遊んでいません</span>') + '</li>';
        }).join("");
        const badges = GAME_ACHIEVEMENTS.map((a) => {
            let ok = false; try{ ok = a[2](stats); }catch(_e){}
            return '<li class="' + (ok ? "ach-on" : "ach-off") + '">' + (ok ? a[0] : "🔒") + ' ' + a[1] + '</li>';
        }).join("");
        if($("gStats")) $("gStats").innerHTML = '<b>成績</b><ul class="rank-list">' + rows + '</ul><b>実績</b><ul class="rank-list">' + badges + '</ul>';
    }catch(error){ if($("gStats")) $("gStats").textContent = featError(error); }
}
