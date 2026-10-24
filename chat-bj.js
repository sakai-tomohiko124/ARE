"use strict";
// ===== ブラックジャック（ディーラー＝CPUと1人で対戦）=====
// 持ち点（コイン）はこの端末にだけ保存されます。お金とは関係ありません。
// ルール：21に近い方の勝ち。22以上は負け。ディーラーは17以上になるまで引く。ブラックジャック（最初の2枚で21）は1.5倍。

feat.bj = {deck:[], player:[], dealer:[], bet:10, phase:"bet", msg:""};
const BJ_SUITS = ["♠", "♥", "♦", "♣"], BJ_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function initBj(){ registerTool("bj", onBjAction); }

function bjCoins(){ try{ const v = Number(localStorage.getItem("are_bj_coins")); return Number.isFinite(v) && v > 0 ? v : (localStorage.getItem("are_bj_coins") === null ? 100 : 0); }catch(_e){ return 100; } }
function bjSetCoins(v){ try{ localStorage.setItem("are_bj_coins", String(Math.max(0, Math.floor(v)))); }catch(_e){} }

function bjNewDeck(){
    const deck = [];
    BJ_SUITS.forEach((s) => BJ_RANKS.forEach((r) => deck.push({s, r})));
    const buf = new Uint32Array(deck.length);
    (self.crypto || window.crypto).getRandomValues(buf);
    for(let i = deck.length - 1; i > 0; i--){ const j = buf[i] % (i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    return deck;
}

function bjValue(hand){
    let total = 0, aces = 0;
    hand.forEach((c) => { if(c.r === "A"){ aces++; total += 11; } else if("JQK".includes(c.r)) total += 10; else total += Number(c.r); });
    while(total > 21 && aces > 0){ total -= 10; aces--; }
    return total;
}
function bjIsBj(hand){ return hand.length === 2 && bjValue(hand) === 21; }

function openBj(){
    const b = feat.bj;
    b.phase = "bet"; b.msg = "";
    if(bjCoins() < 1){ bjSetCoins(100); b.msg = "持ち点がなくなったので、100コインに戻しました。"; }
    if(b.bet > bjCoins()) b.bet = Math.max(1, bjCoins());
    openSheet(toolHead("🃏 ブラックジャック", "ディーラー（CPU）と対戦。コインはこの端末だけの遊び用です。") + '<div id="bjBody"></div>' + toolClose());
    paintBj();
}

function bjCardHtml(c, hidden){
    if(hidden) return '<span class="bj-card back">🂠</span>';
    return '<span class="bj-card' + (c.s === "♥" || c.s === "♦" ? " red" : "") + '">' + c.r + c.s + '</span>';
}

function paintBj(){
    const box = $("bjBody");
    if(!box) return;
    const b = feat.bj, coins = bjCoins();
    let html = '<div class="meta">持ち点：<b>' + coins + '</b> コイン</div>';
    if(b.phase === "bet"){
        html += (b.msg ? '<div class="admin-card">' + escapeHtml(b.msg) + '</div>' : "") +
            '<label>かけるコイン <input type="number" id="bjBet" min="1" max="' + coins + '" value="' + b.bet + '" data-live="1" data-t="bj:bet"></label>' +
            '<div class="row"><button type="button" class="button" data-t="bj:deal">🃏 配る</button></div>';
    }else{
        const playing = b.phase === "play";
        html += '<div><b>ディーラー</b> ' + (playing ? "" : "(" + bjValue(b.dealer) + ")") + '<div class="bj-hand">' + b.dealer.map((c, i) => bjCardHtml(c, playing && i === 1)).join("") + '</div></div>' +
            '<div><b>あなた</b> (' + bjValue(b.player) + ')<div class="bj-hand">' + b.player.map((c) => bjCardHtml(c)).join("") + '</div></div>';
        if(playing){
            html += '<div class="row"><button type="button" class="button" data-t="bj:hit">もう1枚（ヒット）</button><button type="button" class="button-secondary" data-t="bj:stand">勝負（スタンド）</button>' +
                (b.player.length === 2 && coins >= b.bet * 2 ? '<button type="button" class="button-secondary" data-t="bj:double">2倍がけ</button>' : "") + '</div>';
        }else{
            html += '<div class="admin-card"><b>' + escapeHtml(b.msg) + '</b></div><div class="row"><button type="button" class="button" data-t="bj:again">もう一度</button></div>';
        }
    }
    box.innerHTML = html;
}

function bjDraw(hand){ const b = feat.bj; if(b.deck.length < 10) b.deck = bjNewDeck(); hand.push(b.deck.pop()); }

function bjFinish(){
    const b = feat.bj, pv = bjValue(b.player);
    let coins = bjCoins(), delta = 0, text;
    if(pv > 21){ delta = -b.bet; text = "バスト！ " + b.bet + " コイン負け"; }
    else{
        while(bjValue(b.dealer) < 17) bjDraw(b.dealer);
        const dv = bjValue(b.dealer);
        if(bjIsBj(b.player) && !bjIsBj(b.dealer)){ delta = Math.floor(b.bet * 1.5); text = "ブラックジャック！ +" + delta + " コイン"; }
        else if(dv > 21){ delta = b.bet; text = "ディーラーがバスト！ +" + delta + " コイン"; }
        else if(pv > dv){ delta = b.bet; text = "あなたの勝ち！ +" + delta + " コイン"; }
        else if(pv < dv){ delta = -b.bet; text = "ディーラーの勝ち… " + b.bet + " コイン負け"; }
        else text = "引き分け（コインは変わりません）";
    }
    bjSetCoins(coins + delta);
    b.phase = "done"; b.msg = text;
}

function onBjAction(action, node){
    const b = feat.bj;
    if(action === "bet"){ b.bet = Math.max(1, Math.min(bjCoins(), Math.floor(Number(node.value)) || 1)); return; }
    if(action === "deal" || action === "again"){
        if(action === "again"){ b.phase = "bet"; b.msg = ""; if(bjCoins() < 1){ bjSetCoins(100); b.msg = "持ち点がなくなったので、100コインに戻しました。"; } if(b.bet > bjCoins()) b.bet = bjCoins(); paintBj(); return; }
        const input = $("bjBet"); if(input) b.bet = Math.max(1, Math.min(bjCoins(), Math.floor(Number(input.value)) || 1));
        b.deck = bjNewDeck(); b.player = []; b.dealer = [];
        bjDraw(b.player); bjDraw(b.dealer); bjDraw(b.player); bjDraw(b.dealer);
        b.phase = "play";
        if(bjIsBj(b.player) || bjIsBj(b.dealer)) bjFinish();
        paintBj(); return;
    }
    if(b.phase !== "play") return;
    if(action === "hit"){ bjDraw(b.player); if(bjValue(b.player) >= 21) bjFinish(); }
    else if(action === "stand") bjFinish();
    else if(action === "double"){ if(bjCoins() >= b.bet * 2 && b.player.length === 2){ b.bet *= 2; bjDraw(b.player); bjFinish(); } }
    paintBj();
}
