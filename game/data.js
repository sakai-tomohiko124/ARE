"use strict";
// ===== RPG「ARE 〜そういうときは、AREだ！〜」のデータ：地図・見た目・敵・どうぐ =====
// 物語の元：「そういうときは、AREだ！」「人生2周目」「リプレイワールド」「未来予知VS迷惑ボーイ」など。
// かわいいモンスターだけ（虫・気持ち悪い見た目は出しません）。

/** 文字の地図を作る（四角形を塗る／1マス置く／ふち取り）。横幅がずれないように、コードで組み立てる */
function rpgMk(w, h, fill, ops){
    const g = Array.from({length:h}, () => Array(w).fill(fill));
    ops.forEach((o) => {
        if(o[0] === "r"){ for(let y = o[2]; y < o[2] + o[4]; y++) for(let x = o[1]; x < o[1] + o[3]; x++) if(g[y] && g[y][x] !== undefined) g[y][x] = o[5]; }
        else if(o[0] === "p"){ if(g[o[2]] && g[o[2]][o[1]] !== undefined) g[o[2]][o[1]] = o[3]; }
        else if(o[0] === "b"){ for(let x = 0; x < w; x++){ g[0][x] = o[1]; g[h - 1][x] = o[1]; } for(let y = 0; y < h; y++){ g[y][0] = o[1]; g[y][w - 1] = o[1]; } }
    });
    return g.map((r) => r.join(""));
}

// ---- マスの種類：c=色, w=歩ける, e=絵文字, d=もよう ----
const RPG_TILES = {
    ".":{c:"#6cc070", w:1, d:"tuft"}, ",":{c:"#dcc08a", w:1, d:"path"}, "~":{c:"#4a90e2", w:0, d:"wave"},
    "T":{c:"#6cc070", w:0, e:"🌳"}, "#":{c:"#5b6475", w:0, d:"brick"}, "=":{c:"#d2a96b", w:1, d:"plank"},
    "c":{c:"#c0475a", w:1, d:"carpet"}, "W":{c:"#7cc7f0", w:0, d:"window"}, "S":{c:"#f2f7ff", w:1, d:"snow"},
    "s":{c:"#d3deea", w:1, d:"path"}, "t":{c:"#f2f7ff", w:0, e:"🎄"}, "w":{c:"#fafafa", w:1, d:"grid"},
    "G":{c:"#23408f", w:1, d:"gate"}, "P":{c:"#d2a96b", w:0, e:"🖥️"}, "L":{c:"#d2a96b", w:0, e:"📚"},
    "K":{c:"#9a6b3c", w:0, e:"🛒"}, "p":{c:"#d2a96b", w:0, e:"🪴"}, "D":{c:"#9a6b3c", w:1, e:"🚪"},
    "b":{c:"#d2a96b", w:0, e:"🪑"}, "f":{c:"#6cc070", w:1, e:"🌸"}, "N":{c:"#243044", w:0, d:"bldg"},
    "H":{c:"#c2571a", w:0, d:"roof"}, "h":{c:"#fde9a8", w:0, d:"wall"}, "M":{c:"#aeb6c4", w:1, d:"stone"},
    "E":{c:"#8a93a3", w:1, e:"🪜"}, "n":{c:"#33415c", w:1, d:"nroad"}, "m":{c:"#2b3a55", w:0, e:"🌃"},
    "q":{c:"#e9eef7", w:1, d:"tech"}, "Q":{c:"#cfe0ff", w:0, d:"glass"}, "z":{c:"#1b2640", w:0, d:"server"},
    "r":{c:"#d2a96b", w:0, e:"🧸"}, "k":{c:"#e5d6b8", w:0, e:"🎂"}, "i":{c:"#9bd0ff", w:1, d:"ice"},
    "X":{c:"#fafafa", w:1, d:"grid"}
};

