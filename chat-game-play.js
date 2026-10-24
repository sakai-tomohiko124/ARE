"use strict";
// ===== ゲーム本体（6種類）。どれも外部の素材を使わず、絵文字と文字だけで作っています =====

const JK_HANDS = ["✊", "✌️", "✋"], JK_NAMES = ["グー", "チョキ", "パー"];

const QUIZ_BANK = [
    ["🍎", "りんご"], ["🍌", "バナナ"], ["🐘", "ぞう"], ["🐧", "ペンギン"], ["🚀", "ロケット"], ["🌻", "ひまわり"], ["🍣", "すし"], ["⚽", "サッカー"], ["🎹", "ピアノ"], ["🚲", "じてんしゃ"],
    ["🌋", "かざん"], ["🏯", "おしろ"], ["🐢", "かめ"], ["🎃", "かぼちゃ"], ["🍙", "おにぎり"], ["🔭", "ぼうえんきょう"], ["☂️", "かさ"], ["🦒", "きりん"], ["🍜", "ラーメン"], ["🎸", "ギター"]
];

const MEM_EMOJI = ["🐶", "🐱", "🐸", "🍓", "🌸", "⭐", "🚗", "🎈", "🍩", "🐠", "🌙", "🎲"];

// しりとり用のことば（すべて「ん」で終わらない・ひらがな）
const SHI_WORDS = ["あめ", "あさひ", "あひる", "いぬ", "いちご", "いるか", "うみ", "うさぎ", "うで", "えび", "えいが", "えのぐ", "おにぎり", "おりがみ", "おかし", "かめ", "かさ", "かもめ", "かえる",
    "きつね", "きのこ", "くるま", "くじら", "くつ", "けしき", "けむり", "けいと", "こども", "こおり", "こけし", "さかな", "さくら", "さる", "しまうま", "しお", "しか", "すいか", "すし", "すず",
    "せみ", "せかい", "せなか", "そら", "そば", "そうじ", "たいこ", "たまご", "たこ", "ちきゅう", "ちず", "ちから", "つくえ", "つき", "つばめ", "てがみ", "てぶくろ", "てら", "とけい", "とり", "とら",
    "なす", "なつ", "なみ", "にわとり", "にじ", "にく", "ぬりえ", "ぬの", "ぬりぐすり", "ねこ", "ねずみ", "ねぎ", "のり", "のはら", "のこぎり", "はな", "はし", "はは", "ひこうき", "ひかり", "ひつじ",
    "ふね", "ふくろ", "へや", "へび", "へちま", "ほし", "ほたる", "ほうき", "まくら", "まど", "まめ", "みかげ", "みどり", "みみ", "むし", "むぎ", "むらさき", "めがね", "めだか", "めだま",
    "もも", "もり", "もちつき", "やま", "やさい", "やぎ", "ゆき", "ゆびわ", "ゆめ", "よる", "よぞら", "よこ", "らくだ", "らっぱ", "らいおう", "りす", "りか", "りくつ", "るり", "るす", "るいじ",
    "れきし", "れいぞうこ", "れつ", "ろば", "ろうそく", "ろくろ", "わに", "わかめ", "わた", "わらい"];

const SMALL_KANA = {"ゃ":"や", "ゅ":"ゆ", "ょ":"よ", "ぁ":"あ", "ぃ":"い", "ぅ":"う", "ぇ":"え", "ぉ":"お", "っ":"つ", "ゎ":"わ"};

function baseKana(ch){ return (SMALL_KANA[ch] || ch).normalize("NFD").replace(/[゙゚]/g, "").normalize("NFC"); }

function lastKana(word){
    const chars = Array.from(word.replace(/ー+$/, ""));
    return baseKana(chars[chars.length - 1] || "");
}

function firstKana(word){ return baseKana(Array.from(word)[0] || ""); }

function shuffled(list){
    const a = list.slice();
    for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
}

function startGame(id){
    const info = GAME_LIST.find((g) => g[0] === id);
    if(!info) return;
    feat.g = {id, over:false};
    ({janken:startJanken, number:startNumber, tictactoe:startTicTacToe, memory:startMemory, emoji_quiz:startQuiz, shiritori:startShiritori})[id]();
}

