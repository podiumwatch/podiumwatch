(() => {
  const store = window.PodiumMyPodiumStore;
  const dataAdapter = window.PodiumMyPodiumData;
  const shell = document.querySelector("[data-mp-shell]");
  if (!shell || !store || !dataAdapter) return;

  const escapeHtml = dataAdapter.escapeHtml;

  const loadingPanel = shell.querySelector("[data-mp-loading]");
  const onboarding = shell.querySelector("[data-mp-onboarding]");
  const intro = shell.querySelector("[data-mp-intro]");
  const stepsBar = shell.querySelector("[data-mp-steps]");
  const dashboard = shell.querySelector("[data-mp-dashboard]");

  const steps = {
    team: shell.querySelector('[data-mp-step="team"]'),
    preferences: shell.querySelector('[data-mp-step="preferences"]'),
    review: shell.querySelector('[data-mp-step="review"]')
  };
  const stepOrder = ["team", "preferences", "review"];

  let draft = { team: null, sport: null, gender: null, athletes: [] };

  function showOnly(element) {
    [intro, steps.team, steps.preferences, steps.review].forEach((node) => {
      if (node) node.hidden = node !== element;
    });
    stepsBar.hidden = !element || element === intro;
    if (element && element !== intro) {
      const index = stepOrder.indexOf(Object.keys(steps).find((key) => steps[key] === element));
      stepOrder.forEach((key, position) => {
        const indicator = stepsBar.querySelector(`[data-mp-step-indicator="${key}"]`);
        if (!indicator) return;
        indicator.dataset.mpStepState = position < index ? "done" : position === index ? "active" : "pending";
      });
    }
  }

  // ---- Onboarding: step 1, team search ------------------------------

  const teamInput = shell.querySelector("[data-mp-team-input]");
  const teamResults = shell.querySelector("[data-mp-team-results]");
  let teamSearchTimer = null;
  let teamSearchToken = 0;

  function renderTeamResults(teams) {
    teamResults.innerHTML = teams.length
      ? teams.map((team) => `<button type="button" class="mp-result-button" role="option" data-mp-team-pick="${escapeHtml(team.id)}">${escapeHtml(team.school_name)}${team.city ? ` <span style="font-weight:400;color:#7a827e;">&middot; ${escapeHtml(team.city)}</span>` : ""}</button>`).join("")
      : `<p class="mp-card-empty">No schools match yet.</p>`;
    teamResults.querySelectorAll("[data-mp-team-pick]").forEach((button) => {
      button.addEventListener("click", () => {
        const team = teams.find((item) => item.id === button.dataset.mpTeamPick);
        if (!team) return;
        draft.team = { id: team.id, slug: team.slug, schoolName: team.school_name };
        store.trackEvent("preference_added", { category: "team" });
        goToStep("preferences");
      });
    });
  }

  teamInput?.addEventListener("input", () => {
    window.clearTimeout(teamSearchTimer);
    const query = teamInput.value.trim();
    if (query.length < 2) { teamResults.innerHTML = ""; return; }
    const token = ++teamSearchToken;
    teamSearchTimer = window.setTimeout(() => {
      fetch("/api/teams/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ search: query }) })
        .then((response) => response.json())
        .then((data) => {
          if (token !== teamSearchToken) return; // A newer keystroke already superseded this response.
          renderTeamResults((Array.isArray(data.teams) ? data.teams : []).slice(0, 8));
        })
        .catch(() => {
          if (token !== teamSearchToken) return;
          teamResults.innerHTML = `<p class="mp-card-empty">Search is temporarily unavailable.</p>`;
        });
    }, 250);
  });

  // ---- Onboarding: step 2, sport/gender/athletes ---------------------

  const preferencesTeamName = shell.querySelector("[data-mp-preferences-team-name]");
  const sportButtons = [...shell.querySelectorAll("[data-mp-sport]")];
  const genderButtons = [...shell.querySelectorAll("[data-mp-gender]")];
  const athleteInput = shell.querySelector("[data-mp-athlete-input]");
  const athleteResults = shell.querySelector("[data-mp-athlete-results]");
  const athleteSelected = shell.querySelector("[data-mp-athlete-selected]");
  let athleteSearchTimer = null;
  let athleteSearchToken = 0;

  sportButtons.forEach((button) => button.addEventListener("click", () => {
    draft.sport = button.dataset.mpSport;
    sportButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  }));
  genderButtons.forEach((button) => button.addEventListener("click", () => {
    draft.gender = button.dataset.mpGender;
    genderButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  }));

  function renderAthleteSelected() {
    athleteSelected.innerHTML = draft.athletes.length
      ? `<div style="display:grid;gap:6px;margin-top:8px;">${draft.athletes.map((athlete) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 11px;border:1px solid var(--line);border-radius:8px;"><span>${escapeHtml(athlete.displayName)}</span><button type="button" class="text-link" style="background:none;border:0;cursor:pointer;" data-mp-athlete-remove="${escapeHtml(athlete.id)}">Remove</button></div>`).join("")}</div>`
      : "";
    athleteSelected.querySelectorAll("[data-mp-athlete-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        draft.athletes = draft.athletes.filter((athlete) => athlete.id !== button.dataset.mpAthleteRemove);
        renderAthleteSelected();
      });
    });
  }

  athleteInput?.addEventListener("input", () => {
    window.clearTimeout(athleteSearchTimer);
    const query = athleteInput.value.trim();
    if (query.length < 2) { athleteResults.innerHTML = ""; return; }
    const token = ++athleteSearchToken;
    athleteSearchTimer = window.setTimeout(() => {
      fetch("/api/athletes/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ search: query, page_size: 8 }) })
        .then((response) => response.json())
        .then((data) => {
          if (token !== athleteSearchToken) return;
          const athletes = Array.isArray(data.athletes) ? data.athletes : [];
          athleteResults.innerHTML = athletes.length
            ? athletes.map((athlete) => `<button type="button" class="mp-result-button" role="option" data-mp-athlete-pick="${escapeHtml(athlete.id || athlete.slug)}">${escapeHtml(athlete.display_name)}${athlete.school ? ` <span style="font-weight:400;color:#7a827e;">&middot; ${escapeHtml(athlete.school.school_name)}</span>` : ""}</button>`).join("")
            : `<p class="mp-card-empty">No athletes match yet.</p>`;
          athleteResults.querySelectorAll("[data-mp-athlete-pick]").forEach((button) => {
            button.addEventListener("click", () => {
              const athlete = athletes.find((item) => (item.id || item.slug) === button.dataset.mpAthletePick);
              if (!athlete || draft.athletes.some((item) => item.id === (athlete.id || athlete.slug))) return;
              draft.athletes.push({ id: athlete.id || athlete.slug, slug: athlete.slug, displayName: athlete.display_name });
              store.trackEvent("preference_added", { category: "athlete" });
              renderAthleteSelected();
              athleteInput.value = "";
              athleteResults.innerHTML = "";
            });
          });
        })
        .catch(() => {
          if (token !== athleteSearchToken) return;
          athleteResults.innerHTML = `<p class="mp-card-empty">Search is temporarily unavailable.</p>`;
        });
    }, 250);
  });

  // ---- Onboarding: step 3, review ------------------------------------

  const reviewBody = shell.querySelector("[data-mp-review-body]");

  function renderReview() {
    const rows = [];
    if (draft.team) rows.push(["School", draft.team.schoolName]);
    if (draft.sport) rows.push(["Sport", draft.sport === "cross_country" ? "Cross Country" : "Track and Field"]);
    if (draft.gender) rows.push(["Gender", draft.gender === "girls" ? "Girls" : "Boys"]);
    if (draft.athletes.length) rows.push(["Athletes", draft.athletes.map((athlete) => athlete.displayName).join(", ")]);
    reviewBody.innerHTML = rows.length
      ? rows.map(([label, value]) => `<div class="mp-review-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`).join("")
      : `<p class="mp-card-empty">Nothing selected yet.</p>`;
  }

  // ---- Step navigation -------------------------------------------------

  function goToStep(name) {
    showOnly(steps[name]);
    if (name === "preferences") {
      preferencesTeamName.textContent = draft.team ? `Following ${draft.team.schoolName}` : "";
      renderAthleteSelected();
    }
    if (name === "review") renderReview();
  }

  shell.querySelectorAll("[data-mp-back]").forEach((button) => {
    button.addEventListener("click", () => goToStep(button.dataset.mpBack));
  });
  shell.querySelectorAll("[data-mp-next]").forEach((button) => {
    button.addEventListener("click", () => goToStep(button.dataset.mpNext));
  });

  shell.querySelector("[data-mp-start]")?.addEventListener("click", () => {
    store.trackEvent("onboarding_started", {});
    goToStep("team");
  });

  shell.querySelector("[data-mp-explore]")?.addEventListener("click", () => {
    store.trackEvent("my_podium_opened", { mode: "explore" });
    renderDashboard();
  });

  shell.querySelector("[data-mp-finish]")?.addEventListener("click", () => {
    if (draft.team) {
      store.setTeam({ ...draft.team, sport: draft.sport, gender: draft.gender });
    }
    draft.athletes.forEach((athlete) => store.addAthlete(athlete));
    store.trackEvent("onboarding_completed", { hasTeam: Boolean(draft.team), athleteCount: draft.athletes.length });
    renderDashboard();
  });

  // ---- Dashboard rendering --------------------------------------------

  function skeletonCard(title) {
    return `<h3>${escapeHtml(title)}</h3><div class="mp-skeleton" style="width:70%;margin-bottom:8px;"></div><div class="mp-skeleton" style="width:45%;"></div>`;
  }

  function formatMeetDate(value) {
    if (!value) return "Date not announced";
    const date = new Date(String(value).slice(0, 10) + "T12:00:00");
    if (Number.isNaN(date.getTime())) return "Date not announced";
    return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "America/New_York" }).format(date);
  }

  const STATUS_LABEL = { today: "Today", scheduled: "Scheduled", results_pending: "Results pending", results_available: "Results available" };

  function meetLine(meet, status) {
    if (!meet) return "";
    const parts = [escapeHtml(meet.name), formatMeetDate(meet.meet_date)];
    const location = [meet.venue_name, meet.city].filter(Boolean).join(", ");
    if (location) parts.push(escapeHtml(location));
    return `<p><strong>${parts[0]}</strong></p><p>${parts.slice(1).join(" &middot; ")}</p>${status ? `<p><span class="mp-card-empty">${escapeHtml(STATUS_LABEL[status] || "")}</span></p>` : ""}`;
  }

  function renderDashboard() {
    showOnly(null);
    onboarding.hidden = true;
    dashboard.hidden = false;
    loadingPanel.hidden = true;

    const preferences = store.getPreferences();
    document.querySelector("[data-mp-date]").textContent = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" }).format(new Date());
    document.querySelector("[data-mp-edit]").addEventListener("click", () => startEditing(preferences));
    document.querySelector("[data-mp-clear]").addEventListener("click", () => {
      if (!window.confirm("Clear all My Podium preferences from this device? This cannot be undone.")) return;
      store.clearAll();
      store.trackEvent("preference_removed", { category: "all" });
      window.location.reload();
    });

    const contextCard = document.querySelector("[data-mp-context-card]");
    const raceDayCard = document.querySelector("[data-mp-race-day-card]");
    const pollCard = document.querySelector("[data-mp-poll-card]");
    const rankingCard = document.querySelector("[data-mp-ranking-card]");
    const nextMeetCard = document.querySelector("[data-mp-next-meet-card]");
    const latestResultCard = document.querySelector("[data-mp-latest-result-card]");
    const athleteCards = document.querySelector("[data-mp-athlete-cards]");
    const storyCard = document.querySelector("[data-mp-story-card]");
    const summary = document.querySelector("[data-mp-summary]");
    const feedDetail = document.querySelector("[data-mp-feed-detail]");

    if (preferences.team) {
      contextCard.hidden = false;
      contextCard.innerHTML = `<h3>Following</h3><div class="mp-skeleton" style="width:60%;"></div>`;
    }
    if (preferences.team) { nextMeetCard.hidden = false; nextMeetCard.innerHTML = skeletonCard("Next meet"); }
    if (preferences.team) { latestResultCard.hidden = false; latestResultCard.innerHTML = skeletonCard("Latest result"); }
    rankingCard.hidden = false;
    rankingCard.innerHTML = skeletonCard("Rankings");
    pollCard.hidden = false;
    pollCard.innerHTML = skeletonCard("This week's poll");

    dataAdapter.loadDashboard(preferences).then((model) => {
      summary.textContent = model.team || model.athletes.length
        ? "Here is what changed for you today."
        : "Here is what's happening around your Podium.";
      feedDetail.textContent = model.nextMeet || model.latestResult || model.poll?.week
        ? "Check the cards above for what's new."
        : "There's nothing new since your last visit.";

      // Personal context
      if (model.team) {
        contextCard.hidden = false;
        const swatch = model.team.primaryColor ? `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${escapeHtml(model.team.primaryColor)};margin-right:8px;vertical-align:middle;"></span>` : "";
        contextCard.innerHTML = `<h3>Following</h3><p>${swatch}<strong>${escapeHtml(model.team.schoolName)}</strong></p>
          <p>${[model.team.sport === "cross_country" ? "Cross Country" : model.team.sport === "track_and_field" ? "Track and Field" : null, model.team.gender ? (model.team.gender === "girls" ? "Girls" : "Boys") : null, model.team.divisionLabel].filter(Boolean).join(" &middot; ") || "Add sport and gender for a more precise dashboard."}</p>
          <a class="mp-card-action text-link" href="/team/?slug=${encodeURIComponent(model.team.slug)}">Open team page</a>`;
      } else {
        contextCard.hidden = true;
      }

      // Race day strip
      if (model.dayState === "race_day" && model.nextMeet) {
        raceDayCard.hidden = false;
        raceDayCard.innerHTML = `<h3 style="color:#fff;">Race day</h3><p style="color:#cfd6d1;"><strong>${escapeHtml(model.nextMeet.name)}</strong></p><p style="color:#cfd6d1;">${escapeHtml(STATUS_LABEL[model.nextMeetStatus] || "")}</p>
          <div class="mp-intro-actions"><a class="button button-primary" href="/meetdetail/?slug=${encodeURIComponent(model.nextMeet.slug)}">Meet Center</a><a class="button button-outline" style="color:#fff;border-color:rgba(255,255,255,.5)" href="/split-watch/">Split Watch</a></div>`;
      } else {
        raceDayCard.hidden = true;
      }

      // Poll
      if (model.poll?.week) {
        const week = model.poll.week;
        pollCard.hidden = false;
        if (week.status === "voting_open") {
          pollCard.innerHTML = `<h3>This week's poll</h3><p>Vote your top 16 teams this week.</p><a class="button button-primary mp-card-action" href="/fan-poll/cross-country/${escapeHtml(week.gender)}/division-${week.division_number}/">Cast your ballot</a>`;
        } else if (week.status === "voting_closed" && Array.isArray(model.poll.results) && model.poll.results.length) {
          pollCard.innerHTML = `<h3>This week's poll</h3><p>See this week's fan poll results.</p><a class="button button-outline mp-card-action" href="/fan-poll/cross-country/${escapeHtml(week.gender)}/division-${week.division_number}/">View results</a>`;
        } else {
          pollCard.hidden = true;
        }
      } else {
        pollCard.hidden = true;
      }

      // Rankings
      if (model.ranking) {
        rankingCard.hidden = false;
        rankingCard.innerHTML = `<h3>Rankings</h3><p><strong>No. ${escapeHtml(model.ranking.rank)}</strong> &middot; ${escapeHtml(model.ranking.athleteName)}</p><p class="mp-card-empty">Updated ${formatMeetDate(model.ranking.updatedDate)}${model.ranking.previousRank ? "" : " &middot; no movement data yet"}</p><a class="mp-card-action text-link" href="${escapeHtml(model.ranking.href)}">View ranking</a>`;
      } else if (model.team) {
        rankingCard.hidden = false;
        rankingCard.innerHTML = `<h3>Rankings</h3><p class="mp-card-empty">No ${escapeHtml(model.team.schoolName)} athletes are in a published Top 25 right now.</p><a class="mp-card-action text-link" href="/rankings/">Browse rankings</a>`;
      } else {
        rankingCard.hidden = true;
      }

      // Next meet / latest result
      if (model.team) {
        nextMeetCard.hidden = false;
        nextMeetCard.innerHTML = model.nextMeet
          ? `<h3>Next meet</h3>${meetLine(model.nextMeet, model.nextMeetStatus)}<a class="mp-card-action text-link" href="/meetdetail/?slug=${encodeURIComponent(model.nextMeet.slug)}">Meet Center</a>`
          : `<h3>Next meet</h3><p class="mp-card-empty">No upcoming meet is connected to this team yet.</p><a class="mp-card-action text-link" href="/meets/?view=upcoming">Browse the meet calendar</a>`;

        latestResultCard.hidden = false;
        latestResultCard.innerHTML = model.latestResult
          ? `<h3>Latest result</h3>${meetLine(model.latestResult, model.latestResultStatus)}<a class="mp-card-action text-link" href="/meetdetail/?slug=${encodeURIComponent(model.latestResult.slug)}">${dataAdapter.hasRealResults(model.latestResult) ? "View results" : "View meet page"}</a>`
          : `<h3>Latest result</h3><p class="mp-card-empty">No completed meet is connected to this team yet.</p><a class="mp-card-action text-link" href="/meets/?view=results">Browse latest results</a>`;
      } else {
        nextMeetCard.hidden = true;
        latestResultCard.hidden = true;
      }

      // Followed athletes
      if (model.athletes.length) {
        athleteCards.innerHTML = model.athletes.map((athlete) => `<div class="mp-card" style="margin-top:14px;">
          <h3>${escapeHtml(athlete.displayName)}</h3>
          ${athlete.loadFailed ? `<p class="mp-card-empty">This athlete's profile could not be loaded right now.</p>` :
            athlete.ranking
              ? `<p>Ranked No. ${escapeHtml(athlete.ranking.rank)} &middot; <a class="text-link" href="${escapeHtml(athlete.ranking.href)}">${escapeHtml(athlete.ranking.title)}</a></p>`
              : `<p class="mp-card-empty">No current ranking on file.</p>`}
          ${athlete.topPerformance ? `<p>${escapeHtml(athlete.topPerformance.eventName)}: <strong>${escapeHtml(athlete.topPerformance.markText)}</strong></p>` : ""}
        </div>`).join("");
      } else {
        athleteCards.innerHTML = "";
      }

      // Story
      if (model.story) {
        storyCard.hidden = false;
        storyCard.innerHTML = `<h3>From Podium Watch</h3><p><strong>${escapeHtml(model.story.title)}</strong></p><p class="mp-card-empty">${escapeHtml(model.story.description || "")}</p><a class="mp-card-action text-link" href="/stories/${encodeURIComponent(model.story.slug)}/">Read story</a>`;
      } else {
        storyCard.hidden = true;
      }

      store.trackEvent("my_podium_opened", { mode: preferences.team ? "personalized" : "explore" });
      if (store.hasPreferences()) store.trackEvent("my_podium_return_visit", {});
    }).catch(() => {
      summary.textContent = "Some of your Podium is temporarily unavailable.";
      [nextMeetCard, latestResultCard, rankingCard, pollCard].forEach((card) => {
        if (!card.hidden) card.innerHTML = `<p class="mp-card-empty">This card could not be loaded right now.</p>`;
      });
    });
  }

  function startEditing(preferences) {
    draft = {
      team: preferences.team ? { id: preferences.team.id, slug: preferences.team.slug, schoolName: preferences.team.schoolName } : null,
      sport: preferences.team?.sport || null,
      gender: preferences.team?.gender || null,
      athletes: preferences.athletes.map((athlete) => ({ ...athlete }))
    };
    dashboard.hidden = true;
    onboarding.hidden = false;
    sportButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mpSport === draft.sport)));
    genderButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mpGender === draft.gender)));
    goToStep(draft.team ? "preferences" : "team");
  }

  // ---- Boot -------------------------------------------------------------

  loadingPanel.hidden = false;
  if (store.hasPreferences()) {
    renderDashboard();
  } else {
    loadingPanel.hidden = true;
    onboarding.hidden = false;
    showOnly(intro);
    intro.hidden = false;
  }
})();
