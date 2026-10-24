"use strict";
// ===== お知らせ（管理者→全員）／管理者向けの利用状況グラフ =====
// ・利用状況は「件数だけ」を集計します（メッセージの中身は読みません）。

const AN_SEEN = () => "are_ann_seen_" + (state.user ? state.user.id : "x");
const an = {list:[]};

function initAnnounce(){
    registerTool("an", onAnnounceAction);
    anLoad(true);
    try{ requireClient().channel("are-ann").on("postgres_changes", {event:"INSERT", schema:"public", table:"announcements"}, () => anLoad(true)).subscribe(); }catch(_e){}
}
async function anLoad(popup){
    const r = await requireClient().from("announcements").select("id,title,body,created_at").order("created_at", {ascending:false}).limit(30);
    if(r.error) return;
    an.list = r.data || [];
    if(!popup) return;
    let seen = []; try{ seen = JSON.parse(localStorage.getItem(AN_SEEN()) || "[]"); }catch(_e){}
    const fresh = an.list.filter((x) => !seen.includes(x.id) && Date.now() - new Date(x.created_at).getTime() < 14 * 86400000).slice(0, 3);
    if(fresh.length && (el.profileModal.hidden)) anPopup(fresh);
}
function anPopup(items){
    openSheet(toolHead("📢 お知らせ") + items.map((x) => '<div class="admin-card"><b>' + escapeHtml(x.title) + '</b><div class="meta">' + escapeHtml(formatDate(x.created_at)) + '</div><div style="white-space:pre-wrap;overflow-wrap:anywhere">' + escapeHtml(x.body) + '</div></div>').join("") + '<div class="row"><button type="button" class="button" data-t="an:ok">確認しました</button></div>');
    an.shown = items.map((x) => x.id);
}
async function openAnnouncements(){
    await anLoad(false);
    openSheet(toolHead("📢 お知らせ", "管理者からのお知らせです") + (an.list.length ? an.list.map((x) => '<div class="admin-card"><b>' + escapeHtml(x.title) + '</b><div class="meta">' + escapeHtml(formatDate(x.created_at)) + '</div><div style="white-space:pre-wrap;overflow-wrap:anywhere">' + escapeHtml(x.body) + '</div></div>').join("") : '<div class="empty-list">お知らせはありません。</div>') + toolClose());
    anMarkSeen(an.list.map((x) => x.id));
}
function anMarkSeen(ids){ let seen = []; try{ seen = JSON.parse(localStorage.getItem(AN_SEEN()) || "[]"); }catch(_e){} try{ localStorage.setItem(AN_SEEN(), JSON.stringify(Array.from(new Set(seen.concat(ids))).slice(-100))); }catch(_e){} }
function onAnnounceAction(action){ if(action === "ok"){ anMarkSeen(an.shown || []); closeSheet(); } }

// ---------- 管理者パネル ----------
async function renderAdminAnnounce(client){
    const r = await client.rpc("admin_list_announcements"); if(r.error) throw r.error;
    el.adminBody.innerHTML = '<div class="admin-card"><b>全員にお知らせを送る</b><input id="anTitle" type="text" maxlength="60" placeholder="タイトル（60文字まで）"><textarea id="anBody" rows="4" maxlength="1000" placeholder="本文（1000文字まで）"></textarea>' +
        '<label for="anDays">表示する期間</label><select id="anDays" class="status-select"><option value="7">7日</option><option value="30" selected>30日</option><option value="">期限なし</option></select>' +
        '<div class="row"><button type="button" class="button" id="anSend">送信（全員に表示されます）</button></div></div>' +
        '<b>これまでのお知らせ</b>' + (r.data.length ? r.data.map((x) => '<div class="admin-card"><b>' + escapeHtml(x.title) + '</b> <span class="meta">' + escapeHtml(formatDate(x.created_at)) + (x.expires_at ? ' ・ ～' + escapeHtml(formatDate(x.expires_at)) : '') + '</span><div style="white-space:pre-wrap">' + escapeHtml(x.body) + '</div><div class="row"><button type="button" class="button-danger" data-an-del="' + escapeHtml(x.id) + '">削除</button></div></div>').join("") : '<div class="empty-list">まだありません。</div>');
}
async function renderAdminStats(client){
    const r = await client.rpc("admin_usage_stats", {p_days:30}); if(r.error) throw r.error;
    const d = r.data, days = d.days || [], max = (k) => Math.max(1, ...days.map((x) => x[k]));
    const chart = (k, title, color) => {
        const m = max(k), w = 300, h = 90, bw = w / Math.max(1, days.length);
        return '<div class="admin-card"><b>' + title + '</b> <span class="meta">（最大 ' + m + '）</span><svg viewBox="0 0 ' + w + ' ' + (h + 14) + '" width="100%" role="img" aria-label="' + title + 'の30日の推移">' +
            days.map((x, i) => '<rect x="' + (i * bw + 1).toFixed(1) + '" y="' + (h - x[k] / m * h).toFixed(1) + '" width="' + Math.max(1, bw - 2).toFixed(1) + '" height="' + (x[k] / m * h).toFixed(1) + '" fill="' + color + '"><title>' + escapeHtml(x.day) + '：' + x[k] + '</title></rect>').join("") +
            '<text x="0" y="' + (h + 11) + '" font-size="9" fill="currentColor">' + escapeHtml((days[0] || {}).day || "") + '</text><text x="' + w + '" y="' + (h + 11) + '" font-size="9" text-anchor="end" fill="currentColor">' + escapeHtml((days[days.length - 1] || {}).day || "") + '</text></svg></div>';
    };
    el.adminBody.innerHTML = '<div class="co-sum"><div><b>' + d.users + '</b><small>ユーザー</small></div><div><b>' + d.active7 + '</b><small>7日の発言者</small></div><div><b>' + d.rooms + '</b><small>会話（グループ ' + d.groups + '）</small></div><div><b>' + d.messages_total + '</b><small>メッセージ総数</small></div></div>' +
        '<div class="meta">未対応の通報：' + d.reports_open + '件 ・ 件数のみ集計（中身は見ません）</div>' +
        chart("messages", "1日のメッセージ数", "#4c6ef5") + chart("senders", "1日の発言者数", "#12b886") + chart("signups", "1日の新規登録", "#f08c00");
}
document.addEventListener("click", (e) => {
    const send = e.target.closest("#anSend"), del = e.target.closest("[data-an-del]");
    if(!send && !del) return;
    runTool(async () => {
        const c = requireClient();
        if(send){
            const title = $("anTitle").value.trim(), body = $("anBody").value.trim(), days = $("anDays").value;
            if(!title || !body){ showToast("タイトルと本文を入れてください。"); return; }
            if(!confirm("全員に表示されます。送信しますか？")) return;
            const r = await c.rpc("admin_post_announcement", {p_title:title, p_body:body, p_days:days ? Number(days) : null}); if(r.error) throw r.error;
            showToast("お知らせを送りました。");
        }else{
            if(!confirm("このお知らせを削除しますか？")) return;
            const r = await c.rpc("admin_delete_announcement", {p_id:del.dataset.anDel}); if(r.error) throw r.error;
        }
        await renderAdminAnnounce(c);
    });
});
