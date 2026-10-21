// AREの追加機能：AIチャットボット（chatbot.txtの部分一致）/ 天気予報（Open-Meteo）/ 交通情報（リンク）/ 1対1通話（WebRTC）
(function () {
    "use strict";
    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const hooks = () => window.AREHooks || {};
    const toast = (m) => (hooks().toast ? hooks().toast(m) : window.alert(m));
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const style = document.createElement("style");
    style.textContent = ".eb-log{display:flex;flex-direction:column;gap:10px;flex:1;overflow:auto;padding:4px 0}" +
        ".eb-msg{max-width:84%;padding:10px 14px;border-radius:15px;white-space:pre-wrap;overflow-wrap:anywhere;background:#1b2542;border:1px solid #2c3a63}" +
        ".eb-msg.me{align-self:flex-end;background:#273d73;border-color:#405b9c}.eb-chips{display:flex;gap:6px;flex-wrap:wrap}" +
        ".eb-chip{border:1px solid #2c3a63;background:#141b33;color:inherit;border-radius:99px;padding:6px 12px;cursor:pointer}" +
        ".eb-form{display:flex;gap:8px;padding-top:8px}.eb-form input,.eb-in{flex:1;min-height:44px;background:#0b1020;color:inherit;border:1px solid #2c3a63;border-radius:12px;padding:0 12px;font:inherit;font-size:16px}" +
        ".eb-form button,.eb-btn{min-height:44px;border:0;border-radius:12px;padding:0 16px;background:#4f6df5;color:#fff;font:inherit;cursor:pointer}.eb-btn.sec{background:#26314f}" +
        ".eb-note{font-size:12px;color:#9aa7c7}.eb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px}" +
        ".eb-day{border:1px solid #2c3a63;border-radius:12px;padding:10px;text-align:center;background:#141b33}.eb-big{font-size:44px;line-height:1.1}" +
        ".eb-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.more-item{display:block;margin:8px 16px;width:calc(100% - 32px)}" +
        ".call-overlay{position:fixed;inset:0;z-index:60;background:#05070f;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff}" +
        ".call-overlay[hidden],.call-incoming[hidden]{display:none}.call-overlay #callRemote{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#05070f}" +
        ".call-overlay #callLocal{position:absolute;right:14px;top:calc(14px + env(safe-area-inset-top));width:110px;max-height:160px;border-radius:12px;object-fit:cover;background:#111;z-index:2;border:1px solid #ffffff44}" +
        ".call-info{position:relative;z-index:2;text-align:center;text-shadow:0 1px 6px #000;margin-top:auto;padding-top:calc(20px + env(safe-area-inset-top))}.call-info b{display:block;font-size:22px}" +
        ".call-controls{position:relative;z-index:2;display:flex;gap:14px;margin:auto 0 calc(30px + env(safe-area-inset-bottom));padding-top:20px}.call-controls button{min-width:64px;height:64px;border-radius:32px;border:0;font-size:22px;background:#ffffff26;color:#fff;cursor:pointer}" +
        ".call-controls #callEnd{background:#e0443e;font-size:15px;padding:0 20px}.call-controls button.off{background:#fff;color:#111}" +
        ".call-incoming{position:fixed;inset:0;z-index:61;background:#000b;display:flex;align-items:center;justify-content:center;padding:16px}.call-incoming .box{background:#141b33;border:1px solid #2c3a63;border-radius:16px;padding:24px;text-align:center;color:#fff;width:min(340px,100%)}" +
        ".call-incoming .box b{display:block;font-size:20px;margin:6px 0 16px}.call-incoming .row{display:flex;gap:12px;justify-content:center}";
    document.head.appendChild(style);

    // ---------- パネル枠組み ----------
    const panel = $("extraPanel"), body = $("extraBody"), title = $("extraTitle");
    document.addEventListener("click", (e) => {
        const b = e.target.closest("[data-extra]");
        if (!b) return;
        panel.hidden = false;
        ({ chatbot: renderBot, weather: renderWeather, transit: renderTransit })[b.dataset.extra]();
    });
    $("extraBack").addEventListener("click", () => { panel.hidden = true; body.textContent = ""; });

    // ---------- AIチャットボット（chatbot.txt を部分一致検索するだけの仕組み） ----------
    let entries = null;
    const norm = (s) => String(s).normalize("NFKC").toLowerCase().replace(/\s+/g, "");
    async function loadBot() {
        if (entries) return entries;
        const res = await fetch("./chatbot.txt", { cache: "no-cache" });
        if (!res.ok) throw new Error("chatbot.txt を読み込めませんでした。");
        const text = (await res.text()).replace(/^\uFEFF/, "");
        entries = text.split(/\r?\n\s*\r?\n/).map((block) => {
            let q = null; const a = [];
            block.split(/\r?\n/).forEach((line) => {
                if (/^\s*#/.test(line)) return;
                const mq = /^\s*[QＱ][:：]\s*(.*)$/.exec(line), ma = /^\s*[AＡ][:：]\s*(.*)$/.exec(line);
                if (mq) q = mq[1]; else if (ma) a.push(ma[1]); else if (a.length && line.trim()) a.push(line.trim());
            });
            if (!q || !a.length) return null;
            const parts = q.split(/[|｜]/).map((x) => x.trim()).filter(Boolean);
            return { label: parts[0], keys: parts.map(norm).filter((k) => k.length >= 2), answer: a.join("\n") };
        }).filter(Boolean);
        return entries;
    }
    function findAnswer(input) {
        const t = norm(input);
        let best = null, score = 0;
        for (const e of entries) for (const k of e.keys) {
            const s = t.includes(k) ? 100 + k.length : (t.length >= 2 && k.includes(t) ? t.length : 0);
            if (s > score) { score = s; best = e; }
        }
        return best;
    }
    async function renderBot() {
        title.textContent = "🤖 AIチャットボット";
        body.innerHTML = '<div class="eb-note">あらかじめ登録された質問と部分一致で、自動的に回答します（人工知能が考えて答えるものではありません）。</div><div class="eb-log" id="botLog"></div><div class="eb-chips" id="botChips"></div><form class="eb-form" id="botForm"><input id="botInput" maxlength="100" placeholder="質問を入力（例：使い方）" autocomplete="off"><button>送信</button></form>';
        const log = $("botLog");
        const add = (text, me) => { const d = document.createElement("div"); d.className = "eb-msg" + (me ? " me" : ""); d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; };
        try { await loadBot(); } catch (e) { add(e.message, false); return; }
        add("こんにちは！ARE の使い方などを、キーワードで質問してください。", false);
        const chips = $("botChips");
        entries.slice(0, 8).forEach((e) => { const b = document.createElement("button"); b.type = "button"; b.className = "eb-chip"; b.textContent = e.label; b.onclick = () => ask(e.label); chips.appendChild(b); });
        function ask(q) {
            const text = q.trim(); if (!text) return;
            add(text, true);
            const hit = findAnswer(text);
            add(hit ? hit.answer : "うまく見つかりませんでした。別のキーワードで試すか、下の候補を押してください。", false);
        }
        $("botForm").addEventListener("submit", (ev) => { ev.preventDefault(); const i = $("botInput"); ask(i.value); i.value = ""; });
    }

    // ---------- 天気予報（Open-Meteo：無料・APIキー不要） ----------
    const WMO = { 0: ["快晴", "☀️"], 1: ["晴れ", "🌤️"], 2: ["一部曇り", "⛅"], 3: ["曇り", "☁️"], 45: ["霧", "🌫️"], 48: ["霧氷", "🌫️"], 51: ["弱い霧雨", "🌦️"], 53: ["霧雨", "🌦️"], 55: ["強い霧雨", "🌧️"], 56: ["着氷性の霧雨", "🌧️"], 57: ["着氷性の霧雨", "🌧️"], 61: ["弱い雨", "🌦️"], 63: ["雨", "🌧️"], 65: ["強い雨", "🌧️"], 66: ["着氷性の雨", "🌧️"], 67: ["着氷性の雨", "🌧️"], 71: ["弱い雪", "🌨️"], 73: ["雪", "❄️"], 75: ["強い雪", "❄️"], 77: ["霧雪", "🌨️"], 80: ["弱いにわか雨", "🌦️"], 81: ["にわか雨", "🌧️"], 82: ["激しいにわか雨", "⛈️"], 85: ["弱いにわか雪", "🌨️"], 86: ["強いにわか雪", "❄️"], 95: ["雷雨", "⛈️"], 96: ["雷雨（ひょう）", "⛈️"], 99: ["激しい雷雨", "⛈️"] };
    const wmo = (c) => WMO[c] || ["不明", "❔"];
    function savedPlace() { try { return JSON.parse(localStorage.getItem("are_weather_place")) || null; } catch (_e) { return null; } }
    function renderWeather() {
        title.textContent = "☀️ 天気予報";
        body.innerHTML = '<div class="eb-row"><input class="eb-in" id="wCity" placeholder="地名で検索（例：大阪、札幌）" maxlength="40"><button class="eb-btn" id="wSearch" type="button">検索</button><button class="eb-btn sec" id="wGeo" type="button">📍 現在地</button></div><div id="wChoices" class="eb-row"></div><div id="wResult"></div><div class="eb-note">天気データ：Open-Meteo（無料サービス）。現在地は、押したときだけブラウザの許可を得て使います。</div>';
        const place = savedPlace() || { name: "東京", lat: 35.6895, lon: 139.6917 };
        show(place);
        $("wSearch").onclick = search;
        $("wCity").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) search(); });
        $("wGeo").onclick = () => {
            if (!navigator.geolocation) { toast("このブラウザでは現在地を使えません。"); return; }
            navigator.geolocation.getCurrentPosition((p) => show({ name: "現在地", lat: p.coords.latitude, lon: p.coords.longitude }), () => toast("現在地を取得できませんでした。許可を確認してください。"), { timeout: 10000 });
        };
        async function search() {
            const q = $("wCity").value.trim(); if (!q) return;
            const box = $("wChoices"); box.textContent = "検索中...";
            try {
                const r = await fetch("https://geocoding-api.open-meteo.com/v1/search?count=5&language=ja&format=json&name=" + encodeURIComponent(q));
                const j = await r.json(); box.textContent = "";
                if (!j.results || !j.results.length) { box.textContent = "見つかりませんでした。"; return; }
                j.results.forEach((x) => { const b = document.createElement("button"); b.type = "button"; b.className = "eb-chip"; b.textContent = [x.name, x.admin1, x.country].filter(Boolean).join(" / "); b.onclick = () => { box.textContent = ""; show({ name: x.name, lat: x.latitude, lon: x.longitude }); }; box.appendChild(b); });
            } catch (_e) { box.textContent = "検索に失敗しました。通信状態を確認してください。"; }
        }
        async function show(p) {
            const out = $("wResult"); out.textContent = "読み込み中...";
            try {
                const url = "https://api.open-meteo.com/v1/forecast?latitude=" + p.lat + "&longitude=" + p.lon + "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7";
                const r = await fetch(url); if (!r.ok) throw new Error("http " + r.status);
                const j = await r.json(), c = j.current, d = j.daily, w = wmo(c.weather_code);
                try { localStorage.setItem("are_weather_place", JSON.stringify(p)); } catch (_e) { /* 保存できなくても続行 */ }
                out.innerHTML = '<div class="eb-day" style="margin:8px 0"><div><b>' + esc(p.name) + '</b></div><div class="eb-big">' + w[1] + '</div><div>' + esc(w[0]) + ' ' + Math.round(c.temperature_2m) + '℃（体感 ' + Math.round(c.apparent_temperature) + '℃）</div><div class="eb-note">風 ' + c.wind_speed_10m + ' km/h ・ 降水 ' + c.precipitation + ' mm</div></div><div class="eb-grid">' +
                    d.time.map((t, i) => { const x = wmo(d.weather_code[i]), dt = new Date(t + "T00:00:00"); return '<div class="eb-day"><div>' + (dt.getMonth() + 1) + '/' + dt.getDate() + '（' + "日月火水木金土"[dt.getDay()] + '）</div><div class="eb-big" style="font-size:30px">' + x[1] + '</div><div>' + esc(x[0]) + '</div><div>' + Math.round(d.temperature_2m_max[i]) + '℃ / ' + Math.round(d.temperature_2m_min[i]) + '℃</div><div class="eb-note">降水確率 ' + (d.precipitation_probability_max[i] ?? "-") + '%</div></div>'; }).join("") + '</div>';
            } catch (_e) { out.textContent = "天気を取得できませんでした。通信状態を確認して、もう一度お試しください。"; }
        }
    }

    // ---------- 交通情報（外部の公式・大手サービスへのリンク） ----------
    function renderTransit() {
        title.textContent = "🚆 交通情報";
        body.innerHTML = '<div class="eb-note">乗換案内と運行状況は、外部サービスの画面を新しいタブで開きます（ARE の中にはリアルタイム情報を取り込んでいません）。</div>' +
            '<div class="eb-row"><input class="eb-in" id="tFrom" placeholder="出発駅・場所" maxlength="40"><input class="eb-in" id="tTo" placeholder="到着駅・場所" maxlength="40"></div>' +
            '<div class="eb-row"><button class="eb-btn" id="tYahoo" type="button">Yahoo!乗換案内で検索</button><button class="eb-btn sec" id="tMaps" type="button">Googleマップで検索</button></div>' +
            '<div class="eb-note" style="margin-top:12px">運行状況（遅延・運休）</div><div class="eb-row">' +
            '<a class="eb-btn sec" style="display:inline-flex;align-items:center;text-decoration:none" href="https://transit.yahoo.co.jp/diainfo" target="_blank" rel="noopener noreferrer">Yahoo!路線情報（全国）</a>' +
            '<a class="eb-btn sec" style="display:inline-flex;align-items:center;text-decoration:none" href="https://traininfo.jreast.co.jp/train_info/" target="_blank" rel="noopener noreferrer">JR東日本 運行情報</a></div>';
        const go = (build) => () => {
            const f = $("tFrom").value.trim(), t = $("tTo").value.trim();
            if (!f || !t) { toast("出発地と到着地を入力してください。"); return; }
            window.open(build(encodeURIComponent(f), encodeURIComponent(t)), "_blank", "noopener,noreferrer");
        };
        $("tYahoo").onclick = go((f, t) => "https://transit.yahoo.co.jp/search/result?from=" + f + "&to=" + t);
        $("tMaps").onclick = go((f, t) => "https://www.google.com/maps/dir/?api=1&origin=" + f + "&destination=" + t + "&travelmode=transit");
    }

    // ---------- 1対1通話（WebRTC。信号のやり取りはSupabase Realtimeの非公開チャンネル） ----------
    const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };
    const channels = new Map();
    let call = null, incoming = null, ui = null, timers = {};
    const client = () => window.ARESystem && window.ARESystem.client;

    function subscribe(roomId) {
        const ch = client().channel("call:" + roomId, { config: { private: true, broadcast: { self: false } } });
        ch.on("broadcast", { event: "sig" }, (m) => onSignal(roomId, m.payload || {})).subscribe();
        channels.set(roomId, ch);
    }
    async function ensureChannels() {
        const h = hooks(); if (!h.rooms || !client()) return;
        h.rooms().slice(0, 50).forEach((r) => { if (!channels.has(r.id)) subscribe(r.id); });
    }
    async function send(roomId, payload) {
        const ch = channels.get(roomId); if (!ch) return;
        for (let i = 0; i < 30 && ch.state !== "joined"; i++) await sleep(100);
        return ch.send({ type: "broadcast", event: "sig", payload });
    }
    function buildUI() {
        if (ui) return;
        const d = document.createElement("div"); d.className = "call-overlay"; d.hidden = true;
        d.innerHTML = '<video id="callRemote" autoplay playsinline></video><video id="callLocal" autoplay playsinline muted></video><div class="call-info"><b id="callName"></b><span id="callState"></span></div><div class="call-controls"><button id="callMic" type="button" aria-label="マイク">🎤</button><button id="callCam" type="button" aria-label="カメラ">📷</button><button id="callEnd" type="button">📵 終了</button></div>';
        const inc = document.createElement("div"); inc.className = "call-incoming"; inc.hidden = true;
        inc.innerHTML = '<div class="box"><div id="incKind">着信</div><b id="incName"></b><div class="row"><button class="eb-btn" id="incAccept" type="button" style="background:#2e9e5b">応答</button><button class="eb-btn" id="incDecline" type="button" style="background:#e0443e">拒否</button></div></div>';
        document.body.append(d, inc);
        ui = { root: d, remote: $("callRemote"), local: $("callLocal"), name: $("callName"), state: $("callState"), inc };
        $("callEnd").onclick = hangup;
        $("callMic").onclick = (e) => toggleTrack("audio", e.currentTarget);
        $("callCam").onclick = (e) => toggleTrack("video", e.currentTarget);
        $("incAccept").onclick = acceptIncoming;
        $("incDecline").onclick = () => { const i = incoming; closeIncoming(); if (i) send(i.roomId, { type: "decline", callId: i.callId }); };
    }
    function toggleTrack(kind, btn) {
        if (!call) return;
        const tracks = call.local.getTracks().filter((t) => t.kind === kind);
        if (!tracks.length) return;
        const on = !tracks[0].enabled; tracks.forEach((t) => { t.enabled = on; }); btn.classList.toggle("off", !on);
    }
    function showCallUI(text) {
        ui.name.textContent = call.peerName || "通話"; ui.state.textContent = text;
        ui.local.srcObject = call.local; ui.local.style.display = call.media === "video" ? "block" : "none";
        $("callCam").style.display = call.media === "video" ? "" : "none";
        ui.root.hidden = false;
    }
    async function startCall(media) {
        const h = hooks(), room = h.getRoom && h.getRoom();
        if (!room) { toast("先にチャット相手を選んでください。"); return; }
        if (room.suspended_at) { toast("このチャットは停止中のため通話できません。"); return; }
        if (call || incoming) { toast("すでに通話中、または着信中です。"); return; }
        if (!navigator.mediaDevices || !window.RTCPeerConnection) { toast("このブラウザは通話に対応していません。"); return; }
        if (!channels.has(room.id)) subscribe(room.id);
        let local;
        try { local = await navigator.mediaDevices.getUserMedia({ audio: true, video: media === "video" }); }
        catch (_e) { toast("マイク／カメラを使えません。ブラウザの許可を確認してください。"); return; }
        const partner = h.getPartner ? h.getPartner() : null;
        call = { roomId: room.id, callId: crypto.randomUUID(), role: "caller", media, local, pc: null, pending: [], connected: false, peerName: (partner && partner.display_name) || "相手" };
        showCallUI("呼び出し中…");
        send(room.id, { type: "invite", callId: call.callId, media, name: h.me ? h.me().name : "ユーザー" });
        timers.ring = setTimeout(() => { if (call && !call.connected) { send(call.roomId, { type: "cancel", callId: call.callId }); toast("応答がありませんでした。"); endCall(); } }, 45000);
    }
    function showIncoming(roomId, p) {
        incoming = { roomId, callId: p.callId, media: p.media === "video" ? "video" : "audio", name: String(p.name || "相手").slice(0, 40) };
        $("incKind").textContent = incoming.media === "video" ? "🎥 ビデオ通話の着信" : "📞 音声通話の着信";
        $("incName").textContent = incoming.name; ui.inc.hidden = false;
        timers.inc = setTimeout(closeIncoming, 45000);
    }
    function closeIncoming() { clearTimeout(timers.inc); incoming = null; if (ui) ui.inc.hidden = true; }
    async function acceptIncoming() {
        const inc = incoming; closeIncoming(); if (!inc) return;
        let local;
        try { local = await navigator.mediaDevices.getUserMedia({ audio: true, video: inc.media === "video" }); }
        catch (_e) { toast("マイク／カメラを使えません。"); send(inc.roomId, { type: "decline", callId: inc.callId }); return; }
        call = { roomId: inc.roomId, callId: inc.callId, role: "callee", media: inc.media, local, pc: null, pending: [], connected: false, peerName: inc.name };
        makePC(); showCallUI("接続中…");
        send(call.roomId, { type: "accept", callId: call.callId });
    }
    function makePC() {
        const c = call, pc = new RTCPeerConnection(ICE); c.pc = pc;
        c.local.getTracks().forEach((t) => pc.addTrack(t, c.local));
        pc.ontrack = (e) => { ui.remote.srcObject = e.streams[0]; };
        pc.onicecandidate = (e) => { if (e.candidate) send(c.roomId, { type: "ice", callId: c.callId, candidate: e.candidate.toJSON() }); };
        pc.onconnectionstatechange = () => {
            if (call !== c) return;
            if (pc.connectionState === "connected") connected();
            else if (pc.connectionState === "failed") { toast("接続できませんでした。回線の制限により通話できない場合があります。"); hangup(); }
        };
    }
    async function flushIce() { const c = call; while (c && c.pending.length) { try { await c.pc.addIceCandidate(c.pending.shift()); } catch (_e) { /* 古い候補は無視 */ } } }
    async function beginOffer() {
        const c = call; makePC();
        const offer = await c.pc.createOffer(); await c.pc.setLocalDescription(offer);
        send(c.roomId, { type: "offer", callId: c.callId, sdp: c.pc.localDescription.toJSON() });
    }
    async function handleOffer(p) {
        const c = call; await c.pc.setRemoteDescription(p.sdp); await flushIce();
        const answer = await c.pc.createAnswer(); await c.pc.setLocalDescription(answer);
        send(c.roomId, { type: "answer", callId: c.callId, sdp: c.pc.localDescription.toJSON() });
    }
    async function handleAnswer(p) { await call.pc.setRemoteDescription(p.sdp); await flushIce(); }
    async function addIce(cand) {
        if (!call || !cand) return;
        if (call.pc && call.pc.remoteDescription) { try { await call.pc.addIceCandidate(cand); } catch (_e) { /* 無視 */ } } else call.pending.push(cand);
    }
    function connected() {
        if (!call || call.connected) return;
        call.connected = true; clearTimeout(timers.ring);
        const t0 = Date.now(); if (hooks().setInCall) hooks().setInCall(true);
        timers.tick = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); ui.state.textContent = "通話中 " + String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }, 1000);
    }
    function hangup() { if (call) send(call.roomId, { type: "hangup", callId: call.callId }); endCall(); }
    function endCall() {
        clearTimeout(timers.ring); clearInterval(timers.tick);
        if (call) { call.local.getTracks().forEach((t) => t.stop()); if (call.pc) call.pc.close(); }
        call = null;
        if (ui) { ui.root.hidden = true; ui.remote.srcObject = null; ui.local.srcObject = null; }
        if (hooks().setInCall) hooks().setInCall(false);
    }
    function onSignal(roomId, p) {
        switch (p.type) {
            case "invite": if (call || incoming) { send(roomId, { type: "busy", callId: p.callId }); } else showIncoming(roomId, p); break;
            case "cancel": if (incoming && incoming.callId === p.callId) closeIncoming(); break;
            case "accept": if (call && call.callId === p.callId && call.role === "caller" && !call.pc) beginOffer(); break;
            case "decline": case "busy": if (call && call.callId === p.callId) { toast(p.type === "busy" ? "相手は通話中です。" : "通話が拒否されました。"); endCall(); } break;
            case "offer": if (call && call.callId === p.callId && call.role === "callee") handleOffer(p); break;
            case "answer": if (call && call.callId === p.callId && call.role === "caller") handleAnswer(p); break;
            case "ice": if (call && call.callId === p.callId) addIce(p.candidate); break;
            case "hangup": if (call && call.callId === p.callId) { toast("通話が終了しました。"); endCall(); } else if (incoming && incoming.callId === p.callId) closeIncoming(); break;
            default: break;
        }
    }
    window.addEventListener("pagehide", () => { if (call) hangup(); });

    window.AREExtras = {
        async onReady() {
            buildUI();
            try { await client().realtime.setAuth(); } catch (_e) { /* 自動認証に任せる */ }
            ensureChannels();
            setInterval(async () => { try { if (hooks().refreshRooms) await hooks().refreshRooms(); } catch (_e) { /* 次回に再試行 */ } ensureChannels(); }, 30000);
            const a = $("callAudioBtn"), v = $("callVideoBtn");
            if (a) a.addEventListener("click", () => startCall("audio"));
            if (v) v.addEventListener("click", () => startCall("video"));
        }
    };
})();
