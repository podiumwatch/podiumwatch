(() => {
  const loadingBox = document.querySelector("[data-ah-loading]");
  const root = document.querySelector("[data-ah-root]");
  const accountEl = document.querySelector("[data-ah-account]");
  const teamsEl = document.querySelector("[data-ah-teams]");
  const signOutButton = document.querySelector("[data-ah-signout]");
  const messageBox = document.querySelector("[data-ah-message]");
  const upcomingList = document.querySelector("[data-ah-upcoming-list]");
  const upcomingEmpty = document.querySelector("[data-ah-upcoming-empty]");
  const pastList = document.querySelector("[data-ah-past-list]");
  const pastEmpty = document.querySelector("[data-ah-past-empty]");

  const requiredElements = [
    loadingBox, root, accountEl, teamsEl, signOutButton, messageBox,
    upcomingList, upcomingEmpty, pastList, pastEmpty
  ];
  if (requiredElements.some((el) => !el)) return;

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

  function formatDiff(seconds) {
    if (!Number.isFinite(seconds)) return "--";
    const sign = seconds > 0 ? "+" : (seconds < 0 ? "-" : "");
    return sign + formatSecondsToClock(Math.abs(seconds));
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
  const GOAL_STATUS_LABELS = { ahead: "Ahead of target", on_pace: "On target", at_risk: "Behind target", missed: "Missed target" };

  function parseResponse(response, fallback) {
    return response.json().catch(() => ({})).then((data) => {
      if (!response.ok) throw new Error(data.error || fallback);
      return data;
    });
  }

  async function apiFetch(endpoint, payload) {
    const accessToken = await window.PodiumTeamAuth.getAccessToken();
    if (!accessToken) {
      window.location.replace("/athlete-login/");
      throw new Error("Sign in required.");
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
      body: JSON.stringify(payload || {})
    });
    if (response.status === 401) window.location.replace("/athlete-login/");
    return parseResponse(response, "The request could not be completed.");
  }

  function goalText(goals, slot) {
    const goal = goals.find((g) => g.goal_slot === slot);
    return goal ? formatSecondsToClock(goal.goal_seconds) : null;
  }

  function renderGoalRow(goals) {
    const parts = ["A", "B", "C"]
      .map((slot) => {
        const text = goalText(goals, slot);
        return text ? '<span class="ah-badge">Goal ' + slot + ': ' + escapeHtml(text) + '</span>' : null;
      })
      .filter(Boolean);
    return parts.length ? '<div class="ah-goal-row">' + parts.join("") + '</div>' : "";
  }

  function renderUpcomingCard(race) {
    const rows = race.checkpoints.map((row) => {
      const target = row.targets.A;
      const actual = row.split ? row.split.elapsed_seconds : null;
      return (
        '<tr>' +
          '<td>' + escapeHtml(row.checkpoint.label) + (row.checkpoint.is_finish ? " (Finish)" : "") + '</td>' +
          '<td>' + escapeHtml(target != null ? formatSecondsToClock(target) : "--") + '</td>' +
          '<td>' + escapeHtml(actual != null ? formatSecondsToClock(actual) : "--") + '</td>' +
        '</tr>'
      );
    }).join("");

    return (
      '<div class="ah-race-card">' +
        '<h3>' + escapeHtml(race.session.name) + '</h3>' +
        '<div class="ah-race-meta">' + escapeHtml(formatDate(race.session.race_date)) + ' &middot; ' + escapeHtml(STATUS_LABELS[race.session.status] || race.session.status) + '</div>' +
        renderGoalRow(race.goals) +
        (race.checkpoints.length
          ? '<table class="ah-table"><thead><tr><th>Checkpoint</th><th>Target (Goal A)</th><th>Recorded</th></tr></thead><tbody>' + rows + '</tbody></table>'
          : '') +
      '</div>'
    );
  }

  function renderPastCard(race) {
    const rows = race.checkpoints.map((row) => {
      const target = row.targets.A;
      const actual = row.split ? row.split.elapsed_seconds : null;
      const diff = (target != null && actual != null) ? RaceMath.computeDiffFromTarget(actual, target) : null;
      const isFinish = row.checkpoint.is_finish;
      const distanceRemaining = isFinish ? 0 : 1; // only the finish checkpoint gets a decided status in this simple per-row view
      const status = (diff != null && isFinish)
        ? RaceMath.computeGoalStatus({ diffFromTargetSeconds: diff, distanceRemainingMeters: 0 })
        : null;

      return (
        '<tr>' +
          '<td>' + escapeHtml(row.checkpoint.label) + (isFinish ? " (Finish)" : "") + '</td>' +
          '<td>' + escapeHtml(target != null ? formatSecondsToClock(target) : "--") + '</td>' +
          '<td>' + escapeHtml(actual != null ? formatSecondsToClock(actual) : "--") + '</td>' +
          '<td>' + escapeHtml(diff != null ? formatDiff(diff) : "--") + '</td>' +
          '<td>' + (status ? '<span class="ah-tag ah-tag-' + escapeHtml(status) + '">' + escapeHtml(GOAL_STATUS_LABELS[status]) + '</span>' : "--") + '</td>' +
        '</tr>'
      );
    }).join("");

    return (
      '<div class="ah-race-card">' +
        '<h3>' + escapeHtml(race.session.name) + '</h3>' +
        '<div class="ah-race-meta">' + escapeHtml(formatDate(race.session.race_date)) + ' &middot; ' + escapeHtml(STATUS_LABELS[race.session.status] || race.session.status) + '</div>' +
        renderGoalRow(race.goals) +
        (race.checkpoints.length
          ? '<table class="ah-table"><thead><tr><th>Checkpoint</th><th>Target (Goal A)</th><th>Actual</th><th>Diff</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table>'
          : '') +
      '</div>'
    );
  }

  function renderRaces(races) {
    const upcoming = races.filter((r) => ["draft", "scheduled", "live"].includes(r.session.status));
    const past = races.filter((r) => ["finished", "reviewed"].includes(r.session.status));

    if (upcoming.length === 0) {
      upcomingList.innerHTML = "";
      upcomingEmpty.hidden = false;
    } else {
      upcomingEmpty.hidden = true;
      upcomingList.innerHTML = upcoming.map(renderUpcomingCard).join("");
    }

    if (past.length === 0) {
      pastList.innerHTML = "";
      pastEmpty.hidden = false;
    } else {
      pastEmpty.hidden = true;
      pastList.innerHTML = past.map(renderPastCard).join("");
    }
  }

  signOutButton.addEventListener("click", async () => {
    const client = await window.PodiumTeamAuth.getClient();
    await client.auth.signOut();
    window.location.replace("/athlete-login/");
  });

  async function initialize() {
    try {
      const user = await window.PodiumTeamAuth.getUser();
      if (!user) { window.location.replace("/athlete-login/"); return; }

      accountEl.textContent = user.email || "Athlete account";

      const me = await apiFetch("/api/athlete/me/", {});
      if (!me.athletes || me.athletes.length === 0) {
        loadingBox.innerHTML =
          "<h2>No linked athlete found</h2>" +
          "<p>Your account isn't connected to a roster athlete yet. Ask your coach for a new invite.</p>";
        return;
      }

      teamsEl.textContent = me.athletes
        .map((a) => (a.display_name || (a.first_name + " " + a.last_name)) + " -- " + (a.team ? a.team.school_name : "Unknown team"))
        .join(" · ");

      const racesData = await apiFetch("/api/athlete/races/", {});
      renderRaces(racesData.races || []);

      loadingBox.hidden = true;
      root.hidden = false;
    } catch (error) {
      loadingBox.innerHTML =
        "<h2>Your races could not be loaded</h2>" +
        "<p>" + escapeHtml(error.message || "Please try again.") + "</p>" +
        '<p><a class="button button-primary" href="/athlete-login/">Back to sign in</a></p>';
    }
  }

  initialize();
})();
