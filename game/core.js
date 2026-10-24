"use strict";
// ===== TOMOHIKO QUEST：土台（状態・成長・セーブ3枠・チート・声）=====
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;"})[c]);
const TQ_MAX_LV = 99, TQ_SLOTS = 3, TQ_MAX_PARTY = 4, TQ_MAX_GOLD = 9999999;
const G = {S:null, mode:"title", slot:0, rnd:Math.random, q:new URLSearchParams(location.search), cheatQueue:[], set:{voice:true, speed:0, pad:"auto"}, scripts:[], b:null, choices:null, tw:null, banner:null, hit:null, npcDir:{}, lastEnc:0, auto:false, grind:null, bg:"", menuTab:"", menuMsg:"", shopMsg:"", pend:null, toast:null};

// ---------------------------------------------------------------- 設定（この端末に保存）
function tqSettingsLoad(){ try{ Object.assign(G.set, JSON.parse(localStorage.getItem("tq_settings") || "{}")); }catch(_e){} }
function tqSettingsSave(){ try{ localStorage.setItem("tq_settings", JSON.stringify(G.set)); }catch(_e){} }

// ---------------------------------------------------------------- 文字の置きかえ（男女で話し方が変わる）
// ---- 主人公の「一人称」（自分のことを なんと よぶか）----
const TQ_PRONS = [["boku", "僕"], ["watashi", "私"], ["ore", "俺"], ["uchi", "うち"], ["washi", "わし"], ["orecchi", "おれっち"], ["jibun", "自分"], ["name", "自分の名前"], ["shujinko", "主人公"]];
function tqPron(s){
    const k = (s && s.pron) || (s && s.sex === "f" ? "watashi" : "boku");
    if(k === "name") return (s && s.name) || "主人公";
    if(k === "shujinko") return "主人公";
    const e = TQ_PRONS.find((x) => x[0] === k); return e ? e[1] : "僕";
}
function rpgFmt(t){
    const s = G.S || {sex:(G.draft && G.draft.sex) || "m", name:(G.draft && G.draft.name) || "主人公", pron:(G.draft && G.draft.pron) || ""}, m = s.sex === "m";
    return String(t).replace(/\[\[([^|\]]*)\|([^\]]*)\]\]/g, (_x, a, b) => m ? a : b)
        .replace(/\{名前\}/g, s.name).replace(/\{私\}/g, tqPron(s)).replace(/\{くん\}/g, m ? "くん" : "ちゃん");
}

// ---------------------------------------------------------------- 声（ブラウザの読み上げ・BGMなし）
function tqSpeak(text, who){
    if(!G.set.voice) return;
    try{
        if(!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance !== "function") return;
        const ss = window.speechSynthesis; ss.cancel();
        const clean = String(text).replace(/\(ARE\)/g, "アレ").replace(/ARE/g, "アレ").replace(/[「」『』（）()…♪★☆💰▼]/g, "、").replace(/\s+/g, "");
        if(!clean.replace(/、/g, "").trim()) return;
        const key = who === "me" ? "me:" + (G.S ? G.S.sex : "m") : (who || "");
        const v = RPG_VOICES[key] || RPG_VOICES[""] || [1, 1];
        const u = new SpeechSynthesisUtterance(clean); u.lang = "ja-JP"; u.pitch = v[0]; u.rate = v[1];
        const jp = (ss.getVoices() || []).find((x) => /^ja/i.test(x.lang)); if(jp) u.voice = jp;
        ss.speak(u);
    }catch(_e){}
}
function tqSpeakStop(){ try{ window.speechSynthesis && window.speechSynthesis.cancel(); }catch(_e){} }

