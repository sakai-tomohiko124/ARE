"use strict";
// ===== RPG：地図と登場人物の配置 =====
// k:"npc"=話せる人 / "warp"=出入口 / "step"=踏むと起きる / "sign"=調べると起きる / "btn"=かくれたボタン
// tev=マスの種類ごとの反応（調べる）。[イベント名, 1なら踏んだだけで起きる]
// 地図ごとのテレポート用「ゲート(G)」：踏むとラボにもどれる
const RPG_MAPS = {
    lab:{name:"ARE かいはつラボ（2030年）", tint:null, start:[8, 9], enc:null,
        rows:rpgMk(16, 11, "=", [["b", "#"], ["r", 1, 1, 3, 1, "L"], ["r", 6, 1, 4, 1, "P"], ["r", 12, 1, 3, 1, "L"], ["p", 14, 2, "p"], ["r", 6, 4, 4, 1, "G"], ["p", 2, 6, "p"], ["p", 13, 6, "p"], ["r", 11, 7, 3, 1, "K"], ["r", 3, 8, 2, 1, "b"], ["p", 1, 9, "p"], ["p", 14, 9, "p"]]),
        tev:{P:["pc"], L:["shelf"], K:["shop"], G:["gate", 1], b:["seat"], p:["plant"]},
        objs:[
            {k:"npc", id:"akito", x:5, y:5, look:"akito", name:"アキト", ev:"lab_akito", hide:"aki_joined"},
            {k:"npc", id:"haruki", x:10, y:5, look:"haruki", name:"ハルキ", ev:"lab_haruki", hide:"haru_joined"},
            {k:"npc", id:"mina", x:12, y:6, look:"mina", name:"ミナ", ev:"shop"}
        ]},
    sendai:{name:"2026年9月 仙台", tint:null, start:[12, 7], enc:{rate:0.1, f:[[["zunda"], 3], [["zunda", "zunda"], 2], [["sasa"], 2], [["sasa", "zunda"], 2], [["kokeshi"], 1], [["kokeshi", "sasa"], 1]]},
        rows:rpgMk(26, 16, ".", [["b", "T"], ["r", 2, 1, 9, 2, "H"], ["r", 2, 3, 9, 2, "h"], ["p", 6, 4, "D"], ["r", 1, 6, 24, 2, ","], ["r", 11, 8, 3, 6, ","], ["r", 19, 4, 2, 2, ","], ["r", 15, 1, 9, 3, "M"],
            ["r", 2, 9, 6, 2, "H"], ["r", 2, 11, 6, 1, "h"], ["p", 4, 11, "D"], ["r", 16, 9, 6, 2, "H"], ["r", 16, 11, 6, 1, "h"], ["p", 18, 11, "D"],
            ["r", 1, 14, 10, 1, "~"], ["r", 14, 14, 11, 1, "~"], ["r", 11, 14, 3, 1, ","], ["p", 9, 10, "T"], ["p", 10, 12, "T"], ["p", 23, 5, "T"], ["p", 7, 5, "f"], ["p", 8, 5, "f"], ["p", 14, 12, "f"], ["p", 24, 9, "f"], ["p", 12, 12, "G"]]),
        tev:{G:["gate_back", 1], D:["sn_door"]},
        objs:[
            {k:"npc", id:"kaito", x:14, y:7, look:"kaito", name:"海斗", ev:"sn_kaito"},
            {k:"npc", id:"arisa", x:9, y:8, look:"arisa", name:"亜理紗", ev:"sn_arisa"},
            {k:"npc", id:"ekiin", x:6, y:5, look:"ekiin", name:"駅員さん", ev:"sn_ekiin"},
            {k:"npc", id:"oyaji", x:4, y:12, look:"oyaji", name:"牛タン屋さん", ev:"sn_oyaji"},
            {k:"npc", id:"obaa", x:18, y:12, look:"obaa", name:"ずんだ茶寮の おばちゃん", ev:"sn_obaa"},
            {k:"npc", id:"tourist", x:22, y:7, look:"tourist", name:"観光客", ev:"sn_tourist"},
            {k:"npc", id:"reiya", x:17, y:2, look:"reiya", name:"玲也", ev:"sn_reiya", hide:"sn_done"},
            {k:"step", x:19, y:4, ev:"sn_gate"}, {k:"step", x:20, y:4, ev:"sn_gate"}
        ]},
    tokyo:{name:"2025年12月 夜の東京", tint:"rgba(8,16,52,0.38)", start:[12, 10], enc:{rate:0.09, f:[[["spam"], 3], [["lag"], 2], [["spam", "lag"], 2], [["nullpo"], 2], [["spam", "nullpo"], 1]]},
        rows:rpgMk(24, 14, "n", [["b", "N"], ["r", 2, 2, 6, 2, "H"], ["r", 2, 4, 6, 2, "h"], ["p", 4, 5, "D"], ["r", 9, 3, 5, 2, "H"], ["r", 9, 5, 5, 1, "h"], ["p", 11, 5, "D"],
            ["r", 15, 1, 7, 3, "Q"], ["r", 15, 4, 7, 2, "N"], ["p", 18, 5, "D"], ["r", 1, 7, 22, 1, ","], ["p", 3, 9, "f"], ["p", 20, 10, "f"], ["p", 12, 12, "G"]]),
        tev:{G:["gate_back", 1]},
        objs:[
            {k:"warp", x:4, y:5, to:["aprt", 3, 5]}, {k:"warp", x:18, y:5, to:["tower", 9, 14], need:"ap_done", deny:"tk_tower"},
            {k:"npc", id:"sarary", x:7, y:9, look:"citizen", name:"会社員", ev:"tk_sarary"},
            {k:"npc", id:"ol", x:15, y:9, look:"citizenF", name:"通りすがりの人", ev:"tk_ol"},
            {k:"sign", x:11, y:6, ev:"tk_conbini"}
        ]},
    aprt:{name:"蒼太の部屋（6畳一間）", tint:"rgba(8,16,52,0.22)", start:[3, 5], enc:null,
        rows:rpgMk(8, 7, "=", [["b", "#"], ["r", 1, 1, 2, 1, "L"], ["p", 5, 1, "P"], ["p", 6, 1, "b"], ["p", 1, 4, "b"], ["p", 6, 4, "p"], ["p", 3, 6, "D"]]),
        tev:{P:["ap_pc"], L:["ap_shelf"], b:["ap_junk"], p:["plant"]},
        objs:[
            {k:"warp", x:3, y:6, to:["tokyo", 4, 6]},
            {k:"npc", id:"aota", x:5, y:2, look:"aota", name:"蒼太", ev:"ap_aota"}
        ]},
    tower:{name:"運命開発株式会社（最上階まで）", tint:null, start:[9, 14], enc:{rate:0.07, f:[[["spam"], 2], [["lag", "nullpo"], 2], [["nullpo", "spam"], 2], [["lag", "lag"], 1]]},
        rows:rpgMk(20, 16, "q", [["b", "#"], ["r", 1, 11, 18, 4, "M"], ["r", 1, 10, 18, 1, "#"], ["p", 9, 10, "E"], ["r", 1, 6, 18, 4, "q"], ["r", 1, 5, 18, 1, "#"], ["p", 9, 5, "E"], ["r", 1, 1, 18, 4, "c"], ["r", 1, 1, 18, 1, "z"],
            ["r", 3, 7, 3, 1, "b"], ["r", 14, 7, 3, 1, "b"], ["p", 2, 6, "P"], ["p", 17, 6, "P"], ["p", 1, 14, "p"], ["p", 18, 14, "p"], ["p", 9, 15, "D"], ["r", 8, 13, 3, 1, "K"], ["p", 5, 3, "p"], ["p", 14, 3, "p"]]),
        tev:{P:["tw_pc"], K:["tw_desk"], p:["plant"], b:["tw_desk2"]},
        objs:[
            {k:"warp", x:9, y:15, to:["tokyo", 18, 6]},
            {k:"step", x:9, y:5, ev:"tw_up"},
            {k:"npc", id:"tatsuya", x:15, y:12, look:"tatsuya", name:"竜也", ev:"tw_tatsuya"},
            {k:"npc", id:"misaki", x:16, y:8, look:"misaki", name:"美咲", ev:"tw_misaki"},
            {k:"npc", id:"kento", x:3, y:8, look:"kento", name:"健斗", ev:"tw_kento"},
            {k:"npc", id:"uketsuke", x:9, y:12, look:"citizenF", name:"受付", ev:"tw_uketsuke"},
            {k:"npc", id:"saeko", x:9, y:3, look:"saeko", name:"さえこ", ev:"tw_saeko", hide:"tw_done"},
            {k:"npc", id:"ryu", x:11, y:3, look:"ryu", name:"龍之介", ev:"tw_ryu", show:"tw_done"}
        ]},
    white:{name:"まっしろルーム", tint:null, start:[9, 9], enc:{rate:0.09, f:[[["fuwa"], 3], [["mashiro"], 2], [["fuwa", "mashiro"], 2], [["fuwa", "fuwa"], 1]]},
        rows:rpgMk(18, 12, "w", [["b", "#"], ["p", 9, 10, "G"]]),
        tev:{G:["gate_back", 1]},
        objs:[
            {k:"npc", id:"anaun", x:9, y:2, look:"robo", name:"アナウンくん", ev:"wh_anaun"},
            {k:"npc", id:"haruya", x:3, y:8, look:"haruya", name:"はるや", ev:"wh_haruya"},
            {k:"npc", id:"momone", x:4, y:8, look:"momone", name:"ももね", ev:"wh_momone"},
            {k:"npc", id:"p1", x:14, y:2, look:"citizen", name:"参加者", ev:"wh_p1"},
            {k:"npc", id:"p2", x:2, y:4, look:"citizenF", name:"参加者", ev:"wh_p2"},
            {k:"btn", id:"b1", x:4, y:3}, {k:"btn", id:"b2", x:13, y:5}, {k:"btn", id:"b3", x:8, y:8}
        ]},
    xmas:{name:"2028年12月25日 クリスマスの東京", tint:"rgba(70,90,160,0.12)", start:[12, 12], enc:{rate:0.1, f:[[["penguin"], 3], [["snowman"], 2], [["rabbit"], 2], [["penguin", "rabbit"], 2], [["snowman", "penguin"], 1], [["rabbit", "rabbit"], 1]]},
        rows:rpgMk(24, 16, "S", [["b", "t"], ["r", 1, 8, 22, 2, "s"], ["r", 11, 10, 2, 5, "s"], ["r", 11, 3, 2, 5, "s"], ["r", 3, 3, 6, 2, "H"], ["r", 3, 5, 6, 2, "h"], ["p", 5, 6, "D"], ["r", 15, 3, 6, 2, "H"], ["r", 15, 5, 6, 2, "h"], ["p", 17, 6, "D"],
            ["r", 1, 1, 22, 2, "t"], ["r", 11, 1, 2, 2, "s"], ["p", 7, 11, "t"], ["p", 16, 12, "t"], ["p", 4, 13, "t"], ["p", 20, 13, "t"], ["p", 12, 14, "G"], ["p", 9, 7, "i"], ["p", 10, 7, "i"]]),
        tev:{G:["gate_back", 1]},
        objs:[
            {k:"warp", x:5, y:6, to:["base", 5, 6]},
            {k:"npc", id:"santa", x:14, y:10, look:"santa", name:"サンタさん", ev:"xm_santa"},
            {k:"npc", id:"kid1", x:8, y:11, look:"kid", name:"子ども", ev:"xm_kid"},
            {k:"npc", id:"chick", x:17, y:7, look:"obaa", name:"チキン屋さん", ev:"xm_chick"},
            {k:"npc", id:"couple", x:20, y:11, look:"citizenF", name:"通りすがりの人", ev:"xm_couple"},
            {k:"step", x:11, y:4, ev:"xm_gate"}, {k:"step", x:12, y:4, ev:"xm_gate"},
            {k:"step", x:11, y:1, ev:"xm_boss"}, {k:"step", x:12, y:1, ev:"xm_boss"}
        ]},
    base:{name:"紘の秘密基地", tint:null, start:[5, 6], enc:null,
        rows:rpgMk(10, 8, "=", [["b", "#"], ["r", 1, 1, 3, 1, "L"], ["p", 8, 1, "P"], ["r", 4, 4, 3, 1, "k"], ["p", 1, 5, "p"], ["p", 8, 5, "p"], ["p", 5, 7, "D"]]),
        tev:{P:["bs_pc"], L:["bs_shelf"], k:["bs_cake"], p:["plant"]},
        objs:[
            {k:"warp", x:5, y:7, to:["xmas", 5, 7]},
            {k:"npc", id:"hiro", x:5, y:3, look:"hiro", name:"紘", ev:"bs_hiro"}
        ]},
    labn:{name:"ARE 誕生の夜（2025年・ちいさな研究室）", tint:"rgba(8,16,52,0.28)", start:[9, 10], enc:{rate:0.08, f:[[["octo"], 3], [["hedgehog"], 2], [["turtle"], 1], [["octo", "hedgehog"], 2], [["turtle", "octo"], 1]]},
        rows:rpgMk(20, 14, "=", [["b", "#"], ["r", 1, 1, 5, 1, "L"], ["r", 8, 1, 3, 1, "P"], ["r", 13, 1, 1, 5, "#"], ["p", 13, 3, "D"], ["r", 14, 1, 5, 5, "q"], ["r", 14, 1, 5, 1, "z"], ["r", 14, 5, 5, 1, "z"], ["p", 2, 6, "b"], ["p", 3, 6, "b"], ["p", 16, 9, "b"], ["p", 17, 9, "b"],
            ["p", 1, 11, "p"], ["p", 18, 11, "p"], ["p", 9, 12, "G"], ["p", 4, 9, "p"]]),
        tev:{P:["lb_pc"], L:["lb_shelf"], b:["lb_sofa"], G:["gate_back", 1], p:["plant"]},
        objs:[
            {k:"npc", id:"youngA", x:8, y:3, look:"youngA", name:"若いアキト", ev:"lb_akito"},
            {k:"npc", id:"youngH", x:10, y:3, look:"youngH", name:"若いハルキ", ev:"lb_haruki"},
            {k:"npc", id:"kouhai", x:5, y:9, look:"kouhai", name:"後輩", ev:"lb_kouhai"},
            {k:"step", x:13, y:3, ev:"lb_door"},
            {k:"sign", x:16, y:1, ev:"lb_rack"},
            {k:"step", x:16, y:3, ev:"lb_boss"}, {k:"step", x:15, y:3, ev:"lb_boss"}, {k:"step", x:17, y:3, ev:"lb_boss"}
        ]},
    future:{name:"2035年 ARE タワー", tint:"rgba(120,160,255,0.10)", start:[9, 14], enc:{rate:0.08, f:[[["fox"], 3], [["bear"], 2], [["unicorn"], 2], [["fox", "bear"], 2], [["unicorn", "fox"], 1], [["bear", "bear"], 1]]},
        rows:rpgMk(18, 18, "q", [["b", "Q"], ["r", 1, 11, 16, 1, "Q"], ["p", 9, 11, "E"], ["r", 1, 6, 16, 1, "Q"], ["p", 9, 6, "E"], ["r", 1, 1, 16, 5, "c"], ["r", 2, 2, 2, 1, "r"], ["r", 14, 2, 2, 1, "r"], ["p", 9, 16, "G"], ["p", 3, 8, "p"], ["p", 14, 8, "p"], ["p", 3, 13, "p"], ["p", 14, 13, "p"]]),
        tev:{G:["gate_back", 1], p:["plant"], r:["fu_teddy"]},
        objs:[
            {k:"npc", id:"c1", x:5, y:13, look:"citizen", name:"ARE ユーザー", ev:"fu_c1"},
            {k:"npc", id:"c2", x:12, y:14, look:"citizenF", name:"ARE ユーザー", ev:"fu_c2"},
            {k:"npc", id:"aotaF", x:5, y:8, look:"aota", name:"蒼太", ev:"fu_aota"},
            {k:"npc", id:"hiroF", x:12, y:8, look:"hiro", name:"紘", ev:"fu_hiro"},
            {k:"npc", id:"kaitoF", x:7, y:9, look:"kaito", name:"海斗", ev:"fu_kaito"},
            {k:"npc", id:"arisaF", x:10, y:9, look:"arisa", name:"亜理紗", ev:"fu_arisa"},
            {k:"step", x:9, y:6, ev:"fu_up"},
            {k:"step", x:8, y:3, ev:"fu_boss"}, {k:"step", x:9, y:3, ev:"fu_boss"}, {k:"step", x:10, y:3, ev:"fu_boss"}
        ]}
};
// ラボの「リプレイゲート」で行ける時代
const RPG_ERAS = [
    {id:"sendai", n:"2026年9月 仙台", map:"sendai", pos:[12, 7], done:"e_sendai", req:""},
    {id:"tokyo", n:"2025年12月 夜の東京", map:"tokyo", pos:[12, 10], done:"e_tokyo", req:"e_sendai"},
    {id:"white", n:"まっしろルーム", map:"white", pos:[9, 9], done:"e_white", req:"e_tokyo"},
    {id:"xmas", n:"2028年12月25日 クリスマスの東京", map:"xmas", pos:[12, 12], done:"e_xmas", req:"e_white"},
    {id:"labn", n:"ARE 誕生の夜（2025年）", map:"labn", pos:[9, 10], done:"e_labn", req:"e_xmas"},
    {id:"future", n:"2035年 ARE タワー", map:"future", pos:[9, 14], done:"e_future", req:"mem>=5"}
];
const RPG_MEM_NAMES = ["①仙台の ひかりのメモリ", "②運命のコードの メモリ", "③まっしろな メモリ", "④クリスマスの メモリ", "⑤124きのうの せっけいず", "⑥{名前}と みんなの きおく"];
