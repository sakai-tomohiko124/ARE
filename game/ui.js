"use strict";
// ===== 画面（タイトル／冒険の書／プロフィール／性格診断／あそびかた／せってい／チート）と入力 =====
const ACT = {};
const TQ_SPR = {};
const BGS = {title:"title", sendai_st:"sendai_st", aer:"aer"};

function toast(text, ms){
    const t = $("toast"); t.textContent = text; t.classList.add("on");
    clearTimeout(G.toastT); G.toastT = setTimeout(() => t.classList.remove("on"), ms || 2600);
}
function flash(){ const f = $("flash"); f.style.opacity = "0.9"; setTimeout(() => { f.style.opacity = "0"; }, 90); }
function setBg(key){
    const el = $("bg");
    if(!key){ el.classList.remove("on"); return; }
    el.style.backgroundImage = "url('./img/" + key + ".webp')"; el.classList.add("on");
}
// ---- 立ち絵（画像があれば画像、なければ見た目から描いた絵）----
function spriteURL(look){
    if(TQ_SPR[look]) return TQ_SPR[look];
    const c = document.createElement("canvas"); c.width = 120; c.height = 132; const g = c.getContext("2d"); g.scale(3.4, 3.4);
    g.translate(2, 0); rpgSprite(g, look, 0, 8, "down", 0, 0);
    return (TQ_SPR[look] = c.toDataURL());
}
function portraitHtml(who){
    if(!who) return "";
    if(who === "me"){ const f = G.S ? G.S.sex === "f" : (G.draft && G.draft.sex === "f"); return '<img src="./img/' + (f ? "girl" : "boy") + '.png" alt="">'; }
    if(TQ_PORTRAIT_IMG[who]) return '<img src="./img/' + TQ_PORTRAIT_IMG[who] + '.webp" alt="">';
    if(TQ_PORTRAIT_LOOK[who] && RPG_LOOKS[TQ_PORTRAIT_LOOK[who]]) return '<img class="pix" src="' + spriteURL(TQ_PORTRAIT_LOOK[who]) + '" alt="">';
    return "";
}
function typeInto(el, text, instant){
    clearInterval(G.typeT); G.typing = null;
    if(!el) return;
    if(instant || !text){ el.textContent = text; return; }
    let i = 0; el.textContent = ""; G.typing = {el, text};
    G.typeT = setInterval(() => { i += 2; el.textContent = text.slice(0, i); if(i >= text.length){ clearInterval(G.typeT); G.typing = null; } }, 28);
}
function finishTyping(){ if(G.typing){ clearInterval(G.typeT); G.typing.el.textContent = G.typing.text; G.typing = null; return true; } return false; }
function winMsg(who, text, opts){
    opts = opts || {}; const por = portraitHtml(who === "me" ? "me" : who);
    const nm = who === "me" ? G.S.name : who;
    return (por ? '<div id="por">' + por + '</div>' : "") + '<div id="msg" class="win' + (por ? " hasp" : "") + '" data-tap="1">' + (nm ? '<span class="who">' + esc(nm) + '</span>' : "") + '<span id="mt" data-full="' + esc(text) + '"></span>' + (opts.next === false ? "" : '<span class="nx">▼</span>') + '</div>';
}

