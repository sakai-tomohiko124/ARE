"use strict";
// ===== 電卓・単位換算・為替の目安 =====
// ・電卓は、式を安全に自分で計算します（eval は使いません）。
// ・為替は「目安」です。ネットにつながるときは最新のレートを取りに行き、取れないときは、あなたが入れたレート（なければおおよその値）を使います。実際の取引レートとは違います。

const CALC_UNITS = {
    "長さ":{m:1, km:1000, cm:0.01, mm:0.001, "インチ":0.0254, "フィート":0.3048, "ヤード":0.9144, "マイル":1609.344},
    "重さ":{kg:1, g:0.001, mg:0.000001, t:1000, "ポンド":0.45359237, "オンス":0.028349523125},
    "面積":{"㎡":1, "㎢":1000000, "ha":10000, "畳":1.62, "坪":3.305785, "エーカー":4046.8564224},
    "体積":{L:1, mL:0.001, "㎥":1000, "ガロン(米)":3.785411784, "カップ":0.2365882365, "大さじ":0.015, "小さじ":0.005},
    "速さ":{"km/h":1, "m/s":3.6, "mph":1.609344, "ノット":1.852},
    "データ":{B:1, KB:1024, MB:1048576, GB:1073741824, TB:1099511627776}
};
const CALC_FX_DEFAULT = {JPY:1, USD:150, EUR:162, GBP:190, CNY:21, KRW:0.11, AUD:98, CAD:108, THB:4.3, TWD:4.7};
const calc = {expr:"", fx:null, fxAt:"", fxLive:false};

/** 四則演算・かっこ・小数・％・べき乗だけを計算する（安全な再帰下降パーサ） */
function calcEval(src){
    const s = String(src).replace(/[×x]/g, "*").replace(/[÷]/g, "/").replace(/[−ー]/g, "-").replace(/[（]/g, "(").replace(/[）]/g, ")").replace(/[，,\s]/g, "").replace(/[０-９．]/g, (c) => c === "．" ? "." : String.fromCharCode(c.charCodeAt(0) - 65248));
    let i = 0;
    const peek = () => s[i];
    function num(){
        if(peek() === "("){ i++; const v = add(); if(peek() !== ")") throw new Error("syntax"); i++; return pct(v); }
        const m = /^\d+(\.\d+)?|^\.\d+/.exec(s.slice(i)); if(!m) throw new Error("syntax");
        i += m[0].length; return pct(parseFloat(m[0]));
    }
    function pct(v){ while(peek() === "%"){ i++; v = v / 100; } return v; }
    function unary(){ if(peek() === "-"){ i++; return -unary(); } if(peek() === "+"){ i++; return unary(); } return pow(); }
    function pow(){ const b = num(); if(peek() === "^"){ i++; const e = unary(); return Math.pow(b, e); } return b; }
    function mul(){ let v = unary(); while(peek() === "*" || peek() === "/"){ const o = s[i++]; const r = unary(); if(o === "/" && r === 0) throw new Error("div0"); v = o === "*" ? v * r : v / r; } return v; }
    function add(){ let v = mul(); while(peek() === "+" || peek() === "-"){ const o = s[i++]; const r = mul(); v = o === "+" ? v + r : v - r; } return v; }
    if(!s) throw new Error("empty");
    const v = add(); if(i !== s.length) throw new Error("syntax");
    if(!Number.isFinite(v)) throw new Error("range");
    return v;
}
function calcFmt(v){ return String(Number(v.toPrecision(12))); }
function calcConvert(group, from, to, v){
    const t = CALC_UNITS[group]; return v * t[from] / t[to];
}
function calcTemp(v, from, to){
    const c = from === "C" ? v : from === "F" ? (v - 32) * 5 / 9 : v - 273.15;
    return to === "C" ? c : to === "F" ? c * 9 / 5 + 32 : c + 273.15;
}

function initCalc(){ registerTool("cl", onCalcAction); try{ const s = JSON.parse(localStorage.getItem("are_fx") || "null"); if(s && s.rates){ calc.fx = s.rates; calc.fxAt = s.at || ""; } }catch(_e){} }

