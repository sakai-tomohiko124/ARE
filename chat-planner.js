"use strict";
// ===== タスク・カレンダー（自分だけが見られる。サーバー側のルールで他人からは読めません）=====

feat.pl = {tasks:[], events:[], month:null, day:"", tab:"cal"};

function initPlanner(){ registerTool("pl", onPlannerAction); }

async function openPlanner(){
    const now = new Date();
    feat.pl.month = new Date(now.getFullYear(), now.getMonth(), 1);
    feat.pl.day = dayKey(now);
    feat.pl.tab = "cal";
    openSheet(toolHead("📅 タスク・カレンダー", "あなただけが見られます（管理者を含め、他の人には表示されません）。") +
        '<div class="row" style="justify-content:flex-start"><button type="button" class="button" data-t="pl:tab" data-tab="cal">カレンダー</button><button type="button" class="button-secondary" data-t="pl:tab" data-tab="task">タスク</button></div>' +
        '<div id="plBody"><div class="empty-list">読み込み中...</div></div>' + toolClose());
    await loadPlanner();
}

async function loadPlanner(){
    const client = requireClient();
    try{
        const [tasks, events] = await Promise.all([
            client.from("user_tasks").select("id,title,due_on,done,created_at").order("done", {ascending:true}).order("due_on", {ascending:true, nullsFirst:false}).limit(500),
            client.from("user_events").select("id,title,starts_at,note").order("starts_at", {ascending:true}).limit(500)
        ]);
        if(tasks.error) throw tasks.error;
        if(events.error) throw events.error;
        feat.pl.tasks = tasks.data || [];
        feat.pl.events = events.data || [];
        paintPlanner();
    }catch(error){ if($("plBody")) $("plBody").innerHTML = '<div class="empty-list">' + escapeHtml(featError(error)) + '</div>'; }
}

function paintPlanner(){
    if(!$("plBody")) return;
    document.querySelectorAll("[data-t='pl:tab']").forEach((b) => { b.className = b.dataset.tab === feat.pl.tab ? "button" : "button-secondary"; });
    $("plBody").innerHTML = feat.pl.tab === "cal" ? calendarHtml() : tasksHtml();
}

function calendarHtml(){
    const p = feat.pl, y = p.month.getFullYear(), m = p.month.getMonth();
    const marks = new Map();
    p.events.forEach((e) => { const k = dayKey(e.starts_at); marks.set(k, (marks.get(k) || 0) + 1); });
    p.tasks.filter((t) => t.due_on && !t.done).forEach((t) => { marks.set(t.due_on, (marks.get(t.due_on) || 0) + 1); });
    const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), today = dayKey(new Date());
    let cells = "";
    for(let i = 0; i < first; i++) cells += "<span></span>";
    for(let d = 1; d <= days; d++){
        const key = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
        cells += '<button type="button" class="cal-day' + (key === p.day ? " sel" : "") + (key === today ? " today" : "") + '" data-t="pl:day" data-d="' + key + '">' + d + (marks.has(key) ? '<i class="cal-dot"></i>' : "") + '</button>';
    }
    const dayEvents = p.events.filter((e) => dayKey(e.starts_at) === p.day);
    const dayTasks = p.tasks.filter((t) => t.due_on === p.day);
    return '<div class="row" style="justify-content:space-between;align-items:center"><button type="button" class="button-secondary" data-t="pl:prev">◀</button><b>' + y + '年' + (m + 1) + '月</b><button type="button" class="button-secondary" data-t="pl:next">▶</button></div>' +
        '<div class="cal-grid">' + ["日", "月", "火", "水", "木", "金", "土"].map((w) => '<small class="meta">' + w + '</small>').join("") + cells + '</div>' +
        '<b>' + escapeHtml(p.day) + ' の予定</b>' +
        (dayEvents.length || dayTasks.length ? dayEvents.map((e) => '<div class="admin-card"><b>' + escapeHtml(new Date(e.starts_at).toLocaleTimeString("ja-JP", {hour:"2-digit", minute:"2-digit"})) + '</b> ' + escapeHtml(e.title) + (e.note ? '<div class="meta">' + escapeHtml(e.note) + '</div>' : "") +
            '<div class="row"><button type="button" class="button-secondary" data-t="pl:delev" data-id="' + escapeHtml(e.id) + '">削除</button></div></div>').join("") +
            dayTasks.map((t) => '<div class="admin-card">☑ タスク：' + escapeHtml(t.title) + (t.done ? "（完了）" : "") + '</div>').join("") : '<div class="empty-list">この日の予定はありません。</div>') +
        '<hr class="sep"><b>予定を追加</b>' +
        '<input id="plEvTitle" type="text" maxlength="100" placeholder="予定の名前（100文字まで）">' +
        '<label>日時 <input id="plEvAt" type="datetime-local" value="' + escapeHtml(p.day) + 'T09:00"></label>' +
        '<input id="plEvNote" type="text" maxlength="300" placeholder="メモ（任意・300文字まで）">' +
        '<div class="row"><button type="button" class="button" data-t="pl:addev">予定を追加</button></div>';
}

