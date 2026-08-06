// Mirrors backend/app/routes/auth_routes.py
import { apiFetch } from "./client.js";

export function register({ tenantCode, tenantName, email, password, fullName }) {
  return apiFetch("/api/auth/register", {
    method: "POST",
    body: {
      tenant_code: tenantCode,
      tenant_name: tenantName,
      email,
      password,
      full_name: fullName || null,
    },
  });
}

export function login({ email, password }) {
  return apiFetch("/api/auth/login", { method: "POST", body: { email, password } });
}

export function getMe() {
  return apiFetch("/api/auth/me");
}
