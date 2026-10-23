"use strict";

feat.posts = []; feat.postProfiles = new Map(); feat.postImageFile = null; feat.postsLoadedAt = 0;

async function loadPosts(reset){
    const client = requireClient();
    try{
        let query = client.from("posts").select("id,author_id,body,image_path,created_at").order("created_at",{ascending:false}).limit(20);
        if(el.postFilter.value === "following"){
            const mine = await client.from("follows").select("followee_id").eq("follower_id",state.user.id);
            query = query.in("author_id",(mine.data || []).map((row) => row.followee_id).concat(state.user.id));
        }
        if(!reset && feat.posts.length) query = query.lt("created_at",feat.posts[feat.posts.length - 1].created_at);
        const result = await query;
        if(result.error) throw result.error;
        const rows = result.data || [];
        feat.posts = reset ? rows : feat.posts.concat(rows);
        el.postMore.hidden = rows.length < 20;
        const need = [...new Set(rows.map((r) => r.author_id))].filter((id) => !feat.postProfiles.has(id) || reset);
        if(need.length){
            const profiles = await client.from(TABLES.profiles).select("*").in("id",need);
            (profiles.data || []).forEach((p) => feat.postProfiles.set(p.id,p));
        }
        const paths = rows.map((r) => r.image_path).filter(Boolean);
        if(paths.length){
            const signed = await client.storage.from("post-images").createSignedUrls(paths,3600);
            (signed.data || []).forEach((s) => { if(s.signedUrl) feat.signed.set(s.path,s.signedUrl); });
        }
        feat.postsLoadedAt = Date.now();
        renderPosts();
    }catch(error){ el.postFeed.innerHTML = '<div class="empty-list">' + escapeHtml(featError(error)) + '</div>'; }
}

feat.signed = new Map();

function renderPosts(){
    if(!feat.posts.length){ el.postFeed.innerHTML = '<div class="empty-list">まだ投稿がありません。最初の投稿をしてみましょう。</div>'; return; }
    el.postFeed.innerHTML = feat.posts.map((post) => {
        const author = feat.postProfiles.get(post.author_id) || {};
        const own = post.author_id === state.user.id;
        const img = post.image_path ? safeHttpUrl(feat.signed.get(post.image_path) || "") : "";
        return '<article class="post"><div class="post-head">' + miniAvatar(author) +
            '<div><button class="post-name" type="button" data-author="' + escapeHtml(post.author_id) + '">' + escapeHtml(profileDisplayName(author)) + '</button><div class="post-time">' + escapeHtml(formatDate(post.created_at)) + '</div></div></div>' +
            (post.body ? '<div class="post-body">' + escapeHtml(post.body) + '</div>' : '') +
            (img ? '<a href="' + escapeHtml(img) + '" target="_blank" rel="noopener noreferrer"><img class="post-img" src="' + escapeHtml(img) + '" alt="投稿画像" loading="lazy"></a>' : '') +
            '<div class="post-actions">' + (own ? '<button type="button" data-postdel="' + escapeHtml(post.id) + '">削除</button>' : (feat.isAdmin ? '<button type="button" data-postadmin="' + escapeHtml(post.id) + '">管理者として削除</button>' : '')) + '</div></article>';
    }).join("");
}

async function submitPost(){
    const body = el.postBody.value;
    if(!body.trim() && !feat.postImageFile){ showToast("投稿の内容か写真を入力してください。"); return; }
    if(Array.from(body).length > 500){ showToast("投稿は500文字以内で入力してください。"); return; }
    el.postSubmit.disabled = true;
    const client = requireClient();
    let uploaded = null;
    try{
        if(feat.postImageFile){
            const blob = await resizeImage(feat.postImageFile,1280,0.85);
            uploaded = state.user.id + "/" + crypto.randomUUID() + ".jpg";
            const up = await client.storage.from("post-images").upload(uploaded,blob,{contentType:"image/jpeg",upsert:false});
            if(up.error) throw up.error;
        }
        const result = await client.rpc("create_post",{p_body:body,p_image_path:uploaded});
        if(result.error) throw result.error;
        el.postBody.value = ""; el.postImage.value = ""; feat.postImageFile = null; el.postImageName.textContent = "";
        showToast("投稿しました。");
        await loadPosts(true);
    }catch(error){
        if(uploaded) client.storage.from("post-images").remove([uploaded]);
        showToast(featError(error));
    }finally{ el.postSubmit.disabled = false; }
}

async function onFeedClick(event){
    const author = event.target.closest("[data-author]");
    if(author){ openProfileView(feat.postProfiles.get(author.dataset.author)); return; }
    const del = event.target.closest("[data-postdel]");
    const adm = event.target.closest("[data-postadmin]");
    try{
        if(del){
            if(!window.confirm("この投稿を削除しますか？")) return;
            const result = await requireClient().rpc("delete_my_post",{p_post_id:del.dataset.postdel});
            if(result.error) throw result.error;
            if(result.data) requireClient().storage.from("post-images").remove([result.data]);
            await loadPosts(true);
        }else if(adm){
            const reason = window.prompt("管理者として投稿を削除します。理由を入力してください（記録されます）。","");
            if(reason === null) return;
            const result = await requireClient().rpc("admin_delete_post",{p_post_id:adm.dataset.postadmin,p_reason:reason});
            if(result.error) throw result.error;
            await loadPosts(true);
        }
    }catch(error){ showToast(featError(error)); }
}