function tasksHtml(){
    const tasks = feat.pl.tasks, today = dayKey(new Date());
    return '<div class="row" style="justify-content:flex-start;flex-wrap:nowrap"><input id="plTaskTitle" type="text" maxlength="100" placeholder="やること（100文字まで）"><input id="plTaskDue" type="date" aria-label="期限（任意）"></div>' +
        '<div class="row"><button type="button" class="button" data-t="pl:addtask">タスクを追加</button></div>' +
        (tasks.length ? tasks.map((t) => {
            const late = t.due_on && !t.done && t.due_on < today;
            return '<div class="admin-card pl-task' + (t.done ? " done" : "") + '"><label><input type="checkbox" data-t="pl:toggle" data-id="' + escapeHtml(t.id) + '"' + (t.done ? " checked" : "") + '> ' + escapeHtml(t.title) + '</label>' +
                (t.due_on ? '<div class="meta"' + (late ? ' style="color:var(--danger)"' : "") + '>期限：' + escapeHtml(t.due_on) + (late ? "（過ぎています）" : "") + '</div>' : "") +
                '<div class="row"><button type="button" class="button-secondary" data-t="pl:deltask" data-id="' + escapeHtml(t.id) + '">削除</button></div></div>';
        }).join("") : '<div class="empty-list">タスクはまだありません。</div>');
}

async function onPlannerAction(action, node){
    const p = feat.pl, client = requireClient();
    if(action === "tab"){ p.tab = node.dataset.tab; paintPlanner(); return; }
    if(action === "prev" || action === "next"){ p.month = new Date(p.month.getFullYear(), p.month.getMonth() + (action === "next" ? 1 : -1), 1); paintPlanner(); return; }
    if(action === "day"){ p.day = node.dataset.d; paintPlanner(); return; }
    try{
        if(action === "addev"){
            const title = ($("plEvTitle").value || "").trim(), at = $("plEvAt").value;
            if(!title){ showToast("予定の名前を入力してください。"); return; }
            const when = new Date(at);
            if(!at || Number.isNaN(when.getTime())){ showToast("日時を入力してください。"); return; }
            const result = await client.from("user_events").insert({user_id:state.user.id, title, starts_at:when.toISOString(), note:($("plEvNote").value || "").trim() || null});
            if(result.error) throw result.error;
            p.day = dayKey(when); p.month = new Date(when.getFullYear(), when.getMonth(), 1);
        }else if(action === "delev"){
            const result = await client.from("user_events").delete().eq("id", node.dataset.id);
            if(result.error) throw result.error;
        }else if(action === "addtask"){
            const title = ($("plTaskTitle").value || "").trim(), due = $("plTaskDue").value || null;
            if(!title){ showToast("やることを入力してください。"); return; }
            const result = await client.from("user_tasks").insert({user_id:state.user.id, title, due_on:due});
            if(result.error) throw result.error;
        }else if(action === "toggle"){
            const result = await client.from("user_tasks").update({done:node.checked}).eq("id", node.dataset.id);
            if(result.error) throw result.error;
        }else if(action === "deltask"){
            const result = await client.from("user_tasks").delete().eq("id", node.dataset.id);
            if(result.error) throw result.error;
        }else return;
        await loadPlanner();
    }catch(error){ showToast(featError(error)); }
}