function gameShow(html){
    const body = $("gBody");
    if(body) body.innerHTML = gameBack() + html;
}

async function gameFinish(message, score){
    const g = feat.g;
    if(!g || g.over) return;
    g.over = true;
    const note = await submitScore(g.id, score);
    const box = $("gResult");
    if(box) box.innerHTML = '<b>' + message + '</b><br>' + escapeHtml(note) + '<div class="row"><button type="button" class="button" data-t="game:play" data-g="' + g.id + '">もう一度</button><button type="button" class="button-secondary" data-t="game:rank" data-g="' + g.id + '">🏆 ランキング</button></div>';
}

function gamePlayAction(action, node){
    const g = feat.g;
    if(!g || g.over && action !== "again") return;
    ({jk:janKenPick, num:numberGuess, ttt:tttPick, mem:memPick, quiz:quizPick, shi:shiritoriSubmit, giveup:shiritoriGiveUp})[action]?.(node);
}

// ---------- じゃんけん ----------
function startJanken(){
    feat.g.streak = 0;
    paintJanken("勝つたびに連勝が増えます。負けたら終了！");
}

function paintJanken(message){
    gameShow('<h4 style="margin:0">✊ じゃんけん　連勝：' + feat.g.streak + '</h4><div class="game-msg">' + message + '</div>' +
        '<div class="row" style="justify-content:center">' + JK_HANDS.map((h, i) => '<button type="button" class="button game-big" data-t="game:jk" data-v="' + i + '">' + h + '<br><small>' + JK_NAMES[i] + '</small></button>').join("") + '</div><div id="gResult"></div>');
}

function janKenPick(node){
    const me = Number(node.dataset.v), cpu = Math.floor(Math.random() * 3), g = feat.g;
    const line = "あなた " + JK_HANDS[me] + " vs CPU " + JK_HANDS[cpu] + "　";
    if(me === cpu){ paintJanken(line + "あいこ！もう一回。"); return; }
    if((me - cpu + 3) % 3 === 2){
        g.streak++;
        if(g.streak >= 50){ paintJanken(line + "勝ち！"); gameFinish("50連勝！達成です🎉", 50); return; }
        paintJanken(line + "勝ち！");
        return;
    }
    paintJanken(line + "負け…");
    document.querySelectorAll("[data-t='game:jk']").forEach((b) => { b.disabled = true; });
    gameFinish(g.streak + "連勝で終了", g.streak);
}

// ---------- 数当て ----------
function startNumber(){
    Object.assign(feat.g, {secret:1 + Math.floor(Math.random() * 100), tries:0, low:1, high:100});
    paintNumber("1〜100のどれでしょう？ 少ない回数ほど高得点（最大100点）。");
}

function paintNumber(message){
    gameShow('<h4 style="margin:0">🔢 数当て　回数：' + feat.g.tries + '</h4><div class="game-msg">' + message + '</div>' +
        '<div class="row" style="justify-content:flex-start"><input id="gNum" type="text" inputmode="numeric" maxlength="3" placeholder="' + feat.g.low + '〜' + feat.g.high + '" style="max-width:120px"><button type="button" class="button" data-t="game:num">予想する</button></div><div id="gResult"></div>');
}

function numberGuess(){
    const g = feat.g, raw = ($("gNum") ? $("gNum").value : "").trim();
    const n = /^\d{1,3}$/.test(raw) ? Number(raw) : NaN;
    if(!(n >= 1 && n <= 100)){ showToast("1〜100の数字を入力してください。"); return; }
    g.tries++;
    if(n === g.secret){
        paintNumber("🎯 正解！答えは " + g.secret + " でした。");
        document.querySelectorAll("[data-t='game:num']").forEach((b) => { b.disabled = true; });
        gameFinish(g.tries + "回で正解！", Math.max(10, 110 - g.tries * 10));
        return;
    }
    if(n < g.secret) g.low = Math.max(g.low, n + 1); else g.high = Math.min(g.high, n - 1);
    paintNumber(n + " より" + (n < g.secret ? "大きい" : "小さい") + "です。");
}

