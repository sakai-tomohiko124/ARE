"use strict";
// ===== ARE サービスワーカー（簡易版）=====
// ・GET 以外（POST/HEAD など）は一切さわらない → 「Cache.put: Request method 'POST' is unsupported」を防ぐ
// ・Supabase など他のサイトへの通信にはさわらない
// ・自分のサイトのファイルは「ネット優先」：つながるときは常に最新を取得し、成功したものだけ控えを保存する
//   （オフラインのときだけ控えを使う）→ 更新したのに古い画面のまま、を防ぐ
// ・新しい版が入ったら、古い控えをすべて消す

const CACHE = "are-v14-20261024";

self.addEventListener("install", () => { self.skipWaiting(); });

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if(request.method !== "GET") return;
    let url;
    try{ url = new URL(request.url); }catch(_e){ return; }
    if(url.origin !== self.location.origin) return;
    if(request.headers.has("range")) return;

    event.respondWith((async () => {
        try{
            const response = await fetch(request, {cache:"no-cache"});
            if(response && response.status === 200 && response.type === "basic"){
                const copy = response.clone();
                caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
            }
            return response;
        }catch(error){
            const cached = await caches.match(request);
            if(cached) return cached;
            if(request.mode === "navigate"){
                const home = await caches.match("./index.html");
                if(home) return home;
            }
            throw error;
        }
    })());
});

// ===== プッシュ通知（サーバーの send-push 関数から届く）=====
// ・画面を開いて見ている最中は、アプリ内のポップアップがあるので重ねて出さない（iPhone / iPad は「必ず表示」が決まりなので常に出す）
self.addEventListener("push", (event) => {
    let data = {};
    try{ data = event.data ? event.data.json() : {}; }catch(_e){ data = {body: event.data ? event.data.text() : ""}; }
    const title = String(data.title || "ARE").slice(0, 80);
    const options = {
        body: String(data.body || "新しいメッセージがあります").slice(0, 140),
        icon: "icon-192.png", badge: "icon-192.png",
        tag: String(data.tag || "are"), renotify: true,
        data: {room: typeof data.room === "string" ? data.room : ""}
    };
    event.waitUntil((async () => {
        const apple = /iPhone|iPad|iPod|Macintosh/i.test(self.navigator.userAgent || "");
        if(!apple){
            const list = await self.clients.matchAll({type: "window", includeUncontrolled: true});
            if(list.some((c) => c.visibilityState === "visible" && c.focused)) return;
        }
        await self.registration.showNotification(title, options);
    })());
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const room = (event.notification.data && event.notification.data.room) || "";
    event.waitUntil((async () => {
        const list = await self.clients.matchAll({type: "window", includeUncontrolled: true});
        for(const c of list){
            if("focus" in c){
                try{ await c.focus(); }catch(_e){}
                if(room) c.postMessage({type: "open-room", room});
                return;
            }
        }
        const base = new URL("chat.html", self.registration.scope);
        if(/^[0-9a-f-]{36}$/i.test(room)) base.searchParams.set("room", room);
        await self.clients.openWindow(base.href);
    })());
});
