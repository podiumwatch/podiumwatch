const VOTE_COOLDOWN_SECONDS = 45;
const VOTER_TOKEN_STORAGE_KEY =
  "podiumWatchTotwVoterToken";

const weekStatusCard = document.querySelector(
  "#week-status-card"
);

const winnerSection = document.querySelector(
  "#winner-section"
);

const boysCurrentWinner = document.querySelector(
  "#boys-current-winner"
);

const girlsCurrentWinner = document.querySelector(
  "#girls-current-winner"
);

const nominationSection = document.querySelector(
  "#nomination-section"
);

const nominationForm = document.querySelector(
  "#nomination-form"
);

const nominationSubmitButton = document.querySelector(
  "#nomination-submit-button"
);

const nominationMessage = document.querySelector(
  "#nomination-message"
);

const votingSection = document.querySelector(
  "#voting-section"
);

const votingMessage = document.querySelector(
  "#voting-message"
);

const boysFinalistGrid = document.querySelector(
  "#boys-finalist-grid"
);

const girlsFinalistGrid = document.querySelector(
  "#girls-finalist-grid"
);

const closedSection = document.querySelector(
  "#closed-section"
);

const closedHeading = document.querySelector(
  "#closed-heading"
);

const closedMessage = document.querySelector(
  "#closed-message"
);

const winnerArchive = document.querySelector(
  "#winner-archive"
);

let activeVotingWeekId = "";
let memoryVoterToken = "";

const voteState = {
  boys: {
    cooldownUntil: 0,
    timer: null,
    requestInProgress: false
  },

  girls: {
    cooldownUntil: 0,
    timer: null,
    requestInProgress: false
  }
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/New_York"
  }).format(date);
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York"
  }).format(date);
}

function showElement(element) {
  element?.classList.remove("hidden");
}

function hideElement(element) {
  element?.classList.add("hidden");
}

function resetSections() {
  hideElement(winnerSection);
  hideElement(nominationSection);
  hideElement(votingSection);
  hideElement(closedSection);
}

function setMessage(element, message, type = "") {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.className = "form-message";

  if (type) {
    element.classList.add(type);
  }
}

function categoryLabel(category) {
  return category === "girls" ? "girls" : "boys";
}

function categoryTitle(category) {
  return category === "girls"
    ? "Girls Team of the Week"
    : "Boys Team of the Week";
}

function categoryGrid(category) {
  return category === "girls"
    ? girlsFinalistGrid
    : boysFinalistGrid;
}

function createRandomVoterToken() {
  if (
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `pw_totw_${globalThis.crypto.randomUUID()}`;
  }

  if (
    globalThis.crypto &&
    typeof globalThis.crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(24);

    globalThis.crypto.getRandomValues(bytes);

    const randomText = Array.from(
      bytes,
      (byte) => byte.toString(16).padStart(2, "0")
    ).join("");

    return `pw_totw_${randomText}`;
  }

  return `pw_totw_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}_${Math.random()
    .toString(36)
    .slice(2)}`;
}

function voterTokenIsValid(value) {
  return (
    typeof value === "string" &&
    value.length >= 20 &&
    value.length <= 200 &&
    /^[a-zA-Z0-9._-]+$/.test(value)
  );
}

function getVoterToken() {
  try {
    const storedToken = localStorage.getItem(
      VOTER_TOKEN_STORAGE_KEY
    );

    if (voterTokenIsValid(storedToken)) {
      return storedToken;
    }

    const newToken = createRandomVoterToken();

    localStorage.setItem(
      VOTER_TOKEN_STORAGE_KEY,
      newToken
    );

    return newToken;
  } catch {
    if (!voterTokenIsValid(memoryVoterToken)) {
      memoryVoterToken = createRandomVoterToken();
    }

    return memoryVoterToken;
  }
}

function getCooldownStorageKey(category) {
  const weekKey = activeVotingWeekId || "current";

  return (
    `podiumWatchTotwCooldownUntil:` +
    `${weekKey}:${category}`
  );
}

function readStoredCooldownUntil(category) {
  try {
    const storedValue = Number(
      localStorage.getItem(
        getCooldownStorageKey(category)
      )
    );

    if (
      Number.isFinite(storedValue) &&
      storedValue > Date.now()
    ) {
      return storedValue;
    }
  } catch {
    return 0;
  }

  return 0;
}

