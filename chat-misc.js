"use strict";
// ===== GIFを送る / 「要約して」ボタン / 気分・時間帯で変わるテーマ =====

feat.mood = {cfg:null, timer:null};
const MOOD_DEFAULT = {
    moodHoldHours:3,
    keywords:{sakura:["嬉しい", "楽しい", "ありがとう", "最高"], forest:["落ち着", "リラックス", "のんびり"], sunset:["疲れ", "さびしい", "寂しい"], standard:["眠い", "おやすみ"], light:["元気", "おはよう"]},
    time:{morning:{from:5, to:11, theme:"light", label:"朝"}, noon:{from:11, to:17, theme:"forest", label:"昼"}, evening:{from:17, to:21, theme:"sunset", label:"夕方"}, night:{from:21, to:5, theme:"standard", label:"夜"}}
};

function initMisc(){
    registerTool("mi", onMiscAction);
    // GIF
    const gifBtn = $("gifButton"), gifIn = $("gifInput");
    if(gifBtn && gifIn){
        gifBtn.addEventListener("click", () => gifIn.click());
        gifIn.addEventListener("change", () => {
            const files = [...gifIn.files].filter((f) => f.type === "image/gif" || /\.gif$/i.test(f.name));
            if(!files.length){ showToast("GIFファイルを選んでください。"); gifIn.value = ""; return; }
            gifIn.value = "";
            runTool(() => handleFiles(files, "image"));
        });
    }
    // 要約
    const sumBtn = $("summaryButton");
    if(sumBtn) sumBtn.addEventListener("click", () => runTool(() => openSummary(100)));
    // 気分テーマ
    addPayloadSentHook((payload) => { if(payload && payload.type === "text" && payload.text) moodFromText(payload.text); });
    loadMoodConfig().then(() => { applyAutoTheme(); }).catch(() => { feat.mood.cfg = MOOD_DEFAULT; applyAutoTheme(); });
    feat.mood.timer = setInterval(() => { if(!document.hidden) applyAutoTheme(); }, 5 * 60 * 1000);
    feat.timers && feat.timers.push(feat.mood.timer);
}

// ---------- 要約して ----------
function openSummary(limit){
    if(!state.currentRoom){ showToast("先にチャットを開いてください。"); return; }
    const all = textMessages(), msgs = limit ? all.slice(-limit) : all;
    let body;
    if(msgs.length < 3) body = '<div class="empty-list">要約するには、文字のメッセージが3件以上必要です。</div>';
    else{
        const kw = aiKeywords(msgs, 30), sum = aiSummary(msgs, kw), top = kw.slice(0, 8);
        body = '<div class="admin-card"><b>📝 要約（重要そうな文）</b>' + (sum.length ? '<ul>' + sum.map((s) => '<li>' + escapeHtml(s) + '</li>').join("") + '</ul>' : '<div class="meta">要約できる文が見つかりませんでした。</div>') + '</div>' +
            '<div class="admin-card"><b>🔑 よく出た言葉</b><div class="memo-chips">' + top.map(([w, n]) => '<span class="chip">' + escapeHtml(w) + ' ×' + n + '</span>').join("") + '</div></div>';
    }
    openSheet(toolHead("📝 要約して", escapeHtml(roomTitle(state.currentRoom)) + " の文字メッセージ " + msgs.length + " 件を、この端末の中だけで要約しました。あなただけに表示されます（相手には送られません）。ルールで抜き出すだけなので、精度は限定的です。") +
        '<div class="row" style="justify-content:flex-start"><button type="button" class="' + (limit === 30 ? "button" : "button-secondary") + '" data-t="mi:sum30">直近30件</button><button type="button" class="' + (limit === 100 ? "button" : "button-secondary") + '" data-t="mi:sum100">直近100件</button><button type="button" class="' + (!limit ? "button" : "button-secondary") + '" data-t="mi:sumall">読み込み済みすべて</button></div>' +
        body + '<div class="row"><button type="button" class="button-secondary" data-t="mi:ai">詳しい分析へ</button></div>' + toolClose());
}

// ---------- 気分テーマ ----------
async function loadMoodConfig(){
    const res = await fetch("./mood-theme.json", {cache:"no-cache"});
    if(!res.ok) throw new Error("mood-theme.json " + res.status);
    const cfg = await res.json();
    feat.mood.cfg = {moodHoldHours:Number(cfg.moodHoldHours) || 3, keywords:cfg.keywords && typeof cfg.keywords === "object" ? cfg.keywords : MOOD_DEFAULT.keywords, time:cfg.time && typeof cfg.time === "object" ? cfg.time : MOOD_DEFAULT.time};
}
function moodCfg(){ return feat.mood.cfg || MOOD_DEFAULT; }
function moodAutoOn(){ return prefGet("are_autotheme", "0") === "1"; }

