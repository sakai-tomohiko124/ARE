"use strict";
// ===== 自分専用のメモ（Keep風）。マイページから開き、右側の画面いっぱいに表示します =====
// ・自分だけが読み書きできます（サーバー側のルール RLS で、管理者を含む他の人からは見えません）
// ・メモ／チェックリスト、色、ピン留め、ラベル、アーカイブ、ゴミ箱（7日で自動削除）、検索
// ・上限：500件（ゴミ箱を含む）、本文5,000文字、リスト100項目

const MEMO_COLORS = {default:"", red:"#5c2b29", orange:"#614a19", yellow:"#635d19", green:"#345920", teal:"#16504b", blue:"#2d555e", purple:"#42275e", pink:"#5b2245", gray:"#3c3f43"};
const MEMO_COLOR_NAMES = {default:"なし", red:"赤", orange:"オレンジ", yellow:"黄", green:"緑", teal:"青緑", blue:"青", purple:"紫", pink:"ピンク", gray:"グレー"};
const MEMO_COLUMNS = "id,kind,title,body,items,color,labels,pinned,archived,deleted_at,created_at,updated_at";
feat.memo = {list:[], view:"notes", query:"", label:"", editing:null, open:false, loaded:false};

function initMemo(){
    const main = document.querySelector("main.main");
    if(!main) throw new Error("メイン画面が見つかりません。");
    const root = document.createElement("section");
    root.className = "memo-view"; root.id = "memoView"; root.hidden = true;
    root.setAttribute("aria-label", "自分専用メモ");
    root.addEventListener("click", onMemoClick);
    root.addEventListener("input", onMemoInput);
    root.addEventListener("change", onMemoInput);
    root.addEventListener("keydown", onMemoKey);
    main.appendChild(root);
    feat.memo.root = root;
    const button = $("memoOpenButton");
    if(button) button.addEventListener("click", () => runTool(openMemoView));
}

async function openMemoView(){
    const m = feat.memo;
    m.open = true; m.view = "notes"; m.query = ""; m.label = ""; m.editing = null;
    el.app.classList.add("memo-open");
    m.root.hidden = false;
    paintMemoShell();
    await loadMemos();
}

function closeMemoView(){
    const m = feat.memo;
    if(m.editing) saveMemoEditor(true);
    m.open = false;
    m.root.hidden = true;
    el.app.classList.remove("memo-open");
}

async function loadMemos(){
    const m = feat.memo;
    try{
        const result = await requireClient().from("user_memos").select(MEMO_COLUMNS).order("pinned", {ascending:false}).order("updated_at", {ascending:false}).limit(500);
        if(result.error) throw result.error;
        m.list = result.data || [];
        m.loaded = true;
        paintMemoGrid();
    }catch(error){ if($("memoGrid")) $("memoGrid").innerHTML = '<div class="empty-list">' + escapeHtml(featError(error)) + '</div>'; }
}

function memoVisible(){
    const m = feat.memo, q = m.query.trim().toLowerCase();
    return m.list.filter((x) => {
        if(m.view === "trash") { if(!x.deleted_at) return false; }
        else if(x.deleted_at) return false;
        else if(m.view === "archive" ? !x.archived : x.archived) return false;
        if(m.label && !(x.labels || []).includes(m.label)) return false;
        if(!q) return true;
        const hay = (x.title + "\n" + x.body + "\n" + (x.items || []).map((i) => i.t).join("\n") + "\n" + (x.labels || []).join(" ")).toLowerCase();
        return hay.includes(q);
    });
}

function paintMemoShell(){
    const m = feat.memo;
    const tabs = [["notes", "📝 メモ"], ["archive", "🗂️ アーカイブ"], ["trash", "🗑️ ゴミ箱"]];
    m.root.innerHTML = '<header class="memo-head"><button type="button" class="button-secondary memo-back" data-mm="close">← 戻る</button><h2>📝 自分専用メモ</h2>' +
        '<input class="search memo-search" id="memoSearch" type="search" placeholder="メモを検索..." autocomplete="off" value="' + escapeHtml(m.query) + '"><button type="button" class="button-secondary" data-mm="close" aria-label="閉じる">✕</button></header>' +
        '<nav class="memo-tabs">' + tabs.map((t) => '<button type="button" class="' + (m.view === t[0] ? "button" : "button-secondary") + '" data-mm="view" data-v="' + t[0] + '">' + t[1] + '</button>').join("") + '</nav>' +
        '<div class="memo-body"><button type="button" class="memo-new" id="memoNew" data-mm="new">メモを入力...</button><div id="memoLabels" class="memo-labels"></div><div id="memoGrid" class="memo-grid"><div class="empty-list">読み込み中...</div></div></div>' +
        '<div class="memo-note meta">このメモは自分だけが見られます。管理者を含め、他の人には表示されません。</div>';
    paintMemoGrid();
}

