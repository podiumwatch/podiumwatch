(() => {
  const root = document.querySelector("[data-statewide-admin]");

  if (!root) {
    return;
  }

  const authLoading = root.querySelector("[data-statewide-auth-loading]");
  const dashboard = root.querySelector("[data-statewide-dashboard]");
  const message = root.querySelector("[data-statewide-message]");
  const refreshButton = root.querySelector("[data-statewide-refresh]");
  const previewButton = root.querySelector("[data-statewide-preview]");
  const previewPanel = root.querySelector("[data-statewide-preview-panel]");
  const previewSummary = root.querySelector("[data-statewide-preview-summary]");
  const previewConflicts = root.querySelector("[data-statewide-preview-conflicts]");
  const commitForm = root.querySelector("[data-statewide-commit-form]");
  const conflictRows = root.querySelector("[data-statewide-conflict-rows]");
  const batchRows = root.querySelector("[data-statewide-batch-rows]");
  const installStatus = root.querySelector("[data-statewide-install-status]");
  const copyMigrationButton = root.querySelector("[data-copy-migration]");

  if (
    !authLoading ||
    !dashboard ||
    !message ||
    !refreshButton ||
    !previewButton ||
    !previewPanel ||
    !previewSummary ||
    !previewConflicts ||
    !commitForm ||
    !conflictRows ||
    !batchRows ||
    !installStatus ||
    !copyMigrationButton
  ) {
    return;
  }

  let state = null;
  let preview = null;
  let busy = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showMessage(text, tone = "success") {
    message.textContent = text;
    message.dataset.tone = tone;
    message.hidden = !text;
  }

  function setBusy(value) {
    busy = value;

    root
      .querySelectorAll("button, input, select")
      .forEach((element) => {
        element.disabled = value;
      });
  }

  async function api(payload) {
    const response = await fetch(
      "/api/admin/statewide-data",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );
    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (response.status === 401) {
      throw new Error(
        "Your admin session has expired. Sign in again from the main admin page."
      );
    }

    if (!response.ok) {
      const error = new Error(
        data.error ||
        "The statewide data request failed."
      );
      error.migration = data.migration || "";
      throw error;
    }

    return data;
  }

  function formatDate(value) {
    if (!value) {
      return "Not available";
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleString();
  }

  function badge(value) {
    const status = String(value || "unknown");
    const className =
      status === "open" || status === "failed"
        ? "statewide-admin-badge statewide-admin-badge-error"
        : status === "started"
          ? "statewide-admin-badge statewide-admin-badge-warning"
          : "statewide-admin-badge";

    return (
      '<span class="' + className + '">' +
        escapeHtml(status.replaceAll("_", " ")) +
      "</span>"
    );
  }

  function setText(selector, value) {
    const element = root.querySelector(selector);

    if (element) {
      element.textContent = String(value ?? 0);
    }
  }

  function summaryRow(label, value, warning = false) {
    return (
      '<div class="statewide-admin-row">' +
        "<span>" + escapeHtml(label) + "</span>" +
        '<strong class="' +
          (warning ? "statewide-admin-badge statewide-admin-badge-warning" : "") +
        '">' + escapeHtml(value) + "</strong>" +
      "</div>"
    );
  }

  function renderStatus() {
    const bundled = state?.bundled || {};
    const database = state?.database || {};

    setText("[data-statewide-bundled-schools]", bundled.schoolCount || 0);
    setText("[data-statewide-db-schools]", database.school_count || 0);
    setText("[data-statewide-db-divisions]", database.division_assignment_count || 0);
    setText("[data-statewide-db-sites]", database.tournament_site_count || 0);
    setText("[data-statewide-conflicts]", database.open_conflict_count || 0);
    setText("[data-statewide-moved]", bundled.changedDivisionCount || 0);

    if (state.installed) {
      installStatus.innerHTML =
        '<span class="statewide-admin-badge">Installed</span> ' +
        "The statewide database foundation is ready for preview and import.";
      previewButton.disabled = false;
    } else {
      installStatus.innerHTML =
        '<span class="statewide-admin-badge statewide-admin-badge-warning">Migration required</span> ' +
        "Run the supplied SQL migration in Supabase before importing records.";
      previewButton.disabled = true;
    }

    renderConflicts(state.conflicts || []);
    renderBatches(state.recent_batches || []);
  }

  function renderConflicts(conflicts) {
    conflictRows.innerHTML = conflicts.length
      ? conflicts.map((conflict) => (
          "<tr>" +
            "<td><strong>" + escapeHtml(conflict.field_name) + "</strong></td>" +
            "<td>" + escapeHtml(conflict.current_value || "Blank") + "</td>" +
            "<td>" + escapeHtml(conflict.official_value || "Blank") + "</td>" +
            "<td>" + badge(conflict.status) + "</td>" +
            "<td>" + escapeHtml(formatDate(conflict.created_at)) + "</td>" +
            "<td>" +
              (
                conflict.status === "open"
                  ? '<div class="statewide-admin-actions">' +
                      '<button class="button button-outline" type="button" data-conflict-action="accepted_official" data-conflict-id="' + escapeHtml(conflict.id) + '">Use official</button>' +
                      '<button class="button button-outline" type="button" data-conflict-action="kept_existing" data-conflict-id="' + escapeHtml(conflict.id) + '">Keep current</button>' +
                    "</div>"
                  : "Resolved"
              ) +
            "</td>" +
          "</tr>"
        )).join("")
      : '<tr><td colspan="6">No statewide data conflicts are currently recorded.</td></tr>';
  }

  function renderBatches(batches) {
    batchRows.innerHTML = batches.length
      ? batches.map((batch) => {
          const summary = batch.summary || {};
          const teams = summary.team_pages || {};

          return (
            "<tr>" +
              "<td>" + escapeHtml(formatDate(batch.created_at)) + "</td>" +
              "<td>" + badge(batch.status) + "</td>" +
              "<td>" + escapeHtml(summary.official_schools_imported ?? "Not finished") + "</td>" +
              "<td>" + escapeHtml(summary.official_divisions_imported ?? "Not finished") + "</td>" +
              "<td>" + escapeHtml(summary.official_track_sites_imported ?? "Not finished") + "</td>" +
              "<td>" + escapeHtml((teams.created ?? 0) + " created, " + (teams.linked_or_updated ?? 0) + " linked") + "</td>" +
            "</tr>"
          );
        }).join("")
      : '<tr><td colspan="6">No statewide imports have been run.</td></tr>';
  }

  function renderPreview(data) {
    preview = data;
    const summary = data.summary || {};

    previewSummary.innerHTML = [
      summaryRow("Official school inserts", summary.school_inserts || 0),
      summaryRow("Official school updates", summary.school_updates || 0),
      summaryRow("Division inserts", summary.division_inserts || 0),
      summaryRow("Division updates", summary.division_updates || 0),
      summaryRow("Track site inserts", summary.track_site_inserts || 0),
      summaryRow("Track site updates", summary.track_site_updates || 0),
      summaryRow("Existing team matches", summary.team_links || 0),
      summaryRow("Missing team pages", summary.missing_team_pages || 0),
      summaryRow("Division conflicts", summary.division_conflicts || 0, (summary.division_conflicts || 0) > 0)
    ].join("");

    const conflicts = data.samples?.division_conflicts || [];

    previewConflicts.innerHTML = conflicts.length
      ? '<div class="statewide-admin-table-wrap"><table class="statewide-admin-table"><thead><tr><th>School</th><th>Current division</th><th>Official division</th><th>OHSAA ID</th></tr></thead><tbody>' +
          conflicts.map((item) => (
            "<tr>" +
              "<td><strong>" + escapeHtml(item.school_name) + "</strong><br><small>" + escapeHtml(item.city) + "</small></td>" +
              "<td>" + escapeHtml(item.current_value) + "</td>" +
              "<td>" + escapeHtml(item.official_value) + "</td>" +
              "<td>" + escapeHtml(item.ohsaa_school_id) + "</td>" +
            "</tr>"
          )).join("") +
        "</tbody></table></div>"
      : "<p>No team division conflicts were found during preview.</p>";

    previewPanel.hidden = false;
  }

  async function loadStatus() {
    if (busy) {
      return;
    }

    setBusy(true);
    showMessage("Loading statewide data status.");

    try {
      state = await api({ action: "status" });
      authLoading.hidden = true;
      dashboard.hidden = false;
      renderStatus();
      showMessage(
        state.installed
          ? "Statewide data status loaded."
          : "The project files are installed. Run the Supabase migration before importing.",
        state.installed ? "success" : "warning"
      );
    } catch (error) {
      authLoading.innerHTML =
        "<h2>Admin access required</h2>" +
        "<p>" + escapeHtml(error.message) + "</p>" +
        '<a class="button button-primary" href="/admin/">Open main admin sign in</a>';
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  previewButton.addEventListener("click", async () => {
    if (busy || !state?.installed) {
      return;
    }

    setBusy(true);
    showMessage("Comparing official records with the current database.");

    try {
      const data = await api({ action: "preview" });
      renderPreview(data);
      showMessage("Import preview is ready. Review the team page options before committing.");
      previewPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  commitForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (busy || !preview) {
      return;
    }

    const confirmed = window.confirm(
      "Import the bundled official statewide data into Supabase now? This operation is additive and can be run again safely."
    );

    if (!confirmed) {
      return;
    }

    const values = new FormData(commitForm);
    setBusy(true);
    showMessage("Importing official school, division, tournament, and team link records.");

    try {
      const result = await api({
        action: "commit",
        create_missing_teams: values.get("create_missing_teams") === "on",
        publish_new_teams: values.get("publish_new_teams") === "on",
        overwrite_official_division: values.get("overwrite_official_division") === "on"
      });
      preview = null;
      previewPanel.hidden = true;
      showMessage(
        "Statewide import completed. " +
        (result.summary?.official_schools_imported || 0) +
        " school records and " +
        (result.summary?.official_track_sites_imported || 0) +
        " track regional sites were processed."
      );
      await loadStatus();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  root.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-conflict-action]");

    if (!button || busy) {
      return;
    }

    setBusy(true);
    showMessage("Saving the conflict resolution.");

    try {
      await api({
        action: "resolve_conflict",
        conflict_id: button.dataset.conflictId,
        status: button.dataset.conflictAction
      });
      showMessage("Conflict resolution saved.");
      await loadStatus();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  refreshButton.addEventListener("click", loadStatus);

  copyMigrationButton.addEventListener("click", async () => {
    const path = "install/01_STATEWIDE_FOUNDATION_DATABASE.sql";

    try {
      await navigator.clipboard.writeText(path);
      showMessage("Migration path copied: " + path);
    } catch {
      showMessage("Migration path: " + path, "warning");
    }
  });

  loadStatus();
})();
