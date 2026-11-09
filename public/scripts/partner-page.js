// "Partner with Podium Watch" (/sponsors/, WO-26): live audience numbers,
// packages with admin-set prices, and the inquiry form.
(() => {
  const root = document.querySelector("[data-partner-page]");
  if (!root) return;
  const stats = root.querySelector("[data-partner-stats]");
  const packages = root.querySelector("[data-partner-packages]");
  const select = root.querySelector("[data-partner-package-select]");
  const form = root.querySelector("[data-partner-form]");
  const message = root.querySelector("[data-partner-message]");
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const number = (value) => Number(value).toLocaleString("en-US");
  const stat = (value, label) => `<div class="pt-stat"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;

  fetch("/api/partner/", { headers: { Accept: "application/json" } })
    .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) throw new Error(data.error || "");
      const tiles = [];
      if (data.audience?.available) {
        tiles.push(stat(number(data.audience.visitors), `site visitors, last ${data.audience.window_days} days`));
        tiles.push(stat(number(data.audience.page_views), `page views, last ${data.audience.window_days} days`));
      }
      if (data.instagram?.followers) tiles.push(stat(number(data.instagram.followers), "Instagram followers"));
      if (data.instagram?.monthly_reach) tiles.push(stat(number(data.instagram.monthly_reach), `Instagram accounts reached${data.instagram.as_of ? `, month to ${new Date(`${data.instagram.as_of}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}`));
      stats.innerHTML = tiles.length ? tiles.join("") : '<p class="pt-note">Current audience numbers are available on request.</p>';

      const list = data.packages || [];
      packages.innerHTML = list.map((item) => `<article class="pt-package"><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p><p class="pt-price">${item.price ? escapeHtml(item.price) : "Ask for pricing"}</p></article>`).join("") || '<p class="pt-note">Ask us about current packages.</p>';
      select.innerHTML = '<option value="">Not sure yet</option>' + list.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("") + '<option value="other">Something else</option>';
    })
    .catch(() => {
      stats.innerHTML = '<p class="pt-note">Current audience numbers are available on request.</p>';
      packages.innerHTML = '<p class="pt-note">Ask us about current packages.</p>';
    });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]");
    const values = Object.fromEntries(new FormData(form).entries());
    if (!String(values.name || "").trim() || !String(values.email || "").includes("@")) {
      message.textContent = "Add your name and email so we can reply.";
      return;
    }
    button.disabled = true;
    message.textContent = "Sending.";
    try {
      const response = await fetch("/api/partner/inquiry/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Your message could not be sent right now.");
      form.reset();
      message.textContent = "Thanks. We'll reply by email soon.";
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
})();
