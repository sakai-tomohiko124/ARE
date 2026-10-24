"use strict";
// ===== 通報（メッセージやユーザーを管理者に知らせる）=====
// ・メッセージの 🚩 から、そのメッセージ（と送った人）を通報できます。ユーザーのプロフィールからは、そのユーザーを通報できます。
// ・通報すると、その時点のメッセージの内容が控えとして管理者に届きます（あとで削除されても確認できるように）。
// ・通報した人の名前は、通報された相手には伝わりません。1日に10件までです。
// ・管理者は、管理者パネルの「通報」で確認し、「対応済み」「問題なし」にできます。

const RP_REASONS = [["spam", "迷惑・宣伝（スパム）"], ["abuse", "悪口・暴言"], ["harass", "しつこい・嫌がらせ"], ["inappropriate", "不適切な内容"], ["other", "その他"]];
const rp = {target:null, message:null, name:""};

function initReport(){
    registerTool("rp", onReportAction);
    if(!window.AREFeatures.ok("msgmenu")) throw new Error("メッセージ操作メニューが起動していません。");
    addMsgTool({id:"report", icon:"🚩", label:"通報（管理者に知らせる）", when:(m) => m.sender_id !== state.user.id, run:(m) => openReport({message:m.id, target:m.sender_id})});
    if(typeof refreshAdminBadge === "function"){
        const origBadge = refreshAdminBadge;
        refreshAdminBadge = async function(){
            await origBadge.apply(this, arguments);
            try{
                if(!feat.isAdmin) return;
                const r = await requireClient().rpc("admin_list_reports", {p_status:"open"});
                if(!r.error && r.data.length) el.adminBadge.textContent = String((Number(el.adminBadge.textContent) || 0) + r.data.length);
            }catch(_e){ /* バッジだけの話 */ }
        };
    }
    const origView = openProfileView;
    openProfileView = function(profile){
        origView.apply(this, arguments);
        try{
            if(!profile || !profile.id || profile.id === state.user.id) return;
            const row = el.profileSheet.querySelector(".row:last-of-type");
            const b = document.createElement("button");
            b.type = "button"; b.className = "button-danger"; b.dataset.t = "rp:user"; b.dataset.id = profile.id; b.dataset.name = profile.display_name || "";
            b.textContent = "🚩 このユーザーを通報";
            if(row) row.insertAdjacentElement("afterbegin", b); else el.profileSheet.appendChild(b);
        }catch(e){ console.error("[ARE report]", e); }
    };
}

function openReport(o){
    rp.target = o.target || null; rp.message = o.message || null;
    const m = rp.message ? (state.messages || []).find((x) => x.id === rp.message) : null;
    const quote = m ? messageSummary(parseMessageContent(m.content)).replace(/\s+/g, " ").slice(0, 80) : "";
    openSheet(toolHead("🚩 通報", rp.message ? "このメッセージを管理者に知らせます" : "このユーザーを管理者に知らせます") +
        (quote ? '<div class="admin-card meta">「' + escapeHtml(quote) + '」</div>' : "") +
        '<label>理由</label><div class="pick">' + RP_REASONS.map((r, i) => '<label style="display:flex;gap:8px;align-items:center;font-size:14px;color:var(--text)"><input type="radio" name="rpReason" value="' + r[0] + '"' + (i === 0 ? " checked" : "") + '> ' + r[1] + '</label>').join("") + '</div>' +
        '<label for="rpDetail">くわしく（任意・300文字まで）</label><textarea id="rpDetail" maxlength="300" rows="3"></textarea>' +
        '<div class="meta">通報した人の名前は、相手には伝わりません。うその通報をくり返すと、あなたが制限されることがあります。</div>' +
        '<div class="row"><button type="button" class="button-danger" data-t="rp:send">通報する</button><button type="button" class="button-secondary" data-pm="close">やめる</button></div>');
}