function saveCooldownUntil(category, value) {
  try {
    const storageKey =
      getCooldownStorageKey(category);

    if (value > Date.now()) {
      localStorage.setItem(
        storageKey,
        String(value)
      );
    } else {
      localStorage.removeItem(storageKey);
    }
  } catch {
    /*
      The server still enforces the cooldown when
      browser storage is unavailable.
    */
  }
}

function getRemainingCooldownSeconds(category) {
  const state = voteState[category];

  if (!state) {
    return 0;
  }

  return Math.max(
    0,
    Math.ceil(
      (state.cooldownUntil - Date.now()) / 1000
    )
  );
}

function updateCategoryVoteButtons(category) {
  const grid = categoryGrid(category);
  const state = voteState[category];

  if (!grid || !state) {
    return;
  }

  const remainingSeconds =
    getRemainingCooldownSeconds(category);

  grid
    .querySelectorAll(".vote-button")
    .forEach((button) => {
      const teamName =
        button.dataset.teamName || "team";

      if (state.requestInProgress) {
        button.disabled = true;
        button.textContent = "Recording vote...";
        return;
      }

      if (remainingSeconds > 0) {
        button.disabled = true;
        button.textContent =
          `Vote again in ${remainingSeconds}s`;
        return;
      }

      button.disabled = false;
      button.textContent =
        `Vote for ${teamName}`;
    });

  if (
    remainingSeconds <= 0 &&
    state.timer
  ) {
    clearInterval(state.timer);
    state.timer = null;
    state.cooldownUntil = 0;

    saveCooldownUntil(category, 0);
  }
}

function ensureCategoryCooldownTimer(category) {
  const state = voteState[category];

  if (!state) {
    return;
  }

  if (
    getRemainingCooldownSeconds(category) <= 0
  ) {
    updateCategoryVoteButtons(category);
    return;
  }

  updateCategoryVoteButtons(category);

  if (state.timer) {
    return;
  }

  state.timer = window.setInterval(() => {
    updateCategoryVoteButtons(category);
  }, 250);
}

function startCategoryCooldown(
  category,
  seconds
) {
  const state = voteState[category];

  if (!state) {
    return;
  }

  const safeSeconds = Math.max(
    1,
    Math.ceil(
      Number(seconds) ||
        VOTE_COOLDOWN_SECONDS
    )
  );

  state.cooldownUntil =
    Date.now() + safeSeconds * 1000;

  saveCooldownUntil(
    category,
    state.cooldownUntil
  );

  ensureCategoryCooldownTimer(category);
}

function restoreCategoryCooldown(category) {
  const state = voteState[category];

  if (!state) {
    return;
  }

  state.cooldownUntil =
    readStoredCooldownUntil(category);

  if (state.cooldownUntil > Date.now()) {
    ensureCategoryCooldownTimer(category);
  } else {
    state.cooldownUntil = 0;
    saveCooldownUntil(category, 0);
    updateCategoryVoteButtons(category);
  }
}

function clearCooldownTimers() {
  for (const category of ["boys", "girls"]) {
    const state = voteState[category];

    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }

    state.cooldownUntil = 0;
    state.requestInProgress = false;
  }
}

function renderStatusCard(week) {
  if (!week) {
    weekStatusCard.innerHTML = `
      <p class="status-label">
        Current status
      </p>

      <p class="status-title">
        No active week
      </p>

      <p class="status-details">
        The next Team of the Week period will be announced soon.
      </p>
    `;

    return;
  }

  const statusContent = {
    nominations_open: {
      title: "Nominations Open",
      details:
        `Nominations close ${formatDateTime(
          week.nomination_closes
        )}.`
    },

    nominations_closed: {
      title: "Selecting Finalists",
      details:
        "Nominations are closed. Podium Watch is reviewing the submissions."
    },

    voting_open: {
      title: "Voting Open",
      details:
        `Voting closes ${formatDateTime(
          week.voting_closes
        )}. You may vote once every ${VOTE_COOLDOWN_SECONDS} seconds in each category.`
    },

    voting_closed: {
      title: "Voting Closed",
      details:
        "Voting has ended. The boys and girls winners will be announced soon."
    },

    winner_announced: {
      title: "Winners Announced",
      details:
        "The newest Podium Watch Boys and Girls Teams of the Week have been selected."
    }
  };

  const content =
    statusContent[week.status] ?? {
      title: "Weekly Update",
      details:
        "Check back soon for the next Team of the Week update."
    };

  weekStatusCard.innerHTML = `
    <p class="status-label">
      Current status
    </p>

    <p class="status-title">
      ${escapeHtml(content.title)}
    </p>

    <p class="status-details">
      ${escapeHtml(content.details)}
    </p>
  `;
}

