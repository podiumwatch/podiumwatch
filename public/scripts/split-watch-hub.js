(() => {
  const loadingBox = document.querySelector("[data-sw-loading]");
  const root = document.querySelector("[data-sw-root]");
  const teamNameEl = document.querySelector("[data-sw-team-name]");
  const accountEl = document.querySelector("[data-sw-account]");
  const teamLink = document.querySelector("[data-sw-team-link]");
  const messageBox = document.querySelector("[data-sw-message]");
  const raceList = document.querySelector("[data-sw-race-list]");
  const raceEmpty = document.querySelector("[data-sw-race-empty]");
  const createForm = document.querySelector("[data-sw-create-form]");
  const checkpointRows = document.querySelector("[data-sw-checkpoint-rows]");
  const addCheckpointButton = document.querySelector("[data-sw-add-checkpoint]");
  const raceDaySection = document.querySelector("[data-sw-race-day-section]");
  const raceDayReveal = document.querySelector("[data-sw-race-day-reveal]");
  const raceDayRevealCode = document.querySelector("[data-sw-race-day-reveal-code]");
  const raceDayCopyButton = document.querySelector("[data-sw-race-day-copy]");
  const raceDayStatusEl = document.querySelector("[data-sw-race-day-status]");
  const raceDayGenerateButton = document.querySelector("[data-sw-race-day-generate]");
  const raceDayRevokeButton = document.querySelector("[data-sw-race-day-revoke]");
  const meetForm = document.querySelector("[data-sw-meet-form]");
  const meetEmpty = document.querySelector("[data-sw-meet-empty]");
  const meetRosterLink = document.querySelector("[data-sw-meet-roster-link]");
  const meetSportSelect = document.querySelector("[data-sw-meet-sport]");
  const meetGroupHs = document.querySelector('[data-sw-meet-group="hs"]');
  const meetGroupJh = document.querySelector('[data-sw-meet-group="jh"]');
  const meetSquadHsBoys = document.querySelector('[data-sw-meet-squad="hs_boys"]');
  const meetSquadHsGirls = document.querySelector('[data-sw-meet-squad="hs_girls"]');
  const meetSquadJhBoys = document.querySelector('[data-sw-meet-squad="jh_boys"]');
  const meetSquadJhGirls = document.querySelector('[data-sw-meet-squad="jh_girls"]');
  const meetDistanceHs = document.querySelector('[data-sw-meet-distance="hs"]');
  const meetUnitHs = document.querySelector('[data-sw-meet-unit="hs"]');
  const meetDistanceJh = document.querySelector('[data-sw-meet-distance="jh"]');
  const meetUnitJh = document.querySelector('[data-sw-meet-unit="jh"]');
  const meetCheckpointRowsHs = document.querySelector('[data-sw-meet-checkpoint-rows="hs"]');
  const meetAddCheckpointHs = document.querySelector('[data-sw-meet-add-checkpoint="hs"]');
  const meetCheckpointRowsJh = document.querySelector('[data-sw-meet-checkpoint-rows="jh"]');
  const meetAddCheckpointJh = document.querySelector('[data-sw-meet-add-checkpoint="jh"]');

  const requiredElements = [
    loadingBox, root, teamNameEl, accountEl, teamLink, messageBox,
    raceList, raceEmpty, createForm, checkpointRows, addCheckpointButton,
    raceDaySection, raceDayReveal, raceDayRevealCode, raceDayCopyButton,
    raceDayStatusEl, raceDayGenerateButton, raceDayRevokeButton,
    meetForm, meetEmpty, meetRosterLink, meetSportSelect, meetGroupHs, meetGroupJh,
    meetSquadHsBoys, meetSquadHsGirls, meetSquadJhBoys, meetSquadJhGirls,
    meetDistanceHs, meetUnitHs, meetDistanceJh, meetUnitJh,
    meetCheckpointRowsHs, meetAddCheckpointHs, meetCheckpointRowsJh, meetAddCheckpointJh
  ];

  if (requiredElements.some((el) => !el)) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const teamId = String(params.get("id") || "").trim();

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
      body: JSON.stringify({ team_id: teamId, ...payload })
    });

    if (response.status === 401) {
      window.location.replace("/split-watch/join/");
    }

    return parseResponse(response, "The request could not be completed.");
  }

  function unitToMeters(unit) {
    return unit === "miles" ? 1609.344 : (unit === "km" ? 1000 : 1);
  }

  function currentRaceUnit() {
    const select = createForm.querySelector('select[name="distance_unit_display"]');
    return String((select && select.value) || "miles");
  }

  // Each checkpoint carries its own distance unit, independent of the race's
  // overall distance unit -- a 5K (set in kilometers) still commonly uses
  // mile markers for checkpoints, so a coach needs to be able to label a
  // checkpoint "Mile 1" and enter "1" against a "Miles" unit for that row
  // specifically, without it being silently reinterpreted as 1 kilometer.
  // Generic over which container it appends to and how it picks a default
  // unit for a fresh row, so the same row/read logic serves the single-race
  // form's one checkpoint list AND the whole-meet form's two (HS/JH).
  function createCheckpointRow(container, defaultUnit, label, value, unit) {
    const row = document.createElement("div");
    row.className = "sw-checkpoint-row";
    const rowUnit = unit || defaultUnit();
    row.innerHTML =
      '<label><strong>Label</strong><input type="text" class="sw-cp-label" placeholder="Mile 1" value="' + escapeHtml(label || "") + '"></label>' +
      '<label><strong>Distance</strong><input type="number" step="0.01" min="0.01" class="sw-cp-distance" value="' + escapeHtml(value || "") + '"></label>' +
      '<label><strong>Unit</strong><select class="sw-cp-unit">' +
        '<option value="miles"' + (rowUnit === "miles" ? " selected" : "") + '>Miles</option>' +
        '<option value="km"' + (rowUnit === "km" ? " selected" : "") + '>Kilometers</option>' +
        '<option value="meters"' + (rowUnit === "meters" ? " selected" : "") + '>Meters</option>' +
      '</select></label>' +
      '<button type="button" class="button button-outline sw-cp-remove">Remove</button>';
    row.querySelector(".sw-cp-remove").addEventListener("click", () => row.remove());
    container.appendChild(row);
  }

  function readCheckpoints(container, fallbackUnit) {
    return [...container.querySelectorAll(".sw-checkpoint-row")].map((row) => {
      const label = row.querySelector(".sw-cp-label").value;
      const cpUnit = String(row.querySelector(".sw-cp-unit").value || fallbackUnit);
      const distance = Number(row.querySelector(".sw-cp-distance").value) * unitToMeters(cpUnit);
      return { label, distanceMeters: distance };
    }).filter((c) => c.label && c.distanceMeters > 0);
  }

  function addCheckpointRow(label, value, unit) {
    createCheckpointRow(checkpointRows, currentRaceUnit, label, value, unit);
  }

  addCheckpointButton.addEventListener("click", () => addCheckpointRow("", "", currentRaceUnit()));

  function meetUnitFor(group) {
    const select = group === "hs" ? meetUnitHs : meetUnitJh;
    return String(select.value || "miles");
  }

  const meetCheckpointContainers = { hs: meetCheckpointRowsHs, jh: meetCheckpointRowsJh };
  const meetAddCheckpointButtons = { hs: meetAddCheckpointHs, jh: meetAddCheckpointJh };

  ["hs", "jh"].forEach((group) => {
    meetAddCheckpointButtons[group].addEventListener("click", () => {
      createCheckpointRow(meetCheckpointContainers[group], () => meetUnitFor(group), "", "");
    });
  });

  const STATUS_LABELS = {
    draft: "Draft",
    scheduled: "Scheduled",
    live: "Live",
    finished: "Finished",
    reviewed: "Reviewed",
    cancelled: "Cancelled"
  };

  function statusBadgeClass(status) {
    if (status === "live") return "sw-badge sw-badge-live";
    if (status === "finished" || status === "reviewed") return "sw-badge sw-badge-finished";
    return "sw-badge";
  }

  function actionLinkFor(session) {
    const idPart = "?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(session.id);
    if (session.status === "live") {
      return { href: "/split-watch/live/" + idPart, label: "Open live timing" };
    }
    if (session.status === "finished" || session.status === "reviewed") {
      return { href: "/split-watch/review/" + idPart, label: "View review" };
    }
    return { href: "/split-watch/plan/" + idPart, label: "Open plan" };
  }

  function spectatorLinkFor(session) {
    return window.location.origin + "/race/?race=" + encodeURIComponent(session.id);
  }

  function renderRaces(sessions) {
    if (!sessions.length) {
      raceList.innerHTML = "";
      raceEmpty.hidden = false;
      return;
    }

    raceEmpty.hidden = true;
    raceList.innerHTML = sessions.map((session) => {
      const action = actionLinkFor(session);
      const checked = session.spectator_visible ? " checked" : "";
      // Any status can be deleted except "live" -- a race actively being
      // timed right now may have a volunteer's device mid-sync against it.
      const deleteButton = session.status === "live"
        ? ""
        : '<button class="button button-outline sw-delete-session" type="button" data-status="' + escapeHtml(session.status) + '">Delete</button>';
      return (
        '<div class="sw-race-card" data-sw-session-id="' + escapeHtml(session.id) + '">' +
          '<div class="sw-header">' +
            '<h3>' + escapeHtml(session.name) + '</h3>' +
            '<span class="' + statusBadgeClass(session.status) + '">' + escapeHtml(STATUS_LABELS[session.status] || session.status) + '</span>' +
          '</div>' +
          '<p>' + escapeHtml(session.race_date) + ' &middot; ' + escapeHtml(String(session.distance_meters)) + 'm' + (session.race_type ? ' &middot; ' + escapeHtml(session.race_type) : '') + '</p>' +
          '<div class="sw-actions">' +
            '<a class="button button-primary" href="' + action.href + '">' + action.label + '</a>' +
            deleteButton +
          '</div>' +
          '<div class="sw-spectator-row">' +
            '<label><input type="checkbox" class="sw-spectator-toggle"' + checked + '> Let parents watch this race live</label>' +
            '<div class="sw-spectator-link"' + (session.spectator_visible ? '' : ' hidden') + '>' +
              '<input type="text" readonly value="' + escapeHtml(spectatorLinkFor(session)) + '">' +
              '<button type="button" class="button button-outline sw-spectator-copy">Copy link</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join("");

    raceList.querySelectorAll(".sw-spectator-toggle").forEach((checkbox) => {
      checkbox.addEventListener("change", async () => {
        const card = checkbox.closest("[data-sw-session-id]");
        const sessionId = card.getAttribute("data-sw-session-id");
        const linkRow = card.querySelector(".sw-spectator-link");
        const wantVisible = checkbox.checked;
        checkbox.disabled = true;
        try {
          await apiFetch("/api/split-watch/sessions/", {
            action: "update",
            session_id: sessionId,
            spectator_visible: wantVisible
          });
          linkRow.hidden = !wantVisible;
        } catch (error) {
          checkbox.checked = !wantVisible;
          showMessage(error.message || "That could not be saved.", true);
        } finally {
          checkbox.disabled = false;
        }
      });
    });

    raceList.querySelectorAll(".sw-spectator-copy").forEach((button) => {
      button.addEventListener("click", () => {
        const input = button.previousElementSibling;
        input.select();
        navigator.clipboard?.writeText(input.value).then(
          () => showMessage("Link copied."),
          () => {}
        );
      });
    });

    raceList.querySelectorAll(".sw-delete-session").forEach((button) => {
      button.addEventListener("click", async () => {
        const card = button.closest("[data-sw-session-id]");
        const sessionId = card.getAttribute("data-sw-session-id");
        const hasResults = button.dataset.status === "finished" || button.dataset.status === "reviewed";
        const confirmMessage = hasResults
          ? "Delete this race? All recorded times and results will be permanently lost. This cannot be undone."
          : "Delete this race? This cannot be undone.";
        if (!window.confirm(confirmMessage)) return;

        button.disabled = true;
        try {
          await apiFetch("/api/split-watch/sessions/", { action: "delete", session_id: sessionId });
          showMessage("The race was deleted.");
          const data = await apiFetch("/api/split-watch/sessions/", { action: "list" });
          renderRaces(data.sessions);
        } catch (error) {
          showMessage(error.message || "This race could not be deleted.", true);
          button.disabled = false;
        }
      });
    });
  }

  function formatDateTime(isoText) {
    const date = new Date(String(isoText || ""));
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " at " + date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function renderRaceDayStatus(status, keepReveal = false) {
    // A freshly generated code is only ever shown once, right after the
    // click that made it -- any later status refresh (revoke, page
    // reload) re-hides it, since the raw code isn't recoverable server-side.
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

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("");

    const formData = new FormData(createForm);
    const distanceValue = Number(formData.get("distance_value"));
    const unit = String(formData.get("distance_unit_display") || "miles");
    const distanceMeters = distanceValue * unitToMeters(unit);

    // Each row converts using its own unit selector, not the race's overall
    // unit -- see createCheckpointRow's comment above for why.
    const checkpoints = readCheckpoints(checkpointRows, unit);

    try {
      const data = await apiFetch("/api/split-watch/sessions/", {
        action: "create",
        name: formData.get("name"),
        race_date: formData.get("race_date"),
        sport: formData.get("sport"),
        distance_meters: distanceMeters,
        distance_unit_display: unit,
        checkpoints
      });

      window.location.href = "/split-watch/plan/?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(data.session.id);
    } catch (error) {
      showMessage(error.message || "The race could not be created.", true);
    }
  });

  // ---- meet setup: create HS/JH boys/girls races together -------------------
  // Instead of running "Create a race" four times (same meet name, same
  // date, then adding the same roster split by hand each time), a coach
  // picks squads once and this creates one race per squad, each already
  // populated with that squad's current roster. grade (7-8 = JH, 9-12 =
  // HS) + gender is the same grouping used by the Plan page's "Add all
  // HS/JH Boys/Girls" buttons -- see lib/split_watch_service.mjs's
  // listTeamRoster().
  let meetRosterGroups = { hs_boys: [], hs_girls: [], jh_boys: [], jh_girls: [] };

  const MEET_SQUAD_LABELS = { hs_boys: "HS Boys", hs_girls: "HS Girls", jh_boys: "JH Boys", jh_girls: "JH Girls" };
  const MEET_SQUAD_CHECKBOXES = { hs_boys: meetSquadHsBoys, hs_girls: meetSquadHsGirls, jh_boys: meetSquadJhBoys, jh_girls: meetSquadJhGirls };
  const MEET_SQUAD_GROUP = { hs_boys: "hs", hs_girls: "hs", jh_boys: "jh", jh_girls: "jh" };
  const MEET_GROUP_DISTANCE_INPUTS = { hs: meetDistanceHs, jh: meetDistanceJh };
  const MEET_GROUP_UNIT_INPUTS = { hs: meetUnitHs, jh: meetUnitJh };
  const MEET_GROUP_LABELS = { hs: "High School", jh: "Junior High" };

  function athleteMeetGroup(athlete) {
    if (athlete.gender !== "boys" && athlete.gender !== "girls") return null;
    if (athlete.grade == null) return null;
    const level = Number(athlete.grade) <= 8 ? "jh" : "hs";
    return level + "_" + athlete.gender;
  }

  meetRosterLink.href = "/team-roster/?id=" + encodeURIComponent(teamId);

  async function populateMeetRoster() {
    try {
      const sport = meetSportSelect.value || "cross_country";
      const data = await apiFetch("/api/split-watch/plan/", { action: "list_roster", sport });
      const athletes = data.athletes || [];

      meetRosterGroups = { hs_boys: [], hs_girls: [], jh_boys: [], jh_girls: [] };
      athletes.forEach((athlete) => {
        const group = athleteMeetGroup(athlete);
        if (group) meetRosterGroups[group].push(athlete);
      });

      Object.keys(MEET_SQUAD_CHECKBOXES).forEach((key) => {
        const hasAthletes = meetRosterGroups[key].length > 0;
        MEET_SQUAD_CHECKBOXES[key].closest("label").hidden = !hasAthletes;
        if (!hasAthletes) MEET_SQUAD_CHECKBOXES[key].checked = false;
      });

      meetGroupHs.hidden = meetRosterGroups.hs_boys.length === 0 && meetRosterGroups.hs_girls.length === 0;
      meetGroupJh.hidden = meetRosterGroups.jh_boys.length === 0 && meetRosterGroups.jh_girls.length === 0;

      meetEmpty.hidden = athletes.length > 0;
      meetForm.hidden = athletes.length === 0;
    } catch {
      // A failed roster fetch just leaves the meet form as-is -- the
      // separate single-race "Create a race" form above is unaffected.
    }
  }

  meetSportSelect.addEventListener("change", () => { populateMeetRoster(); });

  meetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("");

    const formData = new FormData(meetForm);
    const meetName = String(formData.get("meet_name") || "").trim();
    const meetDate = String(formData.get("meet_date") || "").trim();
    const sport = String(formData.get("meet_sport") || "cross_country");

    const selectedSquads = Object.keys(MEET_SQUAD_CHECKBOXES).filter((key) => (
      MEET_SQUAD_CHECKBOXES[key].checked && !MEET_SQUAD_CHECKBOXES[key].closest("label").hidden
    ));

    if (selectedSquads.length === 0) {
      showMessage("Select at least one squad to create races for.", true);
      return;
    }

    const usedGroups = [...new Set(selectedSquads.map((key) => MEET_SQUAD_GROUP[key]))];
    for (const group of usedGroups) {
      const distanceValue = Number(MEET_GROUP_DISTANCE_INPUTS[group].value);
      if (!distanceValue || distanceValue <= 0) {
        showMessage("Enter a distance for the " + MEET_GROUP_LABELS[group] + " group.", true);
        return;
      }
    }

    const results = [];
    for (const key of selectedSquads) {
      const group = MEET_SQUAD_GROUP[key];
      const distanceValue = Number(MEET_GROUP_DISTANCE_INPUTS[group].value);
      const unit = String(MEET_GROUP_UNIT_INPUTS[group].value || "miles");
      const distanceMeters = distanceValue * unitToMeters(unit);
      const athletes = meetRosterGroups[key];
      const checkpoints = readCheckpoints(meetCheckpointContainers[group], unit);

      try {
        const created = await apiFetch("/api/split-watch/sessions/", {
          action: "create",
          name: meetName + " - " + MEET_SQUAD_LABELS[key],
          race_date: meetDate,
          sport,
          distance_meters: distanceMeters,
          distance_unit_display: unit,
          checkpoints
        });

        await apiFetch("/api/split-watch/plan/", {
          action: "save_participants",
          session_id: created.session.id,
          participants: athletes.map((athlete) => ({ team_athlete_id: athlete.id }))
        });

        results.push({ label: MEET_SQUAD_LABELS[key], ok: true, count: athletes.length });
      } catch (error) {
        results.push({ label: MEET_SQUAD_LABELS[key], ok: false, error: error.message || "Could not be created." });
      }
    }

    const succeeded = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);

    let summary = "";
    if (succeeded.length > 0) {
      summary += "Created " + succeeded.length + " race" + (succeeded.length === 1 ? "" : "s") + ": " +
        succeeded.map((r) => r.label + " (" + r.count + (r.count === 1 ? " runner" : " runners") + ")").join(", ") + ".";
    }
    if (failed.length > 0) {
      summary += (summary ? " " : "") + failed.map((r) => r.label + " could not be created (" + r.error + ")").join(" ");
    }
    showMessage(summary, failed.length > 0);

    if (succeeded.length > 0) {
      const refreshed = await apiFetch("/api/split-watch/sessions/", { action: "list" });
      renderRaces(refreshed.sessions);
    }

    if (failed.length === 0) {
      meetForm.reset();
      populateMeetRoster();
    }
  });

  async function initialize() {
    if (!teamId) {
      loadingBox.innerHTML = "<h2>Split Watch not found</h2><p>This link does not include a team ID.</p>";
      return;
    }

    try {
      // Don't hard-gate on a Supabase user here -- a race-day access code
      // visitor never has one. Show what we can up front and let the actual
      // API call (which the server will authorize via bearer token OR the
      // race-day cookie) decide whether access is really allowed.
      const user = await window.PodiumTeamAuth.getUser();
      accountEl.textContent = user ? (user.email || "Team account") : "Race day access";

      const data = await apiFetch("/api/split-watch/sessions/", { action: "list" });
      teamNameEl.textContent = data.team.school_name;
      teamLink.href = "/team/?slug=" + encodeURIComponent(data.team.slug);
      renderRaces(data.sessions);

      addCheckpointRow("Mile 1", "");
      addCheckpointRow("Mile 2", "");
      createCheckpointRow(meetCheckpointRowsHs, () => meetUnitFor("hs"), "Mile 1", "");
      createCheckpointRow(meetCheckpointRowsHs, () => meetUnitFor("hs"), "Mile 2", "");
      createCheckpointRow(meetCheckpointRowsJh, () => meetUnitFor("jh"), "Mile 1", "");
      createCheckpointRow(meetCheckpointRowsJh, () => meetUnitFor("jh"), "Mile 2", "");

      populateMeetRoster();

      // Managing the race day code itself always requires a real coach
      // account (api/team/race-day-code.js), never the race-day cookie a
      // volunteer landed here with -- so this whole panel only makes
      // sense, and only appears, for a signed-in coach.
      if (user) {
        raceDaySection.hidden = false;
        try {
          const raceDayData = await apiFetch("/api/team/race-day-code/", { action: "status" });
          renderRaceDayStatus(raceDayData.status);
        } catch {
          renderRaceDayStatus(null);
        }
      }

      loadingBox.hidden = true;
      root.hidden = false;
    } catch (error) {
      loadingBox.innerHTML =
        "<h2>Split Watch unavailable</h2>" +
        "<p>" + escapeHtml(error.message || "Races could not be loaded.") + "</p>" +
        '<p><a class="button button-primary" href="/team-dashboard/">Return to dashboard</a></p>';
    }
  }

  initialize();
})();
