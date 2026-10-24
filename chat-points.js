"use strict";
// ===== ポイント・AREShop・お試し期間(90日)・スパム凍結 =====
// ポイントの計算・購入・スパム判定はサーバー側（Supabase）で行います。この画面は表示と入口の案内です。
// 注意：機能の「ロック」は画面側の制限です（データを守るサーバーの規則とは別）。仕様どおりの“案内”であり、厳密な課金防御ではありません。
Object.assign(FEAT_ERRORS, {
    spam_locked:"スパムの疑いで一時停止中です。", account_frozen:"アカウントは現在つかえません（不適切な発言による制限中です）。", not_enough_points:"ポイントが足りません。", already_owned:"すでに交換済みです。",
    not_owned:"まだ交換していません。", not_for_points:"この商品はポイントでは交換できません。"
});

const PT_FREE = new Set(["sites","quicksend","notify","presence","messages","profile","posts","follow","groups","history","account","admin","adminUsers","extras","calls","msgmenu","reply","forward","react","pin","block","search","typing","voice","stamps","mention","tools","push","drafts","phrases","comfort","jump","stars","folders","nick","contact","report","share","prefs","lang","ctx","thread","lock","announce","misc","mood","ptshop"]);
const PT_PACKS = {
    pack_life:{name:"くらしパック", price:300, features:["diary","habit","budget","timer","calc","shop","health","co2","memo","planner","sched","geo","split","board"]},
    pack_create:{name:"つくるパック", price:300, features:["story","album","imgedit","draw","mystamp","avatar","ocr","live","location","archive"]},
    pack_fun:{name:"あそぶパック", price:400, features:["games","vs","bj","cards","fun"]},
    pack_smart:{name:"かしこいパック", price:400, features:["myai","ai","work","screen"]}
};
const pt = {acc:null, items:[], tab:"video", timer:null, spamEnd:0, spamTimer:null, ready:false, confirm:null};

const AREAccess = {
    info(){ return pt.acc; },
    isAdmin(){ return !!(pt.acc && pt.acc.admin) || feat.isAdmin === true; },
    trialActive(){ return !!(pt.acc && pt.acc.trial_active); },
    passActive(){ return !!(pt.acc && pt.acc.pass_until && new Date(pt.acc.pass_until) > new Date()); },
    owns(key){ return !!(pt.acc && (pt.acc.owned || []).includes(key)); },
    needFor(feature){
        if(feature === "rpg") return "rpg";
        for(const k in PT_PACKS){ if(PT_PACKS[k].features.includes(feature)) return k; }
        return null;
    },
    can(feature){
        if(PT_FREE.has(feature)) return true;
        if(this.isAdmin()) return true;
        const need = this.needFor(feature);
        if(!need) return true;
        if(!pt.acc) return true;            // 状態が取れていないうちは止めない（取得できたら判定）
        return this.trialActive() || this.passActive() || this.owns(need);
    }
};
window.AREAccess = AREAccess;

function ptLabel(feature){
    const t = (typeof TOOL_LIST !== "undefined" ? TOOL_LIST : []).find((x) => x[0] === feature);
    return t ? t[1] + " " + t[2] : "この機能";
}
function ptDaysLeft(){ if(!pt.acc || !pt.acc.trial_ends) return 0; return Math.max(0, Math.ceil((new Date(pt.acc.trial_ends) - Date.now()) / 86400000)); }

async function ptRefresh(){
    try{
        const r = await requireClient().rpc("my_access");
        if(r.error) throw r.error;
        pt.acc = r.data; pt.ready = true;
        ptPaintCard();
        if(r.data && r.data.locked_until && new Date(r.data.locked_until) > new Date() && !r.data.admin) ptFreeze(new Date(r.data.locked_until).getTime());
        if(typeof ngOnAccess === "function") ngOnAccess(r.data);
    }catch(e){ ptPaintCard(e); }
}