function renderWinnerCard(
  container,
  winner,
  category
) {
  if (!container) {
    return;
  }

  if (!winner) {
    container.innerHTML = `
      <div class="empty-state">
        The ${escapeHtml(
          categoryLabel(category)
        )} winner will be posted soon.
      </div>
    `;

    return;
  }

  const imageContent = winner.image_url
    ? `
      <img
        src="${escapeHtml(winner.image_url)}"
        alt="${escapeHtml(winner.team_name)}"
      >
    `
    : `
      <div class="winner-placeholder">
        PW
      </div>
    `;

  const divisionContent = winner.division
    ? ` · ${escapeHtml(winner.division)}`
    : "";

  container.innerHTML = `
    <article class="winner-card">
      <div class="winner-image">
        ${imageContent}
      </div>

      <div class="winner-copy">
        <p class="athlete-school">
          ${escapeHtml(winner.school)}
          ·
          ${escapeHtml(winner.sport)}
          ${divisionContent}
        </p>

        <h3>
          ${escapeHtml(winner.team_name)}
        </h3>

        <p class="achievement">
          ${escapeHtml(winner.achievement)}
        </p>

        <p class="description">
          ${escapeHtml(winner.description)}
        </p>
      </div>
    </article>
  `;
}

function renderWinners(
  boysWinner,
  girlsWinner
) {
  renderWinnerCard(
    boysCurrentWinner,
    boysWinner,
    "boys"
  );

  renderWinnerCard(
    girlsCurrentWinner,
    girlsWinner,
    "girls"
  );

  showElement(winnerSection);
}

function finalistCardMarkup(finalist) {
  const imageContent = finalist.image_url
    ? `
      <img
        src="${escapeHtml(finalist.image_url)}"
        alt="${escapeHtml(finalist.team_name)}"
      >
    `
    : `
      <div class="finalist-placeholder">
        PW
      </div>
    `;

  const divisionContent = finalist.division
    ? ` · ${escapeHtml(finalist.division)}`
    : "";

  return `
    <article class="finalist-card">
      <div class="finalist-image">
        ${imageContent}
      </div>

      <div class="finalist-content">
        <p class="finalist-school">
          ${escapeHtml(finalist.school)}
          ·
          ${escapeHtml(finalist.sport)}
          ${divisionContent}
        </p>

        <h3>
          ${escapeHtml(finalist.team_name)}
        </h3>

        <p class="finalist-achievement">
          ${escapeHtml(finalist.achievement)}
        </p>

        <p class="finalist-description">
          ${escapeHtml(finalist.description)}
        </p>

        <button
          class="vote-button"
          type="button"
          data-finalist-id="${escapeHtml(
            finalist.id
          )}"
          data-team-name="${escapeHtml(
            finalist.team_name
          )}"
          data-category="${escapeHtml(
            finalist.category
          )}"
        >
          Vote for ${escapeHtml(
            finalist.team_name
          )}
        </button>

        <p
          class="vote-confirmation"
          aria-live="polite"
        ></p>
      </div>
    </article>
  `;
}

function renderCategoryFinalists(
  category,
  finalists
) {
  const grid = categoryGrid(category);

  if (!grid) {
    return;
  }

  if (
    !Array.isArray(finalists) ||
    finalists.length === 0
  ) {
    grid.innerHTML = `
      <div class="empty-state">
        ${escapeHtml(
          categoryTitle(category)
        )} finalists will be posted soon.
      </div>
    `;

    return;
  }

  grid.innerHTML = finalists
    .map(finalistCardMarkup)
    .join("");

  grid
    .querySelectorAll(".vote-button")
    .forEach((button) => {
      button.addEventListener(
        "click",
        submitVote
      );
    });

  restoreCategoryCooldown(category);
}