// ---- 見た目（ドット絵ふうに、キャンバスで描く）----
// skin:はだ hair:かみ style:short|long|bob|twin|cap|spike|bun top:上着 bot:下 acc:glasses|xr|santa|tie|scarf|none
const RPG_LOOKS = {
    heroM:{skin:"#f6d2b0", hair:"#2d2118", style:"short", top:"#2f6fdc", bot:"#374151", acc:"tie"},
    heroF:{skin:"#f9d9bd", hair:"#6b3a1e", style:"long", top:"#e8506b", bot:"#4b5563", acc:"none"},
    akito:{skin:"#f6d2b0", hair:"#e07a1f", style:"spike", top:"#ff8a00", bot:"#2b3a67", acc:"none"},
    haruki:{skin:"#f3cfae", hair:"#1f2a44", style:"short", top:"#3a4a6b", bot:"#222a3a", acc:"glasses"},
    mina:{skin:"#f9d9bd", hair:"#8a5a2b", style:"bun", top:"#4caf7a", bot:"#2e6b4a", acc:"none"},
    kaito:{skin:"#f6d2b0", hair:"#3b2a20", style:"short", top:"#7aa7e8", bot:"#3a4a6b", acc:"xr"},
    arisa:{skin:"#f9d9bd", hair:"#2a1a14", style:"twin", top:"#f4a6c0", bot:"#7a4a6b", acc:"none"},
    reiya:{skin:"#f3cfae", hair:"#7a1fd1", style:"spike", top:"#14b8a6", bot:"#1f2937", acc:"xr"},
    ekiin:{skin:"#f3cfae", hair:"#222", style:"cap", top:"#24407a", bot:"#24407a", acc:"none"},
    oyaji:{skin:"#f0c9a2", hair:"#ddd", style:"cap", top:"#fff", bot:"#555", acc:"none"},
    obaa:{skin:"#f0c9a2", hair:"#cfcfcf", style:"bun", top:"#7bc67e", bot:"#4b6b4b", acc:"none"},
    tourist:{skin:"#f6d2b0", hair:"#5a3a1c", style:"cap", top:"#f2c94c", bot:"#4a5568", acc:"none"},
    kid:{skin:"#f9d9bd", hair:"#3a2a1a", style:"short", top:"#ef6c3b", bot:"#35507a", acc:"none"},
    aota:{skin:"#f3cfae", hair:"#222a35", style:"short", top:"#556070", bot:"#2a3140", acc:"none"},
    saeko:{skin:"#f9d9bd", hair:"#111", style:"long", top:"#1b1b27", bot:"#1b1b27", acc:"none"},
    kento:{skin:"#f6d2b0", hair:"#3b2a20", style:"short", top:"#5b8def", bot:"#3a4a6b", acc:"glasses"},
    misaki:{skin:"#f9d9bd", hair:"#111", style:"long", top:"#c0c8d8", bot:"#4a5568", acc:"none"},
    tatsuya:{skin:"#eebf98", hair:"#222", style:"spike", top:"#2b2b2b", bot:"#222", acc:"none"},
    ryu:{skin:"#f0c9a2", hair:"#eee", style:"bald", top:"#6b4a2b", bot:"#3a2a1a", acc:"none"},
    hiro:{skin:"#f6d2b0", hair:"#1a1a1a", style:"short", top:"#7a5a3a", bot:"#2b2b2b", acc:"scarf"},
    santa:{skin:"#f3cfae", hair:"#222a35", style:"short", top:"#d62828", bot:"#d62828", acc:"santa"},
    haruya:{skin:"#f6d2b0", hair:"#3b2a20", style:"short", top:"#b0b7c3", bot:"#8a93a3", acc:"none"},
    momone:{skin:"#f9d9bd", hair:"#5a3a1c", style:"bob", top:"#c0c7d4", bot:"#8a93a3", acc:"none"},
    robo:{skin:"#dfe6ee", hair:"#7b8794", style:"cap", top:"#4a6fa5", bot:"#4a6fa5", acc:"glasses"},
    youngA:{skin:"#f6d2b0", hair:"#e07a1f", style:"spike", top:"#fff3d6", bot:"#4a5568", acc:"none"},
    youngH:{skin:"#f3cfae", hair:"#1f2a44", style:"short", top:"#dfe6f0", bot:"#2a3140", acc:"glasses"},
    kouhai:{skin:"#f9d9bd", hair:"#d4a373", style:"bob", top:"#8ecae6", bot:"#4a5568", acc:"none"},
    citizen:{skin:"#f6d2b0", hair:"#444", style:"short", top:"#90caf9", bot:"#37474f", acc:"none"},
    citizenF:{skin:"#f9d9bd", hair:"#a0522d", style:"bob", top:"#ce93d8", bot:"#455a64", acc:"none"},
    teddy:{skin:"#d9a066", hair:"#d9a066", style:"cap", top:"#c68642", bot:"#c68642", acc:"none"}
};
// 声の高さ・速さ（ブラウザの読み上げ。許可されていれば流れます）
const RPG_VOICES = {
    "me:m":[0.85, 1.05], "me:f":[1.3, 1.08], "アキト":[0.95, 1.12], "ハルキ":[0.75, 1.0], "ミナ":[1.35, 1.1], "海斗":[1.0, 1.1], "亜理紗":[1.4, 1.08],
    "玲也":[1.1, 1.2], "蒼太":[0.85, 0.98], "さえこ":[1.2, 0.98], "健斗":[0.95, 1.1], "美咲":[1.3, 1.02], "竜也":[0.6, 0.95], "龍之介":[0.55, 0.9],
    "紘":[0.9, 1.05], "サンタ":[0.8, 1.0], "はるや":[0.95, 1.1], "ももね":[1.45, 1.1], "アナウンくん":[1.6, 1.1], "ノイズ":[1.7, 1.15],
    "若いアキト":[1.05, 1.15], "若いハルキ":[0.85, 1.0], "ぬいぐるみ王":[0.5, 0.85], "":[1, 1]
};

