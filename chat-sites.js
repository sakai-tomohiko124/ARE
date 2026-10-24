"use strict";
// ===== マイページの「よく使うサイト」（最大5つ・タップ／クリックで開く）=====
// ・名前とURLを自分で決めて登録します（PayPay・電子マネーなどのよく使うサイトの例もボタンで入れられます）。
// ・ふつうは「ブラウザ」で開きます。スマホで「アプリのURL」（例：paypay://）も入れておくと、まずアプリを開こうとします。
//   アプリが入っていない・開けないときは、「ブラウザで開く」ボタンが出ます。パソコンでは、いつもブラウザで開きます。
// ・登録した内容は、この端末のブラウザにだけ保存します。

const SITES_MAX = 5;
const SITES_PRESETS = [
    {name:"PayPay", url:"https://paypay.ne.jp/", app:"paypay://"},
    {name:"楽天ペイ", url:"https://pay.rakuten.co.jp/", app:""},
    {name:"d払い", url:"https://service.smt.docomo.ne.jp/keitai_payment/", app:""},
    {name:"au PAY", url:"https://aupay.auone.jp/", app:""},
    {name:"メルペイ", url:"https://www.merpay.com/", app:""},
    {name:"Suica", url:"https://www.jreast.co.jp/suica/", app:""}
];
const SITES_BAD_SCHEMES = ["javascript", "data", "vbscript", "file", "blob", "about", "chrome", "view-source", "ftp"];
feat.sites = {list:[], card:null};

function sitesKey(){ return "are_sites_" + (state.user ? state.user.id : "x"); }
function sitesLoad(){
    try{
        const d = JSON.parse(localStorage.getItem(sitesKey()) || "[]");
        feat.sites.list = (Array.isArray(d) ? d : []).filter((x) => x && sitesCleanUrl(x.url)).slice(0, SITES_MAX).map((x) => ({name:String(x.name || "").slice(0, 20), url:sitesCleanUrl(x.url), app:sitesCleanApp(x.app)}));
    }catch(_e){ feat.sites.list = []; }
}
function sitesSave(){ try{ localStorage.setItem(sitesKey(), JSON.stringify(feat.sites.list)); }catch(_e){ showToast("保存できませんでした。"); } }

/** ブラウザで開くURL（http / https だけ） */
function sitesCleanUrl(text){
    const t = String(text || "").trim();
    if(!t) return "";
    try{ const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : "https://" + t); return (u.protocol === "https:" || u.protocol === "http:") ? u.href : ""; }
    catch(_e){ return ""; }
}
/** アプリを開くURL（paypay:// のような形。危険な種類は不可） */
function sitesCleanApp(text){
    const t = String(text || "").trim();
    if(!t) return "";
    const m = t.match(/^([a-z][a-z0-9+.-]{1,30}):\/\/[^\s<>"']*$/i);
    if(!m || SITES_BAD_SCHEMES.includes(m[1].toLowerCase()) || t.length > 300) return "";
    return t;
}
function sitesIsMobile(){ return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)); }

function initSites(){
    registerTool("sites", onSitesAction);
    sitesLoad();
    const first = document.querySelector(".sidebar-content .profile-card.pane-me");
    if(!first) throw new Error("マイページが見つかりません。");
    const card = document.createElement("div");
    card.className = "profile-card pane-me"; card.id = "favSites";
    first.insertAdjacentElement("afterend", card);
    card.addEventListener("click", (event) => {
        const b = event.target.closest("[data-site]");
        if(b){ sitesOpen(feat.sites.list[Number(b.dataset.site)]); return; }
        if(event.target.closest("[data-sites-edit]")) runTool(openSitesEditor);
    });
    feat.sites.card = card;
    sitesPaint();
}

function sitesPaint(){
    const l = feat.sites.list;
    feat.sites.card.innerHTML = '<div class="profile-text"><b>⭐ よく使うサイト</b><div class="bio">タップするだけで開きます（最大' + SITES_MAX + 'つ）。</div></div>' +
        '<div class="sites-grid">' + (l.length ? l.map((x, i) => '<button type="button" class="button sites-btn" data-site="' + i + '">' + escapeHtml(x.name || new URL(x.url).hostname) + (x.app && sitesIsMobile() ? ' <small>（アプリ）</small>' : '') + '</button>').join("") : '<div class="meta">まだ登録がありません。</div>') + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="button-secondary" data-sites-edit>' + (l.length ? "✏️ 登録を変える" : "＋ サイトを登録する") + '</button></div>';
}

