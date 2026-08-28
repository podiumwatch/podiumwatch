// Homepage-only rendering: the dynamic Upcoming Meets panel, Follow Your
// School (My Podium), and Vote Now. Every element this script touches is
// guarded individually -- there is no single "requiredElements" gate for
// the whole file, since these modules are independent of each other and
// one failing to load must never take the others down with it.
(() => {
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function formatMeetDate(value) {
    if (!value) return { month: "TBD", day: "" };
    const date = new Date(value + "T12:00:00");
    if (Number.isNaN(date.getTime())) return { month: "TBD", day: "" };
    return {
      month: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "America/New_York" }).format(date).toUpperCase(),
      day: String(date.getDate())
    };
  }

  function locationText(meet) {
    return [meet.venue_name, meet.city].filter(Boolean).join(", ");
  }

  // ---- Upcoming Meets panel ------------------------------------------

  const upcomingMeetsList = document.querySelector("[data-upcoming-meets-list]");

  if (upcomingMeetsList && window.PodiumOhioToday) {
    window.PodiumOhioToday.computeOhioToday().then((today) => {
      const upcoming = today.upcoming.slice(0, 3);
      upcomingMeetsList.innerHTML = upcoming.length
        ? upcoming.map((meet) => {
          const chip = formatMeetDate(meet.meet_date);
          const location = locationText(meet);
          return `<a class="home-meet" href="/meetdetail/?slug=${encodeURIComponent(meet.slug)}"><b>${escapeHtml(chip.month)} ${escapeHtml(chip.day)}</b><span><strong>${escapeHtml(meet.name)}</strong><small>${escapeHtml(location || "Location TBD")}</small></span></a>`;
        }).join("")
        : `<p style="padding:14px 0;color:#7a827e;font-size:.8rem;">No upcoming meets are published right now.</p>`;
    }).catch(() => {
      upcomingMeetsList.innerHTML = `<p style="padding:14px 0;color:#7a827e;font-size:.8rem;">Unable to load meets right now. <a href="/meets/">Open the Meet Center</a>.</p>`;
    });
  }

  // ---- Follow Your School (My Podium) -----------------------------------
  // No account system -- "following" a school here saves it through the
  // shared My Podium preference store (public/scripts/my-podium-store.js)
  // rather than a separate key, so picking a school here and picking one
  // in My Podium's own onboarding are the same action, not two. Search
  // reuses the exact same /api/teams/ directory endpoint the full Teams
  // directory page already calls; this never invents a second team
  // dataset. See docs/MY_PODIUM_MASTER_BUILD_PLAN.md, Project 9.
  const mpStore = window.PodiumMyPodiumStore;
  const followPanel = document.querySelector("[data-follow-school-panel]");
  const searchView = document.querySelector("[data-follow-school-search-view]");
  const selectedView = document.querySelector("[data-follow-school-selected-view]");
  const searchInput = document.querySelector("[data-follow-school-input]");
  const resultsBox = document.querySelector("[data-follow-school-results]");

  // Returning-visitor preview (Project 9.2): followed school, next
  // verified meet, newest verified result -- reuses the exact same data
  // adapter /my-podium/ itself calls (my-podium-data.js), not a second
  // query path, so the homepage preview and the full dashboard can never
  // disagree with each other.
  function renderSelected(team) {
    if (!selectedView) return;
    selectedView.innerHTML = `
      <div class="follow-school-selected">
        <strong>${escapeHtml(team.schoolName)}</strong>
        <div data-follow-school-preview style="margin-top:8px;"><small style="color:#7a827e;">Loading your update&hellip;</small></div>
        <div class="follow-school-selected-meta">
          <a href="/team/?slug=${encodeURIComponent(team.slug)}">Open team page &rarr;</a>
        </div>
        <div class="follow-school-actions">
          <a class="button button-primary" href="/my-podium/">Open My Podium</a>
          <button class="button button-outline" type="button" data-follow-school-change>Change school</button>
        </div>
      </div>`;
    selectedView.querySelector("[data-follow-school-change]")?.addEventListener("click", () => {
      mpStore.clearTeam();
      showSearchView();
    });
    const previewBox = selectedView.querySelector("[data-follow-school-preview]");
    if (previewBox && window.PodiumMyPodiumData) {
      window.PodiumMyPodiumData.loadDashboard({ team, athletes: [] }).then((model) => {
        const lines = [];
        if (model.nextMeet) lines.push(`Next meet: <strong>${escapeHtml(model.nextMeet.name)}</strong>`);
        if (model.latestResult) lines.push(`Latest: <strong>${escapeHtml(model.latestResult.name)}</strong>`);
        previewBox.innerHTML = lines.length
          ? `<small>${lines.join(" &middot; ")}</small>`
          : `<small style="color:#7a827e;">No connected meets yet.</small>`;
      }).catch(() => {
        previewBox.innerHTML = "";
      });
    } else if (previewBox) {
      previewBox.innerHTML = "";
    }
  }

  function showSelectedView(team) {
    if (searchView) searchView.hidden = true;
    if (selectedView) selectedView.hidden = false;
    renderSelected(team);
  }

  function showSearchView() {
    if (searchView) searchView.hidden = false;
    if (selectedView) selectedView.hidden = true;
    if (searchInput) searchInput.value = "";
    if (resultsBox) resultsBox.innerHTML = "";
  }

  let searchTimer = null;
  function runSchoolSearch(query) {
    if (!resultsBox) return;
    if (query.trim().length < 2) {
      resultsBox.innerHTML = "";
      return;
    }
    fetch("/api/teams/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ search: query })
    })
      .then((response) => response.json())
      .then((data) => {
        const teams = (Array.isArray(data.teams) ? data.teams : []).slice(0, 8);
        resultsBox.innerHTML = teams.length
          ? teams.map((team) => `<button type="button" class="follow-school-result" data-follow-school-pick="${escapeHtml(team.id)}">${escapeHtml(team.school_name)}${team.city ? ` <span style="font-weight:400;color:#7a827e;">&middot; ${escapeHtml(team.city)}</span>` : ""}</button>`).join("")
          : `<p style="padding:8px 2px;color:#7a827e;font-size:.78rem;">No schools match "${escapeHtml(query)}".</p>`;
        resultsBox.querySelectorAll("[data-follow-school-pick]").forEach((button) => {
          button.addEventListener("click", () => {
            const team = teams.find((item) => item.id === button.dataset.followSchoolPick);
            if (!team) return;
            const saved = mpStore.setTeam({ id: team.id, slug: team.slug, schoolName: team.school_name });
            mpStore.trackEvent("preference_added", { category: "team" });
            showSelectedView(saved.team);
          });
        });
      })
      .catch(() => {
        resultsBox.innerHTML = `<p style="padding:8px 2px;color:#7a827e;font-size:.78rem;">Search is temporarily unavailable.</p>`;
      });
  }

  const PROMO_DISMISSED_KEY = "podiumWatch.myPodium.promoDismissed";
  const promoIntro = document.querySelector("[data-mp-promo-intro]");
  const promoDismiss = document.querySelector("[data-mp-promo-dismiss]");

  if (followPanel && searchView && selectedView && mpStore) {
    followPanel.hidden = false;
    const existing = mpStore.getPreferences().team;
    if (existing) {
      showSelectedView(existing);
      mpStore.trackEvent("my_podium_return_visit", {});
    } else {
      showSearchView();
      // Project 9.1: dismissible once, remembered on this device, never
      // re-shown -- the search box underneath stays fully usable either
      // way, only the promotional copy goes away.
      let dismissed = false;
      try {
        dismissed = window.localStorage.getItem(PROMO_DISMISSED_KEY) === "1";
      } catch {
        dismissed = false;
      }
      if (promoIntro) promoIntro.hidden = dismissed;
      promoDismiss?.addEventListener("click", () => {
        if (promoIntro) promoIntro.hidden = true;
        try {
          window.localStorage.setItem(PROMO_DISMISSED_KEY, "1");
        } catch {
          // Not persisted this time -- it will just show again next visit,
          // which is the safe direction to fail in.
        }
      });
    }
    searchInput?.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      const value = searchInput.value;
      searchTimer = window.setTimeout(() => runSchoolSearch(value), 250);
    });
  }

  // ---- Vote Now -----------------------------------------------------------
  // Shows the site's one currently-active Fan Poll division (cross
  // country boys Division 1 -- the only sport/division combination
  // turned on for voters, see docs/DECISIONS.md 2026-08-06) if voting is
  // genuinely open right now. Hides itself entirely rather than ever
  // showing a closed poll as if it were active, and never invents a
  // closing date the API didn't actually provide.
  const votePanel = document.querySelector("[data-vote-now-panel]");
  const voteBody = document.querySelector("[data-vote-now-body]");

  if (votePanel && voteBody) {
    fetch("/api/fan-poll/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ sport: "cross_country", gender: "boys", division_number: 1 })
    })
      .then((response) => response.json())
      .then((data) => {
        const week = data.week;
        if (!week) return; // No week configured at all -- stay hidden.
        if (week.status === "voting_open") {
          const closes = week.voting_closes ? new Date(week.voting_closes) : null;
          const closesText = closes && !Number.isNaN(closes.getTime())
            ? `Voting closes ${new Intl.DateTimeFormat("en-US", { weekday: "long", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(closes)}`
            : "";
          voteBody.innerHTML = `
            <p class="vote-now-category">Cross Country &middot; Boys Division I</p>
            <p class="vote-now-question">Vote your top 16 teams this week.</p>
            ${closesText ? `<p class="vote-now-meta">${escapeHtml(closesText)}</p>` : ""}
            <a class="button button-primary" href="/fan-poll/cross-country/boys/division-1/">Cast your ballot</a>`;
          votePanel.hidden = false;
        } else if (week.status === "voting_closed" && Array.isArray(data.results) && data.results.length) {
          voteBody.innerHTML = `
            <p class="vote-now-category">Cross Country &middot; Boys Division I</p>
            <p class="vote-now-question">See this week's fan poll results.</p>
            <a class="button button-outline" href="/fan-poll/cross-country/boys/division-1/">View results</a>`;
          votePanel.hidden = false;
        }
        // "scheduled" (voting hasn't opened yet) -- stay hidden rather
        // than show a poll a visitor can't actually do anything with yet.
      })
      .catch(() => {
        // Fan Poll unavailable -- the panel just stays hidden, matching
        // "hide empty homepage modules" rather than showing an error box
        // for a purely optional homepage extra.
      });
  }
})();