// ---------- 三目並べ ----------
const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function tttWinner(b){
    for(const [x, y, z] of TTT_LINES){ if(b[x] && b[x] === b[y] && b[x] === b[z]) return b[x]; }
    return b.every(Boolean) ? "draw" : "";
}

function startTicTacToe(){
    feat.g.board = Array(9).fill("");
    paintTtt("あなたは ⭕（先手）です。");
}

function paintTtt(message){
    const b = feat.g.board;
    gameShow('<h4 style="margin:0">⭕ 三目並べ</h4><div class="game-msg">' + message + '</div><div class="ttt">' +
        b.map((c, i) => '<button type="button" class="ttt-cell" data-t="game:ttt" data-i="' + i + '"' + (c || feat.g.over ? " disabled" : "") + '>' + (c === "o" ? "⭕" : c === "x" ? "❌" : "") + '</button>').join("") + '</div><div id="gResult"></div>');
}

function tttCpuMove(b){
    const free = b.map((c, i) => c ? -1 : i).filter((i) => i >= 0);
    for(const mark of ["x", "o"]){
        for(const i of free){ const t = b.slice(); t[i] = mark; if(tttWinner(t) === mark) return i; }
    }
    if(!b[4]) return 4;
    return free[Math.floor(Math.random() * free.length)];
}

function tttPick(node){
    const g = feat.g, i = Number(node.dataset.i);
    if(g.board[i]) return;
    g.board[i] = "o";
    let w = tttWinner(g.board);
    if(!w){ g.board[tttCpuMove(g.board)] = "x"; w = tttWinner(g.board); }
    if(!w){ paintTtt("あなたの番です。"); return; }
    const text = w === "o" ? "あなたの勝ち！（3点）" : w === "x" ? "CPUの勝ち…（0点）" : "引き分け（1点）";
    g.over = false; paintTtt(text);
    document.querySelectorAll("[data-t='game:ttt']").forEach((b) => { b.disabled = true; });
    gameFinish(text, w === "o" ? 3 : w === "draw" ? 1 : 0);
}

// ---------- 神経衰弱 ----------
function startMemory(){
    const picks = shuffled(MEM_EMOJI).slice(0, 8);
    Object.assign(feat.g, {cards:shuffled(picks.concat(picks)), open:[], matched:new Set(), moves:0, lock:false});
    paintMemory("同じ絵文字を2枚そろえよう。手数が少ないほど高得点。");
}

function paintMemory(message){
    const g = feat.g;
    gameShow('<h4 style="margin:0">🃏 神経衰弱　手数：' + g.moves + '</h4><div class="game-msg">' + message + '</div><div class="mem">' +
        g.cards.map((c, i) => {
            const shown = g.matched.has(i) || g.open.includes(i);
            return '<button type="button" class="mem-card' + (g.matched.has(i) ? " done" : "") + '" data-t="game:mem" data-i="' + i + '"' + (shown ? " disabled" : "") + '>' + (shown ? c : "❓") + '</button>';
        }).join("") + '</div><div id="gResult"></div>');
}

function memPick(node){
    const g = feat.g, i = Number(node.dataset.i);
    if(g.lock || g.open.includes(i) || g.matched.has(i)) return;
    g.open.push(i);
    if(g.open.length < 2){ paintMemory("もう1枚めくってください。"); return; }
    g.moves++;
    const [a, b] = g.open;
    if(g.cards[a] === g.cards[b]){
        g.matched.add(a); g.matched.add(b); g.open = [];
        if(g.matched.size === 16){
            paintMemory("全部そろいました！");
            gameFinish(g.moves + "手でクリア！", Math.max(10, 100 - (g.moves - 8) * 5));
            return;
        }
        paintMemory("そろった！");
        return;
    }
    g.lock = true;
    paintMemory("ちがいました…");
    setTimeout(() => {
        if(feat.g !== g) return;
        g.open = []; g.lock = false;
        paintMemory("つぎをめくってください。");
    }, 800);
}

// ---------- 絵文字クイズ ----------
function startQuiz(){
    feat.g.questions = shuffled(QUIZ_BANK).slice(0, 10);
    feat.g.n = 0; feat.g.correct = 0;
    paintQuiz("");
}

