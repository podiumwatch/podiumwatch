(() => {
  const loadingBox = document.querySelector("[data-team-roster-loading]");
  const rosterRoot = document.querySelector("[data-team-roster]");
  const adminNotice = document.querySelector("[data-team-roster-admin-notice]");
  const teamName = document.querySelector("[data-team-roster-name]");
  const accountText = document.querySelector("[data-team-roster-account]");
  const profileLink = document.querySelector("[data-team-roster-profile]");
  const returnLink = document.querySelector("[data-team-roster-return]");
  const signOutButton = document.querySelector("[data-team-roster-signout]");
  const messageBox = document.querySelector("[data-team-roster-message]");
  const createSeasonForm = document.querySelector("[data-create-season-form]");
  const seasonSelect = document.querySelector("[data-season-select]");
  const seasonEmpty = document.querySelector("[data-season-empty]");
  const seasonForm = document.querySelector("[data-season-form]");
  const rosterSection = document.querySelector("[data-roster-section]");
  const rosterSeasonTitle = document.querySelector("[data-roster-season-title]");
  const rosterList = document.querySelector("[data-roster-list]");
  const rosterEmpty = document.querySelector("[data-roster-empty]");
  const addAthleteButton = document.querySelector("[data-add-athlete]");
  const rosterSearch = document.querySelector("[data-roster-search]");
  const rosterGenderFilter = document.querySelector("[data-roster-gender-filter]");
  const rosterStatusFilter = document.querySelector("[data-roster-status-filter]");
  const rolloverSection = document.querySelector("[data-rollover-section]");
  const rolloverForm = document.querySelector("[data-rollover-form]");
  const importSection = document.querySelector("[data-import-section]");
  const importForm = document.querySelector("[data-roster-import-form]");
  const templateButton = document.querySelector("[data-roster-template]");
  const importClearButton = document.querySelector("[data-roster-import-clear]");
  const importResults = document.querySelector("[data-roster-import-results]");
  const importPreview = document.querySelector("[data-roster-import-preview]");
  const importCommitButton = document.querySelector("[data-roster-import-commit]");
  const athleteDialog = document.querySelector("[data-athlete-dialog]");
  const athleteDialogTitle = document.querySelector("[data-athlete-dialog-title]");
  const athleteDialogClose = document.querySelector("[data-athlete-dialog-close]");
  const athleteForm = document.querySelector("[data-athlete-form]");
  const athleteSeasonSelect = document.querySelector("[data-athlete-season-select]");
  const athleteSeasonMoveNote = document.querySelector("[data-athlete-season-move-note]");
  const removeAthleteEntryButton = document.querySelector("[data-remove-athlete-entry]");
  const athleteGoalsSection = document.querySelector("[data-athlete-goals-section]");
  const saveAthleteGoalsButton = document.querySelector("[data-save-athlete-goals]");
  const athleteSocialSection = document.querySelector("[data-athlete-social-section]");
  const athleteSocialList = document.querySelector("[data-athlete-social-list]");
  const athleteSocialForm = document.querySelector("[data-athlete-social-form]");
  const athleteInviteSection = document.querySelector("[data-athlete-invite-section]");
  const athleteInviteList = document.querySelector("[data-athlete-invite-list]");
  const athleteInviteForm = document.querySelector("[data-athlete-invite-form]");
  const guardianInviteSection = document.querySelector("[data-guardian-invite-section]");
  const guardianInviteList = document.querySelector("[data-guardian-invite-list]");
  const guardianInviteForm = document.querySelector("[data-guardian-invite-form]");

  const summaryElements = {
    total: document.querySelector("[data-roster-total]"),
    completion: document.querySelector("[data-roster-completion]"),
    missingGrade: document.querySelector("[data-roster-missing-grade]"),
    missingEvents: document.querySelector("[data-roster-missing-events]"),
    progress: document.querySelector("[data-roster-progress]"),
    warning: document.querySelector("[data-roster-warning]")
  };

  const importCounts = {
    total: document.querySelector("[data-import-total]"),
    insert: document.querySelector("[data-import-new]"),
    add: document.querySelector("[data-import-add]"),
    update: document.querySelector("[data-import-update]"),
    error: document.querySelector("[data-import-error]")
  };

  const requiredElements = [
    loadingBox,
    rosterRoot,
    adminNotice,
    teamName,
    accountText,
    profileLink,
    returnLink,
    signOutButton,
    messageBox,
    createSeasonForm,
    seasonSelect,
    seasonEmpty,
    seasonForm,
    rosterSection,
    rosterSeasonTitle,
    rosterList,
    rosterEmpty,
    addAthleteButton,
    rosterSearch,
    rosterGenderFilter,
    rosterStatusFilter,
    rolloverSection,
    rolloverForm,
    importSection,
    importForm,
    templateButton,
    importClearButton,
    importResults,
    importPreview,
    importCommitButton,
    athleteDialog,
    athleteDialogTitle,
    athleteDialogClose,
    athleteForm,
    athleteSeasonSelect,
    athleteSeasonMoveNote,
    removeAthleteEntryButton,
    athleteGoalsSection,
    saveAthleteGoalsButton,
    athleteSocialSection,
    athleteSocialList,
    athleteSocialForm,
    athleteInviteSection,
    athleteInviteList,
    athleteInviteForm,
    guardianInviteSection,
    guardianInviteList,
    guardianInviteForm,
    ...Object.values(summaryElements),
    ...Object.values(importCounts)
  ];

  if (requiredElements.some((element) => !element)) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const teamId = String(params.get("id") || "").trim();
  const adminMode = params.get("admin") === "1";

  let client = null;
  let currentData = null;
  let currentImport = null;
  let busy = false;
  // Only set while editing an existing entry (null when adding a new
  // athlete) -- lets the season <select>'s change handler know whether
  // the coach has actually picked a DIFFERENT season than the one this
  // entry started in, so the move warning only shows when it's true.
  let editingOriginalSeasonId = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cleanText(value) {
    return String(value ?? "").trim();
  }

  function safeUrl(value) {
    const cleaned = cleanText(value);

    if (!cleaned) {
      return "";
    }

    try {
      const prepared = /^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned)
        ? cleaned
        : "https://" + cleaned;
      const url = new URL(prepared);

      if (!["http:", "https:"].includes(url.protocol)) {
        return "";
      }

      return url.href;
    } catch {
      return "";
    }
  }

  function showMessage(text, type = "success") {
    messageBox.textContent = text;
    messageBox.hidden = !text;
    messageBox.style.background = type === "error"
      ? "rgba(220,38,38,.12)"
      : "rgba(0,191,99,.1)";
    messageBox.style.color = type === "error" ? "#991b1b" : "";
  }

  function setBusy(value) {
    busy = value;
    rosterRoot.querySelectorAll("button, input, select, textarea").forEach((element) => {
      element.disabled = value;
    });
    athleteDialog.querySelectorAll("button, input, select, textarea").forEach((element) => {
      element.disabled = value;
    });

    if (!value) {
      importCommitButton.disabled = !currentImport?.canCommit;
    }
  }

  function formatProgramScope(value) {
    const labels = {
      combined: "Boys and Girls",
      boys: "Boys",
      girls: "Girls"
    };

    return labels[value] || value || "Boys and Girls";
  }

  function formatGender(value) {
    return value === "boys"
      ? "Boys"
      : value === "girls"
        ? "Girls"
        : "Program not listed";
  }

  function formatStatus(value) {
    const labels = {
      active: "Active",
      injured: "Injured",
      inactive: "Inactive",
      graduated: "Graduated",
      transferred: "Transferred",
      other: "Other"
    };

    return labels[value] || value || "Active";
  }

  function formatSeasonStatus(value) {
    const labels = {
      draft: "Private draft",
      published: "Published",
      archived: "Published archive"
    };

    return labels[value] || value || "Private draft";
  }

  function formatGrade(value) {
    const grade = Number(value);

    if (!Number.isInteger(grade)) {
      return "Grade not listed";
    }

    return `Grade ${grade}`;
  }

  function personalBestsText(value) {
    if (!value || typeof value !== "object") {
      return "";
    }

    return Object.entries(value)
      .map(([event, mark]) => `${event}: ${mark}`)
      .join("\n");
  }

  // Same m:ss(.s) parsing/formatting convention used throughout Race
  // Command Center (public/scripts/split-watch-plan.js etc.) --
  // duplicated locally rather than shared, matching how small helpers
  // like escapeHtml are already handled independently per file in this
  // codebase.
  function parseClockToSeconds(text) {
    const cleaned = String(text ?? "").trim();
    if (!cleaned) return null;

    const parts = cleaned.split(":").map((p) => p.trim());
    if (parts.some((p) => p === "" || Number.isNaN(Number(p)))) return null;

    let seconds;
    if (parts.length === 3) {
      seconds = Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
    } else if (parts.length === 2) {
      seconds = Number(parts[0]) * 60 + Number(parts[1]);
    } else if (parts.length === 1) {
      seconds = Number(parts[0]);
    } else {
      return null;
    }

    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  }

  function formatSecondsToClock(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return "";
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  async function renderAthleteGoals(entry) {
    athleteGoalsSection.querySelectorAll("[data-goal-bucket]").forEach((input) => { input.value = ""; });

    try {
      const data = await apiFetch({ action: "get_standard_goals", team_athlete_id: entry.athlete_id });
      for (const goal of data.goals || []) {
        const input = athleteGoalsSection.querySelector('[data-goal-bucket="' + CSS.escape(goal.distance_bucket) + '"]');
        if (input) input.value = formatSecondsToClock(goal.goal_seconds);
      }
    } catch {
      // A failed load just leaves the fields blank -- the coach can
      // still fill them in and save fresh values over nothing.
    }
  }

  saveAthleteGoalsButton.addEventListener("click", async () => {
    if (busy) return;
    const athleteId = athleteForm.elements.athlete_id.value;
    if (!athleteId) {
      showMessage("Save this athlete first, then set their standard goals.", "error");
      return;
    }

    const goalsByBucket = {};
    let hasInvalidEntry = false;

    athleteGoalsSection.querySelectorAll("[data-goal-bucket]").forEach((input) => {
      const raw = input.value.trim();
      if (!raw) {
        goalsByBucket[input.dataset.goalBucket] = null;
        return;
      }
      const seconds = parseClockToSeconds(raw);
      if (seconds === null) {
        hasInvalidEntry = true;
      } else {
        goalsByBucket[input.dataset.goalBucket] = seconds;
      }
    });

    if (hasInvalidEntry) {
      showMessage("Enter goal times as m:ss (e.g. 19:30), or leave a distance blank to clear it.", "error");
      return;
    }

    try {
      setBusy(true);
      const data = await apiFetch({ action: "save_standard_goals", team_athlete_id: athleteId, goals_by_bucket: goalsByBucket });
      for (const goal of data.goals || []) {
        const input = athleteGoalsSection.querySelector('[data-goal-bucket="' + CSS.escape(goal.distance_bucket) + '"]');
        if (input) input.value = formatSecondsToClock(goal.goal_seconds);
      }
      showMessage("Standard goals saved.");
    } catch (error) {
      showMessage(error.message || "Standard goals could not be saved.", "error");
    } finally {
      setBusy(false);
    }
  });

  function parseResponse(response, fallback) {
    return response.json()
      .catch(() => ({}))
      .then((data) => {
        if (!response.ok) {
          throw new Error(data.error || fallback);
        }

        return data;
      });
  }

  async function apiFetch(payload) {
    const endpoint = adminMode
      ? "/api/admin/team-rosters/"
      : "/api/team/roster/";
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json"
    };

    if (!adminMode) {
      const accessToken = await window.PodiumTeamAuth.getAccessToken();

      if (!accessToken) {
        window.location.replace("/team-login/");
        throw new Error("Team account sign in required.");
      }

      headers.Authorization = "Bearer " + accessToken;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        team_id: teamId,
        ...payload
      })
    });

    if (response.status === 401) {
      if (adminMode) {
        window.location.replace("/admin/");
      } else {
        if (client) {
          await client.auth.signOut();
        }
        window.location.replace("/team-login/");
      }
    }

    return parseResponse(response, "The roster request could not be completed.");
  }

  function getSelectedSeason() {
    return currentData?.selected_season || null;
  }

  function getEntryById(entryId) {
    return (currentData?.entries || []).find((entry) => entry.id === entryId) || null;
  }

  function fillForm(form, values) {
    Object.entries(values || {}).forEach(([name, value]) => {
      const field = form.elements[name];

      if (!field) {
        return;
      }

      if (field.type === "checkbox") {
        field.checked = Boolean(value);
      } else {
        field.value = value ?? "";
      }
    });
  }

  function formPayload(form) {
    const payload = {};

    [...form.elements].forEach((field) => {
      if (!field.name) {
        return;
      }

      payload[field.name] = field.type === "checkbox"
        ? field.checked
        : field.value;
    });

    return payload;
  }

  function renderSeasonControls() {
    const seasons = Array.isArray(currentData?.seasons) ? currentData.seasons : [];
    const selected = getSelectedSeason();

    seasonSelect.innerHTML = seasons.length > 0
      ? seasons.map((season) => (
          '<option value="' + escapeHtml(season.id) + '"' +
            (selected?.id === season.id ? " selected" : "") +
          '>' +
            escapeHtml(season.name) +
            " | " + escapeHtml(formatSeasonStatus(season.status)) +
            (season.is_current ? " | Current" : "") +
          "</option>"
        )).join("")
      : '<option value="">No seasons created</option>';

    seasonEmpty.hidden = seasons.length > 0;
    seasonForm.hidden = !selected;
    rosterSection.hidden = !selected;
    rolloverSection.hidden = !selected || seasons.length < 2;
    importSection.hidden = !selected;

    if (!selected) {
      return;
    }

    fillForm(seasonForm, {
      season_id: selected.id,
      name: selected.name,
      season_year: selected.season_year,
      academic_year_start: selected.academic_year_start,
      sport: selected.sport,
      program_scope: selected.program_scope,
      status: selected.status,
      start_date: selected.start_date,
      end_date: selected.end_date,
      notes: selected.notes,
      is_current: selected.is_current
    });

    rosterSeasonTitle.textContent = selected.name;
    rolloverForm.elements.source_season_id.value = selected.id;
    rolloverForm.elements.target_season_id.innerHTML = seasons
      .filter((season) => season.id !== selected.id)
      .map((season) => (
        '<option value="' + escapeHtml(season.id) + '">' +
          escapeHtml(season.name) +
          " | " + escapeHtml(formatSeasonStatus(season.status)) +
        "</option>"
      ))
      .join("");
  }

  function renderSummary() {
    const completion = currentData?.completion || {};
    const score = Math.max(0, Math.min(100, Number(completion.score) || 0));

    summaryElements.total.textContent = String(Number(completion.total) || 0);
    summaryElements.completion.textContent = `${score}%`;
    summaryElements.missingGrade.textContent = String(Number(completion.missing_grade) || 0);
    summaryElements.missingEvents.textContent = String(Number(completion.missing_events) || 0);
    summaryElements.progress.style.width = `${score}%`;

    const warnings = [];

    if (completion.missing_grade) {
      warnings.push(`${completion.missing_grade} missing grade`);
    }
    if (completion.missing_gender) {
      warnings.push(`${completion.missing_gender} missing program`);
    }
    if (completion.missing_events) {
      warnings.push(`${completion.missing_events} missing events`);
    }
    if (completion.missing_graduation_year) {
      warnings.push(`${completion.missing_graduation_year} missing graduation year`);
    }

    summaryElements.warning.textContent = warnings.length > 0
      ? "Roster warnings: " + warnings.join(", ") + "."
      : (Number(completion.total) > 0 ? "This roster has all required public information." : "Add athletes to begin the roster.");
  }

  function renderSocialBadges(links) {
    const values = Array.isArray(links) ? links : [];

    if (values.length === 0) {
      return "";
    }

    return '<div class="team-roster-badges">' +
      values.map((link) => (
        '<span class="team-roster-badge' +
          (link.published ? "" : " team-roster-badge-warning") +
        '">' + escapeHtml(link.platform || "Link") +
          (link.published ? "" : " | Private") +
        "</span>"
      )).join("") +
    "</div>";
  }

  function renderEntryCard(entry) {
    const athlete = entry.athlete || {};
    const displayName = athlete.display_name || [athlete.first_name, athlete.last_name].filter(Boolean).join(" ");
    const events = Array.isArray(entry.events) ? entry.events.join(", ") : "";
    const personalBests = personalBestsText(entry.personal_bests).replaceAll("\n", " | ");
    const visibilityWarning = !athlete.public_visible || !entry.public_visible;

    return (
      '<article class="team-roster-card" data-entry-card="' + escapeHtml(entry.id) + '">' +
        '<div class="team-roster-card-main">' +
          '<div>' +
            '<div class="team-roster-badges">' +
              '<span class="team-roster-badge">' + escapeHtml(formatGender(athlete.gender)) + '</span>' +
              '<span class="team-roster-badge">' + escapeHtml(formatGrade(entry.grade)) + '</span>' +
              '<span class="team-roster-badge team-roster-badge-dark">' + escapeHtml(formatStatus(entry.roster_status)) + '</span>' +
              (entry.captain ? '<span class="team-roster-badge">Captain</span>' : "") +
              (visibilityWarning ? '<span class="team-roster-badge team-roster-badge-warning">Hidden publicly</span>' : "") +
            '</div>' +
            '<h3 style="margin-top:10px;">' + escapeHtml(displayName || "Athlete") + '</h3>' +
            '<p>' + escapeHtml(athlete.graduation_year ? `Class of ${athlete.graduation_year}` : "Graduation year not listed") + '</p>' +
          '</div>' +
          '<div class="team-roster-card-actions">' +
            '<button class="button button-primary" type="button" data-edit-athlete="' + escapeHtml(entry.id) + '">Edit athlete</button>' +
          '</div>' +
        '</div>' +
        '<div class="team-roster-detail-grid">' +
          '<div class="team-roster-detail"><strong>Events</strong><span>' + escapeHtml(events || "Not listed") + '</span></div>' +
          '<div class="team-roster-detail"><strong>Personal bests</strong><span>' + escapeHtml(personalBests || "Not listed") + '</span></div>' +
          '<div class="team-roster-detail"><strong>College</strong><span>' + escapeHtml(athlete.college_commitment || "Not listed") + '</span></div>' +
        '</div>' +
        renderSocialBadges(entry.social_links) +
      '</article>'
    );
  }

  function filteredEntries() {
    const search = cleanText(rosterSearch.value).toLowerCase();
    const gender = rosterGenderFilter.value;
    const status = rosterStatusFilter.value;

    return (currentData?.entries || []).filter((entry) => {
      const athlete = entry.athlete || {};
      const name = [athlete.first_name, athlete.last_name, athlete.preferred_name, athlete.display_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (search && !name.includes(search)) {
        return false;
      }

      if (gender && athlete.gender !== gender) {
        return false;
      }

      if (status && entry.roster_status !== status) {
        return false;
      }

      return true;
    });
  }

  function renderRoster() {
    const entries = filteredEntries();
    rosterList.innerHTML = entries.map(renderEntryCard).join("");
    rosterEmpty.hidden = entries.length > 0;
  }

  function renderContext(data) {
    currentData = data;
    teamName.textContent = data.team?.school_name || "Team roster";
    profileLink.href = data.team?.slug
      ? "/team/?slug=" + encodeURIComponent(data.team.slug)
      : "/teams/";

    renderSeasonControls();
    renderSummary();
    renderRoster();
  }

  // Scoped to the same sport as the season currently being viewed -- a
  // cross country roster entry should only ever move between this
  // team's OTHER cross country seasons (its boys/girls counterpart),
  // never into an unrelated track season.
  function populateAthleteSeasonSelect() {
    const seasons = Array.isArray(currentData?.seasons) ? currentData.seasons : [];
    const currentSport = getSelectedSeason()?.sport;
    const eligible = currentSport ? seasons.filter((season) => season.sport === currentSport) : seasons;

    athleteSeasonSelect.innerHTML = eligible.map((season) => (
      '<option value="' + escapeHtml(season.id) + '">' +
        escapeHtml(season.name) + " | " + escapeHtml(formatSeasonStatus(season.status)) +
        (season.is_current ? " | Current" : "") +
      '</option>'
    )).join("");
  }

  function resetAthleteForm() {
    athleteForm.reset();
    populateAthleteSeasonSelect();
    athleteForm.elements.season_id.value = getSelectedSeason()?.id || "";
    editingOriginalSeasonId = null;
    athleteSeasonMoveNote.hidden = true;
    athleteForm.elements.sort_order.value = "0";
    athleteForm.elements.gender.value = "boys";
    athleteForm.elements.roster_status.value = "active";
    athleteForm.elements.athlete_public_visible.checked = true;
    athleteForm.elements.entry_public_visible.checked = true;
    athleteDialogTitle.textContent = "Add athlete";
    removeAthleteEntryButton.hidden = true;
    athleteGoalsSection.hidden = true;
    athleteGoalsSection.querySelectorAll("[data-goal-bucket]").forEach((input) => { input.value = ""; });
    athleteSocialSection.hidden = true;
    athleteSocialList.innerHTML = "";
    athleteSocialForm.reset();
    athleteInviteSection.hidden = true;
    athleteInviteList.innerHTML = "";
    athleteInviteForm.reset();
    guardianInviteSection.hidden = true;
    guardianInviteList.innerHTML = "";
    guardianInviteForm.reset();
  }

  const INVITE_STATUS_LABELS = {
    pending: "Invite sent", redeemed: "Account connected", revoked: "Invite revoked", expired: "Invite expired"
  };

  async function renderAthleteInvites(entry) {
    athleteInviteForm.elements.team_athlete_id.value = entry.athlete_id;
    athleteInviteList.innerHTML = '<div class="team-roster-empty">Loading invite status...</div>';

    try {
      const data = await apiFetch({ action: "list_athlete_invites", team_athlete_id: entry.athlete_id });
      const invites = data.invites || [];

      athleteInviteList.innerHTML = invites.length > 0
        ? invites.map((invite) => (
            '<article class="team-roster-card">' +
              '<div class="team-roster-card-main">' +
                '<div>' +
                  '<h3>' + escapeHtml(invite.invited_name) + '</h3>' +
                  '<p>' + escapeHtml(invite.invited_email) + '</p>' +
                  '<div class="team-roster-badges" style="margin-top:10px;">' +
                    '<span class="team-roster-badge' + (invite.status === "pending" ? "" : " team-roster-badge-dark") + '">' +
                      escapeHtml(INVITE_STATUS_LABELS[invite.status] || invite.status) +
                    '</span>' +
                  '</div>' +
                '</div>' +
                (invite.status === "pending"
                  ? '<div class="team-roster-card-actions">' +
                      '<button class="button button-outline" type="button" data-revoke-athlete-invite="' + escapeHtml(invite.id) + '">Revoke invite</button>' +
                    '</div>'
                  : (invite.status === "redeemed"
                      ? '<div class="team-roster-card-actions">' +
                          '<button class="button button-outline" type="button" data-revoke-athlete-access="' + escapeHtml(entry.athlete_id) + '">Revoke access</button>' +
                        '</div>'
                      : '')) +
              '</div>' +
            '</article>'
          )).join("")
        : '<div class="team-roster-empty">No invites sent yet.</div>';
    } catch (error) {
      athleteInviteList.innerHTML = '<div class="team-roster-empty">' + escapeHtml(error.message || "Invite status could not be loaded.") + '</div>';
    }
  }

  async function renderGuardianInvites(entry) {
    guardianInviteForm.elements.team_athlete_id.value = entry.athlete_id;
    guardianInviteList.innerHTML = '<div class="team-roster-empty">Loading invite status...</div>';

    try {
      const data = await apiFetch({ action: "list_guardian_invites", team_athlete_id: entry.athlete_id });
      const invites = data.invites || [];

      guardianInviteList.innerHTML = invites.length > 0
        ? invites.map((invite) => (
            '<article class="team-roster-card">' +
              '<div class="team-roster-card-main">' +
                '<div>' +
                  '<h3>' + escapeHtml(invite.invited_name) + '</h3>' +
                  '<p>' + escapeHtml(invite.invited_email) + '</p>' +
                  '<div class="team-roster-badges" style="margin-top:10px;">' +
                    '<span class="team-roster-badge' + (invite.status === "pending" ? "" : " team-roster-badge-dark") + '">' +
                      escapeHtml(INVITE_STATUS_LABELS[invite.status] || invite.status) +
                    '</span>' +
                  '</div>' +
                '</div>' +
                (invite.status === "pending"
                  ? '<div class="team-roster-card-actions">' +
                      '<button class="button button-outline" type="button" data-revoke-guardian-invite="' + escapeHtml(invite.id) + '">Revoke invite</button>' +
                    '</div>'
                  : (invite.status === "redeemed"
                      ? '<div class="team-roster-card-actions">' +
                          '<button class="button button-outline" type="button" data-revoke-guardian-access="' + escapeHtml(invite.id) + '">Revoke access</button>' +
                        '</div>'
                      : '')) +
              '</div>' +
            '</article>'
          )).join("")
        : '<div class="team-roster-empty">No guardian invites sent yet.</div>';
    } catch (error) {
      guardianInviteList.innerHTML = '<div class="team-roster-empty">' + escapeHtml(error.message || "Invite status could not be loaded.") + '</div>';
    }
  }

  function renderAthleteSocialLinks(entry) {
    const links = Array.isArray(entry.social_links) ? entry.social_links : [];
    athleteSocialList.innerHTML = links.length > 0
      ? links.map((link) => (
          '<article class="team-roster-card">' +
            '<div class="team-roster-card-main">' +
              '<div>' +
                '<h3>' + escapeHtml(link.label || link.platform || "Athlete link") + '</h3>' +
                '<p>' + escapeHtml(link.url || "") + '</p>' +
                '<div class="team-roster-badges" style="margin-top:10px;">' +
                  '<span class="team-roster-badge' + (link.published ? "" : " team-roster-badge-warning") + '">' +
                    (link.published ? "Published" : "Private") +
                  '</span>' +
                  '<span class="team-roster-badge">' +
                    (link.athlete_consent_confirmed ? "Athlete consent" : "Athlete consent missing") +
                  '</span>' +
                  '<span class="team-roster-badge">' +
                    (link.guardian_consent_confirmed ? "Guardian consent" : "Guardian consent missing") +
                  '</span>' +
                '</div>' +
              '</div>' +
              '<div class="team-roster-card-actions">' +
                '<button class="button button-outline" type="button" data-edit-athlete-social="' + escapeHtml(link.id) + '">Edit</button>' +
                '<button class="button button-outline" type="button" data-delete-athlete-social="' + escapeHtml(link.id) + '">Delete</button>' +
              '</div>' +
            '</div>' +
          '</article>'
        )).join("")
      : '<div class="team-roster-empty">No social or recruiting links have been added.</div>';

    athleteSocialForm.reset();
    fillForm(athleteSocialForm, {
      season_id: getSelectedSeason()?.id || "",
      athlete_id: entry.athlete_id,
      roster_entry_id: entry.id,
      sort_order: 0
    });
  }

  function openAthleteDialog(entry = null) {
    resetAthleteForm();

    if (entry) {
      const athlete = entry.athlete || {};
      athleteDialogTitle.textContent = "Edit athlete";
      editingOriginalSeasonId = getSelectedSeason()?.id || "";
      fillForm(athleteForm, {
        season_id: editingOriginalSeasonId,
        entry_id: entry.id,
        athlete_id: entry.athlete_id,
        first_name: athlete.first_name,
        last_name: athlete.last_name,
        preferred_name: athlete.preferred_name,
        gender: athlete.gender,
        grade: entry.grade,
        graduation_year: athlete.graduation_year,
        roster_status: entry.roster_status,
        sort_order: entry.sort_order,
        events: Array.isArray(entry.events) ? entry.events.join(", ") : "",
        personal_bests: personalBestsText(entry.personal_bests),
        photo_url: athlete.photo_url,
        hometown: athlete.hometown,
        college_commitment: athlete.college_commitment,
        bio: athlete.bio,
        notes: entry.notes,
        captain: entry.captain,
        athlete_public_visible: athlete.public_visible,
        entry_public_visible: entry.public_visible
      });
      removeAthleteEntryButton.hidden = false;
      athleteGoalsSection.hidden = false;
      renderAthleteGoals(entry);
      athleteSocialSection.hidden = false;
      renderAthleteSocialLinks(entry);
      athleteInviteSection.hidden = false;
      renderAthleteInvites(entry);
      guardianInviteSection.hidden = false;
      renderGuardianInvites(entry);
    }

    if (athleteDialog.open) {
      return;
    }

    if (typeof athleteDialog.showModal === "function") {
      athleteDialog.showModal();
    } else {
      athleteDialog.setAttribute("open", "");
    }
  }

  function closeAthleteDialog() {
    if (typeof athleteDialog.close === "function") {
      athleteDialog.close();
    } else {
      athleteDialog.removeAttribute("open");
    }
  }

  athleteSeasonSelect.addEventListener("change", () => {
    const changedFromOriginal = editingOriginalSeasonId !== null && athleteSeasonSelect.value !== editingOriginalSeasonId;
    athleteSeasonMoveNote.hidden = !changedFromOriginal;
  });

  function parseCsv(text) {
    const input = String(text || "").replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < input.length; index += 1) {
      const character = input[index];
      const next = input[index + 1];

      if (quoted) {
        if (character === '"' && next === '"') {
          field += '"';
          index += 1;
        } else if (character === '"') {
          quoted = false;
        } else {
          field += character;
        }
        continue;
      }

      if (character === '"') {
        quoted = true;
      } else if (character === ",") {
        row.push(field);
        field = "";
      } else if (character === "\n" || character === "\r") {
        if (character === "\r" && next === "\n") {
          index += 1;
        }
        row.push(field);
        field = "";
        if (row.some((value) => String(value).trim())) {
          rows.push(row);
        }
        row = [];
      } else {
        field += character;
      }
    }

    if (field !== "" || row.length > 0) {
      row.push(field);
      if (row.some((value) => String(value).trim())) {
        rows.push(row);
      }
    }

    if (quoted) {
      throw new Error("The CSV contains an unfinished quoted field.");
    }

    if (rows.length < 2) {
      throw new Error("The CSV must contain a heading row and at least one athlete.");
    }

    const headers = rows[0].map((header) => String(header).trim());

    return rows.slice(1).map((values) => {
      const result = {};
      headers.forEach((header, index) => {
        if (header) {
          result[header] = values[index] ?? "";
        }
      });
      return result;
    }).filter((item) => Object.values(item).some((value) => String(value).trim()));
  }

  function renderImportPlan(data) {
    const summary = data.summary || {};
    const plan = Array.isArray(data.plan) ? data.plan : [];

    Object.entries(importCounts).forEach(([key, element]) => {
      element.textContent = String(Number(summary[key]) || 0);
    });

    importPreview.innerHTML = plan.map((row) => (
      '<article class="team-roster-import-row' + (row.status === "error" ? " team-roster-import-row-error" : "") + '">' +
        '<div class="team-roster-badges">' +
          '<span class="team-roster-badge' + (row.status === "error" ? " team-roster-badge-warning" : "") + '">' +
            escapeHtml(row.status === "insert" ? "New athlete" : row.status === "add" ? "Add existing athlete" : row.status === "update" ? "Update roster" : "Error") +
          '</span>' +
          '<span class="team-roster-badge">Row ' + escapeHtml(row.row_number) + '</span>' +
        '</div>' +
        '<h3 style="margin:10px 0 0;">' + escapeHtml(`${row.first_name} ${row.last_name}`.trim() || "Unnamed athlete") + '</h3>' +
        '<p>' + escapeHtml([formatGender(row.gender), row.grade ? `Grade ${row.grade}` : "Grade missing", row.graduation_year ? `Class of ${row.graduation_year}` : "Graduation year missing"].join(" | ")) + '</p>' +
        (row.errors?.length ? '<ul>' + row.errors.map((error) => '<li>' + escapeHtml(error) + '</li>').join("") + '</ul>' : "") +
      '</article>'
    )).join("");

    const validCount = Number(summary.insert || 0) + Number(summary.add || 0) + Number(summary.update || 0);
    currentImport.canCommit = validCount > 0;
    importCommitButton.disabled = !currentImport.canCommit;
    importCommitButton.textContent = validCount === 1 ? "Import 1 athlete" : `Import ${validCount} athletes`;
    importResults.hidden = false;
  }

  function clearImport() {
    importForm.reset();
    currentImport = null;
    importPreview.innerHTML = "";
    importResults.hidden = true;
    importCommitButton.disabled = true;
    importCommitButton.textContent = "Import roster";
    Object.values(importCounts).forEach((element) => {
      element.textContent = "0";
    });
  }

  function downloadTemplate() {
    const headers = [
      "First Name",
      "Last Name",
      "Preferred Name",
      "Gender",
      "Grade",
      "Graduation Year",
      "Captain",
      "Events",
      "Personal Bests",
      "Roster Status",
      "Show Publicly",
      "College Commitment",
      "Photo URL",
      "Notes"
    ];
    const example = [
      "Jordan",
      "Runner",
      "",
      "Boys",
      "10",
      "2029",
      "No",
      "5K, 1600, 3200",
      "5K: 16:30.00; 1600: 4:35.00",
      "Active",
      "Yes",
      "",
      "",
      ""
    ];

    const escapeCsv = (value) => {
      const text = String(value ?? "");
      return /[",\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
    };

    const csv = [headers, example].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "podium-watch-roster-template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function loadRoster(seasonId = "") {
    const data = await apiFetch({
      action: "get",
      season_id: seasonId
    });
    renderContext(data);
  }

  createSeasonForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;

    try {
      setBusy(true);
      showMessage("Creating the roster season.");
      const data = await apiFetch({
        action: "create_season",
        ...formPayload(createSeasonForm)
      });
      renderContext(data);
      createSeasonForm.reset();
      showMessage("Roster season created.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  seasonSelect.addEventListener("change", async () => {
    if (busy || !seasonSelect.value) return;

    try {
      setBusy(true);
      await loadRoster(seasonSelect.value);
      clearImport();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  seasonForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;

    try {
      setBusy(true);
      showMessage("Saving season details.");
      const data = await apiFetch({
        action: "save_season",
        ...formPayload(seasonForm)
      });
      renderContext(data);
      showMessage("Season details saved.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  [rosterSearch, rosterGenderFilter, rosterStatusFilter].forEach((element) => {
    element.addEventListener(element === rosterSearch ? "input" : "change", renderRoster);
  });

  addAthleteButton.addEventListener("click", () => {
    if (!busy) openAthleteDialog();
  });

  rosterList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-edit-athlete]");
    if (!button || busy) return;
    const entry = getEntryById(button.dataset.editAthlete);
    if (entry) openAthleteDialog(entry);
  });

  athleteDialogClose.addEventListener("click", closeAthleteDialog);

  athleteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;

    try {
      setBusy(true);
      showMessage("Saving athlete information.");
      const data = await apiFetch({
        action: "save_athlete",
        ...formPayload(athleteForm)
      });
      renderContext(data);
      closeAthleteDialog();
      showMessage("Athlete information saved.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  removeAthleteEntryButton.addEventListener("click", async () => {
    const entryId = athleteForm.elements.entry_id.value;
    if (busy || !entryId) return;

    if (!window.confirm("Remove this athlete from the selected season? The athlete identity and approved links will remain available for other seasons.")) {
      return;
    }

    try {
      setBusy(true);
      const data = await apiFetch({
        action: "remove_entry",
        entry_id: entryId
      });
      renderContext(data);
      closeAthleteDialog();
      showMessage("Athlete removed from the selected season.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  athleteSocialList.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit-athlete-social]");
    const deleteButton = event.target.closest("[data-delete-athlete-social]");
    const entry = getEntryById(athleteForm.elements.entry_id.value);

    if (!entry || busy) return;

    if (editButton) {
      const link = entry.social_links.find((item) => item.id === editButton.dataset.editAthleteSocial);
      if (link) {
        fillForm(athleteSocialForm, {
          season_id: getSelectedSeason()?.id || "",
          athlete_id: entry.athlete_id,
          roster_entry_id: entry.id,
          link_id: link.id,
          platform: link.platform,
          label: link.label,
          url: link.url,
          sort_order: link.sort_order,
          athlete_consent_confirmed: link.athlete_consent_confirmed,
          guardian_consent_confirmed: link.guardian_consent_confirmed,
          approved_by_team: link.approved_by_team,
          published: link.published
        });
      }
    }

    if (deleteButton) {
      if (!window.confirm("Delete this athlete link?")) return;

      try {
        setBusy(true);
        const data = await apiFetch({
          action: "delete_social",
          season_id: getSelectedSeason()?.id,
          link_id: deleteButton.dataset.deleteAthleteSocial
        });
        renderContext(data);
        const refreshedEntry = getEntryById(entry.id);
        if (refreshedEntry) {
          openAthleteDialog(refreshedEntry);
        }
        showMessage("Athlete link deleted.");
      } catch (error) {
        showMessage(error.message, "error");
      } finally {
        setBusy(false);
      }
    }
  });

  athleteSocialForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;

    const entryId = athleteSocialForm.elements.roster_entry_id.value;

    try {
      setBusy(true);
      const data = await apiFetch({
        action: "save_social",
        ...formPayload(athleteSocialForm)
      });
      renderContext(data);
      const refreshedEntry = getEntryById(entryId);
      if (refreshedEntry) {
        openAthleteDialog(refreshedEntry);
      }
      showMessage("Athlete link saved.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  athleteInviteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;

    const entryId = athleteForm.elements.entry_id.value;
    const entry = getEntryById(entryId);
    if (!entry) return;

    try {
      setBusy(true);
      // This action returns { invite, inviteUrl, emailSent } -- NOT the
      // roster context shape renderContext() expects, so it's handled
      // directly here rather than passed to renderContext().
      const result = await apiFetch({
        action: "invite_athlete",
        ...formPayload(athleteInviteForm)
      });
      athleteInviteForm.reset();
      athleteInviteForm.elements.team_athlete_id.value = entry.athlete_id;
      await renderAthleteInvites(entry);
      showMessage(
        result.emailSent
          ? "Invite sent."
          : "Invite created, but the email could not be sent. Copy the link from the invite list to share it directly."
      );
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  athleteInviteList.addEventListener("click", async (event) => {
    const revokeInviteButton = event.target.closest("[data-revoke-athlete-invite]");
    const revokeAccessButton = event.target.closest("[data-revoke-athlete-access]");
    const entry = getEntryById(athleteForm.elements.entry_id.value);
    if (!entry || busy) return;

    if (revokeInviteButton) {
      if (!window.confirm("Revoke this invite? The link will stop working.")) return;
      try {
        setBusy(true);
        await apiFetch({ action: "revoke_athlete_invite", invite_id: revokeInviteButton.dataset.revokeAthleteInvite });
        await renderAthleteInvites(entry);
        showMessage("Invite revoked.");
      } catch (error) {
        showMessage(error.message, "error");
      } finally {
        setBusy(false);
      }
    }

    if (revokeAccessButton) {
      if (!window.confirm("Revoke this athlete's account access? They will no longer be able to see their race plans and results.")) return;
      try {
        setBusy(true);
        await apiFetch({ action: "revoke_athlete_access", team_athlete_id: revokeAccessButton.dataset.revokeAthleteAccess });
        await renderAthleteInvites(entry);
        showMessage("Athlete access revoked.");
      } catch (error) {
        showMessage(error.message, "error");
      } finally {
        setBusy(false);
      }
    }
  });

  guardianInviteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;

    const entryId = athleteForm.elements.entry_id.value;
    const entry = getEntryById(entryId);
    if (!entry) return;

    try {
      setBusy(true);
      // This action returns { invite, inviteUrl, emailSent } -- NOT the
      // roster context shape renderContext() expects, so it's handled
      // directly here rather than passed to renderContext().
      const result = await apiFetch({
        action: "invite_guardian",
        ...formPayload(guardianInviteForm)
      });
      guardianInviteForm.reset();
      guardianInviteForm.elements.team_athlete_id.value = entry.athlete_id;
      await renderGuardianInvites(entry);
      showMessage(
        result.emailSent
          ? "Guardian invite sent."
          : "Invite created, but the email could not be sent. Copy the link from the invite list to share it directly."
      );
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  guardianInviteList.addEventListener("click", async (event) => {
    const revokeInviteButton = event.target.closest("[data-revoke-guardian-invite]");
    const revokeAccessButton = event.target.closest("[data-revoke-guardian-access]");
    const entry = getEntryById(athleteForm.elements.entry_id.value);
    if (!entry || busy) return;

    if (revokeInviteButton) {
      if (!window.confirm("Revoke this invite? The link will stop working.")) return;
      try {
        setBusy(true);
        await apiFetch({ action: "revoke_guardian_invite", invite_id: revokeInviteButton.dataset.revokeGuardianInvite });
        await renderGuardianInvites(entry);
        showMessage("Invite revoked.");
      } catch (error) {
        showMessage(error.message, "error");
      } finally {
        setBusy(false);
      }
    }

    if (revokeAccessButton) {
      if (!window.confirm("Revoke this guardian's account access? They will no longer be able to see this athlete's race plans and results.")) return;
      try {
        setBusy(true);
        await apiFetch({ action: "revoke_guardian_access", invite_id: revokeAccessButton.dataset.revokeGuardianAccess });
        await renderGuardianInvites(entry);
        showMessage("Guardian access revoked.");
      } catch (error) {
        showMessage(error.message, "error");
      } finally {
        setBusy(false);
      }
    }
  });

  rolloverForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;

    const targetName = rolloverForm.elements.target_season_id.selectedOptions[0]?.textContent || "the target season";
    if (!window.confirm(`Copy the current roster into ${targetName}?`)) return;

    try {
      setBusy(true);
      showMessage("Moving the roster into the target season.");
      const data = await apiFetch({
        action: "rollover",
        ...formPayload(rolloverForm)
      });
      renderContext(data.context);
      const result = data.result || {};
      showMessage(
        `Roster moved. ${Number(result.copied_count) || 0} athletes copied, ${Number(result.already_present_count) || 0} already present, and ${Number(result.graduated_count) || 0} graduates archived.`
      );
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  templateButton.addEventListener("click", downloadTemplate);
  importClearButton.addEventListener("click", clearImport);

  importForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;

    const file = importForm.elements.roster_file.files?.[0];
    if (!file) {
      showMessage("Choose a roster CSV file first.", "error");
      return;
    }

    try {
      setBusy(true);
      showMessage("Reading and checking the roster file.");
      const rows = parseCsv(await file.text());
      currentImport = {
        rows,
        fileName: file.name,
        canCommit: false
      };
      const data = await apiFetch({
        action: "preview_import",
        season_id: getSelectedSeason()?.id,
        rows
      });
      renderImportPlan(data);
      showMessage("Roster preview is ready. Review the errors before importing.");
    } catch (error) {
      currentImport = null;
      importResults.hidden = true;
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  importCommitButton.addEventListener("click", async () => {
    if (busy || !currentImport?.canCommit) return;
    if (!window.confirm("Import these athletes into the selected roster season?")) return;

    try {
      setBusy(true);
      showMessage("Importing the roster.");
      const data = await apiFetch({
        action: "commit_import",
        confirm: true,
        season_id: getSelectedSeason()?.id,
        rows: currentImport.rows,
        file_name: currentImport.fileName
      });
      renderContext(data.context);
      const summary = data.summary || {};
      clearImport();
      showMessage(
        `Roster import complete. ${Number(summary.inserted_count) || 0} athletes were added and ${Number(summary.updated_count) || 0} roster entries were updated.`
      );
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  signOutButton.addEventListener("click", async () => {
    if (adminMode) {
      window.location.href = "/admin/team-rosters/";
      return;
    }

    if (client) {
      await client.auth.signOut();
    }
    window.location.replace("/team-login/");
  });

  async function initialize() {
    if (!teamId) {
      loadingBox.innerHTML = "<h2>Team roster not found</h2><p>This link does not include a team ID.</p>";
      return;
    }

    try {
      if (adminMode) {
        adminNotice.hidden = false;
        accountText.textContent = "Podium Watch admin access";
        returnLink.href = "/admin/team-rosters/";
        returnLink.textContent = "Admin roster list";
        signOutButton.textContent = "Return to admin";
      } else {
        client = await window.PodiumTeamAuth.getClient();
        const user = await window.PodiumTeamAuth.getUser();

        if (!user) {
          window.location.replace("/team-login/");
          return;
        }

        accountText.textContent = user.email || "Team account";
      }

      const currentYear = new Date().getFullYear();
      createSeasonForm.elements.season_year.value = currentYear;
      createSeasonForm.elements.academic_year_start.value = currentYear;

      const data = await apiFetch({ action: "get" });
      renderContext(data);
      loadingBox.hidden = true;
      rosterRoot.hidden = false;
    } catch (error) {
      loadingBox.innerHTML =
        "<h2>Roster manager unavailable</h2>" +
        "<p>" + escapeHtml(error.message || "The roster could not be loaded.") + "</p>" +
        '<p><a class="button button-primary" href="' + (adminMode ? "/admin/" : "/team-dashboard/") + '">Return</a></p>';
    }
  }

  initialize();
})();
