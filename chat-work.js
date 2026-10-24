"use strict";
// ===== ワークスペース（仕事用ツール）=====
// チーム用の領域をつくり、その中で 出勤管理 / 経費精算（管理者が承認）/ 会議室予約 / プロジェクト管理 / 文書管理 / 共同メモ / レポート を使います。
// 画面の操作は、すべてサーバー側のルール(RLS・RPC)で守られています。管理者＝そのワークスペースの「管理者」役の人です。

Object.assign(FEAT_ERRORS, {
    not_member:"このワークスペースのメンバーではありません。", not_admin:"管理者だけができる操作です。", no_user:"ユーザーが見つかりません。",
    too_many_workspaces:"ワークスペースは10個までです。", too_many_members:"メンバーは50人までです。", last_admin:"最後の管理者は外せません（先に別の人を管理者にしてください）。",
    already_in:"すでに出勤中です。先に退勤してください。", not_in:"出勤していません。", own_expense:"自分の経費は承認できません。", already_decided:"すでに処理済みです。",
    already_booked:"その時間はすでに予約されています。", bad_time:"終了は開始より後にしてください。", past_time:"過去の時間は予約できません。", too_many_rooms:"会議室は20室までです。",
    too_many_projects:"プロジェクトは50件までです。", too_many_tasks:"タスクは500件までです。", assignee_not_member:"担当はメンバーから選んでください。",
    too_many_docs:"文書は300件までです。", bad_path:"保存先が正しくありません。", too_many_notes:"共同メモは100件までです。",
    lock_lost:"編集の順番が切れました（3分）。もう一度「編集する」を押してください。", version_conflict:"他の人が先に保存しました。開き直してください。"
});

const WK_CATS = {transport:"🚆 交通費", meal:"🍱 食事", supplies:"📎 備品", communication:"📞 通信費", other:"📝 そのほか"};
const WK_STATUS = {todo:"未着手", doing:"進行中", done:"完了"};
const WK_EXP_STATUS = {pending:"⏳ 承認待ち", approved:"✅ 承認", rejected:"↩️ 差し戻し"};
feat.wk = {ws:null, view:"home", members:[], isAdmin:false, project:null, note:null, noteVersion:0, showAll:false, month:null};

function initWork(){ registerTool("wk", onWkAction); }

