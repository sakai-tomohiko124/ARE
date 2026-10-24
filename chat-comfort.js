"use strict";
// ===== 使いやすさの追加（下書き・定型文・見やすさ・読み上げ・ジャンプ・スター・フォルダ整理）=====
// ・下書き / 定型文 / 文字サイズ / フォルダ分けは、この端末のブラウザにだけ保存します（サーバーは使いません）。
// ・スター付きメッセージだけは、別の端末でも見られるようにサーバー（starred_messages）に保存します。
// ・読み上げは、ブラウザに入っている音声（無料・通信なし）を使います。

const cf = {drafts:{}, room:null, saveT:null, phrases:[], a11y:{size:0, hc:false, rate:1}, stars:new Map(), snap:{}, folders:{list:[], map:{}, pins:[], sort:"recent", filter:"all"}, speakId:null, bar:null};
const CF_PHRASES = ["了解です", "ありがとうございます", "少し待ってください", "あとで連絡します", "お疲れさまです", "今どこ？"];
const CF_SIZES = ["ふつう", "大", "特大", "最大"];

function cfKey(n){ return "are_" + n + "_" + (state.user ? state.user.id : "x"); }
function cfRead(n, fallback){ try{ const v = JSON.parse(localStorage.getItem(cfKey(n))); return v == null ? fallback : v; }catch(_e){ return fallback; } }
function cfWrite(n, v){ try{ localStorage.setItem(cfKey(n), JSON.stringify(v)); return true; }catch(_e){ showToast("この端末に保存できませんでした。"); return false; } }

// ---------- 下書き ----------
function cfDraftSave(roomId){
    if(!roomId) return;
    const t = String(el.messageInput.value || "").slice(0, 2000);
    if(t.trim()) cf.drafts[roomId] = t; else delete cf.drafts[roomId];
    const ids = Object.keys(cf.drafts);
    if(ids.length > 50) delete cf.drafts[ids[0]];
    cfWrite("drafts", cf.drafts);
}
function initDrafts(){
    cf.drafts = cfRead("drafts", {}) || {};
    el.messageInput.addEventListener("input", () => {
        clearTimeout(cf.saveT);
        const id = cf.room;
        cf.saveT = setTimeout(() => { cfDraftSave(id); cfPaintRooms(); }, 400);
    });
    addRoomHook((room) => {
        clearTimeout(cf.saveT);
        const next = room ? room.id : null;
        if(next === cf.room){ cfPaintRooms(); return; }       // 同じチャットを開き直しただけなら、入力中の文字はそのまま
        if(cf.room) cfDraftSave(cf.room);                      // 前のチャットの下書きを保存
        cf.room = next;
        if(room) el.messageInput.value = cf.drafts[room.id] || "";
        try{ if(typeof updateCharCount === "function") updateCharCount(); }catch(_e){}
        cfPaintRooms();
    });
    addPayloadSentHook((p) => {
        if(p && p.type === "text" && cf.room){ delete cf.drafts[cf.room]; cfWrite("drafts", cf.drafts); cfPaintRooms(); }
    });
    document.addEventListener("visibilitychange", () => { if(document.hidden) cfDraftSave(cf.room); });
    window.addEventListener("pagehide", () => cfDraftSave(cf.room));
}

// ---------- 定型文 ----------
function phrasesLoad(){
    const v = cfRead("phrases", null);
    cf.phrases = Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, 20).map((x) => x.slice(0, 60)) : CF_PHRASES.slice();
}
function phrasesSave(){ return cfWrite("phrases", cf.phrases); }

function initPhrases(){
    registerTool("phr", onPhraseAction);
    phrasesLoad();
    const tools = document.querySelector(".composer-tools");
    if(!tools) throw new Error("入力欄のボタン置き場が見つかりません。");
    const b = document.createElement("button");
    b.type = "button"; b.className = "tool-button"; b.id = "phraseButton"; b.setAttribute("data-needs-room", ""); b.setAttribute("data-feature", "phrases");
    b.textContent = "💬 定型文"; b.disabled = !state.currentRoom;
    b.addEventListener("click", () => runTool(openPhrases));
    tools.appendChild(b);
}

