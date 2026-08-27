(() => {
  const loadingBox = document.querySelector("[data-race-public-loading]");
  const messageBox = document.querySelector("[data-race-public-message]");
  const root = document.querySelector("[data-race-public-root]");
  const teamEl = document.querySelector("[data-race-public-team]");
  const nameEl = document.querySelector("[data-race-public-name]");
  const statusEl = document.querySelector("[data-race-public-status]");
  const updatedEl = document.querySelector("[data-race-public-updated]");
  const rowsEl = document.querySelector("[data-race-public-rows]");
  const searchInput = document.querySelector("[data-race-public-search]");
  const focusedWrap = document.querySelector("[data-race-public-focused]");
  const focusedNameEl = document.querySelector("[data-race-public-focused-name]");
  const focusedMetaEl = document.querySelector("[data-race-public-focused-meta]");
  const focusedRowsEl = document.querySelector("[data-race-public-focused-rows]");
  const waitingBox = document.querySelector("[data-race-public-waiting]");
  const waitingTimeEl = document.querySelector("[data-race-public-waiting-time]");
  const liveShell = document.querySelector("[data-race-public-live-shell]");
  const switcherEl = document.querySelector("[data-race-public-switcher]");

  const requiredElements = [
    loadingBox, messageBox, root, teamEl, nameEl, statusEl, updatedEl, rowsEl,
    searchInput, focusedWrap, focusedNameEl, focusedMetaEl, focusedRowsEl,
    waitingBox, waitingTimeEl, liveShell, switcherEl
  ];
  if (requiredElements.some((el) => !el)) return;

  const params = new URLSearchParams(window.location.search);
  let currentSessionId = String(params.get("race") || "").trim();
  const teamId = String(params.get("team") || "").trim();

  const ENDPOINT = "/api/race/public/";
  const DONE_STATUSES = new Set(["finished", "reviewed", "cancelled"]);

  const STATUS_LABELS = {
    draft: "Not started",
    scheduled: "Not started",
    live: "Live",
    finished: "Finished",
    reviewed: "Finished",
    cancelled: "Cancelled"
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function formatClock(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(seconds < 600 ? 1 : 0);
    return m + ":" + String(s).padStart(seconds < 600 ? 4 : 2, "0");
  }

  // Live-tracking UX audit (docs/LIVE_TRACKING_UX_AUDIT.md): this page
  // used to show one global "Updated 3:42:07 PM" line -- that's when the
  // PAGE last polled, not when any given runner's OWN split was actually
  // captured. A runner sitting between checkpoints for 8 minutes looked
  // exactly as "live" as one who just crossed, the moment the page had
  // recently refreshed. This is the fix: every runner's own time now
  // carries its own relative freshness.
  function formatRelativeTime(isoString) {
    if (!isoString) return null;
    const then = Date.parse(isoString);
    if (Number.isNaN(then)) return null;

    const diffSeconds = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (diffSeconds < 45) return "just now";
    if (diffSeconds < 90) return "1 min ago";

    const minutes = Math.round(diffSeconds / 60);
    if (minutes < 60) return minutes + " min ago";

    const hours = Math.round(minutes / 60);
    return hours + (hours === 1 ? " hr ago" : " hrs ago");
  }

  function showMessage(text) {
    loadingBox.hidden = true;
    root.hidden = true;
    messageBox.hidden = !text;
    messageBox.innerHTML = text
      ? '<div class="info-card"><h2>Can\'t watch this race</h2><p>' + escapeHtml(text) + '</p></div>'
      : "";
  }

  function bestRowFor(participant) {
    const withTimes = participant.splits.filter((s) => s.elapsed_seconds != null && !s.is_dns && !s.is_dnf);
    if (withTimes.length === 0) return null;
    return withTimes.reduce((latest, split) => {
      const checkpoint = checkpointsById.get(split.race_checkpoint_id);
      const latestCheckpoint = latest ? checkpointsById.get(latest.race_checkpoint_id) : null;
      if (!latest || (checkpoint && latestCheckpoint && checkpoint.sort_order > latestCheckpoint.sort_order)) {
        return split;
      }
      return latest;
    }, null);
  }

  let checkpointsById = new Map();

  function sortKey(participant) {
    if (participant.status === "dns") return [3, 0];
    if (participant.status === "dnf") return [2, 0];
    const best = bestRowFor(participant);
    if (!best) return [1, 0];
    const checkpoint = checkpointsById.get(best.race_checkpoint_id);
    const isFinish = checkpoint?.is_finish ? 0 : 1;
    // Finishers first (sorted by finish time), then in-progress runners
    // by furthest checkpoint reached (sorted by their time at it).
    return [isFinish, -(checkpoint?.sort_order || 0), best.elapsed_seconds];
  }

  function compareParticipants(a, b) {
    const ka = sortKey(a);
    const kb = sortKey(b);
    for (let i = 0; i < ka.length; i += 1) {
      if (ka[i] !== kb[i]) return ka[i] - kb[i];
    }
    return 0;
  }

  function renderRow(participant, rank) {
    const best = bestRowFor(participant);
    const checkpointLabel = best ? checkpointsById.get(best.race_checkpoint_id)?.label || "--" : "--";
    const time = best ? formatClock(best.elapsed_seconds) : "--";
    const freshness = best ? formatRelativeTime(best.wall_clock_captured_at) : null;
    const tag = participant.status === "dns" ? "DNS" : (participant.status === "dnf" ? "DNF" : "");

    return (
      '<tr>' +
        '<td class="race-public-rank">' + (tag ? "--" : rank) + '</td>' +
        '<td>' + escapeHtml(participant.display_name) + '</td>' +
        '<td>' + escapeHtml(participant.race_group || "") + '</td>' +
        '<td>' + escapeHtml(checkpointLabel) + '</td>' +
        '<td>' + escapeHtml(time) +
          (freshness ? '<span class="race-public-fresh">' + escapeHtml(freshness) + '</span>' : '') +
        '</td>' +
        '<td>' + (tag ? '<span class="race-public-tag">' + tag + '</span>' : '') + '</td>' +
      '</tr>'
    );
  }

  // "Find my runner" -- a single-runner focused view, not just a row
  // buried in the full team table. Every checkpoint this runner has (or
  // hasn't yet) reached, each with its own freshness, not just their
  // single latest split.
  function renderFocusedRunner(participant) {
    const sortedCheckpoints = [...checkpointsById.values()].sort((a, b) => a.sort_order - b.sort_order);
    const splitsByCheckpointId = new Map(participant.splits.map((s) => [s.race_checkpoint_id, s]));

    focusedNameEl.textContent = participant.display_name;
    focusedMetaEl.textContent = (participant.race_group ? participant.race_group + " -- " : "") +
      (participant.status === "dns" ? "Did not start" : (participant.status === "dnf" ? "Did not finish" : "In progress"));

    focusedRowsEl.innerHTML = sortedCheckpoints.map((checkpoint) => {
      const split = splitsByCheckpointId.get(checkpoint.id);
      const hasTime = split && split.elapsed_seconds != null && !split.is_dns && !split.is_dnf;
      const time = hasTime ? formatClock(split.elapsed_seconds) : "--";
      const freshness = hasTime ? formatRelativeTime(split.wall_clock_captured_at) : null;

      return (
        '<tr>' +
          '<td>' + escapeHtml(checkpoint.label) + (checkpoint.is_finish ? " (Finish)" : "") + '</td>' +
          '<td>' + escapeHtml(time) +
            (freshness ? '<span class="race-public-fresh">' + escapeHtml(freshness) + '</span>' : '') +
          '</td>' +
        '</tr>'
      );
    }).join("");

    focusedWrap.hidden = false;
  }

  let lastParticipants = [];

  function applyFilter() {
    const query = searchInput.value.trim().toLowerCase();

    if (!query) {
      focusedWrap.hidden = true;
      renderTable(lastParticipants);
      return;
    }

    const matches = lastParticipants.filter((p) => p.display_name.toLowerCase().includes(query));

    if (matches.length === 1) {
      renderFocusedRunner(matches[0]);
    } else {
      focusedWrap.hidden = true;
    }

    renderTable(matches);
  }

  searchInput.addEventListener("input", applyFilter);

  function renderTable(participants) {
    const sorted = [...participants].sort(compareParticipants);
    let rank = 0;
    const emptyMessage = searchInput.value.trim() ? "No runners match your search." : "No runners entered yet.";
    rowsEl.innerHTML = sorted.map((participant) => {
      const best = bestRowFor(participant);
      if (best && participant.status !== "dns" && participant.status !== "dnf") rank += 1;
      return renderRow(participant, rank);
    }).join("") || '<tr><td colspan="6">' + emptyMessage + '</td></tr>';
  }

  // Race day feedback (2026-08-25), Problem 1: this link has to work
  // hours before the race starts, on the SAME url, with no second link
  // and ideally no manual refresh. The status pill already changed; the
  // page's actual content used to stay an empty runner table the whole
  // time, which reads as broken, not "not started yet." A parent gets a
  // clear waiting screen instead, and the poller (public/scripts/race-poll.js,
  // already running underneath this) is what makes it flip to live the
  // moment the coach actually starts the race -- no new URL, no refresh.
  function renderWaiting(data) {
    waitingBox.hidden = false;
    liveShell.hidden = true;
    // race_date is a plain YYYY-MM-DD date; scheduled_start_time (if the
    // coach set one) is a separate plain time-of-day column
    // (install/11_RACE_COMMAND_CENTER.sql) -- combined here into one
    // real Date only for display, matching how the two columns actually
    // relate to each other.
    const raceDate = data.session.race_date;
    const timeOfDay = data.session.scheduled_start_time;
    const scheduled = raceDate ? new Date(raceDate + "T" + (timeOfDay || "00:00:00")) : null;
    if (scheduled && !Number.isNaN(scheduled.getTime())) {
      const dateText = scheduled.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      waitingTimeEl.textContent = timeOfDay
        ? "Scheduled for " + dateText + " at " + scheduled.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        : "Scheduled for " + dateText;
    } else {
      waitingTimeEl.textContent = "";
    }
  }

  // One team-day link (2026-08-27 feature request): data.races is every
  // spectator-visible race the team has for the same day as data.session
  // -- rendered as a row of tappable chips above the single-race view.
  // Switching never navigates -- it just changes which race the NEXT
  // poll tick asks for (see fetchOnce below) and re-renders immediately
  // from the response, exactly like a fresh poll tick would. The URL is
  // kept in sync via replaceState so a refresh (or a copy-paste of the
  // address bar) lands back on whichever race is currently selected.
  function switcherLabel(race) {
    if (race.status === "live") return "Live";
    if (race.status === "finished" || race.status === "reviewed") return "Final";
    return "Not started";
  }

  function renderSwitcher(data) {
    if (!data.races || data.races.length < 2) {
      switcherEl.hidden = true;
      switcherEl.innerHTML = "";
      return;
    }
    switcherEl.hidden = false;
    switcherEl.innerHTML = data.races.map((race) => (
      '<button type="button" class="race-public-switcher-chip' +
        (race.id === data.selected_session_id ? ' race-public-switcher-chip-selected' : '') +
        (race.status === "live" ? ' race-public-switcher-chip-live' : '') + '" data-race-id="' + escapeHtml(race.id) + '">' +
        escapeHtml(race.name) +
        '<span class="race-public-switcher-status">' + escapeHtml(switcherLabel(race)) + '</span>' +
      '</button>'
    )).join("");

    switcherEl.querySelectorAll("[data-race-id]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const raceId = chip.getAttribute("data-race-id");
        if (raceId === currentSessionId) return;
        currentSessionId = raceId;
        searchInput.value = "";
        loadingBox.hidden = false;
        root.hidden = true;
        messageBox.hidden = true;
        fetchOnce().then(render).catch((error) => showMessage(error.message || "This race could not be loaded."));
      });
    });
  }

  function render(data) {
    checkpointsById = new Map((data.checkpoints || []).map((c) => [c.id, c]));
    lastParticipants = data.participants || [];
    currentSessionId = data.selected_session_id || currentSessionId;

    const url = new URL(window.location.href);
    if (teamId) url.searchParams.set("team", teamId);
    url.searchParams.set("race", currentSessionId);
    window.history.replaceState(null, "", url.pathname + url.search);

    renderSwitcher(data);

    teamEl.textContent = data.team ? data.team.school_name : "Podium Watch";
    nameEl.textContent = data.session.name;
    statusEl.textContent = STATUS_LABELS[data.session.status] || data.session.status;
    statusEl.className = "race-public-status race-public-status-" + data.session.status;
    updatedEl.textContent = "Updated " + new Date().toLocaleTimeString();

    if (data.session.status === "draft" || data.session.status === "scheduled") {
      renderWaiting(data);
    } else {
      waitingBox.hidden = true;
      liveShell.hidden = false;
      // Re-applies the search box's current term (if any) against the
      // freshly polled data, rather than resetting it on every poll tick --
      // a parent mid-search shouldn't have their filter wiped out from
      // under them every 10 seconds.
      applyFilter();
    }

    loadingBox.hidden = true;
    messageBox.hidden = true;
    root.hidden = false;
  }

  if (!currentSessionId && !teamId) {
    showMessage("This link is missing a race or team ID.");
    return;
  }

  function fetchOnce() {
    return fetch(ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: currentSessionId || undefined, team_id: teamId || undefined })
    }).then((response) =>
      response.json().catch(() => ({})).then((data) => {
        if (!response.ok) throw new Error(data.error || "This race could not be loaded.");
        return data;
      })
    );
  }

  // "live" if ANY race sharing this day is currently live (poll fast),
  // a DONE_STATUSES value only once EVERY race that day is done (stop
  // entirely), otherwise idle -- a parent watching one finished race
  // must keep polling if a sibling race that day is still upcoming or
  // live, never stop just because the ONE race currently on screen is over.
  function groupStatus(data) {
    const races = data?.races || [];
    if (races.some((r) => r.status === "live")) return "live";
    if (races.length > 0 && races.every((r) => DONE_STATUSES.has(r.status))) return "finished";
    return "idle";
  }

  window.PodiumRacePoll.watch({
    fetchOnce,
    onData: render,
    getStatus: groupStatus,
    onError: (error) => showMessage(error.message || "This race could not be loaded.")
  });
})();
