"use strict";
// ===== 絵文字・スタンプ（標準の絵文字だけを使うので無料・著作権の心配なし） =====

const EMOJI_LIST = ["😀","😂","🤣","😊","😍","😘","😎","🤔","😅","😭","😡","😴","🥳","😇","🙃","😉","👍","👎","👏","🙏","💪","👋","🤝","✌️","❤️","💔","🔥","✨","🎉","🎂","🍻","☕","🍜","🍙","🌸","🌈","☀️","🌙","⭐","🐶","🐱","🚗","🚃","📞","💡","✅","❌","❓"];
const STAMP_LIST = ["👍","🙏","🎉","❤️","😂","😭","😡","🤔","👏","💪","🍻","✨"];

function initStamps(){
    const panel = document.createElement("div");
    panel.id = "emojiPanel";
    panel.className = "emoji-panel";
    panel.hidden = true;
    panel.innerHTML = '<div class="emoji-tabs"><button type="button" class="button-secondary" data-ep="emoji">絵文字（入力欄に入れる）</button><button type="button" class="button-secondary" data-ep="stamp">スタンプ（すぐ送る）</button><button type="button" class="button-secondary" data-ep="close">閉じる</button></div>' +
        '<div class="emoji-grid" id="emojiGrid"></div>';
    document.querySelector(".composer .composer-bottom").insertAdjacentElement("beforebegin",panel);
    feat.emojiMode = "emoji";
    paintEmojiGrid();
    panel.addEventListener("click",onEmojiClick);
    document.getElementById("emojiButton").addEventListener("click",() => { panel.hidden = !panel.hidden; });
}

function paintEmojiGrid(){
    const grid = document.getElementById("emojiGrid");
    const list = feat.emojiMode === "stamp" ? STAMP_LIST : EMOJI_LIST;
    grid.className = "emoji-grid" + (feat.emojiMode === "stamp" ? " stamps" : "");
    grid.innerHTML = list.map((emoji) => '<button type="button" class="emoji-btn" data-emoji="' + escapeHtml(emoji) + '">' + escapeHtml(emoji) + '</button>').join("");
}

async function onEmojiClick(event){
    const mode = event.target.closest("[data-ep]");
    if(mode){
        if(mode.dataset.ep === "close"){ document.getElementById("emojiPanel").hidden = true; return; }
        feat.emojiMode = mode.dataset.ep; paintEmojiGrid(); return;
    }
    const pick = event.target.closest("[data-emoji]");
    if(!pick) return;
    if(feat.emojiMode === "stamp"){
        if(!state.currentRoom){ showToast("先にチャット相手を選択してください。"); return; }
        await sendMessagePayload({type:"text",text:pick.dataset.emoji,stamp:true},{keepInput:true});
        return;
    }
    const box = el.messageInput;
    if(box.disabled){ showToast("先にチャット相手を選択してください。"); return; }
    const start = box.selectionStart ?? box.value.length, end = box.selectionEnd ?? start;
    const next = box.value.slice(0,start) + pick.dataset.emoji + box.value.slice(end);
    if(Array.from(next).length > MAX_TEXT_LENGTH){ showToast("メッセージは2,000文字以内で入力してください。"); return; }
    box.value = next;
    const pos = start + pick.dataset.emoji.length;
    box.setSelectionRange(pos,pos);
    updateCharCount();
    box.focus();
}