function openPhrases(){
    openSheet(toolHead("💬 定型文", "押すと入力欄に入ります（まだ送りません）。「送る」で、そのまま送信します。") +
        '<div class="pick">' + (cf.phrases.length ? cf.phrases.map((p, i) =>
            '<div class="row" style="justify-content:space-between;flex-wrap:nowrap"><button type="button" style="flex:1" data-t="phr:use" data-i="' + i + '">' + escapeHtml(p) + '</button>' +
            '<button type="button" class="button-secondary" data-t="phr:send" data-i="' + i + '" title="すぐ送る">送る</button>' +
            '<button type="button" class="button-secondary" data-t="phr:del" data-i="' + i + '" aria-label="削除">🗑</button></div>').join("") : '<div class="meta">まだありません。下で追加してください。</div>') + '</div>' +
        '<label>新しい定型文（60文字まで・最大20個）</label><input type="text" id="phNew" maxlength="60" placeholder="例：いま電車なので、あとで返信します">' +
        '<div class="row"><button type="button" class="button-secondary" data-t="phr:reset">初期に戻す</button><button type="button" data-t="phr:add">追加</button></div>' + toolClose());
}

async function onPhraseAction(action, node){
    const i = Number(node.dataset.i);
    if(action === "use" || action === "send"){
        const text = cf.phrases[i];
        if(typeof text !== "string") return;
        if(action === "send"){ closeSheet(); await sendMessagePayload(buildTextPayload(text), {keepInput:true}); return; }
        const inp = el.messageInput, cur = inp.value;
        const at = typeof inp.selectionStart === "number" ? inp.selectionStart : cur.length;
        inp.value = (cur.slice(0, at) + text + cur.slice(inp.selectionEnd != null ? inp.selectionEnd : at)).slice(0, 2000);
        try{ if(typeof updateCharCount === "function") updateCharCount(); }catch(_e){}
        inp.dispatchEvent(new Event("input", {bubbles:true}));
        closeSheet(); inp.focus();
    }else if(action === "del"){ cf.phrases.splice(i, 1); phrasesSave(); openPhrases(); }
    else if(action === "add"){
        const v = String(document.getElementById("phNew").value || "").trim().slice(0, 60);
        if(!v){ showToast("文を入力してください。"); return; }
        if(cf.phrases.length >= 20){ showToast("定型文は20個までです。"); return; }
        if(cf.phrases.includes(v)){ showToast("同じ文がすでにあります。"); return; }
        cf.phrases.push(v); phrasesSave(); openPhrases();
    }else if(action === "reset"){ cf.phrases = CF_PHRASES.slice(); phrasesSave(); openPhrases(); }
}

// ---------- 見やすさ（文字サイズ・高コントラスト）と読み上げ ----------
function a11yApply(){
    const b = document.body, s = Math.max(0, Math.min(3, Number(cf.a11y.size) || 0));
    for(let i = 1; i <= 3; i++) b.classList.toggle("cf-s" + i, s === i);
    b.classList.toggle("cf-hc", !!cf.a11y.hc);
}
function a11ySave(){ cfWrite("a11y", cf.a11y); }

function speakSupported(){ return "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function"; }
function speakStop(){ try{ speechSynthesis.cancel(); }catch(_e){} cf.speakId = null; }
function speakText(text, id){
    if(!speakSupported()){ showToast("このブラウザは読み上げに対応していません。"); return; }
    if(cf.speakId === id){ speakStop(); return; }       // もう一度押すと止める
    speakStop();
    const clean = String(text || "").replace(/https?:\/\/\S+/g, "リンク").replace(/\s+/g, " ").trim().slice(0, 1000);
    if(!clean) return;
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = "ja-JP"; u.rate = Number(cf.a11y.rate) || 1;
    const v = (speechSynthesis.getVoices() || []).find((x) => /^ja/i.test(x.lang));
    if(v) u.voice = v;
    u.onend = u.onerror = () => { if(cf.speakId === id) cf.speakId = null; };
    cf.speakId = id;
    speechSynthesis.speak(u);
}

function initA11y(){
    registerTool("a11y", onA11yAction);
    const v = cfRead("a11y", null);
    if(v && typeof v === "object") cf.a11y = {size:Number(v.size) || 0, hc:!!v.hc, rate:[0.8, 1, 1.25].includes(Number(v.rate)) ? Number(v.rate) : 1};
    a11yApply();
    if(speakSupported()){
        try{ speechSynthesis.getVoices(); }catch(_e){}
        addMsgTool({id:"speak", icon:"🔊", label:"読み上げ", when:(m, item) => item.type === "text" && !!String(item.text || "").trim(), run:(m, item) => speakText(item.text, m.id)});
        addRoomHook(() => speakStop());
        window.addEventListener("pagehide", speakStop);
    }
}

