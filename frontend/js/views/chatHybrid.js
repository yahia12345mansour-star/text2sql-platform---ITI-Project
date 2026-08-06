import { listConnections } from "../api/connections.js";
import { listKnowledgeBases } from "../api/documents.js";
import { askHybrid } from "../api/hybrid.js";
import { escapeHtml, errorBanner, skeletonLines } from "../dom.js";
import { renderMarkdown, highlightCodeBlocks } from "../components/markdown.js";
import { toast } from "../components/toast.js";

let connections = [];
let kbs = [];
let selectedConnectionId = null;
let selectedKbId = null;
let log = [];

export async function render(root) {
  root.innerHTML = `<div class="view-header"><h1 class="view-title">Hybrid Ask</h1></div>${skeletonLines(3)}`;
  [connections, kbs] = await Promise.all([listConnections(), listKnowledgeBases()]);
  if (!selectedConnectionId && connections.length) selectedConnectionId = connections[0].id;
  if (!selectedKbId && kbs.length) selectedKbId = kbs[0].id;
  draw(root);
}

function draw(root) {
  const ready = connections.length > 0 && kbs.length > 0;
  root.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">Hybrid Ask</h1>
      <p class="view-subtitle">Combines a database query and document search in one answer — good for questions that span both.</p>
    </div>

    ${
      !ready
        ? `<div class="empty-state">You need at least one database connection and one knowledge base to use hybrid chat.</div>`
        : `
      <div class="card">
        <div class="form-row">
          <div>
            <label>Connection</label>
            <select id="conn-select">${connections.map((c) => `<option value="${c.id}" ${c.id === selectedConnectionId ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}</select>
          </div>
          <div>
            <label>Knowledge base</label>
            <select id="kb-select">${kbs.map((k) => `<option value="${k.id}" ${k.id === selectedKbId ? "selected" : ""}>${escapeHtml(k.name)}</option>`).join("")}</select>
          </div>
        </div>
      </div>

      <div class="chat-log" id="chat-log">${renderLog()}</div>
      <div id="chat-error"></div>
      <form id="chat-form" class="chat-input-row">
        <input type="text" name="question" placeholder="Ask something that might need both sources…" required autocomplete="off" />
        <button type="submit" class="btn btn-hybrid">Ask</button>
      </form>
    `
    }
  `;

  const connSelect = root.querySelector("#conn-select");
  highlightCodeBlocks(root);
  if (connSelect) connSelect.addEventListener("change", (e) => (selectedConnectionId = e.target.value));
  const kbSelect = root.querySelector("#kb-select");
  if (kbSelect) kbSelect.addEventListener("change", (e) => (selectedKbId = e.target.value));

  const form = root.querySelector("#chat-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const question = fd.get("question");
      const errorEl = root.querySelector("#chat-error");
      errorEl.innerHTML = "";
      log.push({ role: "user", content: question });
      draw(root);
      try {
        const result = await askHybrid({ connectionId: selectedConnectionId, knowledgeBaseId: selectedKbId, question });
        log.push({ role: "assistant", content: result.answer, sql: result.sql, sqlRowCount: result.sql_row_count, citations: result.document_citations });
      } catch (err) {
        log.pop();
        toast(err.message, "error");
      }
      draw(root);
      root.querySelector("#chat-form input")?.focus();
    });
  }
}

function renderLog() {
  if (log.length === 0) return `<div class="empty-state">Ask a question that might draw on both your database and your documents.</div>`;
  return log
    .map((m) => {
      if (m.role === "user") return `<div class="msg msg-user">${escapeHtml(m.content)}</div>`;
      return `
        <div class="msg msg-assistant">
          ${escapeHtml(m.content)}
          ${
            m.sql
              ? `<div class="receipt" style="--dot: var(--accent-hybrid);">
                  <div class="receipt-label">Database evidence used</div>
                  <div class="receipt-sql">${escapeHtml(m.sql)}</div>
                  <div class="receipt-meta">${m.sqlRowCount} row(s)</div>
                </div>`
              : `<div class="hint" style="margin-top:8px;">No usable database evidence for this question — answered from documents only.</div>`
          }
          <div>${(m.citations || []).map((c) => `<span class="citation-chip">chunk #${c.chunk_index} · score ${c.score.toFixed(2)}</span>`).join("")}</div>
        </div>
      `;
    })
    .join("");
}
