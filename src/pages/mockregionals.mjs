import { breadcrumb, emptyState, icon, layout, pageHero } from "../lib/html.mjs";
import { scoreTeams, selectIndividualQualifiers, validateDivisionRoster } from "../lib/mock_scoring.mjs";
import regionalsData from "../data/mock-regionals-2026.json" with { type: "json" };

// 2026 Mock Regionals & State -- team-only mock meets built on the real
// 2026 OHSAA cross country tournament structure (4 regions x 4 divisions x
// boys/girls, minus Northwest Division I, which doesn't exist), projected
// from the top 75 Athletic.net teams per division/gender and each
// runner's real season-best 5K time -- not a real meet result.
//
// Every team's score, mock rank, sixth/seventh displacement, and every
// individual qualifier is computed at build time by src/lib/mock_scoring.mjs
// from raw supplied times -- nothing here is hand-entered pre-scored, and
// an upstream source's own scoring (if supplied) is never trusted as
// authoritative. That engine is verified to reproduce the independently-
// checked September 17 mock meets scores exactly, including the
// documented Gahanna Lincoln/Springboro sixth-runner tiebreak, and its
// individual-qualifier/displacement logic is verified separately against
// constructed test cases (tie-at-cutoff, incomplete teams, a fast runner
// from a non-qualifying team displacing a qualifying team's scorers).
//
// Data entry is the same lightweight, no-database pattern already
// established for src/data/oatccc-coaches-poll.json: a team's roster is
// added directly to src/data/mock-regionals-2026.json's `teams` array for
// its region, then a rebuild picks it up -- no admin tool, no import
// pipeline, no database migration for this version (a live, DB-backed
// version with alias/duplicate tooling is a deliberate later migration,
// not part of this build). A team's own region/athleticDistrict/
// ohsaaSchoolId/city fields are the source of truth for where it belongs;
// name text alone is never trusted to resolve a same-named-school
// ambiguity (e.g. "Western Reserve" -- more than one real Ohio school can
// share a name). A team or athlete that can't be confidently matched to
// one real division/region is left out of the file entirely rather than
// guessed into a bucket.
//
// validateDivisionRoster() runs once per division (mockRegionalsAllPages,
// before generating any of that division's pages) across every one of its
// regions combined and throws a clear build-time error naming the exact
// problem if the same team or the same athlete appears more than once --
// a loud build failure here is preferred over a silently wrong public
// page, matching this codebase's established validateStory()-style
// data-integrity posture (src/lib/content.mjs).
//
// Individual qualifiers (OHSAA's real rule: the fastest finishers not on
// a team that already qualified as a team, taken in real regional finish
// order) are selected per region via selectIndividualQualifiers() and
// shown on that region's own page. The State page pools each region's
// real qualifying TEAMS *and* qualifying INDIVIDUALS together and
// re-scores that combined field fresh -- so a fast individual genuinely
// displaces team scorers at State exactly like it would in a real meet,
// never entered by hand. Every State entrant (team or individual) keeps
// its real original region visible.

const REGION_ORDER = ["central", "northeast", "northwest", "southwest"];
const REGION_LABELS = { central: "Central", northeast: "Northeast", northwest: "Northwest", southwest: "Southwest" };
const PROJECTION_NOTE = "Projected from the top 75 Athletic.net teams and the top 500 Athletic.net individuals for this division and gender, based on season best times. This is a modeled projection, not a real meet result. A supplemental individual is only included when their school does not already have a top-75 team roster in this division.";

function divisionLabel(entry) {
  return entry.label;
}

function regionSlug(divisionId, regionKey) {
  return `${regionKey}-${divisionId}`;
}

