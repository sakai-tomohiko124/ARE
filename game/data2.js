"use strict";
// ===== 追加データ：なかま・顔グラフィック・星座・性格・おまけ章の敵 =====

// ---- 見た目の追加（なかまNPCなど）----
Object.assign(RPG_LOOKS, {
    takato:{skin:"#f3cfae", hair:"#1b1b1b", style:"spike", top:"#b8532e", bot:"#2c3340", acc:"none"},
    kanon:{skin:"#f9d9bd", hair:"#6b3a1e", style:"twin", top:"#f7c1d0", bot:"#7a5a9a", acc:"none"},
    ryota:{skin:"#eebf98", hair:"#222", style:"short", top:"#3d6b4a", bot:"#2a3a2f", acc:"none"},
    yusuke:{skin:"#f6d2b0", hair:"#3a2a1a", style:"short", top:"#c9702d", bot:"#3a4a6b", acc:"none"},
    yuka:{skin:"#f9d9bd", hair:"#8a4b2a", style:"long", top:"#f4d35e", bot:"#4a5a7a", acc:"none"},
    miyu:{skin:"#f9d9bd", hair:"#2a1a14", style:"bob", top:"#9b8cf0", bot:"#4a4a6a", acc:"none"},
    nanami:{skin:"#f9d9bd", hair:"#b5651d", style:"bun", top:"#ef7b9b", bot:"#5a4a6a", acc:"none"},
    hayato:{skin:"#f3cfae", hair:"#14263f", style:"spike", top:"#1f6f8b", bot:"#222a3a", acc:"scarf"},
    hana:{skin:"#f9d9bd", hair:"#3a2418", style:"long", top:"#fff1f2", bot:"#a05a6b", acc:"none"},
    oshi:{skin:"#f9d9bd", hair:"#2a1a14", style:"twin", top:"#4a6fd1", bot:"#f2f2f2", acc:"none"},
    rikari:{skin:"#f9d9bd", hair:"#6b3a1e", style:"long", top:"#b3272d", bot:"#3a2a2a", acc:"none"},
    yuzai:{skin:"#f3cfae", hair:"#111", style:"short", top:"#1b1b27", bot:"#1b1b27", acc:"tie"},
    akuma:{skin:"#f9d9bd", hair:"#2a1a14", style:"long", top:"#8a1c3a", bot:"#2a1a24", acc:"none"},
    unknown:{skin:"#cfcfe6", hair:"#2b1b4a", style:"spike", top:"#2b1b4a", bot:"#1a1030", acc:"none"}
});
// ---- なかま（職業：role は自動こうどうのタイプ）----
Object.assign(RPG_CLASS, {
    kaito:{n:"海斗", role:"atk", hp:[26, 9.5], mp:[7, 3], atk:[8.5, 3.0], def:[5, 1.9], agi:[8, 0.6]},
    n001:{n:"亜理紗", role:"mage", hp:[20, 7], mp:[12, 4.5], atk:[9, 3.0], def:[3, 1.5], agi:[8, 0.55]},
    n002:{n:"タカト", role:"atk", hp:[30, 12], mp:[3, 1.5], atk:[10, 3.5], def:[5, 1.9], agi:[8, 0.6]},
    n003:{n:"花音", role:"heal", hp:[22, 8], mp:[12, 4.5], atk:[6, 2.2], def:[4, 1.6], agi:[7, 0.5]},
    n004:{n:"良太", role:"tank", hp:[36, 13], mp:[4, 2], atk:[7, 2.6], def:[8, 2.5], agi:[5, 0.4]},
    n005:{n:"雄介", role:"atk", hp:[32, 12], mp:[3, 1.5], atk:[10, 3.6], def:[5, 1.9], agi:[7, 0.5]},
    n006:{n:"優花", role:"buff", hp:[24, 8.5], mp:[10, 4], atk:[6, 2.3], def:[4, 1.7], agi:[9, 0.6]},
    n007:{n:"美優", role:"heal", hp:[24, 8.5], mp:[11, 4.2], atk:[6, 2.2], def:[4, 1.7], agi:[8, 0.5]},
    n008:{n:"七海", role:"atk", hp:[26, 9.5], mp:[6, 2.5], atk:[9.5, 3.4], def:[4, 1.7], agi:[10, 0.7]},
    n009:{n:"隼人", role:"atk", hp:[26, 9.5], mp:[5, 2.2], atk:[9.5, 3.4], def:[4, 1.7], agi:[12, 0.9]},
    n010:{n:"羽奈", role:"heal", hp:[22, 8], mp:[12, 4.5], atk:[7, 2.6], def:[4, 1.6], agi:[8, 0.55]}
});
// 仲間にできるNPC（チートの NPC001〜010）
const TQ_NPCS = [["n001", "亜理紗", "arisa"], ["n002", "タカト", "takato"], ["n003", "花音", "kanon"], ["n004", "良太", "ryota"], ["n005", "雄介", "yusuke"], ["n006", "優花", "yuka"], ["n007", "美優", "miyu"], ["n008", "七海", "nanami"], ["n009", "隼人", "hayato"], ["n010", "羽奈", "hana"]];
// 仲間のスプライト名（RPG_LOOKS のキー）
const TQ_LOOK_OF = {hero:"", haruki:"haruki", akito:"akito", kaito:"kaito", n001:"arisa", n002:"takato", n003:"kanon", n004:"ryota", n005:"yusuke", n006:"yuka", n007:"miyu", n008:"nanami", n009:"hayato", n010:"hana"};