// ---------------------------------------------------------------- 描画の入口
function render(){
    const m = G.mode, ui = $("ui"); document.body.dataset.mode = m;
    let h = "";
    if(m === "title") h = viewTitle();
    else if(m === "slots") h = viewSlots();
    else if(m === "profile") h = viewProfile();
    else if(m === "persona") h = viewPersona();
    else if(m === "result") h = viewResult();
    else if(m === "help") h = viewHelp();
    else if(m === "settings") h = viewSettings();
    else if(m === "cheat") h = viewCheat();
    else h = fieldView();
    if(G.dlg) h += viewDlg();
    ui.innerHTML = h;
    const bgKey = m === "title" || m === "slots" || m === "profile" || m === "persona" || m === "result" || m === "help" || m === "settings" || m === "cheat" ? "title" : (G.bg || "");
    setBg(m === "battle" ? "" : bgKey);
    const full = ui.querySelector("#mt");
    if(full) typeInto(full, full.dataset.full);
    const first = navList()[0]; if(first) first.classList.add("on");
    document.body.classList.toggle("padoff", G.set.pad === "off"); document.body.classList.toggle("padon", G.set.pad === "on");
    $("btnVoice").textContent = G.set.voice ? "声：オン" : "声：オフ"; $("btnBgm").textContent = G.set.bgm === false ? "BGM：オフ" : "BGM：オン";
    if(window.fieldAfterRender) fieldAfterRender();
    const dlgIn = ui.querySelector("#dlgIn"); if(dlgIn) dlgIn.focus();
}
function navList(){
    const dlg = $("ui").querySelector("#dlg");
    const scope = dlg || $("ui");
    return Array.from(scope.querySelectorAll("[data-a]")).filter((e) => !e.disabled && e.offsetParent !== null);
}
function navMove(d){
    const l = navList(); if(!l.length) return;
    let i = l.findIndex((e) => e.classList.contains("on")); l.forEach((e) => e.classList.remove("on"));
    i = i < 0 ? 0 : (i + d + l.length) % l.length; l[i].classList.add("on"); l[i].scrollIntoView({block:"nearest"});
}
function navOk(){ const l = navList(); const e = l.find((x) => x.classList.contains("on")) || l[0]; if(e) e.click(); }

// ---------------------------------------------------------------- ダイアログ（はい／いいえ・入力）
function viewDlg(){
    const d = G.dlg;
    if(d.type === "confirm") return '<div id="dlg" class="win panel sm" style="z-index:8;text-align:center"><div style="white-space:pre-wrap;margin:.6cqw 0 1.4cqw">' + esc(d.text) + '</div><div class="row" style="justify-content:center"><button class="btn" data-a="dlgyes">はい</button><button class="btn sub" data-a="dlgno">いいえ</button></div></div>';
    return '<div id="dlg" class="win panel sm" style="z-index:8"><div>' + esc(d.text) + '</div><input id="dlgIn" type="text" maxlength="' + (d.max || 24) + '" value="' + esc(d.value || "") + '" style="width:100%;margin:.8cqw 0"><div class="row" style="justify-content:center"><button class="btn" data-a="dlgok">けってい</button><button class="btn sub" data-a="dlgno">やめる</button></div></div>';
}
function askYes(text, fn){ G.dlg = {type:"confirm", text, fn}; render(); }
function askText(text, value, fn, max){ G.dlg = {type:"prompt", text, value, fn, max}; render(); }
ACT.dlgyes = () => { const f = G.dlg.fn; G.dlg = null; render(); if(f) f(); };
ACT.dlgno = () => { G.dlg = null; render(); };
ACT.dlgok = () => { const v = ($("dlgIn") || {}).value || "", f = G.dlg.fn; G.dlg = null; render(); if(f) f(v); };

// ---------------------------------------------------------------- タイトル
function viewTitle(){
    G.draft = null;
    return '<div id="tm" class="win"><button class="opt" data-a="tNew">はじめから</button><button class="opt" data-a="tLoad">つづきから</button><button class="opt" data-a="tHelp">あそびかた</button><button class="opt" data-a="tSet">せってい</button><button class="opt" data-a="tCheat">🔑 チート</button></div>' +
        '<div class="foot">TOMOHIKO QUEST 〜そういうときは、AREだ！〜　／　タップ・矢印キー+Enter で えらべます</div>';
}
ACT.tNew = () => { G.slotCtx = "new"; G.slotFrom = "title"; G.slotPick = null; G.mode = "slots"; render(); };
ACT.tLoad = () => { if(!tqHasSaves()){ toast("まだ 冒険の書が ありません。『はじめから』で 冒険を はじめよう！"); return; } G.slotCtx = "load"; G.slotFrom = "title"; G.slotPick = null; G.mode = "slots"; render(); };
ACT.tHelp = () => { G.helpFrom = "title"; G.mode = "help"; render(); };
ACT.tSet = () => { G.setFrom = "title"; G.mode = "settings"; render(); };
ACT.tCheat = () => { G.cheatFrom = "title"; G.cheatMsg = ""; G.mode = "cheat"; render(); };

