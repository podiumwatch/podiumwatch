// Admin: short links (src/pages/adminshortlinks.mjs, WO-34).
(() => {
  const root = document.querySelector("[data-sl]");
  if (!root) return;
  const loading = root.querySelector("[data-sl-loading]");
  const dashboard = root.querySelector("[data-sl-dashboard]");
  const form = root.querySelector("[data-sl-form]");
  const rows = root.querySelector("[data-sl-rows]");
  const message = root.querySelector("[data-sl-message]");

  const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  async function api(body) {
    const response = await fetch("/api/admin/short-links/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "That request failed.");
    return data;
  }

  function setMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? "#b42318" : "";
  }

  function render(data) {
    const links = data.links || [];
    rows.innerHTML = links.length ? links.map((link) => {
      const max = Math.max(1, ...link.hits_per_day);
      const bars = link.hits_per_day.map((count, index) => `<span title="${escapeHtml(data.days[index])}: ${count}" style="height:${Math.round((count / max) * 100)}%"></span>`).join("");
      return `<tr class="${link.active ? "" : "sl-off"}">
        <td><b>podiumwatch.org/${escapeHtml(link.path)}</b>${link.active ? "" : " (paused)"}</td>
        <td><a href="${escapeHtml(link.destination)}" target="_blank" rel="noopener">${escapeHtml(link.destination)}</a></td>
        <td>${escapeHtml(link.label || "")}${link.campaign ? `<br><small>${escapeHtml(link.campaign)}</small>` : ""}</td>
        <td><b>${link.hits_total}</b></td>
        <td><div class="sl-bars">${bars}</div></td>
        <td><button type="button" data-edit="${escapeHtml(link.path)}">Edit</button> <button type="button" data-toggle="${escapeHtml(link.path)}" data-active="${link.active ? "yes" : "no"}">${link.active ? "Pause" : "Turn on"}</button></td>
      </tr>`;
    }).join("") : '<tr><td colspan="6">No short links yet. Add the first one above.</td></tr>';
    rows.dataset.links = JSON.stringify(links);
  }

  async function load(note) {
    render(await api({ action: "list" }));
    setMessage(note || "");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      await api({ action: "save", ...values, path: String(values.path || "").trim().toLowerCase() });
      form.reset();
      await load(`Saved podiumwatch.org/${String(values.path).trim().toLowerCase()}.`);
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  rows.addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-edit]");
    if (edit) {
      const link = JSON.parse(rows.dataset.links || "[]").find((item) => item.path === edit.dataset.edit);
      if (link) {
        form.elements.path.value = link.path;
        form.elements.destination.value = link.destination;
        form.elements.label.value = link.label || "";
        form.elements.campaign.value = link.campaign || "";
        form.elements.destination.focus();
      }
      return;
    }
    const toggle = event.target.closest("[data-toggle]");
    if (!toggle) return;
    try {
      await api({ action: "set_active", path: toggle.dataset.toggle, active: toggle.dataset.active !== "yes" });
      await load(toggle.dataset.active === "yes" ? "Paused." : "Turned on.");
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  (async () => {
    try {
      await load();
      loading.hidden = true;
      dashboard.hidden = false;
    } catch (error) {
      loading.innerHTML = `<h2>Short links unavailable</h2><p>${escapeHtml(error.message)}</p><a class="button button-primary" href="/admin/">Open admin sign in</a>`;
    }
  })();
})();
