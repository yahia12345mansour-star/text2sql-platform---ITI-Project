export function render(root) {
  root.innerHTML = `
    <div class="landing animate-in-fast">
      <nav class="landing-nav">
        <div class="logo">
          <span class="dot-stack">
            <span style="background:var(--accent-sql)"></span>
            <span style="background:var(--accent-doc)"></span>
            <span style="background:var(--accent-hybrid)"></span>
          </span>
          Text-to-SQL Platform
        </div>
        <div class="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#pipeline">Pipeline</a>
          <a href="#security">Security</a>
          <a href="#faq">FAQ</a>
          <button class="btn btn-primary" id="nav-login">Log in</button>
        </div>
      </nav>

      <header class="hero">
        <div class="hero-eyebrow"><span class="pulse-dot"></span> Multi-tenant · Guardrailed · Traceable</div>
        <h1>Ask your data<br/>anything, in plain English.</h1>
        <p class="lead">Connect a database or drop in your documents. Every answer here is backed by a real, validated query or a cited source — never a guess.</p>
        <div class="hero-ctas">
          <button class="btn btn-primary" id="hero-get-started">Get started — it's free</button>
          <button class="btn btn-ghost glass" id="hero-see-how">See how it works ↓</button>
        </div>
      </header>

      <section class="section" id="features">
        <div class="section-label">Capabilities</div>
        <h2>One workspace, four ways to ask</h2>
        <p class="sub">Each mode is color-coded throughout the app, so you always know where an answer came from.</p>
        <div class="grid-4">
          <div class="feature-card glass">
            <div class="feature-icon" style="background:var(--accent-sql-dim); color:var(--accent-sql);">⌗</div>
            <h3>Ask Your Database</h3>
            <p>Natural language turns into validated, read-only SQL, run against your own database.</p>
          </div>
          <div class="feature-card glass">
            <div class="feature-icon" style="background:var(--accent-doc-dim); color:var(--accent-doc);">◈</div>
            <h3>Ask Your Documents</h3>
            <p>Upload PDFs and text files, get answers with citations back to the exact passage.</p>
          </div>
          <div class="feature-card glass">
            <div class="feature-icon" style="background:var(--accent-hybrid-dim); color:var(--accent-hybrid);">◐</div>
            <h3>Hybrid Ask</h3>
            <p>Questions that need both your database and your documents, combined into one answer.</p>
          </div>
          <div class="feature-card glass">
            <div class="feature-icon" style="background:var(--accent-general-dim); color:var(--accent-general);">◇</div>
            <h3>General Chat</h3>
            <p>A plain conversation with streaming responses, no data source attached.</p>
          </div>
        </div>
      </section>

      <section class="section" id="pipeline">
        <div class="section-label">How it works</div>
        <h2>Every SQL answer is traceable</h2>
        <p class="sub">The model never touches your database directly — every query passes through independent validation first.</p>
        <div class="pipeline-steps glass" style="border-radius:var(--radius); padding: 8px 24px;">
          ${[
            ["Schema discovery", "Your database structure is read once and cached, so it doesn't need rediscovering on every question."],
            ["Permission filtering", "Only tables you've been granted access to are ever shown to the model."],
            ["SQL generation", "The question and allowed schema are sent to the model, which returns a single SELECT statement."],
            ["Validation", "A real SQL parser rejects anything that isn't a safe, single, permitted SELECT — before it can run."],
            ["Execution", "The query runs with a row cap and a timeout, and the result — plus the exact SQL — comes back to you."],
          ]
            .map(
              ([title, desc], i) => `
            <div class="pipeline-step">
              <div class="pipeline-num">0${i + 1}</div>
              <div><h4>${title}</h4><p>${desc}</p></div>
            </div>
          `
            )
            .join("")}
        </div>
      </section>

      <section class="section" id="security">
        <div class="section-label">Security</div>
        <h2>Isolated by design</h2>
        <div class="grid-3">
          <div class="feature-card glass"><h3>Tenant isolation</h3><p>Every row in the platform is scoped to a workspace. Nothing crosses that boundary.</p></div>
          <div class="feature-card glass"><h3>Encrypted credentials</h3><p>Your database password is encrypted before it's ever stored — never held in plain text.</p></div>
          <div class="feature-card glass"><h3>Audited actions</h3><p>Logins, connections, and queries are logged, scoped to your workspace admin's view.</p></div>
        </div>
      </section>

      <section class="section" id="pricing">
        <div class="section-label">Pricing</div>
        <h2>Simple, while it's in development</h2>
        <div class="grid-3">
          <div class="pricing-card glass"><h3>Workspace</h3><div class="price">Free<span>/ during development</span></div>
            <ul><li>Unlimited questions</li><li>All chat modes</li><li>Own database connections</li></ul></div>
          <div class="pricing-card glass" style="border-color:var(--accent-hybrid);"><h3>Team</h3><div class="price">TBD</div>
            <ul><li>Everything in Workspace</li><li>Table-level permissions</li><li>Audit log</li></ul></div>
          <div class="pricing-card glass"><h3>Enterprise</h3><div class="price">Contact</div>
            <ul><li>Custom deployment</li><li>SSO</li><li>Dedicated support</li></ul></div>
        </div>
      </section>

      <section class="section" id="faq">
        <div class="section-label">FAQ</div>
        <h2>Questions</h2>
        <div class="glass" style="border-radius:var(--radius); padding: 4px 24px;">
          ${[
            ["Can the AI modify my database?", "No — the validator only allows a single read-only SELECT statement. Anything else is rejected before it ever runs."],
            ["What happens to my database password?", "It's encrypted before being stored, and only the running application can decrypt it."],
            ["Can other workspaces see my data?", "No. Every query is scoped to your own workspace at the database level."],
            ["What file types can I upload?", "PDF, TXT, Markdown, and CSV today — more formats can be added as the backend grows."],
          ]
            .map(
              ([q, a], i) => `
            <div class="faq-item" data-i="${i}">
              <div class="faq-q">${q}<span class="faq-chevron">⌄</span></div>
              <div class="faq-a">${a}</div>
            </div>
          `
            )
            .join("")}
        </div>
      </section>

      <footer class="landing-footer">
        <span>Text-to-SQL Platform — built as a backend + frontend engineering project.</span>
        <span>© 2026</span>
      </footer>
    </div>
  `;

  root.querySelectorAll(".faq-item").forEach((item) => {
    item.querySelector(".faq-q").addEventListener("click", () => item.classList.toggle("open"));
  });

  const goToAuth = () => {
    window.location.hash = "#/login";
    window.dispatchEvent(new Event("hashchange"));
  };
  root.querySelector("#nav-login").addEventListener("click", goToAuth);
  root.querySelector("#hero-get-started").addEventListener("click", goToAuth);
  root.querySelector("#hero-see-how").addEventListener("click", () => {
    document.getElementById("pipeline")?.scrollIntoView({ behavior: "smooth" });
  });
}
