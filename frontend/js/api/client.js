import { state, clearAuth } from "../state.js";

// Change this if the backend runs somewhere other than the default
// `uvicorn app.main:app --reload` address on your machine.
export const API_BASE = "http://127.0.0.1:8000";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * Wraps fetch() so every api/*.js file gets consistent behavior:
 *  - JSON body in, JSON body out
 *  - Authorization header attached automatically when logged in
 *  - A 401 (expired/invalid token) logs the user out and reloads,
 *    instead of every screen having to handle that case separately
 *  - Non-2xx responses raise an ApiError with the backend's own
 *    `detail` message, so the UI can show a real reason, not "failed"
 */
export async function apiFetch(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  if (!isForm) headers["Content-Type"] = "application/json";
  if (state.token) headers["Authorization"] = `Bearer ${state.token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch (networkErr) {
    throw new ApiError(
      `Could not reach the API at ${API_BASE}. Is the backend running (uvicorn app.main:app --reload)?`,
      0
    );
  }

  if (response.status === 401) {
    clearAuth();
    window.location.hash = "#/login";
    window.location.reload();
    throw new ApiError("Session expired — please log in again.", 401);
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const detail = data?.detail || `Request failed (${response.status})`;
    throw new ApiError(typeof detail === "string" ? detail : JSON.stringify(detail), response.status);
  }

  return data;
}
