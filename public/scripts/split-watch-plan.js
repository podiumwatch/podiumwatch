(() => {
  const loadingBox = document.querySelector("[data-sw-loading]");
  const root = document.querySelector("[data-sw-root]");
  const teamNameEl = document.querySelector("[data-sw-team-name]");
  const raceNameEl = document.querySelector("[data-sw-race-name]");
  const statusBadge = document.querySelector("[data-sw-status-badge]");
  const raceMetaEl = document.querySelector("[data-sw-race-meta]");
  const messageBox = document.querySelector("[data-sw-message]");
  const checkpointStrip = document.querySelector("[data-sw-checkpoint-strip]");
  const rosterList = document.querySelector("[data-sw-roster-list]");
  const rosterEmpty = document.querySelector("[data-sw-roster-empty]");
  const selectAllRosterButton = document.querySelector("[data-sw-select-all-roster]");
  const allRacesLink = document.querySelector("[data-sw-all-races-link]");
  const raceSwitcherWrap = document.querySelector("[data-sw-race-switcher-wrap]");
  const raceSwitcher = document.querySelector("[data-sw-race-switcher]");
  const rosterImportLink = document.querySelector("[data-sw-roster-import-link]");
  const manageRosterLink = document.querySelector("[data-sw-manage-roster-link]");
  const quickAddWrap = document.querySelector("[data-sw-quick-add-wrap]");
  const quickAddHsBoys = document.querySelector('[data-sw-quick-add="hs_boys"]');
  const quickAddHsGirls = document.querySelector('[data-sw-quick-add="hs_girls"]');
  const quickAddJhBoys = document.querySelector('[data-sw-quick-add="jh_boys"]');
  const quickAddJhGirls = document.querySelector('[data-sw-quick-add="jh_girls"]');
  const manualForm = document.querySelector("[data-sw-manual-form]");
  const bulkToggleButton = document.querySelector("[data-sw-bulk-toggle]");
  const bulkPanel = document.querySelector("[data-sw-bulk-panel]");
  const bulkTextarea = document.querySelector("[data-sw-bulk-textarea]");
  const bulkAddButton = document.querySelector("[data-sw-bulk-add]");
  const saveParticipantsButton = document.querySelector("[data-sw-save-participants]");
  const bulkGoalsWrap = document.querySelector("[data-sw-bulk-goals]");
  const bulkGoalsRows = document.querySelector("[data-sw-bulk-goals-rows]");
  const bulkGoalsSelectAll = document.querySelector("[data-sw-bulk-select-all]");
  const bulkGoalsApplyValueInput = document.querySelector("[data-sw-bulk-apply-value]");
  const bulkGoalsApplySelectedButton = document.querySelector("[data-sw-bulk-apply-selected]");
  const saveBulkGoalsButton = document.querySelector("[data-sw-save-bulk-goals]");
  const participantList = document.querySelector("[data-sw-participant-list]");
  const participantEmpty = document.querySelector("[data-sw-participant-empty]");
  const deleteRaceButton = document.querySelector("[data-sw-delete-race]");
  const liveLinkButton = document.querySelector("[data-sw-live-link]");
  const raceDayOpenButton = document.querySelector("[data-sw-race-day-open]");
  const raceDayDialog = document.querySelector("[data-sw-race-day-dialog]");
  const raceDayCloseButton = document.querySelector("[data-sw-race-day-close]");
  const raceDayReveal = document.querySelector("[data-sw-race-day-reveal]");
  const raceDayRevealCode = document.querySelector("[data-sw-race-day-reveal-code]");
  const raceDayCopyButton = document.querySelector("[data-sw-race-day-copy]");
  const raceDayStatusEl = document.querySelector("[data-sw-race-day-status]");
  const raceDayGenerateButton = document.querySelector("[data-sw-race-day-generate]");
  const raceDayRevokeButton = document.querySelector("[data-sw-race-day-revoke]");

  const requiredElements = [
    loadingBox, root, teamNameEl, raceNameEl, statusBadge, raceMetaEl, messageBox,
    checkpointStrip, rosterList, rosterEmpty, selectAllRosterButton, allRacesLink, raceSwitcherWrap, raceSwitcher, rosterImportLink,
    manageRosterLink, quickAddWrap, quickAddHsBoys, quickAddHsGirls, quickAddJhBoys, quickAddJhGirls, manualForm,
    bulkToggleButton, bulkPanel, bulkTextarea, bulkAddButton, saveParticipantsButton,
    bulkGoalsWrap, bulkGoalsRows, bulkGoalsSelectAll, bulkGoalsApplyValueInput, bulkGoalsApplySelectedButton, saveBulkGoalsButton,
    participantList, participantEmpty, deleteRaceButton, liveLinkButton,
    raceDayOpenButton, raceDayDialog, raceDayCloseButton, raceDayReveal, raceDayRevealCode,
    raceDayCopyButton, raceDayStatusEl, raceDayGenerateButton, raceDayRevokeButton
  ];

  if (requiredElements.some((el) => !el)) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const teamId = String(params.get("id") || "").trim();
  const sessionId = String(params.get("race") || "").trim();

  rosterImportLink.href = "/team-roster/?id=" + encodeURIComponent(teamId);
  manageRosterLink.href = "/team-roster/?id=" + encodeURIComponent(teamId);
  // The static template can't know the team id -- without this the link
  // falls back to its bare href and lands on the Split Watch hub with no ?id=,
  // which the hub reports as "Split Watch not found."
  if (teamId) allRacesLink.href = "/split-watch/?id=" + encodeURIComponent(teamId);

  const SESSIONS_ENDPOINT = "/api/split-watch/sessions/";
  const PLAN_ENDPOINT = "/api/split-watch/plan/";

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
      window.location.replace("/split-watch/join/");
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
    statusBadge.className = "sw-badge" +
      (session.status === "live" ? " sw-badge-live" : "") +
      (session.status === "finished" || session.status === "reviewed" ? " sw-badge-finished" : "");

    const unit = session.distance_unit_display;
    const unitMeters = unit === "miles" ? 1609.344 : (unit === "km" ? 1000 : 1);
    const distanceInUnit = (session.distance_meters / unitMeters).toFixed(2).replace(/\.00$/, "");
    raceMetaEl.textContent = session.race_date + " · " + distanceInUnit + " " + unit + (session.race_type ? " · " + session.race_type : "");

    // Any status can be deleted except "live" -- a race actively being
    // timed right now may have a volunteer's device mid-sync against it.
    deleteRaceButton.hidden = session.status === "live";
    deleteRaceButton.textContent = session.status === "draft" ? "Delete draft" : "Delete race";
    liveLinkButton.disabled = false;
    liveLinkButton.onclick = () => {
      window.location.href = "/split-watch/live/?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(sessionId);
    };

    checkpointStrip.innerHTML = detail.checkpoints.map((c) => {
      const label = c.is_finish ? c.label + " (Finish)" : c.label;
      return '<span class="sw-checkpoint-chip">' + escapeHtml(label) + "</span>";
    }).join("");
  }

  function isParticipantSelected(athleteId) {
    return detail.participants.some((p) => p.team_athlete_id === athleteId);
  }

  function renderRoster() {
    updateQuickAddButtons();

    if (rosterAthletes.length === 0) {
      rosterList.innerHTML = "";
      rosterEmpty.hidden = false;
      selectAllRosterButton.hidden = true;
    } else {
      rosterEmpty.hidden = true;
      selectAllRosterButton.hidden = false;
      rosterList.innerHTML = rosterAthletes.map((athlete) => {
        const name = athlete.display_name || (athlete.first_name + " " + athlete.last_name);
        const checked = isParticipantSelected(athlete.id) ? " checked" : "";
        return (
          '<label class="sw-roster-row">' +
            '<input type="checkbox" class="sw-roster-checkbox" value="' + escapeHtml(athlete.id) + '"' + checked + '>' +
            '<span>' + escapeHtml(name) + (athlete.graduation_year ? " (" + escapeHtml(String(athlete.graduation_year)) + ")" : "") + '</span>' +
          '</label>'
        );
      }).join("");
    }

    // Manual participants already saved for this session -- shown as a
    // removable list beneath the roster checkboxes.
    const existingManual = detail.participants.filter((p) => !p.team_athlete_id);
    const manualHtml = existingManual.map((p) => (
      '<label class="sw-roster-row">' +
        '<input type="checkbox" class="sw-manual-keep" value="' + escapeHtml(p.id) + '" checked>' +
        '<span>' + escapeHtml(p.manual_name) + ' (manual)</span>' +
      '</label>'
    )).join("");

    const newManualHtml = manualParticipants.map((p, index) => (
      '<label class="sw-roster-row">' +
        '<input type="checkbox" class="sw-manual-new" data-index="' + index + '" checked>' +
        '<span>' + escapeHtml(p.manual_name) + ' (manual, unsaved)</span>' +
      '</label>'
    )).join("");

    rosterList.innerHTML += manualHtml + newManualHtml;
  }

  selectAllRosterButton.addEventListener("click", () => {
    rosterList.querySelectorAll(".sw-roster-checkbox").forEach((checkbox) => {
      checkbox.checked = true;
    });
  });

  // A team running JH and HS, boys and girls, off one account needs to
  // add just one specific squad at a time, not the entire roster. grade
  // (7-8 = JH, 9-12 = HS -- the standard US split) comes from this
  // season's roster entry; gender comes from the athlete record. An
  // athlete missing either isn't covered by any of these four buttons --
  // "Add all from roster" above still reaches them.
  const QUICK_ADD_GROUPS = ["hs_boys", "hs_girls", "jh_boys", "jh_girls"];
  const quickAddButtons = {
    hs_boys: quickAddHsBoys, hs_girls: quickAddHsGirls,
    jh_boys: quickAddJhBoys, jh_girls: quickAddJhGirls
  };

  function athleteGroup(athlete) {
    if (athlete.gender !== "boys" && athlete.gender !== "girls") return null;
    if (athlete.grade == null) return null;
    const level = Number(athlete.grade) <= 8 ? "jh" : "hs";
    return level + "_" + athlete.gender;
  }

  function updateQuickAddButtons() {
    let anyVisible = false;
    QUICK_ADD_GROUPS.forEach((group) => {
      const hasMatch = rosterAthletes.some((a) => athleteGroup(a) === group);
      quickAddButtons[group].hidden = !hasMatch;
      if (hasMatch) anyVisible = true;
    });
    quickAddWrap.hidden = !anyVisible;
  }

  quickAddWrap.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sw-quick-add]");
    if (!button) return;
    const group = button.dataset.swQuickAdd;
    rosterList.querySelectorAll(".sw-roster-checkbox").forEach((checkbox) => {
      const athlete = rosterAthletes.find((a) => a.id === checkbox.value);
      if (athlete && athleteGroup(athlete) === group) checkbox.checked = true;
    });
  });

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
    const checkedAthleteIds = [...rosterList.querySelectorAll(".sw-roster-checkbox:checked")].map((el) => el.value);
    const keptManualIds = new Set([...rosterList.querySelectorAll(".sw-manual-keep:checked")].map((el) => el.value));
    const newManualChecked = [...rosterList.querySelectorAll(".sw-manual-new:checked")].map((el) => manualParticipants[Number(el.dataset.index)]);

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
        '<div class="sw-custom-target-row">' +
          '<span>' + escapeHtml(c.label) + (c.is_finish ? " (Finish)" : "") + '</span>' +
          '<input type="text" class="sw-custom-target-input" data-checkpoint-id="' + escapeHtml(c.id) + '" placeholder="m:ss" value="' + (target ? escapeHtml(formatSecondsToClock(target.target_elapsed_seconds)) : "") + '">' +
        '</div>'
      );
    }).join("");

    return (
      '<div class="sw-participant-card" data-participant-card="' + escapeHtml(participant.id) + '">' +
        '<div class="sw-participant-summary" data-participant-toggle="' + escapeHtml(participant.id) + '">' +
          '<h3>' + escapeHtml(participantName(participant)) + (participant.race_group ? ' <span style="font-weight:500;font-size:0.85rem;">(' + escapeHtml(participant.race_group) + ')</span>' : '') + '</h3>' +
          '<span class="sw-badge">' + (goalA ? "Goal A: " + escapeHtml(formatSecondsToClock(goalA.goal_seconds)) : "No goal set") + '</span>' +
        '</div>' +
        '<div class="sw-participant-detail' + (isOpen ? " sw-open" : "") + '" data-participant-detail="' + escapeHtml(participant.id) + '">' +
          '<div class="sw-goal-fields">' +
            '<label>Goal A<input type="text" class="sw-field-goal-a" placeholder="17:00" value="' + (goalA ? escapeHtml(formatSecondsToClock(goalA.goal_seconds)) : "") + '"' + (strategy === "custom_pace" ? " disabled" : "") + '></label>' +
            '<label>Goal B<input type="text" class="sw-field-goal-b" placeholder="17:30" value="' + (goalB ? escapeHtml(formatSecondsToClock(goalB.goal_seconds)) : "") + '"></label>' +
            '<label>Goal C<input type="text" class="sw-field-goal-c" placeholder="18:00" value="' + (goalC ? escapeHtml(formatSecondsToClock(goalC.goal_seconds)) : "") + '"></label>' +
            '<label>Pace strategy<select class="sw-field-strategy">' +
              '<option value="even_pace"' + (strategy === "even_pace" ? " selected" : "") + '>Even pace</option>' +
              '<option value="custom_pace"' + (strategy === "custom_pace" ? " selected" : "") + '>Custom pace</option>' +
            '</select></label>' +
          '</div>' +
          '<div class="sw-custom-targets" data-custom-targets style="' + (strategy === "custom_pace" ? "" : "display:none;") + '">' +
            '<p style="margin:0;font-size:0.85rem;">Enter Goal A’s target time at each checkpoint. Times must strictly increase; the Finish time becomes Goal A.</p>' +
            customRows +
          '</div>' +
          '<div class="sw-actions">' +
            '<button class="button button-primary sw-save-plan" type="button">Save plan for this runner</button>' +
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

  // A fast, one-screen alternative to opening every runner's card just to
  // set Goal A -- each row already shows whatever's currently saved
  // (frequently pre-filled by now thanks to the goal book / same-distance
  // carryover), so for most of the team this is reviewing, not typing.
  // Runners on a Custom Pace plan aren't editable here at all: their
  // targets are hand-entered per checkpoint, and blindly recomputing an
  // Even Pace plan over top of that would silently discard it -- see
  // partitionParticipantsByStrategy() in lib/split_watch_service.mjs.
  function renderBulkGoalsTable() {
    if (!detail.participants || detail.participants.length === 0) {
      bulkGoalsWrap.hidden = true;
      bulkGoalsRows.innerHTML = "";
      return;
    }

    bulkGoalsWrap.hidden = false;
    bulkGoalsSelectAll.checked = false;

    bulkGoalsRows.innerHTML = detail.participants.map((participant) => {
      const goalA = goalsFor(participant.id).find((g) => g.goal_slot === "A");
      const isCustom = (participant.strategy || "even_pace") === "custom_pace";
      const name = escapeHtml(participantName(participant));

      if (isCustom) {
        return (
          '<tr>' +
            '<td></td>' +
            '<td>' + name + '</td>' +
            '<td><span class="sw-bulk-goals-skip-note">Custom pace' +
              (goalA ? " (" + escapeHtml(formatSecondsToClock(goalA.goal_seconds)) + ")" : "") +
            '</span></td>' +
          '</tr>'
        );
      }

      return (
        '<tr>' +
          '<td><input type="checkbox" class="sw-bulk-row-select" value="' + escapeHtml(participant.id) + '"></td>' +
          '<td>' + name + '</td>' +
          '<td><input type="text" class="sw-bulk-goal-input" placeholder="19:30" ' +
            'value="' + (goalA ? escapeHtml(formatSecondsToClock(goalA.goal_seconds)) : "") + '" ' +
            'data-participant-id="' + escapeHtml(participant.id) + '"></td>' +
        '</tr>'
      );
    }).join("");
  }

  bulkGoalsSelectAll.addEventListener("change", () => {
    bulkGoalsRows.querySelectorAll(".sw-bulk-row-select").forEach((checkbox) => {
      checkbox.checked = bulkGoalsSelectAll.checked;
    });
  });

  // Enter advances to the next row's field instead of doing nothing (or
  // submitting some ancestor form) -- the whole point of a table like
  // this is typing straight down the column without reaching for the
  // mouse between rows.
  bulkGoalsRows.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const input = event.target.closest(".sw-bulk-goal-input");
    if (!input) return;
    event.preventDefault();
    const inputs = [...bulkGoalsRows.querySelectorAll(".sw-bulk-goal-input")];
    const nextInput = inputs[inputs.indexOf(input) + 1];
    if (nextInput) nextInput.focus();
  });

  function summarizeBulkResult(label, data) {
    const count = (data.results || []).length;
    const skipped = data.skipped || [];
    let text = count + " goal" + (count === 1 ? "" : "s") + " " + label + ".";
    if (skipped.length > 0) {
      text += " Skipped " + skipped.length + " (custom pace runners aren't editable here).";
    }
    return text;
  }

  bulkGoalsApplySelectedButton.addEventListener("click", async () => {
    showMessage("");
    const selectedIds = [...bulkGoalsRows.querySelectorAll(".sw-bulk-row-select:checked")].map((el) => el.value);
    if (selectedIds.length === 0) {
      showMessage("Select at least one runner to apply a goal to.", true);
      return;
    }
    const seconds = parseClockToSeconds(bulkGoalsApplyValueInput.value);
    if (!seconds) {
      showMessage("Enter a goal time (format m:ss, e.g. 19:30) before applying it.", true);
      return;
    }

    try {
      const data = await apiFetch(PLAN_ENDPOINT, {
        action: "bulk_apply_goal",
        participant_ids: selectedIds,
        goal_slot: "A",
        goal_seconds: seconds
      });
      showMessage(summarizeBulkResult("applied", data));
      bulkGoalsApplyValueInput.value = "";
      await refresh();
    } catch (error) {
      showMessage(error.message || "The goal could not be applied.", true);
    }
  });

  saveBulkGoalsButton.addEventListener("click", async () => {
    showMessage("");
    const entries = [];
    let hasInvalidEntry = false;

    bulkGoalsRows.querySelectorAll(".sw-bulk-goal-input").forEach((input) => {
      const raw = input.value.trim();
      if (!raw) return;
      const seconds = parseClockToSeconds(raw);
      if (seconds === null) {
        hasInvalidEntry = true;
      } else {
        entries.push({ participant_id: input.dataset.participantId, goal_a_seconds: seconds });
      }
    });

    if (hasInvalidEntry) {
      showMessage("Enter goal times as m:ss (e.g. 19:30), or leave a runner blank to skip them.", true);
      return;
    }
    if (entries.length === 0) {
      showMessage("Enter at least one goal time to save.", true);
      return;
    }

    try {
      const data = await apiFetch(PLAN_ENDPOINT, { action: "save_goals_bulk", entries });
      showMessage(summarizeBulkResult("saved", data));
      await refresh();
    } catch (error) {
      showMessage(error.message || "Goals could not be saved.", true);
    }
  });

  participantList.addEventListener("click", async (event) => {
    const toggle = event.target.closest("[data-participant-toggle]");
    if (toggle) {
      const id = toggle.dataset.participantToggle;
      openParticipantId = openParticipantId === id ? null : id;
      renderParticipants();
      return;
    }

    const strategySelect = event.target.closest(".sw-field-strategy");
    if (strategySelect) {
      return; // handled by change listener below
    }

    const saveButton = event.target.closest(".sw-save-plan");
    if (saveButton) {
      const card = saveButton.closest("[data-participant-card]");
      await saveParticipantPlan(card.dataset.participantCard);
    }
  });

  participantList.addEventListener("change", (event) => {
    const select = event.target.closest(".sw-field-strategy");
    if (!select) return;
    const card = select.closest("[data-participant-card]");
    const customTargets = card.querySelector("[data-custom-targets]");
    const goalAInput = card.querySelector(".sw-field-goal-a");
    const isCustom = select.value === "custom_pace";
    customTargets.style.display = isCustom ? "" : "none";
    goalAInput.disabled = isCustom;
  });

  async function saveParticipantPlan(participantId) {
    const card = participantList.querySelector('[data-participant-card="' + CSS.escape(participantId) + '"]');
    if (!card) return;

    const strategy = card.querySelector(".sw-field-strategy").value;
    const goalAText = card.querySelector(".sw-field-goal-a").value;
    const goalBText = card.querySelector(".sw-field-goal-b").value;
    const goalCText = card.querySelector(".sw-field-goal-c").value;

    const goalBSeconds = parseClockToSeconds(goalBText);
    const goalCSeconds = parseClockToSeconds(goalCText);

    try {
      if (strategy === "even_pace") {
        const goalASeconds = parseClockToSeconds(goalAText);
        if (!goalASeconds) {
          showMessage(
            "Enter a Goal A time (format m:ss, e.g. 17:00) to save an even-pace plan for this runner -- " +
            "or leave this card without saving to run them with no goal at all. That's fine and won't stop the race from starting.",
            true
          );
          return;
        }

        const goals = [{ goal_slot: "A", goal_seconds: goalASeconds }];
        if (goalBSeconds) goals.push({ goal_slot: "B", goal_seconds: goalBSeconds });
        if (goalCSeconds) goals.push({ goal_slot: "C", goal_seconds: goalCSeconds });

        await apiFetch(PLAN_ENDPOINT, { action: "save_goals", participant_id: participantId, goals });
        await apiFetch(PLAN_ENDPOINT, { action: "save_strategy", participant_id: participantId, strategy });
        await apiFetch(PLAN_ENDPOINT, { action: "save_targets", participant_id: participantId, goal_slot: "A", mode: "even_pace", goal_seconds: goalASeconds });
      } else {
        const inputs = [...card.querySelectorAll(".sw-custom-target-input")];
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
    const hasResults = detail?.session?.status === "finished" || detail?.session?.status === "reviewed";
    const confirmMessage = hasResults
      ? "Delete this race? All recorded times and results will be permanently lost. This cannot be undone."
      : "Delete this race? This cannot be undone.";
    if (!window.confirm(confirmMessage)) return;
    try {
      await apiFetch(SESSIONS_ENDPOINT, { action: "delete" });
      window.location.href = "/split-watch/?id=" + encodeURIComponent(teamId);
    } catch (error) {
      showMessage(error.message || "This race could not be deleted.", true);
    }
  });

  // --- race day access (share this team's code with a volunteer timer) ------
  // Same generate/status/reveal-once/revoke pattern as Team Home and the
  // Split Watch hub, reachable here too since a coach realizing
  // "I need help timing this" happens mid-Plan, not just on those other
  // two pages -- see docs/DECISIONS.md, 2026-08-20.

  function formatDateTime(isoText) {
    const date = new Date(String(isoText || ""));
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " at " + date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function renderRaceDayStatus(status, keepReveal = false) {
    if (!keepReveal) raceDayReveal.hidden = true;

    if (!status || !status.active) {
      raceDayStatusEl.innerHTML =
        '<strong>Race day access is off.</strong>' +
        '<div class="sw-item-meta">No volunteer code is active for this team right now.</div>';
      raceDayGenerateButton.textContent = "Generate code";
      raceDayRevokeButton.hidden = true;
      return;
    }

    const created = formatDateTime(status.created_at);
    const lastUsed = formatDateTime(status.last_used_at);
    raceDayStatusEl.innerHTML =
      '<strong>Race day access is on.</strong>' +
      '<div class="sw-item-meta">' +
        (created ? "Created " + created : "Active") +
        " · " + (lastUsed ? "Last used " + lastUsed : "Not used yet") +
      '</div>';
    raceDayGenerateButton.textContent = "Regenerate code";
    raceDayRevokeButton.hidden = false;
  }

  raceDayOpenButton.addEventListener("click", async () => {
    raceDayDialog.showModal();
    try {
      const statusData = await apiFetch("/api/team/race-day-code/", { action: "status" });
      renderRaceDayStatus(statusData.status);
    } catch (error) {
      raceDayStatusEl.textContent = error.message || "Race day access status could not be loaded.";
    }
  });

  raceDayCloseButton.addEventListener("click", () => raceDayDialog.close());

  raceDayGenerateButton.addEventListener("click", async () => {
    raceDayGenerateButton.disabled = true;
    try {
      const generated = await apiFetch("/api/team/race-day-code/", { action: "regenerate" });
      raceDayRevealCode.textContent = generated.code;
      raceDayReveal.hidden = false;
      raceDayCopyButton.textContent = "Copy";
      const statusData = await apiFetch("/api/team/race-day-code/", { action: "status" });
      renderRaceDayStatus(statusData.status, true);
    } catch (error) {
      showMessage(error.message || "The code could not be generated.", true);
    } finally {
      raceDayGenerateButton.disabled = false;
    }
  });

  raceDayRevokeButton.addEventListener("click", async () => {
    if (!window.confirm("Turn off race day access? Anyone currently using the code will be signed out.")) return;
    raceDayRevokeButton.disabled = true;
    try {
      await apiFetch("/api/team/race-day-code/", { action: "revoke" });
      const statusData = await apiFetch("/api/team/race-day-code/", { action: "status" });
      renderRaceDayStatus(statusData.status);
    } catch (error) {
      showMessage(error.message || "Race day access could not be turned off.", true);
    } finally {
      raceDayRevokeButton.disabled = false;
    }
  });

  raceDayCopyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(raceDayRevealCode.textContent || "");
      raceDayCopyButton.textContent = "Copied";
      setTimeout(() => { raceDayCopyButton.textContent = "Copy"; }, 2000);
    } catch {
      // Clipboard API can fail (permissions, non-secure context) -- the
      // code is already visible on screen, so this is a soft failure.
    }
  });

  async function refreshDetailOnly() {
    detail = await apiFetch(SESSIONS_ENDPOINT, { action: "detail" });
    renderHeader();
    renderRoster();
    renderParticipants();
    renderBulkGoalsTable();
  }

  async function refresh() {
    await refreshDetailOnly();
  }

  // A team running JH/HS boys/girls races on the same day previously had
  // to back all the way out to the full race list to jump from planning
  // one race to another. This surfaces just today's other races right at
  // the top -- live ones first -- so switching is one tap, not a detour.
  let raceSwitcherSessions = [];

  async function populateRaceSwitcher() {
    try {
      const data = await apiFetch(SESSIONS_ENDPOINT, { action: "list" });
      const today = detail.session.race_date;
      raceSwitcherSessions = (data.sessions || [])
        .filter((s) => s.id !== sessionId && s.race_date === today && s.status !== "cancelled")
        .sort((a, b) => {
          const rank = (s) => (s.status === "live" ? 0 : 1);
          const diff = rank(a) - rank(b);
          return diff !== 0 ? diff : a.name.localeCompare(b.name);
        });

      if (raceSwitcherSessions.length === 0) return;

      raceSwitcher.innerHTML =
        '<option value="">This race -- ' + escapeHtml(detail.session.name) + '</option>' +
        raceSwitcherSessions.map((s) => (
          '<option value="' + escapeHtml(s.id) + '">' + escapeHtml(s.name) + ' (' + escapeHtml(STATUS_LABELS[s.status] || s.status) + ')</option>'
        )).join("");
      raceSwitcherWrap.hidden = false;
    } catch {
      // A switcher that fails to populate just stays hidden -- never
      // blocks the actual plan this page exists to build.
    }
  }

  raceSwitcher.addEventListener("change", () => {
    const targetId = raceSwitcher.value;
    if (!targetId) return;
    const target = raceSwitcherSessions.find((s) => s.id === targetId);
    if (!target) return;
    const idPart = "?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(target.id);
    if (target.status === "live") {
      window.location.href = "/split-watch/live/" + idPart;
    } else if (target.status === "finished" || target.status === "reviewed") {
      window.location.href = "/split-watch/review/" + idPart;
    } else {
      window.location.href = "/split-watch/plan/" + idPart;
    }
  });

  async function initialize() {
    if (!teamId || !sessionId) {
      loadingBox.innerHTML = "<h2>Race not found</h2><p>This link is missing a team or race id.</p>";
      return;
    }

    // The Plan page is coach-only -- editing goals, roster, pacing
    // strategy, and deleting the race are all admin actions with no
    // business being reachable by a race-day code alone (found during
    // the overnight audit -- this page had the same gap the Hub did
    // before its own fix). A visitor with no real Supabase user belongs
    // on the Live timing screen for this same race instead, never here.
    // See splitwatchraces.mjs's header comment for the same reasoning
    // first applied to the Hub.
    const user = await window.PodiumTeamAuth.getUser();
    if (!user) {
      window.location.replace("/split-watch/live/?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(sessionId));
      return;
    }

    try {
      detail = await apiFetch(SESSIONS_ENDPOINT, { action: "detail" });
      const rosterData = await apiFetch(PLAN_ENDPOINT, { action: "list_roster", sport: detail.session.sport });
      rosterAthletes = rosterData.athletes;

      renderHeader();
      renderRoster();
      renderParticipants();
      renderBulkGoalsTable();

      // Reaching this point already confirmed a real coach account (the
      // redirect above sends anyone else to the Live timing screen), so
      // showing race-day-code management here (api/team/race-day-code.js)
      // is always safe.
      raceDayOpenButton.hidden = false;

      loadingBox.hidden = true;
      root.hidden = false;
      populateRaceSwitcher();
    } catch (error) {
      loadingBox.innerHTML =
        "<h2>This race could not be loaded</h2>" +
        "<p>" + escapeHtml(error.message || "Please try again.") + "</p>" +
        '<p><a class="button button-primary" href="/split-watch/?id=' + encodeURIComponent(teamId) + '">Back to Split Watch</a></p>';
    }
  }

  initialize();
})();
