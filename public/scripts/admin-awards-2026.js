// Admin for the 2026 Athlete/Team of the Year (src/pages/adminawards2026.mjs).
(() => {
  const root = document.querySelector("[data-yoya]");
  if (!root) return;

  const loading = root.querySelector("[data-yoya-loading]");
  const dashboard = root.querySelector("[data-yoya-dashboard]");
  const list = root.querySelector("[data-yoya-list]");
  const filter = root.querySelector("[data-yoya-filter]");
  const message = root.querySelector("[data-yoya-message]");
  let categories = [];

  const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const STATUS = { upcoming: "Upcoming", nominations_open: "Nominations open", selecting_finalists: "Picking finalists", finalists_coming_soon: "Voting window, no finalists", voting_open: "Voting open", voting_closed: "Voting closed", published: "Published" };

  async function api(body) {
    const response = await fetch("/api/admin/awards-2026/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "That request failed.");
    return data;
  }

  function setMessage(text) {
    message.textContent = text;
  }

  function render() {
    const only = filter.value;
    list.innerHTML = categories.filter((category) => !only || category.slug === only).map((category) => `<section class="yoya-cat">
      <h2>${escapeHtml(category.label)}</h2>
      <p class="yoya-meta">${escapeHtml(STATUS[category.status] || category.status)} &middot; ${category.nomination_count} nomination${category.nomination_count === 1 ? "" : "s"} &middot; ${category.nominees.length} nominee${category.nominees.length === 1 ? "" : "s"} &middot; <a href="/awards/2026/${escapeHtml(category.slug)}/" target="_blank" rel="noopener">public page</a></p>
      ${category.nominees.length ? category.nominees.map((nominee, index) => `<details class="yoya-nominee">
        <summary><b>${index + 1}. ${escapeHtml(nominee.name)}</b><small>${escapeHtml(nominee.school || "")}</small>${nominee.coach_names && nominee.coach_names.length ? `<small>Coach: ${escapeHtml(nominee.coach_names.join(" / "))}</small>` : ""}<b>${nominee.count} nomination${nominee.count === 1 ? "" : "s"}</b></summary>
        <ul class="yoya-reasons">${nominee.nominations.map((item) => `<li><span>${item.coach_name ? `<b>${escapeHtml(item.coach_name)}:</b> ` : ""}${item.reason ? escapeHtml(item.reason) : "<em>No reason given</em>"}${item.first_name ? ` <small>(${escapeHtml(item.first_name)})</small>` : ""} <small>${escapeHtml(new Date(item.created_at).toLocaleString("en-US", { timeZone: "America/New_York" }))} ET${item.ip ? ` &middot; net ${escapeHtml(item.ip)}` : ""}</small></span><button type="button" data-delete="${escapeHtml(item.id)}">Delete</button></li>`).join("")}</ul>
      </details>`).join("") : '<p class="yoya-empty">No nominations yet.</p>'}
    </section>`).join("");
  }

  async function load() {
    const data = await api({ action: "summary" });
    categories = data.categories || [];
    const current = filter.value;
    filter.innerHTML = `<option value="">All ${categories.length} categories</option>` + categories.map((category) => `<option value="${escapeHtml(category.slug)}">${escapeHtml(category.label)} (${category.nomination_count})</option>`).join("");
    filter.value = current;
    render();
    setMessage(`Loaded ${categories.reduce((sum, category) => sum + category.nomination_count, 0)} nominations at ${new Date().toLocaleTimeString()}.`);
  }

  filter.addEventListener("change", render);
  root.querySelector("[data-yoya-csv]").addEventListener("click", () => { window.location.href = "/api/admin/awards-2026/?format=csv"; });
  root.querySelector("[data-yoya-refresh]").addEventListener("click", () => load().catch((error) => setMessage(error.message)));
  list.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete]");
    if (!button) return;
    if (button.dataset.confirm !== "yes") {
      button.dataset.confirm = "yes";
      button.textContent = "Tap again to delete";
      return;
    }
    button.disabled = true;
    try {
      await api({ action: "delete_nomination", nomination_id: button.dataset.delete });
      await load();
      setMessage("Nomination deleted.");
    } catch (error) {
      setMessage(error.message);
      button.disabled = false;
    }
  });

  (async () => {
    try {
      await load();
      loading.hidden = true;
      dashboard.hidden = false;
    } catch (error) {
      loading.innerHTML = `<h2>Admin access required</h2><p>${escapeHtml(error.message)}</p><a class="button button-primary" href="/admin/">Open admin sign in</a>`;
    }
  })();
})();