function wkRpc(name, args){
    return requireClient().rpc(name, args || {}).then((r) => { if(r.error) throw r.error; return r.data; });
}
function wkFrom(table, cols){ return requireClient().from(table).select(cols); }
async function wkQ(query){ const r = await query; if(r.error) throw r.error; return r.data || []; }
function wkMonthKey(d){ return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
function wkMonthRange(key){
    const [y, m] = key.split("-").map(Number);
    return {from:new Date(y, m - 1, 1), to:new Date(y, m, 1)};
}
function wkTime(iso){ return iso ? new Date(iso).toLocaleTimeString("ja-JP", {hour:"2-digit", minute:"2-digit"}) : "--:--"; }
function wkDateTime(iso){ const d = new Date(iso); return (d.getMonth() + 1) + "/" + d.getDate() + " " + wkTime(iso); }
function wkYen(n){ return Number(n || 0).toLocaleString("ja-JP") + "円"; }
function wkName(id){
    const m = feat.wk.members.find((x) => x.user_id === id);
    return id === state.user.id ? "あなた" : (m ? (m.display_name || "名前なし") : "（退会済み）");
}
function wkMemberOptions(sel, withNone){
    return (withNone ? '<option value="">（未定）</option>' : "") + feat.wk.members.map((m) => '<option value="' + escapeHtml(m.user_id) + '"' + (m.user_id === sel ? " selected" : "") + '>' + escapeHtml(m.display_name || "名前なし") + '</option>').join("");
}
function wkCsv(rows, name){
    const text = "﻿" + rows.map((r) => r.map((c) => '"' + String(c ?? "").replace(/"/g, '""') + '"').join(",")).join("\r\n");
    downloadBlob(new Blob([text], {type:"text/csv;charset=utf-8"}), name);
}

async function openWork(){
    feat.wk.ws = null; feat.wk.view = "home";
    openSheet(toolHead("🏢 ワークスペース", "チームで使う仕事用の画面です。メンバーだけが見られます。") + '<div id="wkBody"><div class="empty-list">読み込み中...</div></div>');
    await wkPaint();
}

async function wkPaint(){
    const box = $("wkBody");
    if(!box) return;
    try{
        const w = feat.wk;
        if(!w.ws){ if(w.personal){ await wkPersonalAtt(); return; } box.innerHTML = await wkHomeHtml(); return; }
        if(!w.members.length || w.membersFor !== w.ws.id){
            w.members = await wkRpc("ws_members", {p_ws:w.ws.id}); w.membersFor = w.ws.id;
        }
        w.isAdmin = w.members.some((m) => m.user_id === state.user.id && m.role === "admin");
        const views = {home:wkWsHomeHtml, att:wkAttHtml, exp:wkExpHtml, rooms:wkRoomsHtml, proj:wkProjHtml, docs:wkDocsHtml, notes:wkNotesHtml, members:wkMembersHtml, report:wkReportHtml};
        box.innerHTML = '<div class="row" style="justify-content:flex-start"><button type="button" class="button-secondary" data-t="wk:' + (w.view === "home" ? "leave" : "back") + '">← ' + (w.view === "home" ? "一覧へ" : escapeHtml(w.ws.name)) + '</button></div>' + await views[w.view]();
    }catch(error){ box.innerHTML = '<div class="empty-list">' + escapeHtml(featError(error)) + '</div><div class="row"><button type="button" class="button-secondary" data-t="wk:leave">← 一覧へ</button></div>'; }
    if(!$("wkFoot") && $("wkBody")) $("wkBody").insertAdjacentHTML("afterend", '<div id="wkFoot">' + toolClose() + '</div>');
}

// ---------- 一覧・ホーム ----------
async function wkHomeHtml(){
    const list = await wkQ(wkFrom("workspaces", "id,name,owner_id").order("created_at", {ascending:false}).limit(50));
    feat.wk.list = list;
    return '<div class="admin-card"><b>出勤だけ使う（個人）</b><div class="row"><button type="button" class="button-secondary" data-t="wk:personal">⏱ 個人の出勤管理</button></div></div>' +
        (list.length ? list.map((s) => '<button type="button" class="admin-card more-item" data-t="wk:open" data-id="' + escapeHtml(s.id) + '">🏢 ' + escapeHtml(s.name) + '</button>').join("") : '<div class="empty-list">まだワークスペースがありません。下で作成してください。</div>') +
        '<hr class="sep"><label for="wkNewName">新しいワークスペース名</label><input id="wkNewName" type="text" maxlength="40" placeholder="例：営業チーム"><div class="row"><button type="button" class="button" data-t="wk:create">作成</button></div>';
}
function wkWsHomeHtml(){
    const w = feat.wk;
    const items = [["att", "⏱ 出勤管理", "出勤・退勤ボタン、月ごとの一覧、CSV"], ["exp", "🧾 経費精算", w.isAdmin ? "申請の承認・差し戻し（あなたは管理者）" : "経費の申請（承認は管理者）"], ["rooms", "🚪 会議室予約", "時間の重なりを自動チェック"], ["proj", "📋 プロジェクト管理", "プロジェクト→タスク→担当・期限・状態"], ["docs", "📁 文書管理", "ファイルのアップロード・フォルダ分け（1つ5MBまで）"], ["notes", "📝 共同メモ", "順番に編集（編集中は他の人は読むだけ）"], ["report", "📊 レポート", "月ごとの集計・印刷"], ["members", "👥 メンバー", w.members.length + "人"]];
    return '<h4 style="margin:6px 0">🏢 ' + escapeHtml(w.ws.name) + '</h4>' + items.map((i) => '<button type="button" class="admin-card more-item" data-t="wk:view" data-v="' + i[0] + '">' + i[1] + '<small class="meta">' + i[2] + '</small></button>').join("");
}

// ---------- 出勤 ----------
async function wkAttHtml(){
    const w = feat.wk, month = w.month || wkMonthKey(new Date()), r = wkMonthRange(month);
    w.month = month;
    let q = wkFrom("attendance", "id,user_id,workspace_id,work_date,clock_in,clock_out,note").gte("clock_in", r.from.toISOString()).lt("clock_in", r.to.toISOString()).order("clock_in", {ascending:false}).limit(500);
    if(w.ws) q = q.eq("workspace_id", w.ws.id);
    else q = q.eq("user_id", state.user.id).is("workspace_id", null);
    let rows = await wkQ(q);
    if(!(w.isAdmin && w.showAll)) rows = rows.filter((x) => x.user_id === state.user.id);
    w.attRows = rows;
    const mine = await wkQ(wkFrom("attendance", "id,clock_in").eq("user_id", state.user.id).is("clock_out", null).limit(1));
    const open = mine[0];
    let total = 0;
    rows.forEach((x) => { if(x.clock_out && x.user_id === state.user.id) total += new Date(x.clock_out) - new Date(x.clock_in); });
    return '<h4 style="margin:6px 0">⏱ 出勤管理</h4>' +
        '<div class="admin-card">' + (open ? '出勤中（' + wkDateTime(open.clock_in) + '〜）' : '退勤済み／未出勤') +
        '<div class="row"><button type="button" class="button" data-t="wk:clock" data-a="in"' + (open ? " disabled" : "") + '>出勤</button><button type="button" class="button-secondary" data-t="wk:clock" data-a="out"' + (open ? "" : " disabled") + '>退勤</button></div></div>' +
        '<div class="row" style="justify-content:flex-start;align-items:center"><button type="button" class="button-secondary" data-t="wk:month" data-d="-1">◀</button><b>' + month.replace("-", "年") + '月</b><button type="button" class="button-secondary" data-t="wk:month" data-d="1">▶</button>' +
        (w.isAdmin && w.ws ? '<label style="display:inline-flex;gap:4px;align-items:center"><input type="checkbox" data-t="wk:showall"' + (w.showAll ? " checked" : "") + '> メンバー全員</label>' : "") + '</div>' +
        '<div class="meta">あなたの合計：' + (Math.floor(total / 3600000)) + '時間' + (Math.round(total / 60000) % 60) + '分（退勤済みのみ）</div>' +
        (rows.length ? rows.map((x) => '<div class="admin-card"><b>' + escapeHtml(x.work_date) + '</b> ' + (w.showAll ? escapeHtml(wkName(x.user_id)) + " " : "") + wkTime(x.clock_in) + ' 〜 ' + wkTime(x.clock_out) + (x.note ? ' <span class="meta">' + escapeHtml(x.note) + '</span>' : "") +
            (x.user_id === state.user.id ? '<div class="row"><button type="button" class="button-secondary" data-t="wk:attnote" data-id="' + escapeHtml(x.id) + '">メモ</button></div>' : "") + '</div>').join("") : '<div class="empty-list">この月の記録はありません。</div>') +
        '<div class="row"><button type="button" class="button-secondary" data-t="wk:attcsv">CSVで保存</button></div>';
}

// ---------- 経費 ----------
async function wkExpHtml(){
    const w = feat.wk;
    const rows = await wkQ(wkFrom("expenses", "id,user_id,amount,category,description,spent_on,status,review_note,created_at").eq("workspace_id", w.ws.id).order("created_at", {ascending:false}).limit(200));
    w.expRows = rows;
    const pending = rows.filter((x) => x.status === "pending" && x.user_id !== state.user.id);
    const item = (x, admin) => '<div class="admin-card"><b>' + wkYen(x.amount) + '</b> ' + (WK_CATS[x.category] || "") + ' <span class="meta">' + escapeHtml(x.spent_on) + ' / ' + escapeHtml(wkName(x.user_id)) + '</span><br>' + escapeHtml(x.description) +
        '<br><span class="meta">' + WK_EXP_STATUS[x.status] + (x.review_note ? '：' + escapeHtml(x.review_note) : "") + '</span>' +
        (admin && x.status === "pending" && x.user_id !== state.user.id ? '<div class="row"><input type="text" id="wkRn' + escapeHtml(x.id) + '" placeholder="コメント（任意）" maxlength="200"><button type="button" class="button" data-t="wk:decide" data-id="' + escapeHtml(x.id) + '" data-ok="1">承認</button><button type="button" class="button-secondary" data-t="wk:decide" data-id="' + escapeHtml(x.id) + '" data-ok="0">差し戻し</button></div>' : "") +
        (x.user_id === state.user.id && x.status === "pending" ? '<div class="row"><button type="button" class="button-secondary" data-t="wk:expdel" data-id="' + escapeHtml(x.id) + '">取り下げ</button></div>' : "") + '</div>';
    return '<h4 style="margin:6px 0">🧾 経費精算</h4>' +
        (w.isAdmin ? '<div class="meta">承認待ち（あなた以外の申請）：' + pending.length + '件。承認・差し戻しは管理者だけができます。</div>' : '<div class="meta">申請すると管理者が承認・差し戻しします。</div>') +
        '<div class="admin-card"><label for="wkAmt">金額（円）</label><input id="wkAmt" type="text" inputmode="numeric" placeholder="1200">' +
        '<label for="wkCat">種類</label><select id="wkCat">' + Object.keys(WK_CATS).map((k) => '<option value="' + k + '">' + WK_CATS[k] + '</option>').join("") + '</select>' +
        '<label for="wkDesc">内容（200文字まで）</label><input id="wkDesc" type="text" maxlength="200" placeholder="例：客先訪問の電車代">' +
        '<label for="wkDay">使った日</label><input id="wkDay" type="text" value="' + dayKey(new Date()) + '" placeholder="2026-10-24">' +
        '<div class="row"><button type="button" class="button" data-t="wk:expsend">申請する</button></div></div>' +
        (w.isAdmin && pending.length ? '<h4 style="margin:10px 0 4px">承認待ち</h4>' + pending.map((x) => item(x, true)).join("") : "") +
        '<h4 style="margin:10px 0 4px">' + (w.isAdmin ? "すべての申請" : "あなたの申請") + '</h4>' + (rows.length ? rows.map((x) => item(x, false)).join("") : '<div class="empty-list">まだありません。</div>') +
        '<div class="row"><button type="button" class="button-secondary" data-t="wk:expcsv">CSVで保存</button></div>';
}

// ---------- 会議室 ----------
async function wkRoomsHtml(){
    const w = feat.wk;
    const [rooms, bookings] = await Promise.all([
        wkQ(wkFrom("meeting_rooms", "id,name").eq("workspace_id", w.ws.id).order("name")),
        wkQ(wkFrom("room_bookings", "id,room_id,user_id,title,starts_at,ends_at").eq("workspace_id", w.ws.id).gte("ends_at", new Date().toISOString()).order("starts_at").limit(200))
    ]);
    w.rooms = rooms;
    const now = new Date(), day = dayKey(now);
    return '<h4 style="margin:6px 0">🚪 会議室予約</h4>' +
        (rooms.length ? '<div class="admin-card"><label for="wkRoom">会議室</label><select id="wkRoom">' + rooms.map((r) => '<option value="' + escapeHtml(r.id) + '">' + escapeHtml(r.name) + '</option>').join("") + '</select>' +
            '<label for="wkRTitle">件名</label><input id="wkRTitle" type="text" maxlength="60" placeholder="例：定例ミーティング">' +
            '<label for="wkRDay">日付</label><input id="wkRDay" type="text" value="' + day + '"><label for="wkRFrom">開始（例 10:00）</label><input id="wkRFrom" type="text" value="10:00"><label for="wkRTo">終了（例 11:00）</label><input id="wkRTo" type="text" value="11:00">' +
            '<div class="row"><button type="button" class="button" data-t="wk:book">予約する</button></div></div>' : '<div class="empty-list">会議室がありません。' + (w.isAdmin ? "下で追加できます。" : "管理者に追加してもらってください。") + '</div>') +
        '<h4 style="margin:10px 0 4px">これからの予約</h4>' +
        (bookings.length ? bookings.map((b) => { const r = rooms.find((x) => x.id === b.room_id); return '<div class="admin-card"><b>' + escapeHtml(r ? r.name : "") + '</b> ' + wkDateTime(b.starts_at) + '〜' + wkTime(b.ends_at) + '<br>' + escapeHtml(b.title) + ' <span class="meta">' + escapeHtml(wkName(b.user_id)) + '</span>' +
            (b.user_id === state.user.id || w.isAdmin ? '<div class="row"><button type="button" class="button-secondary" data-t="wk:unbook" data-id="' + escapeHtml(b.id) + '">取り消す</button></div>' : "") + '</div>'; }).join("") : '<div class="empty-list">予約はありません。</div>') +
        (w.isAdmin ? '<hr class="sep"><label for="wkRoomName">会議室を追加</label><input id="wkRoomName" type="text" maxlength="30" placeholder="例：会議室A"><div class="row"><button type="button" class="button" data-t="wk:addroom">追加</button></div>' +
            rooms.map((r) => '<div class="admin-card">' + escapeHtml(r.name) + ' <button type="button" class="button-danger" data-t="wk:delroom" data-id="' + escapeHtml(r.id) + '">削除</button></div>').join("") : "");
}

// ---------- プロジェクト ----------
async function wkProjHtml(){
    const w = feat.wk;
    if(w.project){
        const p = w.project;
        const tasks = await wkQ(wkFrom("project_tasks", "id,title,assignee_id,due_on,status").eq("project_id", p.id).order("created_at").limit(500));
        const cnt = {todo:0, doing:0, done:0}; tasks.forEach((t) => cnt[t.status]++);
        const pct = tasks.length ? Math.round(cnt.done / tasks.length * 100) : 0;
        return '<h4 style="margin:6px 0">📋 ' + escapeHtml(p.name) + '</h4><div class="meta">未着手 ' + cnt.todo + ' / 進行中 ' + cnt.doing + ' / 完了 ' + cnt.done + '（' + pct + '%）</div><div class="grp-bar"><i style="width:' + pct + '%"></i></div>' +
            '<div class="row" style="justify-content:flex-start"><button type="button" class="button-secondary" data-t="wk:projlist">← プロジェクト一覧</button></div>' +
            tasks.map((t) => '<div class="admin-card"><b' + (t.status === "done" ? ' style="text-decoration:line-through"' : "") + '>' + escapeHtml(t.title) + '</b>' +
                '<div class="row" style="justify-content:flex-start"><select data-t="wk:tstatus" data-id="' + escapeHtml(t.id) + '">' + Object.keys(WK_STATUS).map((k) => '<option value="' + k + '"' + (k === t.status ? " selected" : "") + '>' + WK_STATUS[k] + '</option>').join("") + '</select>' +
                '<select data-t="wk:tassign" data-id="' + escapeHtml(t.id) + '">' + wkMemberOptions(t.assignee_id, true) + '</select>' +
                '<span class="meta">' + (t.due_on ? "期限 " + escapeHtml(t.due_on) : "期限なし") + '</span><button type="button" class="button-secondary" data-t="wk:tdel" data-id="' + escapeHtml(t.id) + '">削除</button></div></div>').join("") +
            '<hr class="sep"><label for="wkTTitle">タスクを追加</label><input id="wkTTitle" type="text" maxlength="100" placeholder="タスク名"><label for="wkTWho">担当</label><select id="wkTWho">' + wkMemberOptions(state.user.id, true) + '</select><label for="wkTDue">期限（例 2026-11-01・空でもOK）</label><input id="wkTDue" type="text" maxlength="10"><div class="row"><button type="button" class="button" data-t="wk:tadd">追加</button></div>';
    }
    const [projects, tasks] = await Promise.all([
        wkQ(wkFrom("projects", "id,name,created_by").eq("workspace_id", w.ws.id).order("created_at", {ascending:false})),
        wkQ(wkFrom("project_tasks", "project_id,status").eq("workspace_id", w.ws.id).limit(2000))
    ]);
    return '<h4 style="margin:6px 0">📋 プロジェクト管理</h4>' + (projects.length ? projects.map((p) => {
        const mine = tasks.filter((t) => t.project_id === p.id), done = mine.filter((t) => t.status === "done").length;
        return '<button type="button" class="admin-card more-item" data-t="wk:projopen" data-id="' + escapeHtml(p.id) + '" data-name="' + escapeHtml(p.name) + '">📋 ' + escapeHtml(p.name) + '<small class="meta">タスク ' + mine.length + '件（完了 ' + done + '）</small></button>';
    }).join("") : '<div class="empty-list">プロジェクトがありません。</div>') +
        '<hr class="sep"><label for="wkPName">新しいプロジェクト</label><input id="wkPName" type="text" maxlength="60"><div class="row"><button type="button" class="button" data-t="wk:projadd">作成</button></div>' +
        (projects.length ? '<div class="meta">削除：作った人か管理者だけ</div>' + projects.filter((p) => p.created_by === state.user.id || w.isAdmin).map((p) => '<div class="admin-card">' + escapeHtml(p.name) + ' <button type="button" class="button-danger" data-t="wk:projdel" data-id="' + escapeHtml(p.id) + '">削除</button></div>').join("") : "");
}

// ---------- 文書 ----------
async function wkDocsHtml(){
    const w = feat.wk;
    const docs = await wkQ(wkFrom("ws_documents", "id,folder,name,path,size,uploaded_by,created_at").eq("workspace_id", w.ws.id).order("created_at", {ascending:false}).limit(300));
    const folders = [...new Set(docs.map((d) => d.folder || ""))].sort();
    return '<h4 style="margin:6px 0">📁 文書管理</h4>' +
        '<div class="admin-card"><label for="wkFolder">フォルダ名（空なら「未分類」）</label><input id="wkFolder" type="text" maxlength="40" list="wkFolderList" placeholder="例：契約書"><datalist id="wkFolderList">' + folders.filter(Boolean).map((f) => '<option value="' + escapeHtml(f) + '">').join("") + '</datalist>' +
        '<label for="wkFile">ファイル（5MBまで）</label><input id="wkFile" type="file"><div class="row"><button type="button" class="button" data-t="wk:upload">アップロード</button></div></div>' +
        (folders.length ? folders.map((f) => '<h4 style="margin:10px 0 4px">📂 ' + escapeHtml(f || "未分類") + '</h4>' + docs.filter((d) => (d.folder || "") === f).map((d) =>
            '<div class="admin-card">📄 ' + escapeHtml(d.name) + ' <span class="meta">' + Math.max(1, Math.round(d.size / 1024)) + 'KB / ' + escapeHtml(wkName(d.uploaded_by)) + '</span><div class="row"><button type="button" class="button-secondary" data-t="wk:dl" data-p="' + escapeHtml(d.path) + '" data-n="' + escapeHtml(d.name) + '">ダウンロード</button>' +
            (d.uploaded_by === state.user.id || w.isAdmin ? '<button type="button" class="button-danger" data-t="wk:docdel" data-id="' + escapeHtml(d.id) + '">削除</button>' : "") + '</div></div>').join("")).join("") : '<div class="empty-list">文書がありません。</div>');
}

// ---------- 共同メモ（順番に編集） ----------
async function wkNotesHtml(){
    const w = feat.wk;
    if(w.note){
        const rows = await wkQ(wkFrom("shared_notes", "id,title,body,version,editing_by,editing_until,updated_by,updated_at").eq("id", w.note.id).limit(1));
        const n = rows[0];
        if(!n){ w.note = null; return await wkNotesHtml(); }
        const busy = n.editing_by && n.editing_by !== state.user.id && new Date(n.editing_until) > new Date();
        const editing = w.note.editing;
        if(w.note.live && typeof lnHtml === "function") return lnHtml(n);
        return '<h4 style="margin:6px 0">📝 ' + escapeHtml(n.title) + '</h4><div class="meta">最終更新：' + escapeHtml(wkName(n.updated_by)) + ' ' + wkDateTime(n.updated_at) + '（v' + n.version + '）' + (busy ? ' ／ ' + escapeHtml(wkName(n.editing_by)) + ' さんが編集中' : "") + '</div>' +
            '<div class="row" style="justify-content:flex-start"><button type="button" class="button-secondary" data-t="wk:notelist">← メモ一覧</button><button type="button" class="button-secondary" data-t="wk:noteview">最新を読み込む</button></div>' +
            (editing ? '<textarea id="wkNoteBody" rows="12" maxlength="20000">' + escapeHtml(n.body) + '</textarea><div class="meta">編集できるのは3分間。保存すると次の人に順番が移ります。</div><div class="row"><button type="button" class="button" data-t="wk:notesave">保存して終わる</button><button type="button" class="button-secondary" data-t="wk:notecancel">やめる</button></div>'
                : '<div class="admin-card" style="white-space:pre-wrap">' + (n.body ? escapeHtml(n.body) : '<span class="meta">（まだ内容がありません）</span>') + '</div><div class="row"><button type="button" class="button"' + (busy ? " disabled" : "") + ' data-t="wk:noteedit">✏️ 編集する（順番に）</button>' + (typeof lnHtml === "function" ? '<button type="button" class="button" data-t="wk:notelive">⚡ みんなで同時に編集</button>' : "") + '</div>');
    }
    const notes = await wkQ(wkFrom("shared_notes", "id,title,created_by,updated_at").eq("workspace_id", w.ws.id).order("updated_at", {ascending:false}).limit(100));
    return '<h4 style="margin:6px 0">📝 共同メモ</h4>' + (notes.length ? notes.map((n) => '<button type="button" class="admin-card more-item" data-t="wk:noteopen" data-id="' + escapeHtml(n.id) + '" data-title="' + escapeHtml(n.title) + '">📝 ' + escapeHtml(n.title) + '<small class="meta">' + wkDateTime(n.updated_at) + '</small></button>').join("") : '<div class="empty-list">メモがありません。</div>') +
        '<hr class="sep"><label for="wkNewNote">新しいメモのタイトル</label><input id="wkNewNote" type="text" maxlength="60"><div class="row"><button type="button" class="button" data-t="wk:notenew">作成</button></div>' +
        (notes.length ? notes.filter((n) => n.created_by === state.user.id || w.isAdmin).map((n) => '<div class="admin-card">' + escapeHtml(n.title) + ' <button type="button" class="button-danger" data-t="wk:notedel" data-id="' + escapeHtml(n.id) + '">削除</button></div>').join("") : "");
}

// ---------- メンバー ----------
function wkMembersHtml(){
    const w = feat.wk;
    return '<h4 style="margin:6px 0">👥 メンバー（' + w.members.length + '人）</h4>' + w.members.map((m) => '<div class="admin-card">' + escapeHtml(m.display_name || "名前なし") + (m.user_id === state.user.id ? "（あなた）" : "") + ' <span class="chip">' + (m.role === "admin" ? "管理者" : "メンバー") + '</span>' +
        (w.isAdmin && m.user_id !== state.user.id ? '<div class="row"><button type="button" class="button-secondary" data-t="wk:role" data-id="' + escapeHtml(m.user_id) + '" data-r="' + (m.role === "admin" ? "member" : "admin") + '">' + (m.role === "admin" ? "管理者を外す" : "管理者にする") + '</button><button type="button" class="button-danger" data-t="wk:kick" data-id="' + escapeHtml(m.user_id) + '">外す</button></div>' : "") + '</div>').join("") +
        (w.isAdmin ? '<hr class="sep"><label>メンバーを追加</label>' + pickList(w.members.map((m) => m.user_id)) + '<div class="row"><button type="button" class="button" data-t="wk:addmem">選んだ人を追加</button></div>' : "") +
        '<hr class="sep"><div class="row"><button type="button" class="button-danger" data-t="wk:leavews">このワークスペースを抜ける</button></div>';
}

// ---------- レポート ----------
async function wkReportHtml(){
    const w = feat.wk, month = w.month || wkMonthKey(new Date()), r = wkMonthRange(month);
    w.month = month;
    const iso = (d) => d.toISOString(), day0 = dayKey(r.from), day1 = dayKey(r.to);
    const [att, exp, tasks, co2, health] = await Promise.all([
        wkQ(wkFrom("attendance", "user_id,clock_in,clock_out").eq("workspace_id", w.ws.id).gte("clock_in", iso(r.from)).lt("clock_in", iso(r.to)).limit(2000)),
        wkQ(wkFrom("expenses", "user_id,amount,status,category").eq("workspace_id", w.ws.id).gte("spent_on", day0).lt("spent_on", day1).limit(2000)),
        wkQ(wkFrom("project_tasks", "assignee_id,status,due_on").eq("workspace_id", w.ws.id).limit(5000)),
        wkQ(wkFrom("user_co2_logs", "kg").gte("day", day0).lt("day", day1).limit(500)).catch(() => []),
        wkQ(wkFrom("user_health_logs", "weight_kg,sleep_h,steps").gte("day", day0).lt("day", day1).limit(500)).catch(() => [])
    ]);
    const hoursBy = {}; att.forEach((a) => { if(a.clock_out) hoursBy[a.user_id] = (hoursBy[a.user_id] || 0) + (new Date(a.clock_out) - new Date(a.clock_in)) / 3600000; });
    const expSum = {pending:0, approved:0, rejected:0}; exp.forEach((e) => { expSum[e.status] += e.amount; });
    const today = dayKey(new Date());
    const tcnt = {todo:0, doing:0, done:0, late:0}; tasks.forEach((t) => { tcnt[t.status]++; if(t.status !== "done" && t.due_on && t.due_on < today) tcnt.late++; });
    const avg = (arr, k) => { const v = arr.map((x) => Number(x[k])).filter((x) => x > 0); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : "-"; };
    const kg = co2.reduce((a, b) => a + Number(b.kg || 0), 0);
    return '<h4 style="margin:6px 0">📊 レポート（' + month.replace("-", "年") + '月）</h4><div class="row" style="justify-content:flex-start"><button type="button" class="button-secondary" data-t="wk:month" data-d="-1">◀</button><button type="button" class="button-secondary" data-t="wk:month" data-d="1">▶</button></div>' +
        '<div class="admin-card"><b>⏱ 勤務時間' + (w.isAdmin ? "（メンバー別）" : "（あなた）") + '</b><br>' + (Object.keys(hoursBy).filter((id) => w.isAdmin || id === state.user.id).map((id) => escapeHtml(wkName(id)) + '：' + hoursBy[id].toFixed(1) + '時間').join("<br>") || "記録なし") + '</div>' +
        '<div class="admin-card"><b>🧾 経費（使った日が今月）</b><br>承認 ' + wkYen(expSum.approved) + ' ／ 承認待ち ' + wkYen(expSum.pending) + ' ／ 差し戻し ' + wkYen(expSum.rejected) + '</div>' +
        '<div class="admin-card"><b>📋 タスク（全期間）</b><br>未着手 ' + tcnt.todo + ' ／ 進行中 ' + tcnt.doing + ' ／ 完了 ' + tcnt.done + ' ／ 期限切れ ' + tcnt.late + '</div>' +
        '<div class="admin-card"><b>🌱 あなたのCO2</b> ' + kg.toFixed(1) + 'kg ／ <b>❤️ あなたのヘルス</b> 体重平均 ' + avg(health, "weight_kg") + 'kg・睡眠平均 ' + avg(health, "sleep_h") + '時間・歩数平均 ' + avg(health, "steps") + '</div>' +
        '<div class="row"><button type="button" class="button" data-t="wk:print">🖨 印刷／PDFで保存</button></div>';
}

// ---------- 予定の空き時間提案（ルールで計算。AIではありません）----------
function openSchedSuggest(){
    openSheet(toolHead("📆 予定の空き時間を提案", "自分のカレンダーの予定とすき間から、会議などに使える時間をルールで計算します。") +
        '<label for="ssDay">日付</label><input id="ssDay" type="text" value="' + dayKey(new Date()) + '"><label for="ssMin">必要な時間（分）</label><input id="ssMin" type="text" value="60" inputmode="numeric">' +
        '<label for="ssFrom">何時から（例 9）</label><input id="ssFrom" type="text" value="9"><label for="ssTo">何時まで（例 18）</label><input id="ssTo" type="text" value="18">' +
        '<div class="row"><button type="button" class="button" data-t="wk:suggest">提案する</button></div><div id="ssOut"></div>' + toolClose());
}
async function wkSuggest(){
    const day = ($("ssDay").value || "").trim(), min = Math.max(5, Math.min(480, Number($("ssMin").value) || 60)), h0 = Math.max(0, Math.min(23, Number($("ssFrom").value) || 9)), h1 = Math.max(1, Math.min(24, Number($("ssTo").value) || 18));
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)){ showToast("日付は 2026-10-24 の形で入力してください。"); return; }
    const start = new Date(day + "T00:00:00"), end = new Date(start.getTime() + 86400000);
    const [events, books] = await Promise.all([
        wkQ(wkFrom("user_events", "starts_at,title").gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString()).limit(100)),
        wkQ(wkFrom("room_bookings", "starts_at,ends_at,title").eq("user_id", state.user.id).gte("ends_at", start.toISOString()).lt("starts_at", end.toISOString()).limit(100)).catch(() => [])
    ]);
    const busy = [];
    events.forEach((e) => { const s = new Date(e.starts_at); busy.push([s, new Date(s.getTime() + 3600000), e.title]); });
    books.forEach((b) => busy.push([new Date(b.starts_at), new Date(b.ends_at), b.title]));
    busy.sort((a, b) => a[0] - b[0]);
    const dayStart = new Date(start.getTime() + h0 * 3600000), dayEnd = new Date(start.getTime() + h1 * 3600000);
    const free = []; let cursor = dayStart;
    busy.forEach((b) => { if(b[0] > cursor) free.push([cursor, b[0]]); if(b[1] > cursor) cursor = b[1]; });
    if(cursor < dayEnd) free.push([cursor, dayEnd]);
    const ok = free.filter((f) => Math.min(f[1], dayEnd) - Math.max(f[0], dayStart) >= min * 60000).slice(0, 5);
    $("ssOut").innerHTML = '<div class="meta">予定（1件=1時間として計算）：' + (busy.length ? busy.map((b) => wkTime(b[0]) + " " + escapeHtml(b[2] || "")).join(" / ") : "なし") + '</div>' +
        (ok.length ? ok.map((f) => '<div class="admin-card">✅ ' + wkTime(f[0]) + ' 〜 ' + wkTime(f[1]) + '（' + Math.round((f[1] - f[0]) / 60000) + '分あき）→ おすすめ開始：<b>' + wkTime(f[0]) + '</b></div>').join("") : '<div class="empty-list">条件に合うすき間がありません。時間を短くするか、範囲を広げてください。</div>');
}

// ---------- 操作 ----------
async function onWkAction(action, node){
    const w = feat.wk;
    if(action === "suggest") return wkSuggest();
    try{
        if(action === "create" || action === "open" || action === "leave") w.personal = false;
        if(action === "create"){
            const name = ($("wkNewName").value || "").trim();
            if(!name){ showToast("名前を入力してください。"); return; }
            const id = await wkRpc("ws_create", {p_name:name});
            w.ws = {id, name}; w.view = "home"; w.members = [];
        }else if(action === "open"){ const s = (w.list || []).find((x) => x.id === node.dataset.id); w.ws = s || {id:node.dataset.id, name:""}; w.view = "home"; w.members = []; w.showAll = false; w.project = null; w.note = null; }
        else if(action === "personal"){ w.ws = null; w.view = "att"; w.personal = true; return wkPersonalAtt(); }
        else if(action === "leave"){ w.ws = null; w.members = []; }
        else if(action === "back"){ w.view = "home"; w.project = null; w.note = null; }
        else if(action === "view"){ w.view = node.dataset.v; w.project = null; w.note = null; }
        else if(action === "month"){ const [y, m] = (w.month || wkMonthKey(new Date())).split("-").map(Number); w.month = wkMonthKey(new Date(y, m - 1 + Number(node.dataset.d), 1)); }
        else if(action === "showall"){ w.showAll = node.checked; }
        else if(action === "clock"){ await wkRpc("att_clock", {p_action:node.dataset.a, p_ws:w.ws ? w.ws.id : null}); showToast(node.dataset.a === "in" ? "出勤しました。" : "退勤しました。お疲れさまでした。"); }
        else if(action === "attnote"){ const t = prompt("メモ（100文字まで）"); if(t === null) return; await wkRpc("att_set_note", {p_id:node.dataset.id, p_note:t}); }
        else if(action === "attcsv"){ wkCsv([["日付", "名前", "出勤", "退勤", "メモ"]].concat((w.attRows || []).map((x) => [x.work_date, wkName(x.user_id), x.clock_in, x.clock_out || "", x.note || ""])), "ARE出勤_" + (w.month || "") + ".csv"); return; }
        else if(action === "expsend"){
            const amount = Math.floor(Number(($("wkAmt").value || "").replace(/[,，]/g, "")));
            if(!(amount > 0)){ showToast("金額を入力してください。"); return; }
            if(!($("wkDesc").value || "").trim()){ showToast("内容を入力してください。"); return; }
            await wkRpc("exp_submit", {p_ws:w.ws.id, p_amount:amount, p_category:$("wkCat").value, p_description:$("wkDesc").value, p_spent_on:$("wkDay").value});
            showToast("申請しました。");
        }else if(action === "decide"){ await wkRpc("exp_decide", {p_id:node.dataset.id, p_approve:node.dataset.ok === "1", p_note:($("wkRn" + node.dataset.id) || {}).value || null}); }
        else if(action === "expdel"){ await wkRpc("exp_withdraw", {p_id:node.dataset.id}); }
        else if(action === "expcsv"){ wkCsv([["申請日", "使った日", "申請者", "種類", "金額", "内容", "状態", "コメント"]].concat((w.expRows || []).map((x) => [x.created_at, x.spent_on, wkName(x.user_id), WK_CATS[x.category], x.amount, x.description, WK_EXP_STATUS[x.status], x.review_note || ""])), "ARE経費.csv"); return; }
        else if(action === "addroom"){ await wkRpc("mr_create_room", {p_ws:w.ws.id, p_name:$("wkRoomName").value}); }
        else if(action === "delroom"){ if(!confirm("この会議室と予約を削除します。よいですか？")) return; await wkRpc("mr_delete_room", {p_room:node.dataset.id}); }
        else if(action === "book"){
            const day = $("wkRDay").value.trim(), from = $("wkRFrom").value.trim(), to = $("wkRTo").value.trim(), title = $("wkRTitle").value.trim();
            if(!title){ showToast("件名を入力してください。"); return; }
            const s = new Date(day + "T" + from.padStart(5, "0") + ":00"), e = new Date(day + "T" + to.padStart(5, "0") + ":00");
            if(isNaN(s) || isNaN(e)){ showToast("日付と時刻の形が正しくありません（例 2026-10-24 / 10:00）。"); return; }
            await wkRpc("mr_book", {p_room:$("wkRoom").value, p_title:title, p_start:s.toISOString(), p_end:e.toISOString()});
            showToast("予約しました。");
        }else if(action === "unbook"){ await wkRpc("mr_cancel", {p_booking:node.dataset.id}); }
        else if(action === "projadd"){ if(!($("wkPName").value || "").trim()){ showToast("名前を入力してください。"); return; } await wkRpc("proj_create", {p_ws:w.ws.id, p_name:$("wkPName").value}); }
        else if(action === "projdel"){ if(!confirm("プロジェクトとタスクを削除します。よいですか？")) return; await wkRpc("proj_delete", {p_id:node.dataset.id}); }
        else if(action === "projopen"){ w.project = {id:node.dataset.id, name:node.dataset.name}; }
        else if(action === "projlist"){ w.project = null; }
        else if(action === "tadd"){
            const title = ($("wkTTitle").value || "").trim(); if(!title){ showToast("タスク名を入力してください。"); return; }
            const due = ($("wkTDue").value || "").trim();
            if(due && !/^\d{4}-\d{2}-\d{2}$/.test(due)){ showToast("期限は 2026-11-01 の形で入力してください。"); return; }
            await wkRpc("ptask_save", {p_id:null, p_project:w.project.id, p_title:title, p_assignee:$("wkTWho").value || null, p_due:due || null, p_status:"todo"});
        }else if(action === "tstatus" || action === "tassign"){
            const t = (await wkQ(wkFrom("project_tasks", "id,title,assignee_id,due_on,status").eq("id", node.dataset.id).limit(1)))[0];
            if(!t) return;
            await wkRpc("ptask_save", {p_id:t.id, p_project:w.project.id, p_title:t.title, p_assignee:action === "tassign" ? (node.value || null) : t.assignee_id, p_due:t.due_on, p_status:action === "tstatus" ? node.value : t.status});
        }else if(action === "tdel"){ await wkRpc("ptask_delete", {p_id:node.dataset.id}); }
        else if(action === "upload"){
            const file = $("wkFile").files && $("wkFile").files[0];
            if(!file){ showToast("ファイルを選んでください。"); return; }
            if(file.size > 5242880){ showToast("5MBまでのファイルを選んでください。"); return; }
            const safe = file.name.replace(/[^\w.\-぀-ヿ一-鿿]/g, "_").slice(-80) || "file";
            const id = (self.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())).slice(0, 8);
            const path = w.ws.id + "/" + id + "-" + safe.replace(/[^\x20-\x7e]/g, "_");
            const up = await requireClient().storage.from("ws-docs").upload(path, file, {contentType:file.type || "application/octet-stream", upsert:false});
            if(up.error) throw up.error;
            try{ await wkRpc("doc_register", {p_ws:w.ws.id, p_folder:$("wkFolder").value || "", p_name:file.name, p_path:path, p_size:file.size, p_mime:file.type || null}); }
            catch(e){ await requireClient().storage.from("ws-docs").remove([path]); throw e; }
            showToast("アップロードしました。");
        }else if(action === "dl"){
            const r = await requireClient().storage.from("ws-docs").createSignedUrl(node.dataset.p, 60, {download:node.dataset.n});
            if(r.error) throw r.error;
            const a = document.createElement("a"); a.href = r.data.signedUrl; a.rel = "noopener noreferrer"; document.body.appendChild(a); a.click(); a.remove(); return;
        }else if(action === "docdel"){
            if(!confirm("この文書を削除します。よいですか？")) return;
            const path = await wkRpc("doc_delete", {p_id:node.dataset.id});
            if(path) await requireClient().storage.from("ws-docs").remove([path]);
        }else if(action === "notenew"){ if(!($("wkNewNote").value || "").trim()){ showToast("タイトルを入力してください。"); return; } await wkRpc("note_create", {p_ws:w.ws.id, p_title:$("wkNewNote").value}); }
        else if(action === "noteopen"){ w.note = {id:node.dataset.id, title:node.dataset.title, editing:false}; }
        else if(action === "notelist"){ if(w.note && w.note.editing) await wkRpc("note_release", {p_id:w.note.id}).catch(() => {}); w.note = null; }
        else if(action === "noteview"){ /* 再描画だけ */ }
        else if(action === "notelive"){ w.note.live = true; }
        else if(action === "noteedit"){
            const r = await wkRpc("note_lock", {p_id:w.note.id});
            if(!r.ok){ showToast(wkName(r.by) + " さんが編集中です。終わるまで待ってください。"); }
            else{ w.note.editing = true; w.noteVersion = r.version; }
        }else if(action === "notesave"){
            await wkRpc("note_save", {p_id:w.note.id, p_body:$("wkNoteBody").value, p_version:w.noteVersion, p_release:true});
            w.note.editing = false; showToast("保存しました。");
        }else if(action === "notecancel"){ await wkRpc("note_release", {p_id:w.note.id}); w.note.editing = false; }
        else if(action === "notedel"){ if(!confirm("このメモを削除します。よいですか？")) return; await wkRpc("note_delete", {p_id:node.dataset.id}); }
        else if(action === "addmem"){
            const ids = pickedIds(); if(!ids.length){ showToast("追加する人を選んでください。"); return; }
            for(const id of ids) await wkRpc("ws_add_member", {p_ws:w.ws.id, p_user:id});
            w.members = []; showToast("追加しました。");
        }else if(action === "role"){ await wkRpc("ws_set_role", {p_ws:w.ws.id, p_user:node.dataset.id, p_role:node.dataset.r}); w.members = []; }
        else if(action === "kick"){ if(!confirm("このメンバーを外します。よいですか？")) return; await wkRpc("ws_remove_member", {p_ws:w.ws.id, p_user:node.dataset.id}); w.members = []; }
        else if(action === "leavews"){ if(!confirm("このワークスペースを抜けます。よいですか？")) return; await wkRpc("ws_remove_member", {p_ws:w.ws.id, p_user:state.user.id}); w.ws = null; w.members = []; }
        else if(action === "print"){ window.print(); return; }
        else return;
        await wkPaint();
    }catch(error){ showToast(featError(error)); }
}

async function wkPersonalAtt(){
    feat.wk.ws = null; feat.wk.members = []; feat.wk.isAdmin = false;
    const box = $("wkBody"); if(!box) return;
    try{ box.innerHTML = '<div class="row" style="justify-content:flex-start"><button type="button" class="button-secondary" data-t="wk:leave">← 一覧へ</button></div>' + await wkAttHtml(); }
    catch(error){ box.innerHTML = '<div class="empty-list">' + escapeHtml(featError(error)) + '</div>'; }
}