function openComfort(){
    openSheet(toolHead("🔠 見やすさ・読み上げ", "この端末だけに保存されます") +
        '<label>文字の大きさ</label><div class="row" style="justify-content:flex-start">' + CF_SIZES.map((n, i) =>
            '<button type="button" class="' + (cf.a11y.size === i ? "" : "button-secondary") + '" data-t="a11y:size" data-i="' + i + '" aria-pressed="' + (cf.a11y.size === i) + '">' + n + '</button>').join("") + '</div>' +
        '<label class="row" style="gap:8px;justify-content:flex-start"><input type="checkbox" data-t="a11y:hc"' + (cf.a11y.hc ? " checked" : "") + '> 高コントラスト（文字と背景をはっきり）</label>' +
        '<label>読み上げの速さ（メッセージの「🔊」で使います）</label><div class="row" style="justify-content:flex-start">' +
        [[0.8, "ゆっくり"], [1, "ふつう"], [1.25, "はやい"]].map((r) => '<button type="button" class="' + (cf.a11y.rate === r[0] ? "" : "button-secondary") + '" data-t="a11y:rate" data-v="' + r[0] + '">' + r[1] + '</button>').join("") +
        '<button type="button" class="button-secondary" data-t="a11y:test"' + (speakSupported() ? "" : " disabled") + '>▶ 試し聞き</button></div>' +
        (speakSupported() ? "" : '<div class="meta">このブラウザは読み上げに対応していません。</div>') +
        '<div class="meta" style="margin-top:6px">見本：<span class="bubble" style="display:inline-block;padding:4px 10px">こんにちは！ ARE です。</span></div>' + toolClose());
}
function onA11yAction(action, node){
    if(action === "size"){ cf.a11y.size = Number(node.dataset.i) || 0; a11yApply(); a11ySave(); openComfort(); }
    else if(action === "hc"){ cf.a11y.hc = !!node.checked; a11yApply(); a11ySave(); }
    else if(action === "rate"){ cf.a11y.rate = Number(node.dataset.v) || 1; a11ySave(); openComfort(); }
    else if(action === "test"){ speakText("こんにちは。これは読み上げの試し聞きです。", "test"); }
}