// ---------------------------------------------------------------- 状態
function tqNewState(prof){
    const S = {v:3, prof, name:prof.name, sex:prof.sex, map:"lab", x:8, y:9, dir:"up", px:8, py:9, lv:1, exp:0, gold:60, party:["hero"], m:{hero:{hp:1, mp:1}},
        items:{onigiri:3, coffee:1}, own:["w0", "a0", "c0"], eq:{w:"w0", a:"a0", c:"c0"}, f:{}, mem:[0, 0, 0, 0, 0, 0], steps:0, kills:0, gauge:0, trail:[], wh:{}, play:0, cx:{}, expmul:1, grinds:0};
    return S;
}
function tqMemCount(){ return G.S ? G.S.mem.reduce((a, b) => a + b, 0) : 0; }
function rpgCond(c){
    if(!c) return true;
    return String(c).split("&").every((t0) => {
        let t = t0.trim(), neg = false; if(t[0] === "!"){ neg = true; t = t.slice(1); }
        const m = t.match(/^(mem|lv)>=(\d+)$/); let r;
        if(m) r = (m[1] === "mem" ? tqMemCount() : G.S.lv) >= Number(m[2]); else r = !!G.S.f[t];
        return neg ? !r : r;
    });
}
function tqName(id){ return id === "hero" ? G.S.name : (RPG_CLASS[id].n || id); }
function tqLookOf(id){ return id === "hero" ? (G.S.sex === "m" ? "heroM" : "heroF") : TQ_LOOK_OF[id]; }
function tqStat(id){
    const S = G.S, c = RPG_CLASS[id], L = S.lv;
    if(S.cx.st999) return {maxhp:999, maxmp:999, atk:999, def:999, agi:999};
    const v = (a) => Math.round(a[0] + a[1] * L), e = S.eq;
    const st = {maxhp:v(c.hp), maxmp:v(c.mp), atk:v(c.atk), def:v(c.def), agi:v(c.agi)};
    const w = RPG_EQUIP[e.w].v, a = RPG_EQUIP[e.a].v + RPG_EQUIP[e.c].v, k = id === "hero" ? 1 : 0.6;
    st.atk += Math.round(w * k); st.def += Math.round(a * k);
    if(id === "hero" && S.prof && S.prof.pers){
        const b = S.prof.pers.bonus || {};
        st.maxhp = Math.round(st.maxhp * (b.hp || 1)); st.maxmp = Math.round(st.maxmp * (b.mp || 1)); st.atk = Math.round(st.atk * (b.atk || 1)); st.def = Math.round(st.def * (b.def || 1)); st.agi = Math.round(st.agi * (b.agi || 1));
    }
    return st;
}
function tqHealAll(){ G.S.party.forEach((id) => { const st = tqStat(id); G.S.m[id] = {hp:st.maxhp, mp:st.maxmp}; }); }
function tqClamp(){ G.S.party.forEach((id) => { if(!G.S.m[id]) G.S.m[id] = {hp:1, mp:1}; const st = tqStat(id), m = G.S.m[id]; m.hp = Math.min(m.hp, st.maxhp); m.mp = Math.min(m.mp, st.maxmp); }); }
function tqAddMember(id, force){
    const S = G.S; if(S.party.includes(id)) return false;
    if(!force && S.party.length >= TQ_MAX_PARTY) return false;
    S.party.push(id); const a = tqStat(id); S.m[id] = {hp:a.maxhp, mp:a.maxmp}; return true;
}
function tqGain(exp){
    const S = G.S, ups = [];
    if(S.lv >= TQ_MAX_LV){ S.exp = 0; return ups; }
    S.exp += Math.round(exp * (S.expmul || 1));
    while(S.lv < TQ_MAX_LV && S.exp >= rpgNeed(S.lv)){
        S.exp -= rpgNeed(S.lv);
        const before = {}; S.party.forEach((id) => { before[id] = tqStat(id); });
        S.lv++;
        S.party.forEach((id) => { const a = tqStat(id), m = S.m[id]; m.hp = Math.min(a.maxhp, m.hp + Math.max(0, a.maxhp - before[id].maxhp)); m.mp = Math.min(a.maxmp, m.mp + Math.max(0, a.maxmp - before[id].maxmp)); });
        let t = "レベル" + S.lv + " に あがった！";
        Object.keys(TQ_SKILLS).forEach((k) => { if(TQ_SKILLS[k].lv === S.lv) t += "\n" + S.name + "は「" + TQ_SKILLS[k].n + "」を おぼえた！"; });
        if(S.lv === 5 && S.party.includes("haruki")) t += "\nハルキは「ファイアウォール」を おぼえた！";
        if(S.lv === 3 && S.party.includes("akito")) t += "\nアキトは「チアアップ」を おぼえた！";
        ups.push(t);
    }
    if(S.lv >= TQ_MAX_LV){ S.exp = 0; ups.push("レベルが 最大（99）に なった！"); }
    return ups;
}
function tqSetLevel(n){
    const S = G.S; S.lv = Math.max(1, Math.min(TQ_MAX_LV, n)); S.exp = 0; tqClamp(); tqHealAll();
}
const TQ_SKILLS = {
    code:{n:"コードアタック", mp:3, lv:2, t:"one", p:1.8, d:"つよい 一撃"},
    recover:{n:"リカバリー", mp:4, lv:3, t:"ally", d:"なかまを かいふく"},
    beam:{n:"デバッグ・ビーム", mp:7, lv:6, t:"all", p:1.0, d:"てき ぜんたいに こうげき"},
    freeze:{n:"タイムストップ", mp:9, lv:10, t:"all", d:"てきの うごきを とめる"}
};