// ---- 顔（会話の立ち絵）：画像があれば画像、なければ見た目から描く ----
const TQ_PORTRAIT_IMG = {"海斗":"kaito", "亜理紗":"arisa", "玲也":"reiya", "羽奈":"hana", "推し":"oshi", "りかり":"rikari", "ゆうざいくん":"yuzai", "悪魔":"akuma", "？？？":"unknown"};
const TQ_PORTRAIT_LOOK = {"アキト":"akito", "ハルキ":"haruki", "ミナ":"mina", "蒼太":"aota", "さえこ":"saeko", "健斗":"kento", "美咲":"misaki", "竜也":"tatsuya", "龍之介":"ryu", "紘":"hiro", "サンタ":"santa", "はるや":"haruya", "ももね":"momone",
    "アナウンくん":"robo", "若いアキト":"youngA", "若いハルキ":"youngH", "後輩":"kouhai", "駅員さん":"ekiin", "牛タン屋さん":"oyaji", "チキン屋さん":"oyaji", "おばちゃん":"obaa", "観光客":"tourist", "子ども":"kid", "会社員":"citizen",
    "通りすがりの人":"citizen", "参加者":"citizenF", "受付":"citizenF", "ARE ユーザー":"citizenF", "ぬいぐるみ王":"teddy", "タカト":"takato", "花音":"kanon", "良太":"ryota", "雄介":"yusuke", "優花":"yuka", "美優":"miyu", "七海":"nanami", "隼人":"hayato"};

// ---- レベル99まで（31以降は ゆるやかに）----
function rpgNeed(lv){ return lv <= 30 ? Math.round(8 + lv * lv * 2.6) : 2350 + (lv - 30) * 120; }

// ---- 星座（誕生日から）----
const TQ_ZODIAC = [
    [[1, 20], "みずがめ座", "♒", "自由な発想の もちぬし。ひらめきで ピンチを ひっくり返す。"], [[2, 19], "うお座", "♓", "やさしくて ゆめみがち。なかまの 気持ちに よく 気づく。"],
    [[3, 21], "おひつじ座", "♈", "まっすぐ 突き進む 行動派。さいしょの 一歩が はやい。"], [[4, 20], "おうし座", "♉", "ねばり強い がんばりや。ごはんが だいすき。"],
    [[5, 21], "ふたご座", "♊", "好奇心の かたまり。おしゃべりで 情報通。"], [[6, 22], "かに座", "♋", "なかま思いの あたたかい 人。守るときは つよい。"],
    [[7, 23], "しし座", "♌", "堂々とした リーダー気質。みんなを 明るくする。"], [[8, 23], "おとめ座", "♍", "こまやかで しっかり者。デバッグが とくい。"],
    [[9, 23], "てんびん座", "♎", "バランス感覚ばつぐん。仲なおしの 名人。"], [[10, 24], "さそり座", "♏", "ひとつの ことに 深く 集中する。ひみつを 守る。"],
    [[11, 23], "いて座", "♐", "冒険が だいすき。遠くの 目標へ まっしぐら。"], [[12, 22], "やぎ座", "♑", "コツコツ 努力する 堅実派。ねばって 勝つ。"]
];
function tqZodiac(month, day){
    const m = Number(month), d = Number(day);
    if(!(m >= 1 && m <= 12) || !(d >= 1 && d <= new Date(2000, m, 0).getDate())) return null;
    let pick = TQ_ZODIAC[11];
    for(const z of TQ_ZODIAC){ if(m > z[0][0] || (m === z[0][0] && d >= z[0][1])) pick = z; }
    return {name:pick[1], mark:pick[2], text:pick[3]};
}
// ---- 性格診断（3つの質問に「はい／いいえ」）----
const TQ_QUESTIONS = ["新しいことに 自分から 挑戦したい？", "困っている 仲間が いたら 助けたい？", "決めた目標に 向けて 努力を 続けられる？"];
const TQ_TYPES = {
    "仲間思いの行動派":{d:"自分から動き、仲間のことも大切にするタイプです。", b:{hp:1.08, atk:1.04}},
    "独立心のある挑戦者":{d:"自分で考えて挑戦し、目標へ向かって進むタイプです。", b:{atk:1.08, agi:1.04}},
    "支える努力家":{d:"仲間を支えながら、決めたことを続けるタイプです。", b:{def:1.08, mp:1.06}},
    "好奇心旺盛":{d:"新しいことに関心を持ち、自分から一歩を踏み出すタイプです。", b:{agi:1.08, mp:1.06}},
    "気配り上手":{d:"周りの様子に気づき、人を助けることを大切にするタイプです。", b:{mp:1.1, hp:1.04}},
    "慎重な堅実派":{d:"急がず状況を見ながら、自分のペースを大切にするタイプです。", b:{def:1.1, hp:1.04}}
};
const TQ_TYPE_MAP = {"1,1,1":"仲間思いの行動派", "1,1,0":"仲間思いの行動派", "1,0,1":"独立心のある挑戦者", "1,0,0":"好奇心旺盛", "0,1,1":"支える努力家", "0,1,0":"気配り上手", "0,0,1":"慎重な堅実派", "0,0,0":"慎重な堅実派"};
function tqPersonality(answers){
    if(!Array.isArray(answers) || answers.length !== 3) return null;
    const name = TQ_TYPE_MAP[answers.map((a) => (a ? 1 : 0)).join(",")];
    return name ? {name, desc:TQ_TYPES[name].d, bonus:TQ_TYPES[name].b} : null;
}

