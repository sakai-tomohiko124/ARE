"use strict";
// ===== 難易度・モンスター200種・ボス15体・なかま11人 =====
// 地図ごとの「推奨レベル」から、敵の強さを自動で決めます。
//   地図1=Lv1 / 2=Lv3 / 3=Lv5 / 4=Lv10 / 5=Lv15 / 6=Lv20 / 7=Lv26 / 8=Lv32 / 9=Lv38 / 10=Lv44 / 11=Lv50 / XR=Lv99
// モンスター：ふつう185種（うち「キラキラ」＝経験値とおかねが たくさん もらえる 22種）＋ボス15体＝200種

const TQ_ZONES = [
    {z:1, maps:["sendai"], rec:1, adj:0.78}, {z:2, maps:["tokyo", "aprt"], rec:3, adj:1.0}, {z:3, maps:["tower"], rec:5}, {z:4, maps:["white"], rec:10},
    {z:5, maps:["xmas", "base"], rec:15}, {z:6, maps:["labn"], rec:20}, {z:7, maps:["future"], rec:26}, {z:8, maps:["n8"], rec:32},
    {z:9, maps:["n9"], rec:38, adj:0.88}, {z:10, maps:["n10"], rec:44}, {z:11, maps:["n11"], rec:50}, {z:12, maps:["xr"], rec:99, adj:0.9}
];
// 「絵文字 なまえ」。いちばん うしろの 2つ（XRは3つ）が「キラキラ」の 稼ぎモンスター
const TQ_NEW_FOES = {
    1:"🍡 もちもちずんだん,🦌 しかっこ,🌾 いなほっこ,🍎 りんごろう,🐦 ちゅんすけ,🎋 たなばたん,⛩️ とりいくん,🐻 くまのすけ,🦆 あひるん,🐿️ りすまる,💰 おこがねずんだ,🌟 ゴールデンささかま",
    2:"📱 スマホンタ,🚃 でんしゃんこ,🗼 タワーん,🍜 らーめんこぞう,🐩 ネオンプードル,🐈 よるねこ,🐕 まいごワンコ,🥡 テイクアウとん,🎧 ヘッドホンくん,💡 ぴかぴかライト,🪙 おこづかいコイン,🎰 ラッキーキャッシュ",
    3:"📎 クリップっこ,🖨️ プリンタン,🗂️ ファイルんご,☕ コーヒーぼうや,🪴 かんようくん,⏰ ちこくくん,🐭 スケねず,📌 おしピンちゃん,✏️ えんぴつくん,🧮 そろばんくん,🐘 ぐらふぞう,🗃️ ほかんこぞう,💼 ブリーフくん,💴 ボーナスコイン,💎 エリートダイヤ",
    4:"🐇 ましろウサ,🕊️ しろはと,🦢 スワンちゃん,🥛 ミルクたん,🍚 おこめっこ,🧁 ホイップん,🥚 たまごろう,🦙 ふわラマ,🫧 あわあわボール,🕯️ ろうそくん,🍥 なるとん,🤍 しろいおたから,💫 ミラクルほし",
    5:"🎄 もみのきくん,🎁 プレゼンとり,🔔 ベルりん,🧦 くつしたん,🍪 クッキーぼうや,🧤 てぶくろん,🦭 あざらしん,🐻‍❄️ しろくまのすけ,🍗 チキンっこ,🎂 ケーキんぼう,🎁 ゴールドプレゼント,🔔 きんのベル",
    6:"🧪 ビーカーん,🔬 けんびきょん,🧲 ジシャクん,🔋 でんちゃん,💾 フロッピーちゃん,🖱️ マウスぴょん,⌨️ キーボーイ,🔦 ライトくん,🛰️ サテちゃん,🧬 らせんくん,⚗️ おうごんのくすり,🔌 ゴールドバッテリー",
    7:"🤖 ロボっこ,🛸 ゆーふぉん,🪐 わくせいたん,🚀 ロケットん,🐬 イルカんたい,🦚 くじゃっくん,🦜 ミライオウム,🦩 フラミンゴん,🪁 カイトん,🦥 ナマケモノん,💎 ダイヤモンドロボ,👑 おうごんのティアラ",
    8:"🍄 きのこっこ,🌰 どんぐりん,🦫 ビーバーん,🌲 もりもりツリー,🍃 はっぱくん,🐨 コアラっこ,🦘 カンガルんぼ,🦧 オランちゃん,🌷 チューリップひめ,🌻 ひまわりん,🪵 まるたん,🍓 いちごっこ,🫐 ブルーベリん,🍀 しあわせクローバー,🌈 にじのしずく",
    9:"🐠 ひれひれフィッシュ,🐡 ふぐっち,🦈 ちびシャーク,🐋 ちびくじら,🦑 いかいか,🐚 かいがらひめ,🦀 かにっこ,🦞 ロブスたん,🪸 サンゴちゃん,🦐 えびっこ,🪼 クラゲん,🧜 マーメイドちゃん,🦦 カワウそん,🐚 しんじゅのかいがら,💠 うみのほうせき",
    10:"🦅 そらのワシん,🪶 はねっこ,🐦‍⬛ ほしカラス,🐔 ことりっこ,🐤 ひよこっち,🐥 ふわひよ,🌤️ おひさまっち,⛅ くもまる,⚡ かみなりん,🌙 おつきうさぎ,☄️ すいせいん,🎈 ふうせんくん,🛩️ ひこうきん,⚡ ゴールドサンダー,✨ スターダスト",
    11:"👻 おばけちゃん,🎃 ジャックんぼ,🦇 コウモリん,🐈‍⬛ くろねこ,🔮 すいしょうたま,🌑 やみのたまご,🌌 ぎんがっこ,👾 ドットっち,🃏 ジョーカーちゃん,🎭 おめんくん,🗝️ かぎっこ,🪄 まほうのつえん,🌀 うずまきん,🧰 やみのたからばこ,👑 ノイズのかんむり",
    12:"🍩 ドーナツん,🍰 ショートケーキくん,🍫 チョコっこ,🍭 ぺろぺろキャンディ,🍦 ソフトクリーム,🧋 タピオカん,🍔 バーガーくん,🍟 ポテトっち,🍕 ピザっこ,🥞 パンケーキん,🍉 すいかっこ,🍑 ももりん,🍇 ぶどうちゃん,🏆 ゴールドトロフィー,🎟️ ゴールデンチケット,💎 ぷにぷにダイヤ"
};
// 各ゾーンの「もとからいた敵」（弱い→強い の順）
const TQ_OLD_FOES = {1:["zunda", "sasa", "kokeshi"], 2:["spam", "lag", "nullpo"], 3:[], 4:["fuwa", "mashiro"], 5:["penguin", "snowman", "rabbit"], 6:["octo", "hedgehog", "turtle"], 7:["fox", "bear", "unicorn"], 8:[], 9:[], 10:[], 11:[], 12:["pudding", "mochi", "star", "candy"]};
const TQ_RICH_N = {12:3};   // キラキラの数（ほかは 2）

