// Podium Watch Ohio Top 100 -- a fixed "top 100 of one class + gender"
// view over the exact same real Recruit Ratings data /recruiting/'s own
// searchable database uses (same /api/recruiting endpoint, just called
// with graduation_year/gender/sort/page_size pre-set). Rank is the
// live-computed state_class_rank the API already returns -- there is no
// separate hand-curated rank anywhere in this codebase, by design (see
// docs/DECISIONS.md / RECRUITING_PHASE_ONE_ARCHITECTURE.md decision 3).
(() => {
  const root = document.querySelector("[data-top100]");
  if (!root) return;

  const gender = window.PODIUM_TOP_100_GENDER === "girls" ? "girls" : "boys";
  const yearSelect = root.querySelector("[data-top100-year]");
  const rowsBox = root.querySelector("[data-top100-rows]");
  const emptyBox = root.querySelector("[data-top100-empty]");
  const message = root.querySelector("[data-top100-message]");

  if (!yearSelect || !rowsBox || !emptyBox || !message) return;

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
      items.push('<span' + (index > count ? ' data-empty="true"' : "") + '>★</span>');
    }

    return '<span class="top100-stars" aria-label="' +
      escapeHtml(count + " out of 5 stars") +
      '">' + items.join("") + "</span>";
  }

  function schoolName(item) {
    return item.school?.school_name ||
      item.team?.school_name ||
      "School not listed";
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
      return '<div class="top100-commit" data-committed="false"><strong>Uncommitted</strong></div>';
    }

    const activity = (item.recruiting_activity || []).find(
      (entry) => entry.activity_type === "commitment"
    );
    const dateText = activity ? formatDate(activity.activity_date) : "";

    return '<div class="top100-commit" data-committed="true"><strong>' +
      escapeHtml(committed) +
      "</strong>" +
      (dateText ? "<span>Committed " + escapeHtml(dateText) + "</span>" : "") +
      "</div>";
  }

  function rowMarkup(item) {
    const hometown = item.athlete?.hometown;

    return '<article class="ranking-row top100-row">' +
      '<div class="ranking-number">' + escapeHtml(item.state_class_rank || "—") + "</div>" +
      '<div class="ranking-athlete">' +
        '<a class="top100-name" href="' + escapeHtml(athleteHref(item)) + '"><strong>' +
          escapeHtml(item.athlete?.display_name) +
        "</strong></a>" +
        '<span class="top100-position">' + escapeHtml(titleCase(item.event_group)) + "</span>" +
        '<span class="top100-hometown">' +
          (hometown ? escapeHtml(hometown) + " &middot; " : "") +
          "<strong>" + escapeHtml(schoolName(item)) + "</strong>" +
        "</span>" +
      "</div>" +
      '<div class="top100-stats">' +
        '<span class="top100-score">' + escapeHtml(Number(item.rating_score).toFixed(0)) + "</span>" +
        starMarkup(item.star_rating) +
      "</div>" +
      commitmentMarkup(item) +
    "</article>";
  }

  async function load() {
    const year = yearSelect.value;
    message.hidden = false;
    message.textContent = `Loading the Class of ${year}.`;
    message.dataset.tone = "";
    rowsBox.innerHTML = "";
    emptyBox.hidden = true;

    try {
      const response = await fetch("/api/recruiting/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          graduation_year: year,
          gender,
          sort: "rating",
          page_size: 100
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "The Ohio Top 100 could not be loaded.");
      }

      const ratings = Array.isArray(data.ratings) ? data.ratings : [];

      if (ratings.length === 0) {
        message.hidden = true;
        emptyBox.hidden = false;
        return;
      }

      rowsBox.innerHTML = ratings.map(rowMarkup).join("");
      message.hidden = true;
    } catch (error) {
      message.hidden = false;
      message.dataset.tone = "error";
      message.textContent = error.message || "The Ohio Top 100 could not be loaded.";
    }
  }

  yearSelect.addEventListener("change", load);
  load();
})();
