(() => {
  const loadingBox = document.querySelector("[data-tw-loading]");
  const root = document.querySelector("[data-tw-root]");
  const teamNameEl = document.querySelector("[data-tw-team-name]");
  const accountEl = document.querySelector("[data-tw-account]");
  const teamLink = document.querySelector("[data-tw-team-link]");
  const messageBox = document.querySelector("[data-tw-message]");
  const nextCard = document.querySelector("[data-tw-next-card]");
  const nextContent = document.querySelector("[data-tw-next-content]");
  const todayCard = document.querySelector("[data-tw-today-card]");
  const todayContent = document.querySelector("[data-tw-today-content]");
  const rosterCountEl = document.querySelector("[data-tw-roster-count]");
  const upcomingCountEl = document.querySelector("[data-tw-upcoming-count]");
  const recentCountEl = document.querySelector("[data-tw-recent-count]");
  const rosterLink = document.querySelector("[data-tw-roster-link]");
  const scheduleLink = document.querySelector("[data-tw-schedule-link]");
  const swLink = document.querySelector("[data-tw-sw-link]");
  const upcomingList = document.querySelector("[data-tw-upcoming-list]");
  const upcomingEmpty = document.querySelector("[data-tw-upcoming-empty]");
  const recentList = document.querySelector("[data-tw-recent-list]");
  const recentEmpty = document.querySelector("[data-tw-recent-empty]");
  const raceDayReveal = document.querySelector("[data-tw-race-day-reveal]");
  const raceDayRevealCode = document.querySelector("[data-tw-race-day-reveal-code]");
  const raceDayCopyButton = document.querySelector("[data-tw-race-day-copy]");
  const raceDayStatusEl = document.querySelector("[data-tw-race-day-status]");
  const raceDayGenerateButton = document.querySelector("[data-tw-race-day-generate]");
  const raceDayRevokeButton = document.querySelector("[data-tw-race-day-revoke]");

  const requiredElements = [
    loadingBox, root, teamNameEl, accountEl, teamLink, messageBox, nextCard, nextContent,
    todayCard, todayContent,
    rosterCountEl, upcomingCountEl, recentCountEl, rosterLink, scheduleLink, swLink,
    upcomingList, upcomingEmpty, recentList, recentEmpty,
    raceDayReveal, raceDayRevealCode, raceDayCopyButton, raceDayStatusEl, raceDayGenerateButton, raceDayRevokeButton
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

  function formatDateTime(isoText) {
    const date = new Date(String(isoText || ""));
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " at " + date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
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
        ? "/split-watch/live/?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(race.id)
        : "/split-watch/plan/?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(race.id);
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

  // Race day spec, Section 9/Problem 5: "coach signs in, coach sees
  // today's race, coach taps once." Deliberately separate from
  // renderNext() above (which covers general season planning, any future
  // date) -- this card only ever appears when something is actually
  // happening TODAY, and its whole point is one obvious primary action,
  // not a browsable list.
  function primaryActionFor(race) {
    const idPart = "?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(race.id);
    if (race.status === "live") {
      return { label: "RESUME LIVE TIMING", href: "/split-watch/live/" + idPart };
    }
    if (race.status === "scheduled") {
      return { label: "START LIVE TIMING", href: "/split-watch/live/" + idPart };
    }
    if (race.status === "finished" || race.status === "reviewed") {
      return { label: "VIEW RESULTS", href: "/split-watch/review/" + idPart };
    }
    // draft -- participants/checkpoints not yet fully set up.
    return { label: "CONTINUE RACE SETUP", href: "/split-watch/plan/" + idPart };
  }

  function renderTodayRaceRow(race, { primary = false } = {}) {
    const action = primaryActionFor(race);
    const isLive = race.status === "live";
    const readiness = race.status === "draft" || race.status === "scheduled"
      ? race.ready_count + " of " + race.participant_count + " ready"
      : "";
    return (
      '<div class="tw-today-race' + (isLive ? " tw-today-race-live" : "") + '">' +
        '<div>' +
          '<strong>' + (isLive ? '<span class="tw-today-live-dot"></span>' : "") + escapeHtml(race.name) + '</strong>' +
          '<div class="tw-item-meta">' + escapeHtml(STATUS_LABELS[race.status] || race.status) + (readiness ? " · " + readiness : "") + '</div>' +
        '</div>' +
        '<a class="button ' + (primary ? "button-primary" : "button-outline") + '" style="color:#fff;border-color:rgba(255,255,255,0.6);" href="' + action.href + '">' + escapeHtml(action.label) + '</a>' +
      '</div>'
    );
  }

  function renderTodaysRaceDay(todaysRaceDay) {
    if (!todaysRaceDay) { todayCard.hidden = true; return; }

    // Chronological priority: live first (always shown, always the
    // primary action if present), then today's next race(s), then
    // today's already-finished races -- matches Section 9's "currently
    // live race always first and visually obvious."
    const all = [...todaysRaceDay.liveRaces, ...todaysRaceDay.upcomingToday, ...todaysRaceDay.finishedToday];

    if (all.length === 0) { todayCard.hidden = true; return; }

    const primaryRace = todaysRaceDay.singleRelevantRace || all[0];
    todayContent.innerHTML = all.map((race) => renderTodayRaceRow(race, { primary: race.id === primaryRace.id })).join("");
    todayCard.hidden = false;
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
        '<a class="button button-outline" href="/split-watch/review/?id=' + encodeURIComponent(teamId) + '&race=' + encodeURIComponent(race.id) + '">View review</a>' +
      '</div>'
    )).join("");
  }

  function renderRaceDayStatus(status, keepReveal = false) {
    // A freshly generated code is only ever shown once, right after the
    // click that made it -- any later status refresh (revoke, page
    // reload) re-hides it, since the raw code isn't recoverable server-side.
    // The one exception is the immediate re-render right after generating
    // it, which passes keepReveal so the code stays visible.
    if (!keepReveal) raceDayReveal.hidden = true;

    if (!status || !status.active) {
      raceDayStatusEl.innerHTML =
        '<strong>Race day access is off.</strong>' +
        '<div class="tw-item-meta">No volunteer code is active for this team right now.</div>';
      raceDayGenerateButton.textContent = "Generate code";
      raceDayRevokeButton.hidden = true;
      return;
    }

    const created = formatDateTime(status.created_at);
    const lastUsed = formatDateTime(status.last_used_at);
    const expires = formatDateTime(status.expires_at);
    raceDayStatusEl.innerHTML =
      '<strong>Race day access is on.</strong>' +
      '<div class="tw-item-meta">' +
        (created ? "Created " + created : "Active") +
        " · " + (lastUsed ? "Last used " + lastUsed : "Not used yet") +
        (expires ? " · Expires " + expires : "") +
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
      messageBox.textContent = error.message || "The code could not be generated.";
      messageBox.hidden = false;
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
      messageBox.textContent = error.message || "Race day access could not be turned off.";
      messageBox.hidden = false;
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
      [rosterLink, scheduleLink, swLink].forEach((link) => {
        const url = new URL(link.getAttribute("href"), window.location.origin);
        url.searchParams.set("id", teamId);
        link.href = url.pathname + url.search;
      });

      renderTodaysRaceDay(data.todaysRaceDay);
      renderNext(data);
      rosterCountEl.textContent = data.rosterCount;
      upcomingCountEl.textContent = data.upcomingMeets.length;
      recentCountEl.textContent = data.recentRaceSessions.length;
      renderUpcoming(data.upcomingMeets);
      renderRecent(data.recentRaceSessions);

      // A failure here shouldn't take down the whole page -- the rest of
      // Team Home is still useful even if the race day code status can't load.
      try {
        const raceDayData = await apiFetch("/api/team/race-day-code/", { action: "status" });
        renderRaceDayStatus(raceDayData.status);
      } catch {
        renderRaceDayStatus(null);
      }

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
