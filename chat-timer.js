"use strict";
// ===== タイマー（ポモドーロ・カウントダウン）=====
// ・時間は「終わる時刻」で数えるので、画面を閉じたり裏に回っても正確です（ブラウザを完全に閉じると鳴りません）。
// ・終わると、音・振動・通知（許可している場合）でお知らせします。この端末に保存され、開き直しても続きます。

const TM_KEY = () => "are_timer_" + (state.user ? state.user.id : "x");
const tm = {end:0, label:"", kind:"", cycle:0, pomo:{work:25, rest:5, long:15, rounds:0}, tick:null, pill:null, fired:false};

function tmFmt(ms){ const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(s % 60).padStart(2, "0"); }
function tmSave(){ try{ localStorage.setItem(TM_KEY(), JSON.stringify({end:tm.end, label:tm.label, kind:tm.kind, cycle:tm.cycle, pomo:tm.pomo})); }catch(_e){} }
/** ポモドーロの次の段階：作業→休憩（4回ごとに長い休憩）→作業… */
function tmNextPhase(kind, cycle, p){
    if(kind === "work"){ const c = cycle + 1; return c % 4 === 0 ? {kind:"long", min:p.long, cycle:c} : {kind:"rest", min:p.rest, cycle:c}; }
    return {kind:"work", min:p.work, cycle};
}
const TM_NAMES = {work:"🍅 作業", rest:"☕ 休憩", long:"🛌 長い休憩", count:"⏳ カウントダウン"};

function initTimer(){
    registerTool("tm", onTimerAction);
    const pill = document.createElement("button");
    pill.type = "button"; pill.id = "tmPill"; pill.className = "tm-pill"; pill.hidden = true;
    pill.addEventListener("click", () => runTool(openTimer));
    document.body.appendChild(pill); tm.pill = pill;
    try{
        const s = JSON.parse(localStorage.getItem(TM_KEY()) || "null");
        if(s && s.end){ Object.assign(tm, {end:s.end, label:s.label || "", kind:s.kind || "count", cycle:s.cycle || 0}); if(s.pomo) tm.pomo = Object.assign(tm.pomo, s.pomo); }
    }catch(_e){}
    tm.tick = setInterval(tmTick, 500); tmTick();
}

function tmTick(){
    const left = tm.end - Date.now();
    if(tm.end && left <= 0 && !tm.fired){ tm.fired = true; tmFinish(); }
    const run = tm.end && left > 0;
    if(tm.pill){ tm.pill.hidden = !run || !!(el.profileModal && !el.profileModal.hidden); if(run) tm.pill.textContent = (TM_NAMES[tm.kind] || "⏱") + " " + tmFmt(left); }
    const big = $("tmBig"); if(big) big.textContent = run ? tmFmt(left) : "0:00";
}

function tmBeep(){
    try{
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        [0, 0.25, 0.5].forEach((t) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ac.destination); g.gain.setValueAtTime(0.2, ac.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.2); o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.22); });
        setTimeout(() => { try{ ac.close(); }catch(_e){} }, 1500);
    }catch(_e){}
    try{ if(navigator.vibrate) navigator.vibrate([300, 150, 300]); }catch(_e){}
}

function tmFinish(){
    tmBeep();
    const kind = tm.kind, name = TM_NAMES[kind] || "タイマー";
    let msg = name + "が終わりました" + (tm.label ? "（" + tm.label + "）" : "") + "。";
    try{ if(window.Notification && Notification.permission === "granted") new Notification("ARE タイマー", {body:msg}); }catch(_e){}
    if(kind === "count" || !kind){ tm.end = 0; tm.fired = false; tmSave(); showToast("⏰ " + msg); tmRepaint(); return; }
    const nx = tmNextPhase(kind, tm.cycle, tm.pomo);
    tm.kind = nx.kind; tm.cycle = nx.cycle; tm.end = Date.now() + nx.min * 60000; tm.fired = false; tmSave();
    showToast("⏰ " + msg + "次は " + TM_NAMES[nx.kind] + "（" + nx.min + "分）");
    tmRepaint();
}

