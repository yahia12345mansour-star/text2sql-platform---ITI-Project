import { listConnections, listTables, grantPermission, listPermissions } from "../api/connections.js";
import { escapeHtml, errorBanner, skeletonLines } from "../dom.js";
import { toast } from "../components/toast.js";
import { state } from "../state.js";

let connections = [];
let selectedConnectionId = null;
let tables = [];
let grants = [];

export async function render(root) {
  if (!state.user?.is_tenant_admin) {
    root.innerHTML = `
      <div class="view-header"><h1 class="view-title">Table Permissions</h1></div>
      <div class="card"><div class="hint">Only a workspace admin can view or grant table permissions.</div></div>
    `;
    return;
  }

  root.innerHTML = `<div class="view-header"><h1 class="view-title">Table Permissions</h1></div>${skeletonLines(3)}`;
  connections = await listConnections();
  if (!selectedConnectionId && connections.length) selectedConnectionId = connections[0].id;
  await loadForSelected();
  draw(root);
}

async function loadForSelected() {
  if (!selectedConnectionId) return;
  [tables, grants] = await Promise.all([listTables(selectedConnectionId), listPermissions(selectedConnectionId)]);
}

function draw(root) {
  root.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">Table Permissions</h1>
      <p class="view-subtitle">Regular users only see tables you've explicitly granted them here — admins see everything by default.</p>
    </div>

    ${
      connections.length === 0
        ? `<div class="empty-state">Add a database connection first.</div>`
        : `
      <div class="card">
        <label>Connection</label>
        <select id="conn-select">
          ${connections.map((c) => `<option value="${c.id}" ${c.id === selectedConnectionId ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}
        </select>
      </div>

      <div class="card">
        <div id="grant-error"></div>
        <form id="grant-form">
          <div class="form-row">
            <div>
              <label>User ID</label>
              <input type="text" name="userId" placeholder="paste the user's UUID" required />
              <div class="hint">There's no user directory endpoint yet — get this from the audit log or ask the user to share the id shown at /api/auth/me.</div>
            </div>
            <div>
              <label>Table</label>
              <select name="tableId" required>
                ${tables.map((t) => `<option value="${t.id}">${escapeHtml(t.table_name)}</option>`).join("")}
              </select>
            </div>
          </div>
          <button type="submit" class="btn btn-sql" style="margin-top:14px;">Grant read access</button>
        </form>
      </div>

      <div class="card">
        <div class="hint" style="margin-bottom:10px;">Existing grants for this connection</div>
        ${
          grants.length === 0
            ? `<div class="hint">No grants yet — this connection's tables are only visible to admins.</div>`
            : `<table>
              <tr><th>User</th><th>Table</th><th>Can read</th></tr>
              ${grants
                .map(
                  (g) => `<tr>
                <td class="mono">${escapeHtml(g.user_id || "—")}</td>
                <td class="mono">${escapeHtml(tables.find((t) => t.id === g.table_id)?.table_name || g.table_id)}</td>
                <td>${g.can_read ? "yes" : "no"}</td>
              </tr>`
                )
                .join("")}
            </table>`
        }
      </div>
    `
    }
  `;

  const connSelect = root.querySelector("#conn-select");
  if (connSelect) {
    connSelect.addEventListener("change", async (e) => {
      selectedConnectionId = e.target.value;
      await loadForSelected();
      draw(root);
    });
  }

  const grantForm = root.querySelector("#grant-form");
  if (grantForm) {
    grantForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorEl = root.querySelector("#grant-error");
      errorEl.innerHTML = "";
      const fd = new FormData(e.target);
      try {
        await grantPermission(selectedConnectionId, { userId: fd.get("userId"), tableId: fd.get("tableId") });
        await loadForSelected();
        draw(root);
        toast("Permission granted", "success");
      } catch (err) {
        errorEl.innerHTML = errorBanner(err);
      }
    });
  }
}
