import { login, register, getMe } from "../api/auth.js";
import { setAuth } from "../state.js";
import { errorBanner } from "../dom.js";
import { toast } from "../components/toast.js";

let mode = "login"; // or "register"

export function render(root) {
  root.innerHTML = `
    <div class="auth-shell">
      <a href="#/" class="back-to-landing">← Back</a>
      <div class="auth-card glass">
        <div class="auth-brand">Text-to-SQL Platform</div>
        <h1 class="auth-title">${mode === "login" ? "Log in" : "Create your workspace"}</h1>
        <div class="auth-toggle">
          <button data-mode="login" class="${mode === "login" ? "active" : ""}">Log in</button>
          <button data-mode="register" class="${mode === "register" ? "active" : ""}">Register</button>
        </div>
        <div id="auth-error"></div>
        <form id="auth-form">
          ${
            mode === "register"
              ? `
            <label>Workspace code</label>
            <input type="text" name="tenantCode" placeholder="e.g. acme" required />
            <div class="hint">First person to register a workspace code becomes its admin.</div>

            <label>Workspace name</label>
            <input type="text" name="tenantName" placeholder="Acme Inc." required />

            <label>Full name</label>
            <input type="text" name="fullName" placeholder="Jane Doe" />
          `
              : ""
          }
          <label>Email</label>
          <input type="email" name="email" required />
          <label>Password</label>
          <input type="password" name="password" required minlength="4" />
          <button type="submit" class="btn btn-primary" style="width:100%; margin-top:20px;">
            ${mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  `;

  root.querySelectorAll(".auth-toggle button").forEach((btn) => {
    btn.addEventListener("click", () => {
      mode = btn.dataset.mode;
      render(root);
    });
  });

  root.querySelector("#auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = root.querySelector("#auth-error");
    errorEl.innerHTML = "";
    const fd = new FormData(e.target);
    const submitBtn = e.target.querySelector("button[type=submit]");
    submitBtn.disabled = true;

    try {
      if (mode === "register") {
        await register({
          tenantCode: fd.get("tenantCode"),
          tenantName: fd.get("tenantName"),
          email: fd.get("email"),
          password: fd.get("password"),
          fullName: fd.get("fullName"),
        });
      }
      const { access_token } = await login({ email: fd.get("email"), password: fd.get("password") });
      setAuth(access_token, null);
      const user = await getMe();
      setAuth(access_token, user);
      toast(`Welcome back, ${user.email}`, "success");
      window.location.hash = "#/chat-sql";
      window.dispatchEvent(new Event("hashchange"));
    } catch (err) {
      errorEl.innerHTML = errorBanner(err);
      root.querySelector(".auth-card").classList.add("shake");
      submitBtn.disabled = false;
    }
  });
}