function openCalc(){
    openSheet(toolHead("🧮 電卓・換算", "計算・単位の換算・為替の目安") + '<div id="clBody"></div>' + toolClose());
    calc.tab = calc.tab || "calc"; clPaint();
}
function clTabs(){ return '<div class="row" style="justify-content:flex-start">' + [["calc", "電卓"], ["unit", "単位換算"], ["fx", "為替の目安"]].map((t) => '<button type="button" class="' + (calc.tab === t[0] ? "" : "button-secondary") + '" data-t="cl:tab" data-k="' + t[0] + '">' + t[1] + '</button>').join("") + '</div>'; }
function clPaint(){
    const box = $("clBody"); if(!box) return;
    if(calc.tab === "calc"){
        const keys = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "%", "+", "(", ")", "^", "C"];
        box.innerHTML = clTabs() + '<input id="clExpr" type="text" inputmode="decimal" autocomplete="off" value="' + escapeHtml(calc.expr) + '" placeholder="例：1280×3+500" data-live="1" data-t="cl:expr"><div id="clRes" class="admin-card" style="font-size:22px;text-align:right;min-height:1.6em">' + clResult() + '</div>' +
            '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">' + keys.map((k) => '<button type="button" class="' + (/\d|\./.test(k) ? "button-secondary" : "button") + '" style="padding:12px 0;font-size:18px" data-t="cl:key" data-k="' + k + '">' + k + '</button>').join("") + '</div>' +
            '<div class="row"><button type="button" class="button-secondary" data-t="cl:back">⌫</button><button type="button" class="button-secondary" data-t="cl:copy">結果をコピー</button><button type="button" class="button-secondary" data-t="cl:input">入力欄に入れる</button></div>';
    }else if(calc.tab === "unit"){
        const groups = Object.keys(CALC_UNITS).concat(["温度"]);
        calc.group = calc.group || "長さ";
        const units = calc.group === "温度" ? {C:1, F:1, K:1} : CALC_UNITS[calc.group], names = Object.keys(units);
        box.innerHTML = clTabs() + '<select id="clGroup" class="status-select" data-t="cl:group">' + groups.map((g) => '<option' + (g === calc.group ? " selected" : "") + '>' + g + '</option>').join("") + '</select>' +
            '<div class="row" style="justify-content:flex-start"><input id="clV" type="text" inputmode="decimal" value="1" style="width:34%" data-live="1" data-t="cl:uconv"><select id="clFrom" class="status-select" data-t="cl:uconv">' + names.map((n, i) => '<option' + (i === 0 ? " selected" : "") + '>' + n + '</option>').join("") + '</select><span>→</span><select id="clTo" class="status-select" data-t="cl:uconv">' + names.map((n, i) => '<option' + (i === 1 ? " selected" : "") + '>' + n + '</option>').join("") + '</select></div>' +
            '<div id="clURes" class="admin-card" style="font-size:20px;text-align:right"></div>';
        clUnit();
    }else{
        const rates = calc.fx || CALC_FX_DEFAULT, codes = Object.keys(CALC_FX_DEFAULT);
        box.innerHTML = clTabs() + '<div class="admin-card meta">⚠ あくまで目安です。' + (calc.fxLive ? "最新のレート（" + escapeHtml(calc.fxAt) + "）を取得しました。" : calc.fx ? "前回取得したレート（" + escapeHtml(calc.fxAt) + "）を使っています。" : "おおよその固定値を使っています。") + '実際の両替・決済のレートとは違います。</div>' +
            '<div class="row" style="justify-content:flex-start"><input id="clFV" type="text" inputmode="decimal" value="100" style="width:34%" data-live="1" data-t="cl:fxconv"><select id="clFF" class="status-select" data-t="cl:fxconv">' + codes.map((c) => '<option' + (c === "USD" ? " selected" : "") + '>' + c + '</option>').join("") + '</select><span>→</span><select id="clFT" class="status-select" data-t="cl:fxconv">' + codes.map((c) => '<option' + (c === "JPY" ? " selected" : "") + '>' + c + '</option>').join("") + '</select></div>' +
            '<div id="clFRes" class="admin-card" style="font-size:20px;text-align:right"></div><div class="row"><button type="button" class="button-secondary" data-t="cl:fxget">最新のレートを取得</button></div>' +
            '<details><summary>レートを自分で入れる（1通貨＝何円）</summary>' + codes.filter((c) => c !== "JPY").map((c) => '<label>' + c + ' <input class="clRate" data-c="' + c + '" type="text" inputmode="decimal" value="' + Number((rates[c] || CALC_FX_DEFAULT[c]).toPrecision(5)) + '" style="width:90px"></label>').join(" ") + '<div class="row"><button type="button" class="button-secondary" data-t="cl:fxsave">このレートを使う</button></div></details>';
        clFx();
    }
}
function clResult(){ if(!calc.expr.trim()) return ""; try{ return escapeHtml(calcFmt(calcEval(calc.expr))); }catch(e){ return '<span class="meta">' + (String(e.message) === "div0" ? "0では割れません" : "…") + '</span>'; } }
function clUnit(){
    const out = $("clURes"); if(!out) return;
    const v = Number($("clV").value.replace(/[，,]/g, "")); if(!Number.isFinite(v)){ out.textContent = "数字を入れてください"; return; }
    const g = calc.group, f = $("clFrom").value, t = $("clTo").value;
    const r = g === "温度" ? calcTemp(v, f, t) : calcConvert(g, f, t, v);
    out.textContent = calcFmt(v) + " " + f + " ＝ " + calcFmt(r) + " " + t;
}
function clFx(){
    const out = $("clFRes"); if(!out) return;
    const rates = calc.fx || CALC_FX_DEFAULT, v = Number($("clFV").value.replace(/[，,]/g, "")); if(!Number.isFinite(v)){ out.textContent = "数字を入れてください"; return; }
    const f = $("clFF").value, t = $("clFT").value, yenv = v * (rates[f] || CALC_FX_DEFAULT[f]), r = yenv / (rates[t] || CALC_FX_DEFAULT[t]);
    out.textContent = v.toLocaleString("ja-JP") + " " + f + " ≒ " + r.toLocaleString("ja-JP", {maximumFractionDigits:2}) + " " + t;
}
async function onCalcAction(action, node){
    if(action === "tab"){ calc.tab = node.dataset.k; clPaint(); return; }
    if(action === "key"){ calc.expr = node.dataset.k === "C" ? "" : calc.expr + node.dataset.k; $("clExpr").value = calc.expr; $("clRes").innerHTML = clResult(); return; }
    if(action === "back"){ calc.expr = calc.expr.slice(0, -1); $("clExpr").value = calc.expr; $("clRes").innerHTML = clResult(); return; }
    if(action === "expr"){ calc.expr = node.value; $("clRes").innerHTML = clResult(); return; }
    if(action === "copy" || action === "input"){
        let r = ""; try{ r = calcFmt(calcEval(calc.expr)); }catch(_e){ showToast("計算できる式を入れてください。"); return; }
        if(action === "copy"){ try{ await navigator.clipboard.writeText(r); showToast("コピーしました。"); }catch(_e){ showToast("コピーできませんでした。"); } }
        else{ const inp = el.messageInput; inp.value = (inp.value ? inp.value + " " : "") + calc.expr + " = " + r; inp.dispatchEvent(new Event("input", {bubbles:true})); closeSheet(); }
        return;
    }
    if(action === "group"){ calc.group = node.value; clPaint(); return; }
    if(action === "uconv"){ clUnit(); return; }
    if(action === "fxconv"){ clFx(); return; }
    if(action === "fxsave"){
        const r = Object.assign({}, calc.fx || CALC_FX_DEFAULT); r.JPY = 1;
        document.querySelectorAll(".clRate").forEach((i) => { const n = Number(i.value.replace(/[，,]/g, "")); if(n > 0) r[i.dataset.c] = n; });
        calc.fx = r; calc.fxAt = "手入力"; calc.fxLive = false; try{ localStorage.setItem("are_fx", JSON.stringify({rates:r, at:"手入力"})); }catch(_e){} clFx(); showToast("レートを保存しました。"); return;
    }
    if(action === "fxget"){
        try{
            const r = await fetch("https://api.frankfurter.dev/v1/latest?base=JPY&symbols=" + Object.keys(CALC_FX_DEFAULT).filter((c) => c !== "JPY").join(","));
            if(!r.ok) throw new Error("http");
            const j = await r.json(), rates = {JPY:1};
            Object.keys(j.rates || {}).forEach((c) => { if(j.rates[c] > 0) rates[c] = 1 / j.rates[c]; });
            if(Object.keys(rates).length < 3) throw new Error("data");
            calc.fx = Object.assign({}, CALC_FX_DEFAULT, rates); calc.fxAt = String(j.date || "").slice(0, 10); calc.fxLive = true;
            try{ localStorage.setItem("are_fx", JSON.stringify({rates:calc.fx, at:calc.fxAt})); }catch(_e){}
            clPaint(); showToast("最新のレートを取得しました（目安）。");
        }catch(_e){ showToast("レートを取得できませんでした。手入力か、固定値の目安をお使いください。"); }
    }
}
