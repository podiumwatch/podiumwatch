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

  const requiredElements = [
    loadingBox, root, teamNameEl, raceNameEl, raceMetaEl, messageBox,
    teamStats, teamRows, individualPanel, individualName, individualClose, individualRows
  ];
  if (requiredElements.some((el) => !el)) return;

  const params = new URLSearchParams(window.location.search);
  const teamId = String(params.get("id") || "").trim();
  const sessionId = String(params.get("race") || "").trim();

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
    const accessToken = await window.PodiumTeamAuth.getAccessToken();
    if (!accessToken) {
      window.location.replace("/team-login/");
      throw new Error("Team account sign in required.");
    }
    const response = await fetch(REVIEW_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
      body: JSON.stringify({ team_id: teamId, session_id: sessionId, ...payload })
    });
    if (response.status === 401) window.location.replace("/team-login/");
    return parseResponse(response, "The review request could not be completed.");
  }

  function participantName(participant) {
    return participant.manual_name || participant.display_name || "Runner";
  }

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
      const user = await window.PodiumTeamAuth.getUser();
      if (!user) { window.location.replace("/team-login/"); return; }

      const data = await apiFetch({ action: "get_team" });
      raceMetaEl.textContent = data.session ? data.session.race_date : "";
      renderTeamReview(data);

      loadingBox.hidden = true;
      root.hidden = false;
    } catch (error) {
      loadingBox.innerHTML =
        "<h2>This review could not be loaded</h2><p>" + escapeHtml(error.message || "Please try again.") + "</p>" +
        '<p><a class="button button-primary" href="/race-command-center/?id=' + encodeURIComponent(teamId) + '">Back to Race Command Center</a></p>';
    }
  }

  initialize();
})();