function initPoints(){
    registerTool("pt", onPointsAction);
    const anchor = document.querySelector(".profile-card.pane-me");
    if(anchor && !$("ptCard")){
        anchor.insertAdjacentHTML("afterend", '<div class="profile-card pane-me" id="ptCard"><div class="meta">ポイントを読み込み中…</div></div>');
    }
    if($("ptCard")) $("ptCard").addEventListener("click", (e) => {
        const b = e.target.closest("[data-t]"); if(!b) return;
        const parts = String(b.dataset.t).split(":"); if(parts[0] === "pt") runTool(() => onPointsAction(parts[1], b));
    });
    // 機能の入口：ポイント／お試し期間／パスで開けるか確認する
    document.addEventListener("click", (e) => {
        const holder = e.target.closest && e.target.closest("[data-feature]");
        if(!holder) return;
        const key = holder.dataset.feature;
        if(!AREAccess.can(key)){ e.preventDefault(); e.stopImmediatePropagation(); ptLockDialog(key); }
    }, true);
    // 直接開く関数もガードする（ツール一覧以外の入口からでも同じ）
    (typeof TOOL_LIST !== "undefined" ? TOOL_LIST : []).forEach((t) => {
        const name = t[4], orig = window[name];
        if(typeof orig !== "function" || orig.__ptWrapped) return;
        const wrapped = function(){ if(!AREAccess.can(t[0])){ ptLockDialog(t[0]); return; } return orig.apply(this, arguments); };
        wrapped.__ptWrapped = true;
        window[name] = wrapped;
    });
    addPayloadSentHook(() => { setTimeout(ptRefresh, 600); });
    pt.timer = setInterval(() => { if(!document.hidden) ptRefresh(); }, 20000);
    document.addEventListener("visibilitychange", () => { if(!document.hidden) ptRefresh(); });
    try{
        requireClient().channel("are-spam").on("postgres_changes", {event:"*", schema:"public", table:"spam_locks", filter:"user_id=eq." + state.user.id}, () => ptRefresh()).subscribe();
    }catch(_e){}
    // 送信エラーが「スパム凍結」だったら、すぐ凍結画面にする
    const st = document.getElementById("status");
    if(st) new MutationObserver(() => { if(/スパムの疑い/.test(st.textContent || "")) ptRefresh(); }).observe(st, {childList:true, characterData:true, subtree:true});
    ptStart();
}
async function ptStart(){
    try{ if(/[?&]paid=1/.test(location.search)) showToast("お支払いを確認しています。パスの反映まで少し時間がかかることがあります。"); }catch(_e){}
    await ptRefresh();
    try{
        const r = await requireClient().rpc("claim_daily_bonus");
        if(!r.error && r.data && r.data.gained > 0){
            showToast("🎁 ログインボーナス +" + r.data.gained + "pt（" + r.data.streak + "日連続）");
            await ptRefresh();
        }
    }catch(_e){}
}

function ptPaintCard(err){
    const box = $("ptCard"); if(!box) return;
    if(!pt.acc){ box.innerHTML = '<div class="meta">' + (err ? "ポイントはまだ使えません（サーバー側の準備ができていません）" : "読み込み中…") + '</div>'; return; }
    const a = pt.acc;
    let status;
    if(a.admin) status = "管理者：すべての機能が使えます";
    else if(AREAccess.passActive()) status = "1か月パス：" + new Date(a.pass_until).toLocaleDateString("ja-JP") + " まで全機能";
    else if(a.trial_active) status = "お試し期間：全機能OK・あと" + ptDaysLeft() + "日";
    else status = "お試し期間は終了。機能はポイントで解放します";
    box.innerHTML = '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><div><div class="meta">ポイント</div><b style="font-size:26px" id="ptNum">' + a.points + '</b> <span class="meta">pt</span></div>' +
        '<div style="flex:1;min-width:140px" class="meta">' + escapeHtml(status) + '</div></div>' +
        '<div class="row"><button type="button" class="button" data-t="pt:shop">🛍️ AREShop</button><button type="button" class="button-secondary" data-t="pt:history">履歴</button></div>';
}

