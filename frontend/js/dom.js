export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function qs(root, selector) {
  return root.querySelector(selector);
}

export function on(root, selector, event, handler) {
  root.querySelectorAll(selector).forEach((el) => el.addEventListener(event, handler));
}

/** Renders an error message from a thrown ApiError (or any Error) into a banner div. */
export function errorBanner(err) {
  return `<div class="error-banner">${escapeHtml(err.message)}</div>`;
}

export function skeletonLines(count = 3) {
  return Array.from({ length: count }, () => `<div class="skeleton skeleton-line" style="width:${60 + Math.random()*35}%"></div>`).join("");
}

export function skeletonCards(count = 2) {
  return Array.from({ length: count }, () => `<div class="skeleton skeleton-card"></div>`).join("");
}
