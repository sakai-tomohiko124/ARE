"use strict";
// ===== みんなで遊ぶ：じゃんけん・ルーレット・あみだくじ =====
// どれも「ずるができない」ように、結果は暗号用の乱数で決め、結果をチャットに貼って全員で見られます。

const fun = {rr:null, am:null};
function funRand(n){ const a = new Uint32Array(1); const lim = Math.floor(4294967296 / n) * n; do{ crypto.getRandomValues(a); }while(a[0] >= lim); return a[0] % n; }
function funMembers(){
    const room = state.currentRoom; if(!room) return [];
    const ids = (room.memberIds && room.memberIds.length) ? room.memberIds : [state.user.id].concat(room.partner ? [room.partner.id] : []);
    return Array.from(new Set(ids)).map((id) => ({id, name:id === state.user.id ? profileDisplayName(state.profile) : profileDisplayName(feat.known.get(id) || (room.partner && room.partner.id === id ? room.partner : {id}))}));
}
function initFun(){ registerTool("fun", onFunAction); }

function openFun(){
    if(!state.currentRoom){ showToast("先にチャットを開いてください。"); return; }
    openSheet(toolHead("🎲 じゃんけん・ルーレット・あみだ", "決めごとに。結果はチャットに貼れます") +
        '<button type="button" class="admin-card more-item" data-t="fun:jk">✊ じゃんけん<small class="meta">このチャットの全員分を、いっせいに決めます</small></button>' +
        '<button type="button" class="admin-card more-item" data-t="fun:rr">🎡 ルーレット<small class="meta">選択肢から1つ選ぶ</small></button>' +
        '<button type="button" class="admin-card more-item" data-t="fun:am">🪜 あみだくじ<small class="meta">人と当たりを、あみだでむすぶ</small></button>' + toolClose());
}

// ---- じゃんけん ----
const JK = ["✊", "✌️", "✋"];
/** 勝者のインデックス一覧（あいこなら空）。0=グー 1=チョキ 2=パー */
function jkWinners(hands){
    const set = new Set(hands);
    if(set.size !== 2) return [];
    const [a, b] = Array.from(set), win = (a + 1) % 3 === b ? a : b;   // グー(0)はチョキ(1)に勝つ
    return hands.map((h, i) => h === win ? i : -1).filter((i) => i >= 0);
}
function jkPlay(){
    const ms = funMembers();
    if(ms.length < 2){ showToast("2人以上のチャットで使えます。"); return; }
    fun.jk = ms.map((m) => ({m, h:funRand(3)}));
    jkPaint();
}
function jkPaint(){
    const w = jkWinners(fun.jk.map((x) => x.h));
    const verdict = w.length ? "🏆 " + w.map((i) => fun.jk[i].m.name).join("、") + " の勝ち！" : "あいこ…もう一回！";
    openSheet(toolHead("✊ じゃんけん") + '<div class="vs-words">' + fun.jk.map((x, i) => '<div class="admin-card" style="' + (w.includes(i) ? "outline:2px solid #ffd54a" : "") + '"><span style="font-size:28px">' + JK[x.h] + '</span> ' + escapeHtml(x.m.name) + '</div>').join("") + '</div><div class="admin-card"><b>' + verdict + '</b></div>' +
        '<div class="row"><button type="button" class="button-secondary" data-t="fun:jk">もう一回</button><button type="button" data-t="fun:jksend">チャットに貼る</button></div>');
    fun.jkText = "✊✌️✋ じゃんけん\n" + fun.jk.map((x) => JK[x.h] + " " + x.m.name).join("\n") + "\n→ " + (w.length ? w.map((i) => fun.jk[i].m.name).join("、") + " の勝ち！" : "あいこ");
}

// ---- ルーレット ----
function rrOpen(){
    openSheet(toolHead("🎡 ルーレット", "選択肢を1行に1つ（2〜20個）") + '<textarea id="rrOpts" rows="5" placeholder="ラーメン&#10;カレー&#10;うどん">' + escapeHtml(fun.rrText || "") + '</textarea><div id="rrView" class="admin-card" style="text-align:center;font-size:24px;min-height:1.6em"></div><div class="row"><button type="button" data-t="fun:rrspin">まわす</button><button type="button" class="button-secondary" data-t="fun:rrsend" id="rrSend" disabled>チャットに貼る</button></div>');
}
function rrSpin(){
    const opts = ($("rrOpts").value || "").split(/\n/).map((x) => x.trim()).filter(Boolean).slice(0, 20);
    if(opts.length < 2){ showToast("2つ以上入れてください。"); return; }
    fun.rrText = opts.join("\n");
    const pick = funRand(opts.length), view = $("rrView"), send = $("rrSend"); send.disabled = true;
    let step = 0; const total = 18 + pick;   // 最後に pick で止まる
    const tick = () => {
        if(!$("rrView")) return;
        const cur = (step % opts.length);
        view.textContent = opts[cur];
        if(step >= total && cur === pick){ view.innerHTML = '🎯 <b>' + escapeHtml(opts[pick]) + '</b>'; fun.rrResult = {opts, pick}; send.disabled = false; return; }
        step++; setTimeout(tick, 60 + Math.min(260, step * 8));
    };
    tick();
}