async function onReportAction(action, node){
    if(action === "user"){ openReport({target:node.dataset.id}); return; }
    if(action !== "send") return;
    const reason = (document.querySelector('input[name="rpReason"]:checked') || {}).value || "other";
    const detail = String((document.getElementById("rpDetail") || {}).value || "").trim();
    const res = await requireClient().rpc("report_content", {p_target:rp.message ? null : rp.target, p_message:rp.message, p_reason:reason, p_detail:detail || null});
    if(res.error) throw res.error;
    closeSheet();
    showToast("通報しました。管理者が確認します。");
}

// ---------- 管理者パネル ----------
const RP_STATUS = {open:"未対応", done:"対応済み", dismissed:"問題なし"};
let rpAdminFilter = "open";

async function renderAdminReports(client){
    const res = await client.rpc("admin_list_reports", {p_status:rpAdminFilter});
    if(res.error) throw res.error;
    const filters = '<div class="row" style="justify-content:flex-start">' + [["open", "未対応"], ["done", "対応済み"], ["dismissed", "問題なし"], ["all", "すべて"]].map((f) => '<button type="button" class="' + (rpAdminFilter === f[0] ? "" : "button-secondary") + '" data-rp-filter="' + f[0] + '">' + f[1] + '</button>').join("") + '</div>';
    el.adminBody.innerHTML = filters + (res.data.length ? res.data.map((r) => {
        let snap = "";
        if(r.snapshot){ try{ snap = messageSummary(parseMessageContent(r.snapshot)); }catch(_e){ snap = String(r.snapshot).slice(0, 200); } }
        return '<div class="admin-card"><div class="meta">' + escapeHtml(formatDate(r.created_at)) + ' ・ ' + RP_STATUS[r.status] + '</div>' +
            '<div><b>' + escapeHtml(r.target_name || "（不明）") + '</b> を通報 ← ' + escapeHtml(r.reporter_name || "ユーザー") + '</div>' +
            '<div class="meta">理由：' + escapeHtml((RP_REASONS.find((x) => x[0] === r.reason) || [0, r.reason])[1]) + (r.detail ? ' ／ ' + escapeHtml(r.detail) : "") + '</div>' +
            (snap ? '<div class="admin-card" style="white-space:pre-wrap">' + escapeHtml(String(snap).slice(0, 300)) + '</div>' : "") +
            (r.admin_note ? '<div class="meta">管理者メモ：' + escapeHtml(r.admin_note) + '</div>' : "") +
            '<div class="row">' + (r.room_id ? '<button type="button" class="button-secondary" data-admin-room="' + escapeHtml(r.room_id) + '">会話を見る</button>' : "") +
            (r.status === "open" ? '<button type="button" class="button" data-rp-do="done" data-id="' + escapeHtml(r.id) + '">対応済み</button><button type="button" class="button-secondary" data-rp-do="dismissed" data-id="' + escapeHtml(r.id) + '">問題なし</button>' : '<button type="button" class="button-secondary" data-rp-do="open" data-id="' + escapeHtml(r.id) + '">未対応にもどす</button>') + '</div></div>';
    }).join("") : '<div class="empty-list">該当する通報はありません。</div>');
}

document.addEventListener("click", (event) => {
    const f = event.target.closest && event.target.closest("[data-rp-filter]");
    const d = event.target.closest && event.target.closest("[data-rp-do]");
    if(!f && !d) return;
    if(!el.adminBody || !el.adminBody.contains(event.target)) return;
    (async () => {
        try{
            if(f){ rpAdminFilter = f.dataset.rpFilter; await renderAdmin(); return; }
            const note = d.dataset.rpDo === "open" ? "" : (window.prompt("管理者メモ（任意）", "") || "");
            const res = await requireClient().rpc("admin_resolve_report", {p_id:d.dataset.id, p_status:d.dataset.rpDo, p_note:note});
            if(res.error) throw res.error;
            await renderAdmin();
        }catch(error){ showToast(featError(error)); }
    })();
});