function memoCard(x){
    const bg = MEMO_COLORS[x.color] ? ' style="background:' + MEMO_COLORS[x.color] + '"' : "";
    const id = escapeHtml(x.id), trash = !!x.deleted_at;
    const items = (x.items || []).slice(0, 8).map((i, n) => '<label class="memo-item' + (i.d ? " done" : "") + '"><input type="checkbox" data-mm="tick" data-id="' + id + '" data-n="' + n + '"' + (i.d ? " checked" : "") + (trash ? " disabled" : "") + '> <span>' + escapeHtml(i.t) + '</span></label>').join("");
    const more = (x.items || []).length > 8 ? '<div class="meta">ほか ' + ((x.items || []).length - 8) + ' 項目</div>' : "";
    const actions = trash
        ? '<button type="button" data-mm="restore" data-id="' + id + '">♻️ 復元</button><button type="button" data-mm="purge" data-id="' + id + '">完全に削除</button>'
        : '<button type="button" data-mm="pin" data-id="' + id + '" aria-label="ピン留め">' + (x.pinned ? "📌" : "📍") + '</button><button type="button" data-mm="arch" data-id="' + id + '" aria-label="アーカイブ">' + (x.archived ? "📤" : "🗂️") + '</button><button type="button" data-mm="trash" data-id="' + id + '" aria-label="ゴミ箱へ">🗑️</button>';
    return '<article class="memo-card" data-id="' + id + '"' + bg + '><div class="memo-click" data-mm="edit" data-id="' + id + '">' +
        (x.pinned ? '<span class="memo-pin">📌</span>' : "") +
        (x.title ? '<h3>' + escapeHtml(x.title) + '</h3>' : "") +
        (x.body ? '<div class="memo-text">' + escapeHtml(x.body) + '</div>' : "") + '</div>' + items + more +
        ((x.labels || []).length ? '<div class="memo-chips">' + x.labels.map((l) => '<span class="chip">' + escapeHtml(l) + '</span>').join("") + '</div>' : "") +
        '<div class="memo-actions">' + actions + '</div></article>';
}

function paintMemoGrid(){
    const m = feat.memo, grid = $("memoGrid");
    if(!grid) return;
    const labels = [...new Set(m.list.filter((x) => !x.deleted_at).flatMap((x) => x.labels || []))].sort();
    if($("memoLabels")) $("memoLabels").innerHTML = labels.length ? ['<button type="button" class="' + (m.label ? "button-secondary" : "button") + '" data-mm="label" data-l="">すべて</button>'].concat(labels.map((l) => '<button type="button" class="' + (m.label === l ? "button" : "button-secondary") + '" data-mm="label" data-l="' + escapeHtml(l) + '">🏷️ ' + escapeHtml(l) + '</button>')).join("") : "";
    if($("memoNew")) $("memoNew").hidden = m.view !== "notes";
    const rows = memoVisible();
    let html;
    if(!m.loaded) html = '<div class="empty-list">読み込み中...</div>';
    else if(!rows.length) html = '<div class="empty-list">' + (m.query ? "見つかりませんでした。" : m.view === "trash" ? "ゴミ箱は空です。（7日たつと自動で消えます）" : m.view === "archive" ? "アーカイブしたメモはありません。" : "メモはまだありません。「メモを入力...」から追加できます。") + '</div>';
    else{
        const pinned = rows.filter((x) => x.pinned), others = rows.filter((x) => !x.pinned);
        html = (m.view === "trash" ? '<div class="memo-trashbar"><span class="meta">ゴミ箱のメモは7日後に自動で削除されます。</span><button type="button" class="button-secondary" data-mm="empty">ゴミ箱を空にする</button></div>' : "") +
            (pinned.length ? '<div class="memo-sec">ピン留め</div><div class="memo-cols">' + pinned.map(memoCard).join("") + '</div>' + (others.length ? '<div class="memo-sec">その他</div>' : "") : "") +
            (others.length ? '<div class="memo-cols">' + others.map(memoCard).join("") + '</div>' : "");
    }
    grid.innerHTML = html;
}