// ---- どうぐ・そうび ----
const RPG_ITEMS = {
    onigiri:{n:"おにぎり", d:"HPを50かいふく", hp:50, price:12},
    special:{n:"スペシャルおにぎり", d:"HPを160かいふく", hp:160, price:50},
    coffee:{n:"ブラックコーヒー", d:"MPを20かいふく", mp:20, price:35},
    energy:{n:"エナジードリンク", d:"MPを60かいふく", mp:60, price:90},
    omamori:{n:"ふっかつのおまもり", d:"たおれた なかまを HP半分で ふっかつ", revive:true, price:120}
};
const RPG_EQUIP = {
    w0:{slot:"w", n:"ふつうのキーボード", v:0, price:0}, w1:{slot:"w", n:"メカニカルキーボード", v:5, price:120}, w2:{slot:"w", n:"ゲーミングキーボード", v:11, price:420}, w3:{slot:"w", n:"ミスリルキーボード", v:19, price:1200}, w4:{slot:"w", n:"ARE かいはつキット", v:30, price:3000},
    a0:{slot:"a", n:"Tシャツ", v:0, price:0}, a1:{slot:"a", n:"パーカー", v:4, price:100}, a2:{slot:"a", n:"しゃいんジャケット", v:9, price:350}, a3:{slot:"a", n:"ノイキャンヘッドホンアーマー", v:16, price:1000}, a4:{slot:"a", n:"ぬくぬくフリース", v:26, price:2800},
    c0:{slot:"c", n:"なし", v:0, price:0}, c1:{slot:"c", n:"ごえんのお守り", v:3, price:90}, c2:{slot:"c", n:"ほしのストラップ", v:7, price:380}, c3:{slot:"c", n:"きずなのリング", v:13, price:1100}
};
// お店の品ぞろえ：メモリを何個もっているかで増える
function rpgShopStock(mems){
    const l = ["onigiri", "coffee", "omamori"];
    if(mems >= 1) l.push("special", "w1", "a1", "c1");
    if(mems >= 2) l.push("energy", "w2", "a2");
    if(mems >= 3) l.push("c2");
    if(mems >= 4) l.push("w3", "a3");
    if(mems >= 5) l.push("c3", "w4", "a4");
    return l;
}

