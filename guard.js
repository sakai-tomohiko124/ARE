"use strict";
// 「押しても反応しない」をなくすための安全装置。
// ・ボタンの処理でエラーが起きたとき／処理がつながっていないボタンを押したときに、必ず画面にメッセージを出す
// ・起動に失敗した機能は、押すと「現在ご利用いただけません（未実装、またはエラー）」と表示する
(function () {
    var handled = new WeakSet();
    var wrappers = new WeakMap();
    var origAdd = EventTarget.prototype.addEventListener;
    var origRemove = EventTarget.prototype.removeEventListener;
    var lastNotice = 0;
    var status = {};
    var labels = {};

    function notify(message) {
        var now = Date.now();
        if (now - lastNotice < 2500) return;
        lastNotice = now;
        var box = document.getElementById("guardToast");
        if (!box) {
            box = document.createElement("div");
            box.id = "guardToast";
            box.setAttribute("role", "alert");
            box.style.cssText = "position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));transform:translateX(-50%);max-width:min(92vw,520px);background:#3a2e10;color:#ffe8a8;border:1px solid #6b5416;border-radius:12px;padding:10px 16px;z-index:2147483000;font:14px/1.6 system-ui,sans-serif;box-shadow:0 6px 24px #0008";
            (document.body || document.documentElement).appendChild(box);
        }
        box.textContent = message;
        box.hidden = false;
        clearTimeout(box._t);
        box._t = setTimeout(function () { box.hidden = true; }, 5000);
    }

    function describe(err) {
        if (err && err.name === "ReferenceError") return "この機能は未実装です（または読み込みに失敗しました）。";
        return "この操作でエラーが起きました。時間をおいて、もう一度お試しください。";
    }

    function report(err, where) {
        try { console.error("[ARE guard]", where, err); } catch (_e) { /* 何もしない */ }
        notify(describe(err));
    }

    EventTarget.prototype.addEventListener = function (type, fn, opts) {
        try { if (this instanceof Element) handled.add(this); } catch (_e) { /* 何もしない */ }
        if (typeof fn === "function" && /^(click|submit|change|input|keydown|keyup|pointerdown|touchstart)$/.test(type)) {
            var w = wrappers.get(fn);
            if (!w) {
                w = function (e) {
                    try {
                        var r = fn.call(this, e);
                        if (r && typeof r.then === "function") r.then(null, function (err) { report(err, type); });
                        return r;
                    } catch (err) {
                        report(err, type);
                    }
                };
                wrappers.set(fn, w);
            }
            return origAdd.call(this, type, w, opts);
        }
        return origAdd.call(this, type, fn, opts);
    };
    EventTarget.prototype.removeEventListener = function (type, fn, opts) {
        return origRemove.call(this, type, wrappers.get(fn) || fn, opts);
    };

    window.addEventListener("error", function (e) {
        if (/ResizeObserver/.test(e.message || "")) return;
        report(e.error || new Error(e.message), "window.error");
    });
    window.addEventListener("unhandledrejection", function (e) { report(e.reason, "unhandledrejection"); });

    // 起動に失敗した機能の入口（data-feature を付けたボタン）を押したとき
    document.addEventListener("click", function (e) {
        var holder = e.target.closest && e.target.closest("[data-feature]");
        if (holder && !window.AREFeatures.ok(holder.dataset.feature)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            notify("「" + (labels[holder.dataset.feature] || "この機能") + "」は現在ご利用いただけません（未実装、またはサーバー側でエラーが起きています）。");
        }
    }, true);

    // 処理がつながっていないボタンを押したとき
    // ※ボタンの処理が画面を作り直す（シートを閉じる等）と、ボタンが画面から外れて「つながっていない」と
    //   誤判定されるため、押された瞬間（処理が走る前）に判定しておく
    var clickInfo = null;
    function isWired(btn) {
        for (var n = btn; n; n = n.parentElement) { if (handled.has(n)) return true; }
        return false;
    }
    document.addEventListener("click", function (e) {
        var btn = e.target.closest && e.target.closest("button");
        clickInfo = btn ? { btn: btn, wired: isWired(btn) } : null;
    }, true);
    document.addEventListener("click", function (e) {
        var btn = e.target.closest && e.target.closest("button");
        if (!btn || btn.disabled || btn.hasAttribute("data-keep")) return;
        var wired = (clickInfo && clickInfo.btn === btn) ? clickInfo.wired : isWired(btn);
        if (wired) return;
        notify("この機能は未実装です。");
    }, false);

    window.AREFeatures = {
        register: function (id, label, ok, err) {
            status[id] = ok;
            labels[id] = label;
            if (!ok) { try { console.error("[ARE feature failed]", id, err); } catch (_e) { /* 何もしない */ } }
        },
        ok: function (id) { return status[id] !== false; },
        failed: function () { return Object.keys(status).filter(function (id) { return status[id] === false; }).map(function (id) { return labels[id]; }); },
        notify: notify,
        banner: function () {
            var failed = window.AREFeatures.failed();
            var bar = document.getElementById("featureBanner");
            if (!failed.length) { if (bar) bar.hidden = true; return; }
            if (!bar) {
                bar = document.createElement("div");
                bar.id = "featureBanner";
                bar.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147482000;background:#3a2e10;color:#ffe8a8;border-bottom:1px solid #6b5416;padding:8px 14px;font:13px/1.6 system-ui,sans-serif;display:flex;gap:10px;align-items:center";
                var text = document.createElement("span");
                text.id = "featureBannerText";
                text.style.flex = "1";
                var close = document.createElement("button");
                close.type = "button";
                close.setAttribute("data-keep", "1");
                close.textContent = "閉じる";
                close.style.cssText = "background:none;border:1px solid #6b5416;color:inherit;border-radius:8px;padding:2px 10px;cursor:pointer";
                close.addEventListener("click", function () { bar.hidden = true; });
                bar.appendChild(text);
                bar.appendChild(close);
                document.body.appendChild(bar);
            }
            document.getElementById("featureBannerText").textContent = "一部の機能は、未実装、または起動に失敗したため使えません：" + failed.join("、") + "。ほかの機能は使えます。";
            bar.hidden = false;
        }
    };
})();
