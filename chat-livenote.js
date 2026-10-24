"use strict";
// ===== 共同メモの「同時編集」=====
// ・これまでの「順番に編集」（ロック）に加えて、みんなが同時に書けるモードです。
// ・入力すると少し待って自動保存。ほかの人が先に保存していたら、サーバーから最新を受け取り、自動で「まぜて」（3者マージ）から保存します。
//     ・別の行を編集：両方残ります／同じ行の別の場所：文字単位でまざります
//     ・同じ場所を同時に書き換えた：消えないように両方残し、「⚠」の印をつけます（不要なほうを消してください）
// ・2秒ごとに最新を確認し、自分が入力中でなければそのまま反映します。
// ・Google ドキュメントのような「1文字ずつのリアルタイム反映」ではありません（数秒おくれます）。

const ln = {id:null, base:"", ver:0, saving:false, dirty:false, tSave:null, poll:null, el:null, pending:null, by:null};

// ---------- 3者マージ（純粋な関数。画面に依存しない） ----------
function lnPrefix(a, b){ const n = Math.min(a.length, b.length); let i = 0; while(i < n && a[i] === b[i]) i++; return i; }
function lnSuffix(a, b){ const n = Math.min(a.length, b.length); let i = 0; while(i < n && a[a.length - 1 - i] === b[b.length - 1 - i]) i++; return i; }

/** base → x の変更を「baseのどの範囲を何に置き換えたか」の一覧にする（行単位の差分） */
function lnHunks(base, x){
    const pre = lnPrefix(base, x);
    const suf = lnSuffix(base.slice(pre), x.slice(pre));
    const b = base.slice(pre, base.length - suf), y = x.slice(pre, x.length - suf);
    if(!b.length && !y.length) return [];
    if(b.length * y.length > 4000000){ return [{bs:pre, be:base.length - suf, xs:pre, xe:x.length - suf}]; }
    const n = b.length, m = y.length, W = m + 1;
    const dp = new Uint16Array((n + 1) * W);
    for(let i = n - 1; i >= 0; i--) for(let j = m - 1; j >= 0; j--) dp[i * W + j] = b[i] === y[j] ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
    const hunks = []; let i = 0, j = 0, cur = null;
    const flush = () => { if(cur){ hunks.push({bs:pre + cur.bs, be:pre + cur.be, xs:pre + cur.xs, xe:pre + cur.xe}); cur = null; } };
    while(i < n || j < m){
        if(i < n && j < m && b[i] === y[j]){ flush(); i++; j++; continue; }
        if(!cur) cur = {bs:i, be:i, xs:j, xe:j};
        if(j >= m || (i < n && dp[(i + 1) * W + j] >= dp[i * W + j + 1])){ i++; cur.be = i; } else { j++; cur.xe = j; }
    }
    flush();
    return hunks;
}

function lnChar(t0, tm, tt){
    const hunk = (t) => { const p = lnPrefix(t0, t), s = lnSuffix(t0.slice(p), t.slice(p)); return {s:p, e:t0.length - s, text:t.slice(p, t.length - s)}; };
    const a = hunk(tm), b = hunk(tt);
    if(a.s === b.s && a.e === b.e && a.text === b.text) return tm;
    if(a.s === a.e && b.s === b.e && a.s === b.s) return t0.slice(0, a.s) + b.text + a.text + t0.slice(a.e);   // 同じ場所に両方が挿入：ほかの人→自分の順
    if(a.e <= b.s) return t0.slice(0, a.s) + a.text + t0.slice(a.e, b.s) + b.text + t0.slice(b.e);
    if(b.e <= a.s) return t0.slice(0, b.s) + b.text + t0.slice(b.e, a.s) + a.text + t0.slice(a.e);
    return null;
}

/** base=前回までの共通の内容、mine=自分の今の内容、theirs=サーバーの最新 → まぜた内容 */
function lnMerge3(base, mine, theirs){
    if(mine === theirs) return mine;
    if(mine === base) return theirs;
    if(theirs === base) return mine;
    const L = (s) => (s === "" ? [] : s.split("\n"));
    const B = L(base), M = L(mine), T = L(theirs);
    const hm = lnHunks(B, M).map((h) => Object.assign({side:"m"}, h)), ht = lnHunks(B, T).map((h) => Object.assign({side:"t"}, h));
    const all = hm.concat(ht).sort((p, q) => (p.bs - q.bs) || (p.be - q.be));
    const out = []; let pos = 0, k = 0;
    const apply = (hunks, src, cs, ce) => { const r = []; let p = cs; hunks.forEach((h) => { r.push(...B.slice(p, h.bs)); r.push(...src.slice(h.xs, h.xe)); p = h.be; }); r.push(...B.slice(p, ce)); return r; };
    while(k < all.length){
        let cs = all[k].bs, ce = all[k].be; const group = [all[k]]; k++;
        while(k < all.length && (all[k].bs < ce || (all[k].bs === ce && all[k].bs === all[k].be && group.some((g) => g.bs === g.be && g.bs === ce)))){ group.push(all[k]); ce = Math.max(ce, all[k].be); k++; }
        out.push(...B.slice(pos, cs));
        const gm = group.filter((h) => h.side === "m"), gt = group.filter((h) => h.side === "t");
        if(!gt.length) out.push(...apply(gm, M, cs, ce));
        else if(!gm.length) out.push(...apply(gt, T, cs, ce));
        else{
            const rm = apply(gm, M, cs, ce), rt = apply(gt, T, cs, ce);
            if(rm.join("\n") === rt.join("\n")) out.push(...rm);
            else if(cs === ce) out.push(...rt, ...rm);          // 同じ場所に行を足した：ほかの人の分→自分の分の順に、どちらも残す
            else{
                const merged = lnChar(B.slice(cs, ce).join("\n"), rm.join("\n"), rt.join("\n"));
                if(merged !== null) out.push(...L(merged));
                else out.push("⚠ 同時に編集された部分（ほかの人の分↓）", ...rt, "⚠ あなたの分↓", ...rm, "⚠ ここまで（不要なほうを消してください）");
            }
        }
        pos = ce;
    }
    out.push(...B.slice(pos));
    return out.join("\n");
}

