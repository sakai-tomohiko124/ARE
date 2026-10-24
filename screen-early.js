"use strict";
// ===== 通話の「接続」をあとから見つけるための下準備（画面共有で使う）=====
// extras.js が通話用に作る RTCPeerConnection を、作られたときに控えておくだけです。動作は変えません。
(function(){
    try{
        const Orig = window.RTCPeerConnection;
        if(!Orig || Orig.__are) return;
        const list = [];
        window.__arePCs = list;
        const drop = (pc) => { const i = list.indexOf(pc); if(i >= 0) list.splice(i, 1); };
        function AreRTCPeerConnection(){
            const pc = new (Function.prototype.bind.apply(Orig, [null].concat(Array.prototype.slice.call(arguments))))();
            list.push(pc);
            while(list.length > 8) list.shift();
            try{
                const close = pc.close.bind(pc);
                pc.close = function(){ drop(pc); return close(); };
                pc.addEventListener("connectionstatechange", () => { if(pc.connectionState === "closed" || pc.connectionState === "failed") drop(pc); });
            }catch(_e){}
            return pc;
        }
        AreRTCPeerConnection.prototype = Orig.prototype;
        Object.setPrototypeOf(AreRTCPeerConnection, Orig);
        AreRTCPeerConnection.__are = true;
        window.RTCPeerConnection = AreRTCPeerConnection;
    }catch(_e){ /* 画面共有が使えないだけ */ }
})();