// ---------- 入口が閉じているときの案内 ----------
function ptLockDialog(feature){
    const need = AREAccess.needFor(feature);
    const rpg = feature === "rpg";
    const pk = PT_PACKS[need];
    openSheet(toolHead("🔒 " + escapeHtml(ptLabel(feature)), rpg ? "お試し期間（90日）が終わったため、この冒険は 1000pt と交換すると遊べます" : "お試し期間（90日）が終わったため、ポイントで解放します") +
        '<div class="admin-card">' + (rpg ? 'RPG「そういうときは、AREだ！」：<b>1000pt</b>' : escapeHtml(pk ? pk.name : "") + '：<b>' + (pk ? pk.price : "") + 'pt</b>で解放（または1か月パス）') +
        '<div class="meta">いまのポイント：' + (pt.acc ? pt.acc.points : 0) + 'pt</div></div>' +
        '<div class="row"><button type="button" class="button" data-t="pt:shop" data-tab="' + (rpg ? "rpg" : "pack") + '">AREShopへ</button><button type="button" class="button-secondary" data-pm="close">閉じる</button></div>');
}

// ---------- AREShop ----------
async function openPtShop(tab){
    if(tab) pt.tab = tab;
    openSheet(toolHead("🛍️ AREShop", "ポイントと交換します（お金は使いません）") + '<div id="ptShopBody"><div class="meta">読み込み中…</div></div>');
    await ptShopLoad();
}
async function ptShopLoad(){
    const c = requireClient();
    const r = await c.rpc("shop_list");
    if(!$("ptShopBody")) return;
    if(r.error){ $("ptShopBody").innerHTML = '<div class="empty-list">' + escapeHtml(featError(r.error)) + '</div>' + toolClose(); return; }
    pt.items = r.data || [];
    ptShopPaint();
}
function ptShopPaint(){
    const box = $("ptShopBody"); if(!box) return;
    const tabs = [["video","🎬 動画"],["story","📖 物語"],["pack","🧩 機能パック"],["rpg","🗡️ RPG"],["pass","💳 パス"]];
    const pts = pt.acc ? pt.acc.points : 0;
    const list = pt.items.filter((i) => i.kind === pt.tab);
    const btn = (i) => {
        if(i.kind === "pass") return "";
        if(i.owned) return (i.kind === "video" || i.kind === "story") ? '<button type="button" class="button" data-t="pt:view" data-id="' + i.id + '">見る</button>' : '<span class="meta">✅ 交換済み</span>';
        const lack = pts < i.price;
        if(pt.confirm === i.id) return '<button type="button" class="button" data-t="pt:buy" data-id="' + i.id + '">本当に ' + i.price + 'pt と交換する</button><button type="button" class="button-secondary" data-t="pt:cancel">やめる</button>';
        return '<button type="button" class="button' + (lack ? " button-secondary" : "") + '" data-t="pt:ask" data-id="' + i.id + '"' + (lack ? " disabled" : "") + '>' + i.price + 'pt で交換</button>' + (lack ? '<span class="meta">あと ' + (i.price - pts) + 'pt</span>' : "");
    };
    let body;
    if(pt.tab === "pass"){
        const active = AREAccess.passActive();
        body = '<div class="admin-card"><b>1か月パス（1,000円）</b><div class="meta">30日間、すべての機能が使い放題です（RPGは別）。クレジットカード、Apple Pay、Google Pay で支払えます。</div>' +
            (active ? '<div class="meta">✅ いま有効：' + new Date(pt.acc.pass_until).toLocaleDateString("ja-JP") + ' まで（追加購入すると延長されます）</div>' : "") +
            '<div class="row"><button type="button" class="button" data-t="pt:pay">1,000円で購入する</button></div>' +
            '<div class="meta">支払い画面は Stripe に移動します。ご注意：Google Play／App Store の「アプリ内課金」には対応していません（Webアプリのため）。</div></div>';
    }else{
        body = list.length ? list.map((i) => '<div class="admin-card"><b>' + escapeHtml(i.title) + '</b>' + (i.description ? '<div class="meta">' + escapeHtml(i.description) + '</div>' : "") +
            '<div class="row" style="justify-content:space-between;align-items:center"><span><b>' + i.price + '</b> pt</span><span>' + btn(i) + '</span></div></div>').join("") : '<div class="empty-list">まだ商品がありません</div>';
    }
    box.innerHTML = '<div class="row" style="justify-content:flex-start;flex-wrap:wrap">' + tabs.map((t) => '<button type="button" class="' + (t[0] === pt.tab ? "button" : "button-secondary") + '" data-t="pt:tab" data-tab="' + t[0] + '">' + t[1] + '</button>').join("") + '</div>' +
        '<div class="meta">あなたのポイント：<b>' + pts + '</b> pt ／ 集め方：ログイン+10、チャット1回+5（1日100ptまで）、日記+5、習慣+2、7日連続+30</div>' + body + toolClose();
}
async function ptView(id){
    const c = requireClient();
    const r = await c.rpc("shop_content", {p_item:id}); if(r.error) throw r.error;
    const d = r.data || {};
    let inner;
    if(d.kind === "video" && d.video_path){
        const s = await c.storage.from("shop-content").createSignedUrl(d.video_path, 3600); if(s.error) throw s.error;
        inner = '<video controls controlsList="nodownload noremoteplayback" disablePictureInPicture playsinline style="width:100%;border-radius:10px;background:#000" src="' + escapeHtml(s.data.signedUrl) + '"></video>';
    }else{
        inner = '<div style="white-space:pre-wrap;line-height:1.8;max-height:60vh;overflow:auto">' + escapeHtml(d.body || "（本文がありません）") + '</div>';
    }
    openSheet(toolHead(escapeHtml(d.title || ""), "") + inner + '<div class="row"><button type="button" class="button-secondary" data-t="pt:shop">ショップへ戻る</button><button type="button" class="button-secondary" data-pm="close">閉じる</button></div>');
}
async function ptHistory(){
    const r = await requireClient().rpc("point_history"); if(r.error) throw r.error;
    const names = {chat:"チャット", login:"ログインボーナス", streak:"7日連続ボーナス", diary:"日記", habit:"習慣", admin:"運営より"};
    openSheet(toolHead("ポイントの履歴", "最近50件") + ((r.data || []).length ? r.data.map((x) => '<div class="admin-card" style="display:flex;justify-content:space-between"><span>' + escapeHtml(x.reason.startsWith("shop:") ? "ショップで交換" : (names[x.reason] || x.reason)) + '<small class="meta"> ' + escapeHtml(formatDate(x.created_at)) + '</small></span><b style="color:' + (x.delta < 0 ? "#e03131" : "#2b8a3e") + '">' + (x.delta > 0 ? "+" : "") + x.delta + '</b></div>').join("") : '<div class="empty-list">まだありません</div>') +
        '<div class="row"><button type="button" class="button-secondary" data-t="pt:shop">ショップへ</button><button type="button" class="button-secondary" data-pm="close">閉じる</button></div>');
}
async function onPointsAction(action, node){
    const c = requireClient();
    try{
        if(action === "shop"){ await openPtShop((node && node.dataset.tab) || pt.tab); return; }
        if(action === "history"){ await ptHistory(); return; }
        if(action === "tab"){ pt.tab = node.dataset.tab; pt.confirm = null; ptShopPaint(); return; }
        if(action === "ask"){ pt.confirm = node.dataset.id; ptShopPaint(); return; }
        if(action === "cancel"){ pt.confirm = null; ptShopPaint(); return; }
        if(action === "buy"){
            const r = await c.rpc("shop_buy", {p_item:node.dataset.id}); if(r.error) throw r.error;
            pt.confirm = null; showToast("交換しました 🎉"); await ptRefresh(); await ptShopLoad(); return;
        }
        if(action === "view"){ await ptView(node.dataset.id); return; }
        if(action === "pay"){
            const r = await c.functions.invoke("create-checkout", {body:{}});
            if(r.error || !r.data || !r.data.url){ showToast("決済はまだ準備中です（運営側でStripeの設定が必要です）。"); return; }
            window.location.href = r.data.url; return;
        }
    }catch(error){
        console.error("[ARE points]", error);
        if(/not_enough_points|already_owned/.test(String(error && error.message))) await ptRefresh();
        showToast(featError(error));
    }
}