function sharedStyles() {
  return `<style>
    .mr-explainer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 20px; padding: 22px 26px; border: 1px solid var(--line); border-left: 6px solid var(--green); background: var(--paper); }
    .mr-explainer p { margin: 0; max-width: 62ch; color: var(--ink); }
    .mr-explainer .button { flex-shrink: 0; }
    .mr-projection-note { margin: 0 0 28px; padding: 14px 18px; border: 1px dashed var(--line); color: var(--muted); font-size: .86rem; }
    .mr-crumbs-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
    .mr-crumbs-row a { padding: 8px 16px; border: 1px solid var(--ink); color: var(--ink); font-weight: 700; font-size: .86rem; }
    .mr-crumbs-row a.active { background: var(--black); color: var(--white); border-color: var(--black); }
    .mr-heading { font-weight: 800; font-size: 1.15rem; margin-bottom: 10px; }
    .mr-meta { color: var(--muted); margin-bottom: 20px; }
    .mr-table td.mr-cell-rank { font-weight: 800; white-space: nowrap; }
    .mr-table td.mr-cell-school { font-weight: 700; }
    .mr-table td.mr-cell-num { font-variant-numeric: tabular-nums; }
    .mr-table th { white-space: nowrap; }
    .mr-qualifies td { background: #f0faf3; }
    .mr-place-gold td { background: #fbf1d3; }
    .mr-place-silver td { background: #eef0f1; }
    .mr-qualify-badge { display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 999px; background: var(--green); color: var(--black); font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif; font-size: .68rem; letter-spacing: .5px; text-transform: uppercase; }
    .mr-team-toggle { min-height: 34px; padding: 6px 12px; border: 1px solid var(--ink); background: var(--white); color: var(--ink); font-weight: 700; font-size: .82rem; cursor: pointer; }
    .mr-standings-table tbody tr[data-mr-team-row] { cursor: pointer; }
    .mr-detail-row td { padding: 0 !important; }
    .mr-detail-summary { display: none; }
    .mr-detail-summary-item { display: flex; flex-direction: column; gap: 2px; }
    .mr-detail-summary-label { font-size: .68rem; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); font-weight: 700; }
    .mr-detail-summary-value { font-weight: 800; font-variant-numeric: tabular-nums; }
    .mr-roster { width: 100%; border-collapse: collapse; background: #fafafa; }
    .mr-roster th, .mr-roster td { padding: 8px 14px; text-align: left; border-bottom: 1px solid var(--line); font-size: .88rem; }
    .mr-roster th { font-size: .7rem; letter-spacing: .5px; text-transform: uppercase; color: var(--muted); }
    .mr-role-scored { color: var(--green-dark); font-weight: 700; }
    .mr-role-displaced { color: var(--muted); }
    .mr-incomplete { color: var(--danger); font-style: italic; }
    .mr-downloads { display: flex; flex-wrap: wrap; gap: 12px; margin: 22px 0; }
    .mr-region-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; margin-bottom: 32px; }
    .mr-region-card { display: block; padding: 18px 20px; border: 1px solid var(--line); background: var(--white); }
    .mr-region-card:hover, .mr-region-card:focus-visible { border-color: var(--green); }
    .mr-region-card h3 { margin: 0 0 6px; font-size: 1.05rem; }
    .mr-region-card .mr-status-pending { color: var(--muted); font-size: .86rem; }
    .mr-region-card .mr-status-ready { color: var(--green-dark); font-size: .86rem; font-weight: 700; }
    .mr-division-block { margin-bottom: 44px; }
    .mr-division-block h2 { margin-bottom: 14px; }
    .mr-individuals-section { margin-top: 40px; }
    .mr-individuals-section h2 { margin-bottom: 8px; }

    /* Mobile: the site-wide table-to-card system (main.css, @700px) already
       stacks a .table-scroll table's rows into label/value cards via
       data-label -- but the roster expand panel is a table NESTED inside
       one wide <td> of its parent row, and that generic system's blanket
       ".table-scroll td { display:flex }" rule was hitting that wrapping
       <td> too, flexing a cell whose only real content is an entire nested
       table and visually breaking it. Scoped fixes below: keep the
       wrapping cell a plain block, and give both the standings cards and
       the nested roster cards real card styling (border, radius, a
       qualifying accent) instead of the generic system's bare row strips,
       since this page's rows carry meaningfully more per-row information
       (rank badge, six numeric columns, an expand action) than a typical
       data table elsewhere on the site. */
    @media (max-width: 700px) {
      .mr-explainer { flex-direction: column; align-items: stretch; padding: 18px 20px; }
      .mr-explainer .button { width: 100%; text-align: center; }
      .mr-crumbs-row a { padding: 9px 14px; font-size: .82rem; }

      /* Generic card fallback -- still used by the individual-qualifiers
         table, which has no roster toggle/expand and stays one card per
         row with every field labeled. Scoped to DIRECT children of the
         table's own tbody (">" not " ") so it doesn't also reach into
         the roster table nested several levels down inside a detail
         row's td -- a descendant selector here previously caught the
         roster's own rows too, forcing them into stacked cards despite
         the roster-specific rules below. */
      .mr-table > tbody > tr:not(.mr-detail-row) {
        display: block !important;
        margin-bottom: 12px;
        padding: 14px 16px !important;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--white);
      }
      .mr-table > tbody > tr.mr-qualifies:not(.mr-detail-row) { border-color: var(--green); border-left-width: 4px; background: #f0faf3; }
      .mr-table > tbody > tr > td.mr-cell-school { font-size: 1.05rem; font-weight: 800; padding-top: 2px !important; padding-bottom: 10px !important; margin-bottom: 6px; border-bottom: 1px solid var(--line); }
      .mr-table > tbody > tr > td.mr-cell-school::before { align-self: center; }
      .mr-table > tbody > tr > td[data-label=""] { justify-content: flex-end; padding-top: 10px !important; }

      .mr-detail-row > td { display: block !important; padding: 0 !important; }
      .mr-detail-row > td::before { content: none !important; }

      /* Roster rows: Pos/Runner/Season best/Points on one line (Role
         drops to a second line only when needed) instead of the generic
         label-stacked card -- one kid's whole line should read left to
         right without extra taps. */
      .mr-roster { margin-top: 10px; }
      .mr-roster th, .mr-roster td { padding: 0 !important; }
      .mr-roster td::before { content: none !important; }
      .mr-roster tbody tr {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        column-gap: 10px;
        row-gap: 2px;
        border-bottom: 1px solid var(--line);
        padding: 9px 4px !important;
      }
      .mr-roster tbody tr:last-child { border-bottom: none; }
      .mr-roster td[data-label="Pos"] { flex: 0 0 auto; width: 18px; font-weight: 800; color: var(--muted); font-size: .8rem; }
      .mr-roster td[data-label="Runner"] { flex: 1 1 90px; min-width: 0; font-weight: 700; font-size: .9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .mr-roster td[data-label="Season best"] { flex: 0 0 auto; font-variant-numeric: tabular-nums; font-size: .82rem; color: var(--muted); }
      .mr-roster td[data-label="Points"] { flex: 0 0 auto; min-width: 20px; text-align: right; font-weight: 800; font-variant-numeric: tabular-nums; font-size: .88rem; }
      .mr-roster td[data-label="Role"] { flex: 1 0 100%; font-size: .7rem; }

      /* Standings table only: a compact single-line row (place, advance
         color, school, score, expand chevron) instead of a tall stacked
         card, so 6-7 teams are visible per scroll on a phone. First
         five/Sixth/Seventh move into the tap-to-expand detail panel
         (.mr-detail-summary, shown above the roster) instead of stacking
         as extra lines on every row -- the data still exists on the page,
         just one tap away instead of always-visible. */
      .mr-standings-table > tbody > tr:not(.mr-detail-row) {
        display: flex !important;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
        padding: 10px 12px !important;
      }
      .mr-standings-table > tbody > tr:not(.mr-detail-row) > td { padding: 0 !important; }
      .mr-standings-table > tbody > tr:not(.mr-detail-row) > td::before { content: none !important; }
      .mr-standings-table > tbody > tr.mr-place-gold:not(.mr-detail-row) { background: #fbf1d3; border-color: #d9b64e; }
      .mr-standings-table > tbody > tr.mr-place-silver:not(.mr-detail-row) { background: #eef0f1; border-color: #a9b0b6; }

      .mr-standings-table td.mr-cell-rank {
        flex: 0 0 auto;
        display: flex !important;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-width: 26px;
        font-size: 1rem;
      }
      .mr-standings-table td.mr-cell-rank .mr-qualify-badge { margin: 3px 0 0; font-size: .52rem; padding: 1px 6px; }

      .mr-standings-table td.mr-cell-school {
        flex: 1 1 auto;
        min-width: 0;
        display: block !important;
        font-size: .95rem;
        font-weight: 800;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        border-bottom: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      .mr-standings-table td[data-label="Region"],
      .mr-standings-table td[data-label="First five"],
      .mr-standings-table td[data-label="Sixth"],
      .mr-standings-table td[data-label="Seventh"] {
        display: none !important;
      }

      .mr-standings-table td.mr-cell-num[data-label="Score"] {
        flex: 0 0 auto;
        display: block !important;
        font-weight: 800;
        font-size: .92rem;
      }

      .mr-standings-table td[data-label=""] { flex: 0 0 auto; display: block !important; }
      .mr-team-toggle { width: auto; min-width: 32px; min-height: 32px; margin-top: 0; padding: 4px 10px; font-size: .72rem; border-radius: 999px; }

      .mr-detail-summary {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        margin: 0 0 12px;
        padding: 10px 12px;
        background: #fafafa;
        border-radius: 8px;
      }
    }
  </style>`;
}

