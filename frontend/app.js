const API = "http://localhost:8000";

let sessionId = null;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const messagesEl = document.getElementById("messages");
const chatForm = document.getElementById("chat-form");
const inputEl = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const newChatBtn = document.getElementById("new-chat-btn");

// ── Session management ────────────────────────────────────────────────────────
async function createSession() {
  const res = await fetch(`${API}/session`, { method: "POST" });
  const data = await res.json();
  sessionId = data.session_id;
}

async function resetChat() {
  await createSession();
  messagesEl.innerHTML = "";
}

// ── Message rendering ─────────────────────────────────────────────────────────
function appendMessage(role) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = role === "user" ? "You" : "Assistant";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  wrapper.appendChild(label);
  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  scrollToBottom();
  return { wrapper, bubble };
}

function appendError(message) {
  const el = document.createElement("div");
  el.className = "error-toast";
  el.textContent = `Error: ${message}`;
  messagesEl.appendChild(el);
  scrollToBottom();
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ── SSE streaming via fetch + ReadableStream ──────────────────────────────────
async function streamChat(userMessage) {
  const { wrapper: aiWrapper, bubble: aiBubble } = appendMessage("assistant");
  aiWrapper.classList.add("streaming");

  try {
    const res = await fetch(`${API}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, message: userMessage }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || res.statusText);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newlines
      const parts = buffer.split("\n\n");
      buffer = parts.pop(); // keep the (possibly incomplete) trailing fragment

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;

        const json = line.slice(5).trim();
        let event;
        try {
          event = JSON.parse(json);
        } catch {
          continue;
        }

        if (event.type === "token") {
          aiBubble.textContent += event.content;
          scrollToBottom();
        } else if (event.type === "done") {
          // stream finished cleanly
          break;
        } else if (event.type === "error") {
          throw new Error(event.content);
        }
      }
    }
  } catch (err) {
    aiBubble.textContent = "";
    aiWrapper.remove();
    appendError(err.message);
  } finally {
    aiWrapper.classList.remove("streaming");
  }
}

// ── Input auto-resize ─────────────────────────────────────────────────────────
inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = `${inputEl.scrollHeight}px`;
});

// ── Submit handler ────────────────────────────────────────────────────────────
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (!text || !sessionId) return;

  // Render user message immediately
  const { bubble: userBubble } = appendMessage("user");
  userBubble.textContent = text;

  // Clear & reset input
  inputEl.value = "";
  inputEl.style.height = "auto";

  // Disable controls while streaming
  sendBtn.disabled = true;
  inputEl.disabled = true;

  await streamChat(text);

  sendBtn.disabled = false;
  inputEl.disabled = false;
  inputEl.focus();
});

// Enter to submit, Shift+Enter for newline
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

// ── New chat ──────────────────────────────────────────────────────────────────
newChatBtn.addEventListener("click", resetChat);

// ── Boot ──────────────────────────────────────────────────────────────────────
createSession();
