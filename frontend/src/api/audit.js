// Mirrors backend/app/routes/audit_routes.py
import { apiFetch } from "./client.js";

export function listAuditLogs() {
  return apiFetch("/api/audit-logs");
}
