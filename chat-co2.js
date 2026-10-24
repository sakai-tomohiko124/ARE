"use strict";
// ===== CO2排出量の記録（入力式の簡易計算。自分だけが見られます）=====
// 係数は「目安」です。実際の排出量は、乗り物・食材・電力会社などで変わります。

const CO2_ITEMS = {
    walk:{label:"🚶 徒歩", unit:"km", factor:0, note:"0"},
    bicycle:{label:"🚲 自転車", unit:"km", factor:0, note:"0"},
    bus:{label:"🚌 バス", unit:"km", factor:0.057, note:"約57g/人km"},
    train:{label:"🚆 電車", unit:"km", factor:0.018, note:"約18g/人km"},
    car:{label:"🚗 自家用車", unit:"km", factor:0.13, note:"約130g/km"},
    plane:{label:"✈️ 飛行機（国内）", unit:"km", factor:0.1, note:"約100g/人km"},
    beef:{label:"🥩 牛肉", unit:"100g", factor:2.7, note:"約2.7kg/100g"},
    chicken:{label:"🍗 鶏肉", unit:"100g", factor:0.7, note:"約0.7kg/100g"},
    vegetable:{label:"🥗 野菜", unit:"100g", factor:0.1, note:"約0.1kg/100g"},
    electricity:{label:"💡 電気", unit:"kWh", factor:0.45, note:"約0.45kg/kWh"},
    other:{label:"📝 そのほか（kgで直接入力）", unit:"kg", factor:1, note:"入力値そのまま"}
};
const CO2_TREE_KG_PER_YEAR = 8.8; // スギ1本が1年間に吸収するCO2の目安
feat.co2 = {rows:[]};

function initCo2(){ registerTool("co2", onCo2Action); }

async function openCo2(){
    openSheet(toolHead("🌱 CO2の記録", "移動・食事・電気から、CO2の目安を計算して記録します。自分だけが見られます。") +
        '<div id="coBody"><div class="empty-list">読み込み中...</div></div>' + toolClose());
    await loadCo2();
}

async function loadCo2(){
    try{
        const since = new Date(Date.now() - 60 * 86400000);
        const result = await requireClient().from("user_co2_logs").select("id,day,category,amount,kg,note").gte("day", dayKey(since)).order("day", {ascending:false}).order("created_at", {ascending:false}).limit(500);
        if(result.error) throw result.error;
        feat.co2.rows = result.data || [];
        paintCo2();
    }catch(error){ if($("coBody")) $("coBody").innerHTML = '<div class="empty-list">' + escapeHtml(featError(error)) + '</div>'; }
}

function co2Sum(rows, fromKey, toKey){
    return rows.filter((r) => r.day >= fromKey && r.day <= toKey).reduce((a, r) => a + Number(r.kg), 0);
}

