"use strict";

function statusLine(profile){
    return profile?.status_message ? '<small class="status-msg">' + escapeHtml(profile.status_message) + '</small>' : '';
}

function miniAvatar(profile){
    const url = safeHttpUrl(profile?.avatar_url || "");
    return '<span class="post-avatar">' + (url ? '<img src="' + escapeHtml(url) + '" alt="">' : escapeHtml(shortName(profileDisplayName(profile)))) + '</span>';
}

function renderProfileText(){
    const p = state.profile || {};
    el.profileText.innerHTML = '<div class="sm">' + (p.status_message ? escapeHtml(p.status_message) : '<span class="meta">ステータスメッセージ未設定</span>') + '</div>' +
        (p.bio ? '<div class="bio">' + escapeHtml(p.bio) + '</div>' : '') + '<div class="meta" id="myFollowCounts"></div>';
    el.myName.textContent = profileDisplayName(p);
    setAvatar(el.myAvatar,p);
}

function resizeImage(file,maxSide,quality){
    return new Promise((resolve,reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            const scale = Math.min(1,maxSide / Math.max(img.width,img.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1,Math.round(img.width * scale)); canvas.height = Math.max(1,Math.round(img.height * scale));
            canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
            canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("画像を変換できませんでした。")),"image/jpeg",quality);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("この画像は読み込めません。JPEG・PNG・WebP・GIFを選んでください。")); };
        img.src = url;
    });
}

function openSheet(html){ el.profileSheet.innerHTML = html; el.profileModal.hidden = false; }

function closeSheet(){ el.profileModal.hidden = true; el.profileSheet.innerHTML = ""; feat.avatarBlob = null; }

function bigAvatar(profile){
    const url = safeHttpUrl(profile?.avatar_url || "");
    return '<div class="big-avatar" id="pmPreview">' + (url ? '<img src="' + escapeHtml(url) + '" alt="">' : escapeHtml(shortName(profileDisplayName(profile)))) + '</div>';
}

function openProfileEditor(){
    const p = state.profile || {};
    feat.avatarBlob = null;
    openSheet(bigAvatar(p) + '<div class="row" style="justify-content:center"><label class="button-secondary" style="cursor:pointer;padding:8px 14px;border-radius:10px;color:var(--text)">写真を変更<input id="pmAvatar" class="file-input" type="file" accept="image/*"></label></div>' +
        '<label for="pmName">表示名（30文字まで）</label><input id="pmName" type="text" maxlength="30" value="' + escapeHtml(p.display_name || "") + '">' +
        '<label for="pmStatus">ステータスメッセージ（60文字まで）</label><input id="pmStatus" type="text" maxlength="60" value="' + escapeHtml(p.status_message || "") + '" placeholder="例：勉強中📚">' +
        '<label for="pmBio">自己紹介（150文字まで）</label><textarea id="pmBio" rows="3" maxlength="150">' + escapeHtml(p.bio || "") + '</textarea>' +
        '<div class="row"><button type="button" class="button-secondary" data-pm="close">キャンセル</button><button type="button" class="button" data-pm="save">保存</button></div>');
}

function openProfileView(profile){
    if(!profile) return;
    openSheet(bigAvatar(profile) + '<h3 style="margin:0;text-align:center">' + escapeHtml(profileDisplayName(profile)) + '</h3>' +
        '<div style="text-align:center">' + presenceHtml(profile) + '</div>' +
        (profile.status_message ? '<div style="text-align:center;font-weight:700">' + escapeHtml(profile.status_message) + '</div>' : '') +
        (profile.bio ? '<div style="white-space:pre-wrap;overflow-wrap:anywhere;color:var(--muted)">' + escapeHtml(profile.bio) + '</div>' : '') +
        '<div id="pmFollow" style="text-align:center"></div><div class="row"><button type="button" class="button-secondary" data-pm="close">閉じる</button></div>');
    loadFollow(profile.id);
}

async function saveProfile(button){
    const name = document.getElementById("pmName").value.trim();
    if(!name){ showToast("表示名を入力してください。"); return; }
    const client = requireClient();
    button.disabled = true;
    try{
        let avatarUrl = null, uploaded = null;
        if(feat.avatarBlob){
            uploaded = state.user.id + "/" + crypto.randomUUID() + ".jpg";
            const up = await client.storage.from("avatars").upload(uploaded,feat.avatarBlob,{contentType:"image/jpeg",upsert:false});
            if(up.error) throw up.error;
            avatarUrl = client.storage.from("avatars").getPublicUrl(uploaded).data.publicUrl;
        }
        const result = await client.rpc("update_my_profile",{
            p_display_name:name,p_bio:document.getElementById("pmBio").value,p_status_message:document.getElementById("pmStatus").value,
            p_avatar_url:avatarUrl,p_clear_avatar:false});
        if(result.error){ if(uploaded) client.storage.from("avatars").remove([uploaded]); throw result.error; }
        const old = state.profile?.avatar_url;
        const fresh = await client.from(TABLES.profiles).select("*").eq("id",state.user.id).maybeSingle();
        if(!fresh.error && fresh.data) state.profile = fresh.data;
        if(avatarUrl && old && old.includes("/avatars/")){ client.storage.from("avatars").remove([decodeURIComponent(old.split("/avatars/")[1])]); }
        renderProfileText(); closeSheet(); showToast("プロフィールを更新しました。");
    }catch(error){ button.disabled = false; showToast(featError(error)); }
}

async function onSheetClick(event){
    const copy = event.target.closest("[data-copycode]");
    if(copy){ try{ await navigator.clipboard.writeText(copy.dataset.copycode); showToast("コピーしました。"); }catch(_e){ showToast("手動で選択してコピーしてください。"); } return; }
    if(event.target === el.profileModal){ closeSheet(); return; }
    const button = event.target.closest("[data-pm]");
    if(!button) return;
    if(button.dataset.pm === "close") closeSheet();
    else if(button.dataset.pm === "save") await saveProfile(button);
    else if(button.dataset.pm === "follow") await toggleFollow(button);
}

async function onSheetChange(event){
    if(event.target.id !== "pmAvatar" || !event.target.files[0]) return;
    try{
        feat.avatarBlob = await resizeImage(event.target.files[0],384,0.88);
        document.getElementById("pmPreview").innerHTML = '<img src="' + URL.createObjectURL(feat.avatarBlob) + '" alt="">';
    }catch(error){ feat.avatarBlob = null; showToast(error.message); }
    event.target.value = "";
}
