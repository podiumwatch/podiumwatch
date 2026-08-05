(() => {
  const root = document.querySelector("[data-athlete-directory]");

  if (!root) {
    return;
  }

  const form = root.querySelector("[data-athlete-filter-form]");
  const results = root.querySelector("[data-athlete-results]");
  const message = root.querySelector("[data-athlete-directory-message]");
  const resultTitle = root.querySelector("[data-athlete-result-title]");
  const resultCount = root.querySelector("[data-athlete-result-count]");
  const pagination = root.querySelector("[data-athlete-pagination]");
  const pageLabel = root.querySelector("[data-athlete-page-label]");
  const previous = root.querySelector("[data-athlete-previous]");
  const next = root.querySelector("[data-athlete-next]");
  const reset = root.querySelector("[data-athlete-reset]");
  let currentPage = 1;
  let totalPages = 1;
  let busy = false;

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

  function setText(selector, value) {
    const element = root.querySelector(selector);

    if (element) {
      element.textContent = String(value ?? 0);
    }
  }

  function titleCase(value) {
    return String(value || "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function profileHref(athlete) {
    return "/athlete/?slug=" + encodeURIComponent(athlete.slug || "");
  }

  function statusTone(athlete) {
    if (athlete.verified) {
      return "verified";
    }

    if (athlete.verification_status === "editorial_source_linked") {
      return "editorial";
    }

    return "unverified";
  }

  function athleteCard(athlete) {
    const school = athlete.school?.school_name || athlete.team?.school_name || "School not listed";
    const city = athlete.school?.city || athlete.team?.city || "";
    const ranking = athlete.ranking;
    const performance = athlete.top_performance;
    const events = (athlete.primary_events || []).filter(Boolean);
    const eventText = events.length
      ? events.join(", ")
      : ranking?.event_name || performance?.event_name || "Not listed";
    const sourceSummary = performance
      ? `${performance.event_name || "Result"}: ${performance.mark_text || "Mark not listed"}`
      : ranking
        ? `No. ${ranking.rank} in ${ranking.title}`
        : "No published result or ranking yet";

    return (
      '<article class="athlete-card">' +
        '<div class="athlete-card-header">' +
          "<div>" +
            '<h3><a href="' + escapeHtml(profileHref(athlete)) + '">' + escapeHtml(athlete.display_name) + "</a></h3>" +
            '<p class="athlete-card-school">' + escapeHtml(school + (city ? " | " + city : "")) + "</p>" +
          "</div>" +
          '<span class="athlete-status-badge" data-status="' + escapeHtml(statusTone(athlete)) + '">' + escapeHtml(athlete.verification_label || titleCase(athlete.verification_status)) + "</span>" +
        "</div>" +
        '<div class="athlete-card-facts">' +
          '<div class="athlete-card-fact"><span>Class</span><strong>' + escapeHtml(athlete.graduation_year || "Not listed") + "</strong></div>" +
          '<div class="athlete-card-fact"><span>Program</span><strong>' + escapeHtml(titleCase(athlete.gender)) + "</strong></div>" +
          '<div class="athlete-card-fact"><span>Event</span><strong>' + escapeHtml(eventText) + "</strong></div>" +
          '<div class="athlete-card-fact"><span>Division</span><strong>' + escapeHtml(ranking?.division || "Not listed") + "</strong></div>" +
        "</div>" +
        '<div class="athlete-ranking-note"><strong>' + escapeHtml(sourceSummary) + "</strong><span>Check the profile for the source and verification label.</span></div>" +
        '<a class="button button-outline" href="' + escapeHtml(profileHref(athlete)) + '">View athlete profile</a>' +
      "</article>"
    );
  }

  function formQuery(page) {
    const values = new FormData(form);
    const query = new URLSearchParams();

    for (const [key, value] of values.entries()) {
      if (key === "recruiting_only") {
        query.set(key, "true");
      } else if (String(value).trim()) {
        query.set(key, String(value).trim());
      }
    }

    query.set("page", String(page));
    query.set("page_size", "24");
    return query;
  }

  function syncUrl(query) {
    const url = new URL(window.location.href);
    url.search = query.toString();
    window.history.replaceState({}, "", url);
  }

  function restoreFiltersFromUrl() {
    const params = new URLSearchParams(window.location.search);

    for (const [key, value] of params.entries()) {
      const field = form.elements.namedItem(key);

      if (!field) {
        continue;
      }

      if (field.type === "checkbox") {
        field.checked = ["true", "1", "yes", "on"].includes(value);
      } else if (key !== "page" && key !== "page_size") {
        field.value = value;
      }
    }

    currentPage = Math.max(1, Number(params.get("page")) || 1);
  }

  function normalizeSearch(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function fallbackProfile(seed) {
    return {
      id: null,
      slug: seed.profile_slug,
      display_name: seed.display_name,
      gender: seed.gender,
      graduation_year: seed.graduation_year,
      school: {
        id: null,
        ohsaa_school_id: seed.ohsaa_school_id,
        school_name: seed.official_school_name || seed.school_name,
        city: seed.school_city,
        athletic_district: seed.athletic_district
      },
      team: null,
      primary_events: [seed.event],
      college_commitment: null,
      recruiting_enabled: false,
      recruiting_headline: null,
      verified: false,
      verification_status: "editorial_source_linked",
      verification_label: "Ranking source linked",
      ranking: {
        rank: seed.ranking.rank,
        title: seed.ranking.title,
        href: seed.ranking.ranking_href,
        division: seed.division,
        division_number: seed.division_number,
        event_name: seed.event,
        mark_snapshot: seed.ranking.mark_snapshot,
        updated_date: seed.ranking.updated_date,
        ranking_type: seed.ranking.ranking_type
      },
      top_performance: null,
      source_mode: "bundled_editorial_seed"
    };
  }

  function fallbackSummary(profiles) {
    const genders = {};
    const graduationYears = {};
    const divisions = {};

    profiles.forEach((profile) => {
      const gender = profile.gender || "unspecified";
      const year = profile.graduation_year || "Unknown";
      const division = profile.ranking?.division || "Not listed";

      genders[gender] = (genders[gender] || 0) + 1;
      graduationYears[year] =
        (graduationYears[year] || 0) + 1;
      divisions[division] =
        (divisions[division] || 0) + 1;
    });

    return {
      total: profiles.length,
      verified: 0,
      recruiting: 0,
      genders,
      graduation_years: graduationYears,
      divisions
    };
  }

  async function seedFallbackPayload(query) {
    const response = await fetch(
      "/data/athlete-foundation-seed-2026.json",
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) {
      throw new Error(
        "The athlete directory seed could not be loaded."
      );
    }

    const dataset = await response.json();
    const allProfiles = (dataset.athletes || [])
      .map(fallbackProfile);
    const search = normalizeSearch(query.get("search"));
    const gender = query.get("gender") || "";
    const graduationYear =
      Number(query.get("graduation_year")) || 0;
    const division =
      Number(query.get("division")) || 0;
    const event = normalizeSearch(query.get("event"));
    const school = normalizeSearch(query.get("school"));
    const verification =
      String(query.get("verification") || "").toLowerCase();
    const recruitingOnly =
      query.get("recruiting_only") === "true";

    const filtered = allProfiles
      .filter((profile) => {
        const schoolName =
          profile.school?.school_name || "";
        const searchText = normalizeSearch([
          profile.display_name,
          schoolName,
          profile.school?.city,
          profile.school?.athletic_district,
          profile.graduation_year,
          profile.ranking?.title,
          profile.ranking?.division,
          ...(profile.primary_events || [])
        ].filter(Boolean).join(" "));

        if (search && !searchText.includes(search)) {
          return false;
        }

        if (gender && profile.gender !== gender) {
          return false;
        }

        if (
          graduationYear &&
          Number(profile.graduation_year) !==
            graduationYear
        ) {
          return false;
        }

        if (
          division &&
          Number(profile.ranking?.division_number) !==
            division
        ) {
          return false;
        }

        if (
          event &&
          !normalizeSearch([
            profile.ranking?.event_name,
            profile.ranking?.mark_snapshot,
            ...(profile.primary_events || [])
          ].filter(Boolean).join(" ")).includes(event)
        ) {
          return false;
        }

        if (
          school &&
          !normalizeSearch(schoolName).includes(school)
        ) {
          return false;
        }

        if (verification === "verified") {
          return false;
        }

        if (
          verification === "source_linked" &&
          profile.verification_status !==
            "editorial_source_linked"
        ) {
          return false;
        }

        if (recruitingOnly) {
          return false;
        }

        return true;
      })
      .sort(
        (first, second) =>
          Number(first.ranking?.rank || 999999) -
            Number(second.ranking?.rank || 999999) ||
          String(first.display_name).localeCompare(
            String(second.display_name)
          )
      );

    const pageSize = 24;
    const requestedPage =
      Math.max(1, Number(query.get("page")) || 1);
    const pages =
      Math.max(1, Math.ceil(filtered.length / pageSize));
    const page = Math.min(requestedPage, pages);
    const start = (page - 1) * pageSize;

    return {
      source_mode: "bundled_editorial_seed",
      source_note:
        "The directory is using the bundled Podium Watch editorial ranking seed. Ranking marks are not verified performance records.",
      page,
      page_size: pageSize,
      total: filtered.length,
      total_pages: pages,
      summary: fallbackSummary(allProfiles),
      athletes: filtered.slice(start, start + pageSize)
    };
  }

  async function load(page = 1) {
    if (busy) {
      return;
    }

    busy = true;
    currentPage = page;
    showMessage("Loading athlete profiles.");
    results.setAttribute("aria-busy", "true");

    try {
      const query = formQuery(page);
      let payload;

      try {
        const response = await fetch(
          "/api/athletes/?" + query.toString(),
          {
            headers: { Accept: "application/json" }
          }
        );
        const apiPayload =
          await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            apiPayload.error ||
            "The athlete directory API could not be loaded."
          );
        }

        payload = apiPayload;
      } catch {
        payload = await seedFallbackPayload(query);
      }

      currentPage = payload.page || 1;
      totalPages = payload.total_pages || 1;
      const athletes = payload.athletes || [];
      const summary = payload.summary || {};

      setText("[data-athlete-stat-total]", summary.total || 0);
      setText("[data-athlete-stat-boys]", summary.genders?.boys || 0);
      setText("[data-athlete-stat-girls]", summary.genders?.girls || 0);
      setText("[data-athlete-stat-verified]", summary.verified || 0);

      resultTitle.textContent = payload.total === 1 ? "1 athlete found" : `${payload.total || 0} athletes found`;
      resultCount.textContent = athletes.length
        ? `Showing ${athletes.length} on page ${currentPage}`
        : "No matching athletes";
      results.innerHTML = athletes.length
        ? athletes.map(athleteCard).join("")
        : '<div class="athlete-directory-empty"><h3>No athlete profiles matched.</h3><p>Clear one or more filters and search again.</p></div>';

      pagination.hidden = totalPages <= 1;
      pageLabel.textContent = `Page ${currentPage} of ${totalPages}`;
      previous.disabled = currentPage <= 1;
      next.disabled = currentPage >= totalPages;
      syncUrl(query);
      showMessage(
        payload.source_note || "Athlete profiles loaded.",
        payload.source_mode === "bundled_editorial_seed" ? "warning" : "success"
      );
    } catch (error) {
      results.innerHTML = '<div class="athlete-directory-empty"><h3>The directory could not load.</h3><p>' + escapeHtml(error.message) + "</p></div>";
      showMessage(error.message, "error");
    } finally {
      results.removeAttribute("aria-busy");
      busy = false;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    load(1);
  });

  reset.addEventListener("click", () => {
    form.reset();
    load(1);
  });

  previous.addEventListener("click", () => load(Math.max(1, currentPage - 1)));
  next.addEventListener("click", () => load(Math.min(totalPages, currentPage + 1)));

  restoreFiltersFromUrl();
  load(currentPage);
})();
