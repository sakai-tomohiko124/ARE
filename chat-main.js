"use strict";

// ===== 起動（機能ごとに別々に起動します。1つが壊れても、ほかの機能は動きます） =====

function initPresence(){
    el.myStatus.value = feat.manual;
    el.myStatus.addEventListener("change",() => {
        feat.manual = el.myStatus.value;
        try{ localStorage.setItem("are_manual_status",feat.manual); }catch(_e){ /* 保存できなくても続ける */ }
        sendPresence();
    });
    el.readReceiptToggle.addEventListener("change",async () => {
        const wanted = el.readReceiptToggle.checked;
        try{
            const result = await requireClient().rpc("set_my_read_receipts",{p_enabled:wanted});
            if(result.error) throw result.error;
            showToast(wanted ? "既読を相手に表示します。" : "既読を相手に表示しません。");
        }catch(error){
            el.readReceiptToggle.checked = !wanted;
            showToast(featError(error));
        }
    });
    ["mousemove","keydown","touchstart","click"].forEach((name) => window.addEventListener(name,onActivity,{passive:true}));
    document.addEventListener("visibilitychange",() => { if(!document.hidden){ onActivity(); markRead(); } });
    sendPresence();
    refreshPresence();
    feat.timers.push(setInterval(sendPresence,30000),setInterval(refreshPresence,30000),setInterval(pollRoom,8000));
}

function initMessageTools(){
    el.messages.addEventListener("click",onMessageAction);
    el.scheduleButton.addEventListener("click",toggleSchedule);
    el.scheduleClose.addEventListener("click",() => { el.schedulePanel.hidden = true; });
    el.scheduleSubmit.addEventListener("click",scheduleSend);
    el.scheduleList.addEventListener("click",onScheduleListClick);
}

function initProfile(){
    renderProfileText();
    el.profileEditButton.addEventListener("click",openProfileEditor);
    el.profileModal.addEventListener("click",onSheetClick);
    el.profileModal.addEventListener("change",onSheetChange);
    el.chatTitle.style.cursor = "pointer";
    el.chatTitle.addEventListener("click",() => {
        if(state.currentRoom?.is_group) openGroupInfo();
        else if(state.currentPartner) openProfileView(state.currentPartner);
    });
}

function initPosts(){
    el.postFilter.addEventListener("change",() => loadPosts(true));
    el.postsRefresh.addEventListener("click",() => loadPosts(true));
    el.postMore.addEventListener("click",() => loadPosts(false));
    el.postSubmit.addEventListener("click",submitPost);
    el.postFeed.addEventListener("click",onFeedClick);
    el.postImage.addEventListener("change",() => {
        feat.postImageFile = el.postImage.files[0] || null;
        el.postImageName.textContent = feat.postImageFile ? feat.postImageFile.name : "";
    });
}

function initFollow(){
    el.toggleHiddenUsers.addEventListener("click",() => { state.showHidden = !state.showHidden; loadRecommendations(); });
    loadMyFollowCounts();
}

function initGroups(){
    el.newGroupButton.addEventListener("click",openGroupCreator);
    el.profileModal.addEventListener("click",onGroupAction);
    el.profileModal.addEventListener("input",onPickInput);
    el.profileModal.addEventListener("change",onPickChange);
}

function initHistory(){
    el.exportOldButton.addEventListener("click",() => exportHistory("old"));
    el.exportAllButton.addEventListener("click",() => exportHistory("all"));
    setTimeout(maybePromptExport,4000);
}

function initAccount(){
    loadMySettings();
    el.delRequestButton.addEventListener("click",requestMyDeletion);
    el.delCancelButton.addEventListener("click",cancelMyDeletion);
    loadMyDeletion();
}

function initAdmin(){
    el.profileModal.addEventListener("click",onDelSheet);
    el.adminPanel.addEventListener("click",onAcctDelClick);
    el.adminTabButton.addEventListener("click",() => { el.adminPanel.hidden = false; renderAdmin(); });
    el.adminClose.addEventListener("click",() => { el.adminPanel.hidden = true; });
    el.adminPanel.addEventListener("click",(event) => {
        const view = event.target.closest("[data-admin-view]");
        if(view){ feat.adminView = view.dataset.adminView; renderAdmin(); return; }
        onAdminClick(event);
    });
    checkAdmin();
}

function initAdminUsers(){
    el.profileModal.addEventListener("click",onAdminAction);
    el.adminPanel.addEventListener("click",onBackupClick);
}

function initExtras(){
    if(!window.AREExtras) throw new Error("extras.js が読み込まれていません。");
}

function initCalls(){
    if(!window.AREExtras) throw new Error("extras.js が読み込まれていません。");
    window.AREExtras.onReady();
}

const FEATURES = [
    ["presence","在席状況・既読",initPresence],
    ["messages","メッセージの編集・削除申請・予約送信",initMessageTools],
    ["profile","プロフィール",initProfile],
    ["posts","投稿",initPosts],
    ["follow","フォロー・非表示",initFollow],
    ["groups","グループチャット",initGroups],
    ["history","会話履歴のZIP保存",initHistory],
    ["account","アカウント削除の申請",initAccount],
    ["admin","管理者パネル",initAdmin],
    ["adminUsers","アカウントの作成・編集・バックアップ",initAdminUsers],
    ["extras","チャットボット・天気・交通",initExtras],
    ["calls","通話（試験的）",initCalls]
];

function startFeatures(){
    window.AREHooks = {
        getRoom:() => state.currentRoom,
        getPartner:() => state.currentPartner,
        me:() => ({id:state.user.id,name:profileDisplayName(state.profile)}),
        rooms:() => state.rooms,
        refreshRooms:() => loadRooms(),
        toast:showToast,
        setInCall:(active) => { feat.inCall = active; sendPresence(); }
    };
    FEATURES.forEach((feature) => {
        try{
            feature[2]();
            window.AREFeatures.register(feature[0],feature[1],true);
        }catch(error){
            window.AREFeatures.register(feature[0],feature[1],false,error);
        }
    });
    window.AREFeatures.banner();
}

initialize().catch((error) => {
    console.error("ARE initialization failed:",error);
    window.AREFeatures.notify("アプリの起動に失敗しました。ページを再読み込みしてください。");
});
