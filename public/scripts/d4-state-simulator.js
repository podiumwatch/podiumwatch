export function createSeededRandom(seed) {
  let state = Number(seed) >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normalSampler(random) {
  let spare = null;
  return () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    const first = Math.max(Number.EPSILON, random());
    const second = random();
    const magnitude = Math.sqrt(-2 * Math.log(first));
    const angle = 2 * Math.PI * second;
    spare = magnitude * Math.sin(angle);
    return magnitude * Math.cos(angle);
  };
}

export function scoreSimulatedFinishers(finishers, teams) {
  const teamById = new Map(teams.map((team) => [team.team_id, team]));
  const groups = new Map(teams.map((team) => [team.team_id, []]));
  for (const finisher of finishers) {
    if (finisher.team_id && groups.has(finisher.team_id)) groups.get(finisher.team_id).push(finisher);
  }

  const standings = [];
  for (const [teamId, runners] of groups) {
    runners.sort((left, right) => left.place - right.place);
    runners.forEach((runner, index) => {
      runner.team_position = index + 1;
      runner.scoring_role = index < 5 ? `Scorer ${index + 1}` : index === 5 ? "Sixth runner" : "Seventh runner";
    });
    if (runners.length < 5) continue;
    const scoringPlaces = runners.slice(0, 5).map((runner) => runner.place);
    standings.push({
      ...teamById.get(teamId),
      score: scoringPlaces.reduce((sum, place) => sum + place, 0),
      scoring_places: scoringPlaces,
      sixth_place: runners[5]?.place ?? null,
      seventh_place: runners[6]?.place ?? null
    });
  }
  standings.sort((left, right) => (
    left.score - right.score
    || (left.sixth_place ?? Infinity) - (right.sixth_place ?? Infinity)
    || left.team_name.localeCompare(right.team_name)
  ));
  standings.forEach((team, index) => { team.rank = index + 1; });
  for (const finisher of finishers) {
    if (!finisher.team_id) {
      finisher.team_position = null;
      finisher.scoring_role = "Individual qualifier";
    }
  }
  return standings;
}

export function simulateRace(division, options = {}) {
  if (!division?.teams?.length || !division?.athletes?.length) throw new Error("Simulator field is unavailable.");
  const seed = Number(options.seed ?? Date.now()) >>> 0;
  const random = options.random || createSeededRandom(seed);
  const normal = normalSampler(random);
  const teamShock = new Map(division.teams.map((team) => [
    team.team_id,
    normal() * Number(division.team_day_standard_deviation_seconds || 0)
  ]));
  const finishers = division.athletes.map((athlete) => ({
    ...athlete,
    simulated_seconds: Math.max(1, athlete.estimated_seconds
      + (athlete.team_id ? teamShock.get(athlete.team_id) || 0 : 0)
      + normal() * athlete.standard_deviation_seconds)
  })).sort((left, right) => (
    left.simulated_seconds - right.simulated_seconds
    || left.athlete_id.localeCompare(right.athlete_id)
  ));
  finishers.forEach((athlete, index) => { athlete.place = index + 1; });
  const teams = scoreSimulatedFinishers(finishers, division.teams);
  return { seed, finishers, teams };
}

