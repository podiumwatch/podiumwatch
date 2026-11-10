// Admin: Logo Review (src/pages/adminteamlogos.mjs, WO-11).
(() => {
  const root = document.querySelector("[data-lr]");
  if (!root) return;
  const esc = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const message = root.querySelector("[data-lr-message]");
  async function api(body) {
    const r = await fetch("/api/admin/team-logos/", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(data.error || "That request failed."); e.status = r.status; throw e; }
    return data;
  }

  // A card: the logo thumbnail, its file, candidate schools as one-click
  // buttons, and a search for any other school.
  function card(image, title, detail, candidates) {
    if (!image) return "";
    const buttons = (candidates || []).filter((c) => c.team_slug).map((c) => `<button type="button" data-assign="${esc(image.key)}" data-team-slug="${esc(c.team_slug)}">${esc(c.school)}</button>`).join("");
    return `<div class="lr-card" data-card="${esc(image.key)}">
      <img src="${esc(image.thumb)}" alt="" loading="lazy" width="96" height="96">
      <b>${esc(title)}</b><small>${esc(detail)}</small>
      ${image.assigned ? '<span class="is-done">Assigned</span>' : ""}
      <div class="lr-pick">${buttons}<input type="search" placeholder="Search a school" data-search="${esc(image.key)}"><div class="lr-pick" data-results="${esc(image.key)}"></div></div>
    </div>`;
  }

  async function load() {
    const data = await api({ action: "state" });
    const c = data.coverage;
    root.querySelector("[data-lr-coverage]").textContent = `${c.with_logo} of ${c.teams} team pages have a logo (${c.percent}%). 2026 state meet teams: ${c.state_with_logo} of ${c.state_teams} (${c.state_percent}%).`;
    root.querySelector("[data-lr-review]").innerHTML = data.review.map((r) => card(r.image, r.name, `${r.file}. ${r.reason}.`, r.candidates)).join("") || "<p>Nothing to review.</p>";
    root.querySelector("[data-lr-unused]").innerHTML = data.unused.map((u) => card(u, u.source, "No map entry uses this file.", [])).join("") || "<p>None.</p>";
    root.querySelector("[data-lr-without]").innerHTML = data.without_logo.map((t) => `<li><a href="/teams/${encodeURIComponent(t.slug)}/" target="_blank" rel="noopener">${esc(t.school)}</a>${t.state_2026 ? " <small>(2026 state)</small>" : ""}</li>`).join("") || "<li>Every team page has a logo.</li>";
    root.querySelector("[data-lr-missing]").innerHTML = [...data.missing_files.map((m) => `<li>${esc(m.name)}: ${esc(m.map_file)} (not in the folder)</li>`), ...data.unconvertible.map((u) => `<li>${esc(u.name || "")}${u.name ? ": " : ""}${esc(u.file)} (can't convert)</li>`)].join("") || "<li>None.</li>";
    root.querySelector("[data-lr-loading]").hidden = true;
    root.querySelector("[data-lr-dashboard]").hidden = false;
  }

  let timer = null;
  root.addEventListener("input", (event) => {
    const input = event.target.closest("[data-search]");
    if (!input) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const out = root.querySelector(`[data-results="${input.dataset.search}"]`);
      if (input.value.trim().length < 2) { out.innerHTML = ""; return; }
      try {
        const { teams } = await api({ action: "search", query: input.value });
        out.innerHTML = teams.map((t) => `<button type="button" data-assign="${esc(input.dataset.search)}" data-team-id="${esc(t.team_id)}">${esc(t.school)}${t.has_logo ? " (replaces logo)" : ""}</button>`).join("") || "<small>No team page found.</small>";
      } catch (error) { out.textContent = error.message; }
    }, 250);
  });

  root.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-assign]");
    if (!button) return;
    button.disabled = true;
    try {
      let teamId = button.dataset.teamId;
      if (!teamId && button.dataset.teamSlug) {
        const { teams } = await api({ action: "search", query: button.textContent.replace(/\s*\(.*$/, "") });
        teamId = (teams.find((t) => t.slug === button.dataset.teamSlug) || {}).team_id;
      }
      if (!teamId) throw new Error("Couldn't find that team page.");
      const result = await api({ action: "assign", team_id: teamId, pool_key: button.dataset.assign });
      message.textContent = `Assigned. ${result.slug} now shows this logo.`;
      await load();
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
    }
  });

  load().catch((error) => {
    root.querySelector("[data-lr-loading]").innerHTML = error.status === 401 ? '<h2>Admin sign in required</h2><p><a href="/admin/">Sign in</a> first.</p>' : `<h2>Could not load</h2><p>${esc(error.message)}</p>`;
  });
})();
