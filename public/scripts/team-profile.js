(() => {
  const loadingBox = document.querySelector(
    "[data-team-profile-loading]"
  );
  const profileRoot = document.querySelector(
    "[data-team-profile]"
  );
  const previewNotice = document.querySelector(
    "[data-team-profile-preview-notice]"
  );
  const claimNotice = document.querySelector(
    "[data-team-profile-claim-notice]"
  );
  const claimLink = document.querySelector(
    "[data-team-profile-claim-link]"
  );
  const bannerImage = document.querySelector(
    "[data-team-profile-banner]"
  );
  const logoImage = document.querySelector(
    "[data-team-profile-logo]"
  );
  const badges = document.querySelector(
    "[data-team-profile-badges]"
  );
  const teamName = document.querySelector(
    "[data-team-profile-name]"
  );
  const teamLocation = document.querySelector(
    "[data-team-profile-location]"
  );
  const socials = document.querySelector(
    "[data-team-profile-socials]"
  );
  const liveStrip = document.querySelector(
    "[data-team-profile-live-strip]"
  );
  const instagramCurrent = document.querySelector(
    "[data-team-instagram-current]"
  );
  const instagramEmpty = document.querySelector(
    "[data-team-instagram-empty]"
  );
  const instagramForm = document.querySelector(
    "[data-team-instagram-form]"
  );
  const instagramMessage = document.querySelector(
    "[data-team-instagram-message]"
  );
  const instagramButton = document.querySelector(
    "[data-team-instagram-button]"
  );
  const completionText = document.querySelector(
    "[data-team-profile-completion]"
  );
  const completionProgress = document.querySelector(
    "[data-team-profile-progress]"
  );
  const updatedText = document.querySelector(
    "[data-team-profile-updated]"
  );
  const facts = document.querySelector(
    "[data-team-profile-facts]"
  );
  const overviewSection = document.querySelector(
    "[data-team-overview-section]"
  );
  const overview = document.querySelector(
    "[data-team-overview]"
  );
  const coachesSection = document.querySelector(
    "[data-team-coaches-section]"
  );
  const coaches = document.querySelector(
    "[data-team-coaches]"
  );
  const contactActions = document.querySelector(
    "[data-team-contact-actions]"
  );
  const divisionsSection = document.querySelector(
    "[data-team-divisions-section]"
  );
  const divisions = document.querySelector(
    "[data-team-divisions]"
  );
  const pathSection = document.querySelector(
    "[data-team-path-section]"
  );
  const pathIntro = document.querySelector(
    "[data-team-path-intro]"
  );
  const pathTabs = document.querySelector(
    "[data-team-path-tabs]"
  );
  const pathRoadmap = document.querySelector(
    "[data-team-path-roadmap]"
  );
  const pathNote = document.querySelector(
    "[data-team-path-note]"
  );
  const pathSource = document.querySelector(
    "[data-team-path-source]"
  );
  const historySection = document.querySelector(
    "[data-team-history-section]"
  );
  const history = document.querySelector(
    "[data-team-history]"
  );
  const traditionsSection = document.querySelector(
    "[data-team-traditions-section]"
  );
  const traditions = document.querySelector(
    "[data-team-traditions]"
  );
  const scheduleSection = document.querySelector(
    "[data-team-schedule-section]"
  );
  const scheduleUpcoming = document.querySelector(
    "[data-team-schedule-upcoming]"
  );
  const scheduleUpcomingEmpty = document.querySelector(
    "[data-team-schedule-upcoming-empty]"
  );
  const scheduleCompleted = document.querySelector(
    "[data-team-schedule-completed]"
  );
  const scheduleCompletedEmpty = document.querySelector(
    "[data-team-schedule-completed-empty]"
  );
  const scheduleCoachPrompt = document.querySelector(
    "[data-team-schedule-coach-prompt]"
  );
  const rosterSection = document.querySelector(
    "[data-team-roster-section]"
  );
  const rosterHeading = document.querySelector(
    "[data-team-roster-heading]"
  );
  const rosterDescription = document.querySelector(
    "[data-team-roster-description]"
  );
  const rosterEmpty = document.querySelector(
    "[data-team-roster-empty]"
  );
  const rosterCoachPrompt = document.querySelector(
    "[data-team-roster-coach-prompt]"
  );
  const rosterSeasons = document.querySelector(
    "[data-team-roster-seasons]"
  );
  const rosterBoys = document.querySelector(
    "[data-team-roster-boys]"
  );
  const rosterBoysEmpty = document.querySelector(
    "[data-team-roster-boys-empty]"
  );
  const rosterGirls = document.querySelector(
    "[data-team-roster-girls]"
  );
  const rosterGirlsEmpty = document.querySelector(
    "[data-team-roster-girls-empty]"
  );
  const reportSection = document.querySelector(
    "[data-team-report-section]"
  );
  const reportMessage = document.querySelector(
    "[data-team-report-message]"
  );
  const reportForm = document.querySelector(
    "[data-team-report-form]"
  );
  const returnButton = document.querySelector(
    "[data-team-profile-return]"
  );

  if (
    !loadingBox ||
    !profileRoot ||
    !previewNotice ||
    !claimNotice ||
    !claimLink ||
    !bannerImage ||
    !logoImage ||
    !badges ||
    !teamName ||
    !teamLocation ||
    !socials ||
    !completionText ||
    !completionProgress ||
    !updatedText ||
    !facts ||
    !overviewSection ||
    !overview ||
    !coachesSection ||
    !coaches ||
    !contactActions ||
    !divisionsSection ||
    !divisions ||
    !pathSection ||
    !pathIntro ||
    !pathTabs ||
    !pathRoadmap ||
    !pathNote ||
    !pathSource ||
    !historySection ||
    !history ||
    !traditionsSection ||
    !traditions ||
    !scheduleSection ||
    !scheduleUpcoming ||
    !scheduleUpcomingEmpty ||
    !scheduleCompleted ||
    !scheduleCompletedEmpty ||
    !scheduleCoachPrompt ||
    !rosterSection ||
    !rosterHeading ||
    !rosterDescription ||
    !rosterEmpty ||
    !rosterCoachPrompt ||
    !rosterSeasons ||
    !rosterBoys ||
    !rosterBoysEmpty ||
    !rosterGirls ||
    !rosterGirlsEmpty ||
    !reportSection ||
    !reportMessage ||
    !reportForm ||
    !returnButton
  ) {
    return;
  }

  const params = new URLSearchParams(
    window.location.search
  );
  const slug = String(
    params.get("slug") || ""
  ).trim();
  const previewMode =
    params.get("preview") === "1";
  const adminMode =
    params.get("admin") === "1";

  let currentTeam = null;
  let currentPathData = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeUrl(value) {
    const cleaned = String(
      value ?? ""
    ).trim();

    if (!cleaned) {
      return "";
    }

    try {
      const prepared =
        /^[a-z][a-z0-9+.-]*:\/\//i.test(
          cleaned
        )
          ? cleaned
          : "https://" + cleaned;
      const url = new URL(prepared);

      if (
        url.protocol !== "http:" &&
        url.protocol !== "https:"
      ) {
        return "";
      }

      return url.href;
    } catch {
      return "";
    }
  }

  function safeColor(value, fallback) {
    const cleaned = String(
      value ?? ""
    ).trim();

    return /^#[0-9a-f]{6}$/i.test(cleaned)
      ? cleaned
      : fallback;
  }

  // WCAG relative luminance -> a real, computed text color instead of a
  // hardcoded one. The team-profile-badge (program level, e.g. "High
  // School") sets its own background straight from a team's real
  // primary_color, which is arbitrary data every team enters for
  // themselves -- a hardcoded near-black text color only happens to work
  // for teams whose color is light. Confirmed live: Russia's real color
  // (#0300bd, a deep blue) measured 1.57:1 against the old hardcoded
  // #07130d text -- nearly invisible, well under WCAG AA's 4.5:1 minimum.
  // Same relative-luminance approach already used elsewhere in this
  // codebase for this exact class of bug.
  function readableTextColor(hexColor) {
    const hex = hexColor.replace("#", "");
    const channel = (value) => {
      const normalized = parseInt(value, 16) / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };
    const luminance =
      0.2126 * channel(hex.slice(0, 2)) +
      0.7152 * channel(hex.slice(2, 4)) +
      0.0722 * channel(hex.slice(4, 6));
    // Contrast against black (luminance 0) vs. white (luminance 1) --
    // whichever gives the higher ratio wins. Simplifies to: light
    // backgrounds get dark text, dark backgrounds get white text.
    const contrastWithBlack = (luminance + 0.05) / 0.05;
    const contrastWithWhite = 1.05 / (luminance + 0.05);
    return contrastWithBlack >= contrastWithWhite ? "#07130d" : "#ffffff";
  }

  function formatProgramLevel(value) {
    const labels = {
      high_school: "High School",
      middle_school: "Middle School",
      club: "Club"
    };

    return labels[value] || value || "";
  }

  function formatProgramScope(value) {
    const labels = {
      combined: "Boys and Girls",
      boys: "Boys",
      girls: "Girls"
    };

    return labels[value] || value || "";
  }

  function formatDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Update date unavailable";
    }

    return "Last updated " +
      new Intl.DateTimeFormat(
        "en-US",
        {
          month: "long",
          day: "numeric",
          year: "numeric"
        }
      ).format(date);
  }

  function createBadge(text, light = false) {
    const badge = document.createElement(
      "span"
    );

    badge.className = light
      ? "team-profile-badge team-profile-badge-light"
      : "team-profile-badge";
    badge.textContent = text;

    return badge;
  }

  function createSocialButton(label, value) {
    const url = safeUrl(value);

    if (!url) {
      return null;
    }

    const link = document.createElement("a");
    link.className = "team-profile-social-link";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;

    return link;
  }

  function getOfficialSocialLabel(link) {
    const customLabel = String(
      link?.label || ""
    ).trim();

    if (customLabel) {
      return customLabel;
    }

    const labels = {
      Instagram: "Official Instagram",
      X: "Official X",
      Facebook: "Official Facebook",
      TikTok: "Official TikTok",
      YouTube: "Official YouTube",
      Linktree: "Official Team Links",
      Website: "Official Website",
      Other: "Official Team Link"
    };

    return labels[link?.platform] ||
      link?.platform ||
      "Official Team Link";
  }

  function getHeadCoachEntries(team) {
    const setup =
      team.head_coach_setup ||
      "combined";
    const entries = [];

    if (
      setup === "combined" &&
      team.head_coach
    ) {
      entries.push({
        label: "Boys and Girls Head Coach",
        value: team.head_coach
      });
    }

    if (
      ["separate", "boys_only"].includes(
        setup
      ) &&
      team.head_boys_coach
    ) {
      entries.push({
        label: "Boys Head Coach",
        value: team.head_boys_coach
      });
    }

    if (
      ["separate", "girls_only"].includes(
        setup
      ) &&
      team.head_girls_coach
    ) {
      entries.push({
        label: "Girls Head Coach",
        value: team.head_girls_coach
      });
    }

    if (
      entries.length === 0 &&
      team.head_coach
    ) {
      entries.push({
        label: "Head Coach",
        value: team.head_coach
      });
    }

    return entries;
  }

  function createFact(label, value) {
    const cleaned = String(
      value ?? ""
    ).trim();

    if (!cleaned) {
      return null;
    }

    const card = document.createElement("div");
    card.className = "team-profile-fact";

    const heading = document.createElement(
      "strong"
    );
    heading.textContent = label;

    const copy = document.createElement("p");
    copy.textContent = cleaned;

    card.append(heading, copy);
    return card;
  }

  function createDivisionCard(label, value) {
    const cleaned = String(
      value ?? ""
    ).trim();

    if (!cleaned) {
      return null;
    }

    const card = document.createElement("div");
    card.className =
      "team-profile-division-card";

    const heading = document.createElement(
      "strong"
    );
    heading.textContent = label;

    const copy = document.createElement("p");
    copy.textContent = cleaned;

    card.append(heading, copy);
    return card;
  }

  function createEmailButton(label, email) {
    const cleaned = String(
      email ?? ""
    ).trim();

    if (
      !cleaned ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        cleaned
      )
    ) {
      return null;
    }

    const link = document.createElement("a");
    link.className = "button button-primary";
    link.href = "mailto:" + cleaned;
    link.textContent = label;

    return link;
  }

  function appendIfPresent(container, element) {
    if (element) {
      container.appendChild(element);
    }
  }

  async function parseResponse(response, fallback) {
    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        data.error || fallback
      );
    }

    return data;
  }

  async function loadPublicProfile() {
    const response = await fetch(
      "/api/teams/detail/",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ slug })
      }
    );

    return parseResponse(
      response,
      "The team profile could not be loaded."
    );
  }

  async function loadPublicRoster(teamId, seasonId = "") {
    const response = await fetch(
      "/api/teams/roster/",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          team_id: teamId,
          season_id: seasonId
        })
      }
    );

    if (response.status === 404) {
      return {
        seasons: [],
        selected_season: null,
        entries: []
      };
    }

    return parseResponse(
      response,
      "The team roster could not be loaded."
    );
  }

  async function loadPrivatePreview() {
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json"
    };

    if (!adminMode) {
      const accessToken =
        await window.PodiumTeamAuth
          .getAccessToken();

      if (!accessToken) {
        throw new Error(
          "Sign in to preview this private team page."
        );
      }

      headers.Authorization =
        "Bearer " + accessToken;
    }

    const response = await fetch(
      "/api/team/detail/",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "get",
          slug
        })
      }
    );

    if (
      response.status === 401 &&
      adminMode
    ) {
      throw new Error(
        "Your Podium Watch admin session has expired."
      );
    }

    return parseResponse(
      response,
      "The private team preview could not be loaded."
    );
  }

  function renderSocialLinks(team, socialLinks) {
    socials.innerHTML = "";
    const usedUrls = new Set();

    const addButton = (label, value) => {
      const url = safeUrl(value);

      if (!url || usedUrls.has(url)) {
        return;
      }

      usedUrls.add(url);
      appendIfPresent(
        socials,
        createSocialButton(label, url)
      );
    };

    socialLinks
      .filter((link) => link.published === true)
      .forEach((link) => {
        addButton(
          getOfficialSocialLabel(link),
          link.url
        );
      });

    addButton(
      "Official Team Website",
      team.website_url
    );
    addButton(
      "Official Athletics Website",
      team.athletics_url
    );
    addButton(
      "All Team Links",
      team.links_page_url
    );
    addButton(
      "Recruiting Questionnaire",
      team.recruiting_questionnaire_url
    );
    addButton(
      "Team Store",
      team.team_store_url
    );
    addButton(
      "Support the Team",
      team.fundraiser_url
    );
  }

  function renderInstagram(team) {
    const handle = String(team.instagram_handle || "").trim();
    if (instagramForm) instagramForm.dataset.teamId = team.id || "";

    if (handle) {
      instagramCurrent.innerHTML =
        "Instagram: <a href=\"https://www.instagram.com/" +
        encodeURIComponent(handle) +
        "/\" target=\"_blank\" rel=\"noopener noreferrer\">@" +
        escapeHtml(handle) +
        "</a>";
      instagramCurrent.hidden = false;
      instagramEmpty.hidden = true;
    } else {
      instagramCurrent.hidden = true;
      instagramEmpty.hidden = false;
    }
  }

  function getTodayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(
      now.getMonth() + 1
    ).padStart(2, "0");
    const day = String(
      now.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function formatMeetDate(value) {
    const cleaned = String(
      value || ""
    ).trim();

    if (!cleaned) {
      return "Date not listed";
    }

    const date = new Date(
      cleaned + "T12:00:00"
    );

    if (Number.isNaN(date.getTime())) {
      return cleaned;
    }

    return new Intl.DateTimeFormat(
      "en-US",
      {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
      }
    ).format(date);
  }

  function formatMeetTime(value) {
    const cleaned = String(
      value || ""
    ).trim();

    if (!/^\d{2}:\d{2}/.test(cleaned)) {
      return "";
    }

    const [hours, minutes] =
      cleaned.split(":").map(Number);
    const date = new Date(
      2000,
      0,
      1,
      hours,
      minutes
    );

    return new Intl.DateTimeFormat(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit"
      }
    ).format(date);
  }

  function getResultsUrl(connection) {
    const meet = connection?.meet || {};

    return safeUrl(
      connection?.results_url_override
    ) ||
      safeUrl(meet.results_url) ||
      safeUrl(meet.athleticnet_url) ||
      safeUrl(meet.milesplit_url);
  }

  function createMeetCard(connection) {
    const meet = connection?.meet || {};

    if (!meet.id) {
      return null;
    }

    const card = document.createElement(
      "article"
    );
    card.className =
      "team-profile-meet-card";

    const badgeRow =
      document.createElement("div");
    badgeRow.className =
      "team-profile-meet-badges";

    const sportBadge =
      document.createElement("span");
    sportBadge.className =
      "team-profile-meet-badge";
    sportBadge.textContent =
      meet.sport || "Meet";
    badgeRow.appendChild(sportBadge);

    if (
      previewMode &&
      (
        connection.published !== true ||
        meet.published !== true
      )
    ) {
      const previewBadge =
        document.createElement("span");
      previewBadge.className =
        "team-profile-meet-badge";
      previewBadge.textContent =
        connection.published !== true
          ? "Hidden connection"
          : "Draft Meet Center page";
      badgeRow.appendChild(
        previewBadge
      );
    }

    const heading =
      document.createElement("h3");
    heading.textContent =
      meet.name || "Meet";

    const dateLine =
      document.createElement("p");
    dateLine.innerHTML =
      "<strong>" +
      escapeHtml(
        formatMeetDate(
          meet.meet_date
        )
      ) +
      "</strong>" +
      (
        meet.start_time
          ? " at " +
            escapeHtml(
              formatMeetTime(
                meet.start_time
              )
            )
          : ""
      );

    const location = [
      meet.venue_name,
      meet.city,
      meet.state
    ]
      .filter(Boolean)
      .join(" · ");

    card.append(
      badgeRow,
      heading,
      dateLine
    );

    if (location) {
      const locationLine =
        document.createElement("p");
      locationLine.textContent =
        location;
      card.appendChild(locationLine);
    }

    if (connection.schedule_note) {
      const note =
        document.createElement("p");
      note.className =
        "team-profile-meet-note";
      note.textContent =
        connection.schedule_note;
      card.appendChild(note);
    }

    const actions =
      document.createElement("div");
    actions.className =
      "team-profile-meet-actions";

    if (meet.slug) {
      const meetLink =
        document.createElement("a");
      meetLink.className =
        "button button-primary";
      meetLink.href =
        "/meetdetail/?slug=" +
        encodeURIComponent(meet.slug);
      meetLink.textContent =
        "Meet Center";
      actions.appendChild(meetLink);
    }

    const resultsUrl =
      getResultsUrl(connection);

    if (resultsUrl) {
      const resultsLink =
        document.createElement("a");
      resultsLink.className =
        "button button-outline";
      resultsLink.href = resultsUrl;
      resultsLink.target = "_blank";
      resultsLink.rel =
        "noopener noreferrer";
      resultsLink.textContent =
        "Results";
      actions.appendChild(
        resultsLink
      );
    }

    if (
      actions.children.length > 0
    ) {
      card.appendChild(actions);
    }

    return card;
  }

  function renderSchedule(schedule) {
    const rows = Array.isArray(schedule)
      ? schedule
      : [];
    const today = getTodayDate();

    const visibleRows = rows
      .filter((connection) => {
        if (previewMode) {
          return Boolean(
            connection?.meet
          );
        }

        return (
          connection?.published === true &&
          connection?.meet?.published === true
        );
      })
      .sort((a, b) => {
        const dateCompare = String(
          a.meet?.meet_date || ""
        ).localeCompare(
          String(
            b.meet?.meet_date || ""
          )
        );

        if (dateCompare !== 0) {
          return dateCompare;
        }

        return String(
          a.meet?.name || ""
        ).localeCompare(
          String(
            b.meet?.name || ""
          )
        );
      });

    const upcoming = visibleRows.filter(
      (connection) =>
        String(
          connection.meet?.meet_date ||
          ""
        ) >= today
    );

    const completed = visibleRows
      .filter(
        (connection) =>
          String(
            connection.meet?.meet_date ||
            ""
          ) < today
      )
      .reverse();

    scheduleUpcoming.innerHTML = "";
    scheduleCompleted.innerHTML = "";

    upcoming.forEach((connection) => {
      appendIfPresent(
        scheduleUpcoming,
        createMeetCard(connection)
      );
    });

    completed.forEach((connection) => {
      appendIfPresent(
        scheduleCompleted,
        createMeetCard(connection)
      );
    });

    scheduleUpcomingEmpty.hidden =
      upcoming.length > 0;
    scheduleCompletedEmpty.hidden =
      completed.length > 0;
    // Always shown now, not hidden when empty -- a fan seeing "no
    // meets connected yet" is more honest than the section not
    // existing at all, and this team's own coach (previewMode/
    // adminMode) gets a direct link to fix it instead of just an
    // absence they'd have to guess the cause of.
    scheduleSection.hidden = false;
    scheduleCoachPrompt.hidden =
      !(previewMode || adminMode) ||
      visibleRows.length > 0;
  }

  function formatRosterGrade(value) {
    const grade = Number(value);
    return Number.isInteger(grade)
      ? "Grade " + grade
      : "Grade not listed";
  }

  function athleteDisplayName(athlete) {
    return String(
      athlete?.display_name ||
      [athlete?.preferred_name || athlete?.first_name, athlete?.last_name]
        .filter(Boolean)
        .join(" ")
    ).trim();
  }

  function createAthleteCard(entry) {
    const athlete = entry.athlete || {};
    const card = document.createElement("article");
    card.className = "team-profile-athlete-card";

    const badges = document.createElement("div");
    badges.className = "team-profile-roster-badges";

    [
      formatRosterGrade(entry.grade),
      athlete.graduation_year
        ? "Class of " + athlete.graduation_year
        : "Graduation year not listed",
      entry.captain ? "Captain" : ""
    ].filter(Boolean).forEach((label) => {
      const badge = document.createElement("span");
      badge.className = "team-profile-roster-badge";
      badge.textContent = label;
      badges.appendChild(badge);
    });

    const heading = document.createElement("h3");
    const profileSlug = athlete.global_profile?.slug || "";

    if (profileSlug) {
      const profileLink = document.createElement("a");
      profileLink.href = "/athlete/?slug=" + encodeURIComponent(profileSlug);
      profileLink.textContent = athleteDisplayName(athlete) || "Athlete";
      heading.appendChild(profileLink);
    } else {
      heading.textContent = athleteDisplayName(athlete) || "Athlete";
    }

    const events = document.createElement("p");
    events.textContent = Array.isArray(entry.events) && entry.events.length > 0
      ? "Events: " + entry.events.join(", ")
      : "Events not listed";

    card.append(badges, heading, events);

    const personalBests = entry.personal_bests && typeof entry.personal_bests === "object"
      ? Object.entries(entry.personal_bests)
      : [];

    if (personalBests.length > 0) {
      const bests = document.createElement("p");
      bests.textContent = "Personal bests: " + personalBests
        .map(([event, mark]) => event + ": " + mark)
        .join(" | ");
      card.appendChild(bests);
    }

    if (athlete.college_commitment) {
      const college = document.createElement("p");
      college.textContent = "College commitment: " + athlete.college_commitment;
      card.appendChild(college);
    }

    const links = Array.isArray(entry.social_links)
      ? entry.social_links
      : [];

    if (links.length > 0) {
      const linkContainer = document.createElement("div");
      linkContainer.className = "team-profile-athlete-links";

      links.forEach((link) => {
        const url = safeUrl(link.url);
        if (!url) return;
        const anchor = document.createElement("a");
        anchor.className = "team-profile-athlete-link";
        anchor.href = url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.textContent = link.label || link.platform || "Athlete link";
        linkContainer.appendChild(anchor);
      });

      if (linkContainer.children.length > 0) {
        card.appendChild(linkContainer);
      }
    }

    return card;
  }

  function renderRoster(rosterData) {
    const seasons = Array.isArray(rosterData?.seasons)
      ? rosterData.seasons
      : [];
    const season = rosterData?.selected_season || null;
    const entries = Array.isArray(rosterData?.entries)
      ? rosterData.entries
      : [];

    rosterSeasons.innerHTML = "";
    rosterBoys.innerHTML = "";
    rosterGirls.innerHTML = "";

    if (!season) {
      // Always shown now, not hidden entirely -- same reasoning as the
      // schedule section: an honest "nothing published yet" message
      // (plus a direct coach link, in preview/admin mode) beats the
      // section not existing at all.
      rosterSection.hidden = false;
      rosterHeading.textContent = "Team roster";
      rosterDescription.textContent = "";
      rosterEmpty.hidden = false;
      rosterCoachPrompt.hidden = !(previewMode || adminMode);
      rosterBoysEmpty.hidden = true;
      rosterGirlsEmpty.hidden = true;
      return;
    }

    rosterEmpty.hidden = true;
    rosterCoachPrompt.hidden = true;
    rosterHeading.textContent = season.name || "Team roster";
    rosterDescription.textContent = [
      season.sport,
      formatProgramScope(season.program_scope),
      entries.length === 1 ? "1 athlete" : entries.length + " athletes"
    ].filter(Boolean).join(" | ");

    seasons.forEach((item) => {
      const button = document.createElement("button");
      button.className = "team-profile-roster-season";
      button.type = "button";
      button.textContent = item.name;
      button.setAttribute("aria-pressed", item.id === season.id ? "true" : "false");
      button.addEventListener("click", async () => {
        if (!currentTeam || item.id === season.id) return;
        button.disabled = true;
        try {
          const nextRoster = await loadPublicRoster(currentTeam.id, item.id);
          renderRoster(nextRoster);
        } catch (error) {
          rosterDescription.textContent = error.message || "The roster could not be loaded.";
        } finally {
          button.disabled = false;
        }
      });
      rosterSeasons.appendChild(button);
    });

    const boys = entries.filter((entry) => entry.athlete?.gender === "boys");
    const girls = entries.filter((entry) => entry.athlete?.gender === "girls");

    boys.forEach((entry) => rosterBoys.appendChild(createAthleteCard(entry)));
    girls.forEach((entry) => rosterGirls.appendChild(createAthleteCard(entry)));

    rosterBoysEmpty.hidden = boys.length > 0;
    rosterGirlsEmpty.hidden = girls.length > 0;
    rosterSection.hidden = false;
  }

  // Renders the Path to State roadmap for whichever gender is currently
  // selected (a toggle only appears when both boys and girls paths are
  // available). The actual <li> markup comes from the shared
  // public/scripts/path-to-state.js renderer -- everything here is just
  // picking which gender's already-computed path to hand it.
  function renderPathToState(pathData) {
    currentPathData = pathData;

    const boysPath = pathData?.boys || null;
    const girlsPath = pathData?.girls || null;
    const boysAvailable = Boolean(boysPath?.available);
    const girlsAvailable = Boolean(girlsPath?.available);

    if (!boysAvailable && !girlsAvailable) {
      pathSection.hidden = true;
      return;
    }

    pathTabs.hidden = !(boysAvailable && girlsAvailable);

    let selectedGender = pathTabs.dataset.selectedGender || (boysAvailable ? "boys" : "girls");
    if (selectedGender === "boys" && !boysAvailable) selectedGender = "girls";
    if (selectedGender === "girls" && !girlsAvailable) selectedGender = "boys";
    pathTabs.dataset.selectedGender = selectedGender;

    pathTabs.querySelectorAll("[data-team-path-gender]").forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.teamPathGender === selectedGender ? "true" : "false");
    });

    const activePath = selectedGender === "boys" ? boysPath : girlsPath;
    const genderLabel = selectedGender === "boys" ? "Boys" : "Girls";
    const divisionBit = activePath.division_label ? ` · ${activePath.division_label}` : "";
    const districtBit = activePath.athletic_district ? ` · ${activePath.athletic_district} District` : "";
    const selfReportedBit = activePath.division_source === "team_pages_self_reported"
      ? " (division self-reported by the team)"
      : "";
    pathIntro.textContent = `${genderLabel} cross country${divisionBit}${districtBit}${selfReportedBit}`;

    const rendered = window.PodiumPathToState
      ? window.PodiumPathToState.renderRoadmap(pathRoadmap, activePath)
      : false;
    pathSection.hidden = !rendered;

    if (!rendered) {
      return;
    }

    pathSource.textContent = activePath.source_note || "";
    pathNote.hidden = !activePath.summary;
    pathNote.textContent = activePath.summary || "";
  }

  pathTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-team-path-gender]");
    if (!button) return;
    pathTabs.dataset.selectedGender = button.dataset.teamPathGender;
    renderPathToState(currentPathData);
  });

  function renderProfile(team, socialLinks, schedule, rosterData, pathData, liveRaces) {
    currentTeam = team;
    document.title =
      team.school_name +
      " | Podium Watch";

    const teamPrimaryColor = safeColor(
      team.primary_color,
      "#00bf63"
    );
    profileRoot.style.setProperty(
      "--team-primary",
      teamPrimaryColor
    );
    profileRoot.style.setProperty(
      "--team-primary-text",
      readableTextColor(teamPrimaryColor)
    );
    profileRoot.style.setProperty(
      "--team-secondary",
      safeColor(
        team.secondary_color,
        "#111827"
      )
    );

    previewNotice.hidden = !previewMode;
    previewNotice.textContent = adminMode
      ? "Podium Watch admin preview. This page may not currently be listed publicly."
      : "Private preview. This page may not currently be listed publicly.";

    returnButton.hidden = !previewMode;
    returnButton.href = adminMode
      ? "/admin/team-manager/"
      : "/team-dashboard/";
    returnButton.textContent = adminMode
      ? "Return to Team Manager"
      : "Return to team dashboard";

    claimNotice.hidden =
      previewMode || team.claimed === true;
    claimLink.href =
      "/team-login/?claim=" +
      encodeURIComponent(team.slug);

    const bannerUrl = safeUrl(
      team.banner_image_url
    );
    bannerImage.hidden = !bannerUrl;

    if (bannerUrl) {
      bannerImage.src = bannerUrl;
      bannerImage.alt =
        team.school_name +
        " team banner";
      bannerImage.onerror = () => {
        bannerImage.hidden = true;
      };
    }

    const logoUrl = safeUrl(team.logo_url);
    logoImage.hidden = !logoUrl;

    if (logoUrl) {
      logoImage.src = logoUrl;
      logoImage.alt =
        team.school_name +
        " team logo";
      logoImage.onerror = () => {
        logoImage.hidden = true;
      };
    }

    badges.innerHTML = "";
    appendIfPresent(
      badges,
      createBadge(
        formatProgramLevel(
          team.program_level
        )
      )
    );
    appendIfPresent(
      badges,
      createBadge(
        formatProgramScope(
          team.program_scope
        ),
        true
      )
    );

    if (team.verified) {
      appendIfPresent(
        badges,
        createBadge(
          "Verified Team",
          true
        )
      );
    } else {
      appendIfPresent(
        badges,
        createBadge(
          "Community Managed",
          true
        )
      );
    }

    if (previewMode) {
      appendIfPresent(
        badges,
        createBadge(
          team.published
            ? "Published Preview"
            : "Private Draft",
          true
        )
      );
    }

    teamName.textContent =
      team.school_name +
      (team.mascot
        ? " " + team.mascot
        : "");
    teamLocation.textContent = [
      team.city,
      team.state,
      team.conference
    ]
      .filter(Boolean)
      .join(" · ");

    // "Live Now" discovery strip (Team Workspace Phase Three) -- only
    // ever shown when the coach has explicitly turned a currently-live
    // race's spectator_visible flag on (see api/split-watch's
    // updateSessionDetails and api/teams/detail.js).
    const races = Array.isArray(liveRaces) ? liveRaces : [];
    if (liveStrip) {
      liveStrip.hidden = races.length === 0;
      liveStrip.innerHTML = races
        .map(
          (race) =>
            '<span class="team-profile-live-badge">Live now</span>' +
            '<span>' + escapeHtml(race.name) + '</span>' +
            '<a class="button button-outline" href="/race/?race=' +
            encodeURIComponent(race.id) +
            '">Watch live</a>'
        )
        .join("");
    }

    renderSocialLinks(team, socialLinks);
    renderInstagram(team);

    const score = Math.max(
      0,
      Math.min(
        100,
        Number(team.completion_score) || 0
      )
    );
    completionText.textContent =
      score + " percent complete";
    completionProgress.style.width =
      score + "%";
    updatedText.textContent =
      formatDate(team.updated_at);

    facts.innerHTML = "";
    const factItems = [
      createFact(
        "Conference",
        team.conference
      ),
      createFact(
        "Ohio Region",
        team.region
      ),
      createFact(
        "Program",
        formatProgramScope(
          team.program_scope
        )
      ),
      createFact(
        "Profile Management",
        team.claimed
          ? "Claimed by a team representative"
          : "Available to claim"
      )
    ];

    getHeadCoachEntries(team)
      .forEach((coach) => {
        factItems.push(
          createFact(
            coach.label,
            coach.value
          )
        );
      });

    factItems.forEach((fact) => {
      appendIfPresent(facts, fact);
    });

    overviewSection.hidden =
      !team.description;
    overview.textContent =
      team.description || "";

    const coachText = [];
    getHeadCoachEntries(team)
      .forEach((coach) => {
        coachText.push(
          coach.label +
          "\n" +
          coach.value
        );
      });

    if (team.assistant_coaches_text) {
      coachText.push(
        "Assistant Coaches\n" +
        team.assistant_coaches_text
      );
    }

    coaches.textContent =
      coachText.join("\n\n");
    contactActions.innerHTML = "";
    appendIfPresent(
      contactActions,
      createEmailButton(
        "Contact the Team",
        team.public_contact_email
      )
    );
    appendIfPresent(
      contactActions,
      createEmailButton(
        "Recruiting Contact",
        team.recruiting_contact_email
      )
    );
    coachesSection.hidden =
      coachText.length === 0 &&
      contactActions.children.length === 0;

    divisions.innerHTML = "";
    [
      createDivisionCard(
        "Cross Country Boys",
        team.cross_country_boys_division
      ),
      createDivisionCard(
        "Cross Country Girls",
        team.cross_country_girls_division
      ),
      createDivisionCard(
        "Track Boys",
        team.track_boys_division
      ),
      createDivisionCard(
        "Track Girls",
        team.track_girls_division
      )
    ].forEach((card) => {
      appendIfPresent(divisions, card);
    });
    divisionsSection.hidden =
      divisions.children.length === 0;

    renderPathToState(pathData);

    historySection.hidden =
      !team.history_text;
    history.textContent =
      team.history_text || "";

    traditionsSection.hidden =
      !team.traditions_text;
    traditions.textContent =
      team.traditions_text || "";

    renderSchedule(schedule);
    renderRoster(rosterData);

    reportSection.hidden = previewMode;
    loadingBox.hidden = true;
    profileRoot.hidden = false;
  }

  async function submitReport(event) {
    event.preventDefault();

    if (!currentTeam || previewMode) {
      return;
    }

    const submitButton =
      reportForm.querySelector(
        'button[type="submit"]'
      );
    const formData = new FormData(
      reportForm
    );
    const payload =
      Object.fromEntries(
        formData.entries()
      );
    payload.team_id = currentTeam.id;

    if (submitButton) {
      submitButton.disabled = true;
    }
    reportMessage.hidden = false;
    reportMessage.textContent =
      "Submitting your report.";

    try {
      const response = await fetch(
        "/api/teams/report/",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      await parseResponse(
        response,
        "The team report could not be submitted."
      );

      reportForm.reset();
      reportMessage.textContent =
        "Thank you. Podium Watch received your report.";
    } catch (error) {
      reportMessage.textContent =
        error.message ||
        "The team report could not be submitted.";
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  }

  async function initialize() {
    if (!slug) {
      loadingBox.innerHTML =
        "<h2>Team profile not found</h2>" +
        "<p>This link does not include a team page address.</p>";
      return;
    }

    try {
      const data = previewMode
        ? await loadPrivatePreview()
        : await loadPublicProfile();

      if (
        data.redirected &&
        data.redirect_slug
      ) {
        window.location.replace(
          "/team/?slug=" +
          encodeURIComponent(
            data.redirect_slug
          )
        );
        return;
      }

      if (!data.team) {
        throw new Error(
          "The team profile could not be loaded."
        );
      }

      const rosterData = previewMode
        ? {
            seasons: [],
            selected_season: null,
            entries: []
          }
        : await loadPublicRoster(data.team.id);

      renderProfile(
        data.team,
        Array.isArray(data.social_links)
          ? data.social_links
          : [],
        Array.isArray(data.schedule)
          ? data.schedule
          : [],
        rosterData,
        data.path_to_state || null,
        Array.isArray(data.live_races) ? data.live_races : []
      );
    } catch (error) {
      loadingBox.innerHTML =
        "<h2>Team profile unavailable</h2>" +
        "<p>" +
        escapeHtml(
          error.message ||
          "The team profile could not be loaded."
        ) +
        "</p>";
    }
  }

  reportForm.addEventListener(
    "submit",
    submitReport
  );

  function showInstagramMessage(text, tone = "success") {
    instagramMessage.textContent = text;
    instagramMessage.dataset.tone = tone;
    instagramMessage.hidden = false;
  }

  instagramForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const teamId = instagramForm.dataset.teamId || currentTeam?.id;

    if (!teamId) {
      showInstagramMessage("This team could not be identified.", "error");
      return;
    }

    const values = Object.fromEntries(new FormData(instagramForm).entries());
    instagramButton.disabled = true;
    showInstagramMessage("Checking the handle.");

    try {
      const response = await fetch("/api/team-instagram/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ team_id: teamId, handle: values.handle, website: values.website })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "The Instagram handle could not be updated.");
      }

      instagramForm.reset();
      showInstagramMessage(payload.message || "Instagram updated.");
      if (payload.handle) renderInstagram({ ...currentTeam, instagram_handle: payload.handle, id: teamId });
    } catch (error) {
      showInstagramMessage(error.message, "error");
    } finally {
      instagramButton.disabled = false;
    }
  });

  initialize();
})();