function openTimer(){
    openSheet(toolHead("⏱️ タイマー", "カウントダウンとポモドーロ（作業と休憩をくり返す集中法）") + '<div id="tmBody"></div>' + toolClose());
    tmRepaint();
}
function tmRepaint(){
    const box = $("tmBody"); if(!box) return;
    const run = tm.end && tm.end > Date.now(), p = tm.pomo;
    box.innerHTML = '<div style="text-align:center"><div class="meta">' + (run ? escapeHtml((TM_NAMES[tm.kind] || "") + (tm.label ? " ・ " + tm.label : "")) : "停止中") + (tm.kind && tm.kind !== "count" && run ? "（" + tm.cycle + "回完了）" : "") + '</div><div id="tmBig" style="font-size:52px;font-weight:800;font-variant-numeric:tabular-nums">' + (run ? tmFmt(tm.end - Date.now()) : "0:00") + '</div></div>' +
        (run ? '<div class="row"><button type="button" class="button-danger" data-t="tm:stop">止める</button></div>' :
        '<b>カウントダウン</b><div class="row" style="justify-content:flex-start;flex-wrap:wrap">' + [1, 3, 5, 10, 15, 30, 60].map((m) => '<button type="button" class="button-secondary" data-t="tm:count" data-m="' + m + '">' + m + '分</button>').join("") + '</div>' +
        '<div class="row" style="justify-content:flex-start"><input id="tmMin" type="text" inputmode="numeric" placeholder="分" style="width:70px"><input id="tmLabel" type="text" maxlength="20" placeholder="名前（任意）" style="flex:1"><button type="button" data-t="tm:custom">開始</button></div>' +
        '<hr class="sep"><b>🍅 ポモドーロ</b><div class="row" style="justify-content:flex-start;flex-wrap:wrap"><label>作業 <input id="tmW" type="text" inputmode="numeric" value="' + p.work + '" style="width:48px">分</label><label>休憩 <input id="tmR" type="text" inputmode="numeric" value="' + p.rest + '" style="width:48px">分</label><label>長休憩 <input id="tmL" type="text" inputmode="numeric" value="' + p.long + '" style="width:48px">分</label></div>' +
        '<div class="row"><button type="button" class="button" data-t="tm:pomo">ポモドーロを始める</button></div>') +
        '<div class="meta">・終わると音・振動・通知（許可しているとき）でお知らせします。<br>・ブラウザを完全に閉じると鳴りません。<br>・<button type="button" class="button-secondary" data-t="tm:perm">通知を許可する</button></div>';
}

async function onTimerAction(action, node){
    const num = (id, d, lo, hi) => { const n = Number(($(id) || {}).value); return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n) : d; };
    if(action === "count" || action === "custom"){
        const m = action === "count" ? Number(node.dataset.m) : Number(($("tmMin").value || "").trim());
        if(!(m > 0 && m <= 600)){ showToast("1〜600分で入れてください。"); return; }
        const label = action === "custom" ? $("tmLabel").value.trim() : "";
        Object.assign(tm, {kind:"count", label, end:Date.now() + m * 60000, cycle:0, fired:false});
    }else if(action === "pomo"){
        tm.pomo = {work:num("tmW", 25, 1, 180), rest:num("tmR", 5, 1, 60), long:num("tmL", 15, 1, 120)};
        Object.assign(tm, {kind:"work", label:"", end:Date.now() + tm.pomo.work * 60000, cycle:0, fired:false});
    }else if(action === "stop"){
        Object.assign(tm, {end:0, fired:false, kind:"", cycle:0});
    }else if(action === "perm"){
        try{ const r = await Notification.requestPermission(); showToast(r === "granted" ? "通知を許可しました。" : "通知は許可されませんでした。"); }catch(_e){ showToast("このブラウザでは通知を使えません。"); }
        return;
    }else return;
    tmSave(); tmTick(); tmRepaint();
}