// ---- 敵（かわいいモンスターたち）----
// hp,atk,def,exp,g, acts:[[わざ名,ひっさつ(0=ふつう,1=ぜんたい), 出やすさ, ばいりつ]]
function rpgE(n, e, hp, atk, def, exp, g, acts, extra){ return Object.assign({n, e, hp, atk, def, exp, g, acts:acts || []}, extra || {}); }
const RPG_FOES = {
    zunda:rpgE("ずんだガエル", "🐸", 26, 9, 2, 8, 9, [["ぷるぷる ジャンプ", 0, 1, 1.2], ["ずんだをとばす", 0, 1, 1.0]]),
    sasa:rpgE("ささかまフィッシュ", "🐟", 30, 11, 3, 10, 11, [["ぴちぴち ビンタ", 0, 1, 1.2], ["あわを ふく", 1, 0.5, 0.6]]),
    kokeshi:rpgE("こけしちゃん", "🪆", 36, 13, 4, 13, 14, [["ころころ タックル", 0, 1, 1.2], ["くるくる まわる", 1, 0.5, 0.6]]),
    gyutan:rpgE("ギュータン・ノイズ", "🐮", 190, 21, 6, 90, 150, [["もーもー タックル", 0, 1, 1.3], ["ノイズの さけび", 1, 0.7, 0.7], ["タンシチューの いかり", 0, 0.6, 1.8]], {boss:true, bg:"sendai", say50:"ギュータン・ノイズ「もー…！ メモリは わたさないもー！」"}),
    spam:rpgE("スパムにゃん", "🐱", 52, 17, 6, 22, 22, [["ねこパンチ", 0, 1, 1.2], ["ひっかく", 0, 1, 1.0], ["メールを いっぱい おくる", 1, 0.5, 0.6]]),
    lag:rpgE("ラグハム", "🐹", 58, 18, 7, 25, 24, [["ほっぺ たいあたり", 0, 1, 1.2], ["ひまわりの たね なげ", 0, 1, 1.0]]),
    nullpo:rpgE("ヌルホー", "🦉", 64, 20, 8, 28, 27, [["ふわっと たいあたり", 0, 1, 1.2], ["ホーホー ボイス", 1, 0.6, 0.6]]),
    panda:rpgE("コピペ・パンダ", "🐼", 330, 28, 10, 160, 260, [["ごろごろ プレス", 0, 1, 1.3], ["コピペ アタック", 0, 1, 1.5], ["パンダの ほえる", 1, 0.7, 0.7]], {boss:true, bg:"tokyo", say50:"コピペ・パンダ「ぜんぶ コピーして ふやすぞ…！」"}),
    fuwa:rpgE("ふわふわクラウド", "☁️", 76, 23, 9, 34, 30, [["ふわふわ ぶつかり", 0, 1, 1.2], ["もくもく", 1, 0.5, 0.6]]),
    mashiro:rpgE("ましろメェ", "🐑", 84, 25, 10, 38, 34, [["もこもこ ずつき", 0, 1, 1.2], ["ひつじのなみだ", 0, 0.5, 0.9]]),
    anaun:rpgE("アナウンくん・ノイズ", "🤖", 430, 34, 12, 220, 360, [["ピーガー ビーム", 0, 1, 1.3], ["おおごえ アナウンス", 1, 0.8, 0.7], ["ルールを かきかえる", 0, 0.6, 1.6]], {boss:true, bg:"white", say50:"アナウンくん・ノイズ「ルール変更！ みんな ぬいぐるみ の 刑〜！」"}),
    penguin:rpgE("ぽんぽんペンギン", "🐧", 98, 29, 12, 45, 40, [["ぺたぺた ビンタ", 0, 1, 1.2], ["こおりの つぶて", 0, 0.6, 1.2]]),
    snowman:rpgE("ゆきだるまん", "⛄", 108, 31, 14, 50, 44, [["ゆきだま なげ", 0, 1, 1.2], ["ふぶき", 1, 0.5, 0.6]]),
    rabbit:rpgE("ゆきうさぎ", "🐰", 92, 32, 11, 48, 42, [["ぴょんぴょん キック", 0, 1, 1.2], ["にんじんミサイル", 0, 0.6, 1.1]]),
    reindeer:rpgE("トナカイ・ノイズ", "🦌", 560, 41, 15, 300, 480, [["つの ずつき", 0, 1, 1.3], ["ベルの ひびき", 1, 0.8, 0.7], ["プレゼント ばくだん", 0, 0.6, 1.7]], {boss:true, bg:"xmas", say50:"トナカイ・ノイズ「メリークリスマスは おわらせない！」"}),
    octo:rpgE("タコッチ・ループ", "🐙", 124, 36, 15, 58, 50, [["くるくる ループ", 0, 1, 1.2], ["すみを ふく", 1, 0.5, 0.6]]),
    hedgehog:rpgE("ハリセン・キャッシュ", "🦔", 132, 38, 17, 62, 54, [["ころころ アタック", 0, 1, 1.2], ["とげとげ ガード", 0, 0.5, 0.8]]),
    turtle:rpgE("ファイアウォールかめ", "🐢", 148, 35, 22, 66, 58, [["こうら ぶつけ", 0, 1, 1.2], ["ひっこむ", 0, 0.5, 0.2]]),
    whale:rpgE("デッドロック・くじら", "🐳", 760, 48, 18, 420, 650, [["おおなみ", 1, 0.9, 0.7], ["ヒレ ビンタ", 0, 1, 1.3], ["うごけなく なる うた", 0, 0.7, 1.7]], {boss:true, bg:"labn", say50:"デッドロック・くじら「ぐるぐる…まわって うごけない…たすけてぇ…」"}),
    fox:rpgE("フィッシングきつね", "🦊", 168, 44, 20, 76, 70, [["コンコン アタック", 0, 1, 1.2], ["ばけて だます", 0, 0.5, 1.3]]),
    bear:rpgE("ブラックアウトベア", "🐻", 190, 47, 23, 84, 78, [["ブラックアウト ハグ", 0, 1, 1.3], ["のしかかり", 0, 0.6, 1.5]]),
    unicorn:rpgE("ユニコーン・ノイズ", "🦄", 176, 46, 21, 90, 82, [["きらきら ずつき", 0, 1, 1.2], ["にじいろ ビーム", 1, 0.6, 0.7]]),
    teddy:rpgE("ブラックアウト・ぬいぐるみ王", "🧸", 1500, 56, 24, 0, 0, [["ぎゅーっと ブラックアウト", 1, 0.9, 0.8], ["ぬいぐるみ パンチ", 0, 1, 1.3], ["さびしさの なみだ", 0, 0.7, 1.8], ["ひとりぼっち バースト", 1, 0.5, 1.0]], {boss:true, final:true, bg:"future", say50:"ぬいぐるみ王「だれも…へんじを くれなかった…！ ひとりは いやだ…！」"})
};

// ---- なかま（職業のステータス：[はじめ, レベルごとの伸び]）----
const RPG_CLASS = {
    hero:{n:"", hp:[26, 11], mp:[6, 3], atk:[8, 3.2], def:[4, 2.0], agi:[8, 0.6]},
    haruki:{n:"ハルキ", hp:[22, 8], mp:[10, 4], atk:[7, 2.4], def:[5, 1.9], agi:[7, 0.5]},
    akito:{n:"アキト", hp:[30, 12], mp:[4, 2], atk:[10, 3.6], def:[4, 1.8], agi:[9, 0.6]}
};
function rpgNeed(lv){ return Math.round(8 + lv * lv * 2.6); }

// ボスの強さ調整（シミュレーションで、各ボスに勝てる目安のレベルをそろえた）
(function(){
    const k = {gyutan:[1.9, 1.25], panda:[2.1, 1.3], anaun:[2.2, 1.35], reindeer:[2.3, 1.4], whale:[2.4, 1.45], teddy:[2.4, 1.5]};
    Object.keys(k).forEach((id) => { const f = RPG_FOES[id]; f.hp = Math.round(f.hp * k[id][0]); f.atk = Math.round(f.atk * k[id][1]); });
})();
