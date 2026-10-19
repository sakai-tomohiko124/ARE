(() => {
  "use strict";

  const STORAGE_KEYS = {
    messages: "simpleChat.messages.v1",
    userName: "simpleChat.userName.v1"
  };

  const elements = {
    userName: document.getElementById("userName"),
    saveNameButton: document.getElementById("saveNameButton"),
    messageForm: document.getElementById("messageForm"),
    messageInput: document.getElementById("messageInput"),
    messageList: document.getElementById("messageList"),
    emptyState: document.getElementById("emptyState"),
    messageCount: document.getElementById("messageCount"),
    charCount: document.getElementById("charCount"),
    sendButton: document.getElementById("sendButton"),
    clearButton: document.getElementById("clearButton"),
    toast: document.getElementById("toast")
  };

  let messages = loadMessages();
  let toastTimer = null;

  function loadMessages() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.messages);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.filter(isValidMessage) : [];
    } catch (error) {
      console.warn("メッセージ履歴を読み込めませんでした。", error);
      return [];
    }
  }

  function isValidMessage(message) {
    return message && typeof message.id === "string" &&
      typeof message.name === "string" && typeof message.text === "string" &&
      typeof message.createdAt === "string";
  }

  function saveMessages() {
    try {
      localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages));
      return true;
    } catch (error) {
      showToast("保存できませんでした。ブラウザーの保存容量を確認してください。");
      console.error("メッセージ履歴を保存できませんでした。", error);
      return false;
    }
  }

  function getUserName() {
    return elements.userName.value.trim().slice(0, 24) || "ゲスト";
  }

  function loadUserName() {
    try {
      elements.userName.value = localStorage.getItem(STORAGE_KEYS.userName) || "";
    } catch (error) {
      console.warn("ユーザー名を読み込めませんでした。", error);
    }
  }

  function saveUserName() {
    const name = getUserName();
    elements.userName.value = name === "ゲスト" ? "" : name;
    try {
      localStorage.setItem(STORAGE_KEYS.userName, name);
      showToast(`名前を「${name}」に設定しました`);
    } catch (error) {
      showToast("名前を保存できませんでした");
    }
    renderMessages();
  }

  function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function createMessageElement(message) {
    const isOwn = message.name === getUserName();
    const article = document.createElement("article");
    article.className = `message${isOwn ? " own" : ""}`;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = Array.from(message.name)[0] || "G";

    const content = document.createElement("div");
    content.className = "message-content";

    const meta = document.createElement("div");
    meta.className = "message-meta";

    const name = document.createElement("span");
    name.className = "message-name";
    name.textContent = message.name;

    const time = document.createElement("time");
    time.className = "message-time";
    time.dateTime = message.createdAt;
    time.textContent = formatTime(message.createdAt);

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = message.text;

    meta.append(name, time);
    content.append(meta, bubble);
    article.append(avatar, content);
    return article;
  }

  function renderMessages() {
    elements.messageList.replaceChildren();
    if (messages.length === 0) {
      elements.messageList.append(elements.emptyState);
      elements.emptyState.hidden = false;
    } else {
      elements.emptyState.hidden = true;
      messages.forEach((message) => elements.messageList.append(createMessageElement(message)));
    }
    elements.messageCount.textContent = `${messages.length}件のメッセージ`;
    elements.messageList.scrollTop = elements.messageList.scrollHeight;
  }

  function updateComposer() {
    const length = elements.messageInput.value.length;
    elements.charCount.textContent = `${length} / 500`;
    elements.sendButton.disabled = elements.messageInput.value.trim().length === 0;
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 2400);
  }

  function sendMessage() {
    const text = elements.messageInput.value.trim();
    if (!text) return;

    const message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: getUserName(),
      text: text.slice(0, 500),
      createdAt: new Date().toISOString()
    };

    messages.push(message);
    if (!saveMessages()) {
      messages.pop();
      return;
    }
    elements.messageInput.value = "";
    updateComposer();
    renderMessages();
    elements.messageInput.focus();
  }

  function clearMessages() {
    if (messages.length === 0) {
      showToast("消去するメッセージはありません");
      return;
    }
    if (!window.confirm("このブラウザーに保存されたメッセージをすべて削除します。よろしいですか？")) return;
    const previousMessages = messages;
    messages = [];
    if (!saveMessages()) {
      messages = previousMessages;
      return;
    }
    renderMessages();
    showToast("メッセージ履歴を消去しました");
  }

  elements.saveNameButton.addEventListener("click", saveUserName);
  elements.userName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveUserName();
    }
  });
  elements.messageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage();
  });
  elements.messageInput.addEventListener("input", updateComposer);
  elements.messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
  elements.clearButton.addEventListener("click", clearMessages);

  loadUserName();
  updateComposer();
  renderMessages();
})();
