"use strict";
// ===== 割り勘計算（結果をチャットに貼る）=====
// ・合計金額と参加者を入れると、ひとりぶんの金額を計算します。端数は「切り上げ」にして、立て替えた人が調整します。
// ・参加者は1行に1人。「名前, 2」のように書くと、その人は2倍払う（0.5なら半分）という重みづけもできます。
// ・結果は文章としてチャットに送ります（お金のやりとり自体はアプリではしません）。

const sp = {people:[], total:0, unit:10, payer:0};

/** 計算だけの関数。people=[{name,w}], payer=立て替えた人の番号(-1ならなし) */
function splitCompute(total, people, unit, payer){
    const n = people.length, sumW = people.reduce((a, p) => a + p.w, 0);
    if(!(total > 0) || !n || !(sumW > 0)) return null;
    const u = Math.max(1, Math.round(unit) || 1);
    const ideal = people.map((p) => total * p.w / sumW);
    const pay = ideal.map((x) => Math.ceil(x / u - 1e-9) * u);
    if(payer >= 0 && payer < n){
        // 立て替えた人は「残り」を負担するので、ほかの人が切り上げた分だけ軽くなる
        const others = pay.reduce((a, x, i) => a + (i === payer ? 0 : x), 0);
        pay[payer] = Math.max(0, total - others);
    }
    const sum = pay.reduce((a, x) => a + x, 0);
    return {pay, sum, diff:sum - total, ideal};
}

function splitParse(text){
    return String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 30).map((l) => {
        const m = l.split(/[,，、\t]+/);
        const name = (m[0] || "").trim().slice(0, 20);
        let w = Number((m[1] || "1").replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)));
        if(!(w > 0) || w > 100) w = 1;
        return {name:name || "だれか", w};
    });
}

const yen = (n) => Math.round(n).toLocaleString("ja-JP") + "円";

function openSplit(){
    if(!state.currentRoom){ showToast("先にチャットを開いてください。"); return; }
    const room = state.currentRoom;
    const names = (room.memberIds && room.memberIds.length ? room.memberIds : [state.user.id, room.partnerId].filter(Boolean)).map((id) => {
        if(id === state.user.id) return "あなた";
        // 自分だけにつけた名前は、チャットに貼ると相手に伝わってしまうので使わない（本来の名前か、チャット内の名前）
        const p = feat.known.get(id) || (room.partner && room.partner.id === id ? room.partner : {id});
        return (typeof nickRoomName === "function" && nickRoomName(room.id, id)) || p.display_name || p.displayName || "ユーザー";
    });
    openSheet(toolHead("💴 割り勘", "合計と人数から、ひとりぶんを計算してチャットに貼ります") +
        '<label for="spTotal">合計金額（円）</label><input type="number" id="spTotal" data-live="1" data-t="split:calc" inputmode="numeric" min="1" max="9999999" placeholder="例：12800">' +
        '<label for="spPeople">参加者（1行に1人。「名前, 2」で2倍払い）</label><textarea id="spPeople" data-live="1" data-t="split:calc" rows="5">' + escapeHtml(names.join("\n")) + '</textarea>' +
        '<label for="spUnit">端数のまるめ（切り上げ）</label><select id="spUnit" data-t="split:calc"><option value="1">1円単位</option><option value="10" selected>10円単位</option><option value="100">100円単位</option></select>' +
        '<label for="spPayer">立て替えた人（その人が端数を調整）</label><select id="spPayer" data-t="split:calc"></select>' +
        '<div id="spOut" class="admin-card" aria-live="polite"></div>' +
        '<div class="row"><button type="button" data-t="split:send">チャットに貼る</button><button type="button" class="button-secondary" data-t="split:copy">コピー</button><button type="button" class="button-secondary" data-pm="close">閉じる</button></div>');
    splitPayers();
    splitCalc();
}

function splitPayers(){
    const people = splitParse(document.getElementById("spPeople").value), sel = document.getElementById("spPayer");
    const cur = sel.value;
    sel.innerHTML = '<option value="-1">（決めない）</option>' + people.map((p, i) => '<option value="' + i + '">' + escapeHtml(p.name) + '</option>').join("");
    if(cur && Number(cur) < people.length) sel.value = cur;
}

function splitText(){
    const total = Math.round(Number(document.getElementById("spTotal").value) || 0);
    const people = splitParse(document.getElementById("spPeople").value);
    const unit = Number(document.getElementById("spUnit").value) || 10, payer = Number(document.getElementById("spPayer").value);
    const r = splitCompute(total, people, unit, Number.isNaN(payer) ? -1 : payer);
    if(!r) return {text:"", html:'<span class="meta">合計金額と参加者を入れてください。</span>'};
    const lines = people.map((p, i) => "・" + p.name + (p.w !== 1 ? "（×" + p.w + "）" : "") + "：" + yen(r.pay[i]) + (i === payer ? "（立て替え）" : ""));
    let text = "💴 割り勘（合計 " + yen(total) + "・" + people.length + "人）\n" + lines.join("\n");
    if(payer >= 0 && payer < people.length){
        const back = r.pay.reduce((a, x, i) => a + (i === payer ? 0 : x), 0);
        text += "\n" + people[payer].name + " さんが立て替え → ほかの人は上の金額を渡してください（合計 " + yen(back) + "）";
    }
    if(r.diff) text += "\n※ 端数のまるめで " + (r.diff > 0 ? "+" : "") + yen(r.diff) + " の差が出ます";
    const html = lines.map((l) => escapeHtml(l)).join("<br>") + (r.diff ? '<div class="meta">端数の差：' + (r.diff > 0 ? "+" : "") + escapeHtml(yen(r.diff)) + '</div>' : '<div class="meta">ぴったりです</div>');
    return {text, html};
}

function splitCalc(){
    const out = document.getElementById("spOut"); if(!out) return;
    out.innerHTML = splitText().html;
}

async function onSplitAction(action, node){
    if(action === "calc"){ if(node && node.id === "spPeople") splitPayers(); splitCalc(); return; }
    const t = splitText().text;
    if(!t){ showToast("合計金額と参加者を入れてください。"); return; }
    if(action === "copy"){
        try{ await navigator.clipboard.writeText(t); showToast("コピーしました。"); }catch(_e){ showToast("コピーできませんでした。「チャットに貼る」を使ってください。"); }
    }else if(action === "send"){
        closeSheet();
        await sendMessagePayload(buildTextPayload(t), {keepInput:true});
    }
}

function initSplit(){ registerTool("split", onSplitAction); }