// ---------------------------------------------------------------- 冒険の書（セーブ3枠・この端末のブラウザに保存）
function tqSlotKey(i){ return "tq_save_" + i; }
function tqReadSlot(i){
    let raw; try{ raw = localStorage.getItem(tqSlotKey(i)); }catch(_e){ return null; }
    if(!raw) return null;
    try{ const r = JSON.parse(raw); if(r && r.data && r.data.v === 3 && RPG_MAPS[r.data.map]) return r; }catch(_e){}
    return {corrupted:true, name:"読み込み不可", saved_at:""};
}
function tqWriteSlot(i, rec){ try{ localStorage.setItem(tqSlotKey(i), JSON.stringify(rec)); return true; }catch(_e){ return false; } }
function tqNow(){ const d = new Date(), p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + "/" + p(d.getMonth() + 1) + "/" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()); }
function tqSaveTo(i, name){
    if(!G.S) return {ok:false, msg:"セーブできる データが ありません。"};
    const nm = String(name || "").trim().slice(0, 24) || (G.S.name + "の冒険");
    const rec = {schema:1, name:nm, saved_at:tqNow(), data:JSON.parse(JSON.stringify(G.S))};
    if(!tqWriteSlot(i, rec)) return {ok:false, msg:"保存できませんでした。（ブラウザの保存が ゆるされていないかも）"};
    G.slot = i; G.saveName = nm; return {ok:true, msg:"冒険の書 " + i + " に 記録しました！"};
}
function tqAutoSave(){
    if(!G.S || !G.slot) return;
    const old = tqReadSlot(G.slot);
    tqWriteSlot(G.slot, {schema:1, name:(old && old.name && !old.corrupted) ? old.name : (G.saveName || G.S.name + "の冒険"), saved_at:tqNow(), data:JSON.parse(JSON.stringify(G.S))});
}
function tqCopySlot(a, b){
    const r = tqReadSlot(a); if(!r || r.corrupted) return {ok:false, msg:"コピーできる 冒険の書が ありません。"};
    if(a === b) return {ok:false, msg:"べつの 枠を えらんでください。"};
    const c = JSON.parse(JSON.stringify(r)); c.name = (r.name.slice(0, 24 - 5) + "のコピー"); c.saved_at = tqNow();
    return tqWriteSlot(b, c) ? {ok:true, msg:"冒険の書 " + b + " に コピーしました。"} : {ok:false, msg:"コピーできませんでした。"};
}
function tqDeleteSlot(i){ try{ localStorage.removeItem(tqSlotKey(i)); }catch(_e){} if(G.slot === i) G.slot = 0; return {ok:true, msg:"冒険の書 " + i + " を 消しました。"}; }
function tqRenameSlot(i, name){
    const r = tqReadSlot(i); if(!r || r.corrupted) return {ok:false, msg:"名前を変えられません。"};
    const nm = String(name || "").trim().slice(0, 24); if(!nm) return {ok:false, msg:"名前を入力してください。"};
    r.name = nm; tqWriteSlot(i, r); if(G.slot === i) G.saveName = nm; return {ok:true, msg:"名前を かえました。"};
}
function tqHasSaves(){ for(let i = 1; i <= TQ_SLOTS; i++){ const r = tqReadSlot(i); if(r && !r.corrupted) return true; } return false; }
function tqLoadFrom(i){
    const r = tqReadSlot(i); if(!r || r.corrupted) return {ok:false, msg:"読み込める 冒険の書が ありません。"};
    const base = tqNewState({name:"主人公", sex:"m"});
    const S = Object.assign(base, r.data); S.cx = Object.assign({}, r.data.cx || {}); S.f = Object.assign({}, r.data.f || {});
    G.S = S; G.slot = i; G.saveName = r.name; G.scripts = []; G.b = null; G.auto = false; G.grind = null; try{ tqTempSync(S.map, true); }catch(_e){} tqClamp();
    return {ok:true, msg:"冒険の書 " + i + " を 読み込みました。"};
}
function tqPlayText(sec){ const m = Math.floor((sec || 0) / 60); return Math.floor(m / 60) + "時間" + String(m % 60).padStart(2, "0") + "分"; }