function paintQuiz(message){
    const g = feat.g, q = g.questions[g.n];
    const wrongs = shuffled(QUIZ_BANK.filter((x) => x[1] !== q[1])).slice(0, 3).map((x) => x[1]);
    g.options = shuffled(wrongs.concat(q[1]));
    gameShow('<h4 style="margin:0">🤔 絵文字クイズ　' + (g.n + 1) + ' / 10　正解 ' + g.correct + '</h4><div class="game-msg">' + message + '</div>' +
        '<div class="quiz-emoji">' + q[0] + '</div><div class="quiz-opts">' + g.options.map((o, i) => '<button type="button" class="button-secondary" data-t="game:quiz" data-i="' + i + '">' + escapeHtml(o) + '</button>').join("") + '</div><div id="gResult"></div>');
}

function quizPick(node){
    const g = feat.g, q = g.questions[g.n], answer = g.options[Number(node.dataset.i)];
    const ok = answer === q[1];
    if(ok) g.correct++;
    g.n++;
    if(g.n >= 10){
        gameShow('<h4 style="margin:0">🤔 絵文字クイズ　結果</h4><div class="game-msg">' + (ok ? "正解！" : "残念、正解は「" + escapeHtml(q[1]) + "」") + '</div><div id="gResult"></div>');
        gameFinish("10問中 " + g.correct + " 問正解！", g.correct);
        return;
    }
    paintQuiz(ok ? "⭕ 正解！" : "❌ 正解は「" + escapeHtml(q[1]) + "」でした");
}

// ---------- しりとり ----------
function startShiritori(){
    const first = SHI_WORDS[Math.floor(Math.random() * SHI_WORDS.length)];
    Object.assign(feat.g, {used:new Set([first]), last:first, count:0, log:["CPU：" + first]});
    paintShiritori("ひらがなで続けてください（「ん」で終わると負け）。");
}

function paintShiritori(message){
    const g = feat.g, need = lastKana(g.last);
    gameShow('<h4 style="margin:0">🔤 しりとり　あなたの回数：' + g.count + '</h4><div class="game-msg">' + message + '</div>' +
        '<div class="shi-log">' + g.log.slice(-8).map((l) => escapeHtml(l)).join("<br>") + '</div>' +
        '<div class="meta">次は「' + escapeHtml(need) + '」から始まることば</div>' +
        '<div class="row" style="justify-content:flex-start"><input id="gWord" type="text" maxlength="20" placeholder="ひらがなで入力" style="max-width:180px"><button type="button" class="button" data-t="game:shi">答える</button><button type="button" class="button-secondary" data-t="game:giveup">ここで終わる</button></div><div id="gResult"></div>');
}

function shiritoriSubmit(){
    const g = feat.g, word = ($("gWord") ? $("gWord").value : "").trim();
    if(!/^[ぁ-ゖー]{2,20}$/.test(word)){ showToast("ひらがなで2文字以上を入力してください。"); return; }
    if(firstKana(word) !== lastKana(g.last)){ showToast("「" + lastKana(g.last) + "」から始まることばにしてください。"); return; }
    if(g.used.has(word)){ showToast("そのことばはもう出ています。"); return; }
    g.log.push("あなた：" + word);
    if(lastKana(word) === "ん"){
        paintShiritori("「ん」で終わってしまいました…負けです。");
        gameFinish("「ん」で終了。" + g.count + "回続きました", g.count);
        return;
    }
    g.used.add(word); g.count++;
    if(g.count >= 50){ paintShiritori("すごい！"); gameFinish("50回達成！", 50); return; }
    const need = lastKana(word);
    const options = SHI_WORDS.filter((w) => !g.used.has(w) && firstKana(w) === need);
    if(!options.length){
        paintShiritori("CPUはことばが思いつきません。あなたの勝ち！");
        gameFinish("CPUに勝ちました！" + g.count + "回", g.count);
        return;
    }
    const reply = options[Math.floor(Math.random() * options.length)];
    g.used.add(reply); g.last = reply; g.log.push("CPU：" + reply);
    paintShiritori("");
}

function shiritoriGiveUp(){
    const g = feat.g;
    paintShiritori("ここで終了します。");
    gameFinish(g.count + "回で終了", g.count);
}