// ----- 操作 -----

function memoById(id){ return feat.memo.list.find((x) => x.id === id); }

function onMemoInput(event){
    const t = event.target;
    if(t.id === "memoSearch" && event.type === "input"){ feat.memo.query = t.value; paintMemoGrid(); return; }
    if(t.closest && t.closest(".memo-editor")) editorChanged(t);
}

function onMemoKey(event){
    if(event.key === "Escape" && feat.memo.editing){ saveMemoEditor(true); return; }
    const t = event.target;
    if(event.key === "Enter" && t.dataset && t.dataset.mm === "itemtext"){
        event.preventDefault();
        editorAddItem(Number(t.dataset.n) + 1);
    }
}

async function onMemoClick(event){
    const node = event.target.closest("[data-mm]");
    if(!node) return;
    const act = node.dataset.mm, id = node.dataset.id;
    if(act === "close") return closeMemoView();
    if(act === "view"){ feat.memo.view = node.dataset.v; feat.memo.label = ""; paintMemoShell(); return; }
    if(act === "label"){ feat.memo.label = node.dataset.l || ""; paintMemoGrid(); return; }
    if(act === "new") return openMemoEditor(null);
    if(act === "edit") return openMemoEditor(memoById(id));
    if(act === "tick") return tickMemoItem(node);
    if(act === "pin") return patchMemo(id, {pinned:!memoById(id).pinned});
    if(act === "arch") return patchMemo(id, {archived:!memoById(id).archived, pinned:false});
    if(act === "trash") return patchMemo(id, {deleted_at:new Date().toISOString(), pinned:false}, "ゴミ箱に移動しました（7日間は復元できます）。");
    if(act === "restore") return patchMemo(id, {deleted_at:null}, "復元しました。");
    if(act === "purge") return purgeMemo(id);
    if(act === "empty") return emptyTrash();
    if(act.startsWith("e-")) return editorAction(act.slice(2), node);
}

async function patchMemo(id, fields, toast){
    const x = memoById(id);
    if(!x) return;
    const prev = Object.assign({}, x);
    Object.assign(x, fields, {updated_at:new Date().toISOString()});
    paintMemoGrid();
    try{
        const result = await requireClient().from("user_memos").update(Object.assign({}, fields, {updated_at:x.updated_at})).eq("id", id);
        if(result.error) throw result.error;
        if(toast) showToast(toast);
    }catch(error){ Object.assign(x, prev); paintMemoGrid(); showToast(featError(error)); }
}

async function tickMemoItem(node){
    const x = memoById(node.dataset.id), n = Number(node.dataset.n);
    if(!x || !x.items || !x.items[n]) return;
    const items = x.items.map((i, k) => k === n ? Object.assign({}, i, {d:node.checked}) : i);
    await patchMemo(x.id, {items});
}

async function purgeMemo(id){
    if(!confirm("このメモを完全に削除しますか？（元に戻せません）")) return;
    try{
        const result = await requireClient().from("user_memos").delete().eq("id", id);
        if(result.error) throw result.error;
        feat.memo.list = feat.memo.list.filter((x) => x.id !== id);
        paintMemoGrid();
    }catch(error){ showToast(featError(error)); }
}

async function emptyTrash(){
    const ids = feat.memo.list.filter((x) => x.deleted_at).map((x) => x.id);
    if(!ids.length) return;
    if(!confirm("ゴミ箱の " + ids.length + " 件を完全に削除しますか？（元に戻せません）")) return;
    try{
        const result = await requireClient().from("user_memos").delete().in("id", ids);
        if(result.error) throw result.error;
        feat.memo.list = feat.memo.list.filter((x) => !x.deleted_at);
        paintMemoGrid();
    }catch(error){ showToast(featError(error)); }
}

// ----- 編集画面（新規・編集どちらも。閉じると自動で保存） -----

