import { listAuditLogs } from "../api/audit.js";
import { escapeHtml, errorBanner, skeletonLines } from "../dom.js";
import { toast } from "../components/toast.js";
import { state } from "../state.js";

export async function render(root) {
  if (!state.user?.is_tenant_admin) {
    root.innerHTML = `
      <div class="view-header"><h1 class="view-title">Audit Log</h1></div>
      <div class="card"><div class="hint">Only a workspace admin can view the audit log.</div></div>
    `;
    return;
  }

  root.innerHTML = `<div class="view-header"><h1 class="view-title">Audit Log</h1></div>${skeletonLines(3)}`;
  let logs;
  try {
    logs = await listAuditLogs();
  } catch (err) {
    root.innerHTML = `<div class="view-header"><h1 class="view-title">Audit Log</h1></div>${errorBanner(err)}`;
    return;
  }

  root.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">Audit Log</h1>
      <p class="view-subtitle">Every meaningful action in your workspace, most recent first. Scoped to your tenant only.</p>
    </div>
    ${
      logs.length === 0
        ? `<div class="empty-state">No audit events yet.</div>`
        : `
      <div class="card">
        <table>
          <tr><th>When</th><th>Action</th><th>Resource</th><th>User</th></tr>
          ${logs
            .map(
              (l) => `<tr>
            <td class="mono">${escapeHtml(new Date(l.created_at).toLocaleString())}</td>
            <td class="mono">${escapeHtml(l.action)}</td>
            <td class="mono">${escapeHtml(l.resource_type || "—")}</td>
            <td class="mono">${escapeHtml(l.user_id || "—")}</td>
          </tr>`
            )
            .join("")}
        </table>
      </div>
    `
    }
  `;
}
