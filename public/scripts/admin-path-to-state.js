(() => {
  const root = document.querySelector("[data-path-admin-manager]");
  if (!root) return;

  const loading = root.querySelector("[data-path-admin-loading]");
  const dashboard = root.querySelector("[data-path-admin-dashboard]");
  const message = root.querySelector("[data-path-admin-message]");
  const seasonInput = root.querySelector("[data-path-admin-season]");
  const searchInput = root.querySelector("[data-path-admin-search]");
  const searchButton = root.querySelector("[data-path-admin-search-button]");
  const teamList = root.querySelector("[data-path-admin-team-list]");
  const editorSection = root.querySelector("[data-path-admin-editor]");
  const selectedName = root.querySelector("[data-path-admin-selected-name]");
  const editorBody = root.querySelector("[data-path-admin-editor-body]");
  const thresholdRows = root.querySelector("[data-path-admin-threshold-rows]");

  if (!loading || !dashboard || !message || !seasonInput || !searchInput || !searchButton || !teamList || !editorSection || !selectedName || !editorBody || !thresholdRows) {
    return;
  }

  const STATUS_OPTIONS = [
    { value: "not_started", label: "Not started" },
    { value: "upcoming", label: "Upcoming" },
    { value: "qualified_team", label: "Qualified as a team" },
    { value: "qualified_individuals", label: "Individual qualifiers advanced" },
    { value: "eliminated", label: "Season ended here" }
  ];

  let busy = false;
  let selectedTeamId = null;

  const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  function setMessage(text, tone = "success") {
    message.textContent = text;
    message.dataset.tone = tone;
  }

  function setBusy(value) {
    busy = value;
    root.querySelectorAll("button").forEach((button) => { button.disabled = value; });
  }

  function currentSeasonYear() {
    return Number(seasonInput.value) || 2026;
  }

  async function api(body) {
    const response = await fetch("/api/admin/path-to-state/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "The Path to State admin request failed.");
    return payload;
  }

  function renderTeamList(teams) {
    teamList.innerHTML = (teams || []).length
      ? teams.map((team) => `
          <button type="button" class="path-admin-team-row" data-select-team="${escapeHtml(team.id)}" data-selected="${team.id === selectedTeamId ? "true" : "false"}">
            <span>${escapeHtml(team.school_name)}</span>
            <span class="path-admin-team-meta">${escapeHtml([team.athletic_district, team.boys_division, team.girls_division].filter(Boolean).join(" · "))}</span>
          </button>
        `).join("")
      : "<p>No teams found.</p>";
  }

  // One stage table per gender that has an available path -- the row set
  // comes directly from path.nodes, which the server already built
  // correctly (a Division 1 team's path has no "district" node at all, so
  // there is nothing to render or click for that stage here either).
  function genderSection(gender, label, path) {
    const rows = path.nodes.map((node) => `
      <tr data-path-admin-row data-gender="${gender}" data-stage="${escapeHtml(node.key)}">
        <td><strong>${escapeHtml(node.label)}</strong>${node.date_label ? `<br><span class="path-admin-team-meta">${escapeHtml(node.date_label)}</span>` : ""}</td>
        <td>${node.qualifying_text ? escapeHtml(node.qualifying_text) : '<span class="path-admin-team-meta">Not published</span>'}</td>
        <td><select data-field="status">${STATUS_OPTIONS.map((opt) => `<option value="${opt.value}" ${opt.value === node.status ? "selected" : ""}>${escapeHtml(opt.label)}</option>`).join("")}</select></td>
        <td><input type="number" min="1" data-field="individual_qualifier_count" value="${node.individual_qualifier_count ?? ""}" placeholder="#"></td>
        <td><input type="text" data-field="note" value="${escapeHtml(node.note || "")}" placeholder="Optional note"></td>
        <td>
          <button class="button button-primary" type="button" data-save-status>Save</button>
          <button class="button button-outline" type="button" data-clear-status>Clear</button>
        </td>
      </tr>
    `).join("");

    return `
      <h3 class="path-admin-gender-heading">${escapeHtml(label)} — ${escapeHtml(path.division_label || "Unknown division")}</h3>
      <div class="path-admin-stage-table-wrap">
        <table class="path-admin-stage-table">
          <thead><tr><th>Stage</th><th>Real qualifying rule</th><th>Status</th><th>Ind. qualifiers</th><th>Note</th><th>Action</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderEditor(data) {
    selectedName.textContent = data.team?.school_name || "Team";

    const sections = [];
    if (data.boys?.available) sections.push(genderSection("boys", "Boys", data.boys));
    if (data.girls?.available) sections.push(genderSection("girls", "Girls", data.girls));

    editorBody.innerHTML = sections.length
      ? sections.join("")
      : "<p>This team has no known cross country division for either gender yet for this season -- link it to an official school record or set a division on the team page first.</p>";

    editorSection.hidden = false;
  }

  async function search() {
    if (busy) return;
    setBusy(true);
    setMessage("Searching.");
    try {
      const data = await api({ action: "list_teams", search: searchInput.value, limit: 40 });
      renderTeamList(data.teams || []);
      setMessage(`${(data.teams || []).length} team(s) found.`);
    } catch (error) {
      setMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function loadTeamPath(teamId) {
    if (busy) return;
    setBusy(true);
    setMessage("Loading team.");
    try {
      const data = await api({ action: "get_team_path", team_id: teamId, season_year: currentSeasonYear() });
      renderEditor(data);
      setMessage("Loaded.");
    } catch (error) {
      setMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function loadThresholds() {
    try {
      const data = await api({ action: "list_thresholds", season_year: currentSeasonYear() });
      thresholdRows.innerHTML = (data.thresholds || []).length
        ? data.thresholds.map((row) => `
            <tr>
              <td>Division ${escapeHtml(row.division_number)}</td>
              <td>${escapeHtml(row.gender)}</td>
              <td>${escapeHtml(row.stage)}</td>
              <td>${escapeHtml(row.scope_name)}</td>
              <td>${row.qualifying_teams ?? "—"}</td>
              <td>${row.qualifying_individuals ?? "—"}</td>
            </tr>
          `).join("")
        : "<tr><td colspan=\"6\">No thresholds seeded for this season yet.</td></tr>";
    } catch {
      // Non-fatal -- this table is a seed-verification aid, not required
      // for the main search/set-status workflow.
    }
  }

  searchButton.addEventListener("click", search);
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      search();
    }
  });

  teamList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-select-team]");
    if (!button) return;
    selectedTeamId = button.dataset.selectTeam;
    teamList.querySelectorAll("[data-select-team]").forEach((row) => {
      row.dataset.selected = row.dataset.selectTeam === selectedTeamId ? "true" : "false";
    });
    loadTeamPath(selectedTeamId);
  });

  editorBody.addEventListener("click", async (event) => {
    const row = event.target.closest("[data-path-admin-row]");
    if (!row || !selectedTeamId) return;

    const gender = row.dataset.gender;
    const stage = row.dataset.stage;

    if (event.target.closest("[data-save-status]")) {
      const status = row.querySelector('[data-field="status"]').value;
      const individualQualifierCount = row.querySelector('[data-field="individual_qualifier_count"]').value;
      const note = row.querySelector('[data-field="note"]').value;

      setBusy(true);
      setMessage("Saving status.");
      try {
        await api({
          action: "set_status",
          team_id: selectedTeamId,
          gender,
          season_year: currentSeasonYear(),
          stage,
          status,
          individual_qualifier_count: individualQualifierCount || null,
          note: note || null
        });
        setMessage("Status saved. Public team and athlete pages pick up the change within a few minutes.");
        await loadTeamPath(selectedTeamId);
      } catch (error) {
        setMessage(error.message, "error");
      } finally {
        setBusy(false);
      }
    } else if (event.target.closest("[data-clear-status]")) {
      if (!window.confirm("Clear this stage's status back to the default?")) return;

      setBusy(true);
      setMessage("Clearing status.");
      try {
        await api({ action: "clear_status", team_id: selectedTeamId, gender, season_year: currentSeasonYear(), stage });
        setMessage("Status cleared.");
        await loadTeamPath(selectedTeamId);
      } catch (error) {
        setMessage(error.message, "error");
      } finally {
        setBusy(false);
      }
    }
  });

  seasonInput.addEventListener("change", () => {
    loadThresholds();
    if (selectedTeamId) loadTeamPath(selectedTeamId);
  });

  async function start() {
    try {
      await api({ action: "list_teams", limit: 1 });
      loading.hidden = true;
      dashboard.hidden = false;
      await loadThresholds();
      setMessage("Ready. Search for a team to get started.");
    } catch (error) {
      loading.innerHTML =
        "<h2>Admin access required</h2><p>" +
        escapeHtml(error.message) +
        '</p><a class="button button-primary" href="/admin/">Open admin sign in</a>';
    }
  }

  start();
})();
