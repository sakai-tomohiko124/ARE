"use strict";
// ===== 自分用ツール：日記（気分つき）／習慣トラッカー／家計簿 =====
// どれも自分だけが見られます（管理者を含め他の人には見えません）。データは Supabase に保存されるので、端末を変えても見られます。

const SELF_MOODS = ["", "😣", "😕", "😐", "🙂", "😄"];
const slf = {diary:[], habits:[], logs:[], budget:[], bm:"", dsel:""};
function initDiary(){ registerTool("dy", onDiaryAction); }
function initHabit(){ registerTool("hb", onHabitAction); }
function initBudget(){ registerTool("bg", onBudgetAction); }
const sq = () => requireClient();
const sErr = (e) => showToast(featError(e));
const monthKey = (d) => dayKey(d).slice(0, 7);
const yenS = (n) => Number(n).toLocaleString("ja-JP") + "円";

// ---------- 21 日記 ----------
async function openDiary(){
    openSheet(toolHead("📔 日記", "1日1つ。気分もいっしょに記録できます（自分だけが見られます）") + '<div id="dyBody"><div class="empty-list">読み込み中...</div></div>' + toolClose());
    await loadDiary();
}
async function loadDiary(){
    try{
        const r = await sq().from("user_diary").select("id,day,mood,body").order("day", {ascending:false}).limit(400);
        if(r.error) throw r.error;
        slf.diary = r.data || []; if(!slf.dsel) slf.dsel = dayKey(new Date());
        paintDiary();
    }catch(e){ if($("dyBody")) $("dyBody").innerHTML = '<div class="empty-list">' + escapeHtml(featError(e)) + '</div>'; }
}
function paintDiary(){
    const box = $("dyBody"); if(!box) return;
    const cur = slf.diary.find((x) => x.day === slf.dsel), today = dayKey(new Date());
    const moods = slf.diary.filter((x) => x.mood && x.day >= dayKey(new Date(Date.now() - 29 * 86400000)));
    const avg = moods.length ? moods.reduce((a, x) => a + x.mood, 0) / moods.length : null;
    box.innerHTML = '<label for="dyDay">日付</label><input id="dyDay" type="date" data-t="dy:pick" value="' + escapeHtml(slf.dsel) + '" max="' + today + '">' +
        '<div class="row" style="justify-content:flex-start" id="dyMoods">' + [1, 2, 3, 4, 5].map((n) => '<button type="button" class="' + (cur && cur.mood === n ? "" : "button-secondary") + '" data-t="dy:mood" data-m="' + n + '" aria-label="気分' + n + '">' + SELF_MOODS[n] + '</button>').join("") + '</div>' +
        '<textarea id="dyBodyTa" rows="6" maxlength="2000" placeholder="今日はどんな一日でしたか？">' + escapeHtml(cur ? cur.body : "") + '</textarea>' +
        '<div class="row"><button type="button" class="button" data-t="dy:save">保存</button>' + (cur ? '<button type="button" class="button-danger" data-t="dy:del">この日を削除</button>' : "") + '</div>' +
        (avg !== null ? '<div class="meta">直近30日の気分の平均：' + avg.toFixed(1) + '（' + moods.length + '日）</div>' : "") +
        '<hr class="sep"><input id="dyQ" type="text" placeholder="日記をさがす" data-live="1" data-t="dy:find"><div id="dyList">' + diaryList("") + '</div>' +
        '<div class="row"><button type="button" class="button-secondary" data-t="dy:csv">CSVで保存</button></div>';
}
function diaryList(q){
    const rows = slf.diary.filter((x) => !q || x.body.includes(q)).slice(0, 40);
    return rows.length ? rows.map((x) => '<button type="button" class="admin-card more-item" data-t="dy:go" data-d="' + escapeHtml(x.day) + '"><b>' + escapeHtml(x.day) + '</b> ' + (SELF_MOODS[x.mood] || "") + '<small class="meta">' + escapeHtml(x.body.slice(0, 50)) + '</small></button>').join("") : '<div class="empty-list">まだありません。</div>';
}
async function onDiaryAction(action, node){
    try{
        if(action === "pick"){ slf.dsel = node.value || dayKey(new Date()); paintDiary(); return; }
        if(action === "go"){ slf.dsel = node.dataset.d; paintDiary(); return; }
        if(action === "find"){ $("dyList").innerHTML = diaryList(node.value.trim()); return; }
        if(action === "mood"){
            const m = Number(node.dataset.m), cur = slf.diary.find((x) => x.day === slf.dsel), body = $("dyBodyTa").value;
            await diarySave(slf.dsel, cur && cur.mood === m ? null : m, body); return;
        }
        if(action === "save"){
            const cur = slf.diary.find((x) => x.day === slf.dsel);
            const body = $("dyBodyTa").value;
            if(!body.trim() && !(cur && cur.mood)){ showToast("書くか、気分を選んでください。"); return; }
            await diarySave(slf.dsel, cur ? cur.mood : null, body); showToast("保存しました。"); return;
        }
        if(action === "del"){
            const r = await sq().from("user_diary").delete().eq("day", slf.dsel).eq("user_id", state.user.id); if(r.error) throw r.error;
            await loadDiary(); return;
        }
        if(action === "csv"){
            const t = "﻿日付,気分,本文\r\n" + slf.diary.map((x) => [x.day, x.mood || "", '"' + x.body.replace(/"/g, '""') + '"'].join(",")).join("\r\n");
            downloadBlob(new Blob([t], {type:"text/csv;charset=utf-8"}), "ARE-日記.csv");
        }
    }catch(e){ sErr(e); }
}
async function diarySave(day, mood, body){
    const r = await sq().from("user_diary").upsert({user_id:state.user.id, day, mood, body, updated_at:new Date().toISOString()}, {onConflict:"user_id,day"});
    if(r.error) throw r.error;
    await loadDiary();
}

// ---------- 22 習慣トラッカー ----------
async function openHabit(){
    openSheet(toolHead("✅ 習慣トラッカー", "毎日の習慣をチェック。連続日数が増えます（自分だけが見られます）") + '<div id="hbBody"><div class="empty-list">読み込み中...</div></div>' + toolClose());
    await loadHabit();
}
async function loadHabit(){
    try{
        const since = dayKey(new Date(Date.now() - 120 * 86400000));
        const [a, b] = await Promise.all([sq().from("user_habits").select("id,name,emoji,archived").eq("archived", false).order("created_at"), sq().from("user_habit_logs").select("habit_id,day").gte("day", since).limit(5000)]);
        if(a.error) throw a.error; if(b.error) throw b.error;
        slf.habits = a.data || []; slf.logs = b.data || []; paintHabit();
    }catch(e){ if($("hbBody")) $("hbBody").innerHTML = '<div class="empty-list">' + escapeHtml(featError(e)) + '</div>'; }
}
/** 今日（またはきのう）から数えた連続日数 */
function habitStreak(days, today){
    const set = new Set(days); let d = new Date(today + "T00:00:00"), n = 0;
    if(!set.has(dayKey(d))) d = new Date(d.getTime() - 86400000);
    while(set.has(dayKey(d))){ n++; d = new Date(d.getTime() - 86400000); }
    return n;
}
function paintHabit(){
    const box = $("hbBody"); if(!box) return;
    const today = dayKey(new Date()), week = [];
    for(let i = 6; i >= 0; i--) week.push(dayKey(new Date(Date.now() - i * 86400000)));
    box.innerHTML = (slf.habits.length ? slf.habits.map((h) => {
        const days = slf.logs.filter((l) => l.habit_id === h.id).map((l) => l.day), done = days.includes(today);
        return '<div class="admin-card"><div class="row" style="justify-content:space-between"><b>' + escapeHtml(h.emoji) + ' ' + escapeHtml(h.name) + '</b><span>🔥 ' + habitStreak(days, today) + '日</span></div>' +
            '<div class="row" style="justify-content:flex-start">' + week.map((d) => '<button type="button" class="' + (days.includes(d) ? "" : "button-secondary") + '" style="padding:4px 8px;min-width:34px" data-t="hb:toggle" data-h="' + escapeHtml(h.id) + '" data-d="' + d + '" aria-pressed="' + days.includes(d) + '" title="' + d + '">' + Number(d.slice(8)) + '</button>').join("") + '</div>' +
            '<div class="row"><button type="button" class="' + (done ? "button-secondary" : "button") + '" data-t="hb:toggle" data-h="' + escapeHtml(h.id) + '" data-d="' + today + '">' + (done ? "今日は済み（取り消す）" : "今日やった！") + '</button><button type="button" class="button-secondary" data-t="hb:arch" data-h="' + escapeHtml(h.id) + '">やめる</button></div></div>';
    }).join("") : '<div class="empty-list">まだ習慣がありません。下から追加しましょう。</div>') +
        '<hr class="sep"><div class="row" style="justify-content:flex-start"><input id="hbEmoji" type="text" maxlength="2" value="✅" style="width:56px" aria-label="絵文字"><input id="hbName" type="text" maxlength="30" placeholder="例：水を2L飲む" style="flex:1"><button type="button" class="button" data-t="hb:add">追加</button></div>';
}
async function onHabitAction(action, node){
    try{
        if(action === "add"){
            const name = $("hbName").value.trim(); if(!name){ showToast("習慣の名前を入れてください。"); return; }
            if(slf.habits.length >= 20){ showToast("習慣は20個までです。"); return; }
            const r = await sq().from("user_habits").insert({user_id:state.user.id, name, emoji:($("hbEmoji").value.trim() || "✅").slice(0, 8)}); if(r.error) throw r.error;
        }else if(action === "toggle"){
            const h = node.dataset.h, d = node.dataset.d;
            if(d > dayKey(new Date())){ showToast("未来の日は記録できません。"); return; }
            const on = slf.logs.some((l) => l.habit_id === h && l.day === d);
            const r = on ? await sq().from("user_habit_logs").delete().eq("habit_id", h).eq("day", d) : await sq().from("user_habit_logs").insert({habit_id:h, user_id:state.user.id, day:d});
            if(r.error) throw r.error;
        }else if(action === "arch"){
            if(!confirm("この習慣をやめますか？（記録は残ります）")) return;
            const r = await sq().from("user_habits").update({archived:true}).eq("id", node.dataset.h); if(r.error) throw r.error;
        }else return;
        await loadHabit();
    }catch(e){ sErr(e); }
}

// ---------- 23 家計簿 ----------
const BUDGET_CATS = ["食費", "日用品", "交通", "趣味", "交際", "住まい", "通信", "その他"];
async function openBudget(){
    slf.bm = monthKey(new Date());
    openSheet(toolHead("💴 家計簿", "収入と支出を記録して、月ごとに集計します（自分だけが見られます）") + '<div id="bgBody"><div class="empty-list">読み込み中...</div></div>' + toolClose());
    await loadBudget();
}
async function loadBudget(){
    try{
        const y = Number(slf.bm.slice(0, 4)), m = Number(slf.bm.slice(5));
        const from = slf.bm + "-01", to = dayKey(new Date(y, m, 1));
        const r = await sq().from("user_budget").select("id,day,kind,amount,category,note").gte("day", from).lt("day", to).order("day", {ascending:false}).limit(500);
        if(r.error) throw r.error;
        slf.budget = r.data || []; paintBudget();
    }catch(e){ if($("bgBody")) $("bgBody").innerHTML = '<div class="empty-list">' + escapeHtml(featError(e)) + '</div>'; }
}
function budgetSummary(rows){
    const out = rows.filter((x) => x.kind === "out"), inn = rows.filter((x) => x.kind === "in");
    const sum = (a) => a.reduce((s, x) => s + x.amount, 0), cats = {};
    out.forEach((x) => { cats[x.category] = (cats[x.category] || 0) + x.amount; });
    return {out:sum(out), inn:sum(inn), balance:sum(inn) - sum(out), cats:Object.entries(cats).sort((a, b) => b[1] - a[1])};
}
function paintBudget(){
    const box = $("bgBody"); if(!box) return;
    const S = budgetSummary(slf.budget), today = dayKey(new Date()), max = Math.max(1, ...S.cats.map((c) => c[1]));
    box.innerHTML = '<div class="row" style="justify-content:space-between"><button type="button" class="button-secondary" data-t="bg:prev" aria-label="前の月">◀</button><b>' + escapeHtml(slf.bm.replace("-", "年")) + '月</b><button type="button" class="button-secondary" data-t="bg:next" aria-label="次の月">▶</button></div>' +
        '<div class="co-sum"><div><b>' + yenS(S.inn) + '</b><small>収入</small></div><div><b>' + yenS(S.out) + '</b><small>支出</small></div><div><b style="color:' + (S.balance < 0 ? "var(--danger)" : "inherit") + '">' + yenS(S.balance) + '</b><small>収支</small></div></div>' +
        (S.cats.length ? '<b>支出の内訳</b>' + S.cats.map((c) => '<div class="meta">' + escapeHtml(c[0]) + ' ' + yenS(c[1]) + '（' + Math.round(c[1] / S.out * 100) + '%）</div><div style="height:8px;border-radius:4px;background:var(--accent,#4c6ef5);width:' + Math.round(c[1] / max * 100) + '%"></div>').join("") : "") +
        '<hr class="sep"><b>記録する</b><div class="row" style="justify-content:flex-start"><select id="bgKind" class="status-select"><option value="out">支出</option><option value="in">収入</option></select><input id="bgAmt" type="text" inputmode="numeric" placeholder="金額（円）" style="width:40%"></div>' +
        '<div class="row" style="justify-content:flex-start"><select id="bgCat" class="status-select">' + BUDGET_CATS.map((c) => '<option>' + c + '</option>').join("") + '</select><input id="bgDay" type="date" value="' + today + '" max="' + today + '"></div>' +
        '<input id="bgNote" type="text" maxlength="60" placeholder="メモ（任意）"><div class="row"><button type="button" class="button" data-t="bg:add">記録する</button></div>' +
        '<hr class="sep">' + (slf.budget.length ? slf.budget.map((x) => '<div class="admin-card"><b>' + escapeHtml(x.day.slice(5)) + '</b> ' + (x.kind === "out" ? "−" : "＋") + yenS(x.amount) + ' <span class="meta">' + escapeHtml(x.category) + (x.note ? ' ・ ' + escapeHtml(x.note) : "") + '</span> <button type="button" class="button-secondary" style="float:right" data-t="bg:del" data-id="' + escapeHtml(x.id) + '" aria-label="削除">🗑️</button></div>').join("") : '<div class="empty-list">この月の記録はありません。</div>') +
        '<div class="row"><button type="button" class="button-secondary" data-t="bg:csv">この月をCSVで保存</button></div>';
}
async function onBudgetAction(action, node){
    try{
        if(action === "prev" || action === "next"){
            const y = Number(slf.bm.slice(0, 4)), m = Number(slf.bm.slice(5)) - 1 + (action === "next" ? 1 : -1);
            slf.bm = monthKey(new Date(y, m, 1)); await loadBudget(); return;
        }
        if(action === "add"){
            const amt = Number(($("bgAmt").value || "").replace(/[，,円\s]/g, ""));
            if(!Number.isInteger(amt) || amt < 1 || amt > 100000000){ showToast("金額は1〜1億の整数で入れてください。"); return; }
            const r = await sq().from("user_budget").insert({user_id:state.user.id, day:$("bgDay").value || dayKey(new Date()), kind:$("bgKind").value, amount:amt, category:$("bgCat").value, note:$("bgNote").value.trim() || null});
            if(r.error) throw r.error;
            const d = ($("bgDay").value || "").slice(0, 7); if(d && d !== slf.bm) slf.bm = d;
        }else if(action === "del"){
            const r = await sq().from("user_budget").delete().eq("id", node.dataset.id); if(r.error) throw r.error;
        }else if(action === "csv"){
            const t = "﻿日付,種類,金額,カテゴリ,メモ\r\n" + slf.budget.map((x) => [x.day, x.kind === "out" ? "支出" : "収入", x.amount, x.category, '"' + String(x.note || "").replace(/"/g, '""') + '"'].join(",")).join("\r\n");
            downloadBlob(new Blob([t], {type:"text/csv;charset=utf-8"}), "ARE-家計簿-" + slf.bm + ".csv"); return;
        }else return;
        await loadBudget();
    }catch(e){ sErr(e); }
}
