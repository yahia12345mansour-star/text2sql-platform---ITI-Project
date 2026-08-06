// Single shared piece of app state. Kept intentionally tiny — this app
// has no complex client-side state, just "who is logged in" and "what
// screen is active." Persisted to localStorage only for the token/user,
// so a page refresh doesn't force a re-login.

const STORAGE_KEY = "t2sql_auth";

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { token: null, user: null };
  } catch {
    return { token: null, user: null };
  }
}

export const state = {
  ...load(),
  route: "login",
};

export function setAuth(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
}

export function clearAuth() {
  state.token = null;
  state.user = null;
  localStorage.removeItem(STORAGE_KEY);
}

export function isLoggedIn() {
  return Boolean(state.token);
}
