// My Podium's one data adapter -- every card on /my-podium/ and the
// homepage preview reads through this file rather than repeating fetch
// logic per component (Project 3.9). Every request is bounded (one team
// lookup, one call per followed athlete, one poll lookup), every card's
// failure is isolated (Promise.allSettled, not Promise.all), and nothing
// here invents a relationship the underlying data doesn't actually
// support -- see docs/MY_PODIUM_DATA_MAP.md for exactly what each field
// below is allowed to claim.
(() => {
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  async function postJson(url, body) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body || {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

  function dateKey(value) {
    return String(value || "").slice(0, 10);
  }

  function daysBetween(fromKey, toKey) {
    const [fy, fm, fd] = fromKey.split("-").map(Number);
    const [ty, tm, td] = toKey.split("-").map(Number);
    const from = Date.UTC(fy, fm - 1, fd);
    const to = Date.UTC(ty, tm - 1, td);
    return Math.round((to - from) / 86400000);
  }

  function hasRealResults(meet) {
    return Boolean(meet && (meet.results_url || meet.athleticnet_url || meet.milesplit_url || meet.recap_article_url));
  }

  // "today" / "scheduled" / "results_pending" / "results_available" only
  // -- a meet's date is never, by itself, enough to say "live" (rule 10 /
  // Project 4.3). Nothing calls this with a real live signal because no
  // verified sitewide one exists yet (see the data map's §4).
  function meetStatus(meet, todayKey) {
    if (!meet) return null;
    const key = dateKey(meet.meet_date);
    if (key === todayKey) return "today";
    if (key > todayKey) return "scheduled";
    return hasRealResults(meet) ? "results_available" : "results_pending";
  }

  // Sport/gender preference values ("cross_country"/"track_and_field",
  // "boys"/"girls") to the real, differently-cased strings the schedule
  // (sport_scope: "Cross Country"/"Track and Field"/"All") and division
  // columns (cross_country_boys_division, ...) actually use.
  const SPORT_LABEL = { cross_country: "Cross Country", track_and_field: "Track and Field" };

  function divisionColumn(sport, gender) {
    if (sport === "cross_country") return gender === "girls" ? "cross_country_girls_division" : "cross_country_boys_division";
    if (sport === "track_and_field") return gender === "girls" ? "track_girls_division" : "track_boys_division";
    return null;
  }

  function divisionNumberFromLabel(label) {
    const match = String(label || "").match(/([1-5])/);
    return match ? Number(match[1]) : null;
  }

  function matchesScope(connection, sport, gender) {
    const sportLabel = SPORT_LABEL[sport];
    const sportOk = !sportLabel || !connection.sport_scope || connection.sport_scope === "All" || connection.sport_scope === sportLabel;
    const genderOk = !gender || !connection.program_scope || connection.program_scope === "combined" || connection.program_scope === gender;
    return sportOk && genderOk;
  }

  async function loadTeam(team) {
    const detail = await postJson("/api/teams/detail/", { slug: team.slug });
    if (detail.redirected) throw new Error("This team has moved.");
    return detail;
  }

  async function loadAthlete(slug) {
    return postJson("/api/athletes/detail/", { slug });
  }

  async function loadSchoolTopAthlete({ schoolName, divisionNumber, gender }) {
    const data = await postJson("/api/athletes/", {
      school: schoolName,
      division: divisionNumber || undefined,
      gender: gender || undefined,
      page_size: 1
    });
    return (data.athletes && data.athletes[0]) || null;
  }

  async function loadPoll({ sport, gender, divisionNumber }) {
    return postJson("/api/fan-poll/", { sport, gender: gender || "boys", division_number: divisionNumber || 1 });
  }

  function pickNextAndLatest(schedule, sport, gender, todayKey) {
    const scoped = (schedule || []).filter((connection) => connection.meet && matchesScope(connection, sport, gender));
    const meets = scoped.map((connection) => connection.meet);
    const upcoming = meets.filter((meet) => dateKey(meet.meet_date) >= todayKey).sort((a, b) => dateKey(a.meet_date).localeCompare(dateKey(b.meet_date)));
    const past = meets.filter((meet) => dateKey(meet.meet_date) < todayKey).sort((a, b) => dateKey(b.meet_date).localeCompare(dateKey(a.meet_date)));
    return { nextMeet: upcoming[0] || null, latestResult: past[0] || null };
  }

  function classifyDay(todayKey, nextMeet, latestResult) {
    if (nextMeet) {
      const key = dateKey(nextMeet.meet_date);
      if (key === todayKey) return "race_day";
      if (daysBetween(todayKey, key) <= 7) return "meet_approaching";
    }
    if (latestResult) {
      const key = dateKey(latestResult.meet_date);
      if (daysBetween(key, todayKey) <= 3) return "after_meet";
    }
    return "normal";
  }

  // Reads the story list embedded at build time by src/pages/mypodium.mjs
  // (the same real content/stories/*.md data every other page uses) --
  // no fetch, no second dataset. Personalizes only by category (a real,
  // structured field) since story tags are free text, not a verified
  // team/athlete relationship (see the data map's §4).
  function pickStory(sport) {
    const node = document.querySelector("[data-my-podium-stories]");
    if (!node) return null;
    let stories;
    try {
      stories = JSON.parse(node.textContent);
    } catch {
      return null;
    }
    if (!Array.isArray(stories) || !stories.length) return null;
    const label = SPORT_LABEL[sport];
    const matched = label ? stories.find((story) => story.category === label) : null;
    return matched || stories[0];
  }

  async function loadDashboard(preferences) {
    const today = window.PodiumOhioToday ? await window.PodiumOhioToday.computeOhioToday() : null;
    const todayKey = window.PodiumOhioToday ? window.PodiumOhioToday.ohioDateKey() : new Date().toISOString().slice(0, 10);

    const model = {
      todayKey,
      ohioToday: today,
      team: null,
      nextMeet: null,
      latestResult: null,
      ranking: null,
      athletes: [],
      story: pickStory(preferences.team?.sport),
      poll: null,
      dayState: "normal",
      errors: {}
    };

    const jobs = [];

    if (preferences.team) {
      jobs.push(
        loadTeam(preferences.team).then((detail) => {
          const teamRow = detail.team || {};
          const sport = preferences.team.sport;
          const gender = preferences.team.gender;
          const column = divisionColumn(sport, gender);
          const divisionLabel = column ? teamRow[column] : null;
          model.team = {
            ...preferences.team,
            mascot: teamRow.mascot || null,
            city: teamRow.city || null,
            primaryColor: teamRow.primary_color || null,
            secondaryColor: teamRow.secondary_color || null,
            logoUrl: teamRow.logo_url || null,
            divisionLabel: divisionLabel || null,
            divisionNumber: divisionNumberFromLabel(divisionLabel)
          };
          const { nextMeet, latestResult } = pickNextAndLatest(detail.schedule, sport, gender, todayKey);
          model.nextMeet = nextMeet;
          model.latestResult = latestResult;
        }).catch(() => { model.errors.team = true; })
      );
    }

    if (preferences.athletes.length) {
      jobs.push(
        Promise.allSettled(preferences.athletes.slice(0, 8).map((athlete) => athlete.slug ? loadAthlete(athlete.slug) : Promise.reject(new Error("No slug")))).then((results) => {
          model.athletes = results.map((result, index) => {
            const source = preferences.athletes[index];
            if (result.status !== "fulfilled") return { ...source, loadFailed: true };
            const profile = result.value;
            const ranking = (profile.rankings || [])[0] || null;
            const performance = (profile.performances || [])[0] || null;
            return {
              ...source,
              displayName: profile.profile?.display_name || source.displayName,
              ranking: ranking ? {
                rank: ranking.rank,
                title: ranking.ranking_title,
                href: ranking.ranking_href,
                updatedDate: ranking.updated_date,
                previousRank: ranking.previous_rank
              } : null,
              topPerformance: performance ? {
                eventName: performance.event_name,
                markText: performance.mark_text,
                meetName: performance.meet_name,
                meetDate: performance.meet_date
              } : null
            };
          });
        })
      );
    }

    await Promise.allSettled(jobs);

    // Ranking card: a followed athlete's own real rank takes priority
    // (a direct identifier match); otherwise, if only a team is
    // followed, look up that school's own top-ranked athlete in the
    // derived division -- still a real, verified relationship (school
    // name + division, both confirmed fields), never invented.
    const rankedAthlete = model.athletes.find((athlete) => athlete.ranking);
    if (rankedAthlete) {
      model.ranking = { ...rankedAthlete.ranking, athleteName: rankedAthlete.displayName, source: "followed_athlete" };
    } else if (model.team && !model.errors.team) {
      try {
        const top = await loadSchoolTopAthlete({
          schoolName: model.team.schoolName,
          divisionNumber: model.team.divisionNumber,
          gender: model.team.gender
        });
        if (top && top.ranking) {
          model.ranking = {
            rank: top.ranking.rank,
            title: top.ranking.title,
            href: top.ranking.href,
            updatedDate: top.ranking.updated_date,
            previousRank: null,
            athleteName: top.display_name,
            source: "school_top"
          };
        }
      } catch {
        model.errors.ranking = true;
      }
    }

    // Poll: the only reliably active poll today is Cross Country (see
    // the data map's §4) -- shown for a cross-country follower, or for
    // anyone with no team followed yet (a reasonable, honestly-labeled
    // default, matching the homepage's own Vote Now banner). A track
    // and field follower sees an honest empty state instead of an
    // unrelated cross-country ballot.
    const pollSport = !preferences.team || preferences.team.sport === "cross_country" ? "cross_country" : null;
    if (pollSport) {
      try {
        model.poll = await loadPoll({
          sport: pollSport,
          gender: preferences.team?.gender || "boys",
          divisionNumber: preferences.team?.divisionNumber || 1
        });
      } catch {
        model.errors.poll = true;
      }
    }

    model.nextMeetStatus = meetStatus(model.nextMeet, todayKey);
    model.latestResultStatus = meetStatus(model.latestResult, todayKey);
    model.dayState = classifyDay(todayKey, model.nextMeet, model.latestResult);

    return model;
  }

  window.PodiumMyPodiumData = { loadDashboard, hasRealResults, meetStatus, dateKey, escapeHtml };
})();