function openMemoEditor(memo){
    const m = feat.memo;
    const draft = memo ? JSON.parse(JSON.stringify(memo)) : {id:null, kind:"note", title:"", body:"", items:[], color:"default", labels:[], pinned:false, archived:false, deleted_at:null};
    if(draft.deleted_at){ showToast("ゴミ箱のメモは、先に「復元」してから編集してください。"); return; }
    m.editing = {draft, orig:memo ? JSON.stringify(memo) : "", saving:false};
    paintMemoEditor();
    const first = $("meTitle");
    if(first) first.focus();
}

function paintMemoEditor(){
    const m = feat.memo, d = m.editing.draft;
    let layer = $("memoEditorLayer");
    if(!layer){ layer = document.createElement("div"); layer.id = "memoEditorLayer"; layer.className = "memo-layer"; m.root.appendChild(layer); }
    const bg = MEMO_COLORS[d.color] ? ' style="background:' + MEMO_COLORS[d.color] + '"' : "";
    layer.innerHTML = '<div class="memo-editor"' + bg + ' role="dialog" aria-label="メモを編集">' +
        '<input id="meTitle" class="memo-title" type="text" maxlength="100" placeholder="タイトル" value="' + escapeHtml(d.title) + '" data-me="title">' +
        (d.kind === "note"
            ? '<textarea id="meBody" class="memo-textarea" maxlength="5000" rows="8" placeholder="メモを入力..." data-me="body">' + escapeHtml(d.body) + '</textarea><div class="meta"><span id="meCount">' + Array.from(d.body).length + '</span> / 5,000文字</div>'
            : '<div id="meItems" class="memo-items">' + d.items.map((i, n) => memoItemRow(i, n)).join("") + '</div><button type="button" class="button-secondary" data-mm="e-additem">＋ 項目を追加</button>') +
        '<input id="meLabels" type="text" maxlength="120" placeholder="ラベル（カンマ区切り・5個まで）" value="' + escapeHtml((d.labels || []).join(", ")) + '" data-me="labels">' +
        '<div class="memo-colors">' + Object.keys(MEMO_COLORS).map((k) => '<button type="button" class="memo-dot' + (d.color === k ? " on" : "") + '" data-mm="e-color" data-k="' + k + '" style="background:' + (MEMO_COLORS[k] || "var(--panel2)") + '" aria-label="' + MEMO_COLOR_NAMES[k] + '" title="' + MEMO_COLOR_NAMES[k] + '"></button>').join("") + '</div>' +
        '<div class="memo-bar"><button type="button" class="button-secondary" data-mm="e-kind">' + (d.kind === "note" ? "☑ リストにする" : "📝 メモにする") + '</button>' +
        '<button type="button" class="button-secondary" data-mm="e-pin">' + (d.pinned ? "📌 ピンを外す" : "📍 ピン留め") + '</button>' +
        (d.id ? '<button type="button" class="button-secondary" data-mm="e-arch">' + (d.archived ? "📤 戻す" : "🗂️ アーカイブ") + '</button><button type="button" class="button-secondary" data-mm="e-trash">🗑️ 削除</button>' : "") +
        '<button type="button" class="button" data-mm="e-done">✔ 完了</button></div></div>';
}

function memoItemRow(i, n){
    return '<div class="memo-itemrow"><input type="checkbox" data-mm="e-tick" data-n="' + n + '"' + (i.d ? " checked" : "") + ' aria-label="完了"><input type="text" maxlength="200" class="memo-itemtext" data-mm="itemtext" data-n="' + n + '" value="' + escapeHtml(i.t) + '" placeholder="項目"><button type="button" class="button-secondary" data-mm="e-delitem" data-n="' + n + '" aria-label="項目を削除">✕</button></div>';
}

function editorChanged(t){
    const d = feat.memo.editing && feat.memo.editing.draft;
    if(!d) return;
    if(t.dataset.me === "title") d.title = t.value;
    else if(t.dataset.me === "body"){ d.body = t.value; if($("meCount")) $("meCount").textContent = Array.from(t.value).length; }
    else if(t.dataset.me === "labels") d.labels = parseLabels(t.value);
    else if(t.dataset.mm === "itemtext"){ const n = Number(t.dataset.n); if(d.items[n]) d.items[n].t = t.value; }
}

function parseLabels(text){
    return [...new Set(String(text).split(/[,、，]/).map((s) => s.trim().slice(0, 20)).filter(Boolean))].slice(0, 5);
}

