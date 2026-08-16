// Drives the persistent admin sidebar rendered by src/lib/adminshell.mjs:
// badge counts, the quick-jump search, and browser-local pinned/recent
// tools. No-ops entirely on any page that hasn't been migrated to the
// shell yet, so it's safe to load on every /admin/* page from day one of
// the rollout (see docs/DECISIONS.md, 2026-08-16).
//
// Auth model: this script NEVER redirects. Each tool page's own script
// already owns its own 401 -> "/admin/" redirect (see e.g.
// admin-team-rosters.js); this file only reads session state to decide
// whether to show badges, so it can never race or fight a page's own
// auth flow.
(() => {
  const shellRoot = document.querySelector("[data-admin-shell]");
  if (!shellRoot) return;

  const NAV_GROUPS = (window.PODIUM_ADMIN_NAV && window.PODIUM_ADMIN_NAV.groups) || [];
  const ITEMS = NAV_GROUPS.flatMap((group) => (group.items || []).map((item) => ({ ...item, group: group.label })));

  const STORAGE_KEY = "podium.admin.tools.v1";
  const CACHE_KEY = "podium.admin.dashboard.v1";
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const RECENT_CAP = 5;
  const DASHBOARD_ENDPOINT = "/api/admin/dashboard-summary/";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function currentPathname() {
    return window.location.pathname;
  }

  function findItem(href) {
    return ITEMS.find((item) => item.href === href) || null;
  }

  // ---- personalization state (pins + recent), browser-local only ------
  // There is exactly one shared admin password and no per-admin identity
  // (lib/admin_auth.mjs) -- localStorage is the only place this can live.

  function defaultState() {
    return { version: 1, pinned: [], recent: [], sidebarCollapsed: false };
  }

  function loadState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1) return defaultState();
      return {
        version: 1,
        pinned: Array.isArray(parsed.pinned) ? parsed.pinned.filter((href) => typeof href === "string") : [],
        recent: Array.isArray(parsed.recent) ? parsed.recent.filter((entry) => entry && typeof entry.href === "string") : [],
        sidebarCollapsed: Boolean(parsed.sidebarCollapsed)
      };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private browsing, quota exceeded, etc. -- navigation must keep
      // working even when personalization can't be persisted.
    }
  }

  const state = loadState();

  function recordVisit() {
    const href = currentPathname();
    if (href === "/admin/") return;
    if (!findItem(href)) return;
    if (state.pinned.includes(href)) return;
    state.recent = state.recent.filter((entry) => entry.href !== href);
    state.recent.unshift({ href, at: Date.now() });
    state.recent = state.recent.slice(0, RECENT_CAP);
    saveState();
  }

  // ---- rendering nav-item markup (shared shape with the server-rendered
  // version in src/lib/adminshell.mjs, so badge queries match either) ----

  function navItemHtml(item) {
    const active = item.href === currentPathname();
    const pinned = state.pinned.includes(item.href);
    // Matches the server-rendered shape in src/lib/adminshell.mjs
    // exactly (including .admin-nav-row, the pin button's positioning
    // context -- see the comment there for why it can't just be the
    // shared group container).
    return `<div class="admin-nav-row">
    <a class="admin-nav-item" href="${item.href}" data-admin-nav-item="${item.href}"${active ? ' aria-current="page"' : ""}>
      <span class="admin-nav-mark" aria-hidden="true">${escapeHtml(item.mark)}</span>
      <span class="admin-nav-label">${escapeHtml(item.label)}</span>
      <span class="admin-badge" data-admin-badge="${item.href}" hidden></span>
    </a>
    <button class="admin-pin" type="button" data-admin-pin="${item.href}" data-admin-pin-label="${escapeHtml(item.label)}" aria-pressed="${pinned}">
      <span class="visually-hidden">${pinned ? "Unpin" : "Pin"} ${escapeHtml(item.label)}</span>
      <span class="admin-pin-glyph" aria-hidden="true">${pinned ? "★" : "+"}</span>
    </button>
    </div>`;
  }

  function syncPinButtons() {
    shellRoot.querySelectorAll("[data-admin-pin]").forEach((button) => {
      const href = button.dataset.adminPin;
      const pinned = state.pinned.includes(href);
      button.setAttribute("aria-pressed", String(pinned));
      const glyph = button.querySelector(".admin-pin-glyph");
      if (glyph) glyph.textContent = pinned ? "★" : "+";
      const label = button.querySelector(".visually-hidden");
      if (label) label.textContent = (pinned ? "Unpin " : "Pin ") + (button.dataset.adminPinLabel || "");
    });
  }

  function renderPinned() {
    const container = shellRoot.querySelector("[data-admin-pinned]");
    const itemsBox = shellRoot.querySelector("[data-admin-pinned-items]");
    if (!container || !itemsBox) return;
    // Exclude the current page itself -- the main grouped list already
    // shows it there, marked aria-current="page". Duplicating it into
    // Pinned too would mark two different elements as the current page
    // at once, which is confusing both visually and for assistive tech.
    const items = state.pinned.map(findItem).filter(Boolean).filter((item) => item.href !== currentPathname());
    itemsBox.innerHTML = items.map(navItemHtml).join("");
    container.hidden = items.length === 0;
  }

  function renderRecent() {
    const container = shellRoot.querySelector("[data-admin-recent]");
    const itemsBox = shellRoot.querySelector("[data-admin-recent-items]");
    if (!container || !itemsBox) return;
    // Same reasoning as renderPinned() above -- "recently visited" means
    // other tools, not the one already marked current in the main list.
    const items = state.recent.map((entry) => findItem(entry.href)).filter(Boolean).filter((item) => item.href !== currentPathname());
    itemsBox.innerHTML = items.map(navItemHtml).join("");
    container.hidden = items.length === 0;
  }

  let lastDashboardData = null;

  function renderPersonalization() {
    renderPinned();
    renderRecent();
    syncPinButtons();
    if (lastDashboardData) applyBadges(lastDashboardData);
  }

  function togglePin(href) {
    const index = state.pinned.indexOf(href);
    if (index === -1) state.pinned.push(href);
    else state.pinned.splice(index, 1);
    saveState();
    renderPersonalization();
  }

  shellRoot.addEventListener("click", (event) => {
    const pinButton = event.target.closest("[data-admin-pin]");
    if (pinButton) {
      togglePin(pinButton.dataset.adminPin);
    }
  });

  // ---- sidebar collapse (browser-local; helps the ~296px sidebar not
  // crowd data-dense tools on mid-width screens) ------------------------

  const collapseButton = shellRoot.querySelector("[data-admin-sidebar-collapse]");

  function applyCollapsed() {
    document.body.dataset.adminSidebarCollapsed = state.sidebarCollapsed ? "true" : "false";
    if (collapseButton) {
      collapseButton.setAttribute("aria-pressed", String(state.sidebarCollapsed));
      collapseButton.textContent = state.sidebarCollapsed ? "»" : "Collapse";
    }
  }

  if (collapseButton) {
    collapseButton.addEventListener("click", () => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      saveState();
      applyCollapsed();
    });
  }

  // <details> can't be forced open by CSS alone -- force it open at
  // desktop widths so the full tool list is visible by default there,
  // while leaving mobile's collapsed-by-default state (and any manual
  // toggle a visitor made) alone.
  // The static HTML ships with the group list open by default (so it
  // works before JS runs, and for JS-disabled visitors). This makes it
  // bidirectional: force it open at desktop widths, force it closed at
  // mobile widths -- both on initial load and on an actual breakpoint
  // crossing (matchMedia's "change" event only fires when crossing the
  // threshold, never on every resize within the same regime, so a
  // visitor's own manual toggle mid-session is never touched by this).
  const groupsDetails = shellRoot.querySelector("[data-admin-groups]");
  const desktopQuery = window.matchMedia("(min-width: 901px)");
  function syncGroupsOpen(mql) {
    if (groupsDetails) groupsDetails.open = mql.matches;
  }
  syncGroupsOpen(desktopQuery);
  desktopQuery.addEventListener("change", syncGroupsOpen);

  // ---- badge counts + session state, one request per page load --------
  // (sessionStorage-cached across the whole admin session so navigating
  // between tools doesn't refetch the underlying ~24-query dashboard
  // every click). This fetch also doubles as the shell's only auth
  // check -- a 401 here just means badges stay hidden, it never
  // redirects (see file header).

  function readCache() {
    try {
      const raw = window.sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.fetchedAt !== "number" || !parsed.data) return null;
      if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
      return parsed.data;
    } catch {
      return null;
    }
  }

  function writeCache(data) {
    try {
      window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), data }));
    } catch {
      // Badges just refetch next load -- not worth failing anything over.
    }
  }

  function setSessionState(value) {
    shellRoot.dataset.session = value;
    const label = shellRoot.querySelector("[data-admin-session-state]");
    if (label) label.textContent = value === "active" ? "Signed in" : "Sign in required";
  }

  function toneRank(priority) {
    return priority === "urgent" ? 0 : priority === "important" ? 1 : 2;
  }

  function applyBadges(data) {
    lastDashboardData = data;
    if (!data || !Array.isArray(data.tasks)) return;

    const byHref = new Map();
    data.tasks.forEach((task) => {
      if (!task || !task.href) return;
      const bucket = byHref.get(task.href) || [];
      bucket.push(task);
      byHref.set(task.href, bucket);
    });

    ITEMS.forEach((item) => {
      const matched = byHref.get(item.href) || [];
      const nodes = shellRoot.querySelectorAll(`[data-admin-badge="${item.href}"]`);
      if (matched.length === 0) {
        nodes.forEach((node) => { node.hidden = true; });
        return;
      }

      const tone = matched.reduce(
        (worst, task) => (toneRank(task.priority) < toneRank(worst) ? task.priority : worst),
        matched[0].priority
      );
      const count = matched.reduce((sum, task) => sum + (Number(task.count) || 0), 0);
      const titles = matched.map((task) => task.title).join(" · ");

      nodes.forEach((node) => {
        node.dataset.tone = tone;
        node.textContent = count > 99 ? "99+" : count > 0 ? String(count) : "";
        node.title = titles;
        node.hidden = !(count > 0 || tone === "urgent");
      });
    });
  }

  async function fetchDashboardSummary({ bypassCache = false } = {}) {
    if (!bypassCache) {
      const cached = readCache();
      if (cached) return cached;
    }

    let response;
    try {
      response = await fetch(DASHBOARD_ENDPOINT, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
    } catch {
      return null;
    }

    if (response.status === 401) {
      setSessionState("anonymous");
      return null;
    }

    if (!response.ok) return null;

    let data;
    try {
      data = await response.json();
    } catch {
      return null;
    }

    writeCache(data);
    return data;
  }

  // Memoized as a single shared promise (not just a sessionStorage read)
  // so a page that also wants this data -- the dashboard's stat strip
  // and needs-attention panel, via window.PodiumAdminShell.dashboard()
  // -- gets the exact same in-flight request rather than racing a
  // second fetch before the first one has had a chance to populate the
  // cache. bypassCache always starts a fresh request and replaces the
  // memoized promise.
  let dashboardPromise = null;

  function loadDashboard(options) {
    if (!options?.bypassCache && dashboardPromise) return dashboardPromise;

    dashboardPromise = (async () => {
      const data = await fetchDashboardSummary(options);
      if (data) {
        setSessionState("active");
        applyBadges(data);
      }
      return data;
    })();

    return dashboardPromise;
  }

  // ---- quick-jump search -------------------------------------------------

  const jumpDialog = document.querySelector("[data-admin-jump]");
  const jumpTrigger = shellRoot.querySelector("[data-admin-jump-open]");
  const jumpInput = document.querySelector("[data-admin-jump-input]");
  const jumpResults = document.querySelector("[data-admin-jump-results]");
  const jumpClose = document.querySelector("[data-admin-jump-close]");

  function openJump() {
    if (!jumpDialog) return;
    if (typeof jumpDialog.showModal === "function") jumpDialog.showModal();
    else jumpDialog.setAttribute("open", "");
    if (jumpInput) jumpInput.value = "";
    renderJumpResults("");
    window.setTimeout(() => jumpInput?.focus(), 0);
  }

  function closeJump() {
    if (!jumpDialog) return;
    if (typeof jumpDialog.close === "function") jumpDialog.close();
    else jumpDialog.removeAttribute("open");
  }

  if (jumpTrigger) jumpTrigger.addEventListener("click", openJump);
  if (jumpClose) jumpClose.addEventListener("click", closeJump);
  if (jumpDialog) {
    jumpDialog.addEventListener("click", (event) => {
      if (event.target === jumpDialog) closeJump();
    });
  }

  function matchScore(item, query) {
    const label = item.label.toLowerCase();
    const group = (item.group || "").toLowerCase();
    const keywords = (item.keywords || "").toLowerCase();
    const href = item.href.toLowerCase();
    if (label.startsWith(query)) return 0;
    if (label.includes(query)) return 1;
    if (keywords.includes(query) || href.includes(query) || group.includes(query)) return 2;
    return -1;
  }

  function renderJumpResults(query) {
    if (!jumpResults) return;
    const trimmed = query.trim().toLowerCase();
    const ranked = ITEMS
      .map((item) => ({ item, score: trimmed ? matchScore(item, trimmed) : 0 }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => a.score - b.score || a.item.label.localeCompare(b.item.label));

    if (ranked.length === 0) {
      jumpResults.innerHTML = '<li class="admin-jump-empty">No matching tool.</li>';
      return;
    }

    jumpResults.innerHTML = ranked
      .map((entry, index) => `<li data-active="${index === 0}"><a href="${entry.item.href}"><strong>${escapeHtml(entry.item.label)}</strong><span>${escapeHtml(entry.item.group || "")} — ${escapeHtml(entry.item.description || "")}</span></a></li>`)
      .join("");
  }

  if (jumpInput) {
    jumpInput.addEventListener("input", () => renderJumpResults(jumpInput.value));
    jumpInput.addEventListener("keydown", (event) => {
      const items = jumpResults ? Array.from(jumpResults.querySelectorAll("li")) : [];
      if (items.length === 0) return;
      const activeIndex = items.findIndex((li) => li.dataset.active === "true");

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const nextIndex = event.key === "ArrowDown"
          ? Math.min(items.length - 1, Math.max(0, activeIndex) + 1)
          : Math.max(0, activeIndex - 1);
        items.forEach((li, index) => { li.dataset.active = String(index === nextIndex); });
        items[nextIndex]?.scrollIntoView({ block: "nearest" });
      } else if (event.key === "Enter") {
        event.preventDefault();
        const target = items[activeIndex] || items[0];
        const link = target ? target.querySelector("a") : null;
        if (link) window.location.href = link.getAttribute("href");
      }
    });
  }

  // Ctrl/Cmd+K and "/" already open the PUBLIC site search dialog
  // (public/scripts/site.js, a bubble-phase document listener that calls
  // preventDefault()). Registering this one with { capture: true } makes
  // it run before site.js's handler ever fires, and stopPropagation()
  // there prevents that bubble-phase listener from running at all --
  // without this, both dialogs would try to open on the same keypress.
  document.addEventListener("keydown", (event) => {
    if (!document.body.classList.contains("admin-shell")) return;
    const target = event.target;
    const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
    const shortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
    const slash = event.key === "/" && !typing && !event.ctrlKey && !event.metaKey && !event.altKey;
    if (shortcut || slash) {
      event.preventDefault();
      event.stopPropagation();
      openJump();
    }
  }, { capture: true });

  // ---- opt-in helpers for other admin scripts (nothing requires these
  // this pass -- the 14 existing tool-page scripts are unmodified) ------

  let sessionPromise = null;
  function session() {
    if (!sessionPromise) {
      sessionPromise = fetch("/api/admin/auth/", { method: "GET", credentials: "same-origin" })
        .then((response) => response.json().catch(() => ({})))
        .then((data) => Boolean(data.authenticated))
        .catch(() => false);
    }
    return sessionPromise;
  }

  async function logout() {
    await fetch("/api/admin/auth/", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }).catch(() => {});
  }

  async function apiFetch(url, payload) {
    const response = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    });
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    if (!response.ok) {
      const error = new Error(data.error || "The request could not be completed.");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  window.PodiumAdminShell = {
    session,
    logout,
    apiFetch,
    navItems: () => ITEMS.slice(),
    findItem,
    // Returns the shell's own single dashboard-summary fetch (memoized
    // above) -- a page that also wants stats/tasks (public/scripts/
    // admin-dashboard.js) should call this instead of fetching
    // /api/admin/dashboard-summary/ itself, so the two never race into
    // two real network requests for the same page load.
    dashboard: () => loadDashboard(),
    refreshDashboard: () => loadDashboard({ bypassCache: true })
  };

  // ---- go -----------------------------------------------------------
  recordVisit();
  renderPersonalization();
  applyCollapsed();
  loadDashboard();
})();
