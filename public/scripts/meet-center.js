(() => {
  const searchInput = document.querySelector("[data-public-meet-search]");
  const sportFilter = document.querySelector("[data-public-meet-sport]");
  const yearFilter = document.querySelector("[data-public-meet-year]");
  const cityFilter = document.querySelector("[data-public-meet-city]");
  const divisionFilter = document.querySelector("[data-public-meet-division]");
  const typeFilter = document.querySelector("[data-public-meet-type]");
  const clearButton = document.querySelector("[data-clear-public-meet-filters]");
  const totalCount = document.querySelector("[data-public-meet-count]");
  const statusBox = document.querySelector("[data-meet-center-status]");
  const tabBar = document.querySelector("[data-meet-view-tabs]");
  const tabs = document.querySelectorAll("[data-meet-view-tab]");
  const panels = document.querySelectorAll("[data-meet-view-panel]");

  if (
    !searchInput || !sportFilter || !yearFilter || !cityFilter || !divisionFilter ||
    !typeFilter || !clearButton || !totalCount || !statusBox || !tabBar || !tabs.length || !panels.length
  ) {
    return;
  }

  const VIEWS = ["today", "upcoming", "results"];
  const PAGE_SIZE = 20;
  const shown = { today: PAGE_SIZE, upcoming: PAGE_SIZE, results: PAGE_SIZE };

  let meets = [];
  let activeView = "upcoming";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function dateKey(value) {
    return String(value || "").slice(0, 10);
  }

  // Ohio's own calendar day (America/New_York), never the visitor's
  // device timezone -- shared with the sitewide ticker and the homepage
  // Ohio Today card via public/scripts/ohio-today.js. That script is
  // deferred sitewide (see src/lib/html.mjs), so by the time this
  // actually runs (inside the async loadMeets() below) it has already
  // executed; the local fallback only guards a script-load failure.
  function todayKey() {
    if (window.PodiumOhioToday) return window.PodiumOhioToday.ohioDateKey();
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  }

  function isToday(meet) {
    return dateKey(meet.meet_date) === todayKey();
  }

  function isUpcoming(meet) {
    return dateKey(meet.meet_date) > todayKey();
  }

  function isCompleted(meet) {
    const finalDate = dateKey(meet.end_date || meet.meet_date);
    return Boolean(finalDate && finalDate < todayKey());
  }

  // A meet only counts as having real, checkable results once one of
  // these real link fields is set -- otherwise a "completed" meet (the
  // date has simply passed) gets an honest "Results pending" label
  // instead of a misleading "View results" that leads nowhere. Mirrors
  // the exact fields public/scripts/meet-detail.js already renders as
  // result links, so the label and the meet page never disagree.
  function hasRealResults(meet) {
    return Boolean(meet.results_url || meet.athleticnet_url || meet.milesplit_url || meet.recap_article_url);
  }

  function formatDate(value) {
    if (!value) return "Date not announced";
    return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" }).format(new Date(value + "T12:00:00"));
  }

  function formatDateRange(meet) {
    if (meet.end_date && meet.end_date !== meet.meet_date) {
      return `${formatDate(meet.meet_date)} through ${formatDate(meet.end_date)}`;
    }
    return formatDate(meet.meet_date);
  }

  function formatTime(value) {
    if (!value) return "";
    const parts = String(value).slice(0, 5).split(":").map(Number);
    if (parts.length !== 2 || parts.some(Number.isNaN)) return "";
    const date = new Date();
    date.setHours(parts[0], parts[1], 0, 0);
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
  }

  function locationText(meet) {
    return [meet.venue_name, meet.city, meet.state].filter(Boolean).join(", ");
  }

  function dateChip(meet) {
    if (!meet.meet_date) return { month: "TBD", day: "" };
    const date = new Date(meet.meet_date + "T12:00:00");
    if (Number.isNaN(date.getTime())) return { month: "TBD", day: "" };
    return {
      month: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "America/New_York" }).format(date).toUpperCase(),
      day: String(date.getDate())
    };
  }

  function actionLabel(meet, view) {
    if (view === "results") return hasRealResults(meet) ? "View results" : "Results pending";
    return "Open meet page";
  }

  function meetCard(meet, view) {
    const chip = dateChip(meet);
    const metaParts = [escapeHtml(formatDateRange(meet))];
    const time = formatTime(meet.start_time);
    if (time) metaParts.push(escapeHtml(time));
    const location = locationText(meet);
    if (location) metaParts.push(escapeHtml(location));
    if (meet.host_school) metaParts.push("Hosted by " + escapeHtml(meet.host_school));
    if (meet.division) metaParts.push(escapeHtml(meet.division));

    const badges = [];
    if (meet.featured) badges.push('<span class="meet-badge meet-badge-featured">Featured</span>');
    badges.push('<span class="meet-badge">' + escapeHtml(meet.sport || "Meet") + "</span>");
    if (meet.meet_type) badges.push('<span class="meet-badge">' + escapeHtml(meet.meet_type) + "</span>");
    if (view === "results" && !hasRealResults(meet)) badges.push('<span class="meet-badge meet-badge-dark">Pending</span>');

    return (
      '<a class="meet-row' + (meet.featured ? " meet-row-featured" : "") + '" href="/meetdetail/?slug=' + encodeURIComponent(meet.slug) + '">' +
        '<span class="meet-row-date" title="' + escapeHtml(formatDateRange(meet)) + '">' +
          '<span class="meet-row-date-month">' + escapeHtml(chip.month) + "</span>" +
          '<span class="meet-row-date-day">' + escapeHtml(chip.day) + "</span>" +
        "</span>" +
        '<span class="meet-row-main">' +
          '<span class="meet-row-name">' + escapeHtml(meet.name) + "</span>" +
          '<span class="meet-row-meta">' + badges.join("") + metaParts.map((part) => "<span>" + part + "</span>").join("") + "</span>" +
        "</span>" +
        '<span class="meet-row-action">' + actionLabel(meet, view) + "</span>" +
      "</a>"
    );
  }

  function emptyCard(view) {
    const messages = {
      today: ["No Ohio meets are scheduled today.", "Check the Upcoming tab for what's next."],
      upcoming: ["No upcoming meets match.", "Try changing or clearing the filters."],
      results: ["No results match.", "Try changing or clearing the filters."]
    };
    const [title, detail] = messages[view] || messages.upcoming;
    return `<div class="info-card meet-empty"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(detail)}</p></div>`;
  }

  function populateFilter(element, values, defaultLabel) {
    const currentValue = element.value;
    element.innerHTML = "";
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = defaultLabel;
    element.appendChild(defaultOption);
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      element.appendChild(option);
    });
    if (values.includes(currentValue)) element.value = currentValue;
  }

  function populateFilters() {
    const pick = (key) => [...new Set(meets.map((meet) => String(meet[key] || "").trim()).filter(Boolean))];
    const years = [...new Set(meets.map((meet) => String(meet.year || "")).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
    populateFilter(yearFilter, years, "All years");
    populateFilter(cityFilter, pick("city").sort(), "All cities");
    populateFilter(divisionFilter, pick("division").sort(), "All divisions");
    populateFilter(typeFilter, pick("meet_type").sort(), "All meet types");
  }

  function filteredMeets() {
    const query = normalize(searchInput.value);
    return meets.filter((meet) => {
      const searchText = normalize([meet.name, meet.host_school, meet.venue_name, meet.city, meet.state, meet.division, meet.meet_type, meet.sport].join(" "));
      return (
        (!query || searchText.includes(query)) &&
        (!sportFilter.value || meet.sport === sportFilter.value) &&
        (!yearFilter.value || String(meet.year) === yearFilter.value) &&
        (!cityFilter.value || meet.city === cityFilter.value) &&
        (!divisionFilter.value || meet.division === divisionFilter.value) &&
        (!typeFilter.value || meet.meet_type === typeFilter.value)
      );
    });
  }

  function bucketFor(view, pool) {
    if (view === "today") return pool.filter(isToday).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    if (view === "upcoming") return pool.filter(isUpcoming).sort((a, b) => dateKey(a.meet_date).localeCompare(dateKey(b.meet_date)));
    return pool.filter(isCompleted).sort((a, b) => dateKey(b.end_date || b.meet_date).localeCompare(dateKey(a.end_date || a.meet_date)));
  }

  function setView(view, { pushState = true } = {}) {
    activeView = VIEWS.includes(view) ? view : "upcoming";
    tabs.forEach((tab) => {
      const selected = tab.dataset.view === activeView;
      tab.setAttribute("aria-selected", String(selected));
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.meetViewPanel !== activeView;
    });
    if (pushState) {
      const url = new URL(window.location.href);
      url.searchParams.set("view", activeView);
      window.history.pushState({ meetView: activeView }, "", url);
    }
    render();
  }

  function render() {
    const pool = filteredMeets();
    const bucket = bucketFor(activeView, pool);
    const visible = bucket.slice(0, shown[activeView]);

    totalCount.textContent = `${pool.length} of ${meets.length} ${meets.length === 1 ? "meet" : "meets"} shown`;

    const listEl = document.querySelector(`[data-meet-list="${activeView}"]`);
    const countEl = document.querySelector(`[data-meet-count="${activeView}"]`);
    const loadMoreEl = document.querySelector(`[data-load-more="${activeView}"]`);
    if (!listEl || !countEl || !loadMoreEl) return;

    countEl.textContent = `${bucket.length} ${bucket.length === 1 ? "meet" : "meets"}`;
    listEl.innerHTML = visible.length > 0
      ? visible.map((meet) => meetCard(meet, activeView)).join("")
      : emptyCard(activeView);

    loadMoreEl.hidden = bucket.length <= visible.length;

    statusBox.hidden = true;
    tabBar.hidden = false;
  }

  function clearFilters() {
    searchInput.value = "";
    sportFilter.value = "";
    yearFilter.value = "";
    cityFilter.value = "";
    divisionFilter.value = "";
    typeFilter.value = "";
    VIEWS.forEach((view) => { shown[view] = PAGE_SIZE; });
    render();
    searchInput.focus();
  }

  [searchInput, sportFilter, yearFilter, cityFilter, divisionFilter, typeFilter].forEach((control) => {
    control.addEventListener(control === searchInput ? "input" : "change", () => {
      VIEWS.forEach((view) => { shown[view] = PAGE_SIZE; });
      render();
    });
  });

  clearButton.addEventListener("click", clearFilters);

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });

  document.querySelectorAll("[data-load-more]").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.loadMore;
      shown[view] += PAGE_SIZE;
      render();
    });
  });

  window.addEventListener("popstate", () => {
    const params = new URLSearchParams(window.location.search);
    setView(params.get("view") || "upcoming", { pushState: false });
  });

  async function loadMeets() {
    try {
      const response = await fetch("/api/meets/", { headers: { Accept: "application/json" } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The Meet Center could not be loaded.");
      meets = Array.isArray(data.meets) ? data.meets : [];
      populateFilters();
      const params = new URLSearchParams(window.location.search);
      setView(params.get("view") || "upcoming", { pushState: false });
    } catch (error) {
      console.error("Meet Center error:", error);
      totalCount.textContent = "Unable to load meets";
      statusBox.innerHTML =
        "<h2>Meet Center unavailable</h2>" +
        "<p>" + escapeHtml(error.message) + "</p>" +
        '<button class="button button-primary" type="button" data-retry-meets>Try again</button>';
      statusBox.querySelector("[data-retry-meets]")?.addEventListener("click", () => {
        statusBox.innerHTML = "<h2>Loading the Meet Center</h2><p>Please wait while the meet information loads.</p>";
        loadMeets();
      });
    }
  }

  loadMeets();
})();
