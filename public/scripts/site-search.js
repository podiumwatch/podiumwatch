(() => {
  const root = document.querySelector("[data-site-search-page]");
  if (!root) return;

  const form = root.querySelector("[data-global-search-form]");
  const input = root.querySelector("[data-global-search-input]");
  const results = root.querySelector("[data-global-search-results]");
  const summary = root.querySelector("[data-global-search-summary]");
  const empty = root.querySelector("[data-global-search-empty]");
  let staticIndex = [];
  let teams = [];
  let meets = [];
  let loaded = false;

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function normalize(value) {
    return String(value ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function scoreItem(item, terms) {
    const title = normalize(item.title);
    const subtitle = normalize(item.subtitle);
    const text = normalize(item.searchText || `${item.title} ${item.subtitle || ""}`);
    let score = 0;
    for (const term of terms) {
      if (title === term) score += 100;
      else if (title.startsWith(term)) score += 50;
      else if (title.includes(term)) score += 30;
      if (subtitle.includes(term)) score += 12;
      if (text.includes(term)) score += 5;
      else return 0;
    }
    return score;
  }

  function teamItems(rows) {
    return rows.map((team) => ({
      type: "Team",
      title: team.school_name,
      subtitle: [
        team.mascot,
        team.city,
        team.state,
        team.conference,
        team.region,
        team.cross_country_boys_division,
        team.cross_country_girls_division,
        team.track_boys_division,
        team.track_girls_division
      ].filter(Boolean).join(" | "),
      href: `/team/?slug=${encodeURIComponent(team.slug)}`,
      searchText: [
        team.school_name,
        team.mascot,
        team.city,
        team.state,
        team.conference,
        team.region,
        team.source_school_id,
        team.cross_country_boys_division,
        team.cross_country_girls_division,
        team.track_boys_division,
        team.track_girls_division
      ].filter(Boolean).join(" ")
    }));
  }

  function meetItems(rows) {
    return rows.map((meet) => ({
      type: "Meet",
      title: meet.name || meet.meet_name || "Meet",
      subtitle: [meet.meet_date, meet.city, meet.state, meet.venue].filter(Boolean).join(" | "),
      href: `/meetdetail/?slug=${encodeURIComponent(meet.slug || meet.id)}`,
      searchText: Object.values(meet).filter((value) => typeof value === "string").join(" ")
    }));
  }

  async function loadData() {
    if (loaded) return;
    const requests = [
      fetch("/search-index.json").then((response) => response.ok ? response.json() : []),
      fetch("/api/teams/", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ search: "" }) }).then((response) => response.ok ? response.json() : { teams: [] }),
      fetch("/api/meets/").then((response) => response.ok ? response.json() : { meets: [] })
    ];
    const settled = await Promise.allSettled(requests);
    staticIndex = settled[0].status === "fulfilled" && Array.isArray(settled[0].value) ? settled[0].value : [];
    teams = settled[1].status === "fulfilled" ? teamItems(settled[1].value.teams || []) : [];
    meets = settled[2].status === "fulfilled" ? meetItems(settled[2].value.meets || []) : [];
    loaded = true;
  }

  function render(query) {
    const normalized = normalize(query);
    if (normalized.length < 2) {
      results.innerHTML = "";
      empty.hidden = true;
      summary.textContent = "Enter at least two characters to search.";
      return;
    }
    const terms = normalized.split(/\s+/).filter(Boolean);
    const matches = [...staticIndex, ...teams, ...meets]
      .map((item) => ({ ...item, score: scoreItem(item, terms) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, 60);

    summary.textContent = `${matches.length} ${matches.length === 1 ? "result" : "results"} for “${query}”.`;
    empty.hidden = matches.length > 0;
    results.innerHTML = matches.map((item) => `<article class="search-result-card"><p class="eyebrow">${escapeHtml(item.type || "Page")}</p><h2><a href="${escapeHtml(item.href)}">${escapeHtml(item.title)}</a></h2>${item.subtitle ? `<p>${escapeHtml(item.subtitle)}</p>` : ""}<a class="text-link" href="${escapeHtml(item.href)}">Open result</a></article>`).join("");
  }

  async function runSearch(query) {
    summary.textContent = "Searching Podium Watch.";
    await loadData();
    render(query);
    const url = new URL(location.href);
    if (query) url.searchParams.set("q", query); else url.searchParams.delete("q");
    history.replaceState(null, "", url);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch(input.value.trim());
  });

  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-search-suggestion]");
    if (!button) return;
    input.value = button.dataset.searchSuggestion;
    runSearch(input.value);
  });

  const initial = new URLSearchParams(location.search).get("q") || "";
  input.value = initial;
  if (initial) runSearch(initial);
  else input.focus();
})();