function paintCo2(){
    const box = $("coBody");
    if(!box) return;
    const rows = feat.co2.rows, now = new Date(), today = dayKey(now);
    const weekFrom = dayKey(new Date(now.getTime() - 6 * 86400000)), monthFrom = today.slice(0, 8) + "01";
    const week = co2Sum(rows, weekFrom, today), month = co2Sum(rows, monthFrom, today), todayKg = co2Sum(rows, today, today);
    const days = [];
    for(let i = 13; i >= 0; i--){ const k = dayKey(new Date(now.getTime() - i * 86400000)); days.push([k, co2Sum(rows, k, k)]); }
    const max = Math.max(1, ...days.map((d) => d[1]));
    const trees = month / (CO2_TREE_KG_PER_YEAR / 12);
    box.innerHTML = '<div class="co-sum"><div><b>' + todayKg.toFixed(1) + '</b><small>今日 (kg)</small></div><div><b>' + week.toFixed(1) + '</b><small>7日間 (kg)</small></div><div><b>' + month.toFixed(1) + '</b><small>今月 (kg)</small></div></div>' +
        '<div class="meta">今月の分は、スギ約 ' + trees.toFixed(1) + ' 本が1か月で吸収する量に相当します（1本あたり年間約' + CO2_TREE_KG_PER_YEAR + 'kgの目安）。</div>' +
        '<div class="co-bars" aria-label="直近14日の記録">' + days.map((d) => '<div class="co-bar" title="' + escapeHtml(d[0]) + '：' + d[1].toFixed(2) + 'kg"><i style="height:' + Math.round(d[1] / max * 100) + '%"></i><span>' + Number(d[0].slice(8)) + '</span></div>').join("") + '</div>' +
        '<hr class="sep"><b>記録する</b>' +
        '<div class="row" style="justify-content:flex-start;flex-wrap:nowrap"><select id="coCat" class="status-select" data-t="co2:cat" aria-label="種類">' + Object.keys(CO2_ITEMS).map((k) => '<option value="' + k + '">' + CO2_ITEMS[k].label + '</option>').join("") + '</select>' +
        '<input id="coAmount" type="number" min="0" max="100000" step="0.1" inputmode="decimal" placeholder="量" data-live="1" data-t="co2:calc"><span id="coUnit" class="meta">km</span></div>' +
        '<label>日付 <input id="coDay" type="date" value="' + today + '" max="' + today + '"></label><input id="coNote" type="text" maxlength="100" placeholder="メモ（任意）">' +
        '<div id="coPreview" class="meta">量を入れると、CO2の目安が表示されます。</div><div class="row"><button type="button" class="button" data-t="co2:add">記録する</button></div>' +
        '<hr class="sep"><b>最近の記録</b>' +
        (rows.length ? rows.slice(0, 30).map((r) => '<div class="admin-card"><b>' + escapeHtml(r.day) + '</b> ' + (CO2_ITEMS[r.category] ? CO2_ITEMS[r.category].label : "") + ' ' + Number(r.amount) + (CO2_ITEMS[r.category] ? CO2_ITEMS[r.category].unit : "") + ' → <b>' + Number(r.kg).toFixed(2) + ' kg</b>' + (r.note ? '<div class="meta">' + escapeHtml(r.note) + '</div>' : "") +
            '<div class="row"><button type="button" class="button-secondary" data-t="co2:del" data-id="' + escapeHtml(r.id) + '">削除</button></div></div>').join("") : '<div class="empty-list">まだ記録がありません。</div>') +
        '<details class="meta"><summary>計算に使っている係数（目安）</summary><ul>' + Object.keys(CO2_ITEMS).map((k) => '<li>' + CO2_ITEMS[k].label + '：' + CO2_ITEMS[k].note + '</li>').join("") + '</ul></details>';
    onCo2Action("cat", $("coCat"));
}

function co2Calc(){
    const cat = CO2_ITEMS[$("coCat").value], amount = Number($("coAmount").value);
    if(!cat || !Number.isFinite(amount) || amount < 0) return null;
    return Math.round(amount * cat.factor * 1000) / 1000;
}

async function onCo2Action(action, node){
    if(action === "cat"){ const c = CO2_ITEMS[node.value]; if($("coUnit") && c) $("coUnit").textContent = c.unit; }
    if(action === "cat" || action === "calc"){
        const kg = co2Calc();
        if($("coPreview")) $("coPreview").textContent = kg === null ? "量を入れると、CO2の目安が表示されます。" : "CO2の目安：" + kg.toFixed(2) + " kg";
        return;
    }
    const client = requireClient();
    try{
        if(action === "add"){
            const amount = Number($("coAmount").value), kg = co2Calc(), day = $("coDay").value || dayKey(new Date());
            if(kg === null || !(amount >= 0) || $("coAmount").value === ""){ showToast("量を入力してください。"); return; }
            const result = await client.from("user_co2_logs").insert({user_id:state.user.id, day, category:$("coCat").value, amount, kg, note:($("coNote").value || "").trim() || null});
            if(result.error) throw result.error;
            showToast("記録しました。");
        }else if(action === "del"){
            const result = await client.from("user_co2_logs").delete().eq("id", node.dataset.id);
            if(result.error) throw result.error;
        }else return;
        await loadCo2();
    }catch(error){ showToast(featError(error)); }
}
