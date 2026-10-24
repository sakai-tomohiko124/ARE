"use strict";
// ===== ストーリー（24時間で見られる投稿）とアーカイブ =====
// ・いまのストーリー：見られるのは「自分」と「自分がフォローしている人」だけ（サーバー側のルールで制限）。
// ・アーカイブ：24時間がすぎたストーリーは、自動で「自分だけが見られるアーカイブ」に残ります（1年間保存。自分で消すこともできます）。
// ・会話履歴のZIP保存（chat-history.js）には、自分のストーリー（アーカイブ含む）も入ります。

const STORY_BG = {blue:"#2d4fd6", pink:"#d63d8a", green:"#1f9d6b", orange:"#e0802a", purple:"#7b47d6"};
const STORY_BG_NAMES = {blue:"青", pink:"ピンク", green:"緑", orange:"オレンジ", purple:"紫"};
const STORY_COLUMNS = "id,user_id,body,image_path,bg,created_at,expires_at";
const ARCHIVE_PAGE = 30;
feat.story = {file:null, bg:"blue", body:"", archiveFrom:0, archiveTotal:0};

function initStory(){ registerTool("story", onStoryAction); }

function storyTabs(active){
    return '<div class="row" style="justify-content:flex-start"><button type="button" class="' + (active === "now" ? "button" : "button-secondary") + '" data-t="story:list">📖 いまのストーリー</button>' +
        '<button type="button" class="' + (active === "archive" ? "button" : "button-secondary") + '" data-t="story:archive">🗂️ アーカイブ</button></div>';
}

function openStory(){
    openSheet(toolHead("📖 ストーリー", "24時間で見えなくなります。見られるのは、あなたと、あなたがフォローしている人の分だけです。（コツ：マイページのプロフィールを長押し／右クリックしても追加できます）") +
        storyTabs("now") +
        '<div class="row" style="justify-content:flex-start"><button type="button" class="button" data-t="story:new">＋ ストーリーを投稿</button></div>' +
        '<div id="stList" class="st-list"><div class="empty-list">読み込み中...</div></div>' + toolClose());
    return loadStories();
}

async function signStoryImages(rows){
    const paths = rows.map((r) => r.image_path).filter(Boolean).filter((p) => !feat.signed.has(p));
    if(!paths.length) return;
    const signed = await requireClient().storage.from("post-images").createSignedUrls(paths, 3600);
    (signed.data || []).forEach((s) => { if(s.signedUrl) feat.signed.set(s.path, s.signedUrl); });
}

async function loadStories(){
    const box = $("stList");
    if(!box) return;
    const client = requireClient();
    try{
        const result = await client.from("stories").select(STORY_COLUMNS)
            .gt("expires_at", new Date().toISOString()).order("created_at", {ascending:false}).limit(60);
        if(result.error) throw result.error;
        const rows = result.data || [];
        const ids = [...new Set(rows.map((r) => r.user_id))].filter((id) => id !== state.user.id && !feat.known.has(id));
        if(ids.length){
            const profiles = await client.from(TABLES.profiles).select("*").in("id", ids);
            (profiles.data || []).forEach((p) => feat.known.set(p.id, p));
        }
        await signStoryImages(rows);
        if(!$("stList")) return;
        $("stList").innerHTML = rows.length ? rows.map((r) => storyCard(r, false)).join("") : '<div class="empty-list">表示できるストーリーはありません。ユーザーをフォローするか、自分で投稿してみましょう。</div>';
    }catch(error){ if($("stList")) $("stList").innerHTML = '<div class="empty-list">' + escapeHtml(featError(error)) + '</div>'; }
}

