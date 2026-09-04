// Ohio Cross Country Top 250 (boys and girls) -- calls the exact same
// /api/recruiting/ endpoint the general searchable database and the
// combined Top 100 page use, just scoped to graduation_year=2027, the
// gender this page instance was built for (window.PODIUM_TOP_250_XC_GENDER),
// event_group=cross_country, page_size=250. Rank shown is this page's own sort
// position (array index), not the API's state_class_rank -- that field is
// dense_rank()'d across a class's combined event groups and collapses tied
// scores into shared numbers, which reads fine at Top 100 scale but shows
// visibly repeated ranks across a full 250-athlete spread. A straight
// sequential position (fastest verified time first, since the API's own
// "rating" sort already orders by rating_score desc) is what a "Top 250"
// list actually means here.
(() => {
  const root = document.querySelector("[data-top250xc]");
  if (!root) return;

  const gender = window.PODIUM_TOP_250_XC_GENDER === "girls" ? "girls" : "boys";
  const rowsBox = root.querySelector("[data-top250xc-rows]");
  const emptyBox = root.querySelector("[data-top250xc-empty]");
  const message = root.querySelector("[data-top250xc-message]");

  if (!rowsBox || !emptyBox || !message) return;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  const EVENT_LABELS = {
    xc_1_mile: "1 Mile",
    xc_2_mile: "2 Mile",
    xc_3k: "3K",
    xc_3200: "3200",
    xc_5k: "5K"
  };

  function starMarkup(stars) {
    const count = Number(stars) || 0;
    const items = [];

    for (let index = 1; index <= 5; index += 1) {
      items.push('<span' + (index > count ? ' data-empty="true"' : "") + '>★</span>');
    }

    return '<span class="top250xc-stars" aria-label="' +
      escapeHtml(count + " out of 5 stars") +
      '">' + items.join("") + "</span>";
  }

  function schoolName(item) {
    return item.school?.school_name || item.team?.school_name || "School not listed";
  }

  function schoolCity(item) {
    // Real hometown data isn't populated for most of these athletes yet --
    // the school's own city is a reasonable, honest stand-in for "where
    // this runner is from" rather than showing nothing at all.
    return item.athlete?.hometown || item.school?.city || item.team?.city || "";
  }

  function athleteHref(item) {
    return "/athletes/" + encodeURIComponent(item.athlete?.slug || "") + "/";
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function commitmentMarkup(item) {
    const committed = item.athlete?.college_commitment;

    if (!committed) {
      return '<div class="top250xc-commit" data-committed="false"><strong>Uncommitted</strong></div>';
    }

    const activity = (item.recruiting_activity || []).find(
      (entry) => entry.activity_type === "commitment"
    );
    const dateText = activity ? formatDate(activity.activity_date) : "";

    return '<div class="top250xc-commit" data-committed="true"><strong>' +
      escapeHtml(committed) +
      "</strong>" +
      (dateText ? "<span>Committed " + escapeHtml(dateText) + "</span>" : "") +
      "</div>";
  }

  function rowMarkup(item, rank) {
    const city = schoolCity(item);
    const eventLabel = EVENT_LABELS[item.primary_event_key] || "5K";
    // The API's own join (chooseTopPerformance) surfaces whichever verified
    // performance is actually on file for this athlete's primary event --
    // their genuine fastest verified mark, which is the right number to
    // show here (not a copy of this specific ranking pass's own source
    // value, which could go stale the moment a newer verified time lands).
    const markText = item.top_performance?.mark_text || "--";

    return '<article class="ranking-row top250xc-row">' +
      '<div class="ranking-number">' + escapeHtml(rank) + "</div>" +
      '<div class="ranking-athlete">' +
        '<a class="top250xc-name" href="' + escapeHtml(athleteHref(item)) + '"><strong>' +
          escapeHtml(item.athlete?.display_name) +
        "</strong></a>" +
        '<span class="top250xc-event">' + escapeHtml(eventLabel) + '</span>' +
        '<span class="top250xc-hometown">' +
          (city ? escapeHtml(city) + " &middot; " : "") +
          "<strong>" + escapeHtml(schoolName(item)) + "</strong>" +
        "</span>" +
      "</div>" +
      '<div class="top250xc-time">' + escapeHtml(markText) + '</div>' +
      '<div class="top250xc-stats">' +
        '<span class="top250xc-score">' + escapeHtml(Number(item.rating_score).toFixed(0)) + "</span>" +
        starMarkup(item.star_rating) +
      "</div>" +
      commitmentMarkup(item) +
    "</article>";
  }

  async function fetchPage(page) {
    // /api/recruiting/ caps page_size at 100 (shared by the general search
    // page and the combined Top 100 page) -- rather than raise that shared
    // cap for this one page's larger list, this fetches 3 pages (100 + 100
    // + 50) and concatenates them client-side. Same real data, same sort
    // order (rating desc), just assembled across more than one request.
    const response = await fetch("/api/recruiting/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        graduation_year: 2027,
        gender,
        event_group: "cross_country",
        sort: "rating",
        page,
        page_size: 100
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "The Top 250 could not be loaded.");
    }

    return data;
  }

  async function load() {
    message.hidden = false;
    message.textContent = "Loading the Ohio " + (gender === "girls" ? "Girls" : "Boys") + " Cross Country Top 250.";
    message.dataset.tone = "";
    rowsBox.innerHTML = "";
    emptyBox.hidden = true;

    try {
      const first = await fetchPage(1);
      let ratings = Array.isArray(first.ratings) ? first.ratings : [];

      for (let page = 2; page <= first.pagination.total_pages && ratings.length < 250; page += 1) {
        const next = await fetchPage(page);
        ratings = ratings.concat(Array.isArray(next.ratings) ? next.ratings : []);
      }

      if (ratings.length === 0) {
        message.hidden = true;
        emptyBox.hidden = false;
        return;
      }

      rowsBox.innerHTML = ratings.map((item, index) => rowMarkup(item, index + 1)).join("");
      message.hidden = true;
    } catch (error) {
      message.hidden = false;
      message.dataset.tone = "error";
      message.textContent = error.message || "The Top 250 could not be loaded.";
    }
  }

  load();
})();