export function formatSimulatedTime(seconds) {
  const tenths = Math.max(0, Math.round(Number(seconds) * 10));
  const minutes = Math.floor(tenths / 600);
  const remaining = tenths - minutes * 600;
  return `${minutes}:${String(Math.floor(remaining / 10)).padStart(2, "0")}.${remaining % 10}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function randomSeed() {
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0];
  }
  return Date.now() >>> 0;
}

function renderTeamRows(teams) {
  return teams.map((team) => `<tr>
    <td data-label="Place"><strong>${team.rank}</strong></td>
    <td data-label="Team"><strong>${escapeHtml(team.team_name)}</strong><span class="d4sim-region">${escapeHtml(team.region)}</span></td>
    <td data-label="Score"><strong>${team.score}</strong></td>
    <td data-label="Scorers">${team.scoring_places.join(" + ")}</td>
    <td data-label="Sixth">${team.sixth_place ?? "—"}</td>
    <td data-label="Seventh">${team.seventh_place ?? "—"}</td>
  </tr>`).join("");
}

function renderFinisherRows(finishers) {
  return finishers.map((athlete) => `<tr>
    <td data-label="Place"><strong>${athlete.place}</strong></td>
    <td data-label="Runner"><strong>${escapeHtml(athlete.athlete_name)}</strong></td>
    <td data-label="School">${escapeHtml(athlete.school_name)}</td>
    <td data-label="Region">${escapeHtml(athlete.region)}</td>
    <td data-label="Time">${formatSimulatedTime(athlete.simulated_seconds)}</td>
    <td data-label="Team role">${escapeHtml(athlete.scoring_role)}</td>
  </tr>`).join("");
}

async function initializeSimulator(root) {
  const button = root.querySelector("[data-d4sim-run]");
  const divisionButtons = [...root.querySelectorAll("[data-d4sim-division]")];
  const status = root.querySelector("[data-d4sim-status]");
  const fieldNote = root.querySelector("[data-d4sim-field-note]");
  const results = root.querySelector("[data-d4sim-results]");
  const summary = root.querySelector("[data-d4sim-summary]");
  const teamRows = root.querySelector("[data-d4sim-team-rows]");
  const finisherRows = root.querySelector("[data-d4sim-finisher-rows]");
  try {
    const response = await fetch(root.dataset.source);
    if (!response.ok) throw new Error(`Simulator data request failed (${response.status}).`);
    const data = await response.json();
    let division;

    function selectDivision(divisionId) {
      division = data.divisions?.[divisionId];
      if (!division) throw new Error("This simulator division is unavailable.");
      root.dataset.divisionId = divisionId;
      divisionButtons.forEach((tab) => tab.setAttribute("aria-pressed", String(tab.dataset.d4simDivision === divisionId)));
      const rejectedTeams = division.rejected_teams || [];
      const replacements = division.teams.filter((team) => team.selection_status === "replacement_after_history_gate");
      if (fieldNote) {
        fieldNote.hidden = rejectedTeams.length === 0;
        fieldNote.textContent = "";
        if (rejectedTeams.length) {
          const rejected = rejectedTeams.map((team) => `${team.team_name} (${team.eligible_athletes} of ${team.required_athletes} required runners)`).join(", ");
          const replacement = replacements.map((team) => `${team.team_name} (${team.region})`).join(", ");
          fieldNote.textContent = `History eligibility adjustment: ${rejected} could not be accepted. ${replacement || "The next eligible team"} fills the open field position.`;
        }
      }
      results.hidden = true;
      summary.textContent = "";
      teamRows.innerHTML = "";
      finisherRows.innerHTML = "";
      button.textContent = "Simulate";
      button.disabled = false;
      status.textContent = `${division.label} · ${division.teams.length} teams · ${division.athletes.length} runners · performances before ${data.exclusive_cutoff}`;
    }

    divisionButtons.forEach((tab) => tab.addEventListener("click", () => selectDivision(tab.dataset.d4simDivision)));
    selectDivision(root.dataset.divisionId);
    button.addEventListener("click", () => {
      button.disabled = true;
      status.textContent = "Running the race…";
      window.requestAnimationFrame(() => {
        const simulation = simulateRace(division, { seed: randomSeed() });
        teamRows.innerHTML = renderTeamRows(simulation.teams);
        finisherRows.innerHTML = renderFinisherRows(simulation.finishers);
        const winner = simulation.teams[0];
        summary.innerHTML = `<strong>${escapeHtml(winner.team_name)}</strong> wins this simulation with ${winner.score} points. ` +
          `${simulation.finishers.length} runners finished; individual qualifiers are included in every place.`;
        results.hidden = false;
        button.textContent = "Simulate again";
        button.disabled = false;
        status.textContent = `Simulation ${simulation.seed} · ${division.teams.length} complete team scores`;
        results.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  } catch (error) {
    status.textContent = "The simulator data could not be loaded. Please try again later.";
    root.dataset.state = "error";
    console.error(error);
  }
}

if (typeof document !== "undefined") {
  document.querySelectorAll("[data-d4-state-simulator]").forEach((root) => initializeSimulator(root));
}
