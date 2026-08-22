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

  const requiredElements = [loadingBox, root, teamNameEl, messageBox, raceList, raceEmpty];
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

  const STATUS_LABELS = { live: "Live", scheduled: "Scheduled", finished: "Finished", reviewed: "Reviewed" };

  function badgeClass(status) {
    if (status === "live") return "swr-badge swr-badge-live";
    if (status === "finished" || status === "reviewed") return "swr-badge swr-badge-finished";
    return "swr-badge";
  }

  function actionFor(session) {
    const idPart = "?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(session.id);
    if (session.status === "finished" || session.status === "reviewed") {
      return { href: "/split-watch/review/" + idPart, label: "View results" };
    }
    return { href: "/split-watch/live/" + idPart, label: "Go time it" };
  }

  // Draft (not yet set up with participants/checkpoints) and cancelled
  // races are deliberately excluded here -- nothing for a volunteer to
  // do with either. Live first, then scheduled, then finished/reviewed
  // (most recent first) -- matches what a volunteer showing up on race
  // day actually needs, soonest-to-act-on first.
  function relevantSessions(sessions) {
    const rank = { live: 0, scheduled: 1, finished: 2, reviewed: 2 };
    return sessions
      .filter((s) => s.status === "live" || s.status === "scheduled" || s.status === "finished" || s.status === "reviewed")
      .sort((a, b) => {
        const diff = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
        if (diff !== 0) return diff;
        return String(b.race_date).localeCompare(String(a.race_date));
      });
  }

  function renderRaces(sessions) {
    const relevant = relevantSessions(sessions);

    if (relevant.length === 0) {
      raceList.innerHTML = "";
      raceEmpty.hidden = false;
      return;
    }

    raceEmpty.hidden = true;
    raceList.innerHTML = relevant.map((session) => {
      const action = actionFor(session);
      return (
        '<div class="swr-race-card">' +
          '<div>' +
            '<h3>' + escapeHtml(session.name) + '<span class="' + badgeClass(session.status) + '">' + escapeHtml(STATUS_LABELS[session.status] || session.status) + '</span></h3>' +
            '<p class="swr-race-meta">' + escapeHtml(session.race_date) + (session.race_type ? ' &middot; ' + escapeHtml(session.race_type) : '') + '</p>' +
          '</div>' +
          '<a class="button button-primary" href="' + action.href + '">' + action.label + '</a>' +
        '</div>'
      );
    }).join("");
  }

  async function initialize() {
    if (!teamId) {
      loadingBox.innerHTML = "<h2>Split Watch not found</h2><p>This link does not include a team ID.</p>";
      return;
    }

    try {
      const data = await apiFetch("/api/split-watch/sessions/", { action: "list" });
      teamNameEl.textContent = data.team.school_name;
      renderRaces(data.sessions);
      loadingBox.hidden = true;
      root.hidden = false;
    } catch (error) {
      loadingBox.innerHTML =
        "<h2>Split Watch unavailable</h2>" +
        "<p>" + escapeHtml(error.message || "Races could not be loaded.") + "</p>";
    }
  }

  initialize();
})();