// ---------- 未読へジャンプ・日付へジャンプ ----------
function jumpRows(){ return Array.from(el.messages.querySelectorAll("article[data-mid]")); }
function jumpFirstUnreadId(){
    const room = state.currentRoom;
    if(!room || !(room.id in cf.snap) || !cf.snap[room.id]) return {id:null, n:0};
    const since = cf.snap[room.id];
    const list = (state.messages || []).filter((m) => m.created_at > since && m.sender_id !== state.user.id);
    if(!list.length) return {id:null, n:0};
    list.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    return {id:list[0].id, n:list.length};
}
function jumpPaint(){
    const bar = cf.bar; if(!bar) return;
    const room = state.currentRoom;
    bar.hidden = !room;
    if(!room) return;
    const u = jumpFirstUnreadId();
    const ub = bar.querySelector('[data-j="unread"]');
    let show = false;
    if(u.id){
        const row = el.messages.querySelector('article[data-mid="' + String(u.id).replace(/[^0-9a-z-]/gi, "") + '"]');
        // 最初の未読が画面より上にあるときだけ出す（もう見えている・読んだ後は出さない）
        if(row) show = row.getBoundingClientRect().bottom < el.messages.getBoundingClientRect().top + 8;
    }
    ub.hidden = !show; ub.dataset.id = u.id || ""; ub.textContent = "🔔 未読 " + u.n + "件 ↑";
    const nearBottom = el.messages.scrollHeight - el.messages.scrollTop - el.messages.clientHeight < 160;
    bar.querySelector('[data-j="bottom"]').hidden = nearBottom;
}
function openDateJump(){
    const msgs = state.messages || [];
    if(!msgs.length){ showToast("メッセージがありません。"); return; }
    const first = msgs.reduce((a, m) => (m.created_at < a ? m.created_at : a), msgs[0].created_at), last = msgs.reduce((a, m) => (m.created_at > a ? m.created_at : a), msgs[0].created_at);
    const d1 = dayKey(first), d2 = dayKey(last);
    openSheet(toolHead("📅 日付へジャンプ", "読み込み済みの範囲：" + d1 + " 〜 " + d2 + "（新しい順に最大500件）") +
        '<input type="date" id="cfDate" min="' + d1 + '" max="' + d2 + '" value="' + d2 + '" style="background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:10px">' +
        '<div class="row"><button type="button" data-t="jump:go">この日へ</button></div>' + toolClose());
}
function jumpToDate(value){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value || "")){ showToast("日付を選んでください。"); return; }
    const t = new Date(value + "T00:00:00").getTime();
    const hit = (state.messages || []).filter((m) => new Date(m.created_at).getTime() >= t).sort((a, b) => (a.created_at < b.created_at ? -1 : 1))[0];
    if(!hit){ showToast("その日以降のメッセージはありません。"); return; }
    closeSheet();
    setTimeout(() => jumpToMessage(hit.id), 50);
}
function initJump(){
    registerTool("jump", (a) => { if(a === "go") jumpToDate(document.getElementById("cfDate").value); });
    // 部屋を開いた直前の「ここまで読んだ」時刻を覚えておく（開いた瞬間に既読にされるため）
    if(typeof nfMarkSeen === "function"){
        const orig = nfMarkSeen;
        nfMarkSeen = function(roomId){
            if(roomId && !(roomId in cf.snap) && typeof nf !== "undefined") cf.snap[roomId] = nf.seen[roomId] || null;
            return orig.apply(this, arguments);
        };
    }
    const orig2 = selectRoom;
    selectRoom = function(room){ if(room && room.id) delete cf.snap[room.id]; return orig2.apply(this, arguments); };
    const bar = document.createElement("div");
    bar.className = "cf-jump"; bar.hidden = true; bar.id = "cfJump";
    bar.innerHTML = '<button type="button" class="button-secondary" data-j="unread" hidden></button><button type="button" class="button-secondary" data-j="date">📅 日付</button><button type="button" class="button-secondary" data-j="top" aria-label="いちばん上へ">⏫</button><button type="button" class="button-secondary" data-j="bottom" aria-label="最新へ">⬇ 最新へ</button>';
    el.messages.insertAdjacentElement("afterend", bar);
    cf.bar = bar;
    bar.addEventListener("click", (e) => {
        const b = e.target.closest("[data-j]"); if(!b) return;
        const k = b.dataset.j;
        if(k === "unread"){ if(b.dataset.id) jumpToMessage(b.dataset.id); }
        else if(k === "date") runTool(openDateJump);
        else if(k === "top") el.messages.scrollTo({top:0});
        else if(k === "bottom") el.messages.scrollTo({top:el.messages.scrollHeight});
    });
    el.messages.addEventListener("scroll", () => { clearTimeout(cf.sT); cf.sT = setTimeout(jumpPaint, 80); }, {passive:true});
    addRenderHook(jumpPaint);
    addRoomHook(jumpPaint);
}