function rosterTableHtml(team) {
  const rows = team.runners.map((runner) => {
    const role = team.complete
      ? (runner.scoring ? '<span class="mr-role-scored">Scored</span>' : '<span class="mr-role-displaced">Displaced</span>')
      : '<span class="mr-incomplete">Incomplete team</span>';
    return `<tr>` +
      `<td data-label="Pos">${runner.teamPosition}</td>` +
      `<td data-label="Runner">${escapeHtml(runner.name)}</td>` +
      `<td data-label="Season best">${escapeHtml(runner.seasonBest)}</td>` +
      `<td data-label="Points">${team.complete ? formatPoints(runner.placePoints) : "--"}</td>` +
      `<td data-label="Role">${role}</td>` +
      `</tr>`;
  }).join("");
  return `<table class="mr-roster"><thead><tr><th>Pos</th><th>Runner</th><th>Season best</th><th>Points</th><th>Role</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatPoints(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

// Shown above the roster table once a standings row is expanded -- on
// mobile the compact row hides First five/Sixth/Seventh (and Region, on
// the State page) to keep each row to one line, so this reproduces those
// same values in the expanded panel instead of dropping them.
function detailSummaryHtml({ region, firstFive, sixth, seventh }) {
  const regionItem = region ? `<div class="mr-detail-summary-item"><span class="mr-detail-summary-label">Region</span><span class="mr-detail-summary-value">${escapeHtml(region)}</span></div>` : "";
  return `<div class="mr-detail-summary">
    ${regionItem}
    <div class="mr-detail-summary-item"><span class="mr-detail-summary-label">First five</span><span class="mr-detail-summary-value">${firstFive}</span></div>
    <div class="mr-detail-summary-item"><span class="mr-detail-summary-label">Sixth</span><span class="mr-detail-summary-value">${sixth}</span></div>
    <div class="mr-detail-summary-item"><span class="mr-detail-summary-label">Seventh</span><span class="mr-detail-summary-value">${seventh}</span></div>
  </div>`;
}

function teamStandingsTable(teams, qualifierCount, { showRegion = false, highlightMedals = false } = {}) {
  if (!teams.length) return "";
  const regionHeader = showRegion ? "<th>Region</th>" : "";
  const rows = teams.map((team, index) => {
    const qualifies = team.complete && qualifierCount != null && team.mockRank <= qualifierCount;
    const medalClass = highlightMedals && team.complete && team.mockRank === 1 ? "mr-place-gold"
      : highlightMedals && team.complete && team.mockRank === 2 ? "mr-place-silver"
      : "";
    const sixth = team.sixthPlace != null ? formatPoints(team.sixthPlace) : "None";
    const seventh = team.seventhPlace != null ? formatPoints(team.seventhPlace) : "None";
    const firstFive = team.complete
      ? team.runners.filter((r) => r.teamPosition <= 5).map((r) => formatPoints(r.placePoints)).join(", ")
      : "--";
    const regionCell = showRegion ? `<td data-label="Region">${escapeHtml(team.region || "--")}</td>` : "";
    const summary = detailSummaryHtml({ region: showRegion ? (team.region || "--") : null, firstFive, sixth, seventh });
    return (
      `<tr class="${[qualifies ? "mr-qualifies" : "", medalClass].filter(Boolean).join(" ")}" data-mr-team-row="${index}">` +
      `<td class="mr-cell-rank" data-label="Place">${team.complete ? team.mockRank : "--"}${qualifies ? '<span class="mr-qualify-badge">Advances</span>' : ""}</td>` +
      `<td class="mr-cell-school" data-label="School">${escapeHtml(team.name)}</td>` +
      regionCell +
      `<td class="mr-cell-num" data-label="Score">${team.complete ? formatPoints(team.score) : '<span class="mr-incomplete">Incomplete (fewer than 5)</span>'}</td>` +
      `<td class="mr-cell-num" data-label="First five">${firstFive}</td>` +
      `<td class="mr-cell-num" data-label="Sixth">${sixth}</td>` +
      `<td class="mr-cell-num" data-label="Seventh">${seventh}</td>` +
      `<td data-label=""><button type="button" class="mr-team-toggle" data-mr-toggle="${index}" aria-expanded="false">Roster</button></td>` +
      `</tr>` +
      `<tr class="mr-detail-row" data-mr-detail="${index}" hidden><td colspan="${showRegion ? 8 : 7}">${summary}${rosterTableHtml(team)}</td></tr>`
    );
  }).join("");

  return `<div class="table-scroll" tabindex="0">
    <table class="mr-table mr-standings-table">
      <thead><tr><th>Place</th><th>School</th>${regionHeader}<th>Score</th><th>First five</th><th>Sixth</th><th>Seventh</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <script>(()=>{
    document.currentScript.previousElementSibling.querySelectorAll('[data-mr-team-row]').forEach((row) => {
      const index = row.dataset.mrTeamRow;
      const detail = document.querySelector('[data-mr-detail="' + index + '"]');
      const button = row.querySelector('[data-mr-toggle]');
      if (!detail || !button) return;
      row.addEventListener('click', () => {
        const willShow = detail.hidden;
        detail.hidden = !willShow;
        button.setAttribute('aria-expanded', String(willShow));
      });
    });
  })();</script>`;
}

// Shared flat table for individual qualifiers -- used both on a regional
// page (who from THIS region would individually qualify) and the State
// page (who actually did, with their original region shown since they're
// now mixed into a statewide field). No roster-toggle needed: an
// individual is one row, not a team with a roster to expand.
function individualsTableHtml(individuals, { showRegion = false } = {}) {
  if (!individuals.length) return "<p class=\"mr-meta\">None -- every qualifying spot from this region's non-advancing teams was already accounted for, or no individual qualifier slots exist here.</p>";
  const regionHeader = showRegion ? "<th>Region</th>" : "";
  const rows = individuals.map((runner) => {
    const regionCell = showRegion ? `<td data-label="Region">${escapeHtml(runner.originalRegion || "--")}</td>` : "";
    return (
      `<tr>` +
      `<td class="mr-cell-num" data-label="Place">${formatPoints(runner.placePoints)}</td>` +
      `<td class="mr-cell-school" data-label="Runner">${escapeHtml(runner.name)}</td>` +
      `<td data-label="School">${escapeHtml(runner.originalTeam)}</td>` +
      regionCell +
      `<td data-label="Season best">${escapeHtml(runner.seasonBest)}</td>` +
      `</tr>`
    );
  }).join("");
  return `<div class="table-scroll" tabindex="0">
    <table class="mr-table">
      <thead><tr><th>Place</th><th>Runner</th><th>School</th>${regionHeader}<th>Season best</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function crumbsRow(divisionEntry, activeKey) {
  const items = REGION_ORDER.filter((key) => divisionEntry.regions[key]).map((key) => {
    const href = `/mock-meets/regionals/${regionSlug(divisionEntry.id, key)}/`;
    return `<a href="${href}" class="${key === activeKey ? "active" : ""}">${REGION_LABELS[key]}</a>`;
  });
  items.push(`<a href="/mock-meets/state/${divisionEntry.id}/" class="${activeKey === "state" ? "active" : ""}">State</a>`);
  return `<div class="mr-crumbs-row" role="group" aria-label="Choose a region">${items.join("")}</div>`;
}

export function mockRegionalPage(site, divisionEntry, regionKey) {
  const region = divisionEntry.regions[regionKey];
  const pathname = `/mock-meets/regionals/${regionSlug(divisionEntry.id, regionKey)}/`;
  const title = `${REGION_LABELS[regionKey]} Regional -- ${divisionLabel(divisionEntry)}`;
  const hasTeams = region.teams.length > 0;
  const supplementalIndividuals = region.individuals || [];
  // Team roster runners and supplemental individuals are scored together
  // in one shared field (real displacement for both), but a team's own
  // score still comes only from its seven listed runners -- scoreTeams()
  // never adds an individual to any team's roster or score.
  const { teams, individuals: scoredIndividuals } = hasTeams
    ? scoreTeams(region.teams, supplementalIndividuals)
    : { teams: [], individuals: [] };
  const individualQualifiers = hasTeams
    ? selectIndividualQualifiers(teams, scoredIndividuals, region.stateQualifiers, region.individualQualifiers || 0)
    : [];

  const content = `${pageHero({
    eyebrow: "2026 Mock Regionals",
    title,
    description: `Modeled team standings for the ${REGION_LABELS[regionKey]} region, ${divisionLabel(divisionEntry)}, built from each team's real supplied top-7 season-best times.`
  })}
  ${sharedStyles()}
  <section class="section section-paper" aria-labelledby="mr-title">
    <div class="container">
      ${breadcrumb([{ label: "Home", href: "/" }, { label: "Mock Meets", href: "/mock-meets/" }, { label: title }])}

      <div class="mr-explainer">
        <p>This is a modeled regional meet, not a real result -- every runner's real supplied season-best 5K decides the score. The top ${region.stateQualifiers} teams here are highlighted as the real number that would advance to the State mock meet.</p>
        <a class="button button-primary" href="/mock-meets/">All mock meets ${icon("arrow")}</a>
      </div>

      <p class="mr-projection-note">${PROJECTION_NOTE}</p>

      ${crumbsRow(divisionEntry, regionKey)}

      <p class="mr-meta">Regional site: ${escapeHtml(region.siteName)} &middot; Top <strong>${region.stateQualifiers}</strong> team${region.stateQualifiers === 1 ? "" : "s"} advance${region.stateQualifiers === 1 ? "s" : ""} to the State mock meet &middot; Top <strong>${region.individualQualifiers || 0}</strong> individual${(region.individualQualifiers || 0) === 1 ? "" : "s"} from non-advancing teams also advance${(region.individualQualifiers || 0) === 1 ? "s" : ""}.</p>

      <h2 id="mr-title" class="mr-heading">${teams.length} team${teams.length === 1 ? "" : "s"} entered</h2>

      ${teams.length
        ? teamStandingsTable(teams, region.stateQualifiers)
        : emptyState({
            title: "Rosters not entered yet",
            description: `No teams have been added for the ${REGION_LABELS[regionKey]} region, ${divisionLabel(divisionEntry)}. Once real top-7 rosters are supplied for this region's teams, they'll appear here automatically.`,
            actionLabel: "See every region and division",
            actionHref: "/mock-meets/"
          })
      }

      ${teams.length ? `<div class="mr-individuals-section">
        <p class="eyebrow">Individual qualifiers</p>
        <h2>Fastest finishers from teams that did not qualify</h2>
        <p class="mr-meta">OHSAA's real rule: individual qualifiers are only selected from teams that did not qualify as a team, taken in real regional finish order.</p>
        ${individualsTableHtml(individualQualifiers)}
      </div>` : ""}
    </div>
  </section>
  <script src="/scripts/page-view.js" defer></script>`;

  return layout({
    site,
    title,
    description: `Modeled ${REGION_LABELS[regionKey]} regional cross country team standings for ${divisionLabel(divisionEntry)}, built from real supplied runner times.`,
    pathname,
    content
  });
}

export function mockStatePage(site, divisionEntry) {
  const pathname = `/mock-meets/state/${divisionEntry.id}/`;
  const title = `Mock State Meet -- ${divisionLabel(divisionEntry)}`;
  const regionKeys = REGION_ORDER.filter((key) => divisionEntry.regions[key]);
  const missing = regionKeys.filter((key) => divisionEntry.regions[key].teams.length === 0);

  let teams = [];
  let individuals = [];
  let poolLog = [];
  if (missing.length === 0) {
    const pooledTeams = [];
    const pooledIndividuals = [];
    for (const key of regionKeys) {
      const region = divisionEntry.regions[key];
      const { teams: regionScored, individuals: regionScoredIndividuals } = scoreTeams(region.teams, region.individuals || []);
      const qualifyingTeams = regionScored.filter((t) => t.complete).slice(0, region.stateQualifiers);
      const qualifyingIndividuals = selectIndividualQualifiers(regionScored, regionScoredIndividuals, region.stateQualifiers, region.individualQualifiers || 0);

      poolLog.push({ region: REGION_LABELS[key], teamCount: qualifyingTeams.length, teamQualifiers: region.stateQualifiers, individualCount: qualifyingIndividuals.length, individualQualifiers: region.individualQualifiers || 0 });

      for (const team of qualifyingTeams) {
        pooledTeams.push({
          name: team.name,
          region: REGION_LABELS[key],
          runners: team.runners.map(({ scoring, placePoints, teamPosition, ...rest }) => rest)
        });
      }
      pooledIndividuals.push(...qualifyingIndividuals);
    }
    const scored = scoreTeams(pooledTeams, pooledIndividuals);
    teams = scored.teams;
    individuals = scored.individuals;
  }

  const content = `${pageHero({
    eyebrow: "2026 Mock State Meet",
    title,
    description: "The real qualifying teams and individual qualifiers from all of this division's regions, pooled and re-scored together using the same supplied times -- computed automatically once every region is entered."
  })}
  ${sharedStyles()}
  <section class="section section-paper" aria-labelledby="mr-title">
    <div class="container">
      ${breadcrumb([{ label: "Home", href: "/" }, { label: "Mock Meets", href: "/mock-meets/" }, { label: title }])}

      <div class="mr-explainer">
        <p>This State field is not entered by hand -- it's the real number of qualifying teams and qualifying individuals pooled automatically from each region's mock regional, once every region has real rosters. Individual qualifiers are scored together with the teams, so a fast individual really can displace a team's scorers, exactly like a real meet.</p>
        <a class="button button-primary" href="/mock-meets/">All mock meets ${icon("arrow")}</a>
      </div>

      <p class="mr-projection-note">${PROJECTION_NOTE}</p>

      ${crumbsRow(divisionEntry, "state")}

      <h2 id="mr-title" class="mr-heading">${divisionLabel(divisionEntry)}</h2>

      ${missing.length
        ? emptyState({
            title: "Waiting on regional results",
            description: `The State field pools each region's real qualifying teams and individuals automatically, but ${missing.length} region${missing.length === 1 ? "" : "s"} (${missing.map((k) => REGION_LABELS[k]).join(", ")}) still ${missing.length === 1 ? "has" : "have"} no rosters entered yet.`,
            actionLabel: "See every region and division",
            actionHref: "/mock-meets/"
          })
        : `<p class="mr-meta">Pooled from: ${poolLog.map((p) => `${p.region} (${p.teamCount} of ${p.teamQualifiers} team qualifiers, ${p.individualCount} of ${p.individualQualifiers} individual qualifiers)`).join(" &middot; ")}</p>` +
          teamStandingsTable(teams, null, { showRegion: true, highlightMedals: true }) +
          `<div class="mr-individuals-section">
            <p class="eyebrow">Individual qualifiers</p>
            <h2>Qualifying individuals at State</h2>
            <p class="mr-meta">Each shown with the region they qualified from. Their real time still counts toward the overall finish order above -- a fast individual here can push team scorers back a place.</p>
            ${individualsTableHtml(individuals, { showRegion: true })}
          </div>`
      }
    </div>
  </section>
  <script src="/scripts/page-view.js" defer></script>`;

  return layout({
    site,
    title,
    description: `Modeled State cross country team standings for ${divisionLabel(divisionEntry)}, pooled from every region's real qualifying teams and individuals.`,
    pathname,
    content
  });
}