function sitesOpen(site){
    if(!site) return;
    if(site.app && sitesIsMobile()){
        const shown = Date.now();
        location.href = site.app;
        setTimeout(() => {
            if(document.hidden || Date.now() - shown > 4000) return;   // アプリが開いたら何もしない
            const pop = document.createElement("button");
            pop.type = "button"; pop.className = "nf-pop";
            pop.innerHTML = '<strong>アプリを開けませんでした</strong><span>押すと、ブラウザで「' + escapeHtml(site.name || site.url) + '」を開きます</span>';
            pop.addEventListener("click", () => { pop.remove(); window.open(site.url, "_blank", "noopener,noreferrer"); });
            document.body.appendChild(pop); setTimeout(() => pop.remove(), 15000);
        }, 1600);
        return;
    }
    window.open(site.url, "_blank", "noopener,noreferrer");
}

function openSitesEditor(){
    const l = feat.sites.list;
    const rows = [];
    for(let i = 0; i < SITES_MAX; i++){
        const x = l[i] || {name:"", url:"", app:""};
        rows.push('<div class="admin-card"><b>' + (i + 1) + '</b><input class="st-name" type="text" maxlength="20" placeholder="名前（例：PayPay）" value="' + escapeHtml(x.name) + '"><input class="st-url" type="text" inputmode="url" placeholder="サイトのURL（例：https://paypay.ne.jp/）" value="' + escapeHtml(x.url) + '"><input class="st-app" type="text" inputmode="url" placeholder="アプリのURL（任意・例：paypay://）" value="' + escapeHtml(x.app) + '"></div>');
    }
    openSheet(toolHead("⭐ よく使うサイトの登録", "名前とURLを入れてください。「アプリのURL」は空でもかまいません（スマホで、まずアプリを開きたいときだけ）。") +
        '<div class="meta">例から入れる：</div><div class="row" style="justify-content:flex-start">' + SITES_PRESETS.map((p, i) => '<button type="button" class="button-secondary" data-t="sites:preset" data-i="' + i + '">' + escapeHtml(p.name) + '</button>').join("") + '</div>' +
        '<div class="meta">※ 例のURLは公式サイトのトップです。変わっていたら直して使ってください。</div>' +
        '<div id="stRows">' + rows.join("") + '</div>' +
        '<div class="row"><button type="button" class="button" data-t="sites:save">保存する</button></div>' +
        '<details><summary>アプリを開くには？</summary><div class="meta">・ブラウザで開くだけなら、サイトのURLだけで大丈夫です（パソコンでもスマホでも使えます）。<br>・スマホのアプリは、「paypay://」のような「アプリ専用のURL」で開けます。アプリごとに決まっていて、公式サイトやアプリの案内に載っています。<br>・アプリが入っていない、またはアプリ側が対応していないときは、開けません。その場合は「ブラウザで開く」ボタンが出ます。<br>・パソコンのブラウザからは、アプリは開かず、いつもサイトが開きます。</div></details>' + toolClose());
}

function onSitesAction(action, node){
    if(action === "preset"){
        const p = SITES_PRESETS[Number(node.dataset.i)]; if(!p) return;
        const rows = Array.from(document.querySelectorAll("#stRows .admin-card"));
        const target = rows.find((r) => !r.querySelector(".st-url").value.trim()) || rows[rows.length - 1];
        target.querySelector(".st-name").value = p.name; target.querySelector(".st-url").value = p.url; target.querySelector(".st-app").value = p.app;
        return;
    }
    if(action !== "save") return;
    const out = [], bad = [];
    document.querySelectorAll("#stRows .admin-card").forEach((r, i) => {
        const name = r.querySelector(".st-name").value.trim(), urlText = r.querySelector(".st-url").value.trim(), appText = r.querySelector(".st-app").value.trim();
        if(!name && !urlText && !appText) return;
        const url = sitesCleanUrl(urlText), app = sitesCleanApp(appText);
        if(!url){ bad.push((i + 1) + "番のサイトURLが正しくありません（https:// で始まる形）"); return; }
        if(appText && !app){ bad.push((i + 1) + "番のアプリURLが正しくありません（例：paypay://）"); return; }
        out.push({name:name || new URL(url).hostname, url, app});
    });
    if(bad.length){ showToast(bad[0]); return; }
    feat.sites.list = out.slice(0, SITES_MAX); sitesSave(); sitesPaint(); closeSheet();
    showToast("保存しました。");
}