// ---------- スター ----------
function starMark(){
    el.messages.querySelectorAll("article[data-mid]").forEach((row) => {
        const on = cf.stars.has(row.dataset.mid);
        const sb = row.querySelector('.tool-icon[data-tool="star"]');
        if(sb){ sb.textContent = on ? "⭐" : "☆"; sb.title = on ? "スターを外す" : "スターをつける（あとで見返す）"; sb.setAttribute("aria-label", sb.title); }
        const time = row.querySelector(".message-time");
        if(!time) return;
        let s = time.querySelector(".cf-star");
        if(on && !s){ s = document.createElement("span"); s.className = "cf-star"; s.textContent = " ⭐"; time.appendChild(s); }
        else if(!on && s) s.remove();
    });
}
async function starLoad(){
    const res = await requireClient().from("starred_messages").select("message_id,room_id,created_at").order("created_at", {ascending:false}).limit(500);
    if(res.error) return;
    cf.stars = new Map((res.data || []).map((r) => [r.message_id, r]));
    starMark();
}
async function starToggle(message){
    const on = cf.stars.has(message.id);
    const t = requireClient().from("starred_messages");
    const res = on ? await t.delete().eq("message_id", message.id).eq("user_id", state.user.id)
        : await t.insert({user_id:state.user.id, message_id:message.id, room_id:message.room_id || (state.currentRoom && state.currentRoom.id)});
    if(res.error) throw res.error;
    if(on) cf.stars.delete(message.id); else cf.stars.set(message.id, {message_id:message.id, room_id:message.room_id || state.currentRoom.id, created_at:new Date().toISOString()});
    starMark();
    showToast(on ? "スターを外しました。" : "⭐ スターをつけました。");
}
function initStars(){
    registerTool("star", onStarAction);
    if(!window.AREFeatures.ok("msgmenu")) throw new Error("メッセージ操作メニューが起動していません。");
    addMsgTool({id:"star", icon:(m) => cf.stars.has(m.id) ? "⭐" : "☆", label:(m) => cf.stars.has(m.id) ? "スターを外す" : "スターをつける（あとで見返す）", run:(m) => starToggle(m)});
    addRenderHook(starMark);
    starLoad().catch(() => {});
}
async function openStars(){
    const rows = Array.from(cf.stars.values());
    openSheet(toolHead("⭐ スター付きメッセージ", "あとで見返したいメッセージの一覧") + '<div class="meta">読み込み中…</div>');
    if(!rows.length){ openSheet(toolHead("⭐ スター付きメッセージ") + '<div class="meta">まだありません。メッセージの ☆ を押すと、ここに集まります。</div>' + toolClose()); return; }
    const res = await requireClient().from(TABLES.messages).select("id,room_id,sender_id,content,created_at").in("id", rows.map((r) => r.message_id));
    const found = new Map((res.data || []).map((m) => [m.id, m]));
    const items = rows.filter((r) => found.has(r.message_id)).slice(0, 100);
    openSheet(toolHead("⭐ スター付きメッセージ", items.length + "件") + '<div class="pick">' + (items.length ? items.map((r) => {
        const m = found.get(r.message_id);
        const text = messageSummary(parseMessageContent(m.content)).replace(/\s+/g, " ").slice(0, 80);
        return '<div class="row" style="flex-wrap:nowrap;justify-content:space-between"><button type="button" style="flex:1" data-t="star:open" data-id="' + escapeHtml(m.id) + '" data-room="' + escapeHtml(m.room_id) + '"><b>' + escapeHtml(roomNameById(m.room_id)) + '</b> ・ ' + escapeHtml(formatDate(m.created_at)) + '<br>' + escapeHtml(text) + '</button>' +
            '<button type="button" class="button-secondary" data-t="star:off" data-id="' + escapeHtml(m.id) + '" aria-label="スターを外す">☆</button></div>';
    }).join("") : '<div class="meta">表示できるメッセージがありません。</div>') + '</div>' + toolClose());
}
async function onStarAction(action, node){
    if(action === "off"){ await starToggle({id:node.dataset.id}); openStars(); }
    else if(action === "open"){
        const room = (state.rooms || []).find((r) => r.id === node.dataset.room);
        if(!room){ showToast("そのチャットは開けません。"); return; }
        closeSheet();
        if(!state.currentRoom || state.currentRoom.id !== room.id) await selectRoom(room, room.partner);
        setTimeout(() => jumpToMessage(node.dataset.id), 200);
    }
}

// ---------- チャットのフォルダ分け・並び替え ----------
function fdLoad(){
    const v = cfRead("folders", null);
    if(v && typeof v === "object"){
        cf.folders.list = (Array.isArray(v.list) ? v.list : []).filter((f) => f && f.id && f.name).slice(0, 8).map((f) => ({id:String(f.id), name:String(f.name).slice(0, 12)}));
        cf.folders.map = v.map && typeof v.map === "object" ? v.map : {};
        cf.folders.pins = Array.isArray(v.pins) ? v.pins.filter((x) => typeof x === "string") : [];
        cf.folders.sort = ["recent", "name", "unread"].includes(v.sort) ? v.sort : "recent";
        cf.folders.filter = typeof v.filter === "string" ? v.filter : "all";
    }
}
function fdSave(){ cfWrite("folders", {list:cf.folders.list, map:cf.folders.map, pins:cf.folders.pins, sort:cf.folders.sort, filter:cf.folders.filter}); }

