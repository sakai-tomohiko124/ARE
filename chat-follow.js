"use strict";

// ===== ユーザーの非表示 / フォロー =====
state.hiddenIds = new Set();
state.showHidden = false;

async function toggleHideUser(id,hide){
    try{
        const client = requireClient();
        const result = hide
            ? await client.from("hidden_recommendations").insert({user_id:state.user.id,hidden_user_id:id})
            : await client.from("hidden_recommendations").delete().eq("user_id",state.user.id).eq("hidden_user_id",id);
        if(result.error) throw result.error;
        if(hide) state.hiddenIds.add(id); else state.hiddenIds.delete(id);
        renderRecommendations();
        showToast(hide ? "検索結果に表示しないようにしました。" : "再表示しました。");
    }catch(error){ showToast(featError(error)); }
}

async function followCounts(uid){
    const client = requireClient();
    const [followers,following] = await Promise.all([
        client.from("follows").select("*",{count:"exact",head:true}).eq("followee_id",uid),
        client.from("follows").select("*",{count:"exact",head:true}).eq("follower_id",uid)]);
    if(followers.error) throw followers.error;
    return {followers:followers.count || 0,following:following.count || 0};
}

async function loadMyFollowCounts(){
    try{
        const counts = await followCounts(state.user.id);
        const box = document.getElementById("myFollowCounts");
        if(box) box.textContent = "フォロワー " + counts.followers + " ・ フォロー中 " + counts.following;
    }catch(_e){ /* 数が出せなくても他の機能は続ける */ }
}

async function loadFollow(uid){
    const box = document.getElementById("pmFollow");
    if(!box || uid === state.user.id) return;
    try{
        const counts = await followCounts(uid);
        const mine = await requireClient().from("follows").select("followee_id").eq("follower_id",state.user.id).eq("followee_id",uid).maybeSingle();
        if(document.getElementById("pmFollow") !== box) return;
        const following = !!mine.data;
        box.innerHTML = '<div class="meta">フォロワー ' + counts.followers + ' ・ フォロー中 ' + counts.following + '</div>' +
            '<button type="button" class="' + (following ? 'button-secondary' : 'button') + '" data-pm="follow" data-uid="' + escapeHtml(uid) + '" data-following="' + (following ? '1' : '0') + '" style="margin-top:6px">' + (following ? 'フォロー中（解除する）' : 'フォローする') + '</button>';
    }catch(error){
        if(document.getElementById("pmFollow") === box) box.innerHTML = '<div class="meta">' + escapeHtml(featError(error)) + '</div>';
    }
}

async function toggleFollow(button){
    const uid = button.dataset.uid, following = button.dataset.following === "1";
    button.disabled = true;
    try{
        const client = requireClient();
        const result = following
            ? await client.from("follows").delete().eq("follower_id",state.user.id).eq("followee_id",uid)
            : await client.from("follows").insert({follower_id:state.user.id,followee_id:uid});
        if(result.error) throw result.error;
        await loadFollow(uid);
    }catch(error){ button.disabled = false; showToast(featError(error)); }
}