// ---------- スパム凍結（60秒、その後ログアウト）----------
function ptFreeze(untilMs){
    if(pt.spamEnd && pt.spamEnd >= untilMs) return;
    pt.spamEnd = untilMs;
    let ov = $("ptFreeze");
    if(!ov){
        ov = document.createElement("div"); ov.id = "ptFreeze"; ov.className = "pt-freeze"; ov.setAttribute("role", "alertdialog");
        document.body.appendChild(ov);
    }
    clearInterval(pt.spamTimer);
    const tick = () => {
        const left = Math.max(0, Math.ceil((pt.spamEnd - Date.now()) / 1000));
        ov.innerHTML = '<div class="pt-freeze-box"><div style="font-size:44px">🧊</div><h3 style="margin:0">スパムの疑いで一時停止中</h3>' +
            '<div class="meta">ポイント目的の連続送信と判定されました。管理者に報告されます。</div><div class="pt-count">' + left + '</div><div class="meta">秒後に自動でログアウトします</div></div>';
        if(left <= 0){ clearInterval(pt.spamTimer); ptForceLogout(); }
    };
    tick(); pt.spamTimer = setInterval(tick, 500);
}
async function ptForceLogout(){
    try{ feat.timers.forEach(clearInterval); await window.AREAuth.logout(); }catch(_e){}
    window.location.replace("./index.html");
}

