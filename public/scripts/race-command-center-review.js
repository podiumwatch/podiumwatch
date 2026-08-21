(() => {
  const loadingBox = document.querySelector("[data-rcc-loading]");
  const root = document.querySelector("[data-rcc-root]");
  const teamNameEl = document.querySelector("[data-rcc-team-name]");
  const raceNameEl = document.querySelector("[data-rcc-race-name]");
  const raceMetaEl = document.querySelector("[data-rcc-race-meta]");
  const messageBox = document.querySelector("[data-rcc-message]");
  const teamStats = document.querySelector("[data-rcc-team-stats]");
  const teamRows = document.querySelector("[data-rcc-team-rows]");
  const individualPanel = document.querySelector("[data-rcc-individual-panel]");
  const individualName = document.querySelector("[data-rcc-individual-name]");
  const individualClose = document.querySelector("[data-rcc-individual-close]");
  const individualRows = document.querySelector("[data-rcc-individual-rows]");
  const allRacesLink = document.querySelector("[data-rcc-all-races-link]");
  const raceSwitcherWrap = document.querySelector("[data-rcc-race-switcher-wrap]");
  const raceSwitcher = document.querySelector("[data-rcc-race-switcher]");
  const copySummaryButton = document.querySelector("[data-rcc-copy-summary]");

  const requiredElements = [
    loadingBox, root, teamNameEl, raceNameEl, raceMetaEl, messageBox,
    teamStats, teamRows, individualPanel, individualName, individualClose, individualRows,
    allRacesLink, raceSwitcherWrap, raceSwitcher, copySummaryButton
  ];
  if (requiredElements.some((el) => !el)) return;

  const params = new URLSearchParams(window.location.search);
  const teamId = String(params.get("id") || "").trim();
  const sessionId = String(params.get("race") || "").trim();

  // The static template can't know the team id -- without this the link
  // falls back to its bare href and lands on the RCC hub with no ?id=,
  // which the hub reports as "Race Command Center not found."
  if (teamId) allRacesLink.href = "/race-command-center/?id=" + encodeURIComponent(teamId);

  const REVIEW_ENDPOINT = "/api/race-command-center/review/";
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

  function parseResponse(response, fallback) {
    return response.json().catch(() => ({})).then((data) => {
      if (!response.ok) throw new Error(data.error || fallback);
      return data;
    });
  }

  async function apiFetch(payload) {
    // Don't gate on a Supabase access token here -- a race-day access code
    // visitor has no Supabase session at all, but does have an HttpOnly
    // cookie the server will accept. Send the bearer token when we have one
    // (a real coach account) and let the browser send the cookie either way;
    // only redirect if the server actually says the request isn't allowed.
    const accessToken = await window.PodiumTeamAuth.getAccessToken();
    const headers = { Accept: "application/json", "Content-Type": "application/json" };
    if (accessToken) headers.Authorization = "Bearer " + accessToken;
    const response = await fetch(REVIEW_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({ team_id: teamId, session_id: sessionId, ...payload })
    });
    if (response.status === 401) window.location.replace("/race-command-center/join/");
    return parseResponse(response, "The review request could not be completed.");
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
      const accessToken = await window.PodiumTeamAuth.getAccessToken();
      const headers = { Accept: "application/json", "Content-Type": "application/json" };
      if (accessToken) headers.Authorization = "Bearer " + accessToken;
      const response = await fetch("/api/race-command-center/sessions/", {
        method: "POST",
        headers,
        body: JSON.stringify({ team_id: teamId, action: "list" })
      });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));

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
      window.location.href = "/race-command-center/live/" + idPart;
    } else if (target.status === "finished" || target.status === "reviewed") {
      window.location.href = "/race-command-center/review/" + idPart;
    } else {
      window.location.href = "/race-command-center/plan/" + idPart;
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
      '<div class="rcc-stat"><strong>' + finishTimesAsc.length + '</strong><span>Finishers</span></div>' +
      '<div class="rcc-stat"><strong>' + (avgDiff != null ? formatDiff(avgDiff) : "--") + '</strong><span>Average diff vs. Goal A</span></div>' +
      '<div class="rcc-stat"><strong>' + (gapR5 != null ? formatSecondsToClock(gapR5) : "--") + '</strong><span>Top-5 spread</span></div>' +
      '<div class="rcc-stat"><strong>' + (tierCounts.ahead + tierCounts.on_pace) + '</strong><span>At or ahead of Goal A</span></div>';

    teamRows.innerHTML = rowsWithStatus.map((row) => {
      const tag = row.excluded
        ? '<span class="rcc-tag rcc-tag-' + escapeHtml(row.participant.status) + '">' + escapeHtml(row.participant.status.toUpperCase()) + '</span>'
        : (row.status ? '<span class="rcc-tag rcc-tag-' + escapeHtml(row.status) + '">' + escapeHtml(STATUS_LABELS[row.status]) + '</span>' : "--");

      return (
        '<tr data-review-row="' + escapeHtml(row.participant.id) + '">' +
          '<td>' + escapeHtml(participantName(row.participant)) + '</td>' +
          '<td>' + escapeHtml(row.participant.race_group || "") + '</td>' +
          '<td>' + escapeHtml(row.finish_elapsed_seconds != null ? formatSecondsToClock(row.finish_elapsed_seconds) : "--") + '</td>' +
          '<td>' + escapeHtml(row.goal_a_seconds != null ? formatSecondsToClock(row.goal_a_seconds) : "--") + '</td>' +
          '<td>' + escapeHtml(row.diff != null ? formatDiff(row.diff) : "--") + '</td>' +
          '<td>' + tag + '</td>' +
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

  async function openIndividual(participantId) {
    try {
      const data = await apiFetch({ action: "get_individual", participant_id: participantId });
      individualName.textContent = participantName(data.participant);

      individualRows.innerHTML = data.checkpoints.map((row) => {
        const target = row.targets.A;
        const actual = row.split ? row.split.elapsed_seconds : null;
        const diff = (target != null && actual != null) ? RaceMath.computeDiffFromTarget(actual, target) : null;

        return (
          '<tr>' +
            '<td>' + escapeHtml(row.checkpoint.label) + (row.checkpoint.is_finish ? " (Finish)" : "") + '</td>' +
            '<td>' + escapeHtml(target != null ? formatSecondsToClock(target) : "--") + '</td>' +
            '<td>' + escapeHtml(actual != null ? formatSecondsToClock(actual) : "--") + '</td>' +
            '<td>' + escapeHtml(diff != null ? formatDiff(diff) : "--") + '</td>' +
          '</tr>'
        );
      }).join("");

      individualPanel.hidden = false;
      individualPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      messageBox.textContent = error.message || "This runner's review could not be loaded.";
      messageBox.hidden = false;
    }
  }

  async function initialize() {
    if (!teamId || !sessionId) {
      loadingBox.innerHTML = "<h2>Race not found</h2><p>This link is missing a team or race id.</p>";
      return;
    }

    try {
      // Don't hard-gate on a Supabase user here -- a race-day access code
      // visitor never has one. Let the actual API call (authorized via
      // bearer token OR the race-day cookie, server-side) decide.
      const data = await apiFetch({ action: "get_team" });
      raceMetaEl.textContent = data.session ? data.session.race_date : "";
      renderTeamReview(data);

      loadingBox.hidden = true;
      root.hidden = false;
      if (data.session) populateRaceSwitcher(data.session.race_date, data.session.name);
    } catch (error) {
      loadingBox.innerHTML =
        "<h2>This review could not be loaded</h2><p>" + escapeHtml(error.message || "Please try again.") + "</p>" +
        '<p><a class="button button-primary" href="/race-command-center/?id=' + encodeURIComponent(teamId) + '">Back to Race Command Center</a></p>';
    }
  }

  initialize();
})();