// ---------------------------------------------------------------- 冒険の書（3枠）
function mapNameOf(id){ return RPG_MAPS[id] ? RPG_MAPS[id].name : id; }
function viewSlots(){
    const ctx = G.slotCtx, pick = G.slotPick, title = ctx === "new" ? "どの 冒険の書に 記録しますか？" : ctx === "save" ? "冒険の書に セーブ" : "どの 冒険の書を ひらきますか？";
    let h = '<div class="win panel scroll"><h2>📖 冒険の書</h2><div class="meta" style="margin-bottom:.6cqw">' + (pick ? "コピー先の 枠を えらんでください。" : title) + '</div><div class="slots">';
    for(let i = 1; i <= TQ_SLOTS; i++){
        const r = tqReadSlot(i), cur = G.slot === i && ctx === "save";
        h += '<div class="slot' + (pick && pick.from !== i ? " pick" : "") + '"><b>冒険の書 ' + i + (cur ? "（いま）" : "") + '</b>';
        if(!r) h += '<div class="meta" style="margin:2cqw 0">— あきわく —</div>';
        else if(r.corrupted) h += '<div class="err">読み込めません</div>';
        else{
            const d = r.data; h += '<div style="font-size:2cqw;color:#fff">' + esc(r.name) + '</div><div class="meta">' + esc(d.name) + '　Lv' + d.lv + '　メモリ ' + d.mem.reduce((a, b) => a + b, 0) + '/6</div><div class="meta">' + esc(mapNameOf(d.map)) + '</div><div class="meta">プレイ ' + tqPlayText(d.play) + '</div><div class="meta">' + esc(r.saved_at) + '</div>';
        }
        h += '<div class="sb">';
        if(pick){ if(pick.from !== i) h += '<button class="btn" data-a="slotCopyTo" data-v="' + i + '">ここへコピー</button>'; }
        else if(ctx === "new") h += '<button class="btn" data-a="slotNew" data-v="' + i + '">この枠ではじめる</button>';
        else{
            if(ctx === "save") h += '<button class="btn" data-a="slotSave" data-v="' + i + '">セーブ</button>';
            if(r && !r.corrupted) h += '<button class="btn" data-a="slotLoad" data-v="' + i + '">ロード</button>';
            if(r && !r.corrupted) h += '<button class="btn sub" data-a="slotCopy" data-v="' + i + '">コピー</button><button class="btn sub" data-a="slotName" data-v="' + i + '">名前</button>';
            if(r) h += '<button class="btn sub" data-a="slotDel" data-v="' + i + '">消す</button>';
        }
        h += '</div></div>';
    }
    h += '</div><div class="row" style="margin-top:1cqw"><button class="btn sub" data-a="' + (pick ? "slotPickCancel" : "slotBack") + '">もどる</button></div><div class="meta" style="margin-top:.5cqw">※ 冒険の書は、この端末の ブラウザの中に 保存されます。（ゲーム中は 自動でも 記録されます）</div></div>';
    return h;
}
ACT.slotBack = () => { if(G.slotFrom === "menu"){ G.mode = "menu"; G.menuTab = "main"; } else G.mode = "title"; render(); };
ACT.slotPickCancel = () => { G.slotPick = null; render(); };
ACT.slotNew = (v) => {
    const i = Number(v), r = tqReadSlot(i), go = () => { G.newSlot = i; G.draft = {name:"主人公", sex:"m", month:"", day:"", answers:[], q:0}; G.mode = "profile"; render(); };
    if(r) askYes("冒険の書 " + i + " には データが あります。\n上書きして はじめますか？", go); else go();
};
ACT.slotSave = (v) => {
    const i = Number(v), r = tqReadSlot(i), run = (nm) => { const res = tqSaveTo(i, nm); toast(res.msg); render(); };
    const go = () => askText("冒険の書 " + i + " の 名前（24文字まで）", (r && !r.corrupted ? r.name : (G.saveName || G.S.name + "の冒険")), run, 24);
    if(r) askYes("冒険の書 " + i + " に 上書きセーブしますか？", go); else go();
};
ACT.slotLoad = (v) => {
    const i = Number(v), res = tqLoadFrom(i); if(!res.ok){ toast(res.msg); return; }
    tqSettingsLoad(); enterGame(res.msg);
};
ACT.slotCopy = (v) => { G.slotPick = {from:Number(v)}; render(); };
ACT.slotCopyTo = (v) => {
    const to = Number(v), from = G.slotPick.from, run = () => { const res = tqCopySlot(from, to); G.slotPick = null; toast(res.msg); render(); };
    if(tqReadSlot(to)) askYes("冒険の書 " + to + " を 上書きして コピーしますか？", run); else run();
};
ACT.slotName = (v) => { const i = Number(v), r = tqReadSlot(i); askText("あたらしい 名前（24文字まで）", r ? r.name : "", (nm) => { const res = tqRenameSlot(i, nm); toast(res.msg); render(); }, 24); };
ACT.slotDel = (v) => { const i = Number(v); askYes("冒険の書 " + i + " を 消します。\nもとに もどせません。いいですか？", () => { const res = tqDeleteSlot(i); toast(res.msg); if(G.slotCtx === "load" && !tqHasSaves()){ G.mode = "title"; } render(); }); };

