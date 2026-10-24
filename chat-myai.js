"use strict";
// ===== マイAI（自分専用・APIキー不要・完全無料）=====
// 外部のAI（Claude／ChatGPTなど）は使いません。この端末の中だけで、次の方法で「あなた専用」に育ちます。
//  ① おしえる：質問と答えを教えると、すぐ覚えます（言い回しが少し違っても、似ていれば答えます）。
//  ② 直す：答えが違うときは「違う」→正しい答えを教えると、その場で上書きします。👍で自信が上がります。
//  ③ 会話から学ぶ：あなたの過去のチャットから「相手がこう言ったら、自分はこう返した」を集めて、
//      返信の候補（💡）に「いつもの自分の返し」を出します。
//  ・覚えたことはこの端末のブラウザに保存します（サーバーには送りません）。「書き出し／読み込み」で別の端末にも移せます。
//  ・文章を生成するAIではありません。覚えた内容と似ている質問に、覚えた答えを返す仕組みです。

feat.myai = {name:"AIともぴー", facts:[], hist:[], smart:true, log:[], pending:null, builtin:null, learnedAt:0};
const MYAI_MAX_FACTS = 500, MYAI_MAX_HIST = 600;

function myaiKey(){ return "are_myai_" + (state.user ? state.user.id : "x"); }
function myaiLoad(){
    try{
        const d = JSON.parse(localStorage.getItem(myaiKey()) || "{}") || {};
        feat.myai.facts = Array.isArray(d.facts) ? d.facts.filter((f) => f && typeof f.q === "string" && typeof f.a === "string").slice(0, MYAI_MAX_FACTS) : [];
        feat.myai.hist = Array.isArray(d.hist) ? d.hist.filter((h) => h && typeof h.q === "string" && typeof h.a === "string").slice(0, MYAI_MAX_HIST) : [];
        feat.myai.smart = d.smart !== false;
        feat.myai.name = typeof d.name === "string" && d.name.trim() ? d.name.trim().slice(0, 20) : "AIともぴー";
        feat.myai.learnedAt = Number(d.learnedAt) || 0;
    }catch(_e){ /* 空から始める */ }
}
function myaiSave(){
    const m = feat.myai;
    try{ localStorage.setItem(myaiKey(), JSON.stringify({name:m.name, facts:m.facts, hist:m.hist, smart:m.smart, learnedAt:m.learnedAt})); }
    catch(_e){ showToast("保存できませんでした（ブラウザの保存容量がいっぱいかもしれません）。"); }
}

