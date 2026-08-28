// Homepage-only rendering: the Ohio Today card, the dynamic Upcoming
// Meets panel, Follow Your School (My Podium), and Vote Now. Every
// element this script touches is guarded individually -- there is no
// single "requiredElements" gate for the whole file, since these four
// modules are independent of each other and one failing to load must
// never take the others down with it.
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

  // ---- Ohio Today card + Upcoming Meets panel (share one fetch) --------

  const ohioTodayHeadline = document.querySelector("[data-ohio-today-headline]");
  const ohioTodayGrid = document.querySelector("[data-ohio-today-grid]");
  const upcomingMeetsList = document.querySelector("[data-upcoming-meets-list]");

  if ((ohioTodayHeadline || ohioTodayGrid || upcomingMeetsList) && window.PodiumOhioToday) {
    window.PodiumOhioToday.computeOhioToday().then((today) => {
      if (ohioTodayHeadline) {
        if (today.todaysMeets.length > 0) {
          ohioTodayHeadline.textContent = today.todaysMeets.length === 1
            ? `1 meet is on today across Ohio.`
            : `${today.todaysMeets.length} meets are on today across Ohio.`;
        } else if (today.nextUpcoming) {
          const chip = formatMeetDate(today.nextUpcoming.meet_date);
          ohioTodayHeadline.textContent = `No meets today. Next up: ${today.nextUpcoming.name} (${chip.month} ${chip.day}).`;
        } else {
          ohioTodayHeadline.textContent = "No meets are scheduled right now.";
        }
      }

      if (ohioTodayGrid) {
        const items = ohioTodayGrid.querySelectorAll(".ohio-today-item");
        // Order matches the static markup: [today, results, this week, (rankings)].
        if (items[0]) {
          items[0].querySelector("strong").textContent = String(today.todaysMeets.length);
        }
        if (items[1]) {
          const newest = today.newestCompleted[0];
          items[1].querySelector("strong").textContent = newest ? newest.name : "None yet";
          if (newest) items[1].href = "/meetdetail/?slug=" + encodeURIComponent(newest.slug);
        }
        if (items[2]) {
          items[2].querySelector("strong").textContent = String(today.upcomingNext7d.length);
        }
      }

      if (upcomingMeetsList) {
        const upcoming = today.upcoming.slice(0, 3);
        upcomingMeetsList.innerHTML = upcoming.length
          ? upcoming.map((meet) => {
            const chip = formatMeetDate(meet.meet_date);
            const location = locationText(meet);
            return `<a class="home-meet" href="/meetdetail/?slug=${encodeURIComponent(meet.slug)}"><b>${escapeHtml(chip.month)} ${escapeHtml(chip.day)}</b><span><strong>${escapeHtml(meet.name)}</strong><small>${escapeHtml(location || "Location TBD")}</small></span></a>`;
          }).join("")
          : `<p style="padding:14px 0;color:#7a827e;font-size:.8rem;">No upcoming meets are published right now.</p>`;
      }
    }).catch(() => {
      if (ohioTodayHeadline) ohioTodayHeadline.textContent = "Meet data is temporarily unavailable.";
      if (upcomingMeetsList) upcomingMeetsList.innerHTML = `<p style="padding:14px 0;color:#7a827e;font-size:.8rem;">Unable to load meets right now. <a href="/meets/">Open the Meet Center</a>.</p>`;
    });
  }

  // ---- Follow Your School (My Podium) -----------------------------------
  // No account system -- "following" a school here just means saving its
  // slug in this device's own localStorage, then linking straight into
  // that team's real, existing public team page. Search reuses the exact
  // same /api/teams/ directory endpoint the full Teams directory page
  // already calls; this never invents a second team dataset.

  const STORAGE_KEY = "podium_followed_school";
  const followPanel = document.querySelector("[data-follow-school-panel]");
  const searchView = document.querySelector("[data-follow-school-search-view]");
  const selectedView = document.querySelector("[data-follow-school-selected-view]");
  const searchInput = document.querySelector("[data-follow-school-input]");
  const resultsBox = document.querySelector("[data-follow-school-results]");

  function loadFollowedSchool() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveFollowedSchool(team) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: team.id, school_name: team.school_name, slug: team.slug, city: team.city, state: team.state }));
    } catch {
      // Storage unavailable (private browsing, quota) -- the button below
      // still works for this one visit, it just won't persist.
    }
  }

  function clearFollowedSchool() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clean up if storage was never available.
    }
  }

  function renderSelected(team) {
    if (!selectedView) return;
    const meta = [];
    if (team.city) meta.push(`${escapeHtml(team.city)}, Ohio`);
    selectedView.innerHTML = `
      <div class="follow-school-selected">
        <strong>${escapeHtml(team.school_name)}</strong>
        <div class="follow-school-selected-meta">
          ${meta.length ? `<span>${meta.join(" &middot; ")}</span>` : ""}
          <a href="/team/?slug=${encodeURIComponent(team.slug)}">Open team page ${team.school_name ? "" : ""}&rarr;</a>
        </div>
        <div class="follow-school-actions">
          <a class="button button-primary" href="/team/?slug=${encodeURIComponent(team.slug)}">Open ${escapeHtml(team.school_name)}</a>
          <button class="button button-outline" type="button" data-follow-school-change>Change school</button>
        </div>
      </div>`;
    selectedView.querySelector("[data-follow-school-change]")?.addEventListener("click", () => {
      clearFollowedSchool();
      showSearchView();
    });
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
            saveFollowedSchool(team);
            showSelectedView(team);
          });
        });
      })
      .catch(() => {
        resultsBox.innerHTML = `<p style="padding:8px 2px;color:#7a827e;font-size:.78rem;">Search is temporarily unavailable.</p>`;
      });
  }

  if (followPanel && searchView && selectedView) {
    followPanel.hidden = false;
    const existing = loadFollowedSchool();
    if (existing && existing.slug) {
      showSelectedView(existing);
    } else {
      showSearchView();
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