// ---------------------------------------------------------------- プロフィール（名前・性別・誕生日→星座）
function viewProfile(){
    const d = G.draft, sug = (G.q.get("name") || "").trim().slice(0, 10);
    let mo = '<option value="">月</option>', da = '<option value="">日</option>';
    for(let i = 1; i <= 12; i++) mo += '<option value="' + i + '"' + (String(d.month) === String(i) ? " selected" : "") + '>' + i + '</option>';
    for(let i = 1; i <= 31; i++) da += '<option value="' + i + '"' + (String(d.day) === String(i) ? " selected" : "") + '>' + i + '</option>';
    const z = tqZodiac(d.month, d.day);
    return '<div class="win panel sm scroll"><h2>🧑 プロフィール</h2><label for="pName">主人公の なまえ（10文字まで・はじめは「主人公」）</label><input id="pName" type="text" maxlength="10" value="' + esc(d.name) + '" style="width:100%">' +
        (sug ? '<div class="row" style="margin:.5cqw 0"><button class="btn sub" data-a="pUse">⭐ プロフィールの名前「' + esc(sug) + '」を つかう（おすすめ）</button></div>' : '<div class="meta">（チャットの プロフィールの 名前を おすすめします。ゲームの 中でも かえられます）</div>') +
        '<label>せいべつ（話し方が かわります）</label><div class="row"><button class="btn' + (d.sex === "m" ? "" : " sub") + '" data-a="pSex" data-v="m">🧑 男の子（僕）</button><button class="btn' + (d.sex === "f" ? "" : " sub") + '" data-a="pSex" data-v="f">👩 女の子（私）</button></div>' +
        '<label for="pPron">自分の よびかた（一人称）</label><select id="pPron"><option value="">おまかせ（男の子＝僕／女の子＝私）</option>' + TQ_PRONS.map((p) => '<option value="' + p[0] + '"' + (d.pron === p[0] ? " selected" : "") + '>' + esc(p[0] === "name" ? "自分の名前（" + (d.name || "主人公") + "）" : p[1]) + '</option>').join("") + '</select>' +
        '<label>たんじょう日（星座が わかるよ）</label><div class="row"><select id="pMon">' + mo + '</select> 月 <select id="pDay">' + da + '</select> 日</div>' +
        '<div class="zodiac" id="zod">' + zodHtml(z) + '</div><div class="err" id="perr"></div><div class="row"><button class="btn sub" data-a="pBack">もどる</button><button class="btn" data-a="pNext">つぎへ ▶</button></div></div>';
}
function zodHtml(z){ return z ? z.mark + " " + esc(z.name) + '<div class="meta">' + esc(z.text) + '</div>' : '<span class="meta">月と日を えらぶと、星座が ひょうじされます。</span>'; }
function keepDraft(){ const d = G.draft; if(!d) return; if($("pName")) d.name = $("pName").value; if($("pMon")) d.month = $("pMon").value; if($("pDay")) d.day = $("pDay").value; if($("pPron")) d.pron = $("pPron").value; }
ACT.pUse = () => { const sug = (G.q.get("name") || "").trim().slice(0, 10); if(sug){ keepDraft(); G.draft.name = sug; render(); toast("プロフィールの 名前を 使います。"); } };
ACT.pSex = (v) => { keepDraft(); G.draft.sex = v; render(); };
ACT.pBack = () => { keepDraft(); G.mode = "title"; render(); };
ACT.pNext = () => {
    keepDraft(); const d = G.draft, e = $("perr"), nm = d.name.trim();
    if(!nm){ e.textContent = "主人公の なまえを いれてください。"; return; }
    if(Array.from(nm).length > 10){ e.textContent = "なまえは 10文字までです。"; return; }
    if(!d.month || !d.day){ e.textContent = "たんじょう日の 月と日を えらんでください。"; return; }
    const z = tqZodiac(d.month, d.day); if(!z){ e.textContent = "その月に ない 日付です。"; return; }
    d.name = nm; d.zodiac = z; d.answers = []; d.q = 0; G.mode = "persona"; render();
};
// ---------------------------------------------------------------- 性格診断（3つの質問・はい／いいえ）
function viewPersona(){
    const d = G.draft, i = d.q;
    return '<div class="win panel sm"><h2>🔮 性格診断（' + (i + 1) + '/3）</h2><div class="q">' + esc(TQ_QUESTIONS[i]) + '</div><div class="qb"><button class="btn" data-a="qAns" data-v="1">はい</button><button class="btn" data-a="qAns" data-v="0">いいえ</button></div>' +
        '<div class="row" style="margin-top:2cqw"><button class="btn sub" data-a="qBack">もどる</button></div></div>';
}
ACT.qAns = (v) => { const d = G.draft; d.answers[d.q] = v === "1"; if(d.q >= 2){ d.pers = tqPersonality(d.answers); G.mode = "result"; } else d.q++; render(); };
ACT.qBack = () => { const d = G.draft; if(d.q > 0){ d.q--; d.answers.length = d.q; render(); } else { G.mode = "profile"; render(); } };
function viewResult(){
    const d = G.draft, p = d.pers, b = p.bonus, bt = Object.keys(b).map((k) => ({hp:"HP", mp:"MP", atk:"こうげき", def:"ぼうぎょ", agi:"すばやさ"})[k] + " +" + Math.round((b[k] - 1) * 100) + "%").join("　");
    return '<div class="win panel sm"><h2>✨ 診断の けっか</h2><div style="font-size:2.4cqw"><b>' + esc(d.name) + '</b>（20歳・' + (d.sex === "m" ? "男" : "女") + '）</div><div class="zodiac">' + zodHtml(d.zodiac) + '</div>' +
        '<h3>あなたの 性格：' + esc(p.name) + '</h3><div>' + esc(p.desc) + '</div><div class="chips"><span class="chip">せいちょうボーナス：' + esc(bt) + '</span></div>' +
        '<div class="row" style="margin-top:1.2cqw"><button class="btn sub" data-a="rBack">さいごの 質問に もどる</button><button class="btn" data-a="rStart">⚔️ ぼうけんを はじめる</button></div></div>';
}
ACT.rBack = () => { const d = G.draft; d.q = 2; d.answers.length = 2; G.mode = "persona"; render(); };
ACT.rStart = () => {
    const d = G.draft;
    G.S = tqNewState({name:d.name, sex:d.sex, month:Number(d.month), day:Number(d.day), zodiac:d.zodiac, answers:d.answers.slice(), pers:d.pers});
    G.slot = G.newSlot; G.saveName = d.name + "の冒険"; tqHealAll(); G.scripts = []; G.b = null; G.auto = false; G.grind = null; G.S.pron = d.pron || "";
    tqSaveTo(G.slot, G.saveName); G.draft = null;
    enterGame(""); runScript(RPG_EV.lab_intro);
};
// ---------------------------------------------------------------- あそびかた・せってい
function helpText(){
    return "【ものがたり】\n未来の ARE かいはつラボから、過去の世界へ タイムスリップ！ ノイズ（かわいい モンスター）に 持ち去られた『大事なメモリ』6つを 取りもどして、ARE を 完成させよう。\n\n" +
        "【そうさ】\nいどう：矢印キー／WASD／画面の ボタン（長おしで 連続）\nはなす・しらべる・けってい：Enter／Z／スペース／Aボタン\nメニュー：X／M／メニューボタン　もどる：X／Esc\n\n" +
        "【たたかい】\nコマンドを えらんで たたかう。なかまは 自動で こうどう。『オート』を ONに すると 自動で 戦うよ。『ARE！ゲージ』が MAX で ひっさつ技！\n\n" +
        "【ならではの きのう】\n・パーティは 最大4人\n・自動レベル上げ（メニュー→じどう）\n・冒険の書は 3つ（いつでも セーブ）\n・声は ブラウザの 読み上げ／BGMは game/bgm の mp3 を ループ再生\n・🔑チート：ひみつの コードを さがそう！ ヒント：意外と たんじゅん。";
}
function viewHelp(){ return '<div class="win panel scroll"><h2>📘 あそびかた</h2><div style="white-space:pre-wrap;font-size:1.95cqw">' + esc(helpText()) + '</div><div class="row" style="margin-top:1cqw"><button class="btn" data-a="hBack">もどる</button></div></div>'; }
ACT.hBack = () => { if(G.helpFrom === "menu"){ G.mode = "menu"; G.menuTab = "main"; } else G.mode = "title"; render(); };
function viewSettings(){
    const s = G.set, sp = ["ふつう", "はやい", "すごくはやい"][s.speed || 0], pad = {auto:"じどう", on:"ひょうじ", off:"ひひょうじ"}[s.pad || "auto"];
    return '<div class="win panel sm scroll"><h2>⚙️ せってい</h2><div class="card"><div class="row"><button class="btn" data-a="sVoice">🔊 声（読み上げ）：' + (s.voice ? "オン" : "オフ") + '</button></div><div class="meta">ブラウザの 設定で ゆるされていないと 鳴りません。</div></div>' +
        '<div class="card"><div class="row"><button class="btn" data-a="sBgm">🎵 BGM：' + (s.bgm === false ? "オフ" : "オン") + '</button><button class="btn sub" data-a="sBgmVol">音量：' + ["小", "中", "大"][s.bgmVol == null ? 1 : s.bgmVol] + '</button></div><div class="meta">曲は game/bgm/ に置いた mp3 が 鳴ります（ずっと ループ）。</div></div>' +
        (G.S ? '<div class="card"><div class="meta">自分の よびかた（一人称）</div><div class="row">' + TQ_PRONS.map((p) => '<button class="btn' + (tqPronKey() === p[0] ? "" : " sub") + '" data-a="sPron" data-v="' + p[0] + '">' + esc(p[0] === "name" ? G.S.name : p[1]) + '</button>').join("") + '</div></div>' : "") +
        '<div class="card"><div class="row"><button class="btn" data-a="sSpeed">⏩ オート戦闘の はやさ：' + sp + '</button></div></div>' +
        '<div class="card"><div class="row"><button class="btn" data-a="sPad">🎮 タッチ ボタン：' + pad + '</button><button class="btn sub" data-a="sFull">全画面</button></div><div class="meta">スマホ・タブレットは よこむき が おすすめ。</div></div>' +
        '<div class="row"><button class="btn" data-a="sBack">もどる</button></div></div>';
}
ACT.sVoice = () => { G.set.voice = !G.set.voice; if(!G.set.voice) tqSpeakStop(); tqSettingsSave(); render(); };
function tqPronKey(){ return (G.S && G.S.pron) || (G.S && G.S.sex === "f" ? "watashi" : "boku"); }
ACT.sPron = (v) => { if(G.S && TQ_PRONS.some((p) => p[0] === v)){ G.S.pron = v; tqAutoSave(); } render(); };
ACT.sBgm = () => { G.set.bgm = G.set.bgm === false; tqSettingsSave(); if(G.set.bgm === false) tqBgmStop(); else tqBgmSync(); $("btnBgm").textContent = G.set.bgm === false ? "BGM：オフ" : "BGM：オン"; render(); };
ACT.sBgmVol = () => { G.set.bgmVol = ((G.set.bgmVol == null ? 1 : G.set.bgmVol) + 1) % 3; tqSettingsSave(); tqBgmSync(); render(); };
ACT.sSpeed = () => { G.set.speed = ((G.set.speed || 0) + 1) % 3; tqSettingsSave(); render(); };
ACT.sPad = () => { G.set.pad = G.set.pad === "auto" ? "on" : G.set.pad === "on" ? "off" : "auto"; tqSettingsSave(); render(); };
ACT.sFull = () => toggleFullscreen();
ACT.sBack = () => { if(G.setFrom === "menu"){ G.mode = "menu"; G.menuTab = "main"; } else G.mode = "title"; render(); };
function toggleFullscreen(){
    try{
        if(document.fullscreenElement){ document.exitFullscreen(); return; }
        const el = document.documentElement;
        (el.requestFullscreen ? el.requestFullscreen() : Promise.reject()).then(() => { try{ screen.orientation && screen.orientation.lock && screen.orientation.lock("landscape").catch(() => {}); }catch(_e){} }).catch(() => toast("このブラウザでは 全画面に できません。"));
    }catch(_e){ toast("このブラウザでは 全画面に できません。"); }
}
// ---------------------------------------------------------------- チート
function viewCheat(){
    const on = G.S ? Object.keys(G.S.cx).filter((k) => G.S.cx[k] === true) : [];
    const names = {god:"無敵", onehit:"ワンパン", infmp:"MPむげん", areall:"ARE固定", noenc:"エンカなし", encx3:"エンカ3倍", speed:"2倍速", rainbow:"にじ", showpos:"座標", st999:"ステ999", allgate:"ゲート全開"};
    return '<div class="win panel sm"><h2>🔑 チートコード</h2><div class="meta">ひみつの コードを 入れてみよう。' + (G.S ? "" : "（いまは ストック：ゲームを はじめると 反映されます）") + '</div>' +
        '<input id="cInput" type="text" maxlength="40" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="コードを にゅうりょく" style="width:100%;margin:1cqw 0">' +
        '<div class="row"><button class="btn" data-a="cGo">けってい</button><button class="btn sub" data-a="cBack">もどる</button></div>' +
        '<div id="cMsg" style="white-space:pre-wrap;margin-top:1cqw;min-height:5cqw;color:' + (G.cheatOk ? "var(--ok)" : "#ffd1d1") + '">' + esc(G.cheatMsg || "") + '</div>' +
        (on.length ? '<div class="chips">' + on.map((k) => '<span class="chip">ON：' + esc(names[k] || k) + '</span>').join("") + '</div>' : "") +
        '<div class="meta">ヒント：コードは 開発者(ともひこ)だけが しっている。…でも、答えは 意外と たんじゅん。</div></div>';
}
ACT.cGo = () => {
    const v = ($("cInput") || {}).value || ""; if(!v.trim()) return;
    const r = tqApplyCheat(v); G.cheatMsg = r.msg; G.cheatOk = r.ok; if(r.ok) flash();
    if(r.ok && G.S && G.afterCheat === "end"){ G.afterCheat = null; G.mode = "map"; rpgEnding(); return; }
    render(); const i = $("cInput"); if(i){ i.value = ""; i.focus(); }
};
ACT.cBack = () => { if(G.cheatFrom === "menu"){ G.mode = "menu"; G.menuTab = "main"; } else G.mode = "title"; render(); };

