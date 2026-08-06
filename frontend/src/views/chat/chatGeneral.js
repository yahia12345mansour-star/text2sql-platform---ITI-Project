import { generalChat, streamChat } from "../../api/chat.js";
import { escapeHtml, errorBanner } from "../../core/dom.js";
import { renderMarkdown, highlightCodeBlocks } from "../../components/markdown.js";
import { toast } from "../../components/toast.js";

let log = [];
let streaming = true;
let sending = false;
let abortController = null;

export function render(root) {
  draw(root);
}

function draw(root) {
  root.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">General Chat</h1>
      <p class="view-subtitle">No database, no documents — just a normal conversation.</p>
    </div>

    <label style="display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--text-muted); margin-bottom:14px;">
      <input type="checkbox" id="stream-toggle" ${streaming ? "checked" : ""} style="width:auto;" />
      Stream the response token by token
    </label>

    <div class="chat-log" id="chat-log">${renderLog()}</div>
    <div id="chat-error"></div>
    <form id="chat-form" class="chat-input-row">
      <input type="text" name="message" placeholder="Say something…" required autocomplete="off" ${sending ? "disabled" : ""} />
      ${
        sending && streaming
          ? `<button type="button" class="btn btn-danger-ghost" id="stop-btn">■ Stop</button>`
          : `<button type="submit" class="btn btn-general" ${sending ? "disabled" : ""}>${sending ? '<span class="spinner"></span>' : "Send"}</button>`
      }
    </form>
  `;

  highlightCodeBlocks(root);

  root.querySelector("#stream-toggle").addEventListener("change", (e) => (streaming = e.target.checked));

  const stopBtn = root.querySelector("#stop-btn");
  if (stopBtn) stopBtn.addEventListener("click", () => abortController?.abort());

  root.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(btn.dataset.copy);
      toast("Copied", "success");
    });
  });

  root.querySelector("#chat-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await send(root, fd.get("message"));
  });
}

async function send(root, message) {
  const errorEl = root.querySelector("#chat-error");
  errorEl.innerHTML = "";
  log.push({ role: "user", content: message });
  sending = true;

  if (streaming) {
    log.push({ role: "assistant", content: "", streaming: true });
    draw(root);
    const assistantIndex = log.length - 1;
    abortController = new AbortController();
    try {
      await streamChat(
        { message },
        (token) => {
          log[assistantIndex].content += token;
          const logEl = root.querySelector("#chat-log");
          if (logEl) { logEl.innerHTML = renderLog(); highlightCodeBlocks(logEl); }
        },
        () => {},
        abortController.signal
      );
    } catch (err) {
      if (err.name !== "AbortError") toast(err.message, "error");
    }
    log[assistantIndex].streaming = false;
  } else {
    draw(root);
    try {
      const result = await generalChat({ message });
      log.push({ role: "assistant", content: result.reply });
    } catch (err) {
      toast(err.message, "error");
      log.pop();
    }
  }
  sending = false;
  draw(root);
  root.querySelector("#chat-form input")?.focus();
}

function renderLog() {
  if (log.length === 0) {
    return `<div class="empty-state"><div class="empty-icon">◇</div>Say hello.</div>`;
  }
  return log
    .map((m) => {
      if (m.role === "user") return `<div class="msg msg-user">${escapeHtml(m.content)}</div>`;
      const body = m.content
        ? renderMarkdown(m.content)
        : `<span class="typing-dots"><span></span><span></span><span></span></span>`;
      return `
        <div class="msg msg-assistant">
          ${body}
          ${
            !m.streaming && m.content
              ? `<div class="msg-actions"><button type="button" class="msg-action-btn" data-copy="${escapeHtml(m.content)}">⧉ copy</button></div>`
              : ""
          }
        </div>
      `;
    })
    .join("");
}
