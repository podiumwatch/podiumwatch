(() => {
  const root = document.querySelector("[data-scoring-calculator]");
  const scoring = window.PodiumMeetScoring;
  if (!root || !scoring) return;

  const teamNameInput = root.querySelector("[data-scoring-team-name-input]");
  const addTeamButton = root.querySelector("[data-scoring-add-team]");
  const teamListEl = root.querySelector("[data-scoring-team-list]");
  const finishButtonsEl = root.querySelector("[data-scoring-finish-buttons]");
  const finishOrderEl = root.querySelector("[data-scoring-finish-order]");
  const undoButton = root.querySelector("[data-scoring-undo]");
  const clearOrderButton = root.querySelector("[data-scoring-clear-order]");
  const resultsEl = root.querySelector("[data-scoring-results]");

  if (!teamNameInput || !addTeamButton || !teamListEl || !finishButtonsEl || !finishOrderEl || !undoButton || !clearOrderButton || !resultsEl) {
    return;
  }

  // A live-meet scratchpad, not a saved record -- teams and the finish
  // order live only in memory for this page load, matching the pace
  // and splits calculators (no API call, no database, nothing saved).
  const TEAM_COLORS = ["#0faf68", "#1d4ed8", "#c2410c", "#7c3aed", "#be123c", "#0f766e", "#a16207", "#334155"];
  let teams = [];
  let finishOrder = []; // array of { teamId } | null (null = unattached/no-team finisher)
  let nextTeamSeq = 0;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function swatch(color) {
    return `<span class="scoring-team-chip-swatch" style="background:${color}"></span>`;
  }

  function findTeam(teamId) {
    return teams.find((team) => team.id === teamId) || null;
  }

  function addTeam() {
    const name = teamNameInput.value.trim();
    if (!name) return;
    if (teams.some((team) => team.name.toLowerCase() === name.toLowerCase())) {
      // Duplicate name: leave the input as-is (don't clear it) so it's
      // visible next to the matching chip instead of just silently
      // doing nothing with no feedback at all.
      return;
    }

    const color = TEAM_COLORS[nextTeamSeq % TEAM_COLORS.length];
    teams.push({ id: "t" + (nextTeamSeq + 1), name, color });
    nextTeamSeq += 1;

    teamNameInput.value = "";
    teamNameInput.focus();
    renderAll();
  }

  function removeTeam(teamId) {
    teams = teams.filter((team) => team.id !== teamId);
    // Cascade: any already-recorded finisher for the removed team
    // becomes unattached rather than being deleted outright -- deleting
    // it would shift every later place number and quietly rewrite the
    // rest of the meet's results.
    finishOrder = finishOrder.map((entry) => (entry && entry.teamId === teamId ? null : entry));
    renderAll();
  }

  function recordFinisher(teamId) {
    if (!teamId) {
      finishOrder.push(null);
      renderAll();
      return;
    }
    // meet-scoring.js's computeTeamScores() reads teamName straight off
    // each finish-order entry (falling back to the raw teamId if it's
    // missing) -- passing it here at record time, not just resolving it
    // ad hoc wherever a team name is displayed, is what keeps the
    // standings table showing "Anthony Wayne" instead of the internal
    // id "t1".
    const team = findTeam(teamId);
    finishOrder.push({ teamId, teamName: team ? team.name : teamId });
    renderAll();
  }

  function renderTeamChips() {
    if (!teams.length) {
      teamListEl.innerHTML = `<p class="scoring-hint" style="margin:0;">Add at least 2 teams to start scoring a meet.</p>`;
      return;
    }
    teamListEl.innerHTML = teams.map((team) => `
      <span class="scoring-team-chip">${swatch(team.color)}${escapeHtml(team.name)}<button type="button" data-scoring-remove-team="${team.id}" aria-label="Remove ${escapeHtml(team.name)}">&times;</button></span>
    `).join("");
  }

  function renderFinishButtons() {
    if (!teams.length) {
      finishButtonsEl.innerHTML = "";
      return;
    }
    const teamButtons = teams.map((team) => `
      <button type="button" class="scoring-finish-button" data-scoring-record="${team.id}">${swatch(team.color)}${escapeHtml(team.name)}</button>
    `).join("");
    const unattachedButton = `<button type="button" class="scoring-finish-button scoring-finish-button-unattached" data-scoring-record="">No team</button>`;
    finishButtonsEl.innerHTML = teamButtons + unattachedButton;
  }

  function renderFinishOrderList() {
    if (!finishOrder.length) {
      finishOrderEl.innerHTML = `<li class="scoring-hint" style="list-style:none;">No finishers recorded yet.</li>`;
      return;
    }
    finishOrderEl.innerHTML = finishOrder.map((entry, index) => {
      const place = index + 1;
      const team = entry && entry.teamId ? findTeam(entry.teamId) : null;
      const label = entry && entry.teamId ? escapeHtml(team ? team.name : "(removed team)") : "No team";
      const dot = team ? swatch(team.color) : "";
      return `
        <li class="scoring-finish-row">
          <span class="scoring-finish-row-place">${place}.</span>
          <span class="scoring-finish-row-team">${dot}${label}</span>
          <button type="button" data-scoring-remove-place="${index}" aria-label="Remove place ${place}">&times;</button>
        </li>
      `;
    }).join("");
  }

  function renderResults() {
    const teamScores = scoring.computeTeamScores(finishOrder);

    if (!teamScores.length) {
      resultsEl.innerHTML = teams.length ? `<p class="scoring-hint">Record finishers to see team scores.</p>` : "";
      return;
    }

    const { ranked, unscored } = scoring.rankTeams(teamScores);

    const standingsRows = ranked.map((team) => `
      <tr>
        <td>${team.rank}${team.scoreTied ? "*" : ""}</td>
        <td>${team.score}</td>
        <td>
          <span class="scoring-standings-team">${swatch((findTeam(team.teamId) || {}).color || "#9c9c9c")}${escapeHtml(team.teamName)}</span>
          <span class="scoring-standings-detail">Scorers: ${team.scoringPlaces.join(", ")}${team.displacerPlaces.length ? " &middot; Displacers: " + team.displacerPlaces.join(", ") : ""}</span>
        </td>
      </tr>
    `).join("");

    const standingsTable = ranked.length ? `
      <table class="scoring-standings">
        <thead><tr><th>Rank</th><th>Score</th><th>Team</th></tr></thead>
        <tbody>${standingsRows}</tbody>
      </table>
      ${ranked.some((team) => team.scoreTied) ? `<p class="scoring-hint">*Tied on total score; final order decided by the standard NFHS tie-break (best 5th/last scorer).</p>` : ""}
    ` : "";

    const incompleteBlock = unscored.length ? `
      <div class="scoring-incomplete">
        <strong>Not yet scoring (needs ${scoring.MIN_SCORING_FINISHERS} finishers):</strong>
        ${unscored.map((team) => `${escapeHtml(team.teamName)} (${team.finisherCount}/${scoring.MIN_SCORING_FINISHERS})`).join(", ")}
      </div>
    ` : "";

    resultsEl.innerHTML = (standingsTable + incompleteBlock) || `<p class="scoring-hint">Record at least ${scoring.MIN_SCORING_FINISHERS} finishers for one team to see a team score.</p>`;
  }

  function renderAll() {
    renderTeamChips();
    renderFinishButtons();
    renderFinishOrderList();
    renderResults();
  }

  addTeamButton.addEventListener("click", addTeam);
  teamNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTeam();
    }
  });

  teamListEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-scoring-remove-team]");
    if (!button) return;
    removeTeam(button.dataset.scoringRemoveTeam);
  });

  finishButtonsEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-scoring-record]");
    if (!button) return;
    recordFinisher(button.dataset.scoringRecord || null);
  });

  finishOrderEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-scoring-remove-place]");
    if (!button) return;
    finishOrder.splice(Number(button.dataset.scoringRemovePlace), 1);
    renderAll();
  });

  undoButton.addEventListener("click", () => {
    finishOrder.pop();
    renderAll();
  });

  clearOrderButton.addEventListener("click", () => {
    finishOrder = [];
    renderAll();
  });

  renderAll();
})();
