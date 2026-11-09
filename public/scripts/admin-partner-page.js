// Admin: partner page settings and inquiries (src/pages/adminpartnerpage.mjs, WO-26).
(() => {
  const root = document.querySelector("[data-pp]");
  if (!root) return;
  const loading = root.querySelector("[data-pp-loading]");
  const dashboard = root.querySelector("[data-pp-dashboard]");
  const form = root.querySelector("[data-pp-form]");
  const packagesBox = root.querySelector("[data-pp-packages]");
  const inquiriesBox = root.querySelector("[data-pp-inquiries]");
  const message = root.querySelector("[data-pp-message]");
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let packages = [];

  async function api(body) {
    const response = await fetch("/api/admin/partner-page/", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "That request failed.");
    return data;
  }

  function render(data) {
    packages = data.packages || [];
    const settings = data.settings || {};
    form.elements.instagram_followers.value = settings.instagram_followers ?? "";
    form.elements.instagram_monthly_reach.value = settings.instagram_monthly_reach ?? "";
    form.elements.instagram_as_of.value = settings.instagram_as_of || "";
    packagesBox.innerHTML = packages.map((item) => {
      const saved = settings.packages?.[item.id] || {};
      return `<div class="pp-pkg" data-pkg="${escapeHtml(item.id)}"><div><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.description)}</small></div><input data-price placeholder="Price, e.g. $300 a season" value="${escapeHtml(saved.price || "")}" maxlength="80"><label><input type="checkbox" data-offered${saved.offered === false ? "" : " checked"}> Offered</label></div>`;
    }).join("");
    const inquiries = data.inquiries || [];
    inquiriesBox.innerHTML = inquiries.length ? inquiries.map((item) => `<div class="pp-inq"><b>${escapeHtml(item.name)}${item.organization ? `, ${escapeHtml(item.organization)}` : ""}</b><small>${escapeHtml(new Date(item.created_at).toLocaleString("en-US", { timeZone: "America/New_York" }))} ET &middot; ${escapeHtml(item.email)} &middot; ${escapeHtml(item.package || "No package chosen")} &middot; ${escapeHtml(item.status)}</small><p>${escapeHtml(item.message || "")}</p><div><button class="button button-outline" type="button" data-status="replied" data-id="${escapeHtml(item.id)}">Mark replied</button> <button class="button button-outline" type="button" data-status="closed" data-id="${escapeHtml(item.id)}">Close</button></div></div>`).join("") : "<p>No inquiries yet.</p>";
  }

  async function load() {
    render(await api({ action: "load" }));
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      action: "save_settings",
      instagram_followers: form.elements.instagram_followers.value,
      instagram_monthly_reach: form.elements.instagram_monthly_reach.value,
      instagram_as_of: form.elements.instagram_as_of.value,
      packages: Object.fromEntries([...packagesBox.querySelectorAll("[data-pkg]")].map((row) => [row.dataset.pkg, { price: row.querySelector("[data-price]").value, offered: row.querySelector("[data-offered]").checked }]))
    };
    try {
      await api(payload);
      message.textContent = "Saved. The public page updates within the hour.";
    } catch (error) {
      message.textContent = error.message;
    }
  });

  inquiriesBox.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-status]");
    if (!button) return;
    try {
      await api({ action: "set_inquiry_status", id: button.dataset.id, status: button.dataset.status });
      await load();
    } catch (error) {
      message.textContent = error.message;
    }
  });

  (async () => {
    try {
      await load();
      loading.hidden = true;
      dashboard.hidden = false;
    } catch (error) {
      loading.innerHTML = `<h2>Partner page unavailable</h2><p>${escapeHtml(error.message)}</p><a class="button button-primary" href="/admin/">Open admin sign in</a>`;
    }
  })();
})();
