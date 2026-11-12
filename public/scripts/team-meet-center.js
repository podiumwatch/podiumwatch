(() => {
  const loadingBox = document.querySelector("[data-tmc-loading]");
  const root = document.querySelector("[data-tmc-root]");
  const teamNameEl = document.querySelector("[data-tmc-team-name]");
  const meetNameEl = document.querySelector("[data-tmc-meet-name]");
  const meetMetaEl = document.querySelector("[data-tmc-meet-meta]");
  const homeLink = document.querySelector("[data-tmc-home-link]");
  const publicLink = document.querySelector("[data-tmc-public-link]");
  const messageBox = document.querySelector("[data-tmc-message]");
  const notConnectedNotice = document.querySelector("[data-tmc-not-connected]");
  const raceList = document.querySelector("[data-tmc-race-list]");
  const raceEmpty = document.querySelector("[data-tmc-race-empty]");
  const createForm = document.querySelector("[data-tmc-create-form]");

  const requiredElements = [
    loadingBox, root, teamNameEl, meetNameEl, meetMetaEl, homeLink, publicLink,
    messageBox, notConnectedNotice, raceList, raceEmpty, createForm
  ];
  if (requiredElements.some((el) => !el)) return;

  const params = new URLSearchParams(window.location.search);
  const teamId = String(params.get("id") || "").trim();
  const meetId = String(params.get("meet") || "").trim();

  const MEET_CENTER_ENDPOINT = "/api/team/meet-center/";
  const SESSIONS_ENDPOINT = "/api/split-watch/sessions/";
  const MILE_METERS = 1609.344;

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

  function formatDate(dateText) {
    const cleaned = String(dateText || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
    const date = new Date(`${cleaned}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return cleaned;
    return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }

  const STATUS_LABELS = {
    draft: "Draft", scheduled: "Scheduled", live: "Live",
    finished: "Finished", reviewed: "Reviewed", cancelled: "Cancelled"
  };

  function statusBadgeClass(status) {
    if (status === "live") return "tw-badge tw-badge-live";
    if (status === "finished" || status === "reviewed") return "tw-badge tw-badge-finished";
    return "tw-badge";
  }

  function actionLinkFor(race) {
    const idPart = "?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(race.id);
    if (race.status === "live") return { href: "/split-watch/live/" + idPart, label: "Open live timing" };
    if (race.status === "finished" || race.status === "reviewed") return { href: "/split-watch/review/" + idPart, label: "View review" };
    return { href: "/split-watch/plan/" + idPart, label: "Open plan" };
  }

  // Track build Phase 1 (2026-11-12): bounded by the shared helper
  // (public/scripts/split-watch-request.js). Coach-only page: no sign-in
  // still goes to the login page, but a sign-in that couldn't be loaded
  // (stalled wifi) is a retryable connection problem, not "signed out".
  const Request = window.PodiumSwRequest;

  async function apiFetch(endpoint, payload) {
    const { token, failed } = await Request.accessToken();
    if (!token) {
      if (failed) throw new Request.SwRequestError("auth_unavailable", "Couldn't confirm your account -- check your connection and try again.");
      window.location.replace("/team-login/");
      throw new Error("Team account sign in required.");
    }
    const { response, data } = await Request.request(endpoint, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ team_id: teamId, ...payload })
    });
    if (response.status === 401) window.location.replace("/team-login/");
    if (!response.ok) throw new Request.SwRequestError("http", data.error || "The meet center request could not be completed.", response.status, data);
    return data;
  }

  function renderRaces(raceSessions) {
    if (raceSessions.length === 0) {
      raceList.innerHTML = "";
      raceEmpty.hidden = false;
      return;
    }
    raceEmpty.hidden = true;
    raceList.innerHTML = raceSessions.map((race) => {
      const action = actionLinkFor(race);
      // Deleting is only ever allowed for a draft that hasn't started --
      // matches the same restriction the Plan page's own "Delete draft"
      // button already enforces (api/split-watch/sessions.js's
      // deleteSession()), just reachable from here too, since a race
      // group created by mistake in Meet Center has no other delete path.
      const deleteButton = race.status === "draft"
        ? '<button class="button button-outline" type="button" data-tmc-delete-race="' + escapeHtml(race.id) + '">Delete</button>'
        : "";
      return (
        '<div class="tw-race-row">' +
          '<div><strong>' + escapeHtml(race.name) + '</strong><div style="font-size:0.85rem;opacity:0.75;">' + race.ready_count + ' of ' + race.participant_count + ' race plans ready</div></div>' +
          '<span class="' + statusBadgeClass(race.status) + '">' + escapeHtml(STATUS_LABELS[race.status] || race.status) + '</span>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
            '<a class="button button-primary" href="' + action.href + '">' + action.label + '</a>' +
            deleteButton +
          '</div>' +
        '</div>'
      );
    }).join("");
  }

  raceList.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest("[data-tmc-delete-race]");
    if (!deleteButton) return;

    if (!window.confirm("Delete this race? This cannot be undone.")) return;
    deleteButton.disabled = true;
    try {
      await apiFetch(SESSIONS_ENDPOINT, { action: "delete", session_id: deleteButton.dataset.tmcDeleteRace });
      showMessage("The race was deleted.");
      await initialize();
    } catch (error) {
      showMessage(error.message || "This race could not be deleted.", true);
      deleteButton.disabled = false;
    }
  });

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("");

    const formData = new FormData(createForm);
    const distanceMeters = Number(formData.get("distance_miles")) * MILE_METERS;

    try {
      const data = await apiFetch(SESSIONS_ENDPOINT, {
        action: "create",
        name: formData.get("name"),
        race_date: window.__tmcMeetDate,
        sport: "cross_country",
        distance_meters: distanceMeters,
        distance_unit_display: "miles",
        meet_id: meetId,
        checkpoints: []
      });

      window.location.href = "/split-watch/plan/?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(data.session.id);
    } catch (error) {
      showMessage(error.message || "This race could not be created.", true);
    }
  });

  async function initialize() {
    if (!teamId || !meetId) {
      loadingBox.innerHTML = "<h2>Meet center not found</h2><p>This link is missing a team or meet id.</p>";
      return;
    }

    try {
      const user = await Request.withTimeout(window.PodiumTeamAuth.getUser(), Request.REQUEST_TIMEOUT_MS);
      if (!user) { window.location.replace("/team-login/"); return; }

      const data = await apiFetch(MEET_CENTER_ENDPOINT, { meet_id: meetId });

      teamNameEl.textContent = data.team.school_name;
      meetNameEl.textContent = data.meet.name;
      meetMetaEl.textContent = [formatDate(data.meet.meet_date), data.meet.venue_name, data.meet.city].filter(Boolean).join(" · ");
      homeLink.href = "/team-home/?id=" + encodeURIComponent(teamId);
      publicLink.href = "/meetdetail/?slug=" + encodeURIComponent(data.meet.slug || "");
      window.__tmcMeetDate = data.meet.meet_date;

      notConnectedNotice.hidden = Boolean(data.connection);

      renderRaces(data.raceSessions);

      loadingBox.hidden = true;
      root.hidden = false;
    } catch (error) {
      loadingBox.hidden = false;
      root.hidden = true;
      Request.showRetry(loadingBox, {
        title: "This meet center could not be loaded",
        message: error.message || "Please try again.",
        backHref: "/team-home/?id=" + encodeURIComponent(teamId),
        backLabel: "Back to team home",
        onRetry: () => {
          loadingBox.innerHTML = "<h2>Loading meet center...</h2>";
          initialize();
        }
      });
    }
  }

  initialize();
})();