export function mockRegionalsHubPage(site) {
  const pathname = "/mock-meets/";
  const title = "2026 Mock Regionals & State";

  const divisionBlocks = regionalsData.divisions.map((divisionEntry) => {
    const regionKeys = REGION_ORDER.filter((key) => divisionEntry.regions[key]);
    const cards = regionKeys.map((key) => {
      const region = divisionEntry.regions[key];
      const href = `/mock-meets/regionals/${regionSlug(divisionEntry.id, key)}/`;
      const status = region.teams.length
        ? `<span class="mr-status-ready">${region.teams.length} teams entered</span>`
        : `<span class="mr-status-pending">Rosters not yet entered</span>`;
      return `<a class="mr-region-card" href="${href}"><h3>${REGION_LABELS[key]}</h3><p class="mr-meta" style="margin:0 0 8px;">Top ${region.stateQualifiers} teams, top ${region.individualQualifiers || 0} individuals advance</p>${status}</a>`;
    });
    const stateHref = `/mock-meets/state/${divisionEntry.id}/`;
    const stateReady = regionKeys.every((key) => divisionEntry.regions[key].teams.length > 0);
    cards.push(`<a class="mr-region-card" href="${stateHref}" style="border-left:4px solid var(--green);"><h3>State</h3><p class="mr-meta" style="margin:0 0 8px;">Auto-computed from regions</p>${stateReady ? '<span class="mr-status-ready">Ready</span>' : '<span class="mr-status-pending">Waiting on regions</span>'}</a>`);
    return `<div class="mr-division-block"><h2>${divisionLabel(divisionEntry)}</h2><div class="mr-region-grid">${cards.join("")}</div></div>`;
  }).join("");

  const content = `${pageHero({
    eyebrow: "Ohio Cross Country -- Modeled Results",
    title: "2026 Mock Regionals & State",
    description: "Team mock meets built on the real 2026 OHSAA regional structure -- four regions, four divisions, boys and girls -- scored from each team's real supplied top-7 season-best times, plus real individual-qualifier displacement at State."
  })}
  ${sharedStyles()}
  <section class="section section-paper" aria-labelledby="mr-hub-title">
    <div class="container">
      ${breadcrumb([{ label: "Home", href: "/" }, { label: "Mock Meets" }])}

      <div class="mr-explainer">
        <p>These are modeled meets, not real results. The regional groupings and the real team and individual qualifier counts are OHSAA's own real 2026 structure; every score comes from real supplied runner times.</p>
        <a class="button button-outline" href="/rankings/oatccc/">View the real OATCCC poll ${icon("arrow")}</a>
      </div>

      <p class="mr-projection-note">${PROJECTION_NOTE}</p>

      <div class="section-heading">
        <div><p class="eyebrow">Every division</p><h2 id="mr-hub-title">Pick a division to see its regions and State field</h2></div>
      </div>

      ${divisionBlocks}
    </div>
  </section>
  <script src="/scripts/page-view.js" defer></script>`;

  return layout({
    site,
    title,
    description: "2026 mock cross country regionals and State meets for every OHSAA division, boys and girls, built from real supplied team rosters and the real regional qualifying structure.",
    pathname,
    content
  });
}

export function mockRegionalsAllPages(site) {
  const pages = [];
  pages.push({ pathname: "/mock-meets/", html: mockRegionalsHubPage(site) });
  for (const divisionEntry of regionalsData.divisions) {
    const problems = validateDivisionRoster(divisionEntry, Object.entries(divisionEntry.regions));
    if (problems.length) {
      throw new Error(`Mock regionals data validation failed for ${divisionEntry.label}:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    }
    for (const key of REGION_ORDER) {
      if (!divisionEntry.regions[key]) continue;
      pages.push({ pathname: `/mock-meets/regionals/${regionSlug(divisionEntry.id, key)}/`, html: mockRegionalPage(site, divisionEntry, key) });
    }
    pages.push({ pathname: `/mock-meets/state/${divisionEntry.id}/`, html: mockStatePage(site, divisionEntry) });
  }
  return pages;
}
