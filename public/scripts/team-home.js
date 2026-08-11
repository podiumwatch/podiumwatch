(() => {
  const loadingBox = document.querySelector("[data-tw-loading]");
  const root = document.querySelector("[data-tw-root]");
  const teamNameEl = document.querySelector("[data-tw-team-name]");
  const accountEl = document.querySelector("[data-tw-account]");
  const teamLink = document.querySelector("[data-tw-team-link]");
  const messageBox = document.querySelector("[data-tw-message]");
  const nextCard = document.querySelector("[data-tw-next-card]");
  const nextContent = document.querySelector("[data-tw-next-content]");
  const rosterCountEl = document.querySelector("[data-tw-roster-count]");
  const upcomingCountEl = document.querySelector("[data-tw-upcoming-count]");
  const recentCountEl = document.querySelector("[data-tw-recent-count]");
  const rosterLink = document.querySelector("[data-tw-roster-link]");
  const scheduleLink = document.querySelector("[data-tw-schedule-link]");
  const rccLink = document.querySelector("[data-tw-rcc-link]");
  const upcomingList = document.querySelector("[data-tw-upcoming-list]");
  const upcomingEmpty = document.querySelector("[data-tw-upcoming-empty]");
  const recentList = document.querySelector("[data-tw-recent-list]");
  const recentEmpty = document.querySelector("[data-tw-recent-empty]");

  const requiredElements = [
    loadingBox, root, teamNameEl, accountEl, teamLink, messageBox, nextCard, nextContent,
    rosterCountEl, upcomingCountEl, recentCountEl, rosterLink, scheduleLink, rccLink,
    upcomingList, upcomingEmpty, recentList, recentEmpty
  ];
  if (requiredElements.some((el) => !el)) return;

  const params = new URLSearchParams(window.location.search);
  const teamId = String(params.get("id") || "").trim();

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function formatDate(dateText) {
    const cleaned = String(dateText || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
    const date = new Date(`${cleaned}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return cleaned;
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  const STATUS_LABELS = {
    draft: "Draft", scheduled: "Scheduled", live: "Live",
    finished: "Finished", reviewed: "Reviewed", cancelled: "Cancelled"
  };

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
    return parseResponse(response, "The team home request could not be completed.");
  }

  function renderNext(data) {
    const parts = [];

    if (data.nextMeet && data.nextMeet.meet) {
      const meet = data.nextMeet.meet;
      parts.push(
        '<div class="tw-item" style="background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.2);">' +
          '<div><strong>' + escapeHtml(meet.name) + '</strong><div class="tw-item-meta">' + escapeHtml(formatDate(meet.meet_date)) + (meet.venue_name ? " · " + escapeHtml(meet.venue_name) : "") + '</div></div>' +
          '<a class="button button-primary" href="/team-meet-center/?id=' + encodeURIComponent(teamId) + '&meet=' + encodeURIComponent(meet.id) + '">Open meet center</a>' +
        '</div>'
      );
    }

    if (data.nextRace) {
      const race = data.nextRace;
      const href = race.status === "live"
        ? "/race-command-center/live/?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(race.id)
        : "/race-command-center/plan/?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(race.id);
      parts.push(
        '<div class="tw-item" style="background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.2);">' +
          '<div><strong>' + escapeHtml(race.name) + '</strong><div class="tw-item-meta">' + escapeHtml(formatDate(race.race_date)) + " · " + escapeHtml(STATUS_LABELS[race.status] || race.status) + " · " + race.ready_count + " of " + race.participant_count + " ready" + '</div></div>' +
          '<a class="button button-outline" style="color:#fff;border-color:rgba(255,255,255,0.6);" href="' + href + '">' + (race.status === "live" ? "Open live timing" : "Open plan") + '</a>' +
        '</div>'
      );
    }

    if (parts.length === 0) {
      nextContent.innerHTML = '<p style="margin:0;opacity:0.85;">Nothing scheduled yet. Connect a meet or create a race to get started.</p>';
    } else {
      nextContent.innerHTML = '<div class="tw-list">' + parts.join("") + '</div>';
    }
  }

  function renderUpcoming(upcomingMeets) {
    if (upcomingMeets.length === 0) {
      upcomingList.innerHTML = "";
      upcomingEmpty.hidden = false;
      return;
    }
    upcomingEmpty.hidden = true;
    upcomingList.innerHTML = upcomingMeets.map((c) => {
      const meet = c.meet;
      return (
        '<div class="tw-item">' +
          '<div><strong>' + escapeHtml(meet.name) + '</strong><div class="tw-item-meta">' + escapeHtml(formatDate(meet.meet_date)) + (meet.venue_name ? " · " + escapeHtml(meet.venue_name) : "") + '</div></div>' +
          '<a class="button button-outline" href="/team-meet-center/?id=' + encodeURIComponent(teamId) + '&meet=' + encodeURIComponent(meet.id) + '">Meet center</a>' +
        '</div>'
      );
    }).join("");
  }

  function renderRecent(recentRaceSessions) {
    if (recentRaceSessions.length === 0) {
      recentList.innerHTML = "";
      recentEmpty.hidden = false;
      return;
    }
    recentEmpty.hidden = true;
    recentList.innerHTML = recentRaceSessions.map((race) => (
      '<div class="tw-item">' +
        '<div><strong>' + escapeHtml(race.name) + '</strong><div class="tw-item-meta">' + escapeHtml(formatDate(race.race_date)) + " · " + escapeHtml(STATUS_LABELS[race.status] || race.status) + '</div></div>' +
        '<a class="button button-outline" href="/race-command-center/review/?id=' + encodeURIComponent(teamId) + '&race=' + encodeURIComponent(race.id) + '">View review</a>' +
      '</div>'
    )).join("");
  }

  async function initialize() {
    if (!teamId) {
      loadingBox.innerHTML = "<h2>Team home not found</h2><p>This link does not include a team ID.</p>";
      return;
    }

    try {
      const user = await window.PodiumTeamAuth.getUser();
      if (!user) { window.location.replace("/team-login/"); return; }

      accountEl.textContent = user.email || "Team account";

      const data = await apiFetch("/api/team/home/", {});
      teamNameEl.textContent = data.team.school_name;
      teamLink.href = "/team/?slug=" + encodeURIComponent(data.team.slug);
      [rosterLink, scheduleLink, rccLink].forEach((link) => {
        const url = new URL(link.getAttribute("href"), window.location.origin);
        url.searchParams.set("id", teamId);
        link.href = url.pathname + url.search;
      });

      renderNext(data);
      rosterCountEl.textContent = data.rosterCount;
      upcomingCountEl.textContent = data.upcomingMeets.length;
      recentCountEl.textContent = data.recentRaceSessions.length;
      renderUpcoming(data.upcomingMeets);
      renderRecent(data.recentRaceSessions);

      loadingBox.hidden = true;
      root.hidden = false;
    } catch (error) {
      loadingBox.innerHTML =
        "<h2>Team home unavailable</h2>" +
        "<p>" + escapeHtml(error.message || "This team's home could not be loaded.") + "</p>" +
        '<p><a class="button button-primary" href="/team-dashboard/">Return to dashboard</a></p>';
    }
  }

  initialize();
})();
