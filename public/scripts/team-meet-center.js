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
  const SESSIONS_ENDPOINT = "/api/race-command-center/sessions/";
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
    if (race.status === "live") return { href: "/race-command-center/live/" + idPart, label: "Open live timing" };
    if (race.status === "finished" || race.status === "reviewed") return { href: "/race-command-center/review/" + idPart, label: "View review" };
    return { href: "/race-command-center/plan/" + idPart, label: "Open plan" };
  }

  function parseResponse(response, fallback) {
    return response.json().catch(() => ({})).then((data) => {
      if (!response.ok) throw new Error(data.error || fallback);
      return data;
    });
  }

  async function apiFetch(endpoint, payload) {
    const accessToken = await window.PodiumTeamAuth.getAccessToken();
    if (!accessToken) {
      window.location.replace("/team-login/");
      throw new Error("Team account sign in required.");
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
      body: JSON.stringify({ team_id: teamId, ...payload })
    });
    if (response.status === 401) window.location.replace("/team-login/");
    return parseResponse(response, "The meet center request could not be completed.");
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
      return (
        '<div class="tw-race-row">' +
          '<div><strong>' + escapeHtml(race.name) + '</strong><div style="font-size:0.85rem;opacity:0.75;">' + race.ready_count + ' of ' + race.participant_count + ' race plans ready</div></div>' +
          '<span class="' + statusBadgeClass(race.status) + '">' + escapeHtml(STATUS_LABELS[race.status] || race.status) + '</span>' +
          '<a class="button button-primary" href="' + action.href + '">' + action.label + '</a>' +
        '</div>'
      );
    }).join("");
  }

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

      window.location.href = "/race-command-center/plan/?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(data.session.id);
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
      const user = await window.PodiumTeamAuth.getUser();
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
      loadingBox.innerHTML =
        "<h2>This meet center could not be loaded</h2>" +
        "<p>" + escapeHtml(error.message || "Please try again.") + "</p>" +
        '<p><a class="button button-primary" href="/team-home/?id=' + encodeURIComponent(teamId) + '">Back to team home</a></p>';
    }
  }

  initialize();
})();
