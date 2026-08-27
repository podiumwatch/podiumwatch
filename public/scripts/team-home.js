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
  const ccEmpty = document.querySelector("[data-tw-cc-empty]");
  const ccEmptyLink = document.querySelector("[data-tw-cc-empty-link]");
  const ccChoice = document.querySelector("[data-tw-cc-choice]");
  const ccChoiceList = document.querySelector("[data-tw-cc-choice-list]");
  const ccSingle = document.querySelector("[data-tw-cc-single]");
  const ccRaceName = document.querySelector("[data-tw-cc-race-name]");
  const ccRaceMeta = document.querySelector("[data-tw-cc-race-meta]");
  const ccPrimaryAction = document.querySelector("[data-tw-cc-primary-action]");
  const ccSummaryToggle = document.querySelector("[data-tw-cc-summary-toggle]");
  const ccSummaryDot = document.querySelector("[data-tw-cc-summary-dot]");
  const ccSummaryLabel = document.querySelector("[data-tw-cc-summary-label]");
  const ccChecklist = document.querySelector("[data-tw-cc-checklist]");
  const ccCrewAction = document.querySelector("[data-tw-cc-crew-action]");
  const ccParentAction = document.querySelector("[data-tw-cc-parent-action]");
  const ccDeviceLine = document.querySelector("[data-tw-cc-device-line]");
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
  const raceDayRevokeHelpersCheckbox = document.querySelector("[data-tw-race-day-revoke-helpers]");
  const raceDayRevokeButton = document.querySelector("[data-tw-race-day-revoke]");

  const requiredElements = [
    loadingBox, root, teamNameEl, accountEl, teamLink, messageBox, nextCard, nextContent,
    todayCard, ccEmpty, ccEmptyLink, ccChoice, ccChoiceList, ccSingle, ccRaceName, ccRaceMeta,
    ccPrimaryAction, ccSummaryToggle, ccSummaryDot, ccSummaryLabel, ccChecklist, ccCrewAction,
    ccParentAction, ccDeviceLine,
    rosterCountEl, upcomingCountEl, recentCountEl, rosterLink, scheduleLink, swLink,
    upcomingList, upcomingEmpty, recentList, recentEmpty,
    raceDayReveal, raceDayRevealCode, raceDayCopyButton, raceDayStatusEl, raceDayGenerateButton, raceDayRevokeButton,
    raceDayRevokeHelpersCheckbox
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

  // Race Day Command Center (build plan Project 2): "the coach signs in,
  // Split Watch immediately identifies the race that needs attention,
  // shows whether it's ready, explains the next required action, and
  // provides one-selection access to live timing." Data comes from
  // api/split-watch/sessions.js's "today" action (lib/race_day_command_
  // center_service.mjs), fetched independently of the rest of Team Home
  // -- see initialize() below, which fires this in parallel rather than
  // awaiting the slower aggregate /api/team/home/ call first.
  const STATUS_ICON = { complete: "✓", recommended: "–", attention: "!" };
  const STATUS_LABEL = { complete: "Complete", recommended: "Recommended", attention: "Attention" };

  function renderChecklistItem(itemData) {
    return (
      '<div class="tw-cc-item">' +
        '<div>' +
          '<div class="tw-cc-item-label">' + escapeHtml(itemData.label) + '</div>' +
          '<div class="tw-cc-item-explanation">' + escapeHtml(itemData.explanation) + '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<span class="tw-cc-item-status tw-cc-status-' + itemData.status + '">' +
            STATUS_ICON[itemData.status] + " " + STATUS_LABEL[itemData.status] +
          '</span>' +
          (itemData.actionHref && itemData.actionLabel
            ? '<a class="button button-outline tw-cc-item-fix" style="color:#fff;border-color:rgba(255,255,255,0.6);padding:6px 12px;font-size:0.8rem;" href="' + itemData.actionHref + '">' + escapeHtml(itemData.actionLabel) + '</a>'
            : "") +
        '</div>' +
      '</div>'
    );
  }

  // The one client-only readiness item (see public/scripts/device-
  // readiness.js's header comment for why this can't be evaluated on
  // the server): appended into the same checklist array so it renders
  // and counts toward "N items need attention" exactly like every
  // server-computed item.
  async function deviceReadinessItem() {
    if (!window.PodiumDeviceReadiness) {
      return { id: "device_storage", label: "Device ready for durable local capture", status: "attention", explanation: "This device's storage could not be checked.", actionLabel: null, actionHref: null };
    }
    const result = await window.PodiumDeviceReadiness.check();
    return {
      id: "device_storage",
      label: "Device ready for durable local capture",
      status: result.ok ? "complete" : "attention",
      explanation: result.ok ? "This device can safely store race data, even offline." : result.reason,
      actionLabel: null,
      actionHref: null
    };
  }

  function renderChoiceRace(race) {
    const href = "/split-watch/live/?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(race.id);
    return (
      '<div class="tw-today-race tw-today-race-live">' +
        '<div>' +
          '<strong><span class="tw-today-live-dot"></span>' + escapeHtml(race.name) + '</strong>' +
          '<div class="tw-item-meta">' + escapeHtml(formatDate(race.race_date)) + '</div>' +
        '</div>' +
        '<a class="button button-primary" href="' + href + '">Open live timing</a>' +
      '</div>'
    );
  }

  let checklistExpanded = false;
  function paintChecklist(items) {
    ccChecklist.innerHTML = items.map(renderChecklistItem).join("");
    ccChecklist.hidden = !checklistExpanded;
    const attentionCount = items.filter((i) => i.status !== "complete").length;
    ccSummaryDot.className = "tw-cc-summary-dot " + (attentionCount === 0 ? "tw-cc-dot-complete" : "tw-cc-dot-attention");
    ccSummaryLabel.textContent = attentionCount === 0
      ? "Ready for race day"
      : attentionCount + " item" + (attentionCount === 1 ? "" : "s") + " need" + (attentionCount === 1 ? "s" : "") + " attention";
  }

  ccSummaryToggle.addEventListener("click", () => {
    checklistExpanded = !checklistExpanded;
    ccChecklist.hidden = !checklistExpanded;
  });

  async function renderCommandCenter(data) {
    ccEmpty.hidden = true;
    ccChoice.hidden = true;
    ccSingle.hidden = true;

    if (!data) { todayCard.hidden = true; return; }

    if (data.needsChoice) {
      // Spec: "Do not select one silently... show both race names... Do
      // not offer to start another race." liveRaces is the explicit list.
      todayCard.hidden = false;
      ccChoice.hidden = false;
      ccChoiceList.innerHTML = data.liveRaces.map(renderChoiceRace).join("");
      return;
    }

    const race = data.singleRelevantRace;
    if (!race) {
      // Nothing live, nothing today, nothing upcoming within the window,
      // nothing finished today either -- a genuinely empty state.
      todayCard.hidden = false;
      ccEmpty.hidden = false;
      ccEmptyLink.href = "/team-meet-center/?id=" + encodeURIComponent(teamId);
      return;
    }

    todayCard.hidden = false;
    ccSingle.hidden = false;
    ccRaceName.textContent = race.name;
    ccRaceMeta.textContent = formatDate(race.race_date) + " · " + (STATUS_LABELS[race.status] || race.status);

    if (data.primaryAction) {
      ccPrimaryAction.textContent = data.primaryAction.label;
      ccPrimaryAction.href = data.primaryAction.href;
    }

    const planHref = "/split-watch/plan/?id=" + encodeURIComponent(teamId) + "&race=" + encodeURIComponent(race.id);
    ccCrewAction.href = "#race-day-access";
    ccParentAction.href = planHref;

    const serverItems = data.readiness ? data.readiness.items : [];
    ccSummaryLabel.textContent = "Checking readiness…";
    paintChecklist(serverItems);

    // Device check runs after the server items are already visible (it
    // can take a moment on some browsers) -- appended in, not blocking
    // the rest of the checklist from showing immediately.
    const deviceItem = await deviceReadinessItem();
    paintChecklist([...serverItems, deviceItem]);
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
      '</div>' +
      (status.code ? "" : '<div class="tw-item-meta">Generated before codes could be shown again here -- regenerate once and it\'ll stay visible from then on.</div>');
    raceDayGenerateButton.textContent = "Regenerate code";
    raceDayRevokeButton.hidden = false;

    // One code is meant to last the whole day -- adding a third helper
    // mid-afternoon should never require a brand new code just to read
    // back the one already given to the first two. Show it again every
    // time the dialog reopens, not just once at generation.
    if (status.code) {
      raceDayRevealCode.textContent = status.code;
      raceDayReveal.hidden = false;
    }
  }

  raceDayGenerateButton.addEventListener("click", async () => {
    raceDayGenerateButton.disabled = true;
    try {
      const generated = await apiFetch("/api/team/race-day-code/", {
        action: "regenerate",
        revoke_existing_helpers: raceDayRevokeHelpersCheckbox.checked
      });
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

      // Race Day Command Center (build plan Project 2): fired here, in
      // parallel with the slower aggregate call below, and rendered the
      // moment IT resolves -- never awaited after the aggregate call, so
      // a slow roster/schedule query can never hide the race-day action.
      // A failure here is reported inline on the card itself, not routed
      // through the page's own loading-failure screen -- the rest of
      // Team Home is still useful even if this one call fails.
      apiFetch("/api/split-watch/sessions/", { action: "today" })
        .then((commandCenterData) => renderCommandCenter(commandCenterData))
        .catch(() => { todayCard.hidden = true; });

      const data = await apiFetch("/api/team/home/", {});
      teamNameEl.textContent = data.team.school_name;
      teamLink.href = "/team/?slug=" + encodeURIComponent(data.team.slug);
      [rosterLink, scheduleLink, swLink].forEach((link) => {
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
