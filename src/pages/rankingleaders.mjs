import { breadcrumb, layout, pageHero } from "../lib/html.mjs";

// State Leaders -- Podium Watch's own statewide 5K cross country
// leaderboard, built from this project's own athlete_performances data
// (api/rankings/leaders.js -> lib/athlete_leaders_service.mjs), not a
// recreation of any other site's rankings page. Cross country only
// ranks the 5K here (the one distance run across the whole state);
// track and field isn't wired in yet, shown as a disabled pill rather
// than a dead link. Filters: Boys/Girls, Year, Grade, and Division
// (Ohio's own four cross country divisions, or All) -- reworded from
// "League" since that word doesn't mean anything in Ohio high school
// cross country.
//
// Reuses the same visual language as the OATCCC poll page (Impact-font
// uppercase tabs, black header row, green accent) since that's already
// Podium Watch's own established scoreboard look -- but this page is
// live data, not a static embedded JSON blob, so its interaction is a
// real fetch to /api/rankings/leaders/ instead.

export function rankingLeadersPage(site) {
  const pathname = "/rankings/leaders/";
  const title = "State Leaders";

  const content = `${pageHero({
    eyebrow: "Ohio Cross Country",
    title: "5K State Leaders",
    description: "Ohio's fastest verified 5K cross country times, built entirely from Podium Watch's own collected results."
  })}

  <style>
    .leaders-season-pills { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
    .leaders-season-pills button {
      min-height: 40px;
      padding: 8px 20px;
      border: 1px solid var(--ink);
      background: var(--black);
      color: var(--white);
      font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
      font-size: 0.82rem;
      letter-spacing: 1px;
      text-transform: uppercase;
      cursor: default;
    }
    .leaders-season-pills button[data-leaders-season-disabled] {
      background: transparent;
      color: var(--muted);
      border-color: var(--line);
      cursor: not-allowed;
    }
    .leaders-season-pills .leaders-soon { font-size: 0.68rem; letter-spacing: 0.5px; text-transform: none; font-family: inherit; }

    .leaders-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin-bottom: 8px; }
    .leaders-gender-tabs { display: flex; gap: 10px; }
    .leaders-gender-tabs button {
      min-height: 44px;
      padding: 10px 22px;
      border: 1px solid var(--ink);
      background: transparent;
      color: var(--ink);
      font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
      font-size: 0.88rem;
      letter-spacing: 1px;
      text-transform: uppercase;
      cursor: pointer;
    }
    .leaders-gender-tabs button.active { color: var(--black); background: var(--green); border-color: var(--green); }

    .leaders-filter-group { display: flex; flex-wrap: wrap; gap: 12px; }
    .leaders-filter-group label { display: flex; flex-direction: column; gap: 4px; font-size: 0.74rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); }
    .leaders-filter-group select {
      min-height: 44px;
      padding: 10px 14px;
      border: 1px solid var(--ink);
      background: var(--white);
      color: var(--ink);
      font: inherit;
      font-weight: 700;
    }

    .leaders-note { margin: 18px 0; padding: 14px 18px; border: 1px solid var(--line); border-left: 6px solid var(--green); background: var(--paper); color: var(--ink); max-width: 68ch; }

    .leaders-table-wrap { width: 100%; overflow-x: auto; border: 1px solid var(--line); background: var(--white); margin-top: 8px; }
    .leaders-table { width: 100%; border-collapse: collapse; }
    .leaders-table th, .leaders-table td { text-align: left; padding: 12px 14px; border-bottom: 1px solid var(--line); vertical-align: top; }
    .leaders-table th { font-size: 0.78rem; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: var(--white); background: var(--black); white-space: nowrap; }
    .leaders-table td.leaders-cell-rank { font-weight: 900; width: 1%; white-space: nowrap; font-size: 1.05rem; }
    .leaders-table tr[data-leaders-rank="1"] td.leaders-cell-rank { color: var(--green-dark); }
    .leaders-table td.leaders-cell-athlete { font-weight: 700; }
    .leaders-table td.leaders-cell-athlete a { color: var(--ink); text-decoration: none; }
    .leaders-table td.leaders-cell-athlete a:hover { text-decoration: underline; }
    .leaders-table td.leaders-cell-school { color: var(--muted); font-size: 0.9rem; }
    .leaders-table td.leaders-cell-time { font-variant-numeric: tabular-nums; font-weight: 800; white-space: nowrap; }
    .leaders-table tbody tr:nth-child(even) { background: #fafafa; }
    .leaders-empty, .leaders-loading, .leaders-error { padding: 40px 20px; text-align: center; color: var(--muted); }
    .leaders-error { color: var(--danger); }

    /* Mobile: the 560px query below already touched this table once
       (smaller padding/font) but never restructured the row itself, so
       5 columns of text -- one of them "Meet Name / Date" already
       packed onto two lines -- stayed a cramped, scrolly strip. Below
       700px it becomes one compact row instead: rank badge + athlete
       (with school/division already a sub-line) + time on the primary
       line, Grade and Meet/Date as a smaller secondary line -- the same
       pattern used on the OATCCC poll and mock meets tables. */
    @media (max-width: 700px) {
      .leaders-table-wrap { overflow-x: visible; }
      .leaders-table thead { display: none; }
      .leaders-table, .leaders-table tbody { display: block; width: 100%; }
      .leaders-table tbody tr:nth-child(even) { background: transparent; }
      .leaders-table tr {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        column-gap: 10px;
        row-gap: 4px;
        padding: 12px 14px;
        border-bottom: 1px solid var(--line);
      }
      .leaders-table tr:nth-child(even) { background: #fafafa; }
      .leaders-table td { display: block; padding: 0; border: none; vertical-align: baseline; }

      .leaders-table td.leaders-cell-rank {
        order: 1;
        flex: 0 0 auto;
        display: grid;
        place-items: center;
        min-width: 30px;
        width: max-content;
        height: 30px;
        padding: 0 8px;
        border-radius: 999px;
        background: var(--black);
        color: var(--white);
        font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
        font-size: 1rem;
      }
      .leaders-table tr[data-leaders-rank="1"] td.leaders-cell-rank { background: var(--green); color: var(--black); }
      .leaders-table td.leaders-cell-athlete { order: 2; flex: 1 1 auto; min-width: 0; }
      .leaders-table td.leaders-cell-time { order: 3; flex: 0 0 auto; font-size: 1.05rem; }
      .leaders-table td[data-label="Grade"],
      .leaders-table td[data-label="Meet"] {
        order: 4;
        flex: 1 0 100%;
        margin-left: 40px;
        font-size: 0.82rem;
        color: var(--muted);
      }
      .leaders-table td[data-label="Grade"]::before { content: attr(data-label) ": "; font-weight: 700; }
    }
  </style>

  <section class="section section-paper" aria-labelledby="leaders-title">
    <div class="container">
      ${breadcrumb([{ label: "Home", href: "/" }, { label: "Rankings", href: "/rankings/" }, { label: title }])}

      <div class="leaders-season-pills" role="group" aria-label="Choose a sport">
        <button type="button">Cross Country</button>
        <button type="button" data-leaders-season-disabled title="Track and field leaders are coming soon.">Track and Field <span class="leaders-soon">(Coming soon)</span></button>
      </div>

      <div class="section-heading">
        <div><p class="eyebrow">5K only</p><h2 id="leaders-title">Boys and girls, every division</h2></div>
      </div>

      <div class="leaders-controls" role="group" aria-label="Filter State Leaders">
        <div class="leaders-gender-tabs" role="group" aria-label="Choose gender">
          <button type="button" class="active" data-leaders-gender="boys">Boys</button>
          <button type="button" data-leaders-gender="girls">Girls</button>
        </div>
        <div class="leaders-filter-group">
          <label>Year<select data-leaders-year></select></label>
          <label>Grade<select data-leaders-grade>
            <option value="all">All Grades</option>
            <option value="9">9th Grade</option>
            <option value="10">10th Grade</option>
            <option value="11">11th Grade</option>
            <option value="12">12th Grade</option>
          </select></label>
          <label>Division<select data-leaders-division>
            <option value="all">All Divisions</option>
            <option value="1">Division I</option>
            <option value="2">Division II</option>
            <option value="3">Division III</option>
            <option value="4">Division IV</option>
          </select></label>
        </div>
      </div>

      <p class="leaders-note">Built from verified results Podium Watch has collected so far -- not every athlete or meet is included yet, and grade filtering will fill in as more detailed results are added. A leaderboard shows each athlete's single fastest time, not every race they've run.</p>

      <div class="leaders-table-wrap">
        <table class="leaders-table">
          <thead><tr><th>Rank</th><th>Athlete</th><th>Grade</th><th>Meet &middot; Date</th><th>Time</th></tr></thead>
          <tbody data-leaders-rows><tr><td colspan="5" class="leaders-loading">Loading State Leaders.</td></tr></tbody>
        </table>
      </div>
    </div>
  </section>

  <script src="/scripts/ranking-leaders.js" defer></script>
  <script src="/scripts/page-view.js" defer></script>`;

  return layout({
    site,
    title,
    description: "Ohio's fastest verified 5K cross country times, filterable by year, grade, and division -- Podium Watch's own statewide leaderboard.",
    pathname,
    content
  });
}
