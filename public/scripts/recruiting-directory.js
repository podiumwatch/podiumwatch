(() => {
  const root = document.querySelector("[data-recruiting-directory]");

  if (!root) return;

  const form = root.querySelector("[data-recruiting-form]");
  const rows = root.querySelector("[data-recruiting-rows]");
  const mobile = root.querySelector("[data-recruiting-mobile]");
  const message = root.querySelector("[data-recruiting-message]");
  const count = root.querySelector("[data-recruiting-count]");
  const pagination = root.querySelector("[data-recruiting-pagination]");
  const pageLabel = root.querySelector("[data-recruiting-page]");
  const previous = root.querySelector("[data-recruiting-previous]");
  const next = root.querySelector("[data-recruiting-next]");
  const reset = root.querySelector("[data-recruiting-reset]");
  const eventFilter = root.querySelector("[data-recruiting-event-filter]");
  let currentPage = 1;
  let totalPages = 1;
  let busy = false;
  let eventOptionsLoaded = false;
  let pendingEventKey = "";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function titleCase(value) {
    return String(value || "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function starMarkup(stars) {
    const count = Number(stars) || 0;
    const items = [];

    for (let index = 1; index <= 5; index += 1) {
      items.push(
        '<span' + (index > count ? ' data-empty="true"' : "") + '>★</span>'
      );
    }

    return '<span class="recruiting-stars" aria-label="' +
      escapeHtml(count + " out of 5 stars") +
      '">' + items.join("") + "</span>";
  }

  function schoolName(item) {
    return item.school?.school_name ||
      item.team?.school_name ||
      "School not listed";
  }

  function commitment(item) {
    return item.athlete?.college_commitment || "Uncommitted";
  }

  function athleteHref(item) {
    return "/athletes/" +
      encodeURIComponent(item.athlete?.slug || "") +
      "/";
  }

  function rowMarkup(item) {
    const performance = item.display_performance || item.top_performance;
    const performanceText = performance
      ? (performance.event_name || item.primary_event_key) +
        ": " + performance.mark_text
      : "No public verified mark";

    return '<tr>' +
      '<td><span class="recruiting-rank">' +
        escapeHtml(item.state_class_rank || "—") +
      "</span></td>" +
      '<td class="recruiting-athlete"><strong><a href="' +
        escapeHtml(athleteHref(item)) +
        '">' + escapeHtml(item.athlete?.display_name) +
        '</a></strong><span>' +
        escapeHtml(schoolName(item)) +
        "</span></td>" +
      "<td>" +
        escapeHtml(titleCase(item.event_group)) +
        "<br><small>No. " +
        escapeHtml(item.event_group_rank || "—") +
        " in group</small></td>" +
      "<td>" + escapeHtml(item.graduation_year) + "</td>" +
      "<td>" + escapeHtml(performanceText) + "</td>" +
      '<td><span class="recruiting-score">' +
        escapeHtml(Number(item.rating_score).toFixed(0)) +
        "</span></td>" +
      "<td>" + starMarkup(item.star_rating) +
        "<small>" + escapeHtml(item.star_label) + "</small></td>" +
      '<td><span class="recruiting-badge">' +
        escapeHtml(commitment(item)) +
        "</span></td>" +
    "</tr>";
  }

  function cardMarkup(item) {
    const performance = item.display_performance || item.top_performance;
    const performanceText = performance
      ? performance.event_name + ": " + performance.mark_text
      : "No public verified mark";

    return '<article class="recruiting-mobile-card">' +
      '<div class="recruiting-mobile-top"><div><p class="eyebrow">Class rank ' +
        escapeHtml(item.state_class_rank || "—") +
        '</p><h3><a href="' +
        escapeHtml(athleteHref(item)) +
        '">' + escapeHtml(item.athlete?.display_name) +
        '</a></h3><p>' + escapeHtml(schoolName(item)) +
        "</p></div><span class=\"recruiting-score\">" +
        escapeHtml(Number(item.rating_score).toFixed(0)) +
        "</span></div>" +
      starMarkup(item.star_rating) +
      '<div class="recruiting-mobile-facts">' +
        "<div><span>Class</span><strong>" +
          escapeHtml(item.graduation_year) + "</strong></div>" +
        "<div><span>Event group</span><strong>" +
          escapeHtml(titleCase(item.event_group)) + "</strong></div>" +
        "<div><span>Top mark</span><strong>" +
          escapeHtml(performanceText) + "</strong></div>" +
        "<div><span>Status</span><strong>" +
          escapeHtml(commitment(item)) + "</strong></div>" +
      "</div>" +
      '<a class="button button-outline" href="' +
        escapeHtml(athleteHref(item)) +
        '">View athlete evaluation</a>' +
    "</article>";
  }

  function renderEventOptions(events = []) {
    if (!eventFilter || eventOptionsLoaded) return false;

    const selected = pendingEventKey || eventFilter.value;
    eventFilter.innerHTML = ['<option value="">All events</option>']
      .concat(events.map((event) =>
        '<option value="' + escapeHtml(event.event_key) + '">' +
          escapeHtml(event.display_name) +
          " | " + escapeHtml(titleCase(event.event_group)) +
        "</option>"
      ))
      .join("");
    eventOptionsLoaded = true;

    if (
      selected &&
      [...eventFilter.options].some((option) => option.value === selected)
    ) {
      eventFilter.value = selected;
      pendingEventKey = "";
      return true;
    }

    pendingEventKey = "";
    return false;
  }

  function formQuery(page) {
    const data = new FormData(form);
    const query = new URLSearchParams();

    for (const [key, value] of data.entries()) {
      if (String(value).trim()) {
        query.set(key, String(value).trim());
      }
    }

    query.set("page", String(page));
    query.set("page_size", "50");
    return query;
  }

  function syncUrl(query) {
    const url = new URL(window.location.href);
    url.search = query.toString();
    window.history.replaceState({}, "", url);
  }

  function restoreUrl() {
    const query = new URLSearchParams(window.location.search);

    for (const [key, value] of query.entries()) {
      const field = form.elements.namedItem(key);

      if (key === "event_key") {
        pendingEventKey = value;
      } else if (field && !["page", "page_size"].includes(key)) {
        field.value = value;
      }
    }

    currentPage = Math.max(1, Number(query.get("page")) || 1);
  }

  function setStat(selector, value) {
    const element = root.querySelector(selector);

    if (element) element.textContent = String(value ?? 0);
  }

  async function load(page = 1) {
    if (busy) return;
    busy = true;
    let reloadForRestoredEvent = false;
    message.textContent = "Loading published recruit ratings.";
    message.dataset.tone = "success";

    try {
      const query = formQuery(page);
      const response = await fetch(
        "/api/recruiting?" + query.toString(),
        { headers: { Accept: "application/json" } }
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error || "Recruit ratings could not be loaded."
        );
      }

      reloadForRestoredEvent = renderEventOptions(payload.events || []);

      if (reloadForRestoredEvent && !query.get("event_key")) {
        return;
      }

      currentPage = payload.pagination?.page || 1;
      totalPages = payload.pagination?.total_pages || 1;
      syncUrl(query);
      setStat("[data-recruiting-total]", payload.summary?.total || 0);
      setStat("[data-recruiting-five-stars]", payload.summary?.stars?.["5"] || 0);
      setStat("[data-recruiting-committed]", payload.summary?.committed || 0);
      setStat("[data-recruiting-uncommitted]", payload.summary?.uncommitted || 0);

      const items = payload.ratings || [];
      rows.innerHTML = items.length
        ? items.map(rowMarkup).join("")
        : '<tr><td colspan="8">No published recruit ratings matched these filters.</td></tr>';
      mobile.innerHTML = items.length
        ? items.map(cardMarkup).join("")
        : '<div class="empty-state"><h2>No ratings matched</h2><p>Try a broader class, event group, or score range.</p></div>';

      count.textContent =
        (payload.pagination?.total_results || 0) +
        " published evaluations";
      pageLabel.textContent =
        "Page " + currentPage + " of " + totalPages;
      previous.disabled = currentPage <= 1;
      next.disabled = currentPage >= totalPages;
      pagination.hidden = totalPages <= 1;
      message.textContent = items.length
        ? "Recruit ratings loaded. Every score is Podium Watch editorial analysis."
        : "No published recruit ratings matched these filters.";
    } catch (error) {
      rows.innerHTML =
        '<tr><td colspan="8">The recruiting database is unavailable.</td></tr>';
      mobile.innerHTML =
        '<div class="empty-state"><h2>Recruit ratings are not available yet</h2><p>' +
        escapeHtml(error.message) +
        "</p></div>";
      message.textContent = error.message;
      message.dataset.tone = "error";
    } finally {
      busy = false;

      if (reloadForRestoredEvent) {
        load(1);
      }
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    currentPage = 1;
    load(1);
  });

  reset.addEventListener("click", () => {
    form.reset();
    currentPage = 1;
    load(1);
  });

  previous.addEventListener("click", () => {
    if (currentPage > 1) load(currentPage - 1);
  });

  next.addEventListener("click", () => {
    if (currentPage < totalPages) load(currentPage + 1);
  });

  restoreUrl();
  load(currentPage);
})();