// ---- 強さの式（recLv = 推奨レベル）----
function tqNeed(lv){ return lv <= 30 ? Math.round(8 + lv * lv * 2.6) : 2350 + (lv - 30) * 120; }
const TQ_T = {rh:100, ra:170, hp:10, atk:1.5, def:0.28, bhp:27, batk:2.3};   // 難易度の つまみ（シミュレーションで調整）
const tqAp = (lv) => 8 + 3.2 * lv;                       // なかまの こうげき力の めやす
function tqFoeStat(lv, tier, rich){
    const ap = tqAp(lv), k = 1.6 + 0.2 * Math.min(lv, 60);   // exp：1レベルあげるのに たおす ひきすう
    const ramp = Math.min(lv, 50), rh = 1 + ramp / TQ_T.rh, ra = 1 + ramp / TQ_T.ra;
    let hp = ap * TQ_T.hp * tier * rh, atk = (5.9 + 2.65 * lv) * TQ_T.atk * ra * (0.9 + 0.2 * tier), def = ap * TQ_T.def * tier;
    let exp = tqNeed(Math.min(lv, 99)) / k * Math.pow(tier, 1.2), g = (4 + 2.6 * lv) * Math.pow(tier, 1.2);
    if(lv > 60) exp = tqNeed(70) / 3 * Math.pow(tier, 1.2);        // XR：レベル50〜99を 目ざす 人のために たっぷり
    if(rich){ hp *= 0.4; def *= 3; atk *= 0.55; exp *= 14; g *= 22; }
    return {hp:Math.max(8, Math.round(hp)), atk:Math.max(3, Math.round(atk)), def:Math.max(1, Math.round(def)), exp:Math.max(2, Math.round(exp)), g:Math.max(2, Math.round(g))};
}
function tqBossStat(lv){
    const ap = tqAp(lv);
    const rb = 1 + Math.min(lv, 52) / 450;
    return {hp:Math.round(ap * TQ_T.bhp * rb), atk:Math.round((5.9 + 2.65 * lv) * TQ_T.batk * rb), def:Math.round(ap * 0.3), exp:Math.round(tqNeed(Math.min(lv, 60)) * 0.9), g:Math.round(120 + lv * 40)};
}

