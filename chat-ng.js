"use strict";
// ===== NGワード制裁（画面側）=====
// ・チャット／AIボット／プロフィール欄など「文字を入れて送る」場所で、送る直前にNGワードを検査します（辞書：NG.json）
// ・見つかったら：送信を止める → サーバーに申告（ポイント0・管理者へ即報告・回数カウント）→ 警告を表示
// ・10回目：1日凍結 ／ 11回目：virus.html（お仕置き画面）へ。謝罪ボタンでアカウントは完全消去されます
// ・本当の判定とペナルティはサーバー（Supabase）側で行います。画面側は「送る前に止める」ための案内役です。
const NG_ALLOW = ["ばかり", "最低限", "最低気温", "最低賃金", "最低でも", "最低価格", "最悪の場合", "最悪でも", "カスタ", "カステラ", "カスピ", "カスケード", "カスミ", "かすてら", "かすみ", "かすかに", "かすれ", "かすり", "ごみ箱", "ゴミ箱", "ごみ出し", "ゴミ出し", "ごみ収集", "ゴミ収集", "ごみ袋", "ゴミ袋", "ごみ捨て", "ゴミ捨て", "ごみ処理", "ゴミ処理", "ごみ拾い", "ゴミ拾い", "ごみ分別", "ゴミ分別", "ごみの日", "ゴミの日", "活かす", "生かす", "驚かす", "脅かす", "動かす", "沸かす", "乾かす", "散らかす", "甘やかす", "ごまかす", "誤魔化す", "溶かす", "うごかす", "いかす", "おどかす", "おどろかす", "わかす", "かわかす", "ちらかす", "あまやかす", "とかす", "ぬかす", "しでかす", "やらかす", "ひけらかす", "みせびらかす", "見せびらかす", "くずもち", "くずれ", "くずす", "くずし", "くず湯", "ボケ防止", "ピンボケ", "ボケ味", "背景ボケ", "裸足", "裸眼", "裸一貫", "局部的", "風俗習慣", "脱げた", "脱げない", "脱げる", "脱げそう", "脱げちゃ", "脱げば"];
const NG_STRIP = /[\s　・…〜~!！?？#＊*@_\-.,、。"'「」()（）]+/g;
const NG_SKIP_BTN = /(キャンセル|閉じる|やめる|戻る|クリア|消す|削除|×|✖|✕|close|cancel)/i;
const ng = {words:[], ascii:[], ready:false, busy:false, freezeTimer:0};  // ascii: [{w, rx}]

function ngNorm(s){ return String(s || "").normalize("NFKC").toLowerCase(); }
async function ngLoad(){
    try{
        const res = await fetch("./NG.json", {cache:"no-cache"});
        if(!res.ok) throw new Error("NG.json " + res.status);
        const data = await res.json();
        const seen = new Set();
        (data.words || []).forEach((w) => {
            const n = ngNorm(w).replace(NG_STRIP, "");
            if(!n || seen.has(n)) return; seen.add(n);
            if(/^[a-z0-9]+$/.test(n)) ng.ascii.push({w:n, rx:new RegExp("(^|[^a-z0-9])" + n.split("").join("[ \\u3000・…〜~!#*@_.\\-]*") + "($|[^a-z0-9])")});
            else ng.words.push(n);
        });
        ng.ready = true;
    }catch(error){ console.warn("[ARE ng]", error); }
}
function ngCheck(text){
    if(!ng.ready || !text) return null;
    let t = ngNorm(text);
    NG_ALLOW.forEach((a) => { if(t.includes(a)) t = t.split(a).join(""); });
    const s = t.replace(NG_STRIP, "");
    for(const w of ng.words){ if(s.includes(w)) return w; }
    for(const a of ng.ascii){ if(a.rx.test(t)) return a.w; }
    return null;
}

// ---------- 入力欄の見つけ方 ----------
function ngIsText(f){
    if(!f || f.disabled || f.readOnly || f.dataset.ngIgnore) return false;
    if(f.tagName === "TEXTAREA") return true;
    if(f.tagName !== "INPUT") return false;
    const t = (f.getAttribute("type") || "text").toLowerCase();
    return t === "text" || t === "search" || t === "url";
}
function ngVisible(f){ return !!(f.offsetWidth || f.offsetHeight || f.getClientRects().length); }
function ngFieldsAround(btn){
    let node = btn.parentElement;
    for(let i = 0; i < 5 && node; i++, node = node.parentElement){
        const list = Array.from(node.querySelectorAll("textarea,input")).filter((f) => ngIsText(f) && ngVisible(f) && String(f.value || "").trim());
        if(list.length) return list;
        if(node.tagName === "BODY") break;
    }
    return [];
}
function ngIsAdmin(){ try{ return !!(pt && pt.acc && pt.acc.admin); }catch(_e){ return false; } }
function ngFindHit(fields){
    for(const f of fields){ const w = ngCheck(f.value); if(w) return {field:f, word:w, text:f.value}; }
    return null;
}

// ---------- ペナルティ ----------
async function ngPenalty(hit){
    if(ng.busy) return; ng.busy = true;
    const f = hit.field, src = String(f.id || f.name || f.getAttribute("aria-label") || "input").slice(0, 40);
    try{ f.value = ""; f.dispatchEvent(new Event("input", {bubbles:true})); }catch(_e){}
    let res = null;
    try{ const r = await requireClient().rpc("ng_report", {p_source:src, p_text:String(hit.text).slice(0, 300)}); if(!r.error) res = r.data; }catch(_e){}
    ng.busy = false;
    ngShowWarning(hit.word, res);
    try{ if(typeof ptRefresh === "function") ptRefresh(); }catch(_e){}
    if(res && res.pending_erase){ setTimeout(() => location.replace("./virus.html"), 1500); }
    else if(res && res.frozen_until){ ngShowFreeze(new Date(res.frozen_until).getTime()); }
}
function ngShowWarning(word, res){
    let box = document.getElementById("ngWarn");
    if(!box){ box = document.createElement("div"); box.id = "ngWarn"; box.className = "ng-warn"; box.setAttribute("role", "alertdialog"); document.body.appendChild(box); }
    const n = res && res.strikes;
    let extra = "あと" + (n ? Math.max(0, 10 - n) : "?") + "回で1日使えなくなり、11回目でアカウントが削除されます。";
    if(res && res.pending_erase) extra = "11回目です。アカウントの削除手続きに進みます。";
    else if(res && res.frozen_until) extra = "10回に達したため、1日アカウントを凍結します。次はアカウント削除です。";
    box.innerHTML = '<div class="ng-warn-box"><div style="font-size:40px">⚠️</div><h3 style="margin:0">不適切な発言を検知しました</h3>' +
        '<div class="meta">検知した言葉：「' + escapeHtml(word) + '」</div>' +
        '<div>送信は取り消され、<b>ポイントは0</b>になり、<b>管理者に報告</b>されました。' + (n ? '<br>（これで<b>' + n + '回目</b>です）' : '') + '</div>' +
        '<div class="meta">' + escapeHtml(extra) + '</div><button type="button" class="button" id="ngWarnOk" data-keep>わかりました</button></div>';
    box.hidden = false;
    document.getElementById("ngWarnOk").onclick = () => { box.hidden = true; };
}

// ---------- 凍結画面 ----------
function ngShowFreeze(untilMs){
    let ov = document.getElementById("ngFreeze");
    if(!ov){ ov = document.createElement("div"); ov.id = "ngFreeze"; ov.className = "pt-freeze"; ov.setAttribute("role", "alertdialog"); document.body.appendChild(ov); }
    clearInterval(ng.freezeTimer);
    const tick = () => {
        const left = Math.max(0, untilMs - Date.now());
        const h = Math.floor(left / 3600000), m = Math.floor(left % 3600000 / 60000);
        ov.innerHTML = '<div class="pt-freeze-box"><div style="font-size:44px">🧊</div><h3 style="margin:0">アカウントを凍結しています</h3>' +
            '<div class="meta">不適切な発言が10回に達したため、一時的に使えません。<br>次に不適切な発言をすると、アカウントは削除されます。</div>' +
            '<div class="pt-count" style="font-size:36px">あと ' + h + '時間' + String(m).padStart(2, "0") + '分</div>' +
            '<button type="button" class="button" id="ngFreezeOut" data-keep>ログアウトする</button></div>';
        const b = document.getElementById("ngFreezeOut"); if(b) b.onclick = () => { if(typeof ptForceLogout === "function") ptForceLogout(); else location.replace("./index.html"); };
        if(left <= 0){ clearInterval(ng.freezeTimer); ov.remove(); try{ ptRefresh(); }catch(_e){} }
    };
    tick(); ng.freezeTimer = setInterval(tick, 20000);
}
// ptRefresh（chat-points.js）から呼ばれる：サーバーの状態に合わせて画面を切り替える
function ngOnAccess(acc){
    if(!acc || acc.admin) return;
    if(acc.ng_pending){ location.replace("./virus.html"); return; }
    if(acc.ng_frozen_until && new Date(acc.ng_frozen_until) > new Date()) ngShowFreeze(new Date(acc.ng_frozen_until).getTime());
}

// ---------- 送信の直前に検査 ----------
function ngGuardEvent(event, fields){
    if(ngIsAdmin() || ng.busy) return false;
    const hit = ngFindHit(fields);
    if(!hit) return false;
    event.preventDefault(); event.stopImmediatePropagation();
    ngPenalty(hit);
    return true;
}
function initNg(){
    ngLoad();
    document.addEventListener("keydown", (event) => {
        if(event.key !== "Enter" || event.isComposing || event.keyCode === 229) return;
        const f = event.target;
        if(!ngIsText(f)) return;
        // 複数行の入力欄は、送信に使うEnter（Shiftなし）か Ctrl/⌘+Enter のときだけ検査（ふつうの改行は対象外）
        if(f.tagName === "TEXTAREA" && event.shiftKey) return;
        if(f.tagName === "TEXTAREA" && f.id !== "messageInput" && !(event.ctrlKey || event.metaKey)) return;
        ngGuardEvent(event, [f]);
    }, true);
    document.addEventListener("click", (event) => {
        const b = event.target.closest && event.target.closest('button,[role="button"],input[type="button"],input[type="submit"]');
        if(!b || b.dataset.pm === "close" || NG_SKIP_BTN.test((b.textContent || "") + (b.getAttribute("aria-label") || ""))) return;
        ngGuardEvent(event, ngFieldsAround(b));
    }, true);
    document.addEventListener("submit", (event) => {
        const form = event.target;
        if(form && form.querySelectorAll) ngGuardEvent(event, Array.from(form.querySelectorAll("textarea,input")).filter((f) => ngIsText(f) && String(f.value || "").trim()));
    }, true);
}

// ---------- 管理者：NG制裁の一覧と赦免 ----------
async function renderAdminNg(client){
    const r = await client.rpc("admin_ng_list");
    if(r.error) throw r.error;
    const users = (r.data && r.data.users) || [], log = (r.data && r.data.log) || [];
    el.adminBody.innerHTML = '<div class="meta">NGワードを検知すると、ポイント0・通報（管理者通知）・回数カウントが自動で行われます。誤検知のときは「赦免」で回数・凍結・削除待ちを解除できます。</div>' +
        '<b>ユーザー別の回数</b>' + (users.length ? users.map((u) => '<div class="admin-card"><b>' + escapeHtml(u.name || u.user_id) + '</b> ・ <b>' + u.strikes + '回</b>' +
            (u.pending_erase ? ' <span class="pending">削除待ち（謝罪画面）</span>' : (u.frozen_until && new Date(u.frozen_until) > new Date() ? ' <span class="pending">凍結中〜' + escapeHtml(formatDate(u.frozen_until)) + '</span>' : "")) +
            '<div class="meta">最後：' + escapeHtml(u.last_at ? formatDate(u.last_at) : "") + '</div><div class="row"><button type="button" class="button-secondary" data-ng-forgive="' + escapeHtml(u.user_id) + '">赦免（回数を0に戻す）</button></div></div>').join("") : '<div class="empty-list">該当するユーザーはいません。</div>') +
        '<b>最近の記録</b>' + (log.length ? log.map((l) => '<div class="admin-card"><div class="meta">' + escapeHtml(formatDate(l.created_at)) + ' ・ ' + escapeHtml(l.action || "") + ' ・ ' + escapeHtml(l.source || "") + '</div><div><b>' + escapeHtml(l.display_name || "（削除済み）") + '</b> ' + (l.strike ? l.strike + '回目' : "") + (l.matched ? ' 検知語「' + escapeHtml(l.matched) + '」' : "") + '</div>' + (l.snippet ? '<div class="meta" style="white-space:pre-wrap">' + escapeHtml(String(l.snippet).slice(0, 200)) + '</div>' : "") + '</div>').join("") : '<div class="empty-list">記録はまだありません。</div>');
}
document.addEventListener("click", (event) => {
    const b = event.target.closest && event.target.closest("[data-ng-forgive]");
    if(!b || !el.adminBody || !el.adminBody.contains(b)) return;
    runTool(async () => {
        if(!confirm("このユーザーのNG回数・凍結・削除待ちを解除しますか？")) return;
        const r = await requireClient().rpc("admin_ng_forgive", {p_user:b.dataset.ngForgive}); if(r.error) throw r.error;
        showToast("赦免しました。"); await renderAdminNg(requireClient());
    });
});
