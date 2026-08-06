// A real, working data grid for SQL results: client-side sort, filter,
// pagination, and CSV export — all operating on rows already returned
// by the backend (no server-side paging exists, so this is the honest
// scope: fast client-side browsing of up to the 500-row cap the API
// already enforces).
import { escapeHtml } from "../core/dom.js";

export function renderDataGrid(columns, rows) {
  const gridId = "grid-" + Math.random().toString(36).slice(2, 9);
  let sortCol = null;
  let sortDir = 1;
  let filterText = "";
  let page = 0;
  const pageSize = 15;

  function computeRows() {
    let out = rows;
    if (filterText) {
      const f = filterText.toLowerCase();
      out = out.filter((r) => columns.some((c) => String(r[c] ?? "").toLowerCase().includes(f)));
    }
    if (sortCol) {
      out = [...out].sort((a, b) => {
        const av = a[sortCol], bv = b[sortCol];
        if (av === bv) return 0;
        const numeric = !isNaN(parseFloat(av)) && !isNaN(parseFloat(bv));
        const cmp = numeric ? parseFloat(av) - parseFloat(bv) : String(av).localeCompare(String(bv));
        return cmp * sortDir;
      });
    }
    return out;
  }

  function toCsv() {
    const filtered = computeRows();
    const lines = [columns.join(",")];
    for (const r of filtered) {
      lines.push(columns.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","));
    }
    return lines.join("\n");
  }

  function download() {
    const blob = new Blob([toCsv()], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "query_results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function html() {
    const filtered = computeRows();
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(page, totalPages - 1);
    const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize);

    return `
      <div id="${gridId}">
        <div class="grid-toolbar">
          <input type="text" class="grid-filter" placeholder="Filter rows…" value="${escapeHtml(filterText)}" />
          <button type="button" class="btn btn-icon grid-export" title="Export CSV">⬇ CSV</button>
          <span class="grid-meta">${filtered.length} row(s)</span>
        </div>
        <div class="grid-scroll">
          <table>
            <thead><tr>${columns
              .map(
                (c) =>
                  `<th data-col="${escapeHtml(c)}">${escapeHtml(c)}${sortCol === c ? (sortDir === 1 ? " ↑" : " ↓") : ""}</th>`
              )
              .join("")}</tr></thead>
            <tbody>
              ${pageRows.map((r) => `<tr>${columns.map((c) => `<td class="mono">${escapeHtml(r[c])}</td>`).join("")}</tr>`).join("")}
            </tbody>
          </table>
        </div>
        <div class="grid-pagination">
          <button type="button" class="btn btn-icon grid-prev" ${page === 0 ? "disabled" : ""}>←</button>
          <span>Page ${page + 1} / ${totalPages}</span>
          <button type="button" class="btn btn-icon grid-next" ${page >= totalPages - 1 ? "disabled" : ""}>→</button>
        </div>
      </div>
    `;
  }

  function wire(container) {
    const root = container.querySelector(`#${gridId}`);
    if (!root) return;
    root.querySelector(".grid-filter").addEventListener("input", (e) => {
      filterText = e.target.value;
      page = 0;
      redraw(container);
    });
    root.querySelector(".grid-export").addEventListener("click", download);
    root.querySelectorAll("th[data-col]").forEach((th) => {
      th.addEventListener("click", () => {
        const col = th.dataset.col;
        if (sortCol === col) sortDir *= -1;
        else { sortCol = col; sortDir = 1; }
        redraw(container);
      });
    });
    const prev = root.querySelector(".grid-prev");
    const next = root.querySelector(".grid-next");
    if (prev) prev.addEventListener("click", () => { page--; redraw(container); });
    if (next) next.addEventListener("click", () => { page++; redraw(container); });
  }

  function redraw(container) {
    const anchor = container.querySelector(`#${gridId}`);
    if (!anchor) return;
    anchor.outerHTML = html();
    wire(container);
  }

  return {
    html,
    mount(container) { wire(container); },
  };
}