// ---- わざ（なまえから 自動で 決める）----
const TQ_V1 = ["たいあたり", "ずつき", "ビンタ", "ころがり", "とびつき", "ぷにぷにアタック", "ひっかき", "ぴょんぴょんキック"];
const TQ_V2 = ["くるくる まわる", "ぎゅーっと おす", "ごろごろ アタック", "ふわっと ぶつかる", "ぽこぽこ たたく", "おおきく ジャンプ"];
const TQ_VALL = ["きらきら ビーム", "ふわふわ あらし", "もくもく ガス", "ぷるぷる なみだ", "ひらひら ふぶき", "ぱちぱち スパーク"];
function tqHash(s){ let h = 7; for(const c of String(s)) h = (h * 31 + c.codePointAt(0)) % 100003; return h; }
function tqActs(name, rich){
    const h = tqHash(name), head = Array.from(name).slice(0, 3).join("");
    const a = [[head + "の " + TQ_V1[h % TQ_V1.length], 0, 1, 1.2], [TQ_V2[(h >> 2) % TQ_V2.length], 0, 1, 1.0]];
    if(h % 3 !== 0) a.push([TQ_VALL[(h >> 3) % TQ_VALL.length], 1, 0.5, 0.6]);
    if(h % 5 === 0) a.push(["とっておきの いちげき", 0, 0.4, 1.7]);
    return rich ? [["きらきら ひかって にげまわる", 0, 1, 0.7], ["こつん", 0, 1, 1.0]] : a;
}

// ---- 敵を つくる（185種）----
const TQ_ZONE_FOES = {};   // z → {list:[ids], rich:[ids]}
(function(){
    TQ_ZONES.forEach((Z) => {
        const old = TQ_OLD_FOES[Z.z], news = TQ_NEW_FOES[Z.z].split(","), nr = TQ_RICH_N[Z.z] || 2;
        const normalNew = news.slice(0, news.length - nr), richNew = news.slice(news.length - nr);
        const list = old.slice(), rich = [];
        normalNew.forEach((s, i) => {
            const sp = s.indexOf(" "), id = "z" + Z.z + "_" + (i + 1);
            RPG_FOES[id] = rpgE(s.slice(sp + 1), s.slice(0, sp), 10, 5, 1, 1, 1, tqActs(s.slice(sp + 1), false)); list.push(id);
        });
        richNew.forEach((s, i) => {
            const sp = s.indexOf(" "), id = "z" + Z.z + "_r" + (i + 1);
            RPG_FOES[id] = rpgE(s.slice(sp + 1), s.slice(0, sp), 10, 5, 1, 1, 1, tqActs(s.slice(sp + 1), true), {rich:true}); rich.push(id);
        });
        list.forEach((id, i) => {
            const tier = 0.85 + 0.38 * (list.length > 1 ? i / (list.length - 1) : 0.5), st = tqFoeStat(Z.rec, tier, false);
            if(Z.adj){ st.hp = Math.round(st.hp * Z.adj); st.atk = Math.round(st.atk * Z.adj); }
            Object.assign(RPG_FOES[id], st, {zone:Z.z, tier});
        });
        rich.forEach((id) => { const st = tqFoeStat(Z.rec, 1.1, true); Object.assign(RPG_FOES[id], st, {zone:Z.z}); });
        TQ_ZONE_FOES[Z.z] = {list, rich};
    });
})();

