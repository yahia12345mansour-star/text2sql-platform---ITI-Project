import { listConnections } from "../api/connections.js";
import { askDatabase } from "../api/chat.js";
import { escapeHtml, errorBanner, skeletonLines } from "../dom.js";
import { renderDataGrid } from "../components/dataGrid.js";
import { toast } from "../components/toast.js";

let connections = [];
let selectedConnectionId = null;
let log = []; // { role, content, receipt? }
let asking = false;
const grids = new Map(); // log index -> dataGrid instance

export async function render(root) {
  root.innerHTML = `<div class="view-header"><h1 class="view-title">Ask Your Database</h1></div>${skeletonLines(3)}`;
  connections = await listConnections();
  if (!selectedConnectionId && connections.length) selectedConnectionId = connections[0].id;
  draw(root);
}

function draw(root) {
  root.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">Ask Your Database</h1>
      <p class="view-subtitle">Ask a question in plain English. Every answer shows the exact SQL that produced it.</p>
    </div>

    ${
      connections.length === 0
        ? `<div class="empty-state"><div class="empty-icon">⛁</div>Add a database connection first, then sync its schema.</div>`
        : `
      <div class="card">
        <label>Connection</label>
        <select id="conn-select">
          ${connections.map((c) => `<option value="${c.id}" ${c.id === selectedConnectionId ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}
        </select>
      </div>

      <div class="chat-log" id="chat-log">${renderLog()}</div>
      <div id="chat-error"></div>
      <form id="chat-form" class="chat-input-row">
        <input type="text" name="question" placeholder="e.g. What's the average salary in Engineering?" required autocomplete="off" ${asking ? "disabled" : ""} />
        <button type="submit" class="btn btn-sql" ${asking ? "disabled" : ""}>${asking ? '<span class="spinner"></span> Thinking' : "Ask"}</button>
      </form>
    `
    }
  `;

  mountGrids(root);

  const connSelect = root.querySelector("#conn-select");
  if (connSelect) connSelect.addEventListener("change", (e) => (selectedConnectionId = e.target.value));

  const form = root.querySelector("#chat-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await ask(root, fd.get("question"));
    });
  }

  wireMsgActions(root);
}

async function ask(root, question) {
  const errorEl = root.querySelector("#chat-error");
  errorEl.innerHTML = "";
  log.push({ role: "user", content: question });
  asking = true;
  draw(root);

  try {
    const result = await askDatabase({ connectionId: selectedConnectionId, question });
    log.push({ role: "assistant", content: result.answer, receipt: result });
  } catch (err) {
    root.querySelector("#chat-error")?.remove();
    log.pop();
    toast(err.message, "error");
  }
  asking = false;
  draw(root);
  root.querySelector("#chat-form input")?.focus();
}

function wireMsgActions(root) {
  root.querySelectorAll("[data-copy-sql]").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(btn.dataset.copySql);
      toast("SQL copied", "success");
    });
  });
  root.querySelectorAll("[data-retry]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = btn.dataset.retry;
      log = log.slice(0, Number(btn.dataset.index));
      ask(root, q);
    });
  });
}

function mountGrids(root) {
  grids.forEach((grid, idx) => {
    const container = root.querySelector(`[data-grid-slot="${idx}"]`);
    if (container) grid.mount(container);
  });
}

function renderLog() {
  if (log.length === 0) {
    return `<div class="empty-state"><div class="empty-icon">⌗</div>No questions yet — ask something about your data below.</div>`;
  }
  return log
    .map((m, i) => {
      if (m.role === "user") {
        return `<div class="msg msg-user">${escapeHtml(m.content)}</div>`;
      }
      const r = m.receipt;
      if (!grids.has(i) && r.rows?.length) {
        grids.set(i, renderDataGrid(r.columns, r.rows));
      }
      return `
        <div class="msg msg-assistant">
          ${escapeHtml(m.content)}
          <div class="receipt" data-accent="sql" style="--dot: var(--accent-sql);">
            <div class="receipt-label">
              <span>Generated SQL</span>
              <button type="button" class="msg-action-btn" data-copy-sql="${escapeHtml(r.sql)}">⧉ copy</button>
            </div>
            <div class="receipt-sql">${escapeHtml(r.sql)}</div>
            <div class="receipt-meta">${r.row_count} row(s) · columns: ${r.columns.map(escapeHtml).join(", ")}</div>
          </div>
          ${r.rows?.length ? `<div style="margin-top:10px;" data-grid-slot="${i}">${grids.get(i).html()}</div>` : ""}
          <div class="msg-actions">
            <button type="button" class="msg-action-btn" data-retry="${escapeHtml(log[i - 1]?.content || "")}" data-index="${i - 1}">↻ retry</button>
          </div>
        </div>
      `;
    })
    .join("");
}
