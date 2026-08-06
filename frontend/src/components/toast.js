// Small toast notification system — replaces alert()/confirm() everywhere
// so success/error feedback matches the rest of the design language.
export function toast(message, type = "info") {
  const root = document.getElementById("toast-root");
  if (!root) return;
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  const icon = type === "success" ? "✓" : type === "error" ? "✕" : "•";
  el.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 0.2s ease";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 200);
  }, 3500);
}
