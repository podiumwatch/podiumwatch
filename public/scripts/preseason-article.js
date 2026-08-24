// Podium Watch 2026 preseason article interactive components.
//
// Hydrates the [[PODIUM_WATCH_COMPONENT: ...]] placeholder divs
// (src/lib/markdown.mjs) with real data embedded on the page as
// #pw-preseason-data (one classification's worth of Race Board,
// scoreProgression, fifthRunnerFactor, displacementReport, tiebreaks, and
// polls -- see public/data/podium-watch-2026-preseason-interactive-data.json).
// Also builds the Team Compare drawer and Share This Team card, which are
// not tied to any single marker.
//
// Every component works from the same already-loaded JSON -- nothing here
// fetches the dataset itself, only the Reader Predictions poll endpoints
// (api/article-polls/vote.js, api/article-polls/results.js) do real
// network requests. If JS never runs, the reader still has the full
// supplied data table directly below each marker's spot in the article
// text, since every component in these articles was placed immediately
// above its own fallback table.
(function () {
  "use strict";

  const article = document.querySelector("[data-pw-article]");
  const dataScript = document.getElementById("pw-preseason-data");
  if (!article || !dataScript) return;

  let classification;
  try {
    classification = JSON.parse(dataScript.textContent);
  } catch {
    return;
  }

  const articleSlug = article.getAttribute("data-pw-article") || classification.articleSlug;
  const raceBoard = classification.raceBoard || [];
  const rankedTeams = raceBoard.filter((row) => row.status === "ranked");
  const honorableTeams = raceBoard.filter((row) => row.status === "honorableMention");
  const teamsById = new Map(raceBoard.map((row) => [row.team, row]));
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function ordinal(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return String(n);
    const mod100 = num % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${num}th`;
    switch (num % 10) {
      case 1: return `${num}st`;
      case 2: return `${num}nd`;
      case 3: return `${num}rd`;
      default: return `${num}th`;
    }
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
  }

  function gapLabel(row) {
    return row.gapToTeamAhead === null || row.gapToTeamAhead === undefined ? "Leader" : `+${row.gapToTeamAhead}`;
  }

  // Small, keyboard-operable inline tooltip: a button carrying the
  // explanation text as its own child bubble, toggled open on click and
  // closed on blur/outside click/Escape. Shared by every component that
  // needs to explain a term (simulated score, spread, displacement, tiebreak).
  function tip(label, text) {
    return `<button type="button" class="pw-tip" data-pw-tip aria-label="What does ${esc(label)} mean?">i<span class="pw-tip-bubble" role="tooltip">${esc(text)}</span></button>`;
  }

  document.addEventListener("click", (event) => {
    const opened = document.querySelectorAll('.pw-tip[data-open="true"]');
    const trigger = event.target.closest("[data-pw-tip]");
    opened.forEach((button) => {
      if (button !== trigger) button.removeAttribute("data-open");
    });
    if (trigger) {
      const isOpen = trigger.getAttribute("data-open") === "true";
      trigger.setAttribute("data-open", isOpen ? "false" : "true");
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      document.querySelectorAll('.pw-tip[data-open="true"]').forEach((button) => button.removeAttribute("data-open"));
    }
  });

  // ---------------------------------------------------------------------
  // Race Board
  // ---------------------------------------------------------------------
  function renderRaceBoard(container) {
    const columns = [
      { key: "rank", label: "Rank", sort: (row) => row.rank },
      { key: "team", label: "Team", sort: (row) => row.team },
      { key: "score", label: "Score", sort: (row) => row.score },
      { key: "gap", label: "Gap", sort: (row) => row.gapToTeamAhead ?? -1 },
      { key: "avg", label: "5K Avg", sort: (row) => row.fiveRunnerAverageSeconds },
      { key: "spread", label: "Spread", sort: (row) => row.spreadSeconds },
      { key: "fifth", label: "5th", sort: (row) => row.scorerPlaces[4] },
      { key: "sixth", label: "6th", sort: (row) => row.sixthPlace }
    ];

    let sortKey = "rank";
    let sortAsc = true;
    let showHonorable = false;
    let openTeam = null;

    container.innerHTML = `
      <div class="pw-raceboard-toolbar">
        <p class="pw-raceboard-hint">Lower score is better ${tip("simulated score", "The simulated team score is the sum of a team's five scoring places in a modeled 25-team championship field. The lowest total wins, exactly like a real cross country meet.")} &middot; Spread is the time gap between a team's 1st and 5th scorer ${tip("spread", "Spread is the time difference between a team's fastest and fifth-fastest scorer in the simulated field. A smaller spread means the lineup finishes closer together, which usually protects a team's score if one runner has an off day.")} &middot; Tap a team to see its returning lineup.</p>
      </div>
      <div class="table-scroll" tabindex="0" aria-label="Race Board, sortable">
        <table class="pw-raceboard-table">
          <thead><tr>
            ${columns.map((col) => `<th scope="col" data-sort="${col.key}" tabindex="0" role="button" aria-sort="none">${esc(col.label)}</th>`).join("")}
          </tr></thead>
          <tbody data-pw-raceboard-body></tbody>
        </table>
      </div>`;

    const tbody = container.querySelector("[data-pw-raceboard-body]");
    const headers = container.querySelectorAll("th[data-sort]");

    function rosterRowsHtml(row) {
      return row.runners.map((runner) => `<tr><td>${runner.slot}</td><td>${esc(runner.athlete)}</td><td>${esc(runner.time)}</td><td>${ordinal(runner.simulatedPlace)}</td></tr>`).join("");
    }

    function draw() {
      const rows = [...(showHonorable ? raceBoard : rankedTeams)];
      const col = columns.find((c) => c.key === sortKey);
      rows.sort((a, b) => {
        const av = col.sort(a);
        const bv = col.sort(b);
        if (typeof av === "string") return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
        return sortAsc ? av - bv : bv - av;
      });

      tbody.innerHTML = rows.map((row) => {
        const isOpen = openTeam === row.team;
        const rowClass = row.status === "honorableMention" ? "pw-team-row pw-honorable-row" : "pw-team-row";
        return `<tr class="${rowClass}" data-team="${esc(row.team)}" tabindex="0" role="button" aria-expanded="${isOpen}">
            <td data-label="Rank">${row.rank}</td>
            <td data-label="Team" class="pw-cell-team">${esc(row.team)}</td>
            <td data-label="Score">${row.score}</td>
            <td data-label="Gap">${gapLabel(row)}</td>
            <td data-label="5K Avg">${esc(row.fiveRunnerAverageDisplay)}</td>
            <td data-label="Spread">${row.spreadSeconds.toFixed(2)}s</td>
            <td data-label="5th">${ordinal(row.scorerPlaces[4])}</td>
            <td data-label="6th">${ordinal(row.sixthPlace)}</td>
          </tr>
          <tr class="pw-roster-row" ${isOpen ? "" : "hidden"}><td colspan="8">
            <div class="pw-roster-panel">
              <p class="pw-eyebrow">${esc(row.team)} returning lineup</p>
              <table><thead><tr><th>Slot</th><th>Athlete</th><th>2025 5K</th><th>Sim. place</th></tr></thead>
              <tbody>${rosterRowsHtml(row)}</tbody></table>
            </div>
          </td></tr>`;
      }).join("") + (showHonorable ? "" : `<tr class="pw-honorable-toggle-row"><td colspan="8"><button type="button" class="button button-outline" data-pw-show-honorable>Show honorable mentions 21&ndash;25</button></td></tr>`);

      if (showHonorable) {
        const hideRow = document.createElement("tr");
        hideRow.className = "pw-honorable-toggle-row";
        hideRow.innerHTML = `<td colspan="8"><button type="button" class="button button-outline" data-pw-hide-honorable>Hide honorable mentions</button></td>`;
        tbody.appendChild(hideRow);
      }

      headers.forEach((th) => {
        th.setAttribute("aria-sort", th.dataset.sort === sortKey ? (sortAsc ? "ascending" : "descending") : "none");
      });

      // Called directly from here, synchronously after the real DOM update,
      // rather than via a document-level click listener: this same click
      // handler already replaces tbody.innerHTML in response to the click
      // that opened a roster panel, which detaches the original
      // event.target from the document *during* the same bubble phase --
      // a delegated listener up at document level would see a
      // closest()-from-a-detached-node lookup fail every time. Calling it
      // straight from draw() sidesteps that race entirely.
      addShareButtons();
    }

    headers.forEach((th) => {
      const activate = () => {
        if (sortKey === th.dataset.sort) sortAsc = !sortAsc;
        else { sortKey = th.dataset.sort; sortAsc = true; }
        draw();
      };
      th.addEventListener("click", activate);
      th.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); }
      });
    });

    tbody.addEventListener("click", (event) => {
      if (event.target.closest("[data-pw-show-honorable]")) { showHonorable = true; draw(); return; }
      if (event.target.closest("[data-pw-hide-honorable]")) { showHonorable = false; openTeam = null; draw(); return; }
      const row = event.target.closest(".pw-team-row");
      if (row) {
        openTeam = openTeam === row.dataset.team ? null : row.dataset.team;
        draw();
      }
    });
    tbody.addEventListener("keydown", (event) => {
      const row = event.target.closest(".pw-team-row");
      if (row && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        openTeam = openTeam === row.dataset.team ? null : row.dataset.team;
        draw();
      }
    });

    draw();
  }

  // ---------------------------------------------------------------------
  // How the Race Was Won (score progression)
  // ---------------------------------------------------------------------
  function renderScoreProgression(container) {
    const allProgress = classification.scoreProgression || [];
    let visibleCount = Math.min(5, allProgress.length);
    let scorerIndex = 5; // 1-5, defaults to the final/full picture

    const palette = [classification.accent, "#1d3557", "#8a5a00", "#555555", "#00838f"];

    container.innerHTML = `
      <div class="pw-chart-controls">
        <div class="pw-chart-toggle" role="group" aria-label="Number of teams shown">
          <button type="button" data-count="3">Top 3</button>
          <button type="button" data-count="5">Top 5</button>
        </div>
        <label class="pw-scorer-slider">Scorer <input type="range" min="1" max="5" step="1" value="5" data-pw-scorer><span data-pw-scorer-label>5 (final)</span></label>
      </div>
      <div class="pw-chart-wrap" data-pw-chart-wrap></div>
      <div class="pw-chart-legend" data-pw-legend></div>
      <p class="pw-chart-leader" data-pw-leader></p>`;

    const chartWrap = container.querySelector("[data-pw-chart-wrap]");
    const legend = container.querySelector("[data-pw-legend]");
    const leaderNote = container.querySelector("[data-pw-leader]");
    const slider = container.querySelector("[data-pw-scorer]");
    const scorerLabel = container.querySelector("[data-pw-scorer-label]");
    const toggleButtons = container.querySelectorAll(".pw-chart-toggle button");

    function drawChart() {
      const teams = allProgress.slice(0, visibleCount);
      const width = 640;
      const height = 260;
      const padding = { top: 16, right: 16, bottom: 26, left: 44 };
      const maxScore = Math.max(...teams.map((t) => t.cumulativeScores[scorerIndex - 1]));
      const plotW = width - padding.left - padding.right;
      const plotH = height - padding.top - padding.bottom;

      function xFor(i) { return padding.left + (plotW * i) / 4; }
      function yFor(v) { return padding.top + plotH - (plotH * v) / (maxScore || 1); }

      const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = padding.top + plotH * (1 - f);
        return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e6e6e6" stroke-width="1"></line><text x="${padding.left - 8}" y="${y + 4}" font-size="10" fill="#767676" text-anchor="end">${Math.round(maxScore * f)}</text>`;
      }).join("");

      const xLabels = ["1", "2", "3", "4", "5"].map((label, i) => `<text x="${xFor(i)}" y="${height - 6}" font-size="10" fill="#767676" text-anchor="middle">Scorer ${label}</text>`).join("");

      const paths = teams.map((team, teamIndex) => {
        const color = palette[teamIndex % palette.length];
        const points = team.cumulativeScores.slice(0, scorerIndex).map((value, i) => [xFor(i), yFor(value)]);
        const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
        const dots = points.map((p, i) => `<circle class="pw-chart-dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === points.length - 1 ? 5 : 3}" fill="${color}"></circle>`).join("");
        return `<path class="pw-chart-line" d="${d}" stroke="${color}"></path>${dots}`;
      }).join("");

      chartWrap.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Cumulative score by scorer for the top ${teams.length} teams, through scorer ${scorerIndex}">${gridLines}${xLabels}${paths}</svg>`;

      legend.innerHTML = teams.map((team, i) => `<span><i style="background:${palette[i % palette.length]}"></i>${esc(team.team)} &mdash; ${team.cumulativeScores[scorerIndex - 1]}</span>`).join("");

      const leader = teams.reduce((best, team) => (team.cumulativeScores[scorerIndex - 1] < best.cumulativeScores[scorerIndex - 1] ? team : best), teams[0]);
      leaderNote.textContent = scorerIndex < 5
        ? `After scorer ${scorerIndex}, ${leader.team} leads at ${leader.cumulativeScores[scorerIndex - 1]}.`
        : `Final: ${leader.team} wins the group shown at ${leader.cumulativeScores[4]} points.`;
    }

    function setCount(count) {
      visibleCount = count;
      toggleButtons.forEach((button) => button.classList.toggle("active", Number(button.dataset.count) === count));
      drawChart();
    }

    toggleButtons.forEach((button) => button.addEventListener("click", () => setCount(Number(button.dataset.count))));
    slider.addEventListener("input", () => {
      scorerIndex = Number(slider.value);
      scorerLabel.textContent = scorerIndex === 5 ? "5 (final)" : String(scorerIndex);
      drawChart();
    });

    setCount(5);
  }

  // ---------------------------------------------------------------------
  // Fifth Runner Factor
  // ---------------------------------------------------------------------
  function renderFifthRunnerFactor(container) {
    const cards = classification.fifthRunnerFactor || [];
    let compareA = cards[0]?.team || "";
    let compareB = cards[1]?.team || "";

    container.innerHTML = `
      <div class="pw-fifthrunner-grid">
        ${cards.map((card) => `
          <article class="pw-fifthrunner-card">
            <h4>${esc(card.team)}</h4>
            <dl>
              <dt>5th returner</dt><dd>${esc(card.athlete)}</dd>
              <dt>2025 5K</dt><dd>${esc(card.time)}</dd>
              <dt>4th place</dt><dd>${ordinal(card.fourthScorerPlace)}</dd>
              <dt>5th place</dt><dd>${ordinal(card.fifthScorerPlace)}</dd>
              <dt>Place gap ${tip("place gap", "The place gap is the difference between a team's fourth and fifth scoring places. A smaller gap usually means a steadier, more complete lineup -- a larger gap is simply where the clearest room to improve sits, not a knock on the runner.")}</dt><dd>${card.placeGap}</dd>
            </dl>
            <label><input type="radio" name="pw-compare-a" value="${esc(card.team)}" ${compareA === card.team ? "checked" : ""} data-pw-compare-a> Compare A</label>
            <label><input type="radio" name="pw-compare-b" value="${esc(card.team)}" ${compareB === card.team ? "checked" : ""} data-pw-compare-b> Compare B</label>
          </article>`).join("")}
      </div>
      <div class="pw-compare-panel" data-pw-fifth-compare-panel></div>`;

    const panel = container.querySelector("[data-pw-fifth-compare-panel]");

    function drawCompare() {
      const a = cards.find((c) => c.team === compareA);
      const b = cards.find((c) => c.team === compareB);
      if (!a || !b || a.team === b.team) {
        panel.removeAttribute("data-open");
        panel.innerHTML = "";
        return;
      }
      panel.setAttribute("data-open", "true");
      panel.innerHTML = `<p class="pw-eyebrow">${esc(a.team)} vs ${esc(b.team)}</p>
        <table class="pw-compare-table"><tbody>
          <tr><th></th><th>${esc(a.team)}</th><th>${esc(b.team)}</th></tr>
          <tr><td>5th returner</td><td>${esc(a.athlete)}</td><td>${esc(b.athlete)}</td></tr>
          <tr><td>2025 5K</td><td>${esc(a.time)}</td><td>${esc(b.time)}</td></tr>
          <tr><td>4th place</td><td>${ordinal(a.fourthScorerPlace)}</td><td>${ordinal(b.fourthScorerPlace)}</td></tr>
          <tr><td>5th place</td><td>${ordinal(a.fifthScorerPlace)}</td><td>${ordinal(b.fifthScorerPlace)}</td></tr>
          <tr><td>Place gap</td><td>${a.placeGap}</td><td>${b.placeGap}</td></tr>
        </tbody></table>`;
    }

    container.querySelectorAll("[data-pw-compare-a]").forEach((input) => input.addEventListener("change", () => { compareA = input.value; drawCompare(); }));
    container.querySelectorAll("[data-pw-compare-b]").forEach((input) => input.addEventListener("change", () => { compareB = input.value; drawCompare(); }));

    drawCompare();
  }

  // ---------------------------------------------------------------------
  // Displacement Report
  // ---------------------------------------------------------------------
  function renderDisplacementReport(container) {
    const rows = classification.displacementReport || [];
    const tiebreaks = classification.tiebreaks || [];
    let mode = "sixth";

    function tiebreakFor(team) {
      return tiebreaks.find((tb) => tb.order.some((entry) => entry.team === team));
    }

    container.innerHTML = `
      <p class="pw-raceboard-hint">Sixth and seventh runners do not score, but they can displace an opponent's scorer and decide a shared score ${tip("displacement", "A sixth or seventh runner does not score for their own team, but if they finish ahead of an opposing team's scorer, that opponent's scoring place moves back one spot -- this is what ‘displacement’ means.")}. A red "Tiebreak" badge marks a team involved in one ${tip("tiebreak", "When two teams finish with the exact same simulated score, the tie is broken by whichever team's sixth runner finished ahead. If the sixth runners are also tied, the seventh runner decides it.")} -- tap it to see the exact decision.</p>
      <div class="pw-displacement-toggle" role="group" aria-label="Show sixth or seventh runners">
        <button type="button" class="active" data-mode="sixth">Sixth runners</button>
        <button type="button" data-mode="seventh">Seventh runners</button>
      </div>
      <div class="table-scroll" tabindex="0" aria-label="Displacement report"><table><thead><tr><th>Team</th><th>Runner</th><th>Place</th><th></th></tr></thead><tbody data-pw-displacement-body></tbody></table></div>`;

    const tbody = container.querySelector("[data-pw-displacement-body]");
    const buttons = container.querySelectorAll(".pw-displacement-toggle button");

    function draw() {
      tbody.innerHTML = rows.map((row) => {
        const runner = mode === "sixth" ? row.sixthRunner : row.seventhRunner;
        const place = mode === "sixth" ? row.sixthPlace : row.seventhPlace;
        const tb = tiebreakFor(row.team);
        const badge = tb ? `<button type="button" class="pw-tiebreak-badge" data-team="${esc(row.team)}" data-score="${tb.score}">Tiebreak</button>` : "";
        const rowsHtml = [`<tr><td data-label="Team">${esc(row.team)}</td><td data-label="Runner">${esc(runner)}</td><td data-label="Place">${ordinal(place)}</td><td>${badge}</td></tr>`];
        if (tb) {
          rowsHtml.push(`<tr class="pw-tiebreak-row" data-tiebreak-for="${esc(row.team)}" hidden><td colspan="4"><div class="pw-tiebreak-detail">
            <p class="pw-eyebrow">Tiebreak at ${tb.score} points</p>
            <p>${tb.order.map((entry) => `No. ${entry.rank} ${esc(entry.team)} (6th: ${ordinal(entry.sixthPlace)}, 7th: ${ordinal(entry.seventhPlace)})`).join(" is ranked ahead of ")}.</p>
          </div></td></tr>`);
        }
        return rowsHtml.join("");
      }).join("");
    }

    buttons.forEach((button) => button.addEventListener("click", () => {
      mode = button.dataset.mode;
      buttons.forEach((b) => b.classList.toggle("active", b === button));
      draw();
    }));

    tbody.addEventListener("click", (event) => {
      const badge = event.target.closest("[data-team]");
      if (!badge) return;
      const detailRow = tbody.querySelector(`[data-tiebreak-for="${CSS.escape(badge.dataset.team)}"]`);
      if (detailRow) detailRow.hidden = !detailRow.hidden;
    });

    draw();
  }

  // ---------------------------------------------------------------------
  // Reader Predictions (real, server-backed polls)
  // ---------------------------------------------------------------------
  function getVoterToken() {
    const key = "pw-voter-token";
    let token = window.localStorage ? window.localStorage.getItem(key) : null;
    if (!token) {
      token = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (window.localStorage) window.localStorage.setItem(key, token);
    }
    return token;
  }

  async function postJson(url, body) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }

  function renderReaderPredictions(container) {
    const polls = classification.polls || [];
    const voterToken = getVoterToken();

    container.innerHTML = `<div class="pw-predictions-grid" data-pw-polls></div>`;
    const grid = container.querySelector("[data-pw-polls]");

    function pollHtml(poll) {
      return `<article class="pw-poll" data-poll-id="${esc(poll.id)}">
        <h4>${esc(poll.question)}</h4>
        <div class="pw-poll-options" data-pw-poll-options>${poll.options.map((option) => `<button type="button" class="pw-poll-option" data-option-id="${esc(option.id)}"><span class="pw-poll-option-label"><strong>${esc(option.label)}</strong>${option.context ? `<small>${esc(option.context)}</small>` : ""}</span></button>`).join("")}</div>
        <p class="pw-poll-status" data-pw-poll-status>Loading results&hellip;</p>
      </article>`;
    }

    grid.innerHTML = polls.map(pollHtml).join("");

    function paintResults(pollEl, pollResult) {
      const optionsWrap = pollEl.querySelector("[data-pw-poll-options]");
      const status = pollEl.querySelector("[data-pw-poll-status]");
      optionsWrap.innerHTML = pollResult.options.map((option) => `
        <button type="button" class="pw-poll-option" data-option-id="${esc(option.id)}" data-mine="${option.id === pollResult.myOptionId}" disabled>
          <span class="pw-poll-option-label"><strong>${esc(option.label)}${option.id === pollResult.myOptionId ? " (your pick)" : ""}</strong>${option.context ? `<small>${esc(option.context)}</small>` : ""}<span class="pw-poll-bar-track"><span class="pw-poll-bar-fill" style="width:${option.percent}%"></span></span></span>
          <span>${option.percent}%<br><small>${option.votes} vote${option.votes === 1 ? "" : "s"}</small></span>
        </button>`).join("");
      status.textContent = pollResult.hasVoted
        ? `${pollResult.totalVotes} vote${pollResult.totalVotes === 1 ? "" : "s"} so far. Thanks for voting.`
        : `${pollResult.totalVotes} vote${pollResult.totalVotes === 1 ? "" : "s"} so far.`;
    }

    async function castVote(pollEl, pollId, optionId) {
      const status = pollEl.querySelector("[data-pw-poll-status]");
      status.textContent = "Recording your vote…";
      try {
        const result = await postJson("/api/article-polls/vote", {
          article_slug: articleSlug,
          poll_id: pollId,
          option_id: optionId,
          voter_token: voterToken
        });
        paintResults(pollEl, result.poll);
      } catch (err) {
        status.textContent = "";
        const errorEl = document.createElement("p");
        errorEl.className = "pw-poll-error";
        errorEl.textContent = err.message || "Your vote could not be recorded. Please try again.";
        pollEl.appendChild(errorEl);
      }
    }

    grid.addEventListener("click", (event) => {
      const optionButton = event.target.closest(".pw-poll-option:not([disabled])");
      if (!optionButton) return;
      const pollEl = optionButton.closest(".pw-poll");
      castVote(pollEl, pollEl.dataset.pollId, optionButton.dataset.optionId);
    });

    // Initial load: real current results for every poll, and (via the
    // browser's own hashed token) whether this reader already voted.
    postJson("/api/article-polls/results", { article_slug: articleSlug, voter_token: voterToken })
      .then((data) => {
        (data.polls || []).forEach((pollResult) => {
          const pollEl = grid.querySelector(`[data-poll-id="${CSS.escape(pollResult.pollId)}"]`);
          if (!pollEl) return;
          if (pollResult.hasVoted || pollResult.totalVotes > 0) {
            paintResults(pollEl, pollResult);
          } else {
            pollEl.querySelector("[data-pw-poll-status]").textContent = "Be the first to vote.";
          }
        });
      })
      .catch(() => {
        grid.querySelectorAll("[data-pw-poll-status]").forEach((el) => { el.textContent = "Vote below — live totals will appear after you do."; });
      });
  }

  // ---------------------------------------------------------------------
  // Mount the 5 required components into their marker divs
  // ---------------------------------------------------------------------
  const mountFns = {
    RACE_BOARD: renderRaceBoard,
    SCORE_PROGRESSION: renderScoreProgression,
    FIFTH_RUNNER_FACTOR: renderFifthRunnerFactor,
    DISPLACEMENT_REPORT: renderDisplacementReport,
    READER_PREDICTIONS: renderReaderPredictions
  };

  document.querySelectorAll("[data-pw-component]").forEach((el) => {
    const type = el.getAttribute("data-pw-component");
    const fn = mountFns[type];
    if (fn) {
      try { fn(el); } catch (err) { console.error(`Podium Watch: ${type} component failed to render.`, err); }
    }
  });

  // ---------------------------------------------------------------------
  // Team Compare drawer (any 2 Race Board teams)
  // ---------------------------------------------------------------------
  function buildCompareDrawer() {
    const backdrop = document.createElement("div");
    backdrop.className = "pw-compare-backdrop";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "pw-compare-trigger";
    trigger.textContent = "Compare Teams";

    const drawer = document.createElement("div");
    drawer.className = "pw-compare-drawer";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.setAttribute("aria-label", "Compare two teams");

    const teamOptions = raceBoard
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map((row) => `<option value="${esc(row.team)}">${row.rank}. ${esc(row.team)}</option>`)
      .join("");

    drawer.innerHTML = `
      <div class="pw-compare-drawer-head"><h3>Team Compare</h3><button type="button" class="button button-outline" data-pw-compare-close>Close</button></div>
      <div class="pw-compare-drawer-body">
        <div class="pw-compare-select-row">
          <label>Team A<select data-pw-compare-select-a>${teamOptions}</select></label>
          <label>Team B<select data-pw-compare-select-b>${teamOptions}</select></label>
        </div>
        <div data-pw-compare-table></div>
      </div>`;

    document.body.appendChild(backdrop);
    document.body.appendChild(trigger);
    document.body.appendChild(drawer);

    const selectA = drawer.querySelector("[data-pw-compare-select-a]");
    const selectB = drawer.querySelector("[data-pw-compare-select-b]");
    const tableWrap = drawer.querySelector("[data-pw-compare-table]");
    selectA.value = raceBoard[0]?.team || "";
    selectB.value = raceBoard[1]?.team || "";

    function draw() {
      const a = teamsById.get(selectA.value);
      const b = teamsById.get(selectB.value);
      if (!a || !b) { tableWrap.innerHTML = ""; return; }
      const row = (label, get) => `<tr><td>${label}</td><td>${get(a)}</td><td>${get(b)}</td></tr>`;
      tableWrap.innerHTML = `<table class="pw-compare-table"><tbody>
        <tr><th></th><th>${esc(a.team)}</th><th>${esc(b.team)}</th></tr>
        ${row("Rank", (t) => t.rank)}
        ${row("Score", (t) => t.score)}
        ${row("5K avg", (t) => esc(t.fiveRunnerAverageDisplay))}
        ${row("Spread", (t) => `${t.spreadSeconds.toFixed(2)}s`)}
        ${row("Scoring 1-5", (t) => t.scorerPlaces.map(ordinal).join(", "))}
        ${row("6th", (t) => ordinal(t.sixthPlace))}
        ${row("7th", (t) => ordinal(t.seventhPlace))}
      </tbody></table>`;
    }

    selectA.addEventListener("change", draw);
    selectB.addEventListener("change", draw);
    draw();

    function open() {
      drawer.setAttribute("data-open", "true");
      backdrop.setAttribute("data-open", "true");
      drawer.querySelector("select").focus();
    }
    function close() {
      drawer.removeAttribute("data-open");
      backdrop.removeAttribute("data-open");
      trigger.focus();
    }

    trigger.addEventListener("click", open);
    backdrop.addEventListener("click", close);
    drawer.querySelector("[data-pw-compare-close]").addEventListener("click", close);
    drawer.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
  }

  buildCompareDrawer();

  // ---------------------------------------------------------------------
  // Share This Team: a downloadable image card (canvas, no dependency)
  // ---------------------------------------------------------------------
  function drawShareCard(row) {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#090909";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = classification.accent;
    ctx.fillRect(0, 0, canvas.width, 14);

    ctx.fillStyle = "#9a9a9a";
    ctx.font = "700 26px Arial";
    ctx.fillText("PODIUM WATCH · 2026 PRESEASON", 60, 90);

    ctx.fillStyle = classification.accent;
    ctx.font = "900 46px Arial";
    ctx.fillText(classification.classification.toUpperCase() + " TEAM POWER RANKINGS", 60, 140);

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 96px Arial";
    ctx.fillText(`No. ${row.rank}`, 60, 280);

    ctx.font = "900 64px Arial";
    ctx.fillText(row.team, 60, 360);

    ctx.font = "600 30px Arial";
    ctx.fillStyle = "#d8d8d8";
    ctx.fillText(`Simulated score: ${row.score}`, 60, 430);
    ctx.fillText(`5-runner average: ${row.fiveRunnerAverageDisplay}`, 60, 475);
    ctx.fillText(`Spread: ${row.spreadSeconds.toFixed(2)}s`, 60, 520);

    ctx.fillStyle = "#6b6b6b";
    ctx.font = "500 22px Arial";
    ctx.fillText("podiumwatch.com · Ohio high school cross country", 60, 590);

    return canvas;
  }

  function addShareButtons() {
    document.querySelectorAll("table.pw-raceboard-table tbody tr.pw-roster-row .pw-roster-panel").forEach((panel) => {
      if (panel.querySelector("[data-pw-share]")) return;
      const teamName = panel.querySelector(".pw-eyebrow")?.textContent.replace(" returning lineup", "");
      const row = teamsById.get(teamName);
      if (!row) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pw-share-button";
      button.dataset.pwShare = "true";
      button.textContent = `Share ${row.team}'s card`;
      button.addEventListener("click", () => {
        const canvas = drawShareCard(row);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `podium-watch-${articleSlug}-${row.team.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
        }, "image/png");
      });
      panel.appendChild(button);
    });
  }
})();
