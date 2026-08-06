import { listConversations, createConversation, getMessages } from "../api/conversations.js";
import { escapeHtml, errorBanner, skeletonLines } from "../dom.js";
import { toast } from "../components/toast.js";

let conversations = [];
let selectedId = null;
let messages = [];

export async function render(root) {
  root.innerHTML = `<div class="view-header"><h1 class="view-title">Conversations</h1></div>${skeletonLines(3)}`;
  conversations = await listConversations();
  draw(root);
}

function draw(root) {
  root.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">Conversations</h1>
      <p class="view-subtitle">Saved history from the "Ask Your Database" chat, when a conversation id was attached.</p>
    </div>

    <div class="card">
      <div id="create-error"></div>
      <form id="create-form" class="form-row" style="align-items:flex-end;">
        <div>
          <label>New conversation title (optional)</label>
          <input type="text" name="title" placeholder="e.g. Q3 sales review" />
        </div>
        <button type="submit" class="btn">Start new</button>
      </form>
    </div>

    ${
      conversations.length === 0
        ? `<div class="empty-state">No conversations yet.</div>`
        : `
      <div class="card">
        <table>
          <tr><th>Title</th><th>Status</th><th></th></tr>
          ${conversations
            .map(
              (c) => `<tr>
            <td>${escapeHtml(c.title || "(untitled)")}</td>
            <td><span class="badge badge-${escapeHtml(c.status)}">${escapeHtml(c.status)}</span></td>
            <td><button class="btn" data-open="${c.id}">View messages</button></td>
          </tr>`
            )
            .join("")}
        </table>
      </div>
    `
    }

    ${selectedId ? messagesCard() : ""}
  `;

  root.querySelector("#create-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = root.querySelector("#create-error");
    errorEl.innerHTML = "";
    const fd = new FormData(e.target);
    try {
      await createConversation({ title: fd.get("title") });
      conversations = await listConversations();
      draw(root);
    } catch (err) {
      errorEl.innerHTML = errorBanner(err);
    }
  });

  root.querySelectorAll("button[data-open]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      selectedId = btn.dataset.open;
      messages = await getMessages(selectedId);
      draw(root);
    });
  });
}

function messagesCard() {
  return `
    <div class="card">
      <div class="hint" style="margin-bottom:10px;">Messages</div>
      ${
        messages.length === 0
          ? `<div class="hint">No messages in this conversation yet.</div>`
          : `<div class="chat-log">${messages
              .map((m) => `<div class="msg ${m.role === "user" ? "msg-user" : "msg-assistant"}">${escapeHtml(m.content)}</div>`)
              .join("")}</div>`
      }
    </div>
  `;
}
