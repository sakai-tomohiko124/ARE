"use strict";
// ===== 自分のプロフィールを「長押し」または「右クリック」したときのメニュー =====
// スマホ・タブレット：プロフィール（アイコン・名前の部分）を約0.5秒押し続ける。パソコン：右クリック。
// 内容：ストーリーを追加／アーカイブ／メモ／プロフィール編集／QR共有

const CTX_HOLD_MS = 520;
const CTX_MOVE_PX = 10;
feat.ctx = {timer:0, fired:0, x:0, y:0, menu:null};

function initCtx(){
    document.addEventListener("pointerdown", ctxDown, true);
    document.addEventListener("pointermove", ctxMove, true);
    ["pointerup", "pointercancel", "pointerleave"].forEach((type) => document.addEventListener(type, ctxCancel, true));
    document.addEventListener("contextmenu", ctxContext, true);
    // 長押しのあとに指を離すと「クリック」と判定されるので、メニューを出した直後のクリックは無視する
    document.addEventListener("click", (event) => {
        if(Date.now() - feat.ctx.fired < 700 && ctxTarget(event.target)){ event.preventDefault(); event.stopPropagation(); }
    }, true);
    document.addEventListener("pointerdown", (event) => { if(feat.ctx.menu && !feat.ctx.menu.contains(event.target)) hideCtx(); }, true);
    document.addEventListener("keydown", (event) => { if(event.key === "Escape") hideCtx(); });
    window.addEventListener("scroll", hideCtx, true);
    window.addEventListener("resize", hideCtx);
}

function ctxTarget(node){
    if(!node || !node.closest) return null;
    if(node.closest("select,input,textarea,[contenteditable='true']")) return null;
    return node.closest("[data-ctx='me']");
}

function ctxDown(event){
    if(event.pointerType === "mouse" && event.button !== 0) return;
    const target = ctxTarget(event.target);
    if(!target) return;
    clearTimeout(feat.ctx.timer);
    feat.ctx.x = event.clientX; feat.ctx.y = event.clientY;
    if(event.pointerType === "mouse") return; // マウスは右クリックで開く（左ボタンの長押しは使わない）
    feat.ctx.timer = setTimeout(() => { feat.ctx.fired = Date.now(); showCtx(feat.ctx.x, feat.ctx.y); if(navigator.vibrate){ try{ navigator.vibrate(15); }catch(_e){} } }, CTX_HOLD_MS);
}

function ctxMove(event){
    if(!feat.ctx.timer) return;
    if(Math.abs(event.clientX - feat.ctx.x) > CTX_MOVE_PX || Math.abs(event.clientY - feat.ctx.y) > CTX_MOVE_PX) ctxCancel();
}

function ctxCancel(){ clearTimeout(feat.ctx.timer); feat.ctx.timer = 0; }

function ctxContext(event){
    const target = ctxTarget(event.target);
    if(!target) return;
    event.preventDefault();
    ctxCancel();
    if(Date.now() - feat.ctx.fired < 900) return; // 長押しですでに開いている
    feat.ctx.fired = Date.now();
    showCtx(event.clientX, event.clientY);
}

const CTX_ITEMS = [
    ["story", "📖 ストーリーを追加", () => storyCompose(false)],
    ["archive", "🗂️ ストーリーのアーカイブ", () => openStoryArchive()],
    ["memo", "📝 自分専用メモ", () => openMemoView()],
    ["edit", "✏️ プロフィールを編集", () => openProfileEditor()],
    ["share", "🔗 プロフィールを共有（QR）", () => openShare()]
];

function showCtx(x, y){
    hideCtx();
    const menu = document.createElement("div");
    menu.className = "ctx-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = CTX_ITEMS.map((item) => '<button type="button" role="menuitem" data-c="' + item[0] + '">' + item[1] + '</button>').join("");
    menu.addEventListener("click", (event) => {
        const button = event.target.closest("[data-c]");
        if(!button) return;
        const item = CTX_ITEMS.find((i) => i[0] === button.dataset.c);
        hideCtx();
        if(item) runTool(item[2]);
    });
    document.body.appendChild(menu);
    const w = menu.offsetWidth, h = menu.offsetHeight;
    menu.style.left = Math.max(8, Math.min(x, window.innerWidth - w - 8)) + "px";
    menu.style.top = Math.max(8, Math.min(y, window.innerHeight - h - 8)) + "px";
    feat.ctx.menu = menu;
    const first = menu.querySelector("button");
    if(first) first.focus({preventScroll:true});
}

function hideCtx(){
    if(feat.ctx.menu){ feat.ctx.menu.remove(); feat.ctx.menu = null; }
}
