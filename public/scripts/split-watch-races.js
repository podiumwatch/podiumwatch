// Race-selection landing page for a race-day code -- see splitwatchraces.mjs's
// header comment for why this exists as its own page rather than reusing
// the full coach hub. Deliberately minimal: list, tap, go time it.
(() => {
  const loadingBox = document.querySelector("[data-swr-loading]");
  const root = document.querySelector("[data-swr-root]");
  const teamNameEl = document.querySelector("[data-swr-team-name]");
  const messageBox = document.querySelector("[data-swr-message]");
  const raceList = document.querySelector("[data-swr-race-list]");
  const raceEmpty = document.querySelector("[data-swr-race-empty]");
  const joinPanel = document.querySelector("[data-swr-join-panel]");
  const joinRaceName = document.querySelector("[data-swr-join-race-name]");
  const joinNameInput = document.querySelector("[data-swr-join-name]");
  const joinPositionSelect = document.querySelector("[data-swr-join-position]");
  const joinMessage = document.querySelector("[data-swr-join-message]");
  const joinConfirmButton = document.querySelector("[data-swr-join-confirm]");

  const requiredElements = [
    loadingBox, root, teamNameEl, messageBox, raceList, raceEmpty,
    joinPanel, joinRaceName, joinNameInput, joinPositionSelect, joinMessage, joinConfirmButton
  ];
  if (requiredElements.some((el) => !el)) return;

  const params = new URLSearchParams(window.location.search);
  const teamId = String(params.get("id") || "").trim();

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function showMessage(text, isError = false) {
    messageBox.textContent = text;
    messageBox.hidden = !text;
    messageBox.style.background = isError ? "rgba(220, 38, 38, 0.12)" : "rgba(0, 191, 99, 0.1)";
  }

  function parseResponse(response, fallback) {
    return response.json().catch(() => ({})).then((data) => {
      if (!response.ok) throw new Error(data.error || fallback);
      return data;
    });
  }

  async function apiFetch(endpoint, payload) {
    // Same dual-credential pattern as every other Split Watch page --
    // a race-day code visitor has no Supabase session, only the
    // HttpOnly cookie the server checks. See split-watch-hub.js.
    const accessToken = await window.PodiumTeamAuth.getAccessToken();
    const headers = { Accept: "application/json", "Content-Type": "application/json" };
    if (accessToken) headers.Authorization = "Bearer " + accessToken;
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ team_id: teamId, ...payload })
    });
    if (response.status === 401) window.location.replace("/split-watch/join/");
    return parseResponse(response, "The request could not be completed.");
  }

  const STATUS_LABELS = { live: "Live", scheduled: "Scheduled", draft: "Not started", finished: "Finished", reviewed: "Reviewed" };

  function badgeClass(status) {
    if (status === "live") return "swr-badge swr-badge-live";
    if (status === "finished" || status === "reviewed") return "swr-badge swr-badge-finished";
    return "swr-badge";
  }

  // Race day feedback (2026-08-25) -- "one of the biggest usability
  // problems": a helper who entered a valid code used to land on a full
  // list of every current/recent race and had to pick the right one
  // themselves, with nothing to stop them picking an old one. Now: if
  // there is exactly one obviously relevant race (lib/todays_race_service.mjs's
  // singleRelevantRace -- the one live race, or if none is live, today's
  // next race, or if nothing today is live or upcoming, today's most
  // recently finished race), skip the list entirely and go straight
  // there. A list is only ever shown for the one genuinely ambiguous
  // case: more than one race live at the same time.
  function destinationFor(session) {
    const idPart = "?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(session.id);
    if (session.status === "finished" || session.status === "reviewed") {
      return "/split-watch/review/" + idPart;
    }
    // Live, scheduled, and draft all land on the Live page -- it already
    // shows the correct screen itself (running timing, or a "waiting for
    // the coach to start" screen for a helper) based on the race's own
    // current status, so there's no separate "waiting" page to route to.
    return "/split-watch/live/" + idPart;
  }

  function renderLiveChoiceList(liveRaces) {
    raceEmpty.hidden = true;
    raceList.innerHTML = liveRaces.map((session) => (
      '<div class="swr-race-card">' +
        '<div>' +
          '<h3>' + escapeHtml(session.name) + '<span class="' + badgeClass(session.status) + '">' + escapeHtml(STATUS_LABELS[session.status] || session.status) + '</span></h3>' +
          '<p class="swr-race-meta">' + escapeHtml(session.race_date) + (session.race_type ? ' &middot; ' + escapeHtml(session.race_type) : '') + '</p>' +
        '</div>' +
        '<a class="button button-primary" href="' + destinationFor(session) + '">Go time it</a>' +
      '</div>'
    )).join("");
  }

  // Timing Crew (Project 3): before sending a helper straight into
  // timing, check whether the race actually has positions set up at
  // all. A race with none (every race before this project, and any
  // team that never opts in) skips this entirely -- same instant
  // redirect as before, no new step for anyone who hasn't set up crew
  // positions. Only once a coach HAS defined positions does a helper
  // need to say who they are and which one they've got.
  let pendingRace = null;

  async function showJoinPanel(session, positions) {
    pendingRace = session;
    loadingBox.hidden = true;
    root.hidden = false;
    joinPanel.hidden = false;
    joinRaceName.textContent = session.name;

    joinPositionSelect.innerHTML =
      '<option value="">Not sure yet -- I\'ll ask my coach</option>' +
      positions.map((p) => '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.label) + '</option>').join("");
  }

  joinConfirmButton.addEventListener("click", async () => {
    if (!pendingRace) return;
    const name = joinNameInput.value.trim();
    if (!name) {
      joinMessage.textContent = "Enter your name so your coach knows who's timing.";
      joinMessage.hidden = false;
      joinMessage.style.background = "rgba(220, 38, 38, 0.12)";
      return;
    }

    joinConfirmButton.disabled = true;
    try {
      await fetch("/api/split-watch/join/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_position",
          team_id: teamId,
          session_id: pendingRace.id,
          position_id: joinPositionSelect.value || null,
          display_name: name
        })
      }).then((response) => response.json().then((data) => {
        if (!response.ok) throw new Error(data.error || "That could not be saved.");
      }));
      window.location.replace(destinationFor(pendingRace));
    } catch (error) {
      joinMessage.textContent = error.message || "That could not be saved.";
      joinMessage.hidden = false;
      joinMessage.style.background = "rgba(220, 38, 38, 0.12)";
      joinConfirmButton.disabled = false;
    }
  });

  async function routeToRace(session) {
    try {
      const positionsData = await apiFetch("/api/split-watch/crew/", { action: "list_positions", session_id: session.id });
      if (!positionsData.positions || positionsData.positions.length === 0) {
        window.location.replace(destinationFor(session));
        return;
      }
      await showJoinPanel(session, positionsData.positions);
    } catch {
      // A helper isn't allowed to fail out of timing a race just
      // because the position list couldn't be checked -- fall back to
      // the same direct route every race used before this project.
      window.location.replace(destinationFor(session));
    }
  }

  async function initialize() {
    if (!teamId) {
      loadingBox.innerHTML = "<h2>Split Watch not found</h2><p>This link does not include a team ID.</p>";
      return;
    }

    try {
      const data = await apiFetch("/api/split-watch/sessions/", { action: "today" });
      teamNameEl.textContent = data.team.school_name;

      if (data.singleRelevantRace) {
        await routeToRace(data.singleRelevantRace);
        return;
      }

      loadingBox.hidden = true;
      root.hidden = false;

      if (data.needsChoice) {
        showMessage("More than one race is live right now -- choose which one you're timing.");
        renderLiveChoiceList(data.liveRaces);
        return;
      }

      raceList.innerHTML = "";
      raceEmpty.hidden = false;
    } catch (error) {
      loadingBox.innerHTML =
        "<h2>Split Watch unavailable</h2>" +
        "<p>" + escapeHtml(error.message || "Races could not be loaded.") + "</p>";
    }
  }

  initialize();
})();
