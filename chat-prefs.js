"use strict";
// ===== 表示設定：気分テーマ・省データモード（設定はこの端末にだけ保存）=====

const THEMES = {
    standard:{label:"🌙 標準（ダーク）", dark:true, vars:{}},
    light:{label:"☀️ ライト", dark:false, vars:{"--bg":"#f3f6fc", "--panel":"#ffffff", "--panel2":"#e9eef9", "--line":"#cfd8ea", "--text":"#1b2438", "--muted":"#5d6b86", "--accent":"#3b63e0", "--accent2":"#2a4fc4", "--danger":"#d32f2f", "--success":"#12805c"}},
    forest:{label:"🌲 森の気分", dark:true, vars:{"--bg":"#0d1a14", "--panel":"#14261d", "--panel2":"#1c3327", "--line":"#2c4a3a", "--text":"#e8f5ee", "--muted":"#9ab8a8", "--accent":"#5de0a0", "--accent2":"#2fbf80"}},
    sunset:{label:"🌇 夕焼けの気分", dark:true, vars:{"--bg":"#1e1119", "--panel":"#2b1824", "--panel2":"#3a2030", "--line":"#55303f", "--text":"#fff0ea", "--muted":"#d0a9a3", "--accent":"#ff9a62", "--accent2":"#f07a3a"}},
    sakura:{label:"🌸 さくらの気分", dark:false, vars:{"--bg":"#fff5f8", "--panel":"#ffffff", "--panel2":"#ffe9f0", "--line":"#f1c9d6", "--text":"#3a2230", "--muted":"#8a6676", "--accent":"#e0518a", "--accent2":"#c93d75", "--danger":"#c62828", "--success":"#12805c"}}
};

const THEME_VARS = ["--bg", "--panel", "--panel2", "--line", "--text", "--muted", "--accent", "--accent2", "--danger", "--success"];

function prefGet(key, fallback){ try{ return localStorage.getItem(key) || fallback; }catch(_e){ return fallback; } }
function prefSet(key, value){ try{ localStorage.setItem(key, value); }catch(_e){} }

function applyTheme(name){
    const theme = THEMES[name] || THEMES.standard, root = document.documentElement;
    THEME_VARS.forEach((v) => root.style.removeProperty(v));
    Object.keys(theme.vars).forEach((v) => root.style.setProperty(v, theme.vars[v]));
    root.style.colorScheme = theme.dark ? "dark" : "light";
}

function applyEco(on){
    document.documentElement.classList.toggle("eco", !!on);
    if(on){
        document.querySelectorAll("video,audio").forEach((m) => { m.preload = "none"; });
        if(!feat.ecoObserver){
            feat.ecoObserver = new MutationObserver(() => {
                document.querySelectorAll("video:not([data-eco]),audio:not([data-eco])").forEach((m) => { m.dataset.eco = "1"; m.preload = "none"; });
            });
            feat.ecoObserver.observe(document.body, {childList:true, subtree:true});
        }
    }else if(feat.ecoObserver){ feat.ecoObserver.disconnect(); feat.ecoObserver = null; }
}

function initPrefs(){
    applyTheme(prefGet("are_theme", "standard"));
    applyEco(prefGet("are_eco", "0") === "1");
    registerTool("pf", onPrefsAction);
}

function openPrefs(){
    const theme = prefGet("are_theme", "standard"), eco = prefGet("are_eco", "0") === "1", lang = prefGet("are_lang", "ja");
    openSheet(toolHead("⚙️ 表示設定・言語", "この端末だけに保存されます。") +
        '<label>気分テーマ<select class="status-select" data-t="pf:theme">' + Object.keys(THEMES).map((k) => '<option value="' + k + '"' + (k === theme ? " selected" : "") + '>' + THEMES[k].label + '</option>').join("") + '</select></label>' +
        '<label><input type="checkbox" data-t="pf:eco"' + (eco ? " checked" : "") + '> 省データ・省電力モード<small class="meta" style="display:block">アニメーションを止め、動画・音声を再生するまで読み込まないようにします。</small></label>' +
        '<label>言語 / Language<select class="status-select" data-t="pf:lang"><option value="ja"' + (lang === "ja" ? " selected" : "") + '>日本語</option><option value="en"' + (lang === "en" ? " selected" : "") + '>English（一部のみ / partial）</option></select></label>' +
        '<div class="meta">English は、メニューやボタンなど主な画面部品が対象です。チャットの内容・エラーメッセージ・管理者パネルは日本語のままです。</div>' + toolClose());
}

function onPrefsAction(action, node){
    if(action === "theme"){ prefSet("are_theme", node.value); applyTheme(node.value); }
    else if(action === "eco"){ prefSet("are_eco", node.checked ? "1" : "0"); applyEco(node.checked); }
    else if(action === "lang"){ prefSet("are_lang", node.value); if(typeof applyLanguage === "function") applyLanguage(node.value); else showToast("この機能は未実装です。"); }
}
