// Ctrl+K / Cmd+K command palette for jumping between screens — a real,
// fully working feature since it only ever navigates to routes that
// already exist and work.
import { escapeHtml } from "../core/dom.js";

let routes = [];
let overlayEl = null;
let selectedIndex = 0;

export function initCommandPalette(routeList) {
  routes = routeList;
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      open();
    }
    if (e.key === "Escape") close();
  });
}

function open() {
  if (overlayEl) return;
  overlayEl = document.createElement("div");
  overlayEl.className = "cmdk-overlay";
  overlayEl.innerHTML = `
    <div class="cmdk-box">
      <input type="text" class="cmdk-input" placeholder="Jump to…" autofocus />
      <div class="cmdk-results"></div>
    </div>
  `;
  document.body.appendChild(overlayEl);
  overlayEl.addEventListener("click", (e) => { if (e.target === overlayEl) close(); });

  const input = overlayEl.querySelector(".cmdk-input");
  input.focus();
  selectedIndex = 0;
  renderResults("");

  input.addEventListener("input", (e) => renderResults(e.target.value));
  input.addEventListener("keydown", (e) => {
    const items = overlayEl.querySelectorAll(".cmdk-item");
    if (e.key === "ArrowDown") { e.preventDefault(); selectedIndex = Math.min(selectedIndex + 1, items.length - 1); highlight(); }
    if (e.key === "ArrowUp") { e.preventDefault(); selectedIndex = Math.max(selectedIndex - 1, 0); highlight(); }
    if (e.key === "Enter") { items[selectedIndex]?.click(); }
  });
}

function highlight() {
  overlayEl.querySelectorAll(".cmdk-item").forEach((el, i) => el.classList.toggle("selected", i === selectedIndex));
}

function renderResults(query) {
  const q = query.toLowerCase();
  const matches = routes.filter((r) => r.label.toLowerCase().includes(q));
  selectedIndex = 0;
  const resultsEl = overlayEl.querySelector(".cmdk-results");
  resultsEl.innerHTML = matches
    .map((r, i) => `<div class="cmdk-item ${i === 0 ? "selected" : ""}" data-path="${escapeHtml(r.path)}">${escapeHtml(r.label)}</div>`)
    .join("") || `<div class="cmdk-item">No matches</div>`;
  resultsEl.querySelectorAll(".cmdk-item[data-path]").forEach((el) => {
    el.addEventListener("click", () => {
      window.location.hash = `#/${el.dataset.path}`;
      close();
    });
  });
}

function close() {
  if (overlayEl) { overlayEl.remove(); overlayEl = null; }
}