function cfPaintRooms(){
    const list = el.roomList; if(!list) return;
    const items = Array.from(list.querySelectorAll("[data-room-id]"));
    if(!items.length) return;
    const F = cf.folders;
    // 絞り込みの候補（フォルダが消えていたら「すべて」）
    if(F.filter !== "all" && F.filter !== "pin" && F.filter !== "none" && !F.list.some((f) => f.id === F.filter)) F.filter = "all";
    // 目印（📌 固定・✏️ 下書き・🔕 ミュート）
    items.forEach((b) => {
        const id = b.dataset.roomId;
        let m = b.querySelector(".cf-marks");
        if(!m){ m = document.createElement("span"); m.className = "cf-marks"; b.appendChild(m); }
        m.textContent = (F.pins.includes(id) ? "📌" : "") + (cf.drafts[id] ? "✏️" : "") + (typeof isMuted === "function" && isMuted(id) ? "🔕" : "");
        let g = b.querySelector(".cf-menu");
        if(!g){ g = document.createElement("span"); g.className = "cf-menu"; g.setAttribute("role", "button"); g.setAttribute("tabindex", "0"); g.setAttribute("aria-label", "整理メニュー"); g.textContent = "⋯"; b.appendChild(g); }
        const show = F.filter === "all" || (F.filter === "pin" && F.pins.includes(id)) || (F.filter === "none" && !F.map[id]) || F.map[id] === F.filter;
        b.hidden = !show;
        b.style.display = show ? "" : "none";
    });
    // 並び：固定を上に。そのあとは「新着順（いまの並び）」「名前順」「未読優先」
    const base = new Map(items.map((b, i) => [b, i]));
    const nameOf = (b) => { const s = b.querySelector("strong"); return s ? s.textContent : ""; };
    const unread = (b) => (feat.unread && feat.unread[b.dataset.roomId]) || 0;
    const sorted = items.slice().sort((a, b) => {
        const pa = F.pins.includes(a.dataset.roomId) ? 0 : 1, pb = F.pins.includes(b.dataset.roomId) ? 0 : 1;
        if(pa !== pb) return pa - pb;
        if(F.sort === "name") return nameOf(a).localeCompare(nameOf(b), "ja");
        if(F.sort === "unread"){ const d = (unread(b) > 0) - (unread(a) > 0); if(d) return d; }
        return base.get(a) - base.get(b);
    });
    sorted.forEach((b) => list.appendChild(b));
    cfPaintChips();
}
function cfPaintChips(){
    const F = cf.folders;
    let chips = document.getElementById("cfChips");
    const need = F.list.length > 0 || F.pins.length > 0;
    if(!need){ if(chips) chips.remove(); return; }
    if(!chips){ chips = document.createElement("div"); chips.id = "cfChips"; chips.className = "cf-chips"; el.roomList.insertAdjacentElement("beforebegin", chips);
        chips.addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if(!b) return; cf.folders.filter = b.dataset.f; fdSave(); cfPaintRooms(); }); }
    const opts = [["all", "すべて"]];
    if(F.pins.length) opts.push(["pin", "📌 固定"]);
    F.list.forEach((f) => opts.push([f.id, "📁 " + f.name]));
    if(F.list.length) opts.push(["none", "未分類"]);
    chips.innerHTML = opts.map((o) => '<button type="button" class="cf-chip' + (F.filter === o[0] ? " on" : "") + '" data-f="' + escapeHtml(o[0]) + '">' + escapeHtml(o[1]) + '</button>').join("");
}

