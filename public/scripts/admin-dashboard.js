// /admin/'s own dashboard content: sign in (same shape as every other
// admin page's login flow), then the stat strip and needs-attention
// panel. Deliberately built on top of window.PodiumAdminShell (admin-
// shell.js) rather than fetching /api/admin/dashboard-summary/ itself --
// that shell already fetches it once for the sidebar's badges on every
// admin page load, and PodiumAdminShell.dashboard() returns that exact
// same in-flight/cached request, so this page costs one fetch total,
// not two. See docs/DECISIONS.md, 2026-08-16.
(() => {
  const loadingBox = document.querySelector("[data-admin-loading]");
  const loginForm = document.querySelector("[data-admin-login]");
  const dashboard = document.querySelector("[data-admin-dashboard]");
  const loginMessage = document.querySelector("[data-admin-message]");
  const logoutButton = document.querySelector("[data-admin-logout]");
  const statsBox = document.querySelector("[data-admin-stats]");
  const tasksBox = document.querySelector("[data-admin-tasks]");
  const tasksEmpty = document.querySelector("[data-admin-tasks-empty]");
  const tasksError = document.querySelector("[data-admin-tasks-error]");
  const refreshButton = document.querySelector("[data-admin-refresh]");

  if (
    !loadingBox || !loginForm || !dashboard || !loginMessage || !logoutButton ||
    !statsBox || !tasksBox || !tasksEmpty || !tasksError
  ) {
    return;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  const STAT_TILES = [
    { key: "urgent_tasks", label: "Urgent tasks" },
    { key: "upcoming_meets_7", label: "Meets in 7 days" },
    { key: "pending_claims", label: "Pending claims" },
    { key: "schedule_requests", label: "Schedule requests" },
    { key: "draft_content", label: "Draft content" },
    { key: "notification_failures", label: "Notification failures" }
  ];

  function renderStats(summary) {
    if (!summary) {
      statsBox.innerHTML = "";
      return;
    }

    statsBox.innerHTML = STAT_TILES
      .map((tile) => `<div class="admin-stat"><strong>${Number(summary[tile.key]) || 0}</strong><span>${escapeHtml(tile.label)}</span></div>`)
      .join("");
  }

  function renderTasks(tasks) {
    tasksError.hidden = true;

    const shown = (tasks || [])
      .filter((task) => task.priority === "urgent" || task.priority === "important")
      .slice(0, 8);

    if (shown.length === 0) {
      tasksBox.innerHTML = "";
      tasksEmpty.hidden = false;
      return;
    }

    tasksEmpty.hidden = true;
    tasksBox.innerHTML = shown
      .map((task) => `<div class="admin-task" data-priority="${escapeHtml(task.priority)}">
        <div>
          <h3>${escapeHtml(task.title)}</h3>
          <p>${escapeHtml(task.detail)}</p>
        </div>
        <a class="button button-outline" href="${task.href}">${escapeHtml(task.label)}</a>
      </div>`)
      .join("");
  }

  async function loadDashboardData({ bypassCache = false } = {}) {
    if (!window.PodiumAdminShell) {
      tasksError.hidden = false;
      return;
    }

    try {
      const data = bypassCache
        ? await window.PodiumAdminShell.refreshDashboard()
        : await window.PodiumAdminShell.dashboard();

      if (!data) {
        tasksError.hidden = false;
        return;
      }

      renderStats(data.summary);
      renderTasks(data.tasks);
    } catch (error) {
      console.error("Admin dashboard load error:", error);
      tasksError.hidden = false;
    }
  }

  function showLogin() {
    loadingBox.hidden = true;
    dashboard.hidden = true;
    loginForm.hidden = false;
  }

  function showDashboard({ bypassCache = false } = {}) {
    loadingBox.hidden = true;
    loginForm.hidden = true;
    dashboard.hidden = false;
    loadDashboardData({ bypassCache });
  }

  async function checkSession() {
    try {
      const authenticated = window.PodiumAdminShell
        ? await window.PodiumAdminShell.session()
        : false;

      if (authenticated) showDashboard();
      else showLogin();
    } catch (error) {
      console.error("Admin session check error:", error);
      showLogin();
      loginMessage.textContent = "Unable to check your session.";
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = loginForm.querySelector('button[type="submit"]');
    const formData = new FormData(loginForm);
    loginMessage.textContent = "Signing in...";
    submitButton.disabled = true;

    try {
      const response = await fetch("/api/admin/auth/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: String(formData.get("password") || "") })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Sign in failed.");
      }

      loginForm.reset();
      loginMessage.textContent = "";
      // admin-shell.js fires its own dashboard-summary fetch
      // unconditionally the moment its script runs -- on a fresh,
      // not-yet-authenticated /admin/ load that happens before this
      // form is even submitted, so it memoizes an "anonymous" 401
      // result. Without bypassCache here, showDashboard() would return
      // that same stale pre-login result forever (until a manual
      // reload) instead of the real, now-authenticated data.
      showDashboard({ bypassCache: true });
    } catch (error) {
      loginMessage.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  });

  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;

    try {
      if (window.PodiumAdminShell) {
        await window.PodiumAdminShell.logout();
      } else {
        await fetch("/api/admin/auth/", { method: "POST", credentials: "same-origin" });
      }
    } finally {
      logoutButton.disabled = false;
      showLogin();
    }
  });

  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      refreshButton.disabled = true;
      loadDashboardData({ bypassCache: true }).finally(() => {
        refreshButton.disabled = false;
      });
    });
  }

  checkSession();
})();