// ---------- 管理者：ショップ管理 ----------
async function renderAdminShop(client){
    const [r, l] = await Promise.all([client.rpc("admin_shop_list"), client.rpc("admin_spam_locks")]);
    if(r.error) throw r.error;
    const items = r.data || [], locks = (l && l.data) || [];
    el.adminBody.innerHTML = '<div class="admin-card"><b>商品を追加（動画・物語）</b>' +
        '<select id="shKind" class="status-select"><option value="video">動画（500pt目安）</option><option value="story">物語（100pt目安）</option></select>' +
        '<input id="shTitle" type="text" maxlength="60" placeholder="タイトル"><input id="shDesc" type="text" maxlength="300" placeholder="説明（任意）">' +
        '<input id="shPrice" type="number" min="0" value="500"><textarea id="shBody" rows="5" placeholder="物語の本文（物語のとき）"></textarea>' +
        '<label>動画ファイル（動画のとき・50MBまで・mp4/webm）</label><input id="shFile" type="file" accept="video/mp4,video/webm">' +
        '<div class="row"><button type="button" class="button" id="shSave">追加する</button></div></div>' +
        '<b>商品一覧</b>' + (items.length ? items.map((x) => '<div class="admin-card"><b>' + (x.kind === "video" ? "🎬 " : "📖 ") + escapeHtml(x.title) + '</b> <span class="meta">' + x.price + 'pt ・購入 ' + x.buyers + '人' + (x.active ? "" : " ・非公開") + '</span><div class="row"><button type="button" class="button-secondary" data-sh-del="' + x.id + '">削除</button></div></div>').join("") : '<div class="empty-list">まだありません</div>') +
        '<b>最近のスパム凍結</b>' + (locks.length ? locks.map((x) => '<div class="admin-card">' + escapeHtml(x.name || x.user_id) + ' <span class="meta">' + escapeHtml(formatDate(x.until)) + '</span></div>').join("") : '<div class="empty-list">なし（詳細は「通報」に出ます）</div>');
}
document.addEventListener("click", (e) => {
    const save = e.target.closest("#shSave"), del = e.target.closest("[data-sh-del]");
    if(!save && !del) return;
    runTool(async () => {
        const c = requireClient();
        if(save){
            const kind = $("shKind").value, title = $("shTitle").value.trim();
            if(!title){ showToast("タイトルを入れてください。"); return; }
            let path = null;
            const file = $("shFile").files && $("shFile").files[0];
            if(kind === "video"){
                if(!file){ showToast("動画ファイルを選んでください。"); return; }
                if(file.size > 50 * 1024 * 1024){ showToast("動画は50MBまでです。"); return; }
                path = crypto.randomUUID() + (file.type === "video/webm" ? ".webm" : ".mp4");
                const up = await c.storage.from("shop-content").upload(path, file, {contentType:file.type, upsert:false}); if(up.error) throw up.error;
            }
            const r = await c.rpc("admin_shop_upsert", {p_id:null, p_kind:kind, p_title:title, p_desc:$("shDesc").value.trim(), p_price:Number($("shPrice").value) || 0, p_active:true, p_body:kind === "story" ? $("shBody").value : null, p_video_path:path});
            if(r.error) throw r.error;
            showToast("追加しました。");
        }else{
            if(!confirm("この商品を削除しますか？（購入済みの記録も消えます）")) return;
            const r = await c.rpc("admin_shop_delete", {p_id:del.dataset.shDel}); if(r.error) throw r.error;
        }
        await renderAdminShop(c);
    });
});
