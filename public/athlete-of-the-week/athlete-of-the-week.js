const weekStatusCard = document.querySelector("#week-status-card");

const winnerSection = document.querySelector("#winner-section");
const currentWinner = document.querySelector("#current-winner");

const nominationSection = document.querySelector("#nomination-section");
const nominationForm = document.querySelector("#nomination-form");
const nominationSubmitButton = document.querySelector(
  "#nomination-submit-button"
);
const nominationMessage = document.querySelector("#nomination-message");

const votingSection = document.querySelector("#voting-section");
const finalistGrid = document.querySelector("#finalist-grid");
const votingMessage = document.querySelector("#voting-message");

const closedSection = document.querySelector("#closed-section");
const closedHeading = document.querySelector("#closed-heading");
const closedMessage = document.querySelector("#closed-message");

const winnerArchive = document.querySelector("#winner-archive");

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

function renderStatusCard(week) {
  if (!week) {
    weekStatusCard.innerHTML = `
      <p class="status-label">Current status</p>
      <p class="status-title">No active week</p>
      <p class="status-details">
        The next Athlete of the Week period will be announced soon.
      </p>
    `;

    return;
  }

  const statusContent = {
    nominations_open: {
      title: "Nominations Open",
      details: `Nominations close ${formatDateTime(
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
      details: `Voting closes ${formatDateTime(week.voting_closes)}.`
    },

    voting_closed: {
      title: "Voting Closed",
      details:
        "Voting has ended. The Athlete of the Week winner will be announced soon."
    },

    winner_announced: {
      title: "Winner Announced",
      details:
        "The newest Podium Watch Athlete of the Week has been selected."
    }
  };

  const content = statusContent[week.status] ?? {
    title: "Weekly Update",
    details: "Check back soon for the next update."
  };

  weekStatusCard.innerHTML = `
    <p class="status-label">Current status</p>
    <p class="status-title">${escapeHtml(content.title)}</p>
    <p class="status-details">${escapeHtml(content.details)}</p>
  `;
}

function renderWinner(winner) {
  if (!winner) {
    return;
  }

  const imageContent = winner.image_url
    ? `
      <img
        src="${escapeHtml(winner.image_url)}"
        alt="${escapeHtml(winner.athlete_name)}"
      >
    `
    : `
      <div class="winner-placeholder">
        PW
      </div>
    `;

  currentWinner.innerHTML = `
    <article class="winner-card">
      <div class="winner-image">
        ${imageContent}
      </div>

      <div class="winner-copy">
        <p class="athlete-school">
          ${escapeHtml(winner.school)} · ${escapeHtml(winner.grade)}
        </p>

        <h3>${escapeHtml(winner.athlete_name)}</h3>

        <p class="achievement">
          ${escapeHtml(winner.achievement)}
        </p>

        <p class="description">
          ${escapeHtml(winner.description)}
        </p>
      </div>
    </article>
  `;

  showElement(winnerSection);
}

function renderFinalists(finalists) {
  if (!Array.isArray(finalists) || finalists.length === 0) {
    finalistGrid.innerHTML = `
      <div class="empty-state">
        Finalists will be posted soon.
      </div>
    `;

    return;
  }

  finalistGrid.innerHTML = finalists
    .map((finalist) => {
      const imageContent = finalist.image_url
        ? `
          <img
            src="${escapeHtml(finalist.image_url)}"
            alt="${escapeHtml(finalist.athlete_name)}"
          >
        `
        : `
          <div class="finalist-placeholder">
            PW
          </div>
        `;

      return `
        <article class="finalist-card">
          <div class="finalist-image">
            ${imageContent}
          </div>

          <div class="finalist-content">
            <p class="finalist-school">
              ${escapeHtml(finalist.school)} · ${escapeHtml(finalist.grade)}
            </p>

            <h3>${escapeHtml(finalist.athlete_name)}</h3>

            <p class="finalist-achievement">
              ${escapeHtml(finalist.achievement)}
            </p>

            <p class="finalist-description">
              ${escapeHtml(finalist.description)}
            </p>

            <button
              class="vote-button"
              type="button"
              data-finalist-id="${escapeHtml(finalist.id)}"
              data-athlete-name="${escapeHtml(finalist.athlete_name)}"
            >
              Vote for ${escapeHtml(finalist.athlete_name)}
            </button>

            <p
              class="vote-confirmation"
              aria-live="polite"
            ></p>
          </div>
        </article>
      `;
    })
    .join("");

  finalistGrid
    .querySelectorAll(".vote-button")
    .forEach((button) => {
      button.addEventListener("click", submitVote);
    });
}

async function submitVote(event) {
  const button = event.currentTarget;
  const finalistId = button.dataset.finalistId;
  const athleteName = button.dataset.athleteName;
  const confirmation = button
    .closest(".finalist-content")
    ?.querySelector(".vote-confirmation");

  button.disabled = true;
  button.textContent = "Recording vote...";

  if (confirmation) {
    confirmation.textContent = "";
  }

  try {
    const response = await fetch("/api/aotw/vote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        finalist_id: finalistId,
        website: ""
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to record your vote.");
    }

    if (confirmation) {
      confirmation.textContent = `Your vote for ${athleteName} was recorded. Vote again at any time.`;
    }

    setMessage(
      votingMessage,
      result.message || "Your vote has been recorded.",
      "success"
    );
  } catch (error) {
    setMessage(
      votingMessage,
      error.message || "Unable to record your vote.",
      "error"
    );
  } finally {
    button.disabled = false;
    button.textContent = `Vote for ${athleteName}`;
  }
}

async function submitNomination(event) {
  event.preventDefault();

  if (!nominationForm.reportValidity()) {
    return;
  }

  nominationSubmitButton.disabled = true;
  nominationSubmitButton.textContent = "Submitting...";

  setMessage(nominationMessage, "");

  const formData = new FormData(nominationForm);
  const submission = Object.fromEntries(formData.entries());

  try {
    const response = await fetch("/api/aotw/nominate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(submission)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Unable to submit the nomination."
      );
    }

    nominationForm.reset();

    setMessage(
      nominationMessage,
      result.message ||
        "Your nomination has been submitted successfully.",
      "success"
    );
  } catch (error) {
    setMessage(
      nominationMessage,
      error.message || "Unable to submit the nomination.",
      "error"
    );
  } finally {
    nominationSubmitButton.disabled = false;
    nominationSubmitButton.textContent = "Submit nomination";
  }
}

function showClosedSection(heading, message) {
  closedHeading.textContent = heading;
  closedMessage.textContent = message;
  showElement(closedSection);
}

function renderCurrentWeek(data) {
  resetSections();

  const week = data.week;
  const finalists = data.finalists ?? [];
  const winner = data.winner;

  renderStatusCard(week);

  if (!week) {
    showClosedSection(
      "The next week is coming soon",
      "There is not currently an active nomination or voting period."
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
        "Podium Watch is reviewing the nominations. Voting will open after the finalists are announced."
      );
      break;

    case "voting_open":
      renderFinalists(finalists);
      showElement(votingSection);
      break;

    case "voting_closed":
      showClosedSection(
        "Voting has closed",
        "The votes are being reviewed. The winner will be announced soon."
      );
      break;

    case "winner_announced":
      renderWinner(winner);

      if (!winner) {
        showClosedSection(
          "Winner announcement coming soon",
          "The winning athlete will be posted shortly."
        );
      }

      break;

    default:
      showClosedSection(
        "Athlete of the Week update",
        "Check back soon for the next stage of Athlete of the Week."
      );
  }
}

async function loadCurrentWeek() {
  try {
    const response = await fetch("/api/aotw/current", {
      headers: {
        Accept: "application/json"
      }
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Unable to load Athlete of the Week."
      );
    }

    renderCurrentWeek(result);
  } catch (error) {
    weekStatusCard.innerHTML = `
      <p class="status-label">Current status</p>
      <p class="status-title">Unable to load</p>
      <p class="status-details">
        Athlete of the Week information is temporarily unavailable.
      </p>
    `;

    showClosedSection(
      "Unable to load Athlete of the Week",
      "Please refresh the page or check back again soon."
    );

    console.error(error);
  }
}

function renderArchive(winners) {
  if (!Array.isArray(winners) || winners.length === 0) {
    winnerArchive.innerHTML = `
      <div class="empty-state">
        The Athlete of the Week archive will appear here after the first winner is announced.
      </div>
    `;

    return;
  }

  winnerArchive.innerHTML = winners
    .map((winnerItem) => {
      const athlete = winnerItem.athlete;

      const imageContent = athlete.image_url
        ? `
          <img
            src="${escapeHtml(athlete.image_url)}"
            alt="${escapeHtml(athlete.athlete_name)}"
          >
        `
        : `
          <div class="archive-placeholder">
            PW
          </div>
        `;

      return `
        <article class="archive-card">
          <div class="archive-image">
            ${imageContent}
          </div>

          <div class="archive-content">
            <p class="archive-date">
              ${escapeHtml(formatDate(winnerItem.voting_closes))}
            </p>

            <h3>${escapeHtml(athlete.athlete_name)}</h3>

            <p class="archive-school">
              ${escapeHtml(athlete.school)} · ${escapeHtml(athlete.grade)}
            </p>

            <p class="archive-achievement">
              ${escapeHtml(athlete.achievement)}
            </p>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadArchive() {
  try {
    const response = await fetch("/api/aotw/archive", {
      headers: {
        Accept: "application/json"
      }
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Unable to load past winners."
      );
    }

    renderArchive(result.winners ?? []);
  } catch (error) {
    winnerArchive.innerHTML = `
      <div class="empty-state">
        Past winners are temporarily unavailable.
      </div>
    `;

    console.error(error);
  }
}

nominationForm?.addEventListener("submit", submitNomination);

loadCurrentWeek();
loadArchive();