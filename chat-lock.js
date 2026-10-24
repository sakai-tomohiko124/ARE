"use strict";
// ===== アプリロック（PIN）／放置したら画面ぼかし・自動ログアウト =====
// ・PIN は、この端末だけに（元の数字ではなく、変換した値で）保存します。忘れたときは「ログアウトする」から入り直してください。
// ・これは「ちょっと見られたくない」ための鍵です。ブラウザの開発者ツールなどを使う人までは防げません。
// ・自動ログアウトは、操作がない時間が続くとログアウトします（ログアウトしても送ったメッセージは消えません）。

const LK_KEY = () => "are_lock_" + (state.user ? state.user.id : "x");
const ID_KEY = () => "are_idle_" + (state.user ? state.user.id : "x");
const lk = {cfg:null, idle:{blur:0, out:0}, ov:null, hiddenAt:0, last:Date.now(), fails:0, until:0, blurEl:null};

function lkLoad(){ try{ lk.cfg = JSON.parse(localStorage.getItem(LK_KEY()) || "null"); }catch(_e){ lk.cfg = null; } try{ lk.idle = Object.assign({blur:0, out:0}, JSON.parse(localStorage.getItem(ID_KEY()) || "{}")); }catch(_e){} }
function lkHex(buf){ return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join(""); }
async function lkHash(pin, salt){
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
    return lkHex(await crypto.subtle.deriveBits({name:"PBKDF2", hash:"SHA-256", salt:new TextEncoder().encode(salt), iterations:120000}, key, 256));
}

function initLock(){
    registerTool("lk", onLockAction);
    lkLoad();
    const ov = document.createElement("div");
    ov.id = "lkOverlay"; ov.className = "lk-overlay"; ov.hidden = true; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "ロック中");
    document.body.appendChild(ov); lk.ov = ov;
    const bl = document.createElement("div");
    bl.id = "lkBlur"; bl.className = "lk-blur"; bl.hidden = true; bl.textContent = "操作がないため、画面を隠しています。タップで戻る";
    bl.addEventListener("click", () => { bl.hidden = true; lk.last = Date.now(); }); document.body.appendChild(bl); lk.blurEl = bl;
    if(lk.cfg) lkShow();
    document.addEventListener("visibilitychange", () => {
        if(document.hidden){ lk.hiddenAt = Date.now(); return; }
        const away = Date.now() - (lk.hiddenAt || Date.now());
        if(lk.cfg && lk.cfg.after >= 0 && away >= lk.cfg.after * 60000) lkShow();
        if(lk.idle.out && away >= lk.idle.out * 60000) lkAutoLogout();
        lk.last = Date.now();
    });
    ["pointerdown", "keydown", "touchstart", "scroll"].forEach((ev) => document.addEventListener(ev, () => { lk.last = Date.now(); }, {passive:true, capture:true}));
    setInterval(lkIdleTick, 5000);
}
function lkIdleTick(){
    if(!state.user) return;
    const idle = (Date.now() - lk.last) / 60000;
    if(lk.idle.out && idle >= lk.idle.out){ lkAutoLogout(); return; }
    if(lk.idle.blur && idle >= lk.idle.blur && lk.blurEl.hidden && lk.ov.hidden) lk.blurEl.hidden = false;
}
async function lkAutoLogout(){
    if(lk.loggingOut) return; lk.loggingOut = true;
    try{ feat.timers.forEach(clearInterval); try{ await requireClient().rpc("set_my_presence", {p_status:"offline"}); }catch(_e){} await window.AREAuth.logout(); }catch(_e){}
    window.location.replace("./index.html");
}

function lkShow(){
    lk.ov.hidden = false; lk.ov.innerHTML = '<div class="lk-box"><div style="font-size:42px">🔒</div><h3 style="margin:0">ARE はロック中です</h3><div class="meta">PIN を入れてください</div>' +
        '<input id="lkPin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" aria-label="PIN" style="text-align:center;font-size:24px;letter-spacing:6px"><div id="lkMsg" class="meta" role="alert" style="min-height:1.4em"></div>' +
        '<div class="row"><button type="button" class="button" id="lkGo">解除</button><button type="button" class="button-secondary" id="lkOut">ログアウトする</button></div></div>';
    const pin = lk.ov.querySelector("#lkPin"); pin.focus();
    const go = async () => {
        const now = Date.now(), msg = lk.ov.querySelector("#lkMsg");
        if(now < lk.until){ msg.textContent = Math.ceil((lk.until - now) / 1000) + "秒待ってからやり直してください。"; return; }
        const ok = (await lkHash(pin.value, lk.cfg.salt)) === lk.cfg.hash;
        if(ok){ lk.fails = 0; lk.ov.hidden = true; lk.ov.innerHTML = ""; lk.last = Date.now(); return; }
        lk.fails++; pin.value = "";
        if(lk.fails % 5 === 0){ lk.until = Date.now() + 30000; msg.textContent = "続けて間違えました。30秒待ってください。"; }
        else msg.textContent = "PIN がちがいます（" + lk.fails + "回）。";
    };
    lk.ov.querySelector("#lkGo").onclick = go;
    pin.onkeydown = (e) => { if(e.key === "Enter") go(); };
    lk.ov.querySelector("#lkOut").onclick = () => { if(confirm("ログアウトしますか？（PIN も解除されます）")) { try{ localStorage.removeItem(LK_KEY()); }catch(_e){} lkAutoLogout(); } };
}

