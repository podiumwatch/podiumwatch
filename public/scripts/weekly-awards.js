(() => {
  const root = document.querySelector("[data-weekly-award]");
  if (!root) return;

  const type = root.dataset.awardType;
  const isTeam = type === "team";
  const apiBase = isTeam ? "/api/totw" : "/api/aotw";
  const storageKey = isTeam ? "podium-watch-totw-voter" : "podium-watch-aotw-voter";
  const statusBox = root.querySelector("[data-award-status]");
  const currentSection = root.querySelector("[data-award-current]");
  const titleElement = root.querySelector("[data-award-title]");
  const deadlineElement = root.querySelector("[data-award-deadline]");
  const nominationSection = root.querySelector("[data-nomination-section]");
  const nominationForm = root.querySelector("[data-award-nomination]");
  const archiveContainer = root.querySelector("[data-award-archive]");

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function formatDate(value, includeTime = false) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {})
    }).format(date);
  }

  function getVoterToken() {
    let token = localStorage.getItem(storageKey);
    if (token && token.length >= 20) return token;
    token = globalThis.crypto?.randomUUID?.().replaceAll("-", "") || `${Date.now()}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(storageKey, token);
    return token;
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) },
      ...options
    });
    let data = {};
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) {
      const error = new Error(data.error || "The request could not be completed.");
      error.retryAfter = Number(data.retry_after_seconds) || 0;
      throw error;
    }
    return data;
  }

  function imageMarkup(item, name) {
    const url = safeUrl(item.image_url);
    if (!url) return `<div class="award-image-placeholder" aria-hidden="true">PW</div>`;
    return `<img class="award-image" src="${escapeHtml(url)}" alt="${escapeHtml(name)}" loading="lazy" width="320" height="320">`;
  }

  function itemName(item) {
    return isTeam ? item.team_name : item.athlete_name;
  }

  // Compact by design: a card shows only what's needed to compare
  // candidates at a glance (logo, name, meta, vote count, vote button) so
  // every finalist fits on screen together on both mobile and desktop.
  // Achievement/description are real content but not needed to decide who
  // to vote for, so they're collapsed behind a "Show details" toggle
  // (wired up below) instead of always taking up card height.
  function finalistCard(item, week, winner = false) {
    const name = itemName(item);
    const details = isTeam
      ? [item.school, item.sport, item.division].filter(Boolean).join(" | ")
      : [item.school, item.grade].filter(Boolean).join(" | ");
    const votingOpen = week?.status === "voting_open";
    const voteCount = Number(item.vote_count) || 0;
    const hasDetails = Boolean(item.achievement || item.description);
    return `<article class="award-card${winner ? " award-card-winner" : ""}">
      ${imageMarkup(item, name)}
      <div class="award-card-body">
        ${winner ? '<p class="award-badge">Winner</p>' : ""}
        <h3>${escapeHtml(name)}</h3>
        ${details ? `<p class="award-card-meta">${escapeHtml(details)}</p>` : ""}
        <p class="award-vote-count"><strong>${voteCount}</strong><span>${voteCount === 1 ? "vote" : "votes"}</span></p>
        ${votingOpen ? `<button class="button button-primary" type="button" data-vote-id="${escapeHtml(item.id)}" data-vote-name="${escapeHtml(name)}" aria-label="Vote for ${escapeHtml(name)}">Vote</button><p class="form-message" data-vote-message="${escapeHtml(item.id)}" aria-live="polite"></p>` : ""}
        ${hasDetails ? `<button class="award-details-toggle" type="button" aria-expanded="false">Show details</button>
        <div class="award-card-details" hidden>
          ${item.achievement ? `<p><strong>${escapeHtml(item.achievement)}</strong></p>` : ""}
          ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
        </div>` : ""}
      </div>
    </article>`;
  }

  function renderCurrent(data) {
    const week = data.week;
    if (!week) {
      statusBox.innerHTML = "<h2>No active award period</h2><p>Check back for the next nomination or voting window.</p>";
      statusBox.hidden = false;
      currentSection.hidden = true;
      nominationSection.hidden = true;
      return;
    }

    titleElement.textContent = week.title || (isTeam ? "Team of the Week" : "Athlete of the Week");
    const statusCopy = {
      nominations_open: `Nominations close ${formatDate(week.nomination_closes, true)}.`,
      voting_open: `Voting closes ${formatDate(week.voting_closes, true)}.`,
      voting_closed: "Voting is closed. The winner will be announced soon.",
      winner_announced: "The winner has been announced."
    };
    deadlineElement.textContent = statusCopy[week.status] || "This award period is being prepared.";
    statusBox.hidden = true;
    currentSection.hidden = false;

    const finalists = data.finalists || [];
    const container = root.querySelector("[data-award-finalists]");
    container.innerHTML = finalists.length ? finalists.map((item) => finalistCard(item, week, item.winner === true)).join("") : '<div class="empty-state compact-empty"><h3>Finalists are not published yet</h3><p>Check back after nominations are reviewed.</p></div>';

    nominationSection.hidden = week.status !== "nominations_open";
    if (nominationForm) nominationForm.hidden = week.status !== "nominations_open";
  }

  function renderArchive(winners) {
    if (!winners.length) return '<div class="empty-state compact-empty"><h3>No past winners published</h3><p>The archive will grow as winners are announced.</p></div>';
    return winners.map((entry) => {
      const item = isTeam ? entry.team : entry.athlete;
      const name = itemName(item);
      const details = isTeam
        ? [item.school, item.sport, item.division].filter(Boolean).join(" | ")
        : [item.school, item.grade].filter(Boolean).join(" | ");
      return `<article class="award-card award-archive-card">${imageMarkup(item, name)}<div class="award-card-body"><p class="award-badge">${escapeHtml(entry.title || "Past winner")}</p><h3>${escapeHtml(name)}</h3><p class="award-card-meta">${escapeHtml(details)}</p>${item.achievement ? `<p>${escapeHtml(item.achievement)}</p>` : ""}<small>Announced ${escapeHtml(formatDate(entry.voting_closes))}</small></div></article>`;
    }).join("");
  }

  async function load() {
    try {
      const [current, archive] = await Promise.all([request(`${apiBase}/current`), request(`${apiBase}/archive`)]);
      renderCurrent(current);
      archiveContainer.innerHTML = renderArchive(archive.winners || []);
    } catch (error) {
      statusBox.innerHTML = `<h2>Awards are temporarily unavailable</h2><p>${escapeHtml(error.message)}</p>`;
      statusBox.hidden = false;
      currentSection.hidden = true;
      archiveContainer.innerHTML = '<div class="empty-state compact-empty"><h3>The archive could not be loaded</h3><p>Please try again later.</p></div>';
    }
  }

  root.addEventListener("click", async (event) => {
    const detailsToggle = event.target.closest(".award-details-toggle");
    if (detailsToggle) {
      const details = detailsToggle.nextElementSibling;
      const expanded = detailsToggle.getAttribute("aria-expanded") === "true";
      detailsToggle.setAttribute("aria-expanded", String(!expanded));
      detailsToggle.textContent = expanded ? "Show details" : "Hide details";
      if (details) details.hidden = expanded;
      return;
    }

    const button = event.target.closest("[data-vote-id]");
    if (!button || button.disabled) return;
    const id = button.dataset.voteId;
    const message = root.querySelector(`[data-vote-message="${CSS.escape(id)}"]`);
    button.disabled = true;
    message.textContent = "Recording your vote.";
    try {
      const data = await request(`${apiBase}/vote`, { method: "POST", body: JSON.stringify({ finalist_id: id, voter_token: getVoterToken(), website: "" }) });
      message.textContent = data.message || "Your vote has been recorded.";
      let remaining = Number(data.retry_after_seconds) || 45;
      // Podium Play (public/scripts/podium-play.js) hooks in here, and
      // only here -- one event, fired only after this real confirmed
      // success response, carrying the exact same retry_after_seconds
      // this file already uses for its own per-button countdown below.
      // Podium Play never computes or stores its own cooldown; this is
      // the single authoritative source it reads from.
      document.dispatchEvent(new CustomEvent("podiumwatch:vote-success", {
        detail: { awardType: type, finalistId: id, finalistName: button.dataset.voteName || "", retryAfterSeconds: remaining }
      }));
      const original = button.textContent;
      const timer = setInterval(() => {
        remaining -= 1;
        button.textContent = remaining > 0 ? `Vote again in ${remaining}` : original;
        if (remaining <= 0) { clearInterval(timer); button.disabled = false; }
      }, 1000);
    } catch (error) {
      message.textContent = error.message;
      const delay = error.retryAfter || 0;
      if (!delay) button.disabled = false;
      else setTimeout(() => { button.disabled = false; }, delay * 1000);
    }
  });

  nominationForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = nominationForm.querySelector('button[type="submit"]');
    const message = nominationForm.querySelector("[data-nomination-message]");
    const formData = new FormData(nominationForm);
    const payload = Object.fromEntries(formData.entries());
    if (isTeam) payload.permission = formData.get("permission") === "true";
    button.disabled = true;
    message.textContent = "Submitting your nomination.";
    try {
      const data = await request(`${apiBase}/nominate`, { method: "POST", body: JSON.stringify(payload) });
      message.textContent = data.message || "Your nomination has been submitted.";
      nominationForm.reset();
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  load();
})();