// ---------- ことばの似ている度（2文字ずつに区切って比べる）----------
function myaiNorm(text){
    return String(text || "").normalize("NFKC").toLowerCase()
        .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
        .replace(/[\s、。，．,.!！?？~〜ー\-…「」『』（）()【】\[\]・:：;；"'“”]/g, "");
}
function myaiGrams(text){
    const s = myaiNorm(text), set = new Map();
    if(!s) return set;
    if(s.length === 1){ set.set(s, 1); return set; }
    for(let i = 0; i < s.length - 1; i++){ const g = s.slice(i, i + 2); set.set(g, (set.get(g) || 0) + 1); }
    return set;
}
function myaiSim(a, b){
    if(!a.size || !b.size) return 0;
    let inter = 0, ta = 0, tb = 0;
    a.forEach((v, k) => { ta += v; if(b.has(k)) inter += Math.min(v, b.get(k)); });
    b.forEach((v) => { tb += v; });
    return 2 * inter / (ta + tb);
}
function myaiBest(list, query, minScore){
    const g = myaiGrams(query), nq = myaiNorm(query);
    let best = null, score = 0;
    list.forEach((item) => {
        let s = nq && myaiNorm(item.q) === nq ? 1 : myaiSim(g, myaiGrams(item.q));
        if(item.n) s *= 1 + 0.08 * Math.min(item.n, 5);
        if(s > score){ score = s; best = item; }
    });
    return best && score >= minScore ? {item:best, score:Math.min(score, 1)} : null;
}

// ---------- 返事を決める ----------
async function myaiBuiltin(){
    const m = feat.myai;
    if(m.builtin) return m.builtin;
    m.builtin = [];
    try{
        const r = await fetch("./QA.json");
        if(r.ok){
            const j = await r.json();
            (Array.isArray(j) ? j : []).forEach((x) => { if(x && typeof x.answer === "string" && Array.isArray(x.keywords)) m.builtin.push({keys:x.keywords.map(String), a:x.answer}); });
        }
    }catch(_e){ /* なくても動く */ }
    return m.builtin;
}

async function myaiAnswer(question){
    const m = feat.myai;
    const hit = myaiBest(m.facts, question, 0.5);
    if(hit) return {kind:"fact", fact:hit.item, text:hit.item.a, score:hit.score};
    const nq = myaiNorm(question);
    const built = (await myaiBuiltin()).find((b) => b.keys.some((k) => { const nk = myaiNorm(k); return nk.length >= 3 && (nq.includes(nk) || myaiSim(myaiGrams(k), myaiGrams(question)) >= 0.7); }));
    if(built) return {kind:"builtin", text:built.a, score:0.7};
    const past = myaiBest(m.hist, question, 0.55);
    if(past) return {kind:"hist", text:past.item.a, score:past.score};
    return null;
}

/** 返信の候補（💡）に足す「いつもの自分の返し」 */
function myaiSuggest(text, k){
    const m = feat.myai;
    if(!m.smart || !m.hist.length) return [];
    const g = myaiGrams(text), scored = m.hist.map((h) => ({a:h.a, s:myaiSim(g, myaiGrams(h.q))})).filter((x) => x.s >= 0.5).sort((x, y) => y.s - x.s);
    const out = [];
    scored.forEach((x) => { if(out.length < k && !out.includes(x.a)) out.push(x.a); });
    return out;
}

// ---------- 覚える ----------
function myaiLearn(q, a, target){
    const m = feat.myai;
    q = String(q).trim().slice(0, 100); a = String(a).trim().slice(0, 500);
    if(!q || !a) return false;
    const same = target ? {item:target} : myaiBest(m.facts, q, 0.85);
    if(same){ same.item.a = a; same.item.t = Date.now(); same.item.n = 0; }
    else{
        if(m.facts.length >= MYAI_MAX_FACTS){ showToast("覚えられる数（" + MYAI_MAX_FACTS + "件）がいっぱいです。いらないものを忘れさせてください。"); return false; }
        m.facts.unshift({id:"f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), q, a, n:0, t:Date.now()});
    }
    myaiSave();
    return true;
}
/** 「Q＝A」「QはAと覚えて」の形なら、取り出す */
function myaiParseTeach(text){
    const t = text.trim();
    let m = t.match(/^(.{1,100}?)\s*(?:＝|=|→|->|⇒)\s*(.{1,500})$/s);
    if(m) return [m[1], m[2]];
    m = t.match(/^(.{1,100}?)は[、,]?\s*(.{1,500}?)(?:だよ|です|だって|と|って)?(?:覚えて|おぼえて|おしえとく|教えとく)[。.!！]*$/s);
    return m ? [m[1], m[2]] : null;
}

// ---------- 会話から学ぶ ----------
async function myaiLearnHistory(){
    const rooms = state.rooms || [];
    if(!rooms.length) return {pairs:0, scanned:0};
    const r = await requireClient().from(TABLES.messages).select("room_id,sender_id,content,created_at").in("room_id", rooms.map((x) => x.id)).order("created_at", {ascending:false}).limit(2000);
    if(r.error) throw r.error;
    const byRoom = new Map();
    (r.data || []).forEach((x) => { if(!byRoom.has(x.room_id)) byRoom.set(x.room_id, []); byRoom.get(x.room_id).push(x); });
    const pairs = [], seen = new Set();
    byRoom.forEach((list) => {
        list.sort((a, b) => a.created_at < b.created_at ? -1 : 1);
        for(let i = 0; i + 1 < list.length; i++){
            const a = list[i], b = list[i + 1];
            if(a.sender_id === state.user.id || b.sender_id !== state.user.id) continue;
            if(new Date(b.created_at) - new Date(a.created_at) > 6 * 3600000) continue;
            const qa = parseMessageContent(a.content), ab = parseMessageContent(b.content);
            if(qa.type !== "text" || ab.type !== "text") continue;
            const q = (qa.text || "").trim(), ans = (ab.text || "").trim();
            if(q.length < 2 || q.length > 80 || ans.length < 1 || ans.length > 60) continue;
            const key = myaiNorm(q) + "|" + myaiNorm(ans);
            if(seen.has(key)) continue;
            seen.add(key); pairs.push({q, a:ans, t:b.created_at});
        }
    });
    pairs.sort((x, y) => x.t < y.t ? 1 : -1);
    feat.myai.hist = pairs.slice(0, MYAI_MAX_HIST).map((p) => ({q:p.q, a:p.a}));
    feat.myai.learnedAt = Date.now();
    myaiSave();
    return {pairs:feat.myai.hist.length, scanned:(r.data || []).length};
}

// ---------- 画面 ----------
function initMyAi(){
    registerTool("myai", onMyAiAction);
    myaiLoad();
    setTimeout(myaiRelabel, 0);
    // スマート返信に「いつもの自分の返し」を足す
    if(typeof smartCandidates === "function"){
        const orig = smartCandidates;
        smartCandidates = function(text){
            let mine = [];
            try{ mine = myaiSuggest(text, 2); }catch(_e){ /* 続行 */ }
            const rest = orig(text).filter((x) => !mine.includes(x));
            return mine.concat(rest).slice(0, 5);
        };
    }
}

/** 「その他」のカードの名前を、いまの名前にそろえる */
function myaiRelabel(){
    const b = document.querySelector('[data-tool="myai"]');
    if(b && b.firstChild && b.firstChild.nodeType === 3) b.firstChild.textContent = "🧠 " + feat.myai.name + " ";
}

function openMyAi(){
    const m = feat.myai;
    m.log = [{who:"ai", text:"こんにちは！私は" + m.name + "です。あなた専用のAIです。質問してみてください。知らないことは、教えてもらえれば覚えます（「質問＝答え」の形で送ってもOK）。"}];
    m.pending = null;
    openSheet(toolHead("🧠 " + escapeHtml(m.name), "あなた専用のAIです。外部のAIは使わず、この端末の中だけで動きます。覚えた内容はこの端末にだけ保存されます。") +
        '<div class="row" style="justify-content:flex-start"><input id="maName" type="text" maxlength="20" value="' + escapeHtml(m.name) + '" aria-label="AIの名前" style="flex:1"><button type="button" class="button-secondary" data-t="myai:rename">名前を変える</button></div>' +
        '<div id="maLog" class="ma-log"></div>' +
        '<div class="row"><input id="maInput" type="text" maxlength="200" placeholder="質問、または「質問＝答え」で教える" style="flex:1"><button type="button" class="button" data-t="myai:ask">送る</button></div>' +
        '<div id="maSide"></div>' + toolClose());
    maPaint();
    const input = $("maInput");
    if(input) input.addEventListener("keydown", (e) => { if(e.key === "Enter" && !e.isComposing){ e.preventDefault(); runTool(() => onMyAiAction("ask")); } });
}

function maPaint(){
    const m = feat.myai, log = $("maLog"), side = $("maSide");
    if(!log || !side) return;
    log.innerHTML = m.log.map((x, i) => '<div class="ma-msg ' + x.who + '"><span>' + escapeHtml(x.text) + '</span>' + (x.note ? '<small class="meta">' + escapeHtml(x.note) + '</small>' : "") +
        (x.who === "ai" && x.fact !== undefined && i === m.log.length - 1 && !m.pending ? '<div class="row" style="justify-content:flex-start"><button type="button" class="button-secondary" data-t="myai:good">👍 合ってる</button><button type="button" class="button-secondary" data-t="myai:wrong">✏️ 違う（教える）</button></div>' : "") + '</div>').join("");
    log.scrollTop = log.scrollHeight;
    const teach = m.pending ? '<div class="admin-card"><b>「' + escapeHtml(m.pending.q) + '」の正しい答えを教えてください</b><input id="maTeach" type="text" maxlength="500" placeholder="答え"><div class="row"><button type="button" class="button" data-t="myai:save">覚える</button><button type="button" class="button-secondary" data-t="myai:cancel">やめる</button></div></div>' : "";
    side.innerHTML = teach + '<hr class="sep"><b>覚えていること（' + m.facts.length + '件）</b>' +
        (m.facts.length ? m.facts.slice(0, 30).map((f) => '<div class="admin-card"><b>' + escapeHtml(f.q) + '</b><div>' + escapeHtml(f.a) + '</div><div class="row" style="justify-content:flex-start"><button type="button" class="button-secondary" data-t="myai:forget" data-id="' + escapeHtml(f.id) + '">忘れさせる</button></div></div>').join("") + (m.facts.length > 30 ? '<div class="meta">ほか' + (m.facts.length - 30) + '件</div>' : "") : '<div class="meta">まだありません。</div>') +
        '<hr class="sep"><b>会話から学ぶ</b><div class="meta">あなたの過去のチャットから「相手がこう言ったら、自分はこう返した」を集めます（' + m.hist.length + '組を記憶中' + (m.learnedAt ? "・最終 " + new Date(m.learnedAt).toLocaleString("ja-JP") : "") + '）。この端末の中だけで処理します。</div>' +
        '<div class="row"><button type="button" class="button-secondary" data-t="myai:history">会話から学ぶ</button><button type="button" class="button-secondary" data-t="myai:smart">返信候補に使う：' + (m.smart ? "オン" : "オフ") + '</button></div>' +
        '<hr class="sep"><b>書き出し／読み込み</b><textarea id="maIo" rows="3" placeholder="書き出すとここに表示。読み込むときはここに貼り付け"></textarea><div class="row"><button type="button" class="button-secondary" data-t="myai:export">書き出す</button><button type="button" class="button-secondary" data-t="myai:import">読み込む（追加）</button></div>';
    const t = $("maTeach"); if(t) t.focus();
}

async function onMyAiAction(action, node){
    const m = feat.myai;
    try{
        if(action === "ask"){
            const input = $("maInput"), text = (input.value || "").trim();
            if(!text) return;
            input.value = "";
            m.log.push({who:"me", text});
            const teach = myaiParseTeach(text);
            if(teach){
                m.log.push({who:"ai", text: myaiLearn(teach[0], teach[1]) ? "覚えました！「" + teach[0].trim() + "」と聞かれたら「" + teach[1].trim() + "」と答えます。" : "覚えられませんでした。"});
            }else{
                const ans = await myaiAnswer(text);
                m.last = {q:text, ans};
                if(ans) m.log.push({who:"ai", text:ans.text, fact:ans.fact || null, note:(ans.kind === "fact" ? "覚えたこと" : ans.kind === "hist" ? "過去の自分の返事から" : "かんたんQ&A") + "・似ている度 " + Math.round(ans.score * 100) + "%"});
                else{ m.pending = {q:text}; m.log.push({who:"ai", text:"まだ知りません。教えてもらえますか？"}); }
            }
        }else if(action === "good"){
            if(m.last && m.last.ans && m.last.ans.fact){ m.last.ans.fact.n = (m.last.ans.fact.n || 0) + 1; myaiSave(); }
            else if(m.last && m.last.ans){ myaiLearn(m.last.q, m.last.ans.text); }
            m.log.push({who:"ai", text:"ありがとう！自信がつきました👍"});
            if(m.log.length) m.log[m.log.length - 2].fact = undefined;
        }else if(action === "wrong"){
            if(m.last) m.pending = {q:m.last.q, fact:(m.last.ans && m.last.ans.fact) || null};
            if(m.log.length) m.log[m.log.length - 1].fact = undefined;
        }else if(action === "save"){
            const a = ($("maTeach").value || "").trim();
            if(!a){ showToast("答えを入力してください。"); return; }
            if(myaiLearn(m.pending.q, a, m.pending.fact)){ m.log.push({who:"ai", text:"覚えました！次から「" + m.pending.q + "」には「" + a + "」と答えます。"}); m.pending = null; }
        }else if(action === "cancel"){ m.pending = null; }
        else if(action === "rename"){
            const n = ($("maName").value || "").trim().slice(0, 20);
            if(!n){ showToast("名前を入力してください。"); return; }
            m.name = n; myaiSave(); myaiRelabel();
            m.log.push({who:"ai", text:"これからは「" + n + "」と呼んでください！"});
            const h = document.querySelector("#profileSheet h3"); if(h) h.textContent = "🧠 " + n;
        }else if(action === "forget"){
            m.facts = m.facts.filter((f) => f.id !== node.dataset.id); myaiSave();
        }else if(action === "smart"){ m.smart = !m.smart; myaiSave(); }
        else if(action === "history"){
            showToast("会話を読んでいます...");
            const r = await myaiLearnHistory();
            showToast(r.pairs + "組を覚えました（" + r.scanned + "件のメッセージを確認）。");
        }else if(action === "export"){
            $("maIo").value = JSON.stringify({v:1, facts:m.facts.map((f) => ({q:f.q, a:f.a, n:f.n || 0}))});
            $("maIo").select();
            return;
        }else if(action === "import"){
            const j = JSON.parse(($("maIo").value || "").trim());
            const list = Array.isArray(j) ? j : (j && j.facts);
            if(!Array.isArray(list)) throw new Error("形式が違います。");
            let c = 0; list.forEach((f) => { if(f && typeof f.q === "string" && typeof f.a === "string" && myaiLearn(f.q, f.a)) c++; });
            showToast(c + "件を覚えました。");
        }
    }catch(error){ console.error("[myai]", error); showToast(featError ? featError(error) : "うまくいきませんでした。"); }
    maPaint();
}