function openLock(){
    lkLoad();
    const on = !!lk.cfg, a = lk.cfg ? lk.cfg.after : 0;
    const opt = (v, t, cur) => '<option value="' + v + '"' + (Number(cur) === v ? " selected" : "") + '>' + t + '</option>';
    openSheet(toolHead("🔒 ロック・自動ログアウト", "他の人に画面を見られないための鍵です（この端末だけの設定）") +
        '<div class="admin-card"><b>アプリロック：' + (on ? "オン" : "オフ") + '</b>' +
        (on ? '<label for="lkAfter">ロックするタイミング</label><select id="lkAfter" class="status-select" data-t="lk:after">' + opt(0, "画面を離れたらすぐ", a) + opt(1, "1分離れたら", a) + opt(5, "5分離れたら", a) + opt(30, "30分離れたら", a) + opt(-1, "開くときだけ（ページを開き直したとき）", a) + '</select><div class="row"><button type="button" class="button-danger" data-t="lk:off">ロックをやめる</button></div>'
            : '<label for="lkP1">PIN（数字4〜8けた）</label><input id="lkP1" type="password" inputmode="numeric" maxlength="8" autocomplete="off"><label for="lkP2">もう一度</label><input id="lkP2" type="password" inputmode="numeric" maxlength="8" autocomplete="off"><div class="row"><button type="button" class="button" data-t="lk:on">ロックを設定</button></div>') + '</div>' +
        '<div class="admin-card"><b>放置したとき</b><label for="lkBlur">画面をぼかす（操作がない時間）</label><select id="lkBlurSel" class="status-select" data-t="lk:idle">' + opt(0, "しない", lk.idle.blur) + opt(1, "1分", lk.idle.blur) + opt(3, "3分", lk.idle.blur) + opt(10, "10分", lk.idle.blur) + '</select>' +
        '<label for="lkOutSel">自動でログアウト（操作がない時間）</label><select id="lkOutSel" class="status-select" data-t="lk:idle">' + opt(0, "しない", lk.idle.out) + opt(5, "5分", lk.idle.out) + opt(15, "15分", lk.idle.out) + opt(30, "30分", lk.idle.out) + opt(60, "1時間", lk.idle.out) + '</select></div>' +
        '<div class="meta">・PIN は忘れても復旧できません（ログアウトして入り直せば解除されます）。<br>・開発者ツールなどを使う人までは防げません。</div>' + toolClose());
}
async function onLockAction(action){
    if(action === "on"){
        const a = $("lkP1").value, b = $("lkP2").value;
        if(!/^\d{4,8}$/.test(a)){ showToast("PIN は数字4〜8けたで入れてください。"); return; }
        if(a !== b){ showToast("2回の入力が一致しません。"); return; }
        const salt = lkHex(crypto.getRandomValues(new Uint8Array(16)));
        lk.cfg = {salt, hash:await lkHash(a, salt), after:0};
        localStorage.setItem(LK_KEY(), JSON.stringify(lk.cfg)); showToast("ロックを設定しました。"); openLock();
    }else if(action === "off"){
        if(!confirm("ロックをやめますか？")) return;
        localStorage.removeItem(LK_KEY()); lk.cfg = null; showToast("ロックをやめました。"); openLock();
    }else if(action === "after"){
        lk.cfg.after = Number($("lkAfter").value); localStorage.setItem(LK_KEY(), JSON.stringify(lk.cfg));
    }else if(action === "idle"){
        lk.idle = {blur:Number($("lkBlurSel").value), out:Number($("lkOutSel").value)}; localStorage.setItem(ID_KEY(), JSON.stringify(lk.idle)); showToast("保存しました。");
    }
}
