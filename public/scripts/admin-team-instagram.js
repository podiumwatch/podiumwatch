(() => {
  const root = document.querySelector("[data-team-ig-manager]");
  if (!root) return;

  const loading = root.querySelector("[data-team-ig-loading]");
  const dashboard = root.querySelector("[data-team-ig-dashboard]");
  const message = root.querySelector("[data-team-ig-message]");
  const filterForm = root.querySelector("[data-team-ig-filter-form]");
  const rows = root.querySelector("[data-team-ig-rows]");
  const pending = root.querySelector("[data-team-ig-pending]");
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

  const LABELS = ["Boys XC", "Girls XC", "XC & Track", "Boys Track", "Girls Track", "Athletics"];
  let graphConnected = false;
  window.pwInstagramGraphConnected = (value) => { graphConnected = Boolean(value); };

  window.pwInstagramPendingReload = () => loadPending();
  async function loadPending() {
    try {
      const data = await api({ action: "pending" });
      const list = data.requests || [];
      pending.innerHTML = list.length
        ? list.map((item) => {
            const team = item.team_pages || {};
            const teamLink = team.slug ? `<a href="/team/?slug=${encodeURIComponent(team.slug)}" target="_blank" rel="noopener">${escapeHtml(team.school_name || "Team")}</a>` : escapeHtml(team.school_name || "Team");
            // Label can be corrected before approving (WO-44).
            const labelSelect = `<select data-label-for="${escapeHtml(item.id)}">${LABELS.map((label) => `<option${label === (item.label || "XC & Track") ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select>`;
            const lookup = graphConnected ? ` <button class="button button-outline" type="button" data-lookup="${escapeHtml(item.handle)}">Look up</button><span data-lookup-out="${escapeHtml(item.handle)}"></span>` : "";
            return `<tr><td>${teamLink}</td><td><a href="https://www.instagram.com/${encodeURIComponent(item.handle)}/" target="_blank" rel="noopener noreferrer">@${escapeHtml(item.handle)}</a>${lookup}<br><small>${escapeHtml(item.source === "bulk" ? "Bulk add" : "Public form")}</small></td><td>${labelSelect}</td><td>${escapeHtml(formatDate(item.created_at))}</td><td class="team-ig-actions"><button class="button button-dark" type="button" data-review="approve" data-request="${escapeHtml(item.id)}">Approve</button><button class="button button-outline" type="button" data-review="reject" data-request="${escapeHtml(item.id)}">Reject</button></td></tr>`;
          }).join("")
        : '<tr><td colspan="5">Nothing waiting for review.</td></tr>';
    } catch (error) {
      pending.innerHTML = `<tr><td colspan="5">${escapeHtml(error.message)}</td></tr>`;
    }
  }

  pending.addEventListener("click", async (event) => {
    const lookupButton = event.target.closest("[data-lookup]");
    if (lookupButton) {
      const out = pending.querySelector(`[data-lookup-out="${lookupButton.dataset.lookup}"]`);
      out.textContent = " Looking up...";
      try {
        const result = await api({ action: "discovery", handle: lookupButton.dataset.lookup });
        out.textContent = !result.connected ? " Graph API not connected." : result.found ? ` ${result.name || result.username}, ${Number(result.followers || 0).toLocaleString("en-US")} followers` : " Not found by the API (personal account or typo). Check it by eye.";
      } catch (error) { out.textContent = ` ${error.message}`; }
      return;
    }
    const button = event.target.closest("[data-review]");
    if (!button || busy) return;
    if (button.dataset.armed !== "yes") {
      button.dataset.armed = "yes";
      button.textContent = button.dataset.review === "approve" ? "Tap again to approve" : "Tap again to reject";
      return;
    }
    setBusy(true);
    try {
      const labelSelect = pending.querySelector(`[data-label-for="${button.dataset.request}"]`);
      const result = await api({ action: "review", request_id: button.dataset.request, decision: button.dataset.review, label: labelSelect ? labelSelect.value : null });
      setMessage(result.status === "approved" ? `Approved. @${result.handle} (${result.label}) is live on the team page.` : "Rejected.");
      if (window.pwInstagramDirectoryReload) window.pwInstagramDirectoryReload();
    } catch (error) {
      setMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
    await loadPending();
    await loadChanges();
  });

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
    if (button.dataset.armed !== "yes") {
      button.dataset.armed = "yes";
      button.textContent = "Tap again to revert";
      return;
    }

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
      await loadPending();
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
