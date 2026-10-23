"use strict";

// ===== 会話履歴のZIP保存（端末に保存。サーバー側の履歴は削除しません） =====
const crcTable = (() => {
    const table = new Uint32Array(256);
    for(let n = 0; n < 256; n++){
        let v = n;
        for(let k = 0; k < 8; k++) v = v & 1 ? 0xEDB88320 ^ (v >>> 1) : v >>> 1;
        table[n] = v >>> 0;
    }
    return table;
})();

function crc32(bytes){
    let c = 0xFFFFFFFF;
    for(let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

function makeZip(files){
    const enc = new TextEncoder(), chunks = [], central = [];
    let offset = 0;
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const u16 = (v) => new Uint8Array([v & 255,(v >> 8) & 255]);
    const u32 = (v) => new Uint8Array([v & 255,(v >> 8) & 255,(v >> 16) & 255,(v >>> 24) & 255]);
    const cat = (...arr) => {
        const out = new Uint8Array(arr.reduce((s,a) => s + a.length,0));
        let p = 0;
        arr.forEach((a) => { out.set(a,p); p += a.length; });
        return out;
    };
    for(const f of files){
        const name = enc.encode(f.name), data = f.data, crc = crc32(data);
        const local = cat(u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(dosTime),u16(dosDate),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data);
        central.push(cat(u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(dosTime),u16(dosDate),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name));
        chunks.push(local);
        offset += local.length;
    }
    const cd = cat(...central);
    return new Blob([...chunks,cd,cat(u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cd.length),u32(offset),u16(0))],{type:"application/zip"});
}

function downloadBlob(blob,fileName){
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url),60000);
}

const exportKey = () => "are_export_last_" + state.user.id;

function contentLine(content){
    const item = parseMessageContent(content);
    if(item.type === "text") return item.text || "";
    if(item.type === "poll") return "[アンケート] " + (item.question || "");
    return "[" + item.type + "] " + (item.name || "添付ファイル");
}

async function exportHistory(mode){
    const client = requireClient();
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    let since = null;
    try{ since = mode === "old" ? localStorage.getItem(exportKey()) : null; }catch(_e){ /* 保存できなくても続ける */ }
    const files = [], used = new Set();
    el.exportOldButton.disabled = true;
    el.exportAllButton.disabled = true;
    try{
        for(const room of state.rooms){
            await ensureMemberProfiles(room);
            const lines = [];
            let from = 0;
            for(;;){
                let q = client.from(TABLES.messages).select("sender_id,content,created_at").eq("room_id",room.id).order("created_at",{ascending:true}).range(from,from + 999);
                if(mode === "old") q = q.lt("created_at",cutoff);
                if(since) q = q.gt("created_at",since);
                const r = await q;
                if(r.error) throw r.error;
                (r.data || []).forEach((m) => {
                    const who = m.sender_id === state.user.id ? "あなた" : profileDisplayName(feat.known.get(m.sender_id));
                    lines.push("[" + new Date(m.created_at).toLocaleString("ja-JP") + "] " + who + "：" + contentLine(m.content).replace(/\r?\n/g,"\n    "));
                });
                if(!r.data || r.data.length < 1000) break;
                from += 1000;
            }
            if(!lines.length) continue;
            const title = room.is_group ? room.name : profileDisplayName(room.partner);
            const base = String(title).replace(/[\\/:*?"<>|]/g,"_").slice(0,40) || "chat";
            let name = base + ".txt", i = 2;
            while(used.has(name)) name = base + "_" + (i++) + ".txt";
            used.add(name);
            files.push({name:name,data:new TextEncoder().encode("\uFEFF" + (room.is_group ? "グループ：" : "相手：") + title + "\n保存日時：" + new Date().toLocaleString("ja-JP") + "\n\n" + lines.join("\n") + "\n")});
        }
        if(!files.length){ showToast("保存する履歴はありません。"); return false; }
        const d = new Date();
        const stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2,"0") + String(d.getDate()).padStart(2,"0");
        downloadBlob(makeZip(files),"ARE会話履歴_" + stamp + ".zip");
        try{ localStorage.setItem(exportKey(),mode === "old" ? cutoff : new Date().toISOString()); }catch(_e){ /* 保存できなくても続ける */ }
        showToast("会話履歴をZIPで保存しました。");
        return true;
    }catch(error){
        showToast(featError(error));
        return false;
    }finally{
        el.exportOldButton.disabled = false;
        el.exportAllButton.disabled = false;
    }
}

async function maybePromptExport(){
    try{
        const today = new Date().toISOString().slice(0,10);
        if(localStorage.getItem("are_export_prompt_day") === today) return;
        const since = localStorage.getItem(exportKey());
        const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
        let q = requireClient().from(TABLES.messages).select("id",{count:"exact",head:true}).lt("created_at",cutoff);
        if(since) q = q.gt("created_at",since);
        const r = await q;
        if(r.error || !r.count) return;
        localStorage.setItem("are_export_prompt_day",today);
        if(window.confirm("30日を過ぎた会話履歴が " + r.count + " 件あります。\nZIPファイルとして、この端末に保存しますか？\n（サーバー上の履歴は消えません）")) await exportHistory("old");
    }catch(_e){ /* お知らせが出せなくても他の機能は続ける */ }
}