function renderFinalists(
  boysFinalists,
  girlsFinalists
) {
  renderCategoryFinalists(
    "boys",
    boysFinalists
  );

  renderCategoryFinalists(
    "girls",
    girlsFinalists
  );
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function submitVote(event) {
  const button = event.currentTarget;

  const finalistId =
    button.dataset.finalistId;

  const teamName =
    button.dataset.teamName;

  const category =
    categoryLabel(button.dataset.category);

  const state = voteState[category];

  if (!state) {
    return;
  }

  if (state.requestInProgress) {
    return;
  }

  const remainingSeconds =
    getRemainingCooldownSeconds(category);

  if (remainingSeconds > 0) {
    setMessage(
      votingMessage,
      `Please wait ${remainingSeconds} seconds before voting for another ${category} team.`,
      "error"
    );

    ensureCategoryCooldownTimer(category);
    return;
  }

  const confirmation = button
    .closest(".finalist-content")
    ?.querySelector(".vote-confirmation");

  state.requestInProgress = true;
  updateCategoryVoteButtons(category);

  if (confirmation) {
    confirmation.textContent = "";
  }

  try {
    const response = await fetch(
      "/api/totw/vote",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          finalist_id: finalistId,
          voter_token: getVoterToken(),
          website: ""
        })
      }
    );

    const result =
      await readJsonResponse(response);

    const responseCategory =
      categoryLabel(
        result.category || category
      );

    const retryAfterSeconds = Math.max(
      0,
      Number(
        result.retry_after_seconds
      ) || 0
    );

    if (!response.ok) {
      if (retryAfterSeconds > 0) {
        startCategoryCooldown(
          responseCategory,
          retryAfterSeconds
        );
      }

      throw new Error(
        result.error ||
          "Unable to record your vote."
      );
    }

    startCategoryCooldown(
      responseCategory,
      retryAfterSeconds ||
        VOTE_COOLDOWN_SECONDS
    );

    if (confirmation) {
      confirmation.textContent =
        `Your vote for ${teamName} was recorded. ` +
        `You can vote for another ${responseCategory} team in ${VOTE_COOLDOWN_SECONDS} seconds.`;
    }

    setMessage(
      votingMessage,
      result.message ||
        `Your vote for ${teamName} has been recorded.`,
      "success"
    );
  } catch (error) {
    setMessage(
      votingMessage,
      error.message ||
        "Unable to record your vote.",
      "error"
    );
  } finally {
    state.requestInProgress = false;
    updateCategoryVoteButtons(category);
  }
}

async function submitNomination(event) {
  event.preventDefault();

  if (!nominationForm.reportValidity()) {
    return;
  }

  nominationSubmitButton.disabled = true;
  nominationSubmitButton.textContent =
    "Submitting...";

  setMessage(nominationMessage, "");

  const formData =
    new FormData(nominationForm);

  const submission =
    Object.fromEntries(formData.entries());

  try {
    const response = await fetch(
      "/api/totw/nominate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(submission)
      }
    );

    const result =
      await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(
        result.error ||
          "Unable to submit the team nomination."
      );
    }

    nominationForm.reset();

    setMessage(
      nominationMessage,
      result.message ||
        "Your Team of the Week nomination has been submitted.",
      "success"
    );
  } catch (error) {
    setMessage(
      nominationMessage,
      error.message ||
        "Unable to submit the team nomination.",
      "error"
    );
  } finally {
    nominationSubmitButton.disabled = false;
    nominationSubmitButton.textContent =
      "Submit team nomination";
  }
}

function showClosedSection(
  heading,
  message
) {
  closedHeading.textContent = heading;
  closedMessage.textContent = message;

  showElement(closedSection);
}

function renderCurrentWeek(data) {
  resetSections();

  const week = data.week;

  const boysFinalists =
    data.boys_finalists ?? [];

  const girlsFinalists =
    data.girls_finalists ?? [];

  const boysWinner =
    data.boys_winner ?? null;

  const girlsWinner =
    data.girls_winner ?? null;

  const nextVotingWeekId =
    week?.id || "";

  if (
    activeVotingWeekId !== nextVotingWeekId
  ) {
    clearCooldownTimers();
  }

  activeVotingWeekId =
    nextVotingWeekId;

  renderStatusCard(week);

  if (!week) {
    showClosedSection(
      "The next week is coming soon",
      "There is not currently an active Team of the Week nomination or voting period."
    );

    return;
  }

  switch (week.status) {
    case "nominations_open":
      showElement(nominationSection);
      break;

    case "nominations_closed":
      showClosedSection(
        "Finalists are being selected",
        "Podium Watch is reviewing the team nominations. Voting will open after the boys and girls finalists are announced."
      );
      break;

    case "voting_open":
      renderFinalists(
        boysFinalists,
        girlsFinalists
      );

      showElement(votingSection);
      break;

    case "voting_closed":
      showClosedSection(
        "Voting has closed",
        "The votes are being reviewed. The boys and girls winners will be announced soon."
      );
      break;

    case "winner_announced":
      renderWinners(
        boysWinner,
        girlsWinner
      );
      break;

    default:
      showClosedSection(
        "Team of the Week update",
        "Check back soon for the next stage of Team of the Week."
      );
  }
}