function storyDate(value){
    const d = new Date(value);
    return d.getFullYear() + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + String(d.getDate()).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

function storyCard(story, archived){
    const own = story.user_id === state.user.id;
    const name = own ? "あなた" : profileDisplayName(feat.known.get(story.user_id));
    const color = STORY_BG[story.bg] || STORY_BG.blue;
    const imageUrl = story.image_path ? safeHttpUrl(feat.signed.get(story.image_path) || "") : "";
    let foot;
    if(archived){
        foot = '<span>' + escapeHtml(storyDate(story.created_at)) + ' に投稿</span><span class="st-actions"><button type="button" class="button-secondary" data-t="story:repost" data-id="' + escapeHtml(story.id) + '">もう一度投稿</button>' +
            '<button type="button" class="button-secondary" data-t="story:del" data-id="' + escapeHtml(story.id) + '" data-from="archive">削除</button></span>';
    }else{
        const left = Math.max(0, new Date(story.expires_at).getTime() - Date.now());
        const hours = Math.floor(left / 3600000), mins = Math.floor((left % 3600000) / 60000);
        foot = '<span>' + escapeHtml(name) + ' ・ あと' + hours + '時間' + mins + '分</span>' +
            (own ? '<button type="button" class="button-secondary" data-t="story:del" data-id="' + escapeHtml(story.id) + '">削除</button>' : "");
    }
    return '<div class="st-card" style="background:' + color + '" data-sid="' + escapeHtml(story.id) + '">' +
        (imageUrl ? '<img src="' + escapeHtml(imageUrl) + '" alt="ストーリーの写真" loading="lazy">' : "") +
        (story.body ? '<div class="st-body">' + escapeHtml(story.body) + '</div>' : "") +
        '<div class="st-foot">' + foot + '</div></div>';
}

// ----- アーカイブ -----

async function openStoryArchive(){
    feat.story.archiveFrom = 0;
    openSheet(toolHead("🗂️ ストーリーのアーカイブ", "24時間がすぎたあなたのストーリーが、自動でここに残ります。自分だけが見られます（1年間保存）。") +
        storyTabs("archive") + '<div id="stArcCount" class="meta"></div><div id="stList" class="st-list"><div class="empty-list">読み込み中...</div></div><div id="stMore"></div>' + toolClose());
    return loadArchive(true);
}

async function loadArchive(first){
    const client = requireClient();
    try{
        const from = feat.story.archiveFrom;
        const result = await client.from("stories").select(STORY_COLUMNS, {count:"exact"}).eq("user_id", state.user.id)
            .lte("expires_at", new Date().toISOString()).order("created_at", {ascending:false}).range(from, from + ARCHIVE_PAGE - 1);
        if(result.error) throw result.error;
        const rows = result.data || [];
        await signStoryImages(rows);
        const box = $("stList");
        if(!box) return;
        feat.story.archiveTotal = result.count || 0;
        const html = rows.map((r) => storyCard(r, true)).join("");
        if(first) box.innerHTML = html || '<div class="empty-list">アーカイブはまだありません。ストーリーを投稿して24時間たつと、ここに自動で保存されます。</div>';
        else box.insertAdjacentHTML("beforeend", html);
        feat.story.archiveFrom = from + rows.length;
        if($("stArcCount")) $("stArcCount").textContent = "全 " + feat.story.archiveTotal + " 件";
        if($("stMore")) $("stMore").innerHTML = feat.story.archiveFrom < feat.story.archiveTotal ? '<div class="row"><button type="button" class="button-secondary" data-t="story:more">さらに読み込む</button></div>' : "";
    }catch(error){ if($("stList")) $("stList").innerHTML = '<div class="empty-list">' + escapeHtml(featError(error)) + '</div>'; }
}

async function repostStory(button){
    const client = requireClient();
    button.disabled = true;
    let copied = null;
    try{
        const got = await client.from("stories").select(STORY_COLUMNS).eq("id", button.dataset.id).single();
        if(got.error) throw got.error;
        const story = got.data;
        if(story.image_path){
            copied = state.user.id + "/" + crypto.randomUUID() + ".jpg";
            const copy = await client.storage.from("post-images").copy(story.image_path, copied);
            if(copy.error){ copied = null; throw copy.error; }
        }
        const result = await client.rpc("create_story", {p_body:story.body || null, p_image_path:copied, p_bg:story.bg || "blue"});
        if(result.error) throw result.error;
        showToast("ストーリーをもう一度投稿しました。");
        await openStory();
    }catch(error){
        if(copied) client.storage.from("post-images").remove([copied]);
        showToast(featError(error));
        button.disabled = false;
    }
}

// ----- 投稿 -----

function onStoryAction(action, node){
    if(action === "new") return storyCompose(false);
    if(action === "list") return openStory();
    if(action === "archive") return openStoryArchive();
    if(action === "more") return loadArchive(false);
    if(action === "repost") return repostStory(node);
    if(action === "bg"){ feat.story.bg = node.dataset.bg; document.querySelectorAll("[data-t='story:bg']").forEach((b) => b.classList.toggle("on", b === node)); return; }
    if(action === "photo"){
        feat.story.body = $("stBody") ? $("stBody").value : "";
        return openPhotoChooser({multiple:false, allowEdit:false, onFiles:(files) => { feat.story.file = files[0] || null; storyCompose(true); }});
    }
    if(action === "unphoto"){ feat.story.file = null; feat.story.body = $("stBody") ? $("stBody").value : ""; return storyCompose(true); }
    if(action === "post") return postStory(node);
    if(action === "del") return deleteStory(node);
}

function storyCompose(keep){
    if(!keep) feat.story = {file:null, bg:"blue", body:"", archiveFrom:0, archiveTotal:0};
    const s = feat.story;
    openSheet(toolHead("📖 ストーリーを投稿", "24時間たつと見えなくなり、自分のアーカイブに保存されます（同時に10件まで公開できます）。") +
        '<textarea id="stBody" rows="3" maxlength="200" placeholder="ひとこと（200文字まで）">' + escapeHtml(s.body || "") + '</textarea>' +
        '<div class="row" style="justify-content:flex-start">' + Object.keys(STORY_BG).map((key) =>
            '<button type="button" class="st-dot' + (key === s.bg ? " on" : "") + '" data-t="story:bg" data-bg="' + key + '" style="background:' + STORY_BG[key] + '" aria-label="' + STORY_BG_NAMES[key] + '"></button>').join("") + '</div>' +
        '<div class="row" style="justify-content:flex-start;align-items:center"><button type="button" class="tool-button" data-t="story:photo">📷 写真を付ける</button>' +
        (s.file ? '<span class="meta">' + escapeHtml(s.file.name) + '</span><button type="button" class="button-secondary" data-t="story:unphoto">外す</button>' : "") + '</div>' +
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
    const archived = button.dataset.from === "archive";
    if(!confirm(archived ? "このストーリーをアーカイブから完全に削除しますか？（元に戻せません）" : "このストーリーを削除しますか？\n（アーカイブにも残りません）")) return;
    button.disabled = true;
    const client = requireClient();
    try{
        const result = await client.rpc("delete_story", {p_id:button.dataset.id});
        if(result.error) throw result.error;
        if(result.data) client.storage.from("post-images").remove([result.data]);
        const card = button.closest(".st-card");
        if(archived && card){ card.remove(); feat.story.archiveTotal = Math.max(0, feat.story.archiveTotal - 1); feat.story.archiveFrom = Math.max(0, feat.story.archiveFrom - 1); if($("stArcCount")) $("stArcCount").textContent = "全 " + feat.story.archiveTotal + " 件"; }
        else await loadStories();
    }catch(error){ showToast(featError(error)); button.disabled = false; }
}
