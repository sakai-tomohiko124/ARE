"use strict";
// ===== BGM（音楽）：場所・戦闘ごとに 10曲。ずっと ループ再生 =====
// 音楽ファイルは game/bgm/ に、下の名前の mp3 を置いてください（まだ無い曲は、無音のまま進みます）。
// 一覧は game/bgm/BGMリスト.txt にも書いてあります。
const TQ_BGM = {
    opening:     {file:"opening.mp3",     n:"オープニング（タイトル画面・プロフィールなど）"},
    ending:      {file:"ending.mp3",      n:"エンディング（スタッフクレジットが曲に合わせて流れます。1回だけ）"},
    save:        {file:"save.mp3",        n:"セーブ音（冒険の書に記録したとき。1回だけ）", se:true},
    field:       {file:"field.mp3",       n:"フィールド（野や道・おまけの体験会）"},
    town:        {file:"town.mp3",        n:"街（仙台・東京・ラボ・クリスマス）"},
    sea:         {file:"sea.mp3",         n:"海（第2層 ノイズの海ぞこ）"},
    cave:        {file:"cave.mp3",        n:"洞窟・研究室（ちいさな研究室・秘密基地）"},
    castle:      {file:"castle.mp3",      n:"城・塔（運命開発ビル・まっしろルーム・ARE タワー・サーバー城）"},
    demoncastle: {file:"demoncastle.mp3", n:"魔王城（第4層 ノイズ王国）"},
    mainbattle:  {file:"mainbattle.mp3",  n:"通常戦闘曲"},
    midboss:     {file:"midboss.mp3",     n:"中ボス戦闘曲（ふつうのボス）"},
    lastboss:    {file:"lastboss.mp3",    n:"ラスボス戦闘曲（ぬいぐるみ王・ノイズ・オメガ）"},
    secretboss:  {file:"secretboss.mp3",  n:"裏ボス戦闘曲（おまけの悪魔）"}
};
// 地図 → 曲（地図の名前は data / maps の キー）
const TQ_BGM_MAP = {lab:"town", sendai:"town", tokyo:"town", aprt:"town", xmas:"town", tower:"castle", white:"castle", future:"castle", n10:"castle",
    labn:"cave", base:"cave", n8:"field", n9:"sea", n11:"demoncastle", xr:"field"};
const TQ_BGM_LAST = ["teddy", "omega"], TQ_BGM_SECRET = ["s_akuma"];

const tqBgm = {cur:"", audios:{}, bad:{}, want:""};
function tqBgmWant(){
    if(G.mode === "end") return "ending";
    const fromMenu = (G.mode === "help" && G.helpFrom === "menu") || (G.mode === "settings" && G.setFrom === "menu") || (G.mode === "cheat" && G.cheatFrom === "menu") || (G.mode === "slots" && G.slotFrom === "menu");
    if(!G.S || (!fromMenu && ["title", "slots", "profile", "persona", "result", "help", "settings", "cheat"].includes(G.mode))) return "opening";
    if(G.mode === "battle" && G.b){
        const ids = G.b.foes.map((f) => f.id);
        if(ids.some((i) => TQ_BGM_SECRET.includes(i))) return "secretboss";
        if(ids.some((i) => TQ_BGM_LAST.includes(i))) return "lastboss";
        if(G.b.boss) return "midboss";
        return "mainbattle";
    }
    return TQ_BGM_MAP[G.S.map] || "field";
}
function tqBgmAudio(key){
    if(tqBgm.bad[key]) return null;
    let a = tqBgm.audios[key];
    if(!a){
        a = new Audio("./bgm/" + TQ_BGM[key].file); a.loop = key !== "ending"; a.preload = "auto";
        a.addEventListener("error", () => { tqBgm.bad[key] = 1; });
        tqBgm.audios[key] = a;
    }
    return a;
}
function tqBgmVol(){ return Math.max(0, Math.min(1, [0.25, 0.5, 0.8][G.set.bgmVol == null ? 1 : G.set.bgmVol] || 0.5)); }
function tqBgmStop(){ Object.keys(tqBgm.audios).forEach((k) => { try{ tqBgm.audios[k].pause(); }catch(_e){} }); tqBgm.cur = ""; }
function tqBgmSync(){
    try{
        if(G.moviePlaying){ if(tqBgm.cur) tqBgmStop(); return; }
        if(G.set.bgm === false || document.hidden){ if(tqBgm.cur) tqBgmStop(); return; }
        const key = tqBgmWant();
        if(key !== tqBgm.cur){
            Object.keys(tqBgm.audios).forEach((k) => { if(k !== key){ try{ tqBgm.audios[k].pause(); }catch(_e){} } });
            tqBgm.cur = key;
            if(key === "ending"){ const e = tqBgmAudio(key); if(e){ try{ e.currentTime = 0; }catch(_x){} } }
        }
        if(key === "ending" && tqBgm.audios.ending && tqBgm.audios.ending.ended) return;   // 曲が おわったら しずかに
        const a = tqBgmAudio(key); if(!a) return;
        a.volume = tqBgmVol();
        if(a.paused){ const p = a.play(); if(p && p.catch) p.catch(() => {}); }   // 画面を さわる まで 鳴らないブラウザでは、あとで もういちど ためす
    }catch(_e){ /* 音が 出せなくても ゲームは つづける */ }
}
setInterval(tqBgmSync, 500);
["pointerdown", "keydown", "touchstart"].forEach((ev) => document.addEventListener(ev, tqBgmSync, {passive:true}));
document.addEventListener("visibilitychange", tqBgmSync);

// 効果音（1回だけ）：セーブ音など。BGMは止めません
function tqSePlay(key){
    try{
        if(G.set.bgm === false || !TQ_BGM[key] || tqBgm.bad["se_" + key]) return;
        const a = new Audio("./bgm/" + TQ_BGM[key].file); a.volume = Math.min(1, tqBgmVol() + 0.2);
        a.addEventListener("error", () => { tqBgm.bad["se_" + key] = 1; });
        const p = a.play(); if(p && p.catch) p.catch(() => {});
    }catch(_e){ /* 無視 */ }
}