// ---- ボス15体 ----
// 1ギュータン 2スパムキング 3コピペパンダ 4アナウンくん 5トナカイ 6くじら 7ぬいぐるみ王 8フクロウ 9クイーンミラ 10ドラゴン 11オメガ 12〜15 XRの4人
RPG_FOES.spamking = rpgE("スパムにゃん・キング", "😾", 10, 5, 1, 1, 1, [["ねこパンチ らんぶ", 0, 1, 1.3], ["めいわくメール ふぶき", 1, 0.8, 0.7], ["キングの ひっかき", 0, 0.7, 1.7]], {boss:true, say50:"にゃはは！ まだまだ、めいわくメールは とまらないにゃ！"});
RPG_FOES.owl = rpgE("ノイズ長老フクロウ", "🦉", 10, 5, 1, 1, 1, [["ホーホー ずつき", 0, 1, 1.3], ["よるの おおはばたき", 1, 0.8, 0.7], ["ちょうろうの せっきょう", 0, 0.7, 1.7]], {boss:true, say50:"ホホッ…やるのう。ならば わしの ほんきを みせよう。"});
RPG_FOES.miraqueen = rpgE("ノイズクイーン・ミラ", "👑", 10, 5, 1, 1, 1, [["くらやみの ムチ", 0, 1, 1.3], ["なみだの ノイズ", 1, 0.9, 0.7], ["さびしさの ほうこう", 0, 0.7, 1.8]], {boss:true, say50:"もう… ひとりは いや…！ だれか…わたしを…！"});
RPG_FOES.skydragon = rpgE("ノイズ・スカイドラゴン", "🐉", 10, 5, 1, 1, 1, [["かみなり ブレス", 1, 0.9, 0.8], ["そらの しっぽ たたき", 0, 1, 1.3], ["くもを よぶ", 0, 0.7, 1.8]], {boss:true, say50:"ほう…ここまで やるか。ならば くもの うえの ちからを みせよう。"});
RPG_FOES.omega = rpgE("ノイズ・オメガ", "🌀", 10, 5, 1, 1, 1, [["へんじを まつ うず", 1, 0.9, 0.8], ["とどかなかった ことば", 0, 1, 1.4], ["さいごの さけび", 0, 0.7, 1.9]], {boss:true, say50:"…へんじを…ください…！ ここに いるって…！"});
const TQ_BOSS_ADJ = {gyutan:0.68, spamking:0.85, panda:0.95, miraqueen:0.85, teddy:0.9};   // 仲間の かず・しょうかいで ばらつく ぶんの 調整
const TQ_BOSSES = [["gyutan", 3], ["spamking", 5], ["panda", 7], ["anaun", 12], ["reindeer", 17], ["whale", 22], ["teddy", 28],
    ["owl", 34], ["miraqueen", 40], ["skydragon", 46], ["omega", 52], ["s_oshi", 94], ["s_rikari", 96], ["s_yuzai", 98], ["s_akuma", 99]];
TQ_BOSSES.forEach(([id, lv]) => {
    const f = RPG_FOES[id], st = tqBossStat(lv), adj = (TQ_BOSS_ADJ[id] || 1);
    st.hp = Math.round(st.hp * adj); st.atk = Math.round(st.atk * adj);
    if(id.startsWith("s_")){ st.exp = Math.round(st.exp * 1.5); st.hp = Math.round(st.hp * 1.6); st.atk = Math.round(st.atk * 1.4); }
    Object.assign(f, st, {bossLv:lv});
});
RPG_FOES.teddy.exp = 0; RPG_FOES.teddy.g = 0;     // ぬいぐるみ王は お話の さいごなので 報酬なし（そのまま）
RPG_FOES.teddy.exp = Math.round(tqBossStat(28).exp * 0.4); RPG_FOES.teddy.g = 800;