/** テキストが old → new に変わったとき、カーソル位置をずらさないための計算 */
function lnCaret(oldText, newText, caret){
    const p = lnPrefix(oldText, newText);
    if(caret <= p) return caret;
    const s = lnSuffix(oldText.slice(p), newText.slice(p));
    if(caret >= oldText.length - s) return Math.max(0, caret + (newText.length - oldText.length));
    return Math.min(p, newText.length);
}

// ---------- 画面と同期 ----------
function lnHtml(n){
    ln.pending = {id:n.id, body:n.body || "", ver:n.version};
    setTimeout(lnStart, 0);
    return '<h4 style="margin:6px 0">📝 ' + escapeHtml(n.title) + ' <span class="meta">⚡ 同時編集</span></h4>' +
        '<div class="meta" id="lnStatus" role="status" aria-live="polite">接続中…</div>' +
        '<div class="row" style="justify-content:flex-start"><button type="button" class="button-secondary" data-t="wk:notelist">← メモ一覧（編集をやめる）</button></div>' +
        '<textarea id="lnBody" rows="14" maxlength="20000" aria-label="共同メモの本文">' + escapeHtml(n.body || "") + '</textarea>' +
        '<div class="meta">入力すると自動で保存されます。ほかの人の変更も自動でまざります（数秒おくれます）。</div>';
}

function lnStatus(t){ const s = document.getElementById("lnStatus"); if(s) s.textContent = t; }

function lnStart(){
    const ta = document.getElementById("lnBody"), p = ln.pending;
    if(!ta || !p) return;
    clearInterval(ln.poll); clearTimeout(ln.tSave);
    ln.id = p.id; ln.base = p.body; ln.ver = p.ver; ln.saving = false; ln.dirty = false; ln.el = ta;
    ta.addEventListener("input", () => { ln.dirty = ta.value !== ln.base; lnStatus(ln.dirty ? "入力中…（自動で保存します）" : "保存済み"); clearTimeout(ln.tSave); ln.tSave = setTimeout(lnSave, 1200); });
    lnStatus("保存済み ・ v" + ln.ver);
    ln.poll = setInterval(lnTick, 2000);
}

function lnAlive(){
    const ta = document.getElementById("lnBody");
    if(!ta || ta !== ln.el){ clearInterval(ln.poll); clearTimeout(ln.tSave); ln.poll = null; return null; }
    return ta;
}

function lnSet(ta, text){
    const old = ta.value, caret = ta.selectionStart, focused = document.activeElement === ta;
    ta.value = text;
    if(focused){ const c = lnCaret(old, text, caret); try{ ta.setSelectionRange(c, c); }catch(_e){} }
}

async function lnTick(){
    const ta = lnAlive(); if(!ta || ln.saving) return;
    if(ln.dirty){ lnSave(); return; }
    try{
        const r = await requireClient().from("shared_notes").select("body,version,updated_by").eq("id", ln.id).maybeSingle();
        if(r.error || !r.data || !lnAlive() || ln.saving || ln.dirty) return;
        if(r.data.version !== ln.ver){
            const body = r.data.body || "";
            lnSet(ta, body); ln.base = body; ln.ver = r.data.version;
            lnStatus("ほかの人の変更を反映しました ・ v" + ln.ver + (r.data.updated_by && typeof wkName === "function" ? "（" + wkName(r.data.updated_by) + "）" : ""));
        }
    }catch(_e){ /* 次の回に */ }
}

async function lnSave(){
    const ta = lnAlive(); if(!ta || ln.saving) return;
    ln.saving = true; lnStatus("保存中…");
    try{
        for(let tries = 0; tries < 4; tries++){
            const mine = ta.value;
            const res = await requireClient().rpc("note_save_live", {p_id:ln.id, p_body:mine, p_version:ln.ver});
            if(res.error) throw res.error;
            const d = res.data || {};
            if(d.ok){ ln.ver = d.version; ln.base = mine; ln.dirty = ta.value !== mine; lnStatus(ln.dirty ? "入力中…" : "保存済み ・ v" + ln.ver); if(ln.dirty) ln.tSave = setTimeout(lnSave, 800); return; }
            // 先にほかの人が保存していた → まぜてもう一度
            const merged = lnMerge3(ln.base, ta.value, d.body || "");
            if(ta.value !== merged) lnSet(ta, merged);
            ln.base = d.body || ""; ln.ver = d.version;
            lnStatus("ほかの人の変更とまぜました");
        }
        lnStatus("うまく保存できませんでした。少し待ってからもう一度入力してください。");
    }catch(error){ lnStatus("保存できませんでした：" + featError(error)); }
    finally{ ln.saving = false; }
}
