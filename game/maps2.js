"use strict";
// ===== 追加の地図：おまけ『XRアドベンチャー体験会』／ゲートの行き先の追加 =====
RPG_MAPS.xr = {name:"XRアドベンチャー体験会", tint:null, start:[9, 9], enc:{rate:0.12, f:[[["pudding"], 3], [["mochi", "pudding"], 2], [["star", "mochi"], 2], [["candy", "star", "pudding"], 1], [["candy", "candy"], 1]]},
    rows:rpgMk(18, 12, "w", [["b", "Q"], ["r", 6, 4, 6, 3, "c"], ["p", 8, 10, "G"], ["p", 3, 3, "f"], ["p", 14, 3, "f"], ["p", 3, 8, "f"], ["p", 14, 8, "f"], ["p", 2, 5, "p"], ["p", 15, 5, "p"], ["p", 4, 2, "p"], ["p", 13, 2, "p"]]),
    tev:{G:["gate_back", 1]},
    objs:[
        {k:"npc", id:"x_oshi", x:5, y:6, look:"oshi", name:"推し", ev:"xr_oshi"},
        {k:"npc", id:"x_rikari", x:12, y:6, look:"rikari", name:"りかり", ev:"xr_rikari"},
        {k:"npc", id:"x_yuzai", x:9, y:2, look:"yuzai", name:"ゆうざいくん", ev:"xr_yuzai"},
        {k:"npc", id:"x_akuma", x:9, y:5, look:"akuma", name:"悪魔", ev:"xr_akuma", show:"x3"},
        {k:"npc", id:"x_unknown", x:14, y:9, look:"unknown", name:"？？？", ev:"xr_unknown", show:"e_xr"}
    ]};
RPG_ENTER.xr = "xr_enter";
RPG_ERAS.push({id:"xr", n:"おまけ：XRアドベンチャー体験会", map:"xr", pos:[9, 9], done:"e_xr", req:"xr_open"});
// 海斗は 仲間になったら 街から いなくなる
(function(){ const k = RPG_MAPS.sendai.objs.find((o) => o.id === "kaito"); if(k) k.hide = "kaito_joined"; })();
