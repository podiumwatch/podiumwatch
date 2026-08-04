(() => {
  const finder = document.querySelector("[data-xc-division-finder]");
  const regionRoot = document.querySelector("[data-track-regions]");
  if (!finder || !regionRoot) return;

  const search = finder.querySelector("[data-xc-search]");
  const division = finder.querySelector("[data-xc-division]");
  const district = finder.querySelector("[data-xc-district]");
  const summary = finder.querySelector("[data-xc-summary]");
  const results = finder.querySelector("[data-xc-results]");
  const more = finder.querySelector("[data-xc-more]");
  let schools = [];
  let visibleCount = 40;

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function normalize(value) {
    return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function matchingSchools() {
    const query = normalize(search.value);
    return schools.filter((school) => {
      const text = normalize(`${school.school_name} ${school.city} ${school.school_id}`);
      return (!query || text.includes(query)) && (!division.value || school.division_2026_27_2027_28 === division.value) && (!district.value || school.athletic_district === district.value);
    });
  }

  function render() {
    const matches = matchingSchools();
    const shown = matches.slice(0, visibleCount);
    summary.textContent = `${matches.length} ${matches.length === 1 ? "school" : "schools"} found. This finder covers boys cross country only.`;
    results.innerHTML = shown.map((school) => {
      const moved = school.division_2025_26 && school.division_2025_26 !== school.division_2026_27_2027_28;
      return `<article class="division-result"><div><p class="eyebrow">School ${escapeHtml(school.school_id)}</p><h3>${escapeHtml(school.school_name)}</h3><p>${escapeHtml(school.city)} | ${escapeHtml(school.athletic_district)} District</p></div><div class="division-result-values"><strong>${escapeHtml(school.division_2026_27_2027_28)}</strong><span>${escapeHtml(String(school.boys_base_enrollment))} boys base enrollment</span>${moved ? `<span class="change-badge">Changed from ${escapeHtml(school.division_2025_26)}</span>` : ""}</div></article>`;
    }).join("") || '<div class="empty-state compact-empty"><h3>No schools match these filters</h3><p>Try a broader school name or clear one of the filters.</p></div>';
    more.hidden = shown.length >= matches.length;
  }

  async function load() {
    try {
      const response = await fetch("/data/boys-xc-divisions-2026-27.json");
      if (!response.ok) throw new Error("Official division data could not be loaded.");
      schools = await response.json();
      render();
    } catch (error) {
      summary.textContent = error.message;
      results.innerHTML = '<div class="empty-state compact-empty"><h3>The division finder is unavailable</h3><p>Use the official OHSAA source link above.</p></div>';
    }
  }

  for (const control of [search, division, district]) {
    control.addEventListener(control === search ? "input" : "change", () => { visibleCount = 40; render(); });
  }
  more.addEventListener("click", () => { visibleCount += 40; render(); });

  document.querySelectorAll("[data-track-division]").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = button.dataset.trackDivision;
      document.querySelectorAll("[data-track-division]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      document.querySelectorAll("[data-track-region]").forEach((card) => { card.hidden = selected !== "all" && card.dataset.division !== selected; });
    });
  });

  load();
})();