function editorAddItem(at){
    const d = feat.memo.editing.draft;
    if(d.items.length >= 100){ showToast("項目は100個までです。"); return; }
    const index = typeof at === "number" ? Math.min(at, d.items.length) : d.items.length;
    d.items.splice(index, 0, {t:"", d:false});
    $("meItems").innerHTML = d.items.map((i, n) => memoItemRow(i, n)).join("");
    const input = $("meItems").querySelector('[data-mm="itemtext"][data-n="' + index + '"]');
    if(input) input.focus();
}

function editorAction(act, node){
    const e = feat.memo.editing;
    if(!e) return;
    const d = e.draft;
    if(act === "color"){ d.color = node.dataset.k; paintMemoEditor(); return; }
    if(act === "pin"){ d.pinned = !d.pinned; paintMemoEditor(); return; }
    if(act === "kind"){
        if(d.kind === "note"){ d.items = d.body.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, 100).map((t) => ({t:t.slice(0, 200), d:false})); d.body = ""; d.kind = "list"; if(!d.items.length) d.items = [{t:"", d:false}]; }
        else{ d.body = d.items.map((i) => (i.d ? "✔ " : "") + i.t).filter(Boolean).join("\n").slice(0, 5000); d.items = []; d.kind = "note"; }
        paintMemoEditor(); return;
    }
    if(act === "additem") return editorAddItem();
    if(act === "delitem"){ d.items.splice(Number(node.dataset.n), 1); $("meItems").innerHTML = d.items.map((i, n) => memoItemRow(i, n)).join(""); return; }
    if(act === "tick"){ const i = d.items[Number(node.dataset.n)]; if(i) i.d = node.checked; return; }
    if(act === "done") return saveMemoEditor(true);
    if(act === "arch"){ d.archived = !d.archived; d.pinned = false; return saveMemoEditor(true); }
    if(act === "trash"){ d.deleted_at = new Date().toISOString(); d.pinned = false; return saveMemoEditor(true, "ゴミ箱に移動しました（7日間は復元できます）。"); }
}

function memoIsEmpty(d){
    return !d.title.trim() && !d.body.trim() && !d.items.some((i) => i.t.trim());
}

async function saveMemoEditor(close, toast){
    const m = feat.memo, e = m.editing;
    if(!e || e.saving) return;
    const d = e.draft;
    d.items = d.items.filter((i) => i.t.trim()).map((i) => ({t:i.t.trim().slice(0, 200), d:!!i.d}));
    if(memoIsEmpty(d) && !d.id){ endEditor(); return; }
    if(memoIsEmpty(d) && d.id){ d.deleted_at = d.deleted_at || new Date().toISOString(); }
    const row = {kind:d.kind, title:d.title.trim().slice(0, 100), body:d.body.slice(0, 5000), items:d.items, color:MEMO_COLORS[d.color] !== undefined ? d.color : "default", labels:(d.labels || []).slice(0, 5), pinned:!!d.pinned, archived:!!d.archived, deleted_at:d.deleted_at || null, updated_at:new Date().toISOString()};
    const prev = d.id ? memoById(d.id) : null;
    if(prev){
        const same = ["kind", "title", "body", "color", "pinned", "archived"].every((k) => prev[k] === row[k]) &&
            JSON.stringify(prev.items || []) === JSON.stringify(row.items) && JSON.stringify(prev.labels || []) === JSON.stringify(row.labels) && (prev.deleted_at || null) === (row.deleted_at || null);
        if(same){ endEditor(); return; }
    }
    e.saving = true;
    try{
        let result;
        if(d.id) result = await requireClient().from("user_memos").update(row).eq("id", d.id).select(MEMO_COLUMNS).single();
        else result = await requireClient().from("user_memos").insert(Object.assign({user_id:state.user.id}, row)).select(MEMO_COLUMNS).single();
        if(result.error) throw result.error;
        const saved = result.data;
        const at = m.list.findIndex((x) => x.id === saved.id);
        if(at >= 0) m.list[at] = saved; else m.list.unshift(saved);
        m.list.sort((a, b) => (b.pinned - a.pinned) || (new Date(b.updated_at) - new Date(a.updated_at)));
        if(toast) showToast(toast);
        endEditor();
    }catch(error){
        e.saving = false;
        showToast(featError(error) + "（編集内容は画面に残してあります）");
    }
}

function endEditor(){
    feat.memo.editing = null;
    const layer = $("memoEditorLayer");
    if(layer) layer.remove();
    paintMemoGrid();
}
