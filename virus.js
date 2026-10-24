"use strict";
// ===== おしおき画面（演出）=====
// 11回目のNG発言のあとにだけ開きます。「ごめんなさい、申しません」を押すと、サーバー側でアカウントが完全に消えます。
// ・押すまでは：ページを離れる操作に確認を出す／全画面化を試みる／キー操作・右クリックを止める（ブラウザの仕様上、タブを閉じる操作そのものは止められません）
// ・閉じても、サーバー側が「削除待ち」のままなので、次にログインしたとき必ずこの画面に戻ります
(function(){
    var params = new URLSearchParams(location.search), preview = params.get("preview") === "1";
    var $ = function(id){ return document.getElementById(id); };
    var done = false, locked = false;
    var client = null;

    function msg(t){ $("vxMsg").textContent = t || ""; }

    // ---- 見た目の演出 ----
    var files = 0, inf = 0, tick = 0;
    var LOG = ["C:\\おしおき\\うざい.exe を検出","メモリ領域 0x7F3A を書きかえ中…","「ごめんなさい」が見つかりません","きょうの反省ポイント: 0","ARE警察が あなたを みています","言葉づかい.dll が こわれています","やさしさ.dat が みつかりません","感染を ひろげています…"];
    setInterval(function(){
        files += Math.floor(Math.random() * 480) + 90; inf += Math.floor(Math.random() * 17) + 2; tick++;
        $("vxFiles").textContent = files.toLocaleString("ja-JP"); $("vxInf").textContent = inf.toLocaleString("ja-JP");
        $("vxBar").style.width = Math.min(99, (tick * 3) % 140) + "%";
        var log = $("vxLog"); log.textContent += (log.textContent ? "\n" : "") + LOG[Math.floor(Math.random() * LOG.length)];
        var lines = log.textContent.split("\n"); if(lines.length > 6) log.textContent = lines.slice(-6).join("\n");
    }, 450);

    // ---- 他の操作ができないようにする ----
    window.addEventListener("beforeunload", function(e){ if(done || preview) return; e.preventDefault(); e.returnValue = "ウイルスが残っています。反省して あやまるまで 閉じられません。"; return e.returnValue; });
    ["contextmenu","selectstart","dragstart","copy","cut","paste"].forEach(function(t){ document.addEventListener(t, function(e){ e.preventDefault(); }, true); });
    document.addEventListener("keydown", function(e){
        if(done) return;
        var onBtn = e.target === $("vxSorry");
        if(onBtn && (e.key === "Enter" || e.key === " ")) return; // ボタンはキーボードでも押せる
        e.preventDefault(); e.stopPropagation();
    }, true);
    function goFull(){
        var d = document.documentElement;
        try{
            if(!document.fullscreenElement && d.requestFullscreen){
                d.requestFullscreen().then(function(){ if(navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(["Escape","F5","F11","KeyW","KeyT","KeyN","KeyR"]).catch(function(){}); }).catch(function(){});
            }
        }catch(_e){}
    }
    ["pointerdown","touchstart"].forEach(function(t){ document.addEventListener(t, function(){ if(!done && !preview) goFull(); }, true); });
    document.addEventListener("fullscreenchange", function(){ if(!document.fullscreenElement && !done && !preview) msg("画面を もどします。どこかを タップしてください。"); });
    document.addEventListener("visibilitychange", function(){ if(!document.hidden && !done) $("vxSorry").focus(); });

    // ---- サーバーとの連携 ----
    async function init(){
        try{
            client = window.ARESystem.client;
            var s = await client.auth.getSession();
            if(!s.data || !s.data.session){ location.replace("./index.html"); return; }
            var r = await client.rpc("my_access");
            if(r.error) throw r.error;
            var a = r.data || {};
            if(preview){
                if(!a.admin){ location.replace("./chat.html"); return; }
                $("vxPrev").textContent = "（管理者プレビュー：ボタンを押してもアカウントは消えません）";
            }else if(!a.ng_pending){
                location.replace("./chat.html"); return;
            }
            locked = true; $("vxSorry").disabled = false; $("vxSorry").focus();
            msg(preview ? "" : "どこかを タップすると 全画面になります。");
        }catch(error){
            console.error("[ARE virus]", error);
            msg("つながりません。通信を 確認して ページを 開きなおしてください。");
        }
    }
    $("vxSorry").addEventListener("click", async function(){
        if(!locked || done) return;
        $("vxSorry").disabled = true; msg("あやまっています…");
        try{
            if(preview){ location.replace("./chat.html"); return; }
            var r = await client.rpc("ng_apologize");
            if(r.error) throw r.error;
            done = true;
            try{ await client.auth.signOut({scope:"local"}); }catch(_e){}
            try{ localStorage.clear(); sessionStorage.clear(); }catch(_e){}
            try{ if(document.fullscreenElement) document.exitFullscreen(); }catch(_e){}
            $("vx").hidden = true; $("vxBye").hidden = false;
            setTimeout(function(){ location.replace("./index.html"); }, 3500);
        }catch(error){
            console.error("[ARE virus]", error);
            $("vxSorry").disabled = false; msg("うまくいきませんでした。もういちど押してください。");
        }
    });
    init();
})();