function openRoomMenu(roomId){
    const F = cf.folders;
    openSheet(toolHead("📁 " + escapeHtml(roomNameById(roomId))) + '<div class="pick">' +
        '<button type="button" data-t="fd:pin" data-room="' + escapeHtml(roomId) + '">' + (F.pins.includes(roomId) ? "📌 固定を外す" : "📌 いちばん上に固定") + '</button>' +
        (typeof isMuted === "function" ? '<button type="button" data-t="fd:mute" data-room="' + escapeHtml(roomId) + '">' + (isMuted(roomId) ? "🔕 通知を再開" : "🔔 このチャットの通知を止める") + '</button>' : "") +
        '<button type="button" data-t="fd:move" data-room="' + escapeHtml(roomId) + '" data-f=""' + (!F.map[roomId] ? ' aria-current="true"' : "") + '>' + (!F.map[roomId] ? "✔ " : "") + '未分類</button>' +
        F.list.map((f) => '<button type="button" data-t="fd:move" data-room="' + escapeHtml(roomId) + '" data-f="' + escapeHtml(f.id) + '">' + (F.map[roomId] === f.id ? "✔ " : "") + '📁 ' + escapeHtml(f.name) + '</button>').join("") + '</div>' +
        (F.list.length ? "" : '<div class="meta">フォルダはまだありません。「その他」→「チャットの整理」で作れます。</div>') + toolClose());
}
function openFolders(){
    const F = cf.folders;
    openSheet(toolHead("📁 チャットの整理", "フォルダ分け・固定・並び替え（この端末だけに保存）") +
        '<label>並び順</label><div class="row" style="justify-content:flex-start">' + [["recent", "新着順"], ["name", "名前順"], ["unread", "未読を上に"]].map((o) =>
            '<button type="button" class="' + (F.sort === o[0] ? "" : "button-secondary") + '" data-t="fd:sort" data-v="' + o[0] + '">' + o[1] + '</button>').join("") + '</div>' +
        '<label>フォルダ（最大8個。チャット一覧の「⋯」で振り分けます）</label>' +
        (F.list.length ? F.list.map((f) => '<div class="row" style="flex-wrap:nowrap"><input type="text" data-t="fd:rename" data-id="' + escapeHtml(f.id) + '" value="' + escapeHtml(f.name) + '" maxlength="12" style="flex:1"><button type="button" class="button-secondary" data-t="fd:del" data-id="' + escapeHtml(f.id) + '" aria-label="フォルダを削除">🗑</button></div>').join("") : '<div class="meta">まだありません。</div>') +
        '<div class="row" style="flex-wrap:nowrap"><input type="text" id="fdNew" maxlength="12" placeholder="新しいフォルダ名（例：仕事）" style="flex:1"><button type="button" data-t="fd:add">追加</button></div>' + toolClose());
}
function onFolderAction(action, node){
    const F = cf.folders;
    if(action === "add"){
        const v = String(document.getElementById("fdNew").value || "").trim().slice(0, 12);
        if(!v){ showToast("フォルダ名を入力してください。"); return; }
        if(F.list.length >= 8){ showToast("フォルダは8個までです。"); return; }
        if(F.list.some((f) => f.name === v)){ showToast("同じ名前があります。"); return; }
        F.list.push({id:"f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name:v}); fdSave(); cfPaintRooms(); openFolders();
    }else if(action === "del"){
        F.list = F.list.filter((f) => f.id !== node.dataset.id);
        Object.keys(F.map).forEach((k) => { if(F.map[k] === node.dataset.id) delete F.map[k]; });
        fdSave(); cfPaintRooms(); openFolders();
    }else if(action === "rename"){
        const f = F.list.find((x) => x.id === node.dataset.id); const v = String(node.value || "").trim().slice(0, 12);
        if(f && v){ f.name = v; fdSave(); cfPaintRooms(); }
    }else if(action === "sort"){ F.sort = node.dataset.v; fdSave(); cfPaintRooms(); openFolders(); }
    else if(action === "pin"){
        const id = node.dataset.room;
        F.pins = F.pins.includes(id) ? F.pins.filter((x) => x !== id) : F.pins.concat(id).slice(-30);
        fdSave(); cfPaintRooms(); closeSheet();
    }else if(action === "move"){
        const id = node.dataset.room, f = node.dataset.f;
        if(f) F.map[id] = f; else delete F.map[id];
        fdSave(); cfPaintRooms(); closeSheet();
    }else if(action === "mute"){
        const id = node.dataset.room;
        muteSet(id, !isMuted(id)).then(() => { cfPaintRooms(); closeSheet(); }).catch((e) => showToast(featError(e)));
    }
}
function initFolders(){
    registerTool("fd", onFolderAction);
    fdLoad();
    const orig = renderRooms;
    renderRooms = function(){ orig.apply(this, arguments); try{ cfPaintRooms(); }catch(e){ console.error("[ARE folders]", e); } };
    el.roomList.addEventListener("click", (e) => {
        const g = e.target.closest(".cf-menu"); if(!g) return;
        e.stopPropagation(); e.preventDefault();
        const b = g.closest("[data-room-id]"); if(b) runTool(() => openRoomMenu(b.dataset.roomId));
    }, true);
    el.roomList.addEventListener("keydown", (e) => {
        if((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("cf-menu")){ e.stopPropagation(); e.preventDefault(); const b = e.target.closest("[data-room-id]"); if(b) runTool(() => openRoomMenu(b.dataset.roomId)); }
    }, true);
    if(state.rooms && state.rooms.length) cfPaintRooms();
}
