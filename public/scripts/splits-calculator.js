(() => {
  const root = document.querySelector("[data-splits-calculator]");
  const splits = window.PodiumPaceSplits;
  if (!root || !splits) return;

  const distanceChipsEl = root.querySelector("[data-splits-distance-chips]");
  const customDistanceInput = root.querySelector("[data-splits-custom-distance]");
  const unitChipsEl = root.querySelector("[data-splits-unit-chips]");
  const hoursInput = root.querySelector("[data-splits-hours]");
  const minutesInput = root.querySelector("[data-splits-minutes]");
  const secondsInput = root.querySelector("[data-splits-seconds]");
  const stepChipsEl = root.querySelector("[data-splits-step-chips]");
  const summaryEl = root.querySelector("[data-splits-summary]");
  const resultsEl = root.querySelector("[data-splits-results]");

  if (!distanceChipsEl || !customDistanceInput || !unitChipsEl || !hoursInput || !minutesInput || !secondsInput || !stepChipsEl || !summaryEl || !resultsEl) {
    return;
  }

  const QUICK_DISTANCES = [
    { id: "5k", label: "5K", meters: 5000, unit: "km", value: 5 },
    { id: "10k", label: "10K", meters: 10000, unit: "km", value: 10 },
    { id: "15k", label: "15K", meters: 15000, unit: "km", value: 15 },
    { id: "half", label: "Half Marathon", meters: 21097.5, unit: "mi", value: 13.11 },
    { id: "marathon", label: "Marathon", meters: 42195, unit: "mi", value: 26.22 }
  ];

  const STEPS = [
    { id: "mile", label: "Mile splits", meters: splits.MILE_METERS },
    { id: "400m", label: "400m splits", meters: 400 }
  ];

  // Loads pre-filled with a half marathon at 1:45:00, mile splits -- a
  // default that immediately shows what this tool is for (longer
  // distances the 6-event race pace calculator doesn't cover).
  let distanceMeters = 21097.5;
  let distanceUnit = "mi";
  let selectedQuickId = "half";
  let goalHours = 1;
  let goalMinutes = 45;
  let goalSeconds = 0;
  let selectedStepId = "mile";

  function totalGoalSeconds() {
    return splits.totalSecondsFromParts({ hours: goalHours, minutes: goalMinutes, seconds: goalSeconds });
  }

  function currentDistanceLabel() {
    const quick = QUICK_DISTANCES.find((d) => d.id === selectedQuickId);
    if (quick) return quick.label;
    const value = distanceUnit === "mi" ? distanceMeters / splits.MILE_METERS : distanceMeters / splits.KM_METERS;
    return value.toFixed(2).replace(/\.00$/, "") + (distanceUnit === "mi" ? " mi" : " km");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderDistanceChips() {
    distanceChipsEl.innerHTML = QUICK_DISTANCES.map((d) => `
      <button type="button" class="splits-chip" data-splits-distance-id="${d.id}" aria-pressed="${d.id === selectedQuickId}">${escapeHtml(d.label)}</button>
    `).join("");
  }

  function renderUnitChips() {
    unitChipsEl.innerHTML = ["mi", "km"].map((unit) => `
      <button type="button" data-splits-unit="${unit}" aria-pressed="${unit === distanceUnit}">${unit}</button>
    `).join("");
  }

  function renderStepChips() {
    stepChipsEl.innerHTML = STEPS.map((step) => `
      <button type="button" class="splits-chip" data-splits-step-id="${step.id}" aria-pressed="${step.id === selectedStepId}">${escapeHtml(step.label)}</button>
    `).join("");
  }

  function mileLabel(row) {
    if (row.isPartial) {
      const partialMiles = (row.distanceMeters - row.index * splits.MILE_METERS) / splits.MILE_METERS;
      return "+" + partialMiles.toFixed(1) + "mi";
    }
    return "Mile " + (row.index + 1);
  }

  function meterLabel(row) {
    return Math.round(row.distanceMeters) + "m";
  }

  function render() {
    const goal = totalGoalSeconds();

    if (goal <= 0 || distanceMeters <= 0) {
      summaryEl.innerHTML = "";
      resultsEl.innerHTML = `<p>Enter a goal time and distance to see your splits.</p>`;
      return;
    }

    const paceMile = splits.paceForUnit(goal, distanceMeters, splits.MILE_METERS);
    const paceKm = splits.paceForUnit(goal, distanceMeters, splits.KM_METERS);

    summaryEl.innerHTML = `
      <div class="splits-summary">
        <div class="splits-summary-time">${escapeHtml(splits.formatWholeTime(goal))}</div>
        <div class="splits-summary-event">${escapeHtml(currentDistanceLabel())} goal</div>
        <div class="splits-summary-paces">
          <div><strong>${escapeHtml(splits.formatSplitTime(paceMile))}</strong><span>Per mile</span></div>
          <div><strong>${escapeHtml(splits.formatSplitTime(paceKm))}</strong><span>Per km</span></div>
        </div>
      </div>
    `;

    const step = STEPS.find((s) => s.id === selectedStepId) || STEPS[0];
    const rows = splits.buildCheckpoints({ distanceMeters, goalSeconds: goal, stepMeters: step.meters });
    const labelFn = step.id === "mile" ? mileLabel : meterLabel;

    const rowsHtml = rows.map((row) => `
      <tr>
        <td>${escapeHtml(labelFn(row))}</td>
        <td>${escapeHtml(splits.formatSplitTime(row.cumulativeSeconds))}</td>
        <td>${escapeHtml(splits.formatSplitTime(row.splitSeconds))}</td>
      </tr>
    `).join("");

    resultsEl.innerHTML = `
      <table class="splits-table">
        <thead><tr><th>Mark</th><th>Total</th><th>Split</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;
  }

  distanceChipsEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-splits-distance-id]");
    if (!button) return;
    const quick = QUICK_DISTANCES.find((d) => d.id === button.dataset.splitsDistanceId);
    if (!quick) return;

    distanceMeters = quick.meters;
    distanceUnit = quick.unit;
    selectedQuickId = quick.id;
    customDistanceInput.value = quick.value;
    renderDistanceChips();
    renderUnitChips();
    render();
  });

  unitChipsEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-splits-unit]");
    if (!button) return;
    distanceUnit = button.dataset.splitsUnit;
    selectedQuickId = null;
    renderDistanceChips();
    renderUnitChips();
    updateDistanceFromCustomInput();
  });

  function updateDistanceFromCustomInput() {
    const value = Number(customDistanceInput.value) || 0;
    distanceMeters = distanceUnit === "mi" ? splits.milesToMeters(value) : splits.kmToMeters(value);
    render();
  }

  customDistanceInput.addEventListener("input", () => {
    selectedQuickId = null;
    renderDistanceChips();
    updateDistanceFromCustomInput();
  });

  stepChipsEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-splits-step-id]");
    if (!button) return;
    selectedStepId = button.dataset.splitsStepId;
    renderStepChips();
    render();
  });

  hoursInput.addEventListener("input", () => { goalHours = hoursInput.value; render(); });
  minutesInput.addEventListener("input", () => { goalMinutes = minutesInput.value; render(); });
  secondsInput.addEventListener("input", () => { goalSeconds = secondsInput.value; render(); });

  hoursInput.value = goalHours;
  minutesInput.value = String(goalMinutes).padStart(2, "0");
  secondsInput.value = String(goalSeconds).padStart(2, "0");
  customDistanceInput.value = QUICK_DISTANCES.find((d) => d.id === selectedQuickId).value;

  renderDistanceChips();
  renderUnitChips();
  renderStepChips();
  render();
})();
