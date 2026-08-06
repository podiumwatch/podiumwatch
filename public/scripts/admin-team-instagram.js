(() => {
  const root = document.querySelector("[data-team-ig-manager]");
  if (!root) return;

  const loading = root.querySelector("[data-team-ig-loading]");
  const dashboard = root.querySelector("[data-team-ig-dashboard]");
  const message = root.querySelector("[data-team-ig-message]");
  const filterForm = root.querySelector("[data-team-ig-filter-form]");
  const rows = root.querySelector("[data-team-ig-rows]");
  let busy = false;

  const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  function setMessage(text, tone = "success") {
    message.textContent = text;
    message.dataset.tone = tone;
  }

  function setBusy(value) {
    busy = value;
    root.querySelectorAll("button").forEach((button) => { button.disabled = value; });
  }

  async function api(body) {
    const response = await fetch("/api/admin/team-instagram/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "The team Instagram request failed.");
    return payload;
  }

  function formatDate(value) {
    if (!value) return "Unknown";
    return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function renderRows(changes) {
    rows.innerHTML = (changes || []).length
      ? changes.map((entry) => {
          const before = entry.before_data?.instagram_handle;
          const after = entry.after_data?.instagram_handle;
          const changeText = before
            ? `@${escapeHtml(before)} &rarr; ${after ? "@" + escapeHtml(after) : "(cleared)"}`
            : `(none) &rarr; ${after ? "@" + escapeHtml(after) : "(cleared)"}`;
          const teamName = entry.team?.school_name || "Unknown team";
          const teamLink = entry.team?.slug ? `<a href="/team/?slug=${encodeURIComponent(entry.team.slug)}" target="_blank" rel="noopener">${escapeHtml(teamName)}</a>` : escapeHtml(teamName);
          const isRevert = entry.actor_type === "admin_instagram_revert";
          return `<tr><td>${teamLink}</td><td>${changeText}</td><td>${escapeHtml(formatDate(entry.created_at))}</td><td><span class="team-ig-badge" data-actor="${escapeHtml(entry.actor_type)}">${isRevert ? "Admin revert" : "Public submission"}</span></td><td><button class="button button-outline" type="button" data-revert-change="${escapeHtml(entry.id)}" ${isRevert ? "disabled" : ""}>Revert to this</button></td></tr>`;
        }).join("")
      : '<tr><td colspan="5">No Instagram changes in this window.</td></tr>';
  }

  async function loadChanges() {
    if (busy) return;
    setBusy(true);

    try {
      const sinceDays = Number(new FormData(filterForm).get("since_days")) || 30;
      const data = await api({ action: "list", since_days: sinceDays, limit: 300 });
      renderRows(data.changes || []);
      setMessage(`${(data.changes || []).length} change${(data.changes || []).length === 1 ? "" : "s"} loaded.`);
    } catch (error) {
      setMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  rows.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-revert-change]");
    if (!button) return;
    if (!window.confirm("Revert this team's Instagram handle to its previous value? This will take effect immediately.")) return;

    setBusy(true);
    setMessage("Reverting.");

    try {
      await api({ action: "revert", change_id: button.dataset.revertChange });
      setMessage("Reverted. The change history now shows this as a new entry.");
      await loadChanges();
    } catch (error) {
      setMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loadChanges();
  });

  async function start() {
    try {
      await api({ action: "list", since_days: 1 });
      loading.hidden = true;
      dashboard.hidden = false;
      await loadChanges();
    } catch (error) {
      loading.innerHTML =
        "<h2>Admin access required</h2><p>" +
        escapeHtml(error.message) +
        '</p><a class="button button-primary" href="/admin/">Open admin sign in</a>';
    }
  }

  start();
})();
