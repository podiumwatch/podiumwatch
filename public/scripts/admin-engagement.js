(() => {
  const authLoading = document.querySelector("[data-engagement-auth-loading]");
  const dashboard = document.querySelector("[data-engagement-dashboard]");
  const message = document.querySelector("[data-engagement-message]");
  const daysSelect = document.querySelector("[data-engagement-days]");
  const settingsForm = document.querySelector("[data-notification-settings-form]");
  const sponsorForm = document.querySelector("[data-sponsor-form]");
  const placementForm = document.querySelector("[data-placement-form]");
  const sponsorRows = document.querySelector("[data-sponsor-rows]");
  const placementRows = document.querySelector("[data-placement-rows]");
  const eventRows = document.querySelector("[data-notification-event-rows]");
  const deliveryRows = document.querySelector("[data-delivery-rows]");
  const topTeams = document.querySelector("[data-top-teams]");
  const activitySummary = document.querySelector("[data-activity-summary]");
  const sponsorPerformance = document.querySelector("[data-sponsor-performance]");
  const configuration = document.querySelector("[data-engagement-configuration]");
  const sendTestButton = document.querySelector("[data-send-test-email]");
  const processButton = document.querySelector("[data-process-notifications]");
  const processWeeklyButton = document.querySelector("[data-process-weekly]");
  const clearSponsorButton = document.querySelector("[data-clear-sponsor]");
  const clearPlacementButton = document.querySelector("[data-clear-placement]");

  if (!authLoading || !dashboard || !message || !daysSelect || !settingsForm || !sponsorForm || !placementForm || !sponsorRows || !placementRows || !eventRows || !deliveryRows || !topTeams || !activitySummary || !sponsorPerformance || !configuration || !sendTestButton || !processButton || !processWeeklyButton || !clearSponsorButton || !clearPlacementButton) {
    return;
  }

  let state = null;
  let busy = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showMessage(text, type = "success") {
    message.textContent = text;
    message.hidden = !text;
    message.style.background = type === "error" ? "rgba(220,38,38,.12)" : "rgba(0,191,99,.12)";
    message.style.color = type === "error" ? "#991b1b" : "";
  }

  function setBusy(value) {
    busy = value;
    document.querySelectorAll("button, input, select, textarea").forEach((element) => {
      if (!element.closest("[data-engagement-auth-loading]")) {
        element.disabled = value;
      }
    });
  }

  async function api(body) {
    const response = await fetch("/api/admin/engagement", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    if (response.status === 401) {
      throw new Error("Your admin session has expired. Sign in again from the main admin page.");
    }
    if (!response.ok) {
      throw new Error(data.error || "The engagement request failed.");
    }
    return data;
  }

  function formatDate(value) {
    if (!value) return "Not set";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Not set" : date.toLocaleString();
  }

  function toLocalInput(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
  }

  function statusBadge(value) {
    const status = String(value || "unknown");
    const className = ["failed", "ended"].includes(status)
      ? "engagement-status engagement-status-error"
      : ["paused", "draft", "queued", "processing"].includes(status)
        ? "engagement-status engagement-status-warning"
        : "engagement-status";
    return `<span class="${className}">${escapeHtml(status)}</span>`;
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = String(value ?? 0);
  }

  function row(name, count) {
    return `<div class="engagement-row"><span>${escapeHtml(name)}</span><strong>${escapeHtml(count)}</strong></div>`;
  }

  function renderSelects() {
    const sponsorSelect = placementForm.elements.sponsor_id;
    const teamSelect = placementForm.elements.team_id;
    const selectedSponsor = sponsorSelect.value;
    const selectedTeam = teamSelect.value;

    sponsorSelect.innerHTML = `<option value="">Choose sponsor</option>${(state.sponsors || []).map((sponsor) => `<option value="${escapeHtml(sponsor.id)}">${escapeHtml(sponsor.name)}</option>`).join("")}`;
    teamSelect.innerHTML = `<option value="">All teams</option>${(state.teams || []).map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.school_name)}${team.city ? ` · ${escapeHtml(team.city)}` : ""}</option>`).join("")}`;

    if ([...sponsorSelect.options].some((option) => option.value === selectedSponsor)) sponsorSelect.value = selectedSponsor;
    if ([...teamSelect.options].some((option) => option.value === selectedTeam)) teamSelect.value = selectedTeam;
  }

  function render() {
    const counts = state.counts || {};
    const analytics = state.analytics || {};
    const eventCounts = analytics.counts || {};
    setText("[data-stat-subscribers]", counts.subscribers || 0);
    setText("[data-stat-follows]", counts.active_follows || 0);
    setText("[data-stat-views]", eventCounts.team_profile_view || 0);
    setText("[data-stat-visitors]", analytics.unique_visitors || 0);
    setText("[data-stat-sponsor-clicks]", eventCounts.sponsor_click || 0);

    topTeams.innerHTML = (state.top_teams || [])
      .filter((item) => item.team)
      .map((item) => row(item.team.school_name, item.count))
      .join("") || "<p>No team activity has been recorded yet.</p>";

    const activityLabels = {
      team_profile_view: "Team profile views",
      directory_view: "Directory views",
      schedule_view: "Schedule activity",
      roster_view: "Roster activity",
      content_view: "Content activity",
      social_click: "Social link clicks",
      recruiting_click: "Recruiting clicks",
      follow_submit: "Follow requests",
      sponsor_impression: "Sponsor impressions",
      sponsor_click: "Sponsor clicks"
    };

    activitySummary.innerHTML = Object.entries(eventCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => row(activityLabels[key] || key, count))
      .join("") || "<p>No audience activity has been recorded yet.</p>";

    sponsorPerformance.innerHTML = (state.sponsor_performance || [])
      .filter((item) => item.sponsor)
      .map((item) => row(item.sponsor.name, item.count))
      .join("") || "<p>No sponsor activity has been recorded yet.</p>";

    const config = state.configuration || {};
    configuration.innerHTML = [
      ["Resend API key", config.resend_api_key],
      ["Sending email", config.resend_from_email],
      ["Reply to email", config.resend_reply_to],
      ["Cron security", config.cron_secret],
      ["Production site URL", Boolean(config.site_url)]
    ].map(([label, ready]) => `<div class="engagement-row"><span>${escapeHtml(label)}</span>${ready ? statusBadge("ready") : statusBadge("missing")}</div>`).join("");

    const settings = state.settings || {};
    settingsForm.elements.notification_mode.value = settings.notification_mode || "paused";
    settingsForm.elements.test_email.value = settings.test_email || "";
    settingsForm.elements.default_frequency.value = settings.default_frequency || "weekly";
    settingsForm.elements.emails_per_run.value = settings.emails_per_run || 100;
    settingsForm.elements.public_following_enabled.checked = Boolean(settings.public_following_enabled);
    settingsForm.elements.analytics_enabled.checked = Boolean(settings.analytics_enabled);
    settingsForm.elements.sponsor_display_enabled.checked = Boolean(settings.sponsor_display_enabled);

    sponsorRows.innerHTML = (state.sponsors || []).map((sponsor) => `<tr>
      <td><strong>${escapeHtml(sponsor.name)}</strong><br><small>${escapeHtml(sponsor.website_url || "")}</small></td>
      <td>${statusBadge(sponsor.status)}</td>
      <td>${escapeHtml(formatDate(sponsor.starts_at))}<br><small>${escapeHtml(formatDate(sponsor.ends_at))}</small></td>
      <td><div class="engagement-actions"><button class="button button-outline" type="button" data-edit-sponsor="${escapeHtml(sponsor.id)}">Edit</button><button class="button button-outline" type="button" data-delete-sponsor="${escapeHtml(sponsor.id)}">Delete</button></div></td>
    </tr>`).join("") || `<tr><td colspan="4">No sponsors have been added.</td></tr>`;

    placementRows.innerHTML = (state.placements || []).map((placement) => `<tr>
      <td>${escapeHtml(placement.sponsor?.name || "Sponsor")}</td>
      <td><strong>${escapeHtml(placement.placement_type)}</strong><br><small>${escapeHtml(placement.headline || "")}</small></td>
      <td>${escapeHtml(placement.team?.school_name || "All teams")}</td>
      <td>${statusBadge(placement.active ? "active" : "paused")}</td>
      <td><div class="engagement-actions"><button class="button button-outline" type="button" data-edit-placement="${escapeHtml(placement.id)}">Edit</button><button class="button button-outline" type="button" data-delete-placement="${escapeHtml(placement.id)}">Delete</button></div></td>
    </tr>`).join("") || `<tr><td colspan="5">No sponsor placements have been added.</td></tr>`;

    eventRows.innerHTML = (state.notification_events || []).map((event) => `<tr>
      <td>${escapeHtml(event.team?.school_name || "Team")}</td>
      <td><strong>${escapeHtml(event.title)}</strong><br><small>${escapeHtml(event.category)}</small></td>
      <td>${statusBadge(event.status)}${event.last_error ? `<br><small>${escapeHtml(event.last_error)}</small>` : ""}</td>
      <td>${escapeHtml(formatDate(event.created_at))}</td>
    </tr>`).join("") || `<tr><td colspan="4">No notification events have been created.</td></tr>`;

    deliveryRows.innerHTML = (state.deliveries || []).map((delivery) => `<tr>
      <td>${escapeHtml(delivery.recipient_email || "")}</td>
      <td>${escapeHtml(delivery.delivery_type)}</td>
      <td>${statusBadge(delivery.status)}${delivery.error_message ? `<br><small>${escapeHtml(delivery.error_message)}</small>` : ""}</td>
      <td>${escapeHtml(formatDate(delivery.sent_at || delivery.created_at))}</td>
    </tr>`).join("") || `<tr><td colspan="4">No delivery attempts have been recorded.</td></tr>`;

    renderSelects();
  }

  async function load() {
    try {
      state = await api({ action: "get_dashboard", days: Number(daysSelect.value) });
      render();
      authLoading.hidden = true;
      dashboard.hidden = false;
      showMessage("");
    } catch (error) {
      authLoading.innerHTML = `<h2>Engagement Center unavailable</h2><p>${escapeHtml(error.message)}</p><a class="button button-primary" href="/admin/">Return to admin</a>`;
    }
  }

  document.querySelectorAll("[data-engagement-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-engagement-tab]").forEach((item) => item.setAttribute("aria-selected", String(item === button)));
      document.querySelectorAll("[data-engagement-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.engagementPanel !== button.dataset.engagementTab;
      });
    });
  });

  settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(settingsForm);
    setBusy(true);
    try {
      await api({
        action: "save_settings",
        notification_mode: formData.get("notification_mode"),
        test_email: formData.get("test_email"),
        default_frequency: formData.get("default_frequency"),
        emails_per_run: Number(formData.get("emails_per_run")),
        public_following_enabled: formData.get("public_following_enabled") === "on",
        analytics_enabled: formData.get("analytics_enabled") === "on",
        sponsor_display_enabled: formData.get("sponsor_display_enabled") === "on"
      });
      showMessage("Engagement settings were saved.");
      await load();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  sponsorForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(sponsorForm).entries());
    setBusy(true);
    try {
      await api({ action: "save_sponsor", ...data });
      sponsorForm.reset();
      sponsorForm.elements.sponsor_id.value = "";
      showMessage("Sponsor was saved.");
      await load();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  placementForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(placementForm).entries());
    data.active = placementForm.elements.active.checked;
    setBusy(true);
    try {
      await api({ action: "save_placement", ...data });
      placementForm.reset();
      placementForm.elements.placement_id.value = "";
      placementForm.elements.priority.value = "100";
      placementForm.elements.active.checked = true;
      showMessage("Sponsor placement was saved.");
      await load();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  clearSponsorButton.addEventListener("click", () => {
    sponsorForm.reset();
    sponsorForm.elements.sponsor_id.value = "";
  });

  clearPlacementButton.addEventListener("click", () => {
    placementForm.reset();
    placementForm.elements.placement_id.value = "";
    placementForm.elements.priority.value = "100";
    placementForm.elements.active.checked = true;
    renderSelects();
  });

  sponsorRows.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit-sponsor]");
    const deleteButton = event.target.closest("[data-delete-sponsor]");

    if (editButton) {
      const sponsor = state.sponsors.find((item) => item.id === editButton.dataset.editSponsor);
      if (!sponsor) return;
      sponsorForm.elements.sponsor_id.value = sponsor.id;
      sponsorForm.elements.name.value = sponsor.name || "";
      sponsorForm.elements.status.value = sponsor.status || "draft";
      sponsorForm.elements.website_url.value = sponsor.website_url || "";
      sponsorForm.elements.logo_url.value = sponsor.logo_url || "";
      sponsorForm.elements.contact_name.value = sponsor.contact_name || "";
      sponsorForm.elements.contact_email.value = sponsor.contact_email || "";
      sponsorForm.elements.starts_at.value = toLocalInput(sponsor.starts_at);
      sponsorForm.elements.ends_at.value = toLocalInput(sponsor.ends_at);
      sponsorForm.elements.description.value = sponsor.description || "";
      sponsorForm.elements.notes.value = sponsor.notes || "";
      sponsorForm.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (deleteButton && window.confirm("Delete this sponsor and all of its placements?")) {
      setBusy(true);
      try {
        await api({ action: "delete_sponsor", sponsor_id: deleteButton.dataset.deleteSponsor });
        showMessage("Sponsor was deleted.");
        await load();
      } catch (error) {
        showMessage(error.message, "error");
      } finally {
        setBusy(false);
      }
    }
  });

  placementRows.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit-placement]");
    const deleteButton = event.target.closest("[data-delete-placement]");

    if (editButton) {
      const placement = state.placements.find((item) => item.id === editButton.dataset.editPlacement);
      if (!placement) return;
      placementForm.elements.placement_id.value = placement.id;
      placementForm.elements.sponsor_id.value = placement.sponsor_id || "";
      placementForm.elements.placement_type.value = placement.placement_type || "team_profile";
      placementForm.elements.team_id.value = placement.team_id || "";
      placementForm.elements.priority.value = placement.priority || 100;
      placementForm.elements.headline.value = placement.headline || "";
      placementForm.elements.button_label.value = placement.button_label || "Learn more";
      placementForm.elements.destination_url.value = placement.destination_url || "";
      placementForm.elements.image_url.value = placement.image_url || "";
      placementForm.elements.starts_at.value = toLocalInput(placement.starts_at);
      placementForm.elements.ends_at.value = toLocalInput(placement.ends_at);
      placementForm.elements.body_text.value = placement.body_text || "";
      placementForm.elements.active.checked = Boolean(placement.active);
      placementForm.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (deleteButton && window.confirm("Delete this sponsor placement?")) {
      setBusy(true);
      try {
        await api({ action: "delete_placement", placement_id: deleteButton.dataset.deletePlacement });
        showMessage("Sponsor placement was deleted.");
        await load();
      } catch (error) {
        showMessage(error.message, "error");
      } finally {
        setBusy(false);
      }
    }
  });

  async function runAction(action, successText) {
    setBusy(true);
    try {
      const result = await api({ action });
      showMessage(`${successText} ${JSON.stringify(result)}`);
      await load();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  sendTestButton.addEventListener("click", () => runAction("send_test", "Test email sent."));
  processButton.addEventListener("click", () => runAction("process_queue", "Immediate queue processed."));
  processWeeklyButton.addEventListener("click", () => runAction("process_weekly", "Weekly recap processed."));
  daysSelect.addEventListener("change", load);

  fetch("/api/admin/auth", { headers: { Accept: "application/json" } })
    .then((response) => response.json())
    .then((data) => {
      if (!data.authenticated) {
        authLoading.innerHTML = `<h2>Admin sign in required</h2><p>Sign in through the main Podium Watch admin page.</p><a class="button button-primary" href="/admin/">Open admin</a>`;
        return;
      }
      load();
    })
    .catch(() => {
      authLoading.innerHTML = `<h2>Admin access could not be confirmed</h2><p>Return to the main admin page and sign in again.</p><a class="button button-primary" href="/admin/">Open admin</a>`;
    });
})();
