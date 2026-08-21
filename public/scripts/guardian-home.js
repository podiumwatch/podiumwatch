// Mirrors public/scripts/athlete-home.js -- the real differences: every
// race card is labeled with which linked athlete it belongs to (a
// guardian can follow more than one), and a spectator_visible race links
// out to the full public leaderboard at /race/?race=<id> instead of
// duplicating that table here.
(() => {
  const loadingBox = document.querySelector("[data-gh-loading]");
  const root = document.querySelector("[data-gh-root]");
  const accountEl = document.querySelector("[data-gh-account]");
  const athletesEl = document.querySelector("[data-gh-athletes]");
  const signOutButton = document.querySelector("[data-gh-signout]");
  const messageBox = document.querySelector("[data-gh-message]");
  const upcomingList = document.querySelector("[data-gh-upcoming-list]");
  const upcomingEmpty = document.querySelector("[data-gh-upcoming-empty]");
  const pastList = document.querySelector("[data-gh-past-list]");
  const pastEmpty = document.querySelector("[data-gh-past-empty]");

  const requiredElements = [
    loadingBox, root, accountEl, athletesEl, signOutButton, messageBox,
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

  // Live-tracking UX audit (docs/LIVE_TRACKING_UX_AUDIT.md): a live race
  // here used to be a frozen snapshot from page load with no indication
  // anything was stale. This is the freshness half of that fix -- "how
  // long ago was THIS specific kid's last recorded split," not just
  // "when did the page last poll," which can look fresh while the
  // runner's own data is minutes old (they're between checkpoints).
  function formatRelativeTime(isoString) {
    if (!isoString) return null;
    const then = Date.parse(isoString);
    if (Number.isNaN(then)) return null;

    const diffSeconds = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (diffSeconds < 45) return "just now";
    if (diffSeconds < 90) return "1 minute ago";

    const minutes = Math.round(diffSeconds / 60);
    if (minutes < 60) return minutes + " minutes ago";

    const hours = Math.round(minutes / 60);
    if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");

    const days = Math.round(hours / 24);
    return days + (days === 1 ? " day ago" : " days ago");
  }

  function mostRecentSplitIso(race) {
    const times = race.checkpoints
      .map((row) => row.split?.wall_clock_captured_at)
      .filter(Boolean)
      .map((t) => Date.parse(t))
      .filter((t) => !Number.isNaN(t));
    if (times.length === 0) return null;
    return new Date(Math.max(...times)).toISOString();
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
      window.location.replace("/guardian-login/");
      throw new Error("Sign in required.");
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
      body: JSON.stringify(payload || {})
    });
    if (response.status === 401) window.location.replace("/guardian-login/");
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

  function watchLiveLink(race) {
    if (!race.session.spectator_visible) return "";
    return '<a class="button button-outline ah-watch-live" href="/race/?race=' + encodeURIComponent(race.session.id) + '">Watch full leaderboard</a>';
  }

  // Only shown once there's a real split to be fresh (or stale) about --
  // a scheduled race with nothing recorded yet has nothing to say here.
  function freshnessLine(race) {
    const iso = mostRecentSplitIso(race);
    if (!iso) return "";
    const isLive = race.session.status === "live";
    return (
      '<p class="ah-freshness' + (isLive ? " ah-freshness-live" : "") + '">' +
        (isLive ? '<span class="ah-live-dot"></span> ' : "") +
        'Last split ' + escapeHtml(formatRelativeTime(iso)) +
      '</p>'
    );
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
        '<span class="ah-athlete-tag">' + escapeHtml(race.participant.display_name) + '</span>' +
        '<h3>' + escapeHtml(race.session.name) + '</h3>' +
        '<div class="ah-race-meta">' + escapeHtml(formatDate(race.session.race_date)) + ' &middot; ' + escapeHtml(STATUS_LABELS[race.session.status] || race.session.status) + '</div>' +
        freshnessLine(race) +
        renderGoalRow(race.goals) +
        (race.checkpoints.length
          ? '<table class="ah-table"><thead><tr><th>Checkpoint</th><th>Target (Goal A)</th><th>Recorded</th></tr></thead><tbody>' + rows + '</tbody></table>'
          : '') +
        watchLiveLink(race) +
      '</div>'
    );
  }

  function renderPastCard(race) {
    const rows = race.checkpoints.map((row) => {
      const target = row.targets.A;
      const actual = row.split ? row.split.elapsed_seconds : null;
      const diff = (target != null && actual != null) ? RaceMath.computeDiffFromTarget(actual, target) : null;
      const isFinish = row.checkpoint.is_finish;
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
        '<span class="ah-athlete-tag">' + escapeHtml(race.participant.display_name) + '</span>' +
        '<h3>' + escapeHtml(race.session.name) + '</h3>' +
        '<div class="ah-race-meta">' + escapeHtml(formatDate(race.session.race_date)) + ' &middot; ' + escapeHtml(STATUS_LABELS[race.session.status] || race.session.status) + '</div>' +
        renderGoalRow(race.goals) +
        (race.checkpoints.length
          ? '<table class="ah-table"><thead><tr><th>Checkpoint</th><th>Target (Goal A)</th><th>Actual</th><th>Diff</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table>'
          : '') +
        watchLiveLink(race) +
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
    window.location.replace("/guardian-login/");
  });

  // Live-tracking UX audit (docs/LIVE_TRACKING_UX_AUDIT.md): this used to
  // be a single fetch on load -- a guardian watching a live race saw a
  // frozen snapshot from the moment the page opened, with nothing to
  // indicate anything was stale, until they manually reloaded.
  // race-poll.js was built with exactly this reuse in mind (see its own
  // header comment) but was never actually wired up here until now.
  // getStatus() reports "live" the instant ANY of the guardian's races is
  // in progress (polls fast), otherwise "idle" (polls slow) -- it never
  // returns a DONE_STATUSES value, since unlike a single race's own page,
  // this dashboard keeps gaining new races over time and should never
  // truly stop polling.
  let hasLoadedRacesOnce = false;

  function startRacePolling() {
    window.PodiumRacePoll.watch({
      fetchOnce: () => apiFetch("/api/guardian/races/", {}),
      onData: (racesData) => {
        renderRaces(racesData.races || []);
        if (!hasLoadedRacesOnce) {
          hasLoadedRacesOnce = true;
          loadingBox.hidden = true;
          root.hidden = false;
        }
      },
      onError: (error) => {
        // Only the FIRST load failing shows a full error screen -- a
        // background poll hiccup after the page already loaded just
        // retries next tick (race-poll.js's own backoff), never yanks
        // away an already-rendered page.
        if (hasLoadedRacesOnce) return;
        loadingBox.innerHTML =
          "<h2>Your athlete's races could not be loaded</h2>" +
          "<p>" + escapeHtml(error.message || "Please try again.") + "</p>" +
          '<p><a class="button button-primary" href="/guardian-login/">Back to sign in</a></p>';
      },
      getStatus: (data) => ((data.races || []).some((r) => r.session.status === "live") ? "live" : "idle")
    });
  }

  async function initialize() {
    try {
      const user = await window.PodiumTeamAuth.getUser();
      if (!user) { window.location.replace("/guardian-login/"); return; }

      accountEl.textContent = user.email || "Guardian account";

      const me = await apiFetch("/api/guardian/me/", {});
      if (!me.athletes || me.athletes.length === 0) {
        loadingBox.innerHTML =
          "<h2>No linked athlete found</h2>" +
          "<p>Your account isn't connected to a roster athlete yet. Ask the coach for a new invite.</p>";
        return;
      }

      athletesEl.textContent = me.athletes
        .map((a) => (a.display_name || (a.first_name + " " + a.last_name)) + " -- " + (a.team ? a.team.school_name : "Unknown team"))
        .join(" · ");

      startRacePolling();
    } catch (error) {
      loadingBox.innerHTML =
        "<h2>Your athlete's races could not be loaded</h2>" +
        "<p>" + escapeHtml(error.message || "Please try again.") + "</p>" +
        '<p><a class="button button-primary" href="/guardian-login/">Back to sign in</a></p>';
    }
  }

  initialize();
})();
