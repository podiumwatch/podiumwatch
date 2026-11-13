(() => {
  const loadingBox = document.querySelector("[data-sw-loading]");
  const root = document.querySelector("[data-sw-root]");
  const teamNameEl = document.querySelector("[data-sw-team-name]");
  const raceNameEl = document.querySelector("[data-sw-race-name]");
  const raceMetaEl = document.querySelector("[data-sw-race-meta]");
  const messageBox = document.querySelector("[data-sw-message]");
  const teamStats = document.querySelector("[data-sw-team-stats]");
  const teamRows = document.querySelector("[data-sw-team-rows]");
  const individualPanel = document.querySelector("[data-sw-individual-panel]");
  const individualName = document.querySelector("[data-sw-individual-name]");
  const individualClose = document.querySelector("[data-sw-individual-close]");
  const individualRows = document.querySelector("[data-sw-individual-rows]");
  const allRacesLink = document.querySelector("[data-sw-all-races-link]");
  const raceSwitcherWrap = document.querySelector("[data-sw-race-switcher-wrap]");
  const raceSwitcher = document.querySelector("[data-sw-race-switcher]");
  const copySummaryButton = document.querySelector("[data-sw-copy-summary]");
  const rehearsalReviewBanner = document.querySelector("[data-sw-rehearsal-review-banner]");

  const requiredElements = [
    loadingBox, root, teamNameEl, raceNameEl, raceMetaEl, messageBox,
    teamStats, teamRows, individualPanel, individualName, individualClose, individualRows,
    allRacesLink, raceSwitcherWrap, raceSwitcher, copySummaryButton, rehearsalReviewBanner
  ];
  if (requiredElements.some((el) => !el)) return;

  const params = new URLSearchParams(window.location.search);
  const teamId = String(params.get("id") || "").trim();
  const sessionId = String(params.get("race") || "").trim();

  // The static template can't know the team id -- without this the link
  // falls back to its bare href and lands on the Split Watch hub with no ?id=,
  // which the hub reports as "Split Watch not found."
  if (teamId) allRacesLink.href = "/split-watch/?id=" + encodeURIComponent(teamId);

  const REVIEW_ENDPOINT = "/api/split-watch/review/";
  const RaceMath = window.PodiumRaceMath;
  const PaceSplits = window.PodiumPaceSplits;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function formatSecondsToClock(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
    if (PaceSplits && typeof PaceSplits.formatWholeTime === "function") return PaceSplits.formatWholeTime(seconds);
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  // computeDiffFromTarget() documents positive = ahead of target (faster
  // than planned), negative = behind -- this must preserve that sign
  // exactly, never invert it, or "+0:20" and "-0:20" would mean the
  // opposite of what the calculation engine actually says.
  function formatDiff(seconds) {
    if (!Number.isFinite(seconds)) return "--";
    const sign = seconds > 0 ? "+" : (seconds < 0 ? "-" : "");
    return sign + formatSecondsToClock(Math.abs(seconds));
  }

  const STATUS_LABELS = {
    ahead: "Ahead of target", on_pace: "On target", at_risk: "Behind target", missed: "Missed target"
  };

  // Track build Phase 1 (2026-11-12): requests go through the shared
  // helper (public/scripts/split-watch-request.js) -- token, 15 s timeout,
  // one error shape. This page had no timeout before.
  const Request = window.PodiumSwRequest;

  let firstLoadDeadline = Request.loadDeadline();
  async function apiFetch(payload, { deadlineAtMs = null } = {}) {
    // Don't gate on a Supabase access token here -- a race-day access code
    // visitor has no Supabase session at all, but does have an HttpOnly
    // cookie the server will accept. Send the bearer token when we have one
    // (a real coach account) and let the browser send the cookie either way;
    // only redirect if the server actually says the request isn't allowed.
    return Request.api(REVIEW_ENDPOINT, { team_id: teamId, session_id: sessionId, ...payload }, {
      deadlineAtMs,
      fallback: "The review request could not be completed.",
      onUnauthorized: () => window.location.replace("/split-watch/join/")
    });
  }

  function participantName(participant) {
    return participant.manual_name || participant.display_name || "Runner";
  }

  const RACE_SWITCHER_STATUS_LABELS = {
    draft: "Draft", scheduled: "Scheduled", live: "Live",
    finished: "Finished", reviewed: "Reviewed"
  };
  let raceSwitcherSessions = [];

  // A team running JH/HS boys/girls races on the same day previously had
  // to back all the way out to the full race list to check another
  // race's results. This surfaces just today's other races right at the
  // top -- live ones first -- so switching is one tap, not a detour.
  // This page has its own single-endpoint apiFetch() (always POSTs to
  // REVIEW_ENDPOINT), so this uses a small standalone fetch against the
  // sessions endpoint instead of routing through it.
  async function populateRaceSwitcher(raceDate, raceName) {
    try {
      // Optional extra: any failure (including the shared 15 s timeout)
      // just leaves the switcher hidden.
      const data = await Request.api("/api/split-watch/sessions/", { team_id: teamId, action: "list" });

      raceSwitcherSessions = (data.sessions || [])
        .filter((s) => s.id !== sessionId && s.race_date === raceDate && s.status !== "cancelled")
        .sort((a, b) => {
          const rank = (s) => (s.status === "live" ? 0 : 1);
          const diff = rank(a) - rank(b);
          return diff !== 0 ? diff : a.name.localeCompare(b.name);
        });

      if (raceSwitcherSessions.length === 0) return;

      raceSwitcher.innerHTML =
        '<option value="">This race -- ' + escapeHtml(raceName) + '</option>' +
        raceSwitcherSessions.map((s) => (
          '<option value="' + escapeHtml(s.id) + '">' + escapeHtml(s.name) + ' (' + escapeHtml(RACE_SWITCHER_STATUS_LABELS[s.status] || s.status) + ')</option>'
        )).join("");
      raceSwitcherWrap.hidden = false;
    } catch {
      // A switcher that fails to populate just stays hidden -- never
      // blocks the review this page exists to show.
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

  // Live-tracking UX audit (docs/LIVE_TRACKING_UX_AUDIT.md): neither this
  // page nor the Live page had any quick export/screenshot-friendly way
  // to share results -- a coach texting a team recap had to retype
  // everything by hand. Populated at the end of renderTeamReview() below,
  // consumed by the "Copy team summary" button.
  let lastSummaryBundle = null;

  function buildTextSummary() {
    if (!lastSummaryBundle) return "";
    const { teamName, raceName, raceDate, finisherCount, avgDiffText, rows } = lastSummaryBundle;

    const finishers = rows
      .filter((r) => !r.excluded && r.finish_elapsed_seconds != null)
      .sort((a, b) => a.finish_elapsed_seconds - b.finish_elapsed_seconds);
    const nonFinishers = rows.filter((r) => r.excluded);

    const lines = [];
    lines.push(raceName + (raceDate ? " -- " + raceDate : ""));
    if (teamName) lines.push(teamName);
    lines.push("");
    lines.push(finisherCount + " finisher" + (finisherCount === 1 ? "" : "s") + (avgDiffText ? " -- avg " + avgDiffText + " vs. Goal A" : ""));
    lines.push("");

    finishers.forEach((row, index) => {
      const name = participantName(row.participant);
      const time = formatSecondsToClock(row.finish_elapsed_seconds);
      const statusText = row.status ? " (" + STATUS_LABELS[row.status] + ")" : "";
      lines.push((index + 1) + ". " + name + " -- " + time + statusText);
    });

    if (nonFinishers.length > 0) {
      lines.push("");
      nonFinishers.forEach((row) => {
        lines.push(participantName(row.participant) + " -- " + row.participant.status.toUpperCase());
      });
    }

    return lines.join("\n");
  }

  copySummaryButton.addEventListener("click", async () => {
    const text = buildTextSummary();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      copySummaryButton.textContent = "Copied!";
    } catch {
      // Clipboard API can fail (permissions, non-secure context) -- fall
      // back to a visible, selectable block so the coach can still copy
      // it by hand rather than the button silently doing nothing.
      messageBox.textContent = text;
      messageBox.style.whiteSpace = "pre-wrap";
      messageBox.hidden = false;
      copySummaryButton.textContent = "Copied below";
    }
    setTimeout(() => { copySummaryButton.textContent = "Copy team summary"; }, 2000);
  });

  function renderTeamReview(data) {
    teamNameEl.textContent = data.team ? data.team.school_name : "";
    raceNameEl.textContent = data.session ? data.session.name : "";
    rehearsalReviewBanner.hidden = !(data.session && data.session.is_rehearsal);

    const rowsWithStatus = data.rows.map((row) => {
      const excluded = row.participant.status === "dns" || row.participant.status === "dnf";
      let status = null;
      let diff = null;

      if (!excluded && row.finish_elapsed_seconds != null && row.target_a_at_finish != null) {
        diff = RaceMath.computeDiffFromTarget(row.finish_elapsed_seconds, row.target_a_at_finish);
        status = RaceMath.computeGoalStatus({ diffFromTargetSeconds: diff, distanceRemainingMeters: 0 });
      }

      return { ...row, diff, status, excluded };
    });

    // -- team stats: only real finishers with both an actual time and a target count --
    const diffs = rowsWithStatus.filter((r) => r.diff != null).map((r) => r.diff);
    const avgDiff = RaceMath.computeTeamAverageDiff(diffs);
    const finishTimesAsc = rowsWithStatus
      .filter((r) => !r.excluded && r.finish_elapsed_seconds != null)
      .map((r) => r.finish_elapsed_seconds)
      .sort((a, b) => a - b);
    const gapR5 = RaceMath.computeRunnerGap(finishTimesAsc, 5);
    const tierCounts = RaceMath.computeGoalTierCounts(rowsWithStatus.filter((r) => r.status).map((r) => r.status));

    teamStats.innerHTML =
      '<div class="sw-stat"><strong>' + finishTimesAsc.length + '</strong><span>Finishers</span></div>' +
      '<div class="sw-stat"><strong>' + (avgDiff != null ? formatDiff(avgDiff) : "--") + '</strong><span>Average diff vs. Goal A</span></div>' +
      '<div class="sw-stat"><strong>' + (gapR5 != null ? formatSecondsToClock(gapR5) : "--") + '</strong><span>Top-5 spread</span></div>' +
      '<div class="sw-stat"><strong>' + (tierCounts.ahead + tierCounts.on_pace) + '</strong><span>At or ahead of Goal A</span></div>';

    teamRows.innerHTML = rowsWithStatus.map((row) => {
      const tag = row.excluded
        ? '<span class="sw-tag sw-tag-' + escapeHtml(row.participant.status) + '">' + escapeHtml(row.participant.status.toUpperCase()) + '</span>'
        : (row.status ? '<span class="sw-tag sw-tag-' + escapeHtml(row.status) + '">' + escapeHtml(STATUS_LABELS[row.status]) + '</span>' : "--");

      return (
        '<tr data-review-row="' + escapeHtml(row.participant.id) + '">' +
          '<td data-label="Runner">' + escapeHtml(participantName(row.participant)) + '</td>' +
          '<td data-label="Group">' + escapeHtml(row.participant.race_group || "") + '</td>' +
          '<td data-label="Finish">' + escapeHtml(row.finish_elapsed_seconds != null ? formatSecondsToClock(row.finish_elapsed_seconds) : "--") + '</td>' +
          '<td data-label="Goal A">' + escapeHtml(row.goal_a_seconds != null ? formatSecondsToClock(row.goal_a_seconds) : "--") + '</td>' +
          '<td data-label="Diff">' + escapeHtml(row.diff != null ? formatDiff(row.diff) : "--") + '</td>' +
          '<td data-label="Status">' + tag + '</td>' +
        '</tr>'
      );
    }).join("");

    lastSummaryBundle = {
      teamName: data.team ? data.team.school_name : "",
      raceName: data.session ? data.session.name : "Race",
      raceDate: data.session ? data.session.race_date : "",
      finisherCount: finishTimesAsc.length,
      avgDiffText: avgDiff != null ? formatDiff(avgDiff) : null,
      rows: rowsWithStatus
    };
  }

  teamRows.addEventListener("click", async (event) => {
    const row = event.target.closest("[data-review-row]");
    if (!row) return;
    await openIndividual(row.dataset.reviewRow);
  });

  individualClose.addEventListener("click", () => {
    individualPanel.hidden = true;
  });

  // Track build Phase 2: lap mode times to the tenth of a second.
  function formatTenths(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "--";
    const tenths = Math.round(seconds * 10);
    const m = Math.floor(tenths / 600);
    const rest = ((tenths % 600) / 10).toFixed(1);
    return m > 0 ? m + ":" + rest.padStart(4, "0") : rest;
  }

  // Adds (or removes) the Lap column header, so cross country is unchanged.
  function setLapHeader(on) {
    const headRow = individualRows.closest("table")?.querySelector("thead tr");
    if (!headRow) return;
    let th = headRow.querySelector("[data-sw-lap-col]");
    if (on && !th) {
      th = document.createElement("th");
      th.setAttribute("data-sw-lap-col", "");
      th.textContent = "Lap";
      headRow.insertBefore(th, headRow.children[3] || null);
    } else if (!on && th) {
      th.remove();
    }
  }

  // Track build Phase 3: a relay team's legs -- who ran each, the leg
  // split (exchange minus the previous exchange), and the team total.
  // Legs whose exchange wasn't timed show together as one split.
  function renderRelayReview(data) {
    const wrap = document.querySelector("[data-sw-relay-review]");
    if (!wrap) return;
    if (!data.relay) { wrap.hidden = true; return; }
    const rows = wrap.querySelector("[data-sw-relay-review-rows]");
    const total = wrap.querySelector("[data-sw-relay-review-total]");
    const note = wrap.querySelector("[data-sw-relay-review-note]");
    let joined = false;
    rows.innerHTML = data.relay.segments.map((segment) => {
      const legs = data.relay.legs.filter((leg) => leg.leg_order >= segment.first_leg && leg.leg_order <= segment.last_leg);
      if (legs.length > 1) joined = true;
      const legLabel = legs.length > 1 ? segment.first_leg + "-" + segment.last_leg : String(segment.first_leg);
      return (
        '<tr data-relay-leg-row>' +
          '<td data-label="Leg">' + escapeHtml(legLabel) + '</td>' +
          '<td data-label="Runner">' + escapeHtml(segment.names.join(", ")) + '</td>' +
          '<td data-label="Distance">' + escapeHtml((segment.end_meters - segment.start_meters) + " m") + '</td>' +
          '<td data-label="Leg split">' + escapeHtml(segment.seconds != null ? formatTenths(segment.seconds) : "--") + '</td>' +
        '</tr>'
      );
    }).join("");
    total.textContent = "Team total: " + (data.relay.total_seconds != null ? formatTenths(data.relay.total_seconds) : "--");
    note.hidden = !joined;
    note.textContent = joined ? "Legs shown together had no exchange split taken between them." : "";
    wrap.hidden = false;
  }

  async function openIndividual(participantId) {
    try {
      const data = await apiFetch({ action: "get_individual", participant_id: participantId });
      individualName.textContent = participantName(data.participant);
      const lapMode = Boolean(data.lap_mode);
      const fmt = lapMode ? formatTenths : formatSecondsToClock;
      setLapHeader(lapMode);

      individualRows.innerHTML = data.checkpoints.map((row) => {
        const target = row.targets.A;
        const actual = row.split ? row.split.elapsed_seconds : null;
        const diff = (target != null && actual != null) ? RaceMath.computeDiffFromTarget(actual, target) : null;
        const lapCell = lapMode
          ? '<td data-label="Lap">' + escapeHtml(row.lap_seconds != null ? formatTenths(row.lap_seconds) + (row.lap_meters && row.lap_meters !== 400 && row.lap_meters !== 200 ? " (" + row.lap_meters + " m)" : "") : "--") + '</td>'
          : "";

        return (
          '<tr>' +
            '<td data-label="Checkpoint">' + escapeHtml(row.checkpoint.label) + (row.checkpoint.is_finish && !/^Finish/.test(row.checkpoint.label) ? " (Finish)" : "") + '</td>' +
            '<td data-label="Target (Goal A)">' + escapeHtml(target != null ? formatSecondsToClock(target) : "--") + '</td>' +
            '<td data-label="Actual">' + escapeHtml(actual != null ? fmt(actual) : "--") + '</td>' +
            lapCell +
            '<td data-label="Diff">' + escapeHtml(diff != null ? formatDiff(diff) : "--") + '</td>' +
          '</tr>'
        );
      }).join("");

      renderRelayReview(data);

      individualPanel.hidden = false;
      individualPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      messageBox.textContent = error.message || "This runner's review could not be loaded.";
      messageBox.hidden = false;
    }
  }

  // Found during the overnight audit: this page previously did a single
  // fetch on load and never again -- a coach correcting a split (Undo, a
  // manual re-entry) while someone else already had Review open required a
  // manual reload to see it. Polls the same shared utility Guardian Home
  // and the Live page already use. getStatus() always returns "idle"
  // (never race-poll.js's own default of reading session.status) --
  // Review is only ever reached for an already-finished/reviewed race, so
  // the DEFAULT behavior (stop polling once status is "finished"/
  // "reviewed") would stop after the very first fetch and defeat the
  // whole point; a correction can land at any time after the race is
  // over, not just in some narrow "still live" window, so this polls
  // forever at the idle interval instead, same reasoning as Guardian
  // Home's own dashboard-never-really-stops choice.
  let hasLoadedOnce = false;
  let poller = null;

  function startPolling() {
    if (poller) poller.stop();
    poller = window.PodiumRacePoll.watch({
      fetchOnce: () => {
        const deadlineAtMs = firstLoadDeadline;
        firstLoadDeadline = null;
        return apiFetch({ action: "get_team" }, { deadlineAtMs });
      },
      onData: (data) => {
        raceMetaEl.textContent = data.session ? data.session.race_date : "";
        renderTeamReview(data);

        if (!hasLoadedOnce) {
          hasLoadedOnce = true;
          loadingBox.hidden = true;
          root.hidden = false;
          if (data.session) populateRaceSwitcher(data.session.race_date, data.session.name);
        }
      },
      onError: (error) => {
        // Only the FIRST load failing shows a full error screen -- a
        // background poll hiccup after the page already loaded just
        // retries next tick (race-poll.js's own backoff), never yanks
        // away an already-rendered review.
        if (hasLoadedOnce) return;
        // The poller keeps retrying on its own (backoff); Try again restarts
        // it right away. A later success replaces this panel either way.
        Request.showRetry(loadingBox, {
          title: "This review could not be loaded",
          message: error.message || "Please try again.",
          backHref: "/split-watch/?id=" + encodeURIComponent(teamId),
          onRetry: () => {
            loadingBox.innerHTML = "<h2>Loading review...</h2><p>Please wait while Podium Watch loads this race.</p>";
            startPolling();
          }
        });
      },
      getStatus: () => "idle"
    });
  }

  function initialize() {
    if (!teamId || !sessionId) {
      loadingBox.innerHTML = "<h2>Race not found</h2><p>This link is missing a team or race id.</p>";
      return;
    }

    // Don't hard-gate on a Supabase user here -- a race-day access code
    // visitor never has one. Let the actual API call (authorized via
    // bearer token OR the race-day cookie, server-side) decide.
    startPolling();
  }

  initialize();
})();
