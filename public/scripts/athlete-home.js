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
  const goalsSection = document.querySelector("[data-ah-goals-section]");
  const goalsAthletesContainer = document.querySelector("[data-ah-goals-athletes]");

  const requiredElements = [
    loadingBox, root, accountEl, teamsEl, signOutButton, messageBox,
    upcomingList, upcomingEmpty, pastList, pastEmpty,
    goalsSection, goalsAthletesContainer
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

  // messageBox/.ah-message already existed (declared, styled) but this
  // page had nothing to save before Phase 3, so nothing ever used them.
  function showMessage(text, isError = false) {
    messageBox.textContent = text;
    messageBox.hidden = !text;
    messageBox.style.background = isError ? "rgba(220, 38, 38, 0.12)" : "rgba(0, 191, 99, 0.1)";
  }

  // Same 7 distances as the coach-facing goal book on the Team Roster
  // page (lib/athlete_goal_service.mjs's DISTANCE_BUCKETS) -- duplicated
  // here rather than shared, matching how small constants/helpers are
  // already handled independently per client script in this codebase.
  const GOAL_BUCKETS = [
    { key: "800m", label: "800m" },
    { key: "1600m", label: "Mile / 1600m" },
    { key: "3000m", label: "3K" },
    { key: "3200m", label: "2 Mile / 3200m" },
    { key: "4000m", label: "4K" },
    { key: "5000m", label: "5K" },
    { key: "8000m", label: "8K" }
  ];

  function parseClockToSeconds(text) {
    const cleaned = String(text ?? "").trim();
    if (!cleaned) return null;

    const parts = cleaned.split(":").map((p) => p.trim());
    if (parts.some((p) => p === "" || Number.isNaN(Number(p)))) return null;

    let seconds;
    if (parts.length === 3) {
      seconds = Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
    } else if (parts.length === 2) {
      seconds = Number(parts[0]) * 60 + Number(parts[1]);
    } else if (parts.length === 1) {
      seconds = Number(parts[0]);
    } else {
      return null;
    }

    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  }

  // Most athletes are linked to exactly one team_athletes row -- the
  // heading is only shown when there's more than one (a real but rare
  // case, e.g. a transfer -- see lib/athlete_auth.mjs's
  // loadActiveAthleteLinks() header comment), so the common case reads
  // as one simple goal list, not "goals for Casey Smith" repeated once.
  function renderGoalsSection(athletes) {
    if (!athletes || athletes.length === 0) {
      goalsSection.hidden = true;
      return;
    }

    goalsSection.hidden = false;
    goalsAthletesContainer.innerHTML = athletes.map((athlete) => {
      const name = athlete.display_name || (athlete.first_name + " " + athlete.last_name);
      const teamName = athlete.team ? athlete.team.school_name : "";
      const heading = athletes.length > 1
        ? '<h3>' + escapeHtml(name) + (teamName ? " -- " + escapeHtml(teamName) : "") + '</h3>'
        : "";

      return (
        '<div class="ah-goals-athlete" data-goals-athlete-id="' + escapeHtml(athlete.id) + '">' +
          heading +
          '<div class="ah-goals-fields">' +
            GOAL_BUCKETS.map((bucket) => (
              '<label>' + escapeHtml(bucket.label) +
                '<input type="text" placeholder="19:30" data-goal-bucket="' + bucket.key + '"></label>'
            )).join("") +
          '</div>' +
          '<button class="button button-primary" type="button" data-save-goals style="margin-top:12px;">Save my goals</button>' +
        '</div>'
      );
    }).join("");

    athletes.forEach((athlete) => loadGoalsForAthlete(athlete.id));
  }

  async function loadGoalsForAthlete(teamAthleteId) {
    const block = goalsAthletesContainer.querySelector('[data-goals-athlete-id="' + CSS.escape(teamAthleteId) + '"]');
    if (!block) return;

    try {
      const data = await apiFetch("/api/athlete/goals/", { action: "get_standard_goals", team_athlete_id: teamAthleteId });
      for (const goal of data.goals || []) {
        const input = block.querySelector('[data-goal-bucket="' + CSS.escape(goal.distance_bucket) + '"]');
        if (input) input.value = formatSecondsToClock(goal.goal_seconds);
      }
    } catch {
      // Leaves the fields blank -- the athlete can still fill in and save
      // fresh values over nothing.
    }
  }

  goalsAthletesContainer.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-save-goals]");
    if (!button) return;

    const block = button.closest("[data-goals-athlete-id]");
    const teamAthleteId = block.dataset.goalsAthleteId;

    const goalsByBucket = {};
    let hasInvalidEntry = false;

    block.querySelectorAll("[data-goal-bucket]").forEach((input) => {
      const raw = input.value.trim();
      if (!raw) {
        goalsByBucket[input.dataset.goalBucket] = null;
        return;
      }
      const seconds = parseClockToSeconds(raw);
      if (seconds === null) {
        hasInvalidEntry = true;
      } else {
        goalsByBucket[input.dataset.goalBucket] = seconds;
      }
    });

    if (hasInvalidEntry) {
      showMessage("Enter goal times as m:ss (e.g. 19:30), or leave a distance blank to clear it.", true);
      return;
    }

    try {
      const data = await apiFetch("/api/athlete/goals/", {
        action: "save_standard_goals",
        team_athlete_id: teamAthleteId,
        goals_by_bucket: goalsByBucket
      });
      for (const goal of data.goals || []) {
        const input = block.querySelector('[data-goal-bucket="' + CSS.escape(goal.distance_bucket) + '"]');
        if (input) input.value = formatSecondsToClock(goal.goal_seconds);
      }
      showMessage("Goals saved.");
    } catch (error) {
      showMessage(error.message || "Goals could not be saved.", true);
    }
  });

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

      renderGoalsSection(me.athletes);

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
