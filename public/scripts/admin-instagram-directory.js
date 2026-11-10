// Admin: Instagram directory (src/pages/adminteaminstagram.mjs, WO-44).
// Every team with its division, approved labeled accounts (each opens the
// Instagram profile so it can be checked by eye), pending submissions,
// coverage overall and for the 2026 state meet teams, bulk add and export.
(() => {
  const root = document.querySelector("[data-igd]");
  if (!root) return;
  const rowsEl = root.querySelector("[data-igd-rows]");
  const coverageEl = root.querySelector("[data-igd-coverage]");
  const countEl = root.querySelector("[data-igd-count]");
  const filters = root.querySelector("[data-igd-filters]");
  const bulkForm = document.querySelector("[data-igd-bulk]");
  const bulkOut = document.querySelector("[data-igd-bulk-out]");
  let data = null;

  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  async function api(body) {
    const response = await fetch("/api/admin/team-instagram/", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "That request failed.");
    return result;
  }
  const handleLink = (account) => `<span class="team-ig-handle"><a href="${esc(account.url)}" target="_blank" rel="noopener noreferrer">@${esc(account.handle)}</a> <small>${esc(account.label || "No label")}</small></span>`;

  function render() {
    if (!data) return;
    const form = new FormData(filters);
    const q = String(form.get("q") || "").trim().toLowerCase();
    const show = String(form.get("show") || "all");
    const list = data.rows.filter((row) => {
      if (q && !row.school.toLowerCase().includes(q)) return false;
      if (show === "none") return !row.accounts.length;
      if (show === "pending") return row.pending.length > 0;
      if (show === "state") return row.state_2026;
      if (show === "state_none") return row.state_2026 && !row.accounts.length;
      return true;
    });
    rowsEl.innerHTML = list.length
      ? list.slice(0, 800).map((row) => `<tr><td><a href="/team/?slug=${encodeURIComponent(row.slug)}" target="_blank" rel="noopener">${esc(row.school)}</a>${row.state_2026 ? " <small>2026 state</small>" : ""}${row.published ? "" : " <small>(page not published)</small>"}</td><td>${esc(row.division || "")}</td><td>${row.accounts.length ? row.accounts.map(handleLink).join("") : '<span class="team-ig-note">No account yet</span>'}</td><td>${row.pending.map(handleLink).join("")}</td></tr>`).join("")
      : '<tr><td colspan="4">No teams match.</td></tr>';
    countEl.textContent = `${list.length} of ${data.rows.length} teams shown.`;
  }

  async function load() {
    try {
      data = await api({ action: "directory" });
      const c = data.coverage;
      coverageEl.textContent = `Coverage: ${c.with_account} of ${c.teams} teams (${c.percent}%) have an approved account; 2026 state meet teams: ${c.state_with_account} of ${c.state_teams} (${c.state_percent}%). ${c.accounts} approved accounts, ${c.pending} pending.${data.graph_api_connected ? " Instagram Graph API connected." : ""}`;
      if (window.pwInstagramGraphConnected) window.pwInstagramGraphConnected(data.graph_api_connected);
      render();
    } catch (error) {
      coverageEl.textContent = /label|source|submitter_email/.test(error.message) ? "Run install/90_TEAM_INSTAGRAM_DIRECTORY.sql first." : error.message;
      rowsEl.innerHTML = "";
    }
  }
  window.pwInstagramDirectoryReload = load;

  filters.querySelectorAll("[data-igd-export]").forEach((button) => button.addEventListener("click", () => { window.location.href = "/api/admin/team-instagram/?format=" + button.dataset.igdExport; }));
  filters.addEventListener("input", render);
  filters.addEventListener("submit", (event) => event.preventDefault());

  if (bulkForm) bulkForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = bulkForm.querySelector("button");
    button.disabled = true;
    bulkOut.textContent = "Adding...";
    try {
      const result = await api({ action: "bulk_add", text: bulkForm.elements.text.value });
      bulkOut.innerHTML = `<p><b>${result.added} added as pending, ${result.failed} not added.</b></p><ul>${result.results.map((r) => `<li${r.ok ? "" : ' style="color:#991b1b"'}>${esc(r.line)}: ${esc(r.message)}</li>`).join("")}</ul>`;
      if (result.added) bulkForm.elements.text.value = result.results.filter((r) => !r.ok).map((r) => r.line).join("\n");
      await load();
      if (window.pwInstagramPendingReload) window.pwInstagramPendingReload();
    } catch (error) {
      bulkOut.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  load();
})();
