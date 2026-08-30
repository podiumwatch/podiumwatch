(() => {
  const root = document.querySelector("[data-athlete-profile]");

  if (!root) {
    return;
  }

  const message = root.querySelector("[data-athlete-profile-message]");
  const content = root.querySelector("[data-athlete-profile-content]");
  const identity = root.querySelector("[data-athlete-identity]");
  const source = root.querySelector("[data-athlete-source]");
  const rankings = root.querySelector("[data-athlete-rankings]");
  const performances = root.querySelector("[data-athlete-performances]");
  const latestUpcomingPanel = root.querySelector("[data-athlete-latest-upcoming-panel]");
  const latestResultEl = root.querySelector("[data-athlete-latest-result]");
  const upcomingMeetEl = root.querySelector("[data-athlete-upcoming-meet]");
  const bestPanel = root.querySelector("[data-athlete-best-panel]");
  const bestPerformancesEl = root.querySelector("[data-athlete-best-performances]");
  const progressionPanel = root.querySelector("[data-athlete-progression-panel]");
  const progressionEl = root.querySelector("[data-athlete-progression]");
  const schools = root.querySelector("[data-athlete-schools]");
  const stories = root.querySelector("[data-athlete-stories]");
  const recruitingPanel = root.querySelector("[data-athlete-recruiting-panel]");
  const recruiting = root.querySelector("[data-athlete-recruiting]");
  const socialPanel = root.querySelector("[data-athlete-social-panel]");
  const social = root.querySelector("[data-athlete-social]");
  const recruitRatingPanel = root.querySelector("[data-athlete-recruit-rating-panel]");
  const recruitRating = root.querySelector("[data-athlete-recruit-rating]");
  const recruitTimelinePanel = root.querySelector("[data-athlete-recruit-timeline-panel]");
  const recruitTimeline = root.querySelector("[data-athlete-recruit-timeline]");
  const mediaPanel = root.querySelector("[data-athlete-media-panel]");
  const media = root.querySelector("[data-athlete-media]");
  const pathPanel = root.querySelector("[data-athlete-path-panel]");
  const pathTeam = root.querySelector("[data-athlete-path-team]");
  const pathRoadmap = root.querySelector("[data-athlete-path-roadmap]");
  const pathNote = root.querySelector("[data-athlete-path-note]");
  const pathSource = root.querySelector("[data-athlete-path-source]");
  const correctionForm = root.querySelector("[data-athlete-correction-form]");
  const urlSlug = new URLSearchParams(window.location.search).get("slug") || "";
  const slug = root.dataset.athleteSlug || urlSlug || window.PODIUM_ATHLETE_SEED?.profile_slug || "";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showMessage(text, tone = "success") {
    message.textContent = text;
    message.dataset.tone = tone;
  }

  function titleCase(value) {
    return String(value || "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatDate(value) {
    if (!value) {
      return "Date not listed";
    }

    const date = new Date(String(value).length === 10 ? `${value}T12:00:00` : value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
  }

  function initials(name) {
    return String(name || "PW")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  }

  const SPORT_ORDER = ["cross_country", "indoor_track", "outdoor_track"];
  const SPORT_LABEL = {
    cross_country: "Cross Country",
    indoor_track: "Indoor Track",
    outdoor_track: "Outdoor Track"
  };

  function sportLabel(sport) {
    return SPORT_LABEL[sport] || titleCase(sport);
  }

  function groupBy(items, keyFn) {
    const map = new Map();
    items.forEach((item) => {
      const key = keyFn(item);
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    });
    return map;
  }

  // Sports not in SPORT_ORDER (there shouldn't be any -- athlete_performances.sport
  // is a database check constraint -- but this keeps a future addition from
  // silently disappearing rather than crashing) are appended after the three
  // known sports rather than dropped.
  function orderedSportKeys(bySport) {
    const known = SPORT_ORDER.filter((sport) => bySport.has(sport));
    const other = [...bySport.keys()].filter((sport) => !SPORT_ORDER.includes(sport)).sort();
    return [...known, ...other];
  }

  function emptyMarkup(title, description) {
    return '<div class="athlete-profile-empty"><h3>' + escapeHtml(title) + "</h3><p>" + escapeHtml(description) + "</p></div>";
  }

  function link(url, label) {
    if (!url) {
      return "";
    }

    return '<a class="text-link" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(label) + "</a>";
  }

  function renderIdentity(data) {
    const profile = data.profile || {};
    const school = data.school?.school_name || data.team?.school_name || "School not listed";
    const teamLink = data.team?.slug
      ? '<a class="text-link" href="/team/?slug=' + encodeURIComponent(data.team.slug) + '">Open team profile</a>'
      : "";
    const image = profile.photo_url
      ? '<img class="athlete-profile-photo" src="' + escapeHtml(profile.photo_url) + '" alt="' + escapeHtml(profile.display_name) + '" width="112" height="112">'
      : '<div class="athlete-profile-placeholder" aria-hidden="true">' + escapeHtml(initials(profile.display_name)) + "</div>";
    const statusTone = profile.verified
      ? "verified"
      : profile.verification_status === "editorial_source_linked"
        ? "editorial"
        : "muted";

    identity.innerHTML =
      '<div class="athlete-profile-identity">' +
        image +
        "<div>" +
          '<p class="eyebrow">Ohio athlete profile</p>' +
          "<h2>" + escapeHtml(profile.display_name) + "</h2>" +
          '<p class="athlete-card-school">' + escapeHtml(school) + "</p>" +
          '<div class="athlete-profile-badges">' +
            '<span class="athlete-profile-badge" data-tone="' + escapeHtml(statusTone) + '">' + escapeHtml(data.status?.label || titleCase(profile.verification_status)) + "</span>" +
            (profile.recruiting_enabled ? '<span class="athlete-profile-badge">Recruiting information approved</span>' : "") +
            (profile.college_commitment_verified ? '<span class="athlete-profile-badge">Commitment verified</span>' : "") +
          "</div>" +
          '<div class="athlete-profile-facts">' +
            '<div class="athlete-profile-fact"><span>Graduation year</span><strong>' + escapeHtml(profile.graduation_year || "Not listed") + "</strong></div>" +
            '<div class="athlete-profile-fact"><span>Program</span><strong>' + escapeHtml(titleCase(profile.gender)) + "</strong></div>" +
            '<div class="athlete-profile-fact"><span>Primary events</span><strong>' + escapeHtml((profile.primary_events || []).join(", ") || "Not listed") + "</strong></div>" +
            '<div class="athlete-profile-fact"><span>College commitment</span><strong>' + escapeHtml(profile.college_commitment || "Not listed") + "</strong></div>" +
          "</div>" +
          (profile.bio ? "<p style=\"margin-top:16px\">" + escapeHtml(profile.bio) + "</p>" : "") +
          (teamLink ? '<div style="margin-top:15px">' + teamLink + "</div>" : "") +
        "</div>" +
      "</div>";
  }

  function renderSource(data) {
    source.innerHTML =
      '<p class="eyebrow">Source and verification</p>' +
      "<h2>" + escapeHtml(data.status?.label || "Source linked profile") + "</h2>" +
      "<p>" + escapeHtml(data.status?.detail || data.status?.description || data.source_note || "Review each item for its source label.") + "</p>" +
      '<p style="margin-top:12px"><strong>Important:</strong> A Podium Watch ranking mark is an editorial snapshot. It is not automatically a verified personal best.</p>';
  }

  function renderRankings(items) {
    rankings.innerHTML = items.length
      ? items.map((item) => (
          '<article class="athlete-profile-entry">' +
            '<div class="athlete-profile-entry-top"><h3>No. ' + escapeHtml(item.rank) + " | " + escapeHtml(item.ranking_title) + '</h3><span class="athlete-profile-badge" data-tone="editorial">Editorial ranking</span></div>' +
            '<p class="athlete-profile-entry-meta">' + escapeHtml([item.division, item.event_name, item.mark_snapshot, formatDate(item.updated_date)].filter(Boolean).join(" | ")) + "</p>" +
            (item.explanation ? "<p>" + escapeHtml(item.explanation) + "</p>" : "") +
            '<p><strong>Source:</strong> ' + escapeHtml(item.source_label || "Podium Watch ranking analysis") + "</p>" +
            (item.ranking_href ? '<a class="text-link" href="' + escapeHtml(item.ranking_href) + '">Open ranking</a>' : "") +
          "</article>"
        )).join("")
      : emptyMarkup("No ranking links yet", "Published Podium Watch rankings connected to this athlete will appear here.");
  }

  // Best performances by sport (requirement 3 -- personal records
  // separated into cross country/indoor track/outdoor track). Sourced
  // directly from athlete_best_performances, a SQL view that already
  // computes one row per profile+event+sport from verified/source-linked,
  // public, non-archived, official-or-reviewed performances -- this
  // function only groups and renders what the API already returns, no
  // additional computation.
  function renderBestPerformances(items) {
    bestPanel.hidden = !items.length;

    if (!items.length) {
      bestPerformancesEl.innerHTML = "";
      return;
    }

    const bySport = groupBy(items, (item) => item.sport);

    bestPerformancesEl.innerHTML = orderedSportKeys(bySport).map((sport) => {
      const rows = bySport.get(sport).slice().sort((a, b) => String(a.event_name || "").localeCompare(String(b.event_name || "")));

      return (
        '<div class="athlete-sport-group"><h3>' + escapeHtml(sportLabel(sport)) + "</h3>" +
        '<div class="table-scroll"><table><thead><tr><th>Event</th><th>Mark</th><th>Meet</th><th>Date</th><th>Source</th></tr></thead><tbody>' +
        rows.map((item) => (
          "<tr>" +
          '<td data-label="Event">' + escapeHtml(item.event_name) + "</td>" +
          '<td data-label="Mark">' + escapeHtml(item.mark_text) + "</td>" +
          '<td data-label="Meet">' + escapeHtml(item.meet_name || "Not listed") + "</td>" +
          '<td data-label="Date">' + escapeHtml(formatDate(item.meet_date)) + "</td>" +
          '<td data-label="Source">' + (item.source_url ? link(item.source_url, item.source_label || "Source") : escapeHtml(item.source_label || "Not listed")) + "</td>" +
          "</tr>"
        )).join("") +
        "</tbody></table></div></div>"
      );
    }).join("");
  }

  // Season best (requirement 6, the SB half): athlete_best_performances only
  // gives the all-time PR per sport+event, not a per-season best, so this
  // computes it client-side from the already-fetched performances array.
  // Direction (lower time is better vs. higher distance/height/points is
  // better) is only known for an event that already has a qualifying
  // all-time-best row (bestByKey carries its measurement_type) -- for any
  // event with performances but no qualifying best yet, this intentionally
  // skips the season-best computation rather than guess a direction.
  function computeSeasonBests(items, bestByKey) {
    const groups = new Map();

    items.forEach((item) => {
      if (!item.event_key) {
        return;
      }

      const best = bestByKey.get(`${item.sport}|${item.event_key}`);

      if (!best || !best.measurement_type) {
        return;
      }

      const value = Number(item.mark_value);

      if (!Number.isFinite(value)) {
        return;
      }

      const ascending = best.measurement_type === "time";
      const groupKey = `${item.sport}|${item.event_key}|${item.season_year}`;
      const current = groups.get(groupKey);

      if (!current || (ascending ? value < current.value : value > current.value)) {
        groups.set(groupKey, { value, id: item.id });
      }
    });

    return groups;
  }

  // All-time PR (requirement 6, the PR half): flags a performance row as
  // the athlete's all-time best for its sport+event by an exact match
  // against athlete_best_performances on mark, meet name, and meet date --
  // the view is itself derived from these same rows, so a true PR row
  // matches on all three; this never guesses which of several identical
  // marks is "the" PR beyond what the view already decided.
  function isAllTimePr(item, bestByKey) {
    const best = bestByKey.get(`${item.sport}|${item.event_key}`);
    return Boolean(
      best &&
      item.mark_text === best.mark_text &&
      item.meet_name === best.meet_name &&
      item.meet_date === best.meet_date
    );
  }

  // Complete results grouped by sport and season (requirement 4), each
  // group in its own .table-scroll table -- the site's existing
  // zero-horizontal-overflow responsive table pattern (a table that
  // scrolls above 700px, one card per row below it via data-label).
  function renderPerformances(items, bestPerformances) {
    if (!items.length) {
      performances.innerHTML = emptyMarkup("No verified performances yet", "Ranking snapshots are not copied into this section. Only separately sourced performance records appear here.");
      return;
    }

    const bestByKey = new Map((bestPerformances || []).map((best) => [`${best.sport}|${best.event_key}`, best]));
    const seasonBests = computeSeasonBests(items, bestByKey);
    const bySport = groupBy(items, (item) => item.sport);

    performances.innerHTML = orderedSportKeys(bySport).map((sport) => {
      const bySeason = groupBy(bySport.get(sport), (item) => item.season_year || "Unknown");
      const seasons = [...bySeason.keys()].sort((a, b) => Number(b) - Number(a) || String(b).localeCompare(String(a)));

      const seasonBlocks = seasons.map((season) => {
        const rows = bySeason.get(season).slice().sort((a, b) => String(b.meet_date || "").localeCompare(String(a.meet_date || "")));
        const rowsHtml = rows.map((item) => {
          const groupKey = `${item.sport}|${item.event_key}|${item.season_year}`;
          const seasonBest = seasonBests.get(groupKey);
          const isPr = isAllTimePr(item, bestByKey);
          const isSb = Boolean(seasonBest && seasonBest.id === item.id) && !isPr;
          const badge = isPr ? "PR" : (isSb ? "SB" : "");

          return (
            "<tr>" +
            '<td data-label="Event">' + escapeHtml(item.event_name) + "</td>" +
            '<td data-label="Mark">' + escapeHtml(item.mark_text) + (badge ? ' <span class="athlete-profile-badge" data-tone="verified">' + escapeHtml(badge) + "</span>" : "") + "</td>" +
            '<td data-label="Meet">' + escapeHtml(item.meet_name || "Not listed") + "</td>" +
            '<td data-label="Date">' + escapeHtml(formatDate(item.meet_date)) + "</td>" +
            '<td data-label="Place">' + escapeHtml(item.place || "Not listed") + "</td>" +
            '<td data-label="Status"><span class="athlete-profile-badge" data-tone="' + (item.verification_status === "verified" ? "verified" : "muted") + '">' + escapeHtml(titleCase(item.verification_status)) + "</span></td>" +
            '<td data-label="Source">' + (item.source_url ? link(item.source_url, item.source_label || "Source") : escapeHtml(item.source_label || "Not listed")) + "</td>" +
            "</tr>"
          );
        }).join("");

        return (
          '<div class="athlete-season-group"><h4>' + escapeHtml(season) + " season</h4>" +
          '<div class="table-scroll"><table><thead><tr><th>Event</th><th>Mark</th><th>Meet</th><th>Date</th><th>Place</th><th>Status</th><th>Source</th></tr></thead><tbody>' +
          rowsHtml +
          "</tbody></table></div></div>"
        );
      }).join("");

      return '<div class="athlete-sport-group"><h3>' + escapeHtml(sportLabel(sport)) + "</h3>" + seasonBlocks + "</div>";
    }).join("");
  }

  // Progression by event and season (requirement 8) -- a simple
  // chronological table per event, not a chart, computed client-side from
  // the same already-fetched performances array.
  function renderProgression(items) {
    const eligible = items.filter((item) => item.event_key);
    progressionPanel.hidden = !eligible.length;

    if (!eligible.length) {
      progressionEl.innerHTML = "";
      return;
    }

    const byEvent = groupBy(eligible, (item) => `${item.sport}|${item.event_key}|${item.event_name}`);
    const keys = [...byEvent.keys()].sort();

    progressionEl.innerHTML = keys.map((key) => {
      const eventName = key.split("|").slice(2).join("|");
      const rows = byEvent.get(key).slice().sort((a, b) => (
        `${a.season_year || 0}${a.meet_date || ""}`.localeCompare(`${b.season_year || 0}${b.meet_date || ""}`)
      ));

      return (
        '<div class="athlete-sport-group"><h3>' + escapeHtml(eventName) + "</h3>" +
        '<div class="table-scroll"><table><thead><tr><th>Season</th><th>Mark</th><th>Meet</th><th>Date</th></tr></thead><tbody>' +
        rows.map((item) => (
          "<tr>" +
          '<td data-label="Season">' + escapeHtml(item.season_year || "Unknown") + "</td>" +
          '<td data-label="Mark">' + escapeHtml(item.mark_text) + "</td>" +
          '<td data-label="Meet">' + escapeHtml(item.meet_name || "Not listed") + "</td>" +
          '<td data-label="Date">' + escapeHtml(formatDate(item.meet_date)) + "</td>" +
          "</tr>"
        )).join("") +
        "</tbody></table></div></div>"
      );
    }).join("");
  }

  // Latest result (requirement 7, first half) -- the most recent entry in
  // the already-fetched performances array, no new query.
  function renderLatestResult(items) {
    const latest = items.length
      ? items.slice().sort((a, b) => String(b.meet_date || "").localeCompare(String(a.meet_date || "")))[0]
      : null;

    if (!latest) {
      latestResultEl.innerHTML = "";
      return false;
    }

    latestResultEl.innerHTML =
      '<div class="athlete-meet-card"><p class="eyebrow">Latest result</p><h3>' +
      escapeHtml(latest.event_name) + " | " + escapeHtml(latest.mark_text) +
      "</h3><p>" + escapeHtml([latest.meet_name, formatDate(latest.meet_date)].filter(Boolean).join(" | ")) + "</p></div>";
    return true;
  }

  // Upcoming meet (requirement 7, second half) -- the athlete's team's
  // next scheduled meet, reusing the exact team_meet_connections lookup
  // already fetched by /api/teams/detail/ for My Podium's data adapter
  // (public/scripts/my-podium-data.js's loadTeam/pickNextAndLatest), not a
  // new endpoint. Best-effort: a missing team, a moved/unpublished team
  // page, or a network failure all just leave this card empty.
  async function renderUpcomingMeet(data) {
    const teamSlug = data.team?.slug;

    if (!teamSlug) {
      upcomingMeetEl.innerHTML = "";
      return false;
    }

    try {
      const response = await fetch("/api/teams/detail/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ slug: teamSlug })
      });
      const detail = await response.json().catch(() => ({}));

      if (!response.ok || detail.redirected) {
        upcomingMeetEl.innerHTML = "";
        return false;
      }

      const todayKey = new Date().toISOString().slice(0, 10);
      const schedule = Array.isArray(detail.schedule) ? detail.schedule : [];
      const nextMeet = schedule
        .map((connection) => connection.meet)
        .filter((meet) => meet && String(meet.meet_date || "").slice(0, 10) >= todayKey)
        .sort((a, b) => String(a.meet_date).localeCompare(String(b.meet_date)))[0] || null;

      if (!nextMeet) {
        upcomingMeetEl.innerHTML = "";
        return false;
      }

      upcomingMeetEl.innerHTML =
        '<div class="athlete-meet-card"><p class="eyebrow">Upcoming meet</p><h3>' + escapeHtml(nextMeet.name) + "</h3>" +
        "<p>" + escapeHtml(formatDate(nextMeet.meet_date)) + "</p>" +
        (nextMeet.slug ? '<a class="text-link" href="/meetdetail/?slug=' + encodeURIComponent(nextMeet.slug) + '">Meet Center</a>' : "") +
        "</div>";
      return true;
    } catch {
      upcomingMeetEl.innerHTML = "";
      return false;
    }
  }

  function renderSchools(items, data) {
    schools.innerHTML = items.length
      ? items.map((item) => (
          '<article class="athlete-profile-entry">' +
            '<div class="athlete-profile-entry-top"><h3>' + escapeHtml(item.school_name_snapshot) + '</h3><span class="athlete-profile-badge" data-tone="' + (item.verified ? "verified" : "muted") + '">' + (item.current ? "Current" : "History") + "</span></div>" +
            '<p class="athlete-profile-entry-meta">' + escapeHtml([item.grade_label, item.season_start_year && item.season_end_year ? `${item.season_start_year} season` : "", item.verified ? "Verified school connection" : "Source linked school connection"].filter(Boolean).join(" | ")) + "</p>" +
          "</article>"
        )).join("")
      : emptyMarkup("No school history yet", data.school?.school_name || "A school connection has not been published.");
  }

  function renderStories(items) {
    stories.innerHTML = items.length
      ? items.map((item) => (
          '<article class="athlete-profile-entry">' +
            "<h3>" + escapeHtml(item.story_title || item.story_slug) + "</h3>" +
            '<p class="athlete-profile-entry-meta">' + escapeHtml([titleCase(item.relationship), formatDate(item.story_date)].filter(Boolean).join(" | ")) + "</p>" +
            '<a class="text-link" href="' + escapeHtml(item.story_href || "/stories/" + item.story_slug + "/") + '">Read story</a>' +
          "</article>"
        )).join("")
      : emptyMarkup("No connected stories yet", "Podium Watch articles and awards connected to this profile will appear here.");
  }

  function renderRecruiting(data) {
    const info = data.recruiting;

    recruitingPanel.hidden = !info;

    if (!info) {
      recruiting.innerHTML = "";
      return;
    }

    recruiting.innerHTML =
      '<article class="athlete-profile-entry">' +
        "<h3>" + escapeHtml(info.headline || "Approved recruiting information") + "</h3>" +
        '<p><strong>Events:</strong> ' + escapeHtml((info.primary_events || []).join(", ") || "Not listed") + "</p>" +
        (info.college_interests ? '<p><strong>College interests:</strong> ' + escapeHtml(info.college_interests) + "</p>" : "") +
        "<p>" + escapeHtml(info.contact_label) + "</p>" +
      "</article>";
  }

  function renderSocial(items) {
    socialPanel.hidden = !items.length;
    social.innerHTML = items.map((item) => (
      '<article class="athlete-profile-entry"><h3>' + escapeHtml(item.label || titleCase(item.platform)) + '</h3><a class="text-link" href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer">Open approved link</a></article>'
    )).join("");
  }

  function starMarkup(stars) {
    const count = Number(stars) || 0;
    const items = [];

    for (let index = 1; index <= 5; index += 1) {
      items.push(
        '<span' + (index > count ? ' data-empty="true"' : "") + '>★</span>'
      );
    }

    return '<span class="athlete-recruit-stars" aria-label="' +
      escapeHtml(count + " out of 5 stars") +
      '">' + items.join("") + "</span>";
  }

  function rankMovementText(current, previous) {
    if (!Number.isFinite(Number(current)) || !Number.isFinite(Number(previous))) {
      return "";
    }

    const change = Number(previous) - Number(current);

    if (change > 0) return " (up " + change + ")";
    if (change < 0) return " (down " + Math.abs(change) + ")";
    return " (no change)";
  }

  function renderMedia(items) {
    mediaPanel.hidden = !items.length;

    if (!items.length) {
      media.innerHTML = "";
      return;
    }

    media.innerHTML = items.map((item) => (
      '<article class="athlete-profile-entry">' +
        '<div class="athlete-profile-entry-top"><h3>' + escapeHtml(item.title || titleCase(item.content_type)) + '</h3>' +
        (item.featured ? '<span class="athlete-profile-badge">Featured</span>' : "") +
        "</div>" +
        (item.caption ? "<p>" + escapeHtml(item.caption) + "</p>" : "") +
        (item.credit ? '<p class="athlete-profile-entry-meta">Credit: ' + escapeHtml(item.credit) + "</p>" : "") +
        link(item.url, "Open " + titleCase(item.content_type).toLowerCase()) +
      "</article>"
    )).join("");
  }

  function renderRecruitRating(items) {
    const rating = items?.[0] || null;
    recruitRatingPanel.hidden = !rating;

    if (!rating) {
      recruitRating.innerHTML = "";
      return;
    }

    recruitRating.innerHTML =
      '<div class="athlete-recruit-rating-top">' +
        '<span class="athlete-recruit-score">' +
          escapeHtml(Number(rating.rating_score).toFixed(0)) +
        "</span>" +
        "<div>" +
          starMarkup(rating.star_rating) +
          "<h3>" + escapeHtml(rating.star_label || "Podium Watch recruit rating") + "</h3>" +
          '<p class="athlete-profile-entry-meta">' +
            escapeHtml([
              titleCase(rating.event_group),
              rating.primary_event_key ? titleCase(rating.primary_event_key) : "",
              "Class of " + rating.graduation_year,
              "Updated " + formatDate(rating.updated_at)
            ].filter(Boolean).join(" | ")) +
          "</p>" +
        "</div>" +
        '<a class="button button-outline" href="/recruiting/methodology/">How ratings work</a>' +
      "</div>" +
      '<div class="athlete-recruit-ranks">' +
        "<div><span>Ohio class rank</span><strong>No. " +
          escapeHtml(rating.state_class_rank || "—") +
          escapeHtml(rankMovementText(rating.state_class_rank, rating.previous_state_class_rank)) +
        "</strong></div>" +
        "<div><span>Event group rank</span><strong>No. " +
          escapeHtml(rating.event_group_rank || "—") +
          escapeHtml(rankMovementText(rating.event_group_rank, rating.previous_event_group_rank)) +
        "</strong></div>" +
      "</div>" +
      (rating.evaluation ? "<p>" + escapeHtml(rating.evaluation) + "</p>" : "") +
      (rating.strengths ? "<p><strong>Strengths:</strong> " + escapeHtml(rating.strengths) + "</p>" : "") +
      '<p class="athlete-recruit-warning"><strong>Editorial rating:</strong> This is a Podium Watch recruiting projection based on sourced performance evidence. It is not an official college offer or scholarship guarantee.</p>';
  }

  function renderRecruitTimeline(items) {
    recruitTimelinePanel.hidden = !items.length;

    if (!items.length) {
      recruitTimeline.innerHTML = "";
      return;
    }

    recruitTimeline.innerHTML = items.map((item) =>
      '<article class="athlete-profile-entry">' +
        '<div class="athlete-profile-entry-top"><h3>' +
          escapeHtml(titleCase(item.activity_type) + " | " + item.college_name) +
        '</h3><span class="athlete-profile-badge">' +
          escapeHtml(titleCase(item.verification_status)) +
        "</span></div>" +
        '<p class="athlete-profile-entry-meta">' +
          escapeHtml([
            item.college_division,
            item.event_group ? titleCase(item.event_group) : "",
            formatDate(item.activity_date)
          ].filter(Boolean).join(" | ")) +
        "</p>" +
        '<p><strong>Source:</strong> ' + escapeHtml(item.source_label) + "</p>" +
        link(item.source_url, "Open recruiting source") +
      "</article>"
    ).join("");
  }

  // The athlete-page "Path to State" panel -- one gender's roadmap (the
  // athlete's own), using the same shared renderer the team page uses.
  // data.path_to_state is { path, athlete_view } | null: null whenever
  // the athlete's gender is unspecified, there's no school/team to build
  // a path from, or install/10_PATH_TO_STATE.sql hasn't been run yet
  // (api/athletes/detail.js already guards that case server-side).
  function renderPath(data) {
    const view = data.path_to_state;

    if (!view || !view.path || !view.path.available) {
      pathPanel.hidden = true;
      return;
    }

    const path = view.path;
    const genderLabel = path.gender === "boys" ? "Boys" : "Girls";
    const teamName = data.team?.school_name || data.school?.school_name || "";
    const divisionBit = path.division_label ? " · " + path.division_label : "";
    pathTeam.textContent = ("Following " + teamName + " " + genderLabel + " cross country" + divisionBit).trim();

    const rendered = window.PodiumPathToState
      ? window.PodiumPathToState.renderRoadmap(pathRoadmap, path)
      : false;
    pathPanel.hidden = !rendered;

    if (!rendered) {
      return;
    }

    pathSource.textContent = path.source_note || "";

    const note = view.athlete_view?.note || null;
    pathNote.hidden = !note;
    pathNote.textContent = note || "";
  }

  async function render(data) {
    renderIdentity(data);
    renderSource(data);
    renderBestPerformances(data.best_performances || []);
    const hasLatest = renderLatestResult(data.performances || []);
    const hasUpcoming = await renderUpcomingMeet(data);
    latestUpcomingPanel.hidden = !hasLatest && !hasUpcoming;
    renderRankings(data.rankings || []);
    renderPerformances(data.performances || [], data.best_performances || []);
    renderProgression(data.performances || []);
    renderSchools(data.school_history || [], data);
    renderStories(data.stories || []);
    renderRecruiting(data);
    renderSocial(data.social_links || []);
    renderRecruitRating(data.recruit_ratings || []);
    renderRecruitTimeline(data.recruiting_activity || []);
    renderMedia(data.content_items || []);
    renderPath(data);
    content.hidden = false;
    showMessage(data.source_note || "Athlete profile loaded.", data.source_mode === "bundled_editorial_seed" ? "warning" : "success");
  }

  function fallbackDataFromSeed(seed) {
    return {
      source_mode: "bundled_editorial_seed",
      profile: {
        id: null,
        slug: seed.profile_slug,
        display_name: seed.display_name,
        first_name: seed.first_name,
        last_name: seed.last_name,
        preferred_name: null,
        gender: seed.gender,
        graduation_year: seed.graduation_year,
        graduation_year_source:
          seed.graduation_year_source,
        athlete_status: "active",
        bio: null,
        photo_url: null,
        hometown: null,
        college_commitment: null,
        college_commitment_verified: false,
        verified: false,
        verification_status:
          "editorial_source_linked",
        recruiting_enabled: false,
        recruiting_headline: null,
        primary_events: [seed.event],
        college_interests: null,
        recruiting_contact_route: "none",
        updated_at: seed.ranking?.updated_date
      },
      status: {
        label:
          "Podium Watch ranking source linked",
        tone: "editorial",
        detail:
          "This profile was created from a Podium Watch editorial ranking. Ranking order and mark snapshots are analysis, not official OHSAA results."
      },
      school: {
        id: null,
        ohsaa_school_id: seed.ohsaa_school_id,
        school_name:
          seed.official_school_name ||
          seed.school_name,
        city: seed.school_city,
        athletic_district:
          seed.athletic_district
      },
      team: null,
      school_history: [
        {
          id: null,
          school_name_snapshot:
            seed.school_name,
          season_start_year:
            seed.season_year,
          season_end_year:
            seed.season_year,
          grade_label: seed.grade_label,
          current: true,
          verified: false
        }
      ],
      performances: [],
      rankings: [
        {
          id: null,
          rank: seed.ranking?.rank,
          previous_rank:
            seed.ranking?.previous_rank,
          ranking_title:
            seed.ranking?.title,
          ranking_slug:
            seed.ranking?.ranking_slug,
          ranking_href:
            seed.ranking?.ranking_href,
          ranking_type:
            seed.ranking?.ranking_type,
          sport: seed.sport,
          gender: seed.gender,
          division: seed.division,
          division_number:
            seed.division_number,
          season_year: seed.season_year,
          event_name: seed.event,
          mark_snapshot:
            seed.ranking?.mark_snapshot,
          explanation:
            seed.ranking?.explanation,
          source_label:
            seed.ranking?.source_label,
          updated_date:
            seed.ranking?.updated_date,
          editorial_only: true
        }
      ],
      stories: [],
      social_links: [],
      recruiting: null,
      recruit_ratings: [],
      recruiting_activity: [],
      best_performances: [],
      content_items: [],
      source_note:
        "This profile is using the bundled Podium Watch editorial ranking seed. No verified performance history has been imported."
    };
  }

  async function load() {
    if (!slug) {
      showMessage("Choose an athlete from the athlete directory.", "error");
      return;
    }

    try {
      const response = await fetch("/api/athletes/detail/?slug=" + encodeURIComponent(slug), {
        headers: { Accept: "application/json" }
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const requestError = new Error(
          payload.error ||
          "The athlete profile could not be loaded."
        );
        requestError.status = response.status;
        requestError.fromApi = Boolean(payload.error);
        throw requestError;
      }

      if (payload.merged && payload.redirect_slug) {
        window.location.replace("/athlete/?slug=" + encodeURIComponent(payload.redirect_slug));
        return;
      }

      await render(payload);
    } catch (error) {
      const seed = window.PODIUM_ATHLETE_SEED;

      if (
        seed &&
        seed.profile_slug === slug &&
        (
          !error.fromApi ||
          Number(error.status || 0) >= 500
        )
      ) {
        await render(fallbackDataFromSeed(seed));
        return;
      }

      showMessage(error.message, "error");
    }
  }

  correctionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = correctionForm.querySelector("button[type='submit']");
    const values = Object.fromEntries(new FormData(correctionForm).entries());
    button.disabled = true;
    showMessage("Sending the correction for review.");

    try {
      const response = await fetch("/api/athletes/report", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...values, athlete_slug: slug })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "The correction could not be sent.");
      }

      correctionForm.reset();
      showMessage(payload.message || "The correction was sent to Podium Watch.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      button.disabled = false;
    }
  });

  load();
})();
