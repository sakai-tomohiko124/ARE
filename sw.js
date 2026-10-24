"use strict";
// ===== ARE サービスワーカー（簡易版）=====
// ・GET 以外（POST/HEAD など）は一切さわらない → 「Cache.put: Request method 'POST' is unsupported」を防ぐ
// ・Supabase など他のサイトへの通信にはさわらない
// ・自分のサイトのファイルは「ネット優先」：つながるときは常に最新を取得し、成功したものだけ控えを保存する
//   （オフラインのときだけ控えを使う）→ 更新したのに古い画面のまま、を防ぐ
// ・新しい版が入ったら、古い控えをすべて消す

const CACHE = "are-v9-20261024";

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
