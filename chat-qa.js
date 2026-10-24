"use strict";
// ===== AIチャットボットに QA.json の内容を足す =====
// 既存のチャットボット（extras.js）が読む「chatbot.txt」に、QA.json の内容を「Q:／A:」の形に変えて足します。
// chatbot.txt はそのまま残り、QA.json が無い・壊れているときは、これまでどおり chatbot.txt だけで動きます。
// QA.json の形：[{"keywords":["キーワード1","キーワード2"], "answer":"回答"}, ...]
(function(){
    const nativeFetch = window.fetch ? window.fetch.bind(window) : null;
    if(!nativeFetch) return;
    let cache = null;

    function oneLine(text){ return String(text).replace(/[\r\n]+/g, " ").replace(/[|｜]/g, "/").trim(); }

    function qaToText(list){
        if(!Array.isArray(list)) return "";
        const out = [];
        list.forEach((item) => {
            if(!item || typeof item.answer !== "string") return;
            const keys = (Array.isArray(item.keywords) ? item.keywords : []).map(oneLine).filter((k) => k.length >= 2);
            const answer = item.answer.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
            if(!keys.length || !answer.length) return;
            out.push("Q: " + keys.join("|") + "\n" + answer.map((line) => "A: " + line).join("\n"));
        });
        return out.join("\n\n");
    }

    async function build(input, init){
        const base = await nativeFetch(input, init);
        if(!base.ok) return base;
        const text = await base.text();
        if(cache === null){
            try{
                const response = await nativeFetch("./QA.json");
                cache = response.ok ? qaToText(await response.json()) : "";
            }catch(_e){ cache = ""; }
        }
        if(!cache) return new Response(text, {status:200, headers:{"Content-Type":"text/plain; charset=utf-8"}});
        return new Response(text.replace(/\s+$/, "") + "\n\n" + cache + "\n", {status:200, headers:{"Content-Type":"text/plain; charset=utf-8"}});
    }

    window.fetch = function(input, init){
        try{
            const url = typeof input === "string" ? input : (input && input.url) || "";
            if(/(^|\/)chatbot\.txt(\?|$)/.test(url)) return build(input, init);
        }catch(_e){ /* 失敗したら通常の読み込みに任せる */ }
        return nativeFetch(input, init);
    };
})();