async function loadCurrentWeek() {
  try {
    const response = await fetch(
      "/api/totw/current",
      {
        headers: {
          Accept: "application/json"
        }
      }
    );

    const result =
      await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(
        result.error ||
          "Unable to load Team of the Week."
      );
    }

    renderCurrentWeek(result);
  } catch (error) {
    weekStatusCard.innerHTML = `
      <p class="status-label">
        Current status
      </p>

      <p class="status-title">
        Unable to load
      </p>

      <p class="status-details">
        Team of the Week information is temporarily unavailable.
      </p>
    `;

    showClosedSection(
      "Unable to load Team of the Week",
      "Please refresh the page or check back again soon."
    );

    console.error(error);
  }
}

function archiveWinnerMarkup(
  winner,
  category
) {
  if (!winner) {
    return `
      <article class="archive-card">
        <div class="archive-content">
          <p class="archive-date">
            ${escapeHtml(
              categoryTitle(category)
            )}
          </p>

          <h3>
            Winner not posted
          </h3>

          <p class="archive-achievement">
            This winner was not available in the archive.
          </p>
        </div>
      </article>
    `;
  }

  const imageContent = winner.image_url
    ? `
      <img
        src="${escapeHtml(winner.image_url)}"
        alt="${escapeHtml(winner.team_name)}"
      >
    `
    : `
      <div class="archive-placeholder">
        PW
      </div>
    `;

  const divisionContent = winner.division
    ? ` · ${escapeHtml(winner.division)}`
    : "";

  return `
    <article class="archive-card">
      <div class="archive-image">
        ${imageContent}
      </div>

      <div class="archive-content">
        <p class="archive-date">
          ${escapeHtml(
            categoryTitle(category)
          )}
        </p>

        <h3>
          ${escapeHtml(winner.team_name)}
        </h3>

        <p class="archive-school">
          ${escapeHtml(winner.school)}
          ·
          ${escapeHtml(winner.sport)}
          ${divisionContent}
        </p>

        <p class="archive-achievement">
          ${escapeHtml(winner.achievement)}
        </p>
      </div>
    </article>
  `;
}

function renderArchive(winners) {
  if (
    !Array.isArray(winners) ||
    winners.length === 0
  ) {
    winnerArchive.innerHTML = `
      <div class="empty-state">
        The Team of the Week archive will appear here after the first winners are announced.
      </div>
    `;

    return;
  }

  winnerArchive.innerHTML = winners
    .map((winnerItem) => {
      return `
        <section class="archive-week">
          <div class="archive-week-heading">
            <p>
              Week ending
              ${escapeHtml(
                formatDate(
                  winnerItem.voting_closes
                )
              )}
            </p>
          </div>

          <div class="archive-winners">
            ${archiveWinnerMarkup(
              winnerItem.boys_winner,
              "boys"
            )}

            ${archiveWinnerMarkup(
              winnerItem.girls_winner,
              "girls"
            )}
          </div>
        </section>
      `;
    })
    .join("");
}

async function loadArchive() {
  try {
    const response = await fetch(
      "/api/totw/archive",
      {
        headers: {
          Accept: "application/json"
        }
      }
    );

    const result =
      await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(
        result.error ||
          "Unable to load past Team of the Week winners."
      );
    }

    renderArchive(result.winners ?? []);
  } catch (error) {
    winnerArchive.innerHTML = `
      <div class="empty-state">
        Past Team of the Week winners are temporarily unavailable.
      </div>
    `;

    console.error(error);
  }
}

nominationForm?.addEventListener(
  "submit",
  submitNomination
);

loadCurrentWeek();
loadArchive()