// ---- あみだくじ ----
function amOpen(){
    const ms = funMembers();
    openSheet(toolHead("🪜 あみだくじ", "上が人、下が当たり（同じ数）。1行に1つ") + '<label for="amTop">人（上）</label><textarea id="amTop" rows="4">' + escapeHtml(ms.map((m) => m.name).join("\n")) + '</textarea>' +
        '<label for="amBot">当たり・役割（下）</label><textarea id="amBot" rows="4" placeholder="当たり&#10;はずれ">' + escapeHtml(fun.amBot || "") + '</textarea><div class="row"><button type="button" data-t="fun:amgo">あみだを作る</button></div><div id="amOut"></div>');
}
function amBuild(n, rows){
    // 横線：各段でとなり合う縦線をむすぶ（同じ段で隣り合う線は連続させない）
    const rungs = [];
    for(let r = 0; r < rows; r++){
        const row = []; let prev = false;
        for(let c = 0; c < n - 1; c++){ const on = !prev && funRand(100) < 45; row.push(on); prev = on; }
        rungs.push(row);
    }
    return rungs;
}
function amTrace(rungs, start){
    let c = start; const path = [[c, 0]];
    rungs.forEach((row, r) => {
        if(c < row.length && row[c]){ path.push([c, r + 0.5]); c++; path.push([c, r + 0.5]); }
        else if(c > 0 && row[c - 1]){ path.push([c, r + 0.5]); c--; path.push([c, r + 0.5]); }
    });
    path.push([c, rungs.length]);
    return {end:c, path};
}
function amGo(){
    const tops = ($("amTop").value || "").split(/\n/).map((x) => x.trim()).filter(Boolean), bots = ($("amBot").value || "").split(/\n/).map((x) => x.trim()).filter(Boolean);
    if(tops.length < 2 || tops.length > 12){ showToast("人は2〜12人で入れてください。"); return; }
    if(tops.length !== bots.length){ showToast("上（" + tops.length + "）と下（" + bots.length + "）の数をそろえてください。"); return; }
    fun.amBot = bots.join("\n");
    const rows = 10 + tops.length, rungs = amBuild(tops.length, rows);
    const res = tops.map((t, i) => ({name:t, i, ...amTrace(rungs, i)}));
    fun.am = {tops, bots, rungs, res};
    const W = 300, H = 220, colW = W / tops.length, x = (c) => colW * (c + 0.5), y = (r) => 18 + r / rows * (H - 36);
    const lines = tops.map((_, c) => '<line x1="' + x(c) + '" y1="18" x2="' + x(c) + '" y2="' + (H - 18) + '" stroke="currentColor" stroke-width="2"/>').join("") +
        rungs.map((row, r) => row.map((on, c) => on ? '<line x1="' + x(c) + '" y1="' + y(r + 0.5) + '" x2="' + x(c + 1) + '" y2="' + y(r + 0.5) + '" stroke="currentColor" stroke-width="2"/>' : "").join("")).join("");
    const colors = ["#e03131", "#1971c2", "#2f9e44", "#f08c00", "#9c36b5", "#0c8599", "#e8590c", "#5f3dc4", "#c2255c", "#495057", "#66a80f", "#862e9c"];
    const paths = res.map((r) => '<polyline fill="none" stroke="' + colors[r.i % 12] + '" stroke-width="4" stroke-linejoin="round" opacity="0.85" points="' + r.path.map((p) => x(p[0]) + "," + y(p[1])).join(" ") + '"/>').join("");
    $("amOut").innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="あみだくじ">' + lines + paths +
        tops.map((t, c) => '<text x="' + x(c) + '" y="12" font-size="10" text-anchor="middle" fill="' + colors[c % 12] + '">' + escapeHtml(Array.from(t).slice(0, 4).join("")) + '</text>').join("") +
        bots.map((b, c) => '<text x="' + x(c) + '" y="' + (H - 4) + '" font-size="10" text-anchor="middle" fill="currentColor">' + escapeHtml(Array.from(b).slice(0, 4).join("")) + '</text>').join("") + '</svg>' +
        res.map((r) => '<div class="admin-card"><b style="color:' + colors[r.i % 12] + '">' + escapeHtml(r.name) + '</b> → ' + escapeHtml(bots[r.end]) + '</div>').join("") + '<div class="row"><button type="button" data-t="fun:amsend">結果をチャットに貼る</button></div>';
}

async function onFunAction(action){
    if(action === "jk"){ jkPlay(); return; }
    if(action === "jksend"){ await sendMessagePayload({type:"text", text:fun.jkText}, {keepInput:true}); closeSheet(); return; }
    if(action === "rr"){ rrOpen(); return; }
    if(action === "rrspin"){ rrSpin(); return; }
    if(action === "rrsend" && fun.rrResult){ await sendMessagePayload({type:"text", text:"🎡 ルーレット\n（" + fun.rrResult.opts.join("／") + "）\n→ " + fun.rrResult.opts[fun.rrResult.pick]}, {keepInput:true}); closeSheet(); return; }
    if(action === "am"){ amOpen(); return; }
    if(action === "amgo"){ amGo(); return; }
    if(action === "amsend" && fun.am){ await sendMessagePayload({type:"text", text:"🪜 あみだくじ\n" + fun.am.res.map((r) => r.name + " → " + fun.am.bots[r.end]).join("\n")}, {keepInput:true}); closeSheet(); }
}