// ---- 出現テーブル（地図ごと）----
(function(){
    TQ_ZONES.forEach((Z) => {
        const {list, rich} = TQ_ZONE_FOES[Z.z], n = list.length, third = Math.max(1, Math.round(n / 3));
        const weak = list.slice(0, third), mid = list.slice(third, third * 2), strong = list.slice(third * 2);
        const f = [];
        list.forEach((id, i) => { f.push([[id], i < third ? 3 : i < third * 2 ? 2 : 1]); });
        for(let i = 0; i < n - 1; i++) f.push([[list[i], list[i + 1]], 1]);
        if(Z.rec >= 10){ for(let i = 0; i + 2 < n; i += 2) f.push([[list[i], list[i + 1], list[i + 2]], 1]); }
        if(Z.rec >= 26){ strong.forEach((id) => f.push([[id, id], 1])); }
        rich.forEach((id) => f.push([[id], 0.35]));   // キラキラは ごくまれに
        const rate = Z.rec >= 99 ? 0.12 : 0.09;
        Z.maps.forEach((m) => { if(RPG_MAPS[m] && RPG_MAPS[m].enc){ RPG_MAPS[m].enc = {rate:RPG_MAPS[m].enc.rate || rate, f:f.map((e) => [e[0].slice(), e[1]])}; } });
        Z.maps.forEach((m) => { if(RPG_MAPS[m]){ RPG_MAPS[m].rec = Z.rec; } });
    });
    RPG_MAPS.xr.enc.rate = 0.12;
    const xe = RPG_ERAS.find((e) => e.id === "xr"); if(xe){ xe.req = "e_n11"; RPG_ERAS.splice(RPG_ERAS.indexOf(xe), 1); RPG_ERAS.push(xe); }
    // 地図の なまえに「推奨レベル」を つける（戦闘がある地図だけ）
    TQ_ZONES.forEach((Z) => { const m = RPG_MAPS[Z.maps[0]]; if(m && m.enc && m.name.indexOf("推奨") < 0) m.name += "〔推奨Lv" + Z.rec + "〕"; });
    ["aprt", "base"].forEach((k) => { const z = TQ_ZONES.find((Z) => Z.maps.includes(k)); if(RPG_MAPS[k] && z) RPG_MAPS[k].rec = z.rec; });
    RPG_ERAS.forEach((e) => { const z = TQ_ZONES.find((Z) => Z.maps.includes(e.map)); if(z && e.n.indexOf("推奨") < 0) e.n += "〔推奨Lv" + z.rec + "〕"; });
})();

// ---- なかま：11人（ハルキ・アキト・海斗 ＋ 一時なかまNPC 8人）----
Object.assign(RPG_LOOKS, {
    ren:{skin:"#f6d2b0", hair:"#1d3557", style:"short", top:"#457b9d", bot:"#1d3557", acc:"none"},
    yui:{skin:"#f9d9bd", hair:"#9c4a2a", style:"twin", top:"#f48fb1", bot:"#6a4a7a", acc:"none"},
    daisuke:{skin:"#eebf98", hair:"#222", style:"spike", top:"#5a6b2f", bot:"#2a3320", acc:"none"},
    chihiro:{skin:"#f9d9bd", hair:"#2a1a14", style:"bob", top:"#80cbc4", bot:"#37474f", acc:"glasses"},
    hikari:{skin:"#f9d9bd", hair:"#f2c94c", style:"long", top:"#fff3b0", bot:"#c9a227", acc:"none"}
});
Object.assign(RPG_CLASS, {
    n011:{n:"蓮", role:"atk", hp:[28, 10.5], mp:[5, 2.2], atk:[9.5, 3.4], def:[5, 1.9], agi:[10, 0.8]},
    n012:{n:"結衣", role:"heal", hp:[24, 8.8], mp:[12, 4.6], atk:[6.5, 2.4], def:[4, 1.7], agi:[8, 0.55]},
    n013:{n:"大輔", role:"tank", hp:[38, 13.5], mp:[4, 2], atk:[7.5, 2.7], def:[9, 2.7], agi:[5, 0.4]},
    n014:{n:"千尋", role:"mage", hp:[22, 7.5], mp:[14, 5], atk:[9.5, 3.1], def:[3, 1.5], agi:[8, 0.55]},
    n015:{n:"光", role:"buff", hp:[26, 9.2], mp:[11, 4.3], atk:[7, 2.5], def:[5, 1.8], agi:[10, 0.7]},
    mira:{n:"ミラ", role:"mage", hp:[28, 10], mp:[14, 5], atk:[10.5, 3.6], def:[5, 2.0], agi:[10, 0.75]},
    mira_b:{n:"ノイズクイーン・ミラ", role:"mage", hp:[44, 15.5], mp:[22, 7], atk:[14, 4.9], def:[8, 2.7], agi:[12, 0.9]}
});
TQ_NPCS.push(["n011", "蓮", "ren"], ["n012", "結衣", "yui"], ["n013", "大輔", "daisuke"], ["n014", "千尋", "chihiro"], ["n015", "光", "hikari"]);
Object.assign(TQ_LOOK_OF, {n011:"ren", n012:"yui", n013:"daisuke", n014:"chihiro", n015:"hikari", mira:"mira", mira_b:"miraB"});
// ボスが「仲間」になるチート用（BossAlly01〜15）：見た目は ボスごとの いろ
(function(){
    const pal = ["#e07a1f", "#6b7280", "#111827", "#2563eb", "#b91c1c", "#0e7490", "#a16207", "#15803d", "#7e22ce", "#0ea5e9", "#4c1d95", "#f59e0b", "#dc2626", "#0f172a", "#7f1d1d"];
    TQ_BOSSES.forEach(([id], i) => {
        const cid = "b" + String(i + 1).padStart(2, "0"), f = RPG_FOES[id];
        RPG_LOOKS[cid] = {skin:"#e9ddf2", hair:pal[i], style:"spike", top:pal[i], bot:"#1b1b27", acc:"xr"};
        RPG_CLASS[cid] = {n:f.n, role:i % 3 === 0 ? "atk" : i % 3 === 1 ? "mage" : "tank", hp:[42, 14.5], mp:[16, 5.5], atk:[13, 4.6], def:[8, 2.6], agi:[10, 0.8], boss:true};
        TQ_LOOK_OF[cid] = cid;
    });
    TQ_LOOK_OF.mira_b = "miraB";
})();

