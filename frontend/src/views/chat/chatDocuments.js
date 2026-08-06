import { listKnowledgeBases, createKnowledgeBase, askDocuments } from "../../api/documents.js";
import { uploadFileWithProgress } from "../../components/upload.js";
import { escapeHtml, errorBanner, skeletonLines } from "../../core/dom.js";
import { renderMarkdown, highlightCodeBlocks } from "../../components/markdown.js";
import { toast } from "../../components/toast.js";

const ACCEPTED = [".pdf", ".txt", ".md", ".csv"];

let kbs = [];
let selectedKbId = null;
let log = [];
let uploads = []; // { name, progress, status, error }
let asking = false;

export async function render(root) {
  root.innerHTML = `<div class="view-header"><h1 class="view-title">Ask Your Documents</h1></div>${skeletonLines(3)}`;
  kbs = await listKnowledgeBases();
  if (!selectedKbId && kbs.length) selectedKbId = kbs[0].id;
  draw(root);
}

function draw(root) {
  root.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">Ask Your Documents</h1>
      <p class="view-subtitle">Upload files into a knowledge base, then ask questions answered only from their contents.</p>
    </div>

    <div class="card">
      <label>Knowledge base</label>
      <div class="form-row">
        <select id="kb-select">
          ${kbs.length === 0 ? `<option>No knowledge bases yet</option>` : kbs.map((k) => `<option value="${k.id}" ${k.id === selectedKbId ? "selected" : ""}>${escapeHtml(k.name)}</option>`).join("")}
        </select>
      </div>
      <hr class="section-divider" />
      <div id="kb-create-error"></div>
      <form id="kb-create-form" class="form-row" style="align-items:flex-end;">
        <div>
          <label>New knowledge base name</label>
          <input type="text" name="name" placeholder="e.g. Product Docs" required />
        </div>
        <button type="submit" class="btn">Create</button>
      </form>

      ${
        selectedKbId
          ? `
        <hr class="section-divider" />
        <label>Upload documents</label>
        <div class="dropzone" id="dropzone">
          Drag & drop files here, or click to browse<br/>
          <span class="hint">${ACCEPTED.join(", ")}</span>
        </div>
        <input type="file" id="file-input" accept="${ACCEPTED.join(",")}" multiple style="display:none;" />
        ${uploads.length ? `<div style="margin-top:10px;">${uploads.map(uploadRow).join("")}</div>` : ""}
      `
          : ""
      }
    </div>

    ${
      selectedKbId
        ? `
      <div class="chat-log" id="chat-log">${renderLog()}</div>
      <div id="chat-error"></div>
      <form id="chat-form" class="chat-input-row">
        <input type="text" name="question" placeholder="Ask about the uploaded documents…" required autocomplete="off" ${asking ? "disabled" : ""} />
        <button type="submit" class="btn btn-doc" ${asking ? "disabled" : ""}>${asking ? '<span class="spinner"></span>' : "Ask"}</button>
      </form>
    `
        : ""
    }
  `;

  highlightCodeBlocks(root);

  const kbSelect = root.querySelector("#kb-select");
  if (kbSelect && kbs.length) {
    kbSelect.addEventListener("change", (e) => {
      selectedKbId = e.target.value;
      log = [];
      uploads = [];
      draw(root);
    });
  }

  root.querySelector("#kb-create-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = root.querySelector("#kb-create-error");
    errorEl.innerHTML = "";
    const fd = new FormData(e.target);
    try {
      const kb = await createKnowledgeBase({ name: fd.get("name") });
      kbs.push(kb);
      selectedKbId = kb.id;
      toast(`"${kb.name}" created`, "success");
      draw(root);
    } catch (err) {
      errorEl.innerHTML = errorBanner(err);
    }
  });

  wireDropzone(root);

  const chatForm = root.querySelector("#chat-form");
  if (chatForm) {
    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await ask(root, fd.get("question"));
    });
  }
}

function wireDropzone(root) {
  const zone = root.querySelector("#dropzone");
  const input = root.querySelector("#file-input");
  if (!zone) return;

  zone.addEventListener("click", () => input.click());
  input.addEventListener("change", (e) => handleFiles(root, [...e.target.files]));

  ["dragover", "dragleave", "drop"].forEach((evt) => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.toggle("dragover", evt === "dragover");
    });
  });
  zone.addEventListener("drop", (e) => handleFiles(root, [...e.dataTransfer.files]));
}

async function handleFiles(root, files) {
  for (const file of files) {
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      toast(`${file.name}: unsupported file type`, "error");
      continue;
    }
    const entry = { name: file.name, progress: 0, status: "uploading" };
    uploads.push(entry);
    draw(root);
    try {
      const result = await uploadFileWithProgress(selectedKbId, file, (pct) => {
        entry.progress = pct;
        const bar = root.querySelector(`[data-upload="${entry.name}"] .progress-fill`);
        if (bar) bar.style.width = pct + "%";
      });
      entry.progress = 100;
      entry.status = result.processing_status;
      toast(`${file.name} uploaded`, "success");
    } catch (err) {
      entry.status = "failed";
      entry.error = err.message;
      toast(`${file.name} failed to upload`, "error");
    }
    draw(root);
  }
}

function uploadRow(u) {
  return `
    <div class="upload-row" data-upload="${escapeHtml(u.name)}">
      <span>${escapeHtml(u.name)}</span>
      <div class="progress-track"><div class="progress-fill" style="width:${u.progress}%"></div></div>
      <span class="badge badge-${escapeHtml(u.status)}">${escapeHtml(u.status)}</span>
    </div>
    ${u.error ? `<div class="hint" style="color:var(--danger)">${escapeHtml(u.error)}</div>` : ""}
  `;
}

async function ask(root, question) {
  const errorEl = root.querySelector("#chat-error");
  errorEl.innerHTML = "";
  log.push({ role: "user", content: question });
  asking = true;
  draw(root);
  try {
    const result = await askDocuments({ knowledgeBaseId: selectedKbId, question });
    log.push({ role: "assistant", content: result.answer, citations: result.citations });
  } catch (err) {
    log.pop();
    toast(err.message, "error");
  }
  asking = false;
  draw(root);
  root.querySelector("#chat-form input")?.focus();
}

function renderLog() {
  if (log.length === 0) {
    return `<div class="empty-state"><div class="empty-icon">◈</div>Upload a file, then ask a question about it.</div>`;
  }
  return log
    .map((m) => {
      if (m.role === "user") return `<div class="msg msg-user">${escapeHtml(m.content)}</div>`;
      return `
        <div class="msg msg-assistant">
          ${renderMarkdown(m.content)}
          <div>
            ${(m.citations || [])
              .map(
                (c) => `<span class="citation-chip">
                  <span class="confidence-bar"><span class="confidence-bar-fill" style="width:${Math.round(c.score * 100)}%"></span></span>
                  chunk #${c.chunk_index} · ${(c.score * 100).toFixed(0)}%
                </span>`
              )
              .join("")}
          </div>
        </div>
      `;
    })
    .join("");
}