// ---------------------------------------------------------------- 入力（キーボード・タッチ）
const KEYS = {ArrowUp:"up", w:"up", W:"up", ArrowDown:"down", s:"down", S:"down", ArrowLeft:"left", a:"left", A:"left", ArrowRight:"right", d:"right", D:"right", Enter:"ok", z:"ok", Z:"ok", " ":"ok", x:"cancel", X:"cancel", Escape:"cancel", Backspace:"cancel", m:"menu", M:"menu"};
function goBack(){
    const m = G.mode;
    if(G.dlg){ ACT.dlgno(); return; }
    if(m === "slots") (G.slotPick ? ACT.slotPickCancel : ACT.slotBack)();
    else if(m === "profile") ACT.pBack(); else if(m === "persona") ACT.qBack(); else if(m === "result") ACT.rBack();
    else if(m === "help") ACT.hBack(); else if(m === "settings") ACT.sBack(); else if(m === "cheat") ACT.cBack();
    else if(m === "menu") fieldMenuBack(); else if(m === "gate") ACT.gateclose && ACT.gateclose();
    else if(m === "map") openMenu(); else if(m === "battle" && G.b && G.b.menu !== "top") { ACT.bcmd("back"); }
}
function handleKey(k, e){
    const m = G.mode;
    if(G.grind && !G.dlg){ stopGrind(); return; }
    if(G.dlg){ if(k === "up" || k === "left") navMove(-1); else if(k === "down" || k === "right") navMove(1); else if(k === "ok") navOk(); else if(k === "cancel") goBack(); return; }
    if(m === "map"){
        if(k === "up" || k === "down" || k === "left" || k === "right") tryMove(k);
        else if(k === "ok") fieldAct(); else if(k === "cancel" || k === "menu") openMenu();
        return;
    }
    if(m === "talk"){ if(k === "ok"){ if(!finishTyping()) rpgNext(); } return; }
    if(m === "script" || m === "end" && false) return;
    if(m === "battle" && G.auto){ if(k === "cancel" || k === "ok") ACT.bauto(); return; }
    if(k === "up" || k === "left") navMove(-1); else if(k === "down" || k === "right") navMove(1); else if(k === "ok") navOk(); else if(k === "cancel" || k === "menu") goBack();
}
document.addEventListener("keydown", (e) => {
    const tg = e.target && e.target.tagName;
    if(tg === "INPUT" || tg === "SELECT" || tg === "TEXTAREA"){
        if(e.key === "Enter"){ e.preventDefault(); if(e.target.id === "cInput") ACT.cGo(); else if(G.dlg) ACT.dlgok(); else if(e.target.id === "rpgName2") ACT.renameok(); }
        else if(e.key === "Escape" && G.dlg) ACT.dlgno();
        return;
    }
    const k = KEYS[e.key]; if(!k) return;
    if(e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault(); handleKey(k, e);
});
document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-a]");
    if(a && !a.disabled){ const f = ACT[a.dataset.a]; if(f){ e.preventDefault(); f(a.dataset.v, a); } return; }
    if(e.target.closest("#msg") || e.target.id === "cv"){ if(G.mode === "talk"){ if(!finishTyping()) rpgNext(); } }
});
document.addEventListener("input", (e) => {
    if(e.target.id === "pMon" || e.target.id === "pDay") { keepDraft(); const z = tqZodiac(G.draft.month, G.draft.day); const el = $("zod"); if(el) el.innerHTML = zodHtml(z); }
});
document.addEventListener("change", (e) => {
    if(e.target.id === "pMon" || e.target.id === "pDay") { keepDraft(); const z = tqZodiac(G.draft.month, G.draft.day); const el = $("zod"); if(el) el.innerHTML = zodHtml(z); }
});
// タッチボタン（長おしで連続いどう）
(function(){
    let t = null;
    const stop = () => { clearInterval(t); t = null; };
    document.addEventListener("pointerdown", (e) => {
        const b = e.target.closest && e.target.closest("#pad button"); if(!b) return;
        e.preventDefault(); const k = b.dataset.k;
        const fire = () => { if(k === "ok") handleKey("ok"); else if(k === "menu") handleKey("menu"); else handleKey(k); };
        fire(); if(k !== "ok" && k !== "menu"){ stop(); t = setInterval(fire, 150); }
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((n) => document.addEventListener(n, stop));
})();
$("btnFs").addEventListener("click", toggleFullscreen);
$("btnBgm").addEventListener("click", () => { ACT.sBgm(); });
$("btnVoice").addEventListener("click", () => { G.set.voice = !G.set.voice; if(!G.set.voice) tqSpeakStop(); tqSettingsSave(); $("btnVoice").textContent = G.set.voice ? "声：オン" : "声：オフ"; });
$("rotOk").addEventListener("click", () => document.body.classList.remove("needrot"));