// ---- 一時的に なかまに なる（その地図〜ストーリーの ぶんだけ）----
//   id: なかま / maps: いる地図 / line: くわわる ときの ひとこと
const TQ_TEMP = [
    {id:"n001", maps:["tokyo", "aprt"], line:"亜理紗が なかまに くわわった！（東京の あいだ だけ）"},
    {id:"n002", maps:["tower"], line:"タカトが なかまに くわわった！（運命開発の ビルの あいだ だけ）"},
    {id:"n003", maps:["white"], line:"花音が なかまに くわわった！（まっしろルームの あいだ だけ）"},
    {id:"n004", maps:["xmas", "base"], line:"良太が なかまに くわわった！（クリスマスの あいだ だけ）"},
    {id:"n005", maps:["labn"], line:"雄介が なかまに くわわった！（ちいさな研究室の あいだ だけ）"},
    {id:"n007", maps:["future"], line:"美優が なかまに くわわった！（ARE タワーの あいだ だけ）"},
    {id:"n008", maps:["n8"], line:"七海が なかまに くわわった！（ノイズの森の あいだ だけ）"},
    {id:"mira", maps:["n10", "n11"], line:"ミラが なかまに くわわった！（ノイズの 深層の さいごまで）"}
];
function tqTempSync(map, quiet){
    const S = G.S; if(!S) return [];
    if(!S.temp) S.temp = {};
    const msgs = [];
    TQ_TEMP.forEach((t) => {
        const here = t.maps.includes(map), inP = S.party.includes(t.id);
        if(here && !inP && !S.cx.noTemp && !(t.id === "mira" && S.party.includes("mira_b"))){ if(tqAddMember(t.id, true)){ S.temp[t.id] = 1; msgs.push(t.line); } }
        else if(!here && inP && S.temp[t.id]){
            S.party = S.party.filter((x) => x !== t.id); delete S.temp[t.id];
            msgs.push(RPG_CLASS[t.id].n + "は ようじが あって かえっていった。（また どこかで 会えるよ）");
        } else if(!inP && S.temp[t.id]) delete S.temp[t.id];
    });
    return quiet ? [] : msgs;
}

// ---- そうび（第2部のぶん）----
Object.assign(RPG_EQUIP, {
    w5:{slot:"w", n:"ノイズきりの キーボード", v:46, price:7000}, w6:{slot:"w", n:"ARE ぜんりょくキーボード", v:68, price:16000},
    a5:{slot:"a", n:"ほしぞらの ローブ", v:40, price:6500}, a6:{slot:"a", n:"オメガの よろい", v:60, price:15000},
    c4:{slot:"c", n:"きずなの ほうせき", v:26, price:9000}
});
(function(){
    const old = rpgShopStock;
    window.rpgShopStock = function(mems){
        const l = old(mems), f = (G.S && G.S.f) || {};
        if(f.e_n8) l.push("w5", "a5");
        if(f.e_n10) l.push("c4");
        if(f.e_n11) l.push("w6", "a6");
        return l;
    };
})();
