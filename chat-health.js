"use strict";
// ===== ヘルス記録（体重・睡眠・歩数・気分。自分だけが見られます。医療的な判断はしません）=====
feat.hl = {rows:[]};
function initHealth(){ registerTool("hl", onHlAction); }

async function openHealth(){
    openSheet(toolHead("❤️ ヘルス記録", "体重・睡眠・歩数・気分を記録します。自分だけが見られます（管理者を含め他の人には見えません）。") +
        '<div id="hlBody"><div class="empty-list">読み込み中...</div></div>' + toolClose());
    await loadHealth();
}
async function loadHealth(){
    try{
        const since = new Date(Date.now() - 90 * 86400000);
        const r = await requireClient().from("user_health_logs").select("id,day,weight_kg,sleep_h,steps,mood,note").gte("day", dayKey(since)).order("day", {ascending:false}).order("created_at", {ascending:false}).limit(500);
        if(r.error) throw r.error;
        feat.hl.rows = r.data || [];
        paintHealth();
    }catch(error){ if($("hlBody")) $("hlBody").innerHTML = '<div class="empty-list">' + escapeHtml(featError(error)) + '</div>'; }
}
function hlAvg(rows, key, days){
    const from = dayKey(new Date(Date.now() - (days - 1) * 86400000));
    const v = rows.filter((r) => r.day >= from && r[key] !== null && r[key] !== undefined).map((r) => Number(r[key]));
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
function hlBars(rows, key, color){
    const now = new Date(), days = [];
    for(let i = 13; i >= 0; i--){ const k = dayKey(new Date(now.getTime() - i * 86400000)); const r = rows.find((x) => x.day === k && x[key] !== null && x[key] !== undefined); days.push([k, r ? Number(r[key]) : 0]); }
    const max = Math.max(1, ...days.map((d) => d[1]));
    return '<div class="co-bars">' + days.map((d) => '<div class="co-bar" title="' + escapeHtml(d[0]) + '：' + d[1] + '"><i style="height:' + Math.round(d[1] / max * 100) + '%"></i><span>' + Number(d[0].slice(8)) + '</span></div>').join("") + '</div>';
}
function paintHealth(){
    const box = $("hlBody"); if(!box) return;
    const rows = feat.hl.rows, today = dayKey(new Date());
    const f = (n, d) => n === null ? "-" : n.toFixed(d);
    const w7 = hlAvg(rows, "weight_kg", 7), w30 = hlAvg(rows, "weight_kg", 30);
    const moods = ["", "😣", "😕", "😐", "🙂", "😄"];
    box.innerHTML = '<div class="co-sum"><div><b>' + f(w7, 1) + '</b><small>体重 7日平均(kg)</small></div><div><b>' + f(hlAvg(rows, "sleep_h", 7), 1) + '</b><small>睡眠 7日平均(h)</small></div><div><b>' + (hlAvg(rows, "steps", 7) === null ? "-" : Math.round(hlAvg(rows, "steps", 7))) + '</b><small>歩数 7日平均</small></div></div>' +
        (w7 !== null && w30 !== null ? '<div class="meta">体重：直近7日平均は30日平均より ' + (w7 - w30 >= 0 ? "+" : "") + (w7 - w30).toFixed(1) + 'kg</div>' : "") +
        '<b>歩数（14日）</b>' + hlBars(rows, "steps") + '<b>睡眠（14日・時間）</b>' + hlBars(rows, "sleep_h") +
        '<hr class="sep"><b>記録する（入れた項目だけ保存）</b><label for="hlDay">日付</label><input id="hlDay" type="date" value="' + today + '" max="' + today + '">' +
        '<div class="row" style="justify-content:flex-start"><input id="hlW" type="text" inputmode="decimal" placeholder="体重 kg" style="width:30%"><input id="hlS" type="text" inputmode="decimal" placeholder="睡眠 時間" style="width:30%"><input id="hlSt" type="text" inputmode="numeric" placeholder="歩数" style="width:30%"></div>' +
        '<label for="hlM">気分</label><select id="hlM" class="status-select"><option value="">（記録しない）</option>' + [5, 4, 3, 2, 1].map((n) => '<option value="' + n + '">' + moods[n] + ' ' + n + '</option>').join("") + '</select>' +
        '<input id="hlNote" type="text" maxlength="100" placeholder="メモ（任意）"><div class="row"><button type="button" class="button" data-t="hl:add">記録する</button></div>' +
        '<hr class="sep"><b>最近の記録</b>' + (rows.length ? rows.slice(0, 30).map((r) => '<div class="admin-card"><b>' + escapeHtml(r.day) + '</b> ' + (r.weight_kg !== null ? "⚖️" + Number(r.weight_kg) + "kg " : "") + (r.sleep_h !== null ? "😴" + Number(r.sleep_h) + "h " : "") + (r.steps !== null ? "👟" + r.steps + " " : "") + (r.mood ? moods[r.mood] : "") + (r.note ? '<div class="meta">' + escapeHtml(r.note) + '</div>' : "") + '<div class="row"><button type="button" class="button-secondary" data-t="hl:del" data-id="' + escapeHtml(r.id) + '">削除</button></div></div>').join("") : '<div class="empty-list">まだ記録がありません。</div>') +
        '<div class="row"><button type="button" class="button-secondary" data-t="hl:csv">CSVで保存</button></div><div class="meta">この記録は健康の目安づくり用です。体調に不安があるときは医療機関に相談してください。</div>';
}
function hlNum(id, min, max){
    const t = ($(id).value || "").trim(); if(t === "") return null;
    const n = Number(t.replace(/[，,]/g, ""));
    return Number.isFinite(n) && n >= min && n <= max ? n : NaN;
}
async function onHlAction(action, node){
    try{
        if(action === "add"){
            const w = hlNum("hlW", 1, 499), s = hlNum("hlS", 0, 24), st = hlNum("hlSt", 0, 200000), m = $("hlM").value ? Number($("hlM").value) : null;
            if([w, s, st].some((x) => Number.isNaN(x))){ showToast("数値の範囲を確認してください（体重1〜499、睡眠0〜24、歩数0〜20万）。"); return; }
            if(w === null && s === null && st === null && m === null){ showToast("どれか1つ入力してください。"); return; }
            const r = await requireClient().from("user_health_logs").insert({user_id:state.user.id, day:$("hlDay").value || dayKey(new Date()), weight_kg:w, sleep_h:s, steps:st === null ? null : Math.round(st), mood:m, note:($("hlNote").value || "").trim() || null});
            if(r.error) throw r.error;
            showToast("記録しました。");
        }else if(action === "del"){
            const r = await requireClient().from("user_health_logs").delete().eq("id", node.dataset.id);
            if(r.error) throw r.error;
        }else if(action === "csv"){
            const text = "﻿日付,体重kg,睡眠h,歩数,気分,メモ\r\n" + feat.hl.rows.map((r) => [r.day, r.weight_kg ?? "", r.sleep_h ?? "", r.steps ?? "", r.mood ?? "", '"' + String(r.note || "").replace(/"/g, '""') + '"'].join(",")).join("\r\n");
            downloadBlob(new Blob([text], {type:"text/csv;charset=utf-8"}), "ARE-ヘルス記録.csv"); return;
        }else return;
        await loadHealth();
    }catch(error){ showToast(featError(error)); }
}
