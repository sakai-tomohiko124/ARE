"use strict";
// ===== 起動 =====
(function(){
    tqSettingsLoad();
    // 画面の向き：スマホの たてむき だと「よこむき すいしょう」を出す
    try{ if(window.matchMedia("(orientation: portrait)").matches && window.innerWidth < 900) document.body.classList.add("needrot"); }catch(_e){}
    try{ if(window.matchMedia("(pointer: coarse)").matches) document.body.classList.add("touch"); }catch(_e){}
    G.mode = "title"; render();
    window.addEventListener("beforeunload", () => { try{ tqAutoSave(); }catch(_e){} });
    document.addEventListener("visibilitychange", () => { if(document.hidden){ try{ tqAutoSave(); }catch(_e){} } });
})();