function timeSlotTheme(date){
    const h = date.getHours() + date.getMinutes() / 60, slots = moodCfg().time;
    for(const key of Object.keys(slots)){
        const s = slots[key], from = Number(s.from), to = Number(s.to);
        const inSlot = from <= to ? (h >= from && h < to) : (h >= from || h < to);
        if(inSlot && THEMES[s.theme]) return {theme:s.theme, label:s.label || key};
    }
    return null;
}
function moodMatch(text){
    const kws = moodCfg().keywords, t = String(text || "").toLowerCase();
    let best = null;
    Object.keys(kws).forEach((theme) => {
        if(!THEMES[theme] || !Array.isArray(kws[theme])) return;
        kws[theme].forEach((w) => { if(w && t.includes(String(w).toLowerCase()) && (!best || String(w).length > best.word.length)) best = {theme, word:String(w)}; });
    });
    return best;
}
function moodFromText(text){
    if(!moodAutoOn()) return null;
    const hit = moodMatch(text);
    if(!hit) return null;
    prefSet("are_mood_theme", hit.theme + "|" + (Date.now() + moodCfg().moodHoldHours * 3600000));
    applyTheme(hit.theme);
    return hit;
}
function applyAutoTheme(){
    if(!moodAutoOn()) return;
    const held = (prefGet("are_mood_theme", "") || "").split("|");
    if(held[0] && THEMES[held[0]] && Number(held[1]) > Date.now()){ applyTheme(held[0]); return; }
    const slot = timeSlotTheme(new Date());
    if(slot) applyTheme(slot.theme);
}

function openMood(){
    const cfg = moodCfg(), on = moodAutoOn(), slot = timeSlotTheme(new Date());
    openSheet(toolHead("🎭 気分・時間帯でテーマを変える", "朝・昼・夕方・夜で自動的にテーマが変わります。気分を表す言葉を書くと、その言葉に合うテーマに切り替わります。この端末だけの設定です。") +
        '<label><input type="checkbox" data-t="mi:auto"' + (on ? " checked" : "") + '> 自動で切り替える</label>' +
        '<div class="meta">いまの時間帯：' + (slot ? escapeHtml(slot.label) + " → " + escapeHtml(THEMES[slot.theme].label) : "設定なし") + '</div>' +
        '<label for="moodText">いまの気分を一言（例：嬉しい／疲れた／のんびり）</label><input id="moodText" type="text" maxlength="40"><div class="row"><button type="button" class="button" data-t="mi:mood">この気分にする</button></div>' +
        '<div id="moodMsg" class="meta"></div>' +
        '<details class="meta"><summary>時間帯と言葉の設定（mood-theme.json）</summary><div>' + Object.keys(cfg.time).map((k) => escapeHtml(cfg.time[k].label || k) + '：' + cfg.time[k].from + '〜' + cfg.time[k].to + '時 → ' + escapeHtml((THEMES[cfg.time[k].theme] || {}).label || cfg.time[k].theme)).join("<br>") + '<hr class="sep">' +
        Object.keys(cfg.keywords).map((k) => escapeHtml((THEMES[k] || {}).label || k) + '：' + escapeHtml((cfg.keywords[k] || []).join("、"))).join("<br>") + '</div><div>言葉を足したいときは、mood-theme.json を書き換えて上書きアップロードします。</div></details>' + toolClose());
}

function onMiscAction(action, node){
    if(action === "sum30") return openSummary(30);
    if(action === "sum100") return openSummary(100);
    if(action === "sumall") return openSummary(0);
    if(action === "ai") return openAi();
    if(action === "auto"){
        prefSet("are_autotheme", node.checked ? "1" : "0");
        if(node.checked) applyAutoTheme();
        else applyTheme(prefGet("are_theme", "standard"));
        return;
    }
    if(action === "mood"){
        const text = ($("moodText").value || "").trim();
        if(!text){ showToast("気分を入力してください。"); return; }
        if(!moodAutoOn()){ prefSet("are_autotheme", "1"); }
        const hit = moodFromText(text);
        $("moodMsg").textContent = hit ? "「" + hit.word + "」に合わせて「" + THEMES[hit.theme].label + "」にしました（" + moodCfg().moodHoldHours + "時間）。" : "合う言葉が見つかりませんでした。下の一覧にある言葉を試してください。";
    }
}
