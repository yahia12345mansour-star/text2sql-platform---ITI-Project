// Mirrors backend/app/routes/connection_routes.py + permission_routes.py
// (the backend nests table permissions under /database-connections too,
// since a permission only ever makes sense in the context of one connection)
import { apiFetch } from "./client.js";

export function listConnections() {
  return apiFetch("/api/database-connections");
}

export function createConnection({ name, databaseType, host, port, databaseName, username, password }) {
  return apiFetch("/api/database-connections", {
    method: "POST",
    body: {
      name,
      database_type: databaseType,
      host,
      port: Number(port),
      database_name: databaseName,
      username,
      password,
    },
  });
}

export function testConnection(connectionId) {
  return apiFetch(`/api/database-connections/${connectionId}/test`, { method: "POST" });
}

export function syncSchema(connectionId) {
  return apiFetch(`/api/database-connections/${connectionId}/sync-schema`, { method: "POST" });
}

export function listTables(connectionId) {
  return apiFetch(`/api/database-connections/${connectionId}/tables`);
}

export function grantPermission(connectionId, { userId, tableId, canRead = true }) {
  return apiFetch(`/api/database-connections/${connectionId}/permissions`, {
    method: "POST",
    body: { user_id: userId, table_id: tableId, can_read: canRead },
  });
}

export function listPermissions(connectionId) {
  return apiFetch(`/api/database-connections/${connectionId}/permissions`);
}
