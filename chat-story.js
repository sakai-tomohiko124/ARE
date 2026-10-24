"use strict";
// ===== ストーリー（24時間で消える投稿）=====
// 見られるのは「自分」と「自分がフォローしている人」の分だけ（サーバー側のルールで制限）。

const STORY_BG = {blue:"#2d4fd6", pink:"#d63d8a", green:"#1f9d6b", orange:"#e0802a", purple:"#7b47d6"};
const STORY_BG_NAMES = {blue:"青", pink:"ピンク", green:"緑", orange:"オレンジ", purple:"紫"};
feat.story = {file:null, bg:"blue"};

function initStory(){ registerTool("story", onStoryAction); }

function openStory(){
    openSheet(toolHead("📖 ストーリー", "24時間で消えます。見られるのは、あなたと、あなたがフォローしている人の分だけです。") +
        '<div class="row" style="justify-content:flex-start"><button type="button" class="button" data-t="story:new">＋ ストーリーを投稿</button></div>' +
        '<div id="stList" class="st-list"><div class="empty-list">読み込み中...</div></div>' + toolClose());
    return loadStories();
}

async function loadStories(){
    const box = $("stList");
    if(!box) return;
    const client = requireClient();
    try{
        const result = await client.from("stories").select("id,user_id,body,image_path,bg,created_at,expires_at")
            .gt("expires_at", new Date().toISOString()).order("created_at", {ascending:false}).limit(60);
        if(result.error) throw result.error;
        const rows = result.data || [];
        const ids = [...new Set(rows.map((r) => r.user_id))].filter((id) => id !== state.user.id && !feat.known.has(id));
        if(ids.length){
            const profiles = await client.from(TABLES.profiles).select("*").in("id", ids);
            (profiles.data || []).forEach((p) => feat.known.set(p.id, p));
        }
        const paths = rows.map((r) => r.image_path).filter(Boolean);
        if(paths.length){
            const signed = await client.storage.from("post-images").createSignedUrls(paths, 3600);
            (signed.data || []).forEach((s) => { if(s.signedUrl) feat.signed.set(s.path, s.signedUrl); });
        }
        if(!$("stList")) return;
        $("stList").innerHTML = rows.length ? rows.map(storyCard).join("") : '<div class="empty-list">表示できるストーリーはありません。ユーザーをフォローするか、自分で投稿してみましょう。</div>';
    }catch(error){ if($("stList")) $("stList").innerHTML = '<div class="empty-list">' + escapeHtml(featError(error)) + '</div>'; }
}

function storyCard(story){
    const own = story.user_id === state.user.id;
    const name = own ? "あなた" : profileDisplayName(feat.known.get(story.user_id));
    const left = Math.max(0, new Date(story.expires_at).getTime() - Date.now());
    const hours = Math.floor(left / 3600000), mins = Math.floor((left % 3600000) / 60000);
    const color = STORY_BG[story.bg] || STORY_BG.blue;
    const imageUrl = story.image_path ? safeHttpUrl(feat.signed.get(story.image_path) || "") : "";
    return '<div class="st-card" style="background:' + color + '">' +
        (imageUrl ? '<img src="' + escapeHtml(imageUrl) + '" alt="ストーリーの写真" loading="lazy">' : "") +
        (story.body ? '<div class="st-body">' + escapeHtml(story.body) + '</div>' : "") +
        '<div class="st-foot"><span>' + escapeHtml(name) + ' ・ あと' + hours + '時間' + mins + '分</span>' +
        (own ? '<button type="button" class="button-secondary" data-t="story:del" data-id="' + escapeHtml(story.id) + '">削除</button>' : "") + '</div></div>';
}

function onStoryAction(action, node){
    if(action === "new") return storyCompose();
    if(action === "list") return openStory();
    if(action === "bg"){ feat.story.bg = node.dataset.bg; document.querySelectorAll("[data-t='story:bg']").forEach((b) => b.classList.toggle("on", b === node)); return; }
    if(action === "file"){ feat.story.file = node.files && node.files[0] ? node.files[0] : null; const n = $("stFileName"); if(n) n.textContent = feat.story.file ? feat.story.file.name : ""; return; }
    if(action === "post") return postStory(node);
    if(action === "del") return deleteStory(node);
}

function storyCompose(){
    feat.story = {file:null, bg:"blue"};
    openSheet(toolHead("📖 ストーリーを投稿", "24時間後に自動で見えなくなります（同時に10件まで）。") +
        '<textarea id="stBody" rows="3" maxlength="200" placeholder="ひとこと（200文字まで）"></textarea>' +
        '<div class="row" style="justify-content:flex-start">' + Object.keys(STORY_BG).map((key) =>
            '<button type="button" class="st-dot' + (key === "blue" ? " on" : "") + '" data-t="story:bg" data-bg="' + key + '" style="background:' + STORY_BG[key] + '" aria-label="' + STORY_BG_NAMES[key] + '"></button>').join("") + '</div>' +
        '<div class="row" style="justify-content:flex-start;align-items:center"><label class="tool-button">🖼️ 写真を付ける<input class="file-input" id="stFile" type="file" accept="image/*" data-t="story:file"></label><span id="stFileName" class="meta"></span></div>' +
        '<div class="row"><button type="button" class="button-secondary" data-t="story:list">キャンセル</button><button type="button" class="button" data-t="story:post">投稿する</button></div>');
}

async function postStory(button){
    const body = ($("stBody") ? $("stBody").value : "").trim();
    const file = feat.story.file;
    if(!body && !file){ showToast("ひとこと、または写真を入力してください。"); return; }
    if(Array.from(body).length > 200){ showToast("ひとことは200文字以内です。"); return; }
    button.disabled = true;
    const client = requireClient();
    let uploaded = null;
    try{
        if(file){
            const blob = await resizeImage(file, 1080, 0.85);
            uploaded = state.user.id + "/" + crypto.randomUUID() + ".jpg";
            const up = await client.storage.from("post-images").upload(uploaded, blob, {contentType:"image/jpeg", upsert:false});
            if(up.error) throw up.error;
        }
        const result = await client.rpc("create_story", {p_body:body || null, p_image_path:uploaded, p_bg:feat.story.bg});
        if(result.error) throw result.error;
        showToast("ストーリーを投稿しました。");
        await openStory();
    }catch(error){
        if(uploaded) client.storage.from("post-images").remove([uploaded]);
        showToast(featError(error));
        button.disabled = false;
    }
}

async function deleteStory(button){
    if(!confirm("このストーリーを削除しますか？")) return;
    button.disabled = true;
    const client = requireClient();
    try{
        const result = await client.rpc("delete_story", {p_id:button.dataset.id});
        if(result.error) throw result.error;
        if(result.data) client.storage.from("post-images").remove([result.data]);
        await loadStories();
    }catch(error){ showToast(featError(error)); button.disabled = false; }
}
