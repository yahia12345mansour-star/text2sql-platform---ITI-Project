import { isLoggedIn, state, clearAuth } from "./state.js";
import { escapeHtml } from "./dom.js";
import { initCommandPalette } from "./components/commandPalette.js";
import * as landingView from "./views/landing.js";
import * as authView from "./views/auth.js";
import * as chatSql from "./views/chatSql.js";
import * as chatDocuments from "./views/chatDocuments.js";
import * as chatHybrid from "./views/chatHybrid.js";
import * as chatGeneral from "./views/chatGeneral.js";
import * as connectionsView from "./views/connections.js";
import * as permissionsView from "./views/permissions.js";
import * as conversationsView from "./views/conversations.js";
import * as auditView from "./views/audit.js";

const ROUTES = [
  { path: "chat-sql", label: "Ask Your Database", group: "Chat", accent: "sql", icon: "⌗", module: chatSql },
  { path: "chat-doc", label: "Ask Your Documents", group: "Chat", accent: "doc", icon: "◈", module: chatDocuments },
  { path: "chat-hybrid", label: "Hybrid Ask", group: "Chat", accent: "hybrid", icon: "◐", module: chatHybrid },
  { path: "chat-general", label: "General Chat", group: "Chat", accent: "general", icon: "◇", module: chatGeneral },
  { path: "connections", label: "Database Connections", group: "Data", icon: "⛁", module: connectionsView },
  { path: "permissions", label: "Table Permissions", group: "Data", icon: "⚿", module: permissionsView },
  { path: "conversations", label: "Conversations", group: "History", icon: "☰", module: conversationsView },
  { path: "audit", label: "Audit Log", group: "History", icon: "▤", module: auditView },
];

let sidebarCollapsed = false;

function currentPath() {
  const raw = (window.location.hash || "").replace(/^#\//, "");
  return raw;
}

function renderShell(appEl) {
  const path = currentPath();
  const groups = [...new Set(ROUTES.map((r) => r.group))];

  appEl.innerHTML = `
    <div class="sidebar ${sidebarCollapsed ? "collapsed" : ""}" id="sidebar">
      <div class="brand">
        <div class="brand-text">
          <div class="brand-name">Text-to-SQL</div>
          <div class="brand-tenant">${escapeHtml(state.user?.email || "")}</div>
        </div>
        <button class="collapse-btn" id="collapse-btn" title="Toggle sidebar">${sidebarCollapsed ? "»" : "«"}</button>
      </div>
      <div class="cmdk-hint" id="cmdk-open">
        <span class="nav-label">Search</span>
        <span class="cmdk-kbd">⌘K</span>
      </div>
      ${groups
        .map(
          (g) => `
        <div class="nav-group-label">${g}</div>
        ${ROUTES.filter((r) => r.group === g)
          .map(
            (r) => `
          <a class="nav-link ${r.path === path ? "active" : ""}" data-accent="${r.accent || ""}" href="#/${r.path}" title="${escapeHtml(r.label)}">
            ${r.accent ? '<span class="nav-dot"></span>' : `<span class="nav-icon">${r.icon}</span>`}
            <span class="nav-label">${escapeHtml(r.label)}</span>
          </a>
        `
          )
          .join("")}
      `
        )
        .join("")}
      <div class="sidebar-footer">
        <div class="user-row">
          <span>${state.user?.is_tenant_admin ? "Admin" : "Member"}</span>
          <button class="logout-btn" id="logout-btn">Log out</button>
        </div>
      </div>
    </div>
    <div class="main" id="main"></div>
  `;

  appEl.querySelector("#logout-btn").addEventListener("click", () => {
    clearAuth();
    window.location.hash = "#/";
    window.location.reload();
  });

  appEl.querySelector("#collapse-btn").addEventListener("click", () => {
    sidebarCollapsed = !sidebarCollapsed;
    appEl.querySelector("#sidebar").classList.toggle("collapsed", sidebarCollapsed);
    appEl.querySelector("#collapse-btn").textContent = sidebarCollapsed ? "»" : "«";
  });

  appEl.querySelector("#cmdk-open").addEventListener("click", () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
  });
}

export function initRouter(appEl) {
  initCommandPalette(ROUTES);

  async function renderRoute() {
    const path = currentPath();

    if (!isLoggedIn()) {
      if (path === "login") {
        authView.render(appEl);
      } else {
        landingView.render(appEl);
      }
      return;
    }

    // Logged in but sitting on the landing/login hash — send to the app.
    if (path === "" || path === "login") {
      window.location.hash = "#/chat-sql";
      return;
    }

    renderShell(appEl);
    const route = ROUTES.find((r) => r.path === path) || ROUTES[0];
    const mainEl = appEl.querySelector("#main");
    mainEl.classList.add("animate-in-fast");
    await route.module.render(mainEl);
  }

  window.addEventListener("hashchange", renderRoute);
  renderRoute();
}
