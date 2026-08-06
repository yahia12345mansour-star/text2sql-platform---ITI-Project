import { listConnections, createConnection, testConnection, syncSchema, listTables } from "../api/connections.js";
import { escapeHtml, errorBanner, skeletonCards } from "../core/dom.js";
import { toast } from "../components/toast.js";
import { state } from "../core/state.js";

let connections = [];
let expandedTables = {}; // connectionId -> [tables] once loaded
let loading = true;

export async function render(root) {
  root.innerHTML = shell(loadingBody());
  wireCreateForm(root);

  try {
    connections = await listConnections();
  } catch (err) {
    root.innerHTML = shell(errorBanner(err));
    return;
  }
  loading = false;
  root.innerHTML = shell(body());
  wireCreateForm(root);
  wireActions(root);
}

function shell(inner) {
  return `
    <div class="view-header">
      <h1 class="view-title">Database Connections</h1>
      <p class="view-subtitle">Connect your own database so it can be queried in plain English.</p>
    </div>
    ${inner}
  `;
}

function loadingBody() {
  return skeletonCards(2);
}

function createFormCard() {
  const isAdmin = state.user?.is_tenant_admin;
  if (!isAdmin) {
    return `<div class="card"><div class="hint">Only a workspace admin can add database connections.</div></div>`;
  }
  return `
    <div class="card">
      <div id="create-conn-error"></div>
      <form id="create-conn-form">
        <div class="form-row">
          <div>
            <label>Connection name</label>
            <input type="text" name="name" placeholder="Sample Sales" required />
          </div>
          <div>
            <label>Database type</label>
            <select name="databaseType">
              <option value="postgresql">postgresql</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div>
            <label>Host</label>
            <input type="text" name="host" placeholder="localhost" required />
          </div>
          <div>
            <label>Port</label>
            <input type="number" name="port" placeholder="5432" required />
          </div>
        </div>
        <div class="form-row">
          <div>
            <label>Database name</label>
            <input type="text" name="databaseName" required />
          </div>
        </div>
        <div class="form-row">
          <div>
            <label>Username</label>
            <input type="text" name="username" required />
          </div>
          <div>
            <label>Password</label>
            <input type="password" name="password" required />
          </div>
        </div>
        <button type="submit" class="btn btn-sql" style="margin-top:16px;">Add connection</button>
      </form>
    </div>
  `;
}

function body() {
  if (connections.length === 0) {
    return createFormCard() + `<div class="empty-state">No database connections yet — add one above to get started.</div>`;
  }

  const rows = connections
    .map((c) => {
      const tables = expandedTables[c.id];
      return `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong>${escapeHtml(c.name)}</strong>
            <span class="mono hint">&nbsp;${escapeHtml(c.database_type)}://${escapeHtml(c.host)}:${c.port}/${escapeHtml(c.database_name)}</span>
          </div>
          <span class="badge badge-${escapeHtml(c.status)}">${escapeHtml(c.status)}</span>
        </div>
        ${c.last_test_message ? `<div class="hint" style="margin-top:6px;">${escapeHtml(c.last_test_message)}</div>` : ""}
        <div style="margin-top:14px; display:flex; gap:8px;">
          <button class="btn" data-action="test" data-id="${c.id}">Test connection</button>
          <button class="btn" data-action="sync" data-id="${c.id}">Sync schema</button>
          <button class="btn" data-action="tables" data-id="${c.id}">${tables ? "Hide tables" : "View tables"}</button>
        </div>
        ${tables ? tablesBlock(tables) : ""}
      </div>
    `;
    })
    .join("");

  return createFormCard() + rows;
}

function tablesBlock(tables) {
  if (tables.length === 0) {
    return `<div class="hint" style="margin-top:12px;">No tables discovered yet — run "Sync schema" first.</div>`;
  }
  return `
    <div class="tree" style="margin-top:14px;">
      ${tables
        .map(
          (t, i) => `
        <div class="tree-node" data-tree-toggle="${i}">
          <span class="tree-chevron">▸</span>
          <span style="color:var(--accent-sql)">${escapeHtml(t.table_name)}</span>
          <span class="hint" style="margin-left:auto;">${t.columns.length} cols</span>
        </div>
        <div class="tree-children">
          ${t.columns
            .map(
              (c) => `<div class="tree-col"><span>${escapeHtml(c.name)} <span style="color:var(--text-faint)">${escapeHtml(c.data_type || "")}</span></span>${c.is_primary_key ? '<span class="pk">PK</span>' : ""}</div>`
            )
            .join("")}
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

function wireCreateForm(root) {
  const form = root.querySelector("#create-conn-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = root.querySelector("#create-conn-error");
    errorEl.innerHTML = "";
    const fd = new FormData(e.target);
    try {
      await createConnection({
        name: fd.get("name"),
        databaseType: fd.get("databaseType"),
        host: fd.get("host"),
        port: fd.get("port"),
        databaseName: fd.get("databaseName"),
        username: fd.get("username"),
        password: fd.get("password"),
      });
      await render(root);
    } catch (err) {
      errorEl.innerHTML = errorBanner(err);
    }
  });
}

function wireActions(root) {
  root.querySelectorAll("[data-tree-toggle]").forEach((node) => {
    node.addEventListener("click", () => node.classList.toggle("open"));
  });
  root.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const mainEl = root;

      if (action === "test") {
        btn.disabled = true;
        btn.textContent = "Testing…";
        try {
          await testConnection(id);
        } catch (err) {
          toast(err.message, "error");
        }
        connections = await listConnections();
        render(mainEl);
      } else if (action === "sync") {
        btn.disabled = true;
        btn.textContent = "Syncing…";
        try {
          const result = await syncSchema(id);
          delete expandedTables[id]; // force a fresh fetch if the user expands next
          toast(result.message, "success");
        } catch (err) {
          toast(err.message, "error");
        }
        render(mainEl);
      } else if (action === "tables") {
        if (expandedTables[id]) {
          delete expandedTables[id];
        } else {
          expandedTables[id] = await listTables(id);
        }
        render(mainEl);
      }
    });
  });
}
