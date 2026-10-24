"use strict";
// ===== かんたん会話分析・スマート返信・音声入力・翻訳（すべて端末の中のルールで動きます）=====
// ・会話分析（要約／キーワード／感情／分類）：開いているチャットの「文字メッセージ」だけを、この端末の中で調べます。外部には送りません。
//   精度は限定的です（ことばの出現数とかんたんな辞書によるものです）。
// ・スマート返信：相手の最新メッセージに合わせて、返信の候補（ボタン）を出すだけです。押すと入力欄に入り、自動送信はしません。
// ・音声入力：ブラウザの音声認識を使います（Chrome・Edge・Safari など）。ブラウザの提供元に音声が送られる場合があります。
// ・翻訳：Chrome 138以降のパソコンなど、ブラウザ内蔵の翻訳機能がある場合のみ使えます（外部サービスは使いません）。

const AI_STOP = new Set(("の,に,は,を,た,が,で,て,と,し,れ,さ,ある,いる,も,する,から,な,こと,として,い,や,れる,など,なっ,ない,この,ため,その,あっ,よう,また,もの,という,あり,まで,られ,なる,へ,か,だ,これ,によって,により,おり,より,による,ず,なり,られる,において,ば,なかっ,なく,しかし,について,せ,だっ,その後,できる,それ,う,ので,なお,のみ,でき,き,つ,における,および,いう,さらに,でも,ら,たり,その他,に関する,たち,ます,ん,なら,に対して,特に,せる,及び,これら,とき,では,にて,ほか,ながら,うち,そして,とともに,ただし,かつて,それぞれ,または,お,ほど,ものの,に対する,ほとんど,と共に,といった,です,とも,ところ,ここ,ね,よ,わ,ー,っ,ちゃ,けど,でも,じゃ,だけ,ので,から,ました,でした,ですが,ください,して,した,しました,思い,思う,今日,あと,ちょっと,ありがとう,はい,うん,ええ,そう,どう,何,いつ,どこ,誰,私,僕,俺,あなた,みんな").split(","));

const AI_POS = ["ありがとう", "嬉しい", "うれしい", "楽しい", "たのしい", "最高", "好き", "すき", "よかった", "良かった", "素敵", "すてき", "おめでとう", "感謝", "やった", "幸せ", "しあわせ", "面白い", "おもしろい", "助かる", "助かった", "ワクワク", "わくわく", "いいね", "さすが", "完璧", "かわいい", "可愛い", "😊", "😄", "😂", "🤣", "❤", "👍", "🎉", "✨", "😍", "🥰", "笑", "www", "草"];
const AI_NEG = ["悲しい", "かなしい", "つらい", "辛い", "疲れ", "最悪", "嫌", "いや", "無理", "ごめん", "すみません", "不安", "心配", "怒", "むかつく", "ムカつく", "困った", "困る", "痛い", "しんどい", "だるい", "さみしい", "寂しい", "残念", "失敗", "ミス", "遅れ", "遅刻", "ダメ", "だめ", "😢", "😭", "😡", "😞", "💦", "😱", "泣"];
const AI_CATS = [
    ["📅 予定・約束", ["明日", "今日", "来週", "今週", "集合", "会う", "予定", "何時", "時に", "日に", "曜日", "待ち合わせ", "空いて", "行こう", "行く"]],
    ["❓ 質問", ["？", "?", "ですか", "でしょうか", "かな", "ますか", "教えて", "どう"]],
    ["🙏 お礼・あいさつ", ["ありがとう", "感謝", "おはよう", "こんにちは", "こんばんは", "お疲れ", "よろしく", "おやすみ", "ごめん", "すみません"]],
    ["💼 仕事・勉強", ["課題", "宿題", "テスト", "試験", "会議", "資料", "提出", "締切", "締め切り", "授業", "仕事", "バイト", "レポート", "勉強"]],
    ["🍜 食事", ["ご飯", "ごはん", "ランチ", "ディナー", "食べ", "ラーメン", "カフェ", "飲み", "お腹", "おなか", "朝食", "夕食"]],
    ["💴 お金", ["円", "払", "割り勘", "支払", "お金", "代金", "料金", "予算"]]
];

feat.ai = {rec:null, recording:false, smart:true};