// ---------------------------------------------------------------- チートコード（暗号の指紋だけで照合）
function tqNorm(s){ return String(s || "").normalize("NFKC").toLowerCase().replace(/\s+/g, ""); }
function tqFindCheat(raw){
    const n = tqNorm(raw); if(!n) return null;
    const table = TQ_CHEATS, hit = (t) => { const h = tqStretch(t); const e = table.find((x) => x[0] === h); return e ? e[1] : null; };
    let id = hit(n); if(id) return {id, nums:[]};
    const nums = [], stem = n.split(",").map((tok) => tok.replace(/(\d+)$/, (m) => { nums.push(parseInt(m, 10)); return "#"; })).join(",");
    id = hit(stem); return id ? {id, nums} : null;
}
function tqToggle(key, label){ const c = G.S.cx; c[key] = !c[key]; return label + "を " + (c[key] ? "ON" : "OFF") + " に しました！"; }
function tqApplyCheat(raw){
    const f = tqFindCheat(raw);
    if(!f) return {ok:false, msg:"…ざんねん！ そんな コードは ないみたい。\n（ヒント：意外と たんじゅん かも？）"};
    if(!G.S){
        G.cheatQueue.push(String(raw)); return {ok:true, msg:"コードを 受けつけました！（ストック：ゲームを はじめると 反映されます）", queued:true};
    }
    const S = G.S, c = S.cx, n = f.nums;
    const all = (fn) => S.party.forEach((id) => fn(id, S.m[id]));
    let msg = "";
    switch(f.id){
        case "lvmax": tqSetLevel(99); msg = "全員が レベル99（最大）に なった！"; break;
        case "lvset": if(!(n[0] >= 1 && n[0] <= 99)) return {ok:false, msg:"レベルは 1〜99 で 指定してください。"}; tqSetLevel(n[0]); msg = "全員が レベル" + n[0] + " に なった！"; break;
        case "st999": c.st999 = true; tqClamp(); tqHealAll(); msg = "ステータスが ぜんぶ 999 に なった！"; break;
        case "goldmax": S.gold = TQ_MAX_GOLD; msg = "所持金が MAX（9,999,999G）に なった！"; break;
        case "goldadd": if(!(n[0] > 0)) return {ok:false, msg:"金額を 指定してください。"}; S.gold = Math.min(TQ_MAX_GOLD, S.gold + n[0]); msg = n[0] + "G を てにいれた！"; break;
        case "party5": case "party6": {
            const need = f.id === "party5" ? 1 : 2;
            if(n.length !== need) return {ok:false, msg:"NPC番号が " + need + "つ 必要です。"};
            const ids = n.map((x) => "n" + String(x).padStart(3, "0"));
            if(ids.some((x) => !RPG_CLASS[x])) return {ok:false, msg:"NPC番号は 001〜015 です。"};
            if(new Set(ids).size !== ids.length) return {ok:false, msg:"おなじ NPC は 2人 加えられません。"};
            if(ids.some((x) => S.party.includes(x))) return {ok:false, msg:"その NPC は すでに 仲間です。"};
            const target = f.id === "party5" ? 5 : 6;
            for(const sid of ["haruki", "akito", "kaito"]){ if(S.party.length >= target - ids.length) break; tqAddMember(sid, true); }
            if(S.party.length + ids.length > 6) return {ok:false, msg:"パーティは チートでも 6人までです。"};
            ids.forEach((x) => tqAddMember(x, true)); msg = ids.map((x) => RPG_CLASS[x].n).join("・") + " が なかまに くわわった！（" + S.party.length + "人パーティ）"; break;
        }
        case "bossally": {
            if(n.length !== 1 || !(n[0] >= 1 && n[0] <= 15)) return {ok:false, msg:"ボス番号は 01〜15 です。（例：BossAlly09）"};
            return tqCheatJoin(["b" + String(n[0]).padStart(2, "0")]);
        }
        case "miraboss": return tqCheatJoin(["mira_b"]);
        case "miraally": return tqCheatJoin(["mira"]);
        case "fullheal": tqHealAll(); msg = "みんなの HPと MPが 全回復した！"; break;
        case "revive": all((id, m) => { if(m.hp <= 0) m.hp = tqStat(id).maxhp; }); msg = "たおれた 仲間が ふっかつした！"; break;
        case "items99": Object.keys(RPG_ITEMS).forEach((k) => { S.items[k] = 99; }); msg = "どうぐが ぜんぶ 99こ に なった！"; break;
        case "bestgear": ["w6", "a6", "c4"].forEach((k) => { if(!S.own.includes(k)) S.own.push(k); S.eq[RPG_EQUIP[k].slot] = k; }); tqClamp(); msg = "さいきょうの そうびを てにいれた！"; break;
        case "expx10": S.expmul = 10; msg = "もらえる経験値が 10倍に！"; break;
        case "expx100": S.expmul = 100; msg = "もらえる経験値が 100倍に！！"; break;
        case "expx1": S.expmul = 1; msg = "経験値の倍率を 1倍に もどした。"; break;
        case "god": msg = tqToggle("god", "無敵モード"); break;
        case "onehit": msg = tqToggle("onehit", "ワンパンモード"); break;
        case "infmp": msg = tqToggle("infmp", "MPむげん"); break;
        case "areall": msg = tqToggle("areall", "ARE！ゲージ MAX固定"); break;
        case "arefull": S.gauge = 100; msg = "ARE！ゲージが MAX に なった！"; break;
        case "noenc": msg = tqToggle("noenc", "エンカウントなし"); break;
        case "encx3": msg = tqToggle("encx3", "エンカウント3倍"); break;
        case "speed": msg = tqToggle("speed", "あるくの 2倍速"); break;
        case "allgate": c.allgate = true; msg = "ゲートの 行き先が ぜんぶ ひらいた！"; break;
        case "memall": S.mem = [1, 1, 1, 1, 1, 1]; msg = "6つの メモリが ぜんぶ そろった！"; break;
        case "clear": ["e_sendai", "e_tokyo", "e_white", "e_xmas", "e_labn", "e_future", "intro_done", "xr_open"].forEach((k) => { S.f[k] = 1; }); S.mem = [1, 1, 1, 1, 1, 1]; ["e_n8", "e_n9", "e_n10", "e_n11"].forEach((k) => { S.f[k] = 1; }); msg = "ストーリーを ぜんぶ クリアした！（第2部も）"; G.afterCheat = "end"; break;
        case "bonus": S.f.xr_open = 1; S.f.e_n11 = 1; c.allgate = true; msg = "おまけの『XRアドベンチャー体験会』が ひらいた！（ゲートから いけます）"; break;
        case "rainbow": msg = tqToggle("rainbow", "にじいろモード"); break;
        case "showpos": msg = tqToggle("showpos", "座標ひょうじ"); break;
        case "voice": tqSpeak("チートコード、成功です。声は ちゃんと 出ています。", "アキト"); msg = G.set.voice ? "声の テスト！（聞こえない ときは ブラウザの 設定を 見てね）" : "声は いま オフです。せっていで オンに できます。"; break;
        case "cheat": S.gold = Math.min(TQ_MAX_GOLD, S.gold + 1000); msg = "…そのまんまの ことば だった！ ふふ、意外と たんじゅん でしょ？（1000G ゲット）"; break;
        case "off": ["god", "onehit", "infmp", "areall", "noenc", "encx3", "speed", "rainbow", "showpos"].forEach((k) => { c[k] = false; }); msg = "ON/OFFの チートを ぜんぶ OFF に しました。"; break;
        default: return {ok:false, msg:"そのコードは まだ つかえません。"};
    }
    tqAutoSave();
    return {ok:true, msg};
}
// チートで 仲間を くわえる（ふつうの 仲間は 4人まで／チートは 6人まで）
function tqCheatJoin(ids){
    const S = G.S, out = [];
    ids.forEach((id) => {
        if(S.party.includes(id)){ out.push(RPG_CLASS[id].n + " は すでに 仲間です。"); return; }
        if(id === "mira_b" && S.party.includes("mira")){ S.party = S.party.filter((x) => x !== "mira"); if(S.temp) delete S.temp.mira; }
        if(id === "mira" && S.party.includes("mira_b")){ out.push("ミラは すでに（ノイズクイーンの すがたで）仲間です。"); return; }
        if(S.party.length >= 6){ out.push("パーティは チートでも 6人までです。"); return; }
        tqAddMember(id, true); if(S.temp) delete S.temp[id]; out.push(RPG_CLASS[id].n + " が なかまに くわわった！（" + S.party.length + "人パーティ）");
    });
    tqAutoSave();
    return {ok:true, msg:out.join("\n")};
}
function tqFlushCheatQueue(){
    const out = [];
    while(G.cheatQueue.length){ const r = tqApplyCheat(G.cheatQueue.shift()); out.push(r.msg); }
    return out;
}
