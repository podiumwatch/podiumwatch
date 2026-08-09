(() => {
  const configEl = document.querySelector("[data-fan-poll-config]");

  const weekStatus = document.querySelector("[data-fan-poll-week-status]");
  const resultsEmpty = document.querySelector("[data-fan-poll-results-empty]");
  const resultsTable = document.querySelector("[data-fan-poll-results-table]");
  const resultsBody = document.querySelector("[data-fan-poll-results-body]");

  const votingClosed = document.querySelector("[data-fan-poll-voting-closed]");
  const ballotFormWrap = document.querySelector("[data-fan-poll-ballot-form-wrap]");
  const teamSearch = document.querySelector("[data-fan-poll-team-search]");
  const teamList = document.querySelector("[data-fan-poll-team-list]");
  const ballotList = document.querySelector("[data-fan-poll-ballot-list]");
  const ballotCount = document.querySelector("[data-fan-poll-ballot-count]");
  const ballotForm = document.querySelector("[data-fan-poll-ballot-form]");
  const formMessage = document.querySelector("[data-fan-poll-form-message]");
  const submitButton = document.querySelector("[data-fan-poll-submit]");

  if (
    !configEl || !weekStatus || !resultsEmpty || !resultsTable || !resultsBody ||
    !votingClosed || !ballotFormWrap || !teamSearch || !teamList || !ballotList ||
    !ballotCount || !ballotForm || !formMessage || !submitButton
  ) {
    return;
  }

  const config = JSON.parse(configEl.textContent || "{}");
  const BALLOT_SIZE = 16;

  let eligibleTeams = [];
  let currentWeek = null;
  /** @type {{id:string, school_name:string}[]} */
  let ballot = [];

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function movementLabel(movement) {
    if (movement === null) return { text: "—", className: "fan-poll-movement-flat" };
    if (movement === "new") return { text: "New", className: "fan-poll-movement-new" };
    if (movement > 0) return { text: `↑ ${movement}`, className: "fan-poll-movement-up" };
    if (movement < 0) return { text: `↓ ${Math.abs(movement)}`, className: "fan-poll-movement-down" };
    return { text: "—", className: "fan-poll-movement-flat" };
  }

  function renderResults(data) {
    currentWeek = data.week;

    if (!data.week) {
      weekStatus.textContent = "No fan poll has been scheduled for this division yet.";
      votingClosed.hidden = false;
      ballotFormWrap.hidden = true;
      return;
    }

    const opens = new Date(data.week.voting_opens);
    const closes = new Date(data.week.voting_closes);
    const statusText = data.week.status === "voting_open"
      ? `Voting is open through ${closes.toLocaleString()}.`
      : data.week.status === "scheduled"
        ? `Voting opens ${opens.toLocaleString()}.`
        : `Voting closed ${closes.toLocaleString()}.`;

    weekStatus.textContent = statusText;

    const votingIsOpen = data.week.status === "voting_open";
    votingClosed.hidden = votingIsOpen;
    ballotFormWrap.hidden = !votingIsOpen;

    if (!data.results.length) {
      resultsEmpty.hidden = false;
      resultsTable.hidden = true;
      return;
    }

    resultsEmpty.hidden = true;
    resultsTable.hidden = false;

    resultsBody.innerHTML = data.results.map((row) => {
      const movement = movementLabel(row.movement);
      const teamName = row.team ? escapeHtml(row.team.school_name) : "Unknown team";
      const teamLink = row.team ? `<a href="/team/?slug=${encodeURIComponent(row.team.slug)}">${teamName}</a>` : teamName;

      return `<tr>
        <td>${row.rank}</td>
        <td>${teamLink}</td>
        <td>${row.points}</td>
        <td>${row.ballot_count}</td>
        <td class="${movement.className}">${movement.text}</td>
      </tr>`;
    }).join("");
  }

  function isOnBallot(teamId) {
    return ballot.some((team) => team.id === teamId);
  }

  function renderTeamList() {
    const query = teamSearch.value.trim().toLowerCase();
    const filtered = eligibleTeams.filter((team) =>
      !query || team.school_name.toLowerCase().includes(query)
    );

    if (!filtered.length) {
      teamList.innerHTML = `<li class="fan-poll-team-row">No matching teams.</li>`;
      return;
    }

    teamList.innerHTML = filtered.map((team) => {
      const already = isOnBallot(team.id);
      const disabled = already || ballot.length >= BALLOT_SIZE;

      return `<li class="fan-poll-team-row">
        <span>${escapeHtml(team.school_name)}</span>
        <button type="button" class="button button-outline" data-add-team="${escapeHtml(team.id)}" ${disabled ? "disabled" : ""}>${already ? "Added" : "Add"}</button>
      </li>`;
    }).join("");
  }

  function renderBallot() {
    ballotCount.textContent = String(ballot.length);
    ballotCount.classList.toggle("fan-poll-ballot-count-ready", ballot.length === BALLOT_SIZE);

    if (!ballot.length) {
      ballotList.innerHTML = `<li class="fan-poll-ballot-row">Add teams from the left to build your ballot.</li>`;
    } else {
      ballotList.innerHTML = ballot.map((team, index) => `<li class="fan-poll-ballot-row">
        <span class="fan-poll-ballot-rank">${index + 1}</span>
        <span style="flex:1;">${escapeHtml(team.school_name)}</span>
        <span class="fan-poll-ballot-row-controls">
          <button type="button" data-move-up="${index}" ${index === 0 ? "disabled" : ""} aria-label="Move up">↑</button>
          <button type="button" data-move-down="${index}" ${index === ballot.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button>
          <button type="button" data-remove="${index}" aria-label="Remove">✕</button>
        </span>
      </li>`).join("");
    }

    const ready = ballot.length === BALLOT_SIZE;
    submitButton.disabled = !ready;
    submitButton.textContent = ready
      ? "Submit ballot"
      : `Submit ballot (${ballot.length} of ${BALLOT_SIZE} selected)`;

    renderTeamList();
  }

  teamList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-team]");
    if (!button || button.disabled) return;

    const teamId = button.dataset.addTeam;
    const team = eligibleTeams.find((item) => item.id === teamId);
    if (!team || isOnBallot(teamId) || ballot.length >= BALLOT_SIZE) return;

    ballot.push(team);
    renderBallot();
  });

  ballotList.addEventListener("click", (event) => {
    const upButton = event.target.closest("[data-move-up]");
    const downButton = event.target.closest("[data-move-down]");
    const removeButton = event.target.closest("[data-remove]");

    if (upButton) {
      const index = Number(upButton.dataset.moveUp);
      if (index > 0) {
        [ballot[index - 1], ballot[index]] = [ballot[index], ballot[index - 1]];
        renderBallot();
      }
    } else if (downButton) {
      const index = Number(downButton.dataset.moveDown);
      if (index < ballot.length - 1) {
        [ballot[index + 1], ballot[index]] = [ballot[index], ballot[index + 1]];
        renderBallot();
      }
    } else if (removeButton) {
      const index = Number(removeButton.dataset.remove);
      ballot.splice(index, 1);
      renderBallot();
    }
  });

  teamSearch.addEventListener("input", renderTeamList);

  ballotForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (ballot.length !== BALLOT_SIZE || !currentWeek) {
      return;
    }

    const formData = new FormData(ballotForm);
    submitButton.disabled = true;
    formMessage.textContent = "Submitting your ballot...";

    try {
      const response = await fetch("/api/fan-poll/ballot/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website: formData.get("website"),
          week_id: currentWeek.id,
          email: formData.get("email"),
          wants_results_email: formData.get("wants_results_email") === "on",
          entries: ballot.map((team, index) => ({
            team_id: team.id,
            rank_position: index + 1
          }))
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Your ballot could not be submitted.");
      }

      formMessage.textContent = data.message || "Your ballot has been recorded. Thanks for voting!";
      ballot = [];
      ballotForm.reset();
      renderBallot();
    } catch (error) {
      formMessage.textContent = error.message;
    } finally {
      submitButton.disabled = ballot.length !== BALLOT_SIZE;
    }
  });

  async function load() {
    try {
      const response = await fetch("/api/fan-poll/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "The fan poll could not be loaded.");
      }

      eligibleTeams = data.eligible_teams || [];
      renderResults(data);
      renderBallot();
    } catch (error) {
      weekStatus.textContent = error.message;
      ballotFormWrap.hidden = true;
    }
  }

  load();
})();