function initAi(){
    registerTool("ai", onAiAction);
    try{ feat.ai.smart = localStorage.getItem("are_smart") !== "0"; }catch(_e){}
    addRenderHook(showSmartReplies);
    addRoomHook(() => clearSmartReplies());
    addMsgTool({id:"translate", icon:"🌐", label:"翻訳", when:(message, item) => item.type === "text" && !!(item.text || "").trim(), run:(message, item) => translateMessage(item)});
    const mic = $("dictateButton");
    if(mic) mic.addEventListener("click", () => runTool(toggleDictation));
    el.messages.addEventListener("click", (event) => {
        const chip = event.target.closest("[data-sr]");
        if(!chip) return;
        el.messageInput.value = (el.messageInput.value ? el.messageInput.value + " " : "") + chip.dataset.sr;
        updateCharCount();
        el.messageInput.focus();
    });
}

// ----- 会話分析 -----

function textMessages(){
    return state.messages.map((m) => ({m, item:parseMessageContent(m.content)})).filter((x) => x.item.type === "text" && (x.item.text || "").trim()).map((x) => ({id:x.m.id, sender:x.m.sender_id, at:x.m.created_at, text:String(x.item.text)}));
}

function aiTokens(text){
    const words = [];
    const clean = text.replace(/https?:\/\/\S+/g, " ").replace(/[@＠]\S+/g, " ");
    if(typeof Intl !== "undefined" && Intl.Segmenter){
        const seg = new Intl.Segmenter("ja", {granularity:"word"});
        for(const part of seg.segment(clean)) if(part.isWordLike) words.push(part.segment);
    }else{
        (clean.match(/[一-鿿]{2,}|[゠-ヿ]{2,}|[A-Za-z][A-Za-z0-9'-]{2,}/g) || []).forEach((w) => words.push(w));
    }
    return words.map((w) => w.toLowerCase()).filter((w) => w.length >= 2 && !AI_STOP.has(w) && !/^[0-9０-９]+$/.test(w) && !/^[ぁ-ん]{1,2}$/.test(w));
}

function aiKeywords(msgs, limit){
    const freq = new Map();
    msgs.forEach((x) => aiTokens(x.text).forEach((w) => freq.set(w, (freq.get(w) || 0) + 1)));
    return [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, limit);
}

function aiSummary(msgs, keywords){
    const score = new Map(keywords.map(([w, n]) => [w, n]));
    const sentences = [];
    msgs.forEach((x) => x.text.split(/(?<=[。！？!?\n])/).map((s) => s.trim()).filter((s) => s.length >= 6).forEach((s, i) => sentences.push({s, at:x.at, i, base:aiTokens(s).reduce((a, w) => a + (score.get(w) || 0), 0)})));
    const ranked = sentences.map((x, k) => ({...x, k, v:x.base / Math.sqrt(x.s.length)})).sort((a, b) => b.v - a.v).slice(0, 3).sort((a, b) => a.k - b.k);
    return ranked.filter((x) => x.base > 0).map((x) => x.s.slice(0, 80));
}

function aiSentiment(msgs){
    const per = new Map();
    msgs.forEach((x) => {
        const t = x.text.toLowerCase();
        let pos = 0, neg = 0;
        AI_POS.forEach((w) => { if(t.includes(w.toLowerCase())) pos++; });
        AI_NEG.forEach((w) => { if(t.includes(w.toLowerCase())) neg++; });
        const cur = per.get(x.sender) || {pos:0, neg:0, n:0};
        cur.pos += pos; cur.neg += neg; cur.n++;
        per.set(x.sender, cur);
    });
    return per;
}

function sentimentLabel(p){
    const v = p.pos - p.neg;
    if(p.pos + p.neg === 0) return {text:"ふつう 😐", pct:50};
    const pct = Math.round(50 + 50 * v / Math.max(1, p.pos + p.neg));
    return {text:v > 0 ? "ポジティブ 😊" : v < 0 ? "ネガティブ 😟" : "ふつう 😐", pct};
}

function aiClassify(msgs){
    return AI_CATS.map(([name, words]) => [name, msgs.filter((x) => words.some((w) => x.text.includes(w))).length]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]);
}

function openAi(){
    if(!state.currentRoom){ showToast("分析するチャットを、先に開いてください。"); return; }
    const msgs = textMessages().slice(-300);
    if(msgs.length < 3){ openSheet(toolHead("🤖 会話の分析（かんたん）") + '<div class="empty-list">分析するには、文字のメッセージが3件以上必要です。</div>' + toolClose()); return; }
    const keywords = aiKeywords(msgs, 10), summary = aiSummary(msgs, aiKeywords(msgs, 30)), sent = aiSentiment(msgs), cats = aiClassify(msgs);
    const who = (id) => id === state.user.id ? "あなた" : profileDisplayName(feat.known.get(id) || (state.currentPartner && state.currentPartner.id === id ? state.currentPartner : null));
    const hours = new Array(24).fill(0);
    msgs.forEach((x) => { hours[new Date(x.at).getHours()]++; });
    const busy = hours.indexOf(Math.max(...hours));
    const total = [...sent.values()].reduce((a, p) => ({pos:a.pos + p.pos, neg:a.neg + p.neg, n:a.n + p.n}), {pos:0, neg:0, n:0});
    const all = sentimentLabel(total);
    openSheet(toolHead("🤖 会話の分析（かんたん）", escapeHtml(roomTitle(state.currentRoom)) + " の直近の文字メッセージ " + msgs.length + " 件を、この端末の中だけで調べました（外部には送りません）。精度は限定的です。") +
        '<div class="admin-card"><b>📝 要約（重要そうな文）</b>' + (summary.length ? '<ul>' + summary.map((s) => '<li>' + escapeHtml(s) + '</li>').join("") + '</ul>' : '<div class="meta">要約できる文が見つかりませんでした。</div>') + '</div>' +
        '<div class="admin-card"><b>🔑 キーワード</b><div class="memo-chips">' + (keywords.length ? keywords.map(([w, n]) => '<span class="chip">' + escapeHtml(w) + ' ×' + n + '</span>').join("") : '<span class="meta">見つかりませんでした。</span>') + '</div></div>' +
        '<div class="admin-card"><b>💗 感情（文章からの簡易判定）</b><div>全体：' + all.text + '</div><div class="ai-meter"><i style="width:' + all.pct + '%"></i></div>' +
        [...sent.entries()].map(([id, p]) => '<div class="meta">' + escapeHtml(who(id)) + '：' + sentimentLabel(p).text + '（' + p.n + '件）</div>').join("") + '</div>' +
        '<div class="admin-card"><b>🏷️ 分類</b>' + (cats.length ? '<ul>' + cats.map(([n, c]) => '<li>' + escapeHtml(n) + '：' + c + '件</li>').join("") + '</ul>' : '<div class="meta">当てはまる分類がありません。</div>') + '</div>' +
        '<div class="admin-card meta">いちばん話している時間帯：' + busy + '時台（' + hours[busy] + '件）</div>' + toolClose());
}

function onAiAction(action, node){
    if(action === "smart"){ feat.ai.smart = node.checked; try{ localStorage.setItem("are_smart", node.checked ? "1" : "0"); }catch(_e){} if(!node.checked) clearSmartReplies(); else showSmartReplies(); }
}

// ----- スマート返信（ルールベース）-----

function smartCandidates(text){
    const t = text.trim();
    if(/(ありがとう|感謝|助かった|助かりました)/.test(t)) return ["どういたしまして😊", "いえいえ！", "こちらこそ！"];
    if(/(ごめん|すみません|申し訳)/.test(t)) return ["大丈夫だよ", "気にしないで😊", "ありがとう、了解！"];
    if(/(おはよう)/.test(t)) return ["おはよう！", "おはようございます😊"];
    if(/(おやすみ)/.test(t)) return ["おやすみなさい🌙", "おやすみ！また明日"];
    if(/(お疲れ|おつかれ)/.test(t)) return ["お疲れさま！", "お疲れさまです😊"];
    if(/(何時|いつ|どこ|集合|待ち合わせ|会える|空いて)/.test(t)) return ["了解です！", "ちょっと確認します", "大丈夫です👍"];
    if(/[？?]\s*$|ですか|でしょうか|かな[？?]?$|ますか/.test(t)) return ["はい！", "いいえ、大丈夫です", "ちょっと考えます"];
    if(/(おめでとう|やった|嬉しい|楽しい|最高)/.test(t)) return ["おめでとう🎉", "よかったね！", "すごい！"];
    if(/(つらい|疲れ|しんどい|悲しい|不安)/.test(t)) return ["大丈夫？無理しないでね", "話聞くよ", "ゆっくり休んでね"];
    return ["了解です", "なるほど！", "ありがとう😊"];
}

function clearSmartReplies(){
    const old = document.getElementById("smartReply");
    if(old) old.remove();
}

function showSmartReplies(){
    clearSmartReplies();
    if(!feat.ai.smart || !state.currentRoom) return;
    const last = state.messages[state.messages.length - 1];
    if(!last || last.sender_id === state.user.id) return;
    if(Date.now() - new Date(last.created_at).getTime() > 3600000) return;
    const item = parseMessageContent(last.content);
    if(item.type !== "text" || !(item.text || "").trim()) return;
    const box = document.createElement("div");
    box.id = "smartReply"; box.className = "smart-reply";
    box.innerHTML = '<span class="meta">💡 返信の候補：</span>' + smartCandidates(item.text).map((t) => '<button type="button" class="chip-btn" data-sr="' + escapeHtml(t) + '">' + escapeHtml(t) + '</button>').join("");
    el.messages.appendChild(box);
}

// ----- 音声入力 -----

function toggleDictation(){
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!Recognition){ showToast("このブラウザは音声入力に対応していません（Chrome・Edge・Safariなどで使えます）。"); return; }
    if(!state.currentRoom){ showToast("先にチャットを開いてください。"); return; }
    const button = $("dictateButton");
    if(feat.ai.recording && feat.ai.rec){ feat.ai.rec.stop(); return; }
    const rec = new Recognition();
    rec.lang = prefGet("are_lang", "ja") === "en" ? "en-US" : "ja-JP";
    rec.interimResults = true; rec.continuous = false;
    const base = el.messageInput.value;
    let finalText = "";
    rec.onresult = (event) => {
        let interim = "";
        for(let i = event.resultIndex; i < event.results.length; i++){
            const r = event.results[i];
            if(r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
        }
        el.messageInput.value = (base ? base + " " : "") + finalText + interim;
        updateCharCount();
    };
    rec.onerror = (event) => {
        const msg = event.error === "not-allowed" || event.error === "service-not-allowed" ? "マイクの利用が許可されていません。ブラウザの設定で許可してください。" : event.error === "no-speech" ? "声が聞き取れませんでした。" : "音声入力でエラーが起きました。";
        showToast(msg);
    };
    rec.onend = () => { feat.ai.recording = false; feat.ai.rec = null; if(button){ button.classList.remove("on"); button.textContent = "🎙️ 音声入力"; } };
    try{ rec.start(); feat.ai.rec = rec; feat.ai.recording = true; if(button){ button.classList.add("on"); button.textContent = "⏹ 入力を止める"; } showToast("話してください。止めるときはもう一度ボタンを押します。"); }
    catch(_e){ showToast("音声入力を開始できませんでした。"); }
}

// ----- 翻訳（ブラウザ内蔵の翻訳機能がある場合のみ）-----

async function translateMessage(item){
    const text = String(item.text || "").trim().slice(0, 1000);
    if(!("Translator" in self)){
        openSheet(toolHead("🌐 翻訳") + '<div class="empty-list">このブラウザには、内蔵の翻訳機能がありません。Chrome 138以降のパソコン版などで使えます。（外部の翻訳サービスには送らない設計のため、非対応のブラウザでは使えません）</div>' + toolClose());
        return;
    }
    openSheet(toolHead("🌐 翻訳") + '<div class="meta">原文</div><div class="admin-card">' + escapeHtml(text) + '</div><div id="trOut" class="empty-list">翻訳しています...（初回は言語データの準備に時間がかかることがあります）</div>' + toolClose());
    try{
        let source = /[぀-ヿ一-鿿]/.test(text) ? "ja" : "en";
        if("LanguageDetector" in self){
            try{ const det = await self.LanguageDetector.create(); const res = await det.detect(text); if(res && res[0] && res[0].confidence > 0.5) source = res[0].detectedLanguage; }catch(_e){}
        }
        const wanted = prefGet("are_lang", "ja") === "en" ? "en" : "ja";
        const target = source === wanted ? (wanted === "ja" ? "en" : "ja") : wanted;
        const avail = await self.Translator.availability({sourceLanguage:source, targetLanguage:target});
        if(avail === "unavailable"){ if($("trOut")) $("trOut").textContent = "この言語の組み合わせ（" + source + " → " + target + "）は翻訳できません。"; return; }
        const translator = await self.Translator.create({sourceLanguage:source, targetLanguage:target});
        const out = await translator.translate(text);
        if($("trOut")) $("trOut").innerHTML = '<div class="meta">' + escapeHtml(source) + ' → ' + escapeHtml(target) + '</div><div class="admin-card">' + escapeHtml(out) + '</div>';
    }catch(error){ if($("trOut")) $("trOut").textContent = "翻訳できませんでした：" + String(error && error.message || error).slice(0, 100); }
}
