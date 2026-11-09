// Admin: Sponsor Report (src/pages/adminsponsorreport.mjs, WO-25).
(() => {
  const root = document.querySelector("[data-spr]");
  if (!root) return;
  const loading = root.querySelector("[data-spr-loading]");
  const dashboard = root.querySelector("[data-spr-dashboard]");
  const monthInput = root.querySelector("[data-spr-month]");
  const rows = root.querySelector("[data-spr-rows]");
  const message = root.querySelector("[data-spr-message]");
  const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const now = new Date();
  monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  async function load() {
    message.textContent = "Loading.";
    const response = await fetch("/api/admin/sponsor-report/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ month: monthInput.value })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "The report could not be loaded.");
    rows.innerHTML = (data.rows || []).map((row) => `<tr>
      <td><b>${escapeHtml(row.sponsor_name)}</b></td>
      <td>${escapeHtml(row.placement_label)}</td>
      <td class="num">${row.impressions.toLocaleString()}</td>
      <td class="num">${row.has_link ? row.clicks.toLocaleString() : "No link yet"}</td>
      <td class="num">${row.has_link ? `${row.click_rate}%` : ""}</td>
      <td>${row.top_pages.length ? `<ol>${row.top_pages.map((page) => `<li>${escapeHtml(page.path)} (${page.views.toLocaleString()})</li>`).join("")}</ol>` : "No views yet"}</td>
    </tr>`).join("") || '<tr><td colspan="6">No sponsors set up.</td></tr>';
    message.textContent = data.clicks_available ? `Report for ${data.month}.` : `Report for ${data.month}. Clicks need install/85_SITE_SPONSOR_CLICKS.sql to be run.`;
  }

  root.querySelector("[data-spr-load]").addEventListener("click", () => load().catch((error) => { message.textContent = error.message; }));
  root.querySelector("[data-spr-csv]").addEventListener("click", () => { window.location.href = `/api/admin/sponsor-report/?format=csv&month=${encodeURIComponent(monthInput.value)}`; });
  root.querySelector("[data-spr-print]").addEventListener("click", () => window.print());

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
