(() => {
  const loadingBox = document.querySelector("[data-rcc-loading]");
  const root = document.querySelector("[data-rcc-root]");
  const teamNameEl = document.querySelector("[data-rcc-team-name]");
  const raceNameEl = document.querySelector("[data-rcc-race-name]");
  const statusBadge = document.querySelector("[data-rcc-status-badge]");
  const raceMetaEl = document.querySelector("[data-rcc-race-meta]");
  const messageBox = document.querySelector("[data-rcc-message]");
  const checkpointStrip = document.querySelector("[data-rcc-checkpoint-strip]");
  const rosterList = document.querySelector("[data-rcc-roster-list]");
  const rosterEmpty = document.querySelector("[data-rcc-roster-empty]");
  const rosterImportLink = document.querySelector("[data-rcc-roster-import-link]");
  const manualForm = document.querySelector("[data-rcc-manual-form]");
  const bulkToggleButton = document.querySelector("[data-rcc-bulk-toggle]");
  const bulkPanel = document.querySelector("[data-rcc-bulk-panel]");
  const bulkTextarea = document.querySelector("[data-rcc-bulk-textarea]");
  const bulkAddButton = document.querySelector("[data-rcc-bulk-add]");
  const saveParticipantsButton = document.querySelector("[data-rcc-save-participants]");
  const participantList = document.querySelector("[data-rcc-participant-list]");
  const participantEmpty = document.querySelector("[data-rcc-participant-empty]");
  const deleteRaceButton = document.querySelector("[data-rcc-delete-race]");
  const liveLinkButton = document.querySelector("[data-rcc-live-link]");

  const requiredElements = [
    loadingBox, root, teamNameEl, raceNameEl, statusBadge, raceMetaEl, messageBox,
    checkpointStrip, rosterList, rosterEmpty, rosterImportLink, manualForm,
    bulkToggleButton, bulkPanel, bulkTextarea, bulkAddButton, saveParticipantsButton,
    participantList, participantEmpty, deleteRaceButton, liveLinkButton
  ];

  if (requiredElements.some((el) => !el)) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const teamId = String(params.get("id") || "").trim();
  const sessionId = String(params.get("race") || "").trim();

  rosterImportLink.href = "/team-roster/?id=" + encodeURIComponent(teamId);

  const SESSIONS_ENDPOINT = "/api/race-command-center/sessions/";
  const PLAN_ENDPOINT = "/api/race-command-center/plan/";

  let detail = null;
  let rosterAthletes = [];
  let manualParticipants = []; // { manual_name, race_group } not yet saved, plus already-saved manual participants with id
  let openParticipantId = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showMessage(text, isError = false) {
    messageBox.textContent = text;
    messageBox.hidden = !text;
    messageBox.style.background = isError ? "rgba(220, 38, 38, 0.12)" : "rgba(0, 191, 99, 0.1)";
  }

  // Accepts "M:SS", "H:MM:SS", or a bare number of seconds. Returns null
  // for anything blank or invalid -- never guesses.
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

    return seconds > 0 ? seconds : null;
  }

  function formatSecondsToClock(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "";
    if (window.PodiumPaceSplits && typeof window.PodiumPaceSplits.formatWholeTime === "function") {
      return window.PodiumPaceSplits.formatWholeTime(seconds);
    }
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

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

  async function apiFetch(endpoint, payload) {
    // Don't gate on a Supabase access token here -- a race-day access code
    // visitor has no Supabase session at all, but does have an HttpOnly
    // cookie the server will accept. Send the bearer token when we have one
    // (a real coach account) and let the browser send the cookie either way;
    // only redirect if the server actually says the request isn't allowed.
    const accessToken = await window.PodiumTeamAuth.getAccessToken();
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json"
    };
    if (accessToken) headers.Authorization = "Bearer " + accessToken;

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ team_id: teamId, session_id: sessionId, ...payload })
    });

    if (response.status === 401) {
      window.location.replace("/race-command-center/join/");
    }

    return parseResponse(response, "The request could not be completed.");
  }

  const STATUS_LABELS = {
    draft: "Draft", scheduled: "Scheduled", live: "Live",
    finished: "Finished", reviewed: "Reviewed", cancelled: "Cancelled"
  };

  function renderHeader() {
    const session = detail.session;
    teamNameEl.textContent = detail.team.school_name;
    raceNameEl.textContent = session.name;
    statusBadge.textContent = STATUS_LABELS[session.status] || session.status;
    statusBadge.className = "rcc-badge" +
      (session.status === "live" ? " rcc-badge-live" : "") +
      (session.status === "finished" || session.status === "reviewed" ? " rcc-badge-finished" : "");

    const unit = session.distance_unit_display;
    const unitMeters = unit === "miles" ? 1609.344 : (unit === "km" ? 1000 : 1);
    const distanceInUnit = (session.distance_meters / unitMeters).toFixed(2).replace(/\.00$/, "");
    raceMetaEl.textContent = session.race_date + " · " + distanceInUnit + " " + unit + (session.race_type ? " · " + session.race_type : "");

    deleteRaceButton.hidden = session.status !== "draft";
    liveLinkButton.disabled = false;
    liveLinkButton.onclick = () => {
      window.location.href = "/race-command-center/live/?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(sessionId);
    };

    checkpointStrip.innerHTML = detail.checkpoints.map((c) => {
      const label = c.is_finish ? c.label + " (Finish)" : c.label;
      return '<span class="rcc-checkpoint-chip">' + escapeHtml(label) + "</span>";
    }).join("");
  }

  function isParticipantSelected(athleteId) {
    return detail.participants.some((p) => p.team_athlete_id === athleteId);
  }

  function renderRoster() {
    if (rosterAthletes.length === 0) {
      rosterList.innerHTML = "";
      rosterEmpty.hidden = false;
    } else {
      rosterEmpty.hidden = true;
      rosterList.innerHTML = rosterAthletes.map((athlete) => {
        const name = athlete.display_name || (athlete.first_name + " " + athlete.last_name);
        const checked = isParticipantSelected(athlete.id) ? " checked" : "";
        return (
          '<label class="rcc-roster-row">' +
            '<input type="checkbox" class="rcc-roster-checkbox" value="' + escapeHtml(athlete.id) + '"' + checked + '>' +
            '<span>' + escapeHtml(name) + (athlete.graduation_year ? " (" + escapeHtml(String(athlete.graduation_year)) + ")" : "") + '</span>' +
          '</label>'
        );
      }).join("");
    }

    // Manual participants already saved for this session -- shown as a
    // removable list beneath the roster checkboxes.
    const existingManual = detail.participants.filter((p) => !p.team_athlete_id);
    const manualHtml = existingManual.map((p) => (
      '<label class="rcc-roster-row">' +
        '<input type="checkbox" class="rcc-manual-keep" value="' + escapeHtml(p.id) + '" checked>' +
        '<span>' + escapeHtml(p.manual_name) + ' (manual)</span>' +
      '</label>'
    )).join("");

    const newManualHtml = manualParticipants.map((p, index) => (
      '<label class="rcc-roster-row">' +
        '<input type="checkbox" class="rcc-manual-new" data-index="' + index + '" checked>' +
        '<span>' + escapeHtml(p.manual_name) + ' (manual, unsaved)</span>' +
      '</label>'
    )).join("");

    rosterList.innerHTML += manualHtml + newManualHtml;
  }

  manualForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(manualForm);
    const name = String(formData.get("manual_name") || "").trim();
    if (!name) return;
    manualParticipants.push({ manual_name: name, race_group: String(formData.get("race_group") || "").trim() });
    manualForm.reset();
    renderRoster();
  });

  bulkToggleButton.addEventListener("click", () => {
    bulkPanel.hidden = !bulkPanel.hidden;
    if (!bulkPanel.hidden) bulkTextarea.focus();
  });

  // Paste-many-names: one runner per line, an optional group after the
  // first comma (e.g. "Jordan Smith, Varsity"). Feeds the exact same
  // in-memory manualParticipants list the single "Add" form already
  // uses, so it rides the existing checkbox-preview + Save participants
  // flow rather than needing its own save path.
  bulkAddButton.addEventListener("click", () => {
    const lines = bulkTextarea.value.split("\n");
    let added = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const commaIndex = line.indexOf(",");
      const name = commaIndex === -1 ? line : line.slice(0, commaIndex).trim();
      const group = commaIndex === -1 ? "" : line.slice(commaIndex + 1).trim();
      if (!name) continue;
      manualParticipants.push({ manual_name: name, race_group: group });
      added += 1;
    }

    if (added === 0) {
      showMessage("Paste at least one runner name, one per line.", true);
      return;
    }

    bulkTextarea.value = "";
    bulkPanel.hidden = true;
    renderRoster();
    showMessage(
      added + (added === 1 ? " runner" : " runners") +
      " added below -- review the list, then click Save participants to confirm."
    );
  });

  saveParticipantsButton.addEventListener("click", async () => {
    showMessage("");
    const checkedAthleteIds = [...rosterList.querySelectorAll(".rcc-roster-checkbox:checked")].map((el) => el.value);
    const keptManualIds = new Set([...rosterList.querySelectorAll(".rcc-manual-keep:checked")].map((el) => el.value));
    const newManualChecked = [...rosterList.querySelectorAll(".rcc-manual-new:checked")].map((el) => manualParticipants[Number(el.dataset.index)]);

    const existingManual = detail.participants.filter((p) => !p.team_athlete_id && keptManualIds.has(p.id));

    const desired = [
      ...checkedAthleteIds.map((id) => ({ team_athlete_id: id })),
      ...existingManual.map((p) => ({ id: p.id, manual_name: p.manual_name, race_group: p.race_group })),
      ...newManualChecked.map((p) => ({ manual_name: p.manual_name, race_group: p.race_group }))
    ];

    try {
      await apiFetch(PLAN_ENDPOINT, { action: "save_participants", participants: desired });
      manualParticipants = [];
      showMessage("Participants saved.");
      await refresh();
    } catch (error) {
      showMessage(error.message || "Participants could not be saved.", true);
    }
  });

  function participantName(participant) {
    if (participant.team_athlete_id) {
      const athlete = rosterAthletes.find((a) => a.id === participant.team_athlete_id);
      return athlete ? (athlete.display_name || athlete.first_name + " " + athlete.last_name) : "Roster athlete";
    }
    return participant.manual_name;
  }

  function goalsFor(participantId) {
    return detail.goals.filter((g) => g.race_participant_id === participantId);
  }

  function targetsFor(participantId) {
    return detail.targets.filter((t) => t.race_participant_id === participantId);
  }

  function renderParticipantCard(participant) {
    const goals = goalsFor(participant.id);
    const goalA = goals.find((g) => g.goal_slot === "A");
    const goalB = goals.find((g) => g.goal_slot === "B");
    const goalC = goals.find((g) => g.goal_slot === "C");
    const strategy = participant.strategy || "even_pace";
    const isOpen = openParticipantId === participant.id;
    const targets = targetsFor(participant.id);

    const customRows = detail.checkpoints.map((c) => {
      const target = targets.find((t) => t.race_checkpoint_id === c.id && t.goal_slot === "A");
      return (
        '<div class="rcc-custom-target-row">' +
          '<span>' + escapeHtml(c.label) + (c.is_finish ? " (Finish)" : "") + '</span>' +
          '<input type="text" class="rcc-custom-target-input" data-checkpoint-id="' + escapeHtml(c.id) + '" placeholder="m:ss" value="' + (target ? escapeHtml(formatSecondsToClock(target.target_elapsed_seconds)) : "") + '">' +
        '</div>'
      );
    }).join("");

    return (
      '<div class="rcc-participant-card" data-participant-card="' + escapeHtml(participant.id) + '">' +
        '<div class="rcc-participant-summary" data-participant-toggle="' + escapeHtml(participant.id) + '">' +
          '<h3>' + escapeHtml(participantName(participant)) + (participant.race_group ? ' <span style="font-weight:500;font-size:0.85rem;">(' + escapeHtml(participant.race_group) + ')</span>' : '') + '</h3>' +
          '<span class="rcc-badge">' + (goalA ? "Goal A: " + escapeHtml(formatSecondsToClock(goalA.goal_seconds)) : "No goal set") + '</span>' +
        '</div>' +
        '<div class="rcc-participant-detail' + (isOpen ? " rcc-open" : "") + '" data-participant-detail="' + escapeHtml(participant.id) + '">' +
          '<div class="rcc-goal-fields">' +
            '<label>Goal A (required)<input type="text" class="rcc-field-goal-a" placeholder="17:00" value="' + (goalA ? escapeHtml(formatSecondsToClock(goalA.goal_seconds)) : "") + '"' + (strategy === "custom_pace" ? " disabled" : "") + '></label>' +
            '<label>Goal B<input type="text" class="rcc-field-goal-b" placeholder="17:30" value="' + (goalB ? escapeHtml(formatSecondsToClock(goalB.goal_seconds)) : "") + '"></label>' +
            '<label>Goal C<input type="text" class="rcc-field-goal-c" placeholder="18:00" value="' + (goalC ? escapeHtml(formatSecondsToClock(goalC.goal_seconds)) : "") + '"></label>' +
            '<label>Pace strategy<select class="rcc-field-strategy">' +
              '<option value="even_pace"' + (strategy === "even_pace" ? " selected" : "") + '>Even pace</option>' +
              '<option value="custom_pace"' + (strategy === "custom_pace" ? " selected" : "") + '>Custom pace</option>' +
            '</select></label>' +
          '</div>' +
          '<div class="rcc-custom-targets" data-custom-targets style="' + (strategy === "custom_pace" ? "" : "display:none;") + '">' +
            '<p style="margin:0;font-size:0.85rem;">Enter Goal A’s target time at each checkpoint. Times must strictly increase; the Finish time becomes Goal A.</p>' +
            customRows +
          '</div>' +
          '<div class="rcc-actions">' +
            '<button class="button button-primary rcc-save-plan" type="button">Save plan for this runner</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderParticipants() {
    if (detail.participants.length === 0) {
      participantList.innerHTML = "";
      participantEmpty.hidden = false;
      return;
    }

    participantEmpty.hidden = true;
    participantList.innerHTML = detail.participants.map(renderParticipantCard).join("");
  }

  participantList.addEventListener("click", async (event) => {
    const toggle = event.target.closest("[data-participant-toggle]");
    if (toggle) {
      const id = toggle.dataset.participantToggle;
      openParticipantId = openParticipantId === id ? null : id;
      renderParticipants();
      return;
    }

    const strategySelect = event.target.closest(".rcc-field-strategy");
    if (strategySelect) {
      return; // handled by change listener below
    }

    const saveButton = event.target.closest(".rcc-save-plan");
    if (saveButton) {
      const card = saveButton.closest("[data-participant-card]");
      await saveParticipantPlan(card.dataset.participantCard);
    }
  });

  participantList.addEventListener("change", (event) => {
    const select = event.target.closest(".rcc-field-strategy");
    if (!select) return;
    const card = select.closest("[data-participant-card]");
    const customTargets = card.querySelector("[data-custom-targets]");
    const goalAInput = card.querySelector(".rcc-field-goal-a");
    const isCustom = select.value === "custom_pace";
    customTargets.style.display = isCustom ? "" : "none";
    goalAInput.disabled = isCustom;
  });

  async function saveParticipantPlan(participantId) {
    const card = participantList.querySelector('[data-participant-card="' + CSS.escape(participantId) + '"]');
    if (!card) return;

    const strategy = card.querySelector(".rcc-field-strategy").value;
    const goalAText = card.querySelector(".rcc-field-goal-a").value;
    const goalBText = card.querySelector(".rcc-field-goal-b").value;
    const goalCText = card.querySelector(".rcc-field-goal-c").value;

    const goalBSeconds = parseClockToSeconds(goalBText);
    const goalCSeconds = parseClockToSeconds(goalCText);

    try {
      if (strategy === "even_pace") {
        const goalASeconds = parseClockToSeconds(goalAText);
        if (!goalASeconds) {
          showMessage("Goal A is required (format m:ss, e.g. 17:00).", true);
          return;
        }

        const goals = [{ goal_slot: "A", goal_seconds: goalASeconds }];
        if (goalBSeconds) goals.push({ goal_slot: "B", goal_seconds: goalBSeconds });
        if (goalCSeconds) goals.push({ goal_slot: "C", goal_seconds: goalCSeconds });

        await apiFetch(PLAN_ENDPOINT, { action: "save_goals", participant_id: participantId, goals });
        await apiFetch(PLAN_ENDPOINT, { action: "save_strategy", participant_id: participantId, strategy });
        await apiFetch(PLAN_ENDPOINT, { action: "save_targets", participant_id: participantId, goal_slot: "A", mode: "even_pace", goal_seconds: goalASeconds });
      } else {
        const inputs = [...card.querySelectorAll(".rcc-custom-target-input")];
        const checkpointSeconds = inputs.map((input) => parseClockToSeconds(input.value));

        if (checkpointSeconds.some((v) => v === null)) {
          showMessage("Enter a target time for every checkpoint (format m:ss).", true);
          return;
        }

        await apiFetch(PLAN_ENDPOINT, { action: "save_strategy", participant_id: participantId, strategy });

        const result = await apiFetch(PLAN_ENDPOINT, {
          action: "save_targets", participant_id: participantId, goal_slot: "A", mode: "custom_pace", checkpoint_seconds: checkpointSeconds
        });

        const goals = [{ goal_slot: "A", goal_seconds: result.goal_seconds }];
        if (goalBSeconds) goals.push({ goal_slot: "B", goal_seconds: goalBSeconds });
        if (goalCSeconds) goals.push({ goal_slot: "C", goal_seconds: goalCSeconds });
        await apiFetch(PLAN_ENDPOINT, { action: "save_goals", participant_id: participantId, goals });
      }

      showMessage("Plan saved.");
      openParticipantId = participantId;
      await refreshDetailOnly();
    } catch (error) {
      showMessage(error.message || "This runner's plan could not be saved.", true);
    }
  }

  deleteRaceButton.addEventListener("click", async () => {
    if (!window.confirm("Delete this draft race? This cannot be undone.")) return;
    try {
      await apiFetch(SESSIONS_ENDPOINT, { action: "delete" });
      window.location.href = "/race-command-center/?id=" + encodeURIComponent(teamId);
    } catch (error) {
      showMessage(error.message || "This race could not be deleted.", true);
    }
  });

  async function refreshDetailOnly() {
    detail = await apiFetch(SESSIONS_ENDPOINT, { action: "detail" });
    renderHeader();
    renderRoster();
    renderParticipants();
  }

  async function refresh() {
    await refreshDetailOnly();
  }

  async function initialize() {
    if (!teamId || !sessionId) {
      loadingBox.innerHTML = "<h2>Race not found</h2><p>This link is missing a team or race id.</p>";
      return;
    }

    try {
      // Don't hard-gate on a Supabase user here -- a race-day access code
      // visitor never has one. Let the actual API call (authorized via
      // bearer token OR the race-day cookie, server-side) decide.
      detail = await apiFetch(SESSIONS_ENDPOINT, { action: "detail" });
      const rosterData = await apiFetch(PLAN_ENDPOINT, { action: "list_roster", sport: detail.session.sport });
      rosterAthletes = rosterData.athletes;

      renderHeader();
      renderRoster();
      renderParticipants();

      loadingBox.hidden = true;
      root.hidden = false;
    } catch (error) {
      loadingBox.innerHTML =
        "<h2>This race could not be loaded</h2>" +
        "<p>" + escapeHtml(error.message || "Please try again.") + "</p>" +
        '<p><a class="button button-primary" href="/race-command-center/?id=' + encodeURIComponent(teamId) + '">Back to Race Command Center</a></p>';
    }
  }

  initialize();
})();