// ---- おまけ章（XRアドベンチャー体験会）の敵：かわいい おやつモンスターと、模擬戦の4人 ----
Object.assign(RPG_FOES, {
    pudding:rpgE("プニプニ・プリン", "🍮", 520, 52, 20, 420, 300, [["ぷるぷる タックル", 0, 1, 1.2], ["カラメル ソース", 0, 0.7, 1.1]]),
    mochi:rpgE("ふわふわモチ", "🍡", 600, 55, 24, 480, 340, [["もちもち ずつき", 0, 1, 1.2], ["のびーる ビンタ", 0, 0.8, 1.0], ["ふんわり ぷにっ", 1, 0.5, 0.6]]),
    star:rpgE("きらきらスター", "⭐", 540, 58, 22, 520, 360, [["きらきら ビーム", 1, 0.8, 0.7], ["ながれぼし アタック", 0, 1, 1.3]]),
    candy:rpgE("ころころキャンディ", "🍬", 650, 60, 26, 600, 420, [["ころころ アタック", 0, 1, 1.2], ["あまーい ぼうふう", 1, 0.6, 0.7]]),
    s_oshi:rpgE("推し", "🌟", 1100, 62, 22, 2200, 1500, [["きらめく スタッフ", 0, 1, 1.3], ["ファンサービス", 1, 0.8, 0.7]], {boss:true, spar:true, img:"oshi", bg:"xr", say50:"推し「いいね！ その調子！ ぼくも ほんきで いくよ！」"}),
    s_rikari:rpgE("りかり", "⚔️", 1400, 66, 24, 2800, 1800, [["するどい ざんげき", 0, 1, 1.4], ["あかい マント ひるがえし", 1, 0.7, 0.8]], {boss:true, spar:true, img:"rikari", bg:"xr", say50:"りかり「やるじゃない！ ここからが 本番よ！」"}),
    s_yuzai:rpgE("ゆうざいくん", "🎩", 1800, 70, 26, 3400, 2200, [["ゆうざい ダンス", 0, 1, 1.3], ["サクセス ウインク", 1, 0.7, 0.8], ["ばっちり さくせん", 0, 0.6, 1.6]], {boss:true, spar:true, img:"yuzai", bg:"xr", say50:"ゆうざいくん「ふふ、いい作戦だね。じゃあ こっちも 本気を 出そうかな。」"}),
    s_akuma:rpgE("悪魔", "🌹", 2800, 78, 30, 6000, 3500, [["バラの ダンス", 1, 0.8, 0.8], ["あまい ささやき", 0, 1, 1.4], ["ハートの いかり", 0, 0.7, 1.9]], {boss:true, spar:true, img:"akuma", bg:"xr", say50:"悪魔「ふふふ…おもしろい！ みんなの きずな、見せてもらうわ！」"})
});
