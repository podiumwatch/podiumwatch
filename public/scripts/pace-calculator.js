(() => {
  const root = document.querySelector("[data-pace-calculator]");
  const splits = window.PodiumPaceSplits;
  if (!root || !splits) return;

  const trackChipContainer = root.querySelector('[data-pace-event-group="track"]');
  const xcChipContainer = root.querySelector('[data-pace-event-group="xc"]');
  const minutesInput = root.querySelector("[data-pace-minutes]");
  const secondsInput = root.querySelector("[data-pace-seconds]");
  const quickPicksEl = root.querySelector("[data-pace-quick-picks]");
  const summaryEl = root.querySelector("[data-pace-summary]");
  const resultsEl = root.querySelector("[data-pace-results]");

  if (!trackChipContainer || !xcChipContainer || !minutesInput || !secondsInput || !quickPicksEl || !summaryEl || !resultsEl) {
    return;
  }

  // Same event set and quick-pick times as the manually-verified React
  // prototype this page's UX and split math were built from.
  const EVENTS = [
    { id: "800", label: "800m", group: "track", distanceMeters: 800, quicks: [120, 135, 150, 165, 180] },
    { id: "1600", label: "1600m (mile)", group: "track", distanceMeters: 1600, quicks: [280, 300, 320, 340, 360] },
    { id: "3200", label: "3200m (2 mile)", group: "track", distanceMeters: 3200, quicks: [600, 630, 660, 690, 720] },
    { id: "5k", label: "5K", group: "xc", distanceMeters: 5000, quicks: [960, 1020, 1080, 1140, 1200] },
    { id: "3mile", label: "3 mile", group: "xc", distanceMeters: 3 * splits.MILE_METERS, quicks: [1020, 1080, 1140, 1200, 1260] },
    { id: "10k", label: "10K", group: "xc", distanceMeters: 10000, quicks: [2040, 2160, 2280, 2400] }
  ];

  let selectedEventId = "5k";
  let goalMinutes = 17;
  let goalSeconds = 0;

  function currentEvent() {
    return EVENTS.find((event) => event.id === selectedEventId) || EVENTS[0];
  }

  function totalGoalSeconds() {
    return (Number(goalMinutes) || 0) * 60 + (Number(goalSeconds) || 0);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderEventChips() {
    const renderGroup = (container, group) => {
      container.innerHTML = EVENTS.filter((event) => event.group === group).map((event) => `
        <button type="button" class="pace-event-chip" data-pace-event-id="${event.id}" aria-pressed="${event.id === selectedEventId}">${escapeHtml(event.label)}</button>
      `).join("");
    };

    renderGroup(trackChipContainer, "track");
    renderGroup(xcChipContainer, "xc");
  }

  function renderQuickPicks() {
    const event = currentEvent();
    quickPicksEl.innerHTML = event.quicks.map((seconds) => `
      <button type="button" data-pace-quick="${seconds}">${escapeHtml(splits.formatWholeTime(seconds))}</button>
    `).join("");
  }

  function kmLabel(row) {
    return row.isPartial
      ? (row.distanceMeters / 1000).toFixed(2) + "K"
      : (row.index + 1) + "K";
  }

  function mileLabel(row) {
    if (row.isPartial) {
      const partialMiles = (row.distanceMeters - row.index * splits.MILE_METERS) / splits.MILE_METERS;
      return "+" + partialMiles.toFixed(1) + "mi";
    }

    return "Mile " + (row.index + 1);
  }

  function lapLabel(row) {
    return "Lap " + (row.index + 1);
  }

  function tableBlockHtml(title, rows, labelFn) {
    const rowsHtml = rows.map((row) => `
      <tr>
        <td>${escapeHtml(labelFn(row))}</td>
        <td>${escapeHtml(splits.formatSplitTime(row.cumulativeSeconds))}</td>
        <td>${escapeHtml(splits.formatSplitTime(row.splitSeconds))}</td>
      </tr>
    `).join("");

    return `
      <div class="pace-table-block">
        <h3>${escapeHtml(title)}</h3>
        <table class="pace-table">
          <thead><tr><th>Mark</th><th>Total</th><th>Split</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  function render() {
    const event = currentEvent();
    const goal = totalGoalSeconds();

    if (goal <= 0) {
      summaryEl.innerHTML = "";
      resultsEl.innerHTML = `<p>Enter a goal time to see your splits.</p>`;
      return;
    }

    const paceMile = splits.paceForUnit(goal, event.distanceMeters, splits.MILE_METERS);
    const paceKm = splits.paceForUnit(goal, event.distanceMeters, 1000);

    summaryEl.innerHTML = `
      <div class="pace-summary">
        <div class="pace-summary-time">${escapeHtml(splits.formatSplitTime(goal))}</div>
        <div class="pace-summary-event">${escapeHtml(event.label)} goal</div>
        <div class="pace-summary-paces">
          <div><strong>${escapeHtml(splits.formatSplitTime(paceMile))}</strong><span>Per mile</span></div>
          <div><strong>${escapeHtml(splits.formatSplitTime(paceKm))}</strong><span>Per km</span></div>
        </div>
      </div>
    `;

    if (event.group === "track") {
      const laps = splits.buildCheckpoints({ distanceMeters: event.distanceMeters, goalSeconds: goal, stepMeters: 400 });
      resultsEl.innerHTML = `<div class="pace-tables-wrap">${tableBlockHtml(`Lap splits (${laps.length} x 400m)`, laps, lapLabel)}</div>`;
      return;
    }

    const kmRows = splits.buildCheckpoints({ distanceMeters: event.distanceMeters, goalSeconds: goal, stepMeters: 1000 });
    const mileRows = splits.buildCheckpoints({ distanceMeters: event.distanceMeters, goalSeconds: goal, stepMeters: splits.MILE_METERS });

    resultsEl.innerHTML = `
      <div class="pace-tables-wrap pace-tables-wrap-xc">
        ${tableBlockHtml("Kilometer splits", kmRows, kmLabel)}
        ${tableBlockHtml("Mile splits", mileRows, mileLabel)}
      </div>
    `;
  }

  trackChipContainer.addEventListener("click", (event) => {
    const button = event.target.closest("[data-pace-event-id]");
    if (!button) return;
    selectedEventId = button.dataset.paceEventId;
    renderEventChips();
    renderQuickPicks();
    render();
  });

  xcChipContainer.addEventListener("click", (event) => {
    const button = event.target.closest("[data-pace-event-id]");
    if (!button) return;
    selectedEventId = button.dataset.paceEventId;
    renderEventChips();
    renderQuickPicks();
    render();
  });

  quickPicksEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-pace-quick]");
    if (!button) return;
    const seconds = Number(button.dataset.paceQuick);
    goalMinutes = Math.floor(seconds / 60);
    goalSeconds = seconds % 60;
    minutesInput.value = goalMinutes;
    secondsInput.value = goalSeconds;
    render();
  });

  minutesInput.addEventListener("input", () => {
    goalMinutes = minutesInput.value;
    render();
  });

  secondsInput.addEventListener("input", () => {
    goalSeconds = secondsInput.value;
    render();
  });

  // Loads pre-filled with a default of 17:00 for the 5K.
  minutesInput.value = goalMinutes;
  secondsInput.value = String(goalSeconds).padStart(2, "0");
  renderEventChips();
  renderQuickPicks();
  render();

  // Best-effort first-party usage tracking, feeding the same
  // team_analytics_events table and admin Engagement Center dashboard
  // public/scripts/engagement.js already uses for team pages -- reuses
  // its exact localStorage/sessionStorage visitor/session id keys so a
  // visitor is counted consistently whether they're on a team page or
  // this tool, but is otherwise self-contained rather than importing
  // engagement.js itself, since that script's own activation and its
  // /api/engagement/public call are both gated on team-page-specific
  // page state that doesn't apply here.
  (function trackPaceCalculatorUse() {
    try {
      let visitorId = localStorage.getItem("podium_visitor_id");
      if (!visitorId) {
        visitorId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        localStorage.setItem("podium_visitor_id", visitorId);
      }

      let sessionId = sessionStorage.getItem("podium_session_id");
      if (!sessionId) {
        sessionId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        sessionStorage.setItem("podium_session_id", sessionId);
      }

      // Once per browser tab session, matching how team_profile_view is
      // deduped -- tweaking inputs or reloading the page repeatedly in
      // one sitting should count as one use, not many.
      const viewKey = `podium_tool_view_pace_calculator_${sessionId}`;
      if (sessionStorage.getItem(viewKey)) return;
      sessionStorage.setItem(viewKey, "1");

      fetch("/api/engagement/track", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "pace_calculator_use",
          visitor_id: visitorId,
          session_id: sessionId,
          section: "tools",
          path: window.location.pathname
        })
      }).catch(() => {});
    } catch {
      // Analytics must never interrupt the calculator.
    }
  })();
})();
