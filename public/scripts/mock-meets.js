// 2026 Ohio XC Mock Meets results page (src/pages/mockmeets.mjs).
//
// The ~520KB dataset is fetched once on load (see mockmeets.mjs for why
// this is fetched rather than embedded inline like the smaller OATCCC poll
// JSON) and kept in memory; every control here just re-renders from it,
// no further network requests.
//
// Division state lives in location.hash (#boys-d1 .. #girls-d4) so a
// direct link lands on the right division and the browser back button
// works with no extra history bookkeeping -- setting location.hash pushes
// a real history entry on its own.
(function () {
  "use strict";

  const configEl = document.querySelector("[data-mm-config]");
  if (!configEl) return;
  const config = JSON.parse(configEl.textContent);

  const loadingEl = document.querySelector("[data-mm-loading]");
  const errorEl = document.querySelector("[data-mm-error]");
  const contentEl = document.querySelector("[data-mm-content]");
  const headingEl = document.querySelector("[data-mm-heading]");
  const provisionalEl = document.querySelector("[data-mm-provisional]");
  const provisionalTextEl = document.querySelector("[data-mm-provisional-text]");
  const genderButtons = Array.from(document.querySelectorAll("[data-mm-gender]"));
  const divisionSelect = document.querySelector("[data-mm-division]");
  const viewSelect = document.querySelector("[data-mm-view]");
  const teamsWrap = document.querySelector("[data-mm-teams-wrap]");
  const teamsRowsEl = document.querySelector("[data-mm-teams-rows]");
  const individualsWrap = document.querySelector("[data-mm-individuals-wrap]");
  const individualsRowsEl = document.querySelector("[data-mm-individuals-rows]");
  const searchInput = document.querySelector("[data-mm-search]");
  const searchResultsEl = document.querySelector("[data-mm-search-results]");

  const DIVISION_LABELS = { 1: "Division I", 2: "Division II", 3: "Division III", 4: "Division IV" };
  const PROVISIONAL_NOTES = {
    "boys-3": "This division is provisional. Berkshire's roster lists both “Ben Townsend” (17:04.6) and “Benjamin Townsend” (17:14.6) as separate runners -- a possible duplicate that has not been confirmed. Both are kept in the scoring as supplied.",
    "girls-3": "This division is provisional. Berkshire's roster listed two “Ashlyn” entries; they are treated as one runner pending identity confirmation, with Hailey Mitchell (22:47.8) added as the seventh scorer."
  };

  let gender = "boys";
  let division = 1;
  let view = "teams";
  let data = null;
  let searchIndex = [];
  let highlightRequest = null;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function escapeCsv(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
  }

  function findDivision(g, d) {
    if (!data) return null;
    return data.divisions.find((entry) => entry.gender === g && entry.division === Number(d)) || null;
  }

  function firstFiveText(team) {
    return team.runners
      .filter((runner) => runner.teamPosition <= 5)
      .sort((a, b) => a.teamPosition - b.teamPosition)
      .map((runner) => runner.placePoints)
      .join(", ");
  }

  function positionPoints(team, position) {
    const runner = team.runners.find((r) => r.teamPosition === position);
    return runner ? runner.placePoints : null;
  }

  function changeCellHtml(rankChange) {
    if (rankChange === 0) return '<span class="mm-move-none">--</span>';
    if (rankChange > 0) return '<span class="mm-move-up">▲' + rankChange + "</span>";
    return '<span class="mm-move-down">▼' + Math.abs(rankChange) + "</span>";
  }

  function rosterTableHtml(team) {
    const rows = team.runners
      .slice()
      .sort((a, b) => a.teamPosition - b.teamPosition)
      .map((runner) => {
        const role = runner.scoring ? '<span class="mm-role-scored">Scored</span>' : '<span class="mm-role-displaced">Displaced</span>';
        const link = runner.resultUrl ? ` <a href="${escapeHtml(runner.resultUrl)}" target="_blank" rel="noopener noreferrer">source</a>` : "";
        return (
          "<tr>" +
          "<td>" + runner.teamPosition + "</td>" +
          "<td>" + escapeHtml(runner.name) + link + "</td>" +
          "<td>" + escapeHtml(runner.seasonBest) + "</td>" +
          "<td>" + runner.placePoints + "</td>" +
          "<td>" + role + "</td>" +
          "</tr>"
        );
      })
      .join("");
    return (
      '<table class="mm-roster"><thead><tr><th>Pos</th><th>Runner</th><th>Season best</th><th>Points</th><th>Role</th></tr></thead><tbody>' +
      rows +
      "</tbody></table>"
    );
  }

  function drawTeams(entry) {
    teamsRowsEl.innerHTML = entry.teams
      .map((team, index) => {
        const sixth = positionPoints(team, 6);
        const seventh = positionPoints(team, 7);
        return (
          '<tr data-mm-team-row="' + index + '">' +
          '<td class="mm-cell-rank" data-label="Mock place">' + team.mockRank + "</td>" +
          '<td class="mm-cell-school" data-label="School">' + escapeHtml(team.name) + "</td>" +
          '<td class="mm-cell-num" data-label="Poll rank">' + team.pollRank + "</td>" +
          '<td data-label="Change">' + changeCellHtml(team.rankChange) + "</td>" +
          '<td class="mm-cell-num" data-label="Score">' + team.score + "</td>" +
          '<td class="mm-cell-num" data-label="First five">' + firstFiveText(team) + "</td>" +
          '<td class="mm-cell-num" data-label="Sixth">' + (sixth != null ? sixth : "None") + "</td>" +
          '<td class="mm-cell-num" data-label="Seventh">' + (seventh != null ? seventh : "None") + "</td>" +
          '<td data-label=""><button type="button" class="mm-team-toggle" data-mm-toggle="' + index + '" aria-expanded="false">Roster</button></td>' +
          "</tr>" +
          '<tr class="mm-detail-row" data-mm-detail="' + index + '" hidden><td colspan="9">' + rosterTableHtml(team) + "</td></tr>"
        );
      })
      .join("");

    Array.from(teamsRowsEl.querySelectorAll("[data-mm-toggle]")).forEach((button) => {
      button.addEventListener("click", () => {
        const detailRow = teamsRowsEl.querySelector('[data-mm-detail="' + button.dataset.mmToggle + '"]');
        if (!detailRow) return;
        const willShow = detailRow.hidden;
        detailRow.hidden = !willShow;
        button.setAttribute("aria-expanded", String(willShow));
      });
    });
  }

  function drawIndividuals(entry) {
    const runners = [];
    entry.teams.forEach((team) => {
      team.runners.forEach((runner) => runners.push({ ...runner, team: team.name }));
    });
    runners.sort((a, b) => a.timeCentiseconds - b.timeCentiseconds);

    const timeCounts = new Map();
    runners.forEach((runner) => timeCounts.set(runner.timeCentiseconds, (timeCounts.get(runner.timeCentiseconds) || 0) + 1));

    individualsRowsEl.innerHTML = runners
      .map((runner, index) => {
        const tied = timeCounts.get(runner.timeCentiseconds) > 1;
        return (
          "<tr>" +
          '<td class="mm-cell-num" data-label="Place">' + (index + 1) + "</td>" +
          '<td data-label="Athlete">' + escapeHtml(runner.name) + "</td>" +
          '<td data-label="School">' + escapeHtml(runner.team) + "</td>" +
          '<td class="mm-cell-num" data-label="Season best">' + escapeHtml(runner.seasonBest) + "</td>" +
          '<td class="mm-cell-num" data-label="Modeled points">' + runner.placePoints + (tied ? '<span class="mm-tied-tag">Tied &middot; shared</span>' : "") + "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function draw() {
    const entry = findDivision(gender, division);
    if (!entry) return;

    headingEl.textContent = (gender === "boys" ? "Boys" : "Girls") + " " + DIVISION_LABELS[division] + " · " + entry.teamCount + " teams · " + entry.athleteCount + " runners";

    const provisionalNote = PROVISIONAL_NOTES[gender + "-" + division];
    if (entry.provisional && provisionalNote) {
      provisionalTextEl.textContent = provisionalNote;
      provisionalEl.classList.add("is-visible");
    } else {
      provisionalEl.classList.remove("is-visible");
    }

    if (view === "teams") {
      drawTeams(entry);
      teamsWrap.hidden = false;
      individualsWrap.hidden = true;
    } else {
      drawIndividuals(entry);
      teamsWrap.hidden = true;
      individualsWrap.hidden = false;
    }

    if (highlightRequest) {
      applyHighlight();
    }
  }

  function applyHighlight() {
    const request = highlightRequest;
    highlightRequest = null;
    window.requestAnimationFrame(() => {
      const entry = findDivision(gender, division);
      if (!entry) return;
      if (request.kind === "team" || request.kind === "athlete") {
        const teamIndex = entry.teams.findIndex((team) => team.name === request.team);
        if (teamIndex === -1) return;
        const row = teamsRowsEl.querySelector('[data-mm-team-row="' + teamIndex + '"]');
        if (!row) return;
        row.classList.add("mm-highlight");
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        if (request.kind === "athlete") {
          const toggle = teamsRowsEl.querySelector('[data-mm-toggle="' + teamIndex + '"]');
          if (toggle) toggle.click();
        }
        window.setTimeout(() => row.classList.remove("mm-highlight"), 2400);
      }
    });
  }

  function setGenderDivision(nextGender, nextDivision, { updateHash = true } = {}) {
    gender = nextGender;
    division = Number(nextDivision);
    genderButtons.forEach((button) => button.classList.toggle("active", button.dataset.mmGender === gender));
    divisionSelect.value = String(division);
    if (updateHash) location.hash = gender + "-d" + division;
    draw();
  }

  function syncFromHash() {
    const match = location.hash.slice(1).match(/^(boys|girls)-d([1-4])$/);
    if (!match) return;
    // location.hash is set synchronously inside setGenderDivision() just
    // before draw() runs, but the hashchange event it triggers fires as a
    // separate, later task. Without this guard, every user-initiated
    // gender/division change re-enters here once the event finally fires
    // and re-renders a second time -- redundant on its own, and a real bug
    // when it wipes transient UI state (e.g. the search-result highlight
    // in applyHighlight(), added by the first draw()'s requestAnimationFrame
    // callback, gone by the time the second draw() rebuilds the table).
    if (match[1] === gender && Number(match[2]) === division) return;
    setGenderDivision(match[1], match[2], { updateHash: false });
  }

  genderButtons.forEach((button) => {
    button.addEventListener("click", () => setGenderDivision(button.dataset.mmGender, division));
  });
  divisionSelect.addEventListener("change", () => setGenderDivision(gender, divisionSelect.value));
  viewSelect.addEventListener("change", () => { view = viewSelect.value; draw(); });
  window.addEventListener("hashchange", syncFromHash);

  function buildSearchIndex() {
    searchIndex = [];
    data.divisions.forEach((entry) => {
      entry.teams.forEach((team) => {
        searchIndex.push({ kind: "team", name: team.name, team: team.name, gender: entry.gender, division: entry.division });
        team.runners.forEach((runner) => {
          searchIndex.push({ kind: "athlete", name: runner.name, team: team.name, gender: entry.gender, division: entry.division });
        });
      });
    });
  }

  function renderSearchResults(query) {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) { searchResultsEl.hidden = true; searchResultsEl.innerHTML = ""; return; }
    const matches = searchIndex.filter((item) => item.name.toLowerCase().includes(trimmed)).slice(0, 20);
    if (!matches.length) {
      searchResultsEl.innerHTML = '<p class="mm-search-empty">No teams or athletes match &ldquo;' + escapeHtml(query) + '&rdquo;.</p>';
      searchResultsEl.hidden = false;
      return;
    }
    searchResultsEl.innerHTML = matches
      .map((item, index) => {
        const label = item.kind === "team" ? item.name : item.name + " — " + item.team;
        const sub = (item.gender === "boys" ? "Boys" : "Girls") + " " + DIVISION_LABELS[item.division];
        return '<button type="button" data-mm-search-pick="' + index + '"><span>' + escapeHtml(label) + "</span><span class=\"mm-search-sub\">" + escapeHtml(sub) + "</span></button>";
      })
      .join("");
    Array.from(searchResultsEl.querySelectorAll("[data-mm-search-pick]")).forEach((button, index) => {
      button.addEventListener("click", () => {
        const item = matches[index];
        view = "teams";
        viewSelect.value = "teams";
        highlightRequest = { kind: item.kind, team: item.team };
        setGenderDivision(item.gender, item.division);
        searchResultsEl.hidden = true;
        searchInput.value = "";
      });
    });
    searchResultsEl.hidden = false;
  }

  searchInput.addEventListener("input", () => renderSearchResults(searchInput.value));
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".mm-search-wrap")) searchResultsEl.hidden = true;
  });

  function downloadCsv(filename, rows) {
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function downloadTeams() {
    const entry = findDivision(gender, division);
    if (!entry) return;
    const header = ["Snapshot Date", "Gender", "Division", "School", "Poll Rank", "Mock Rank", "Rank Change", "Score", "First Five Scoring Places", "Sixth", "Seventh"];
    const rows = entry.teams.map((team) => {
      const sixth = positionPoints(team, 6);
      const seventh = positionPoints(team, 7);
      return [config.snapshotDate, entry.gender, entry.division, team.name, team.pollRank, team.mockRank, team.rankChange, team.score, firstFiveText(team), sixth != null ? sixth : "None", seventh != null ? seventh : "None"];
    });
    downloadCsv("podium-watch-mock-meets-" + entry.id + "-teams-" + config.snapshotDate + ".csv", [header, ...rows]);
  }

  function downloadIndividuals() {
    const entry = findDivision(gender, division);
    if (!entry) return;
    const header = ["Snapshot Date", "Gender", "Division", "Athlete", "School", "Season Best", "Modeled Place Points", "Team Position", "Scorer"];
    const rows = [];
    entry.teams.forEach((team) => {
      team.runners.forEach((runner) => {
        rows.push([config.snapshotDate, entry.gender, entry.division, runner.name, team.name, runner.seasonBest, runner.placePoints, runner.teamPosition, runner.scoring ? "Yes" : "No"]);
      });
    });
    downloadCsv("podium-watch-mock-meets-" + entry.id + "-individuals-" + config.snapshotDate + ".csv", [header, ...rows]);
  }

  Array.from(document.querySelectorAll("[data-mm-download]")).forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.mmDownload === "teams") downloadTeams();
      else downloadIndividuals();
    });
  });

  fetch(config.dataUrl)
    .then((response) => { if (!response.ok) throw new Error("Request failed"); return response.json(); })
    .then((json) => {
      data = json;
      buildSearchIndex();
      const initial = location.hash.slice(1).match(/^(boys|girls)-d([1-4])$/);
      if (initial) { gender = initial[1]; division = Number(initial[2]); }
      genderButtons.forEach((button) => button.classList.toggle("active", button.dataset.mmGender === gender));
      divisionSelect.value = String(division);
      loadingEl.hidden = true;
      contentEl.hidden = false;
      draw();
    })
    .catch(() => {
      loadingEl.hidden = true;
      errorEl.hidden = false;
    });
})();
