import { breadcrumb, emptyState, icon, layout, pageHero } from "../lib/html.mjs";
import { scoreTeams } from "../lib/mock_scoring.mjs";
import { slugify } from "../lib/content.mjs";
import regionalsData from "../data/mock-regionals-2026.json" with { type: "json" };

// 2026 Mock Regionals & State -- team-only mock meets built on the real
// 2026 OHSAA cross country tournament structure (4 regions x 4 divisions x
// boys/girls, minus Northwest Division I, which doesn't exist -- see
// src/data/mock-regionals-2026.json's own notes and
// src/data/ohsaa-region-assignments-2026.json for exactly how every real
// team was assigned to its real region, sourced directly from OHSAA's own
// official district pages/sheets/PDFs rather than guessed).
//
// Every team's score, mock rank, and sixth/seventh displacement is
// computed at build time by src/lib/mock_scoring.mjs from raw supplied
// times -- nothing here is hand-entered pre-scored. That engine is
// verified (2026-09-21) to reproduce the independently-checked September
// 17 mock meets scores exactly, including the documented Gahanna Lincoln
// / Springboro sixth-runner tiebreak, before ever being wired to a page.
//
// Data entry is the same lightweight, no-database pattern already
// established for src/data/oatccc-coaches-poll.json: a team's roster
// (name + each runner's name/seasonBest/timeCentiseconds) is added
// directly to src/data/mock-regionals-2026.json's `teams` array for its
// region, then a rebuild picks it up -- no admin tool, no import pipeline.
// Pages render a clear "not yet entered" state for any region/division
// that has zero teams, rather than a broken or misleadingly empty table.
//
// The State page for a division/gender is never hand-entered at all --
// once every one of that division's regions has real teams, it pools
// exactly the real qualifying count from each region (stateQualifiers,
// sourced from OHSAA's own Regional-to-State Representation table) and
// re-scores that pooled field fresh with the same engine. Until every
// region is in, it shows which regions are still needed.

const REGION_ORDER = ["central", "northeast", "northwest", "southwest"];
const REGION_LABELS = { central: "Central", northeast: "Northeast", northwest: "Northwest", southwest: "Southwest" };

function divisionLabel(entry) {
  return entry.label;
}

function regionSlug(divisionId, regionKey) {
  return `${regionKey}-${divisionId}`;
}

function sharedStyles() {
  return `<style>
    .mr-explainer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 28px; padding: 22px 26px; border: 1px solid var(--line); border-left: 6px solid var(--green); background: var(--paper); }
    .mr-explainer p { margin: 0; max-width: 62ch; color: var(--ink); }
    .mr-explainer .button { flex-shrink: 0; }
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
    .mr-qualify-badge { display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 999px; background: var(--green); color: var(--black); font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif; font-size: .68rem; letter-spacing: .5px; text-transform: uppercase; }
    .mr-team-toggle { min-height: 34px; padding: 6px 12px; border: 1px solid var(--ink); background: var(--white); color: var(--ink); font-weight: 700; font-size: .82rem; cursor: pointer; }
    .mr-detail-row td { padding: 0 !important; }
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
  </style>`;
}

function rosterTableHtml(team) {
  const rows = team.runners.map((runner) => {
    const role = team.complete
      ? (runner.scoring ? '<span class="mr-role-scored">Scored</span>' : '<span class="mr-role-displaced">Displaced</span>')
      : '<span class="mr-incomplete">Incomplete team</span>';
    return `<tr><td>${runner.teamPosition}</td><td>${escapeHtml(runner.name)}</td><td>${escapeHtml(runner.seasonBest)}</td><td>${team.complete ? formatPoints(runner.placePoints) : "--"}</td><td>${role}</td></tr>`;
  }).join("");
  return `<table class="mr-roster"><thead><tr><th>Pos</th><th>Runner</th><th>Season best</th><th>Points</th><th>Role</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatPoints(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function teamStandingsTable(teams, qualifierCount) {
  if (!teams.length) return "";
  const rows = teams.map((team, index) => {
    const qualifies = team.complete && qualifierCount != null && team.mockRank <= qualifierCount;
    const sixth = team.sixthPlace != null ? formatPoints(team.sixthPlace) : "None";
    const seventh = team.seventhPlace != null ? formatPoints(team.seventhPlace) : "None";
    const firstFive = team.complete
      ? team.runners.filter((r) => r.teamPosition <= 5).map((r) => formatPoints(r.placePoints)).join(", ")
      : "--";
    return (
      `<tr class="${qualifies ? "mr-qualifies" : ""}" data-mr-team-row="${index}">` +
      `<td class="mr-cell-rank" data-label="Place">${team.complete ? team.mockRank : "--"}${qualifies ? '<span class="mr-qualify-badge">Advances</span>' : ""}</td>` +
      `<td class="mr-cell-school" data-label="School">${escapeHtml(team.name)}</td>` +
      `<td class="mr-cell-num" data-label="Score">${team.complete ? formatPoints(team.score) : '<span class="mr-incomplete">Incomplete (fewer than 5)</span>'}</td>` +
      `<td class="mr-cell-num" data-label="First five">${firstFive}</td>` +
      `<td class="mr-cell-num" data-label="Sixth">${sixth}</td>` +
      `<td class="mr-cell-num" data-label="Seventh">${seventh}</td>` +
      `<td data-label=""><button type="button" class="mr-team-toggle" data-mr-toggle="${index}" aria-expanded="false">Roster</button></td>` +
      `</tr>` +
      `<tr class="mr-detail-row" data-mr-detail="${index}" hidden><td colspan="7">${rosterTableHtml(team)}</td></tr>`
    );
  }).join("");

  return `<div class="table-scroll" tabindex="0">
    <table class="mr-table">
      <thead><tr><th>Place</th><th>School</th><th>Score</th><th>First five</th><th>Sixth</th><th>Seventh</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <script>(()=>{
    document.currentScript.previousElementSibling.querySelectorAll('[data-mr-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        const row = document.querySelector('[data-mr-detail="' + button.dataset.mrToggle + '"]');
        if (!row) return;
        const willShow = row.hidden;
        row.hidden = !willShow;
        button.setAttribute('aria-expanded', String(willShow));
      });
    });
  })();</script>`;
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
  const teams = region.teams.length ? scoreTeams(region.teams) : [];

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

      ${crumbsRow(divisionEntry, regionKey)}

      <p class="mr-meta">Regional site: ${escapeHtml(region.siteName)} &middot; Top <strong>${region.stateQualifiers}</strong> team${region.stateQualifiers === 1 ? "" : "s"} advance${region.stateQualifiers === 1 ? "s" : ""} to the State mock meet.</p>

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
  let poolLog = [];
  if (missing.length === 0) {
    const pooled = [];
    for (const key of regionKeys) {
      const region = divisionEntry.regions[key];
      const scored = scoreTeams(region.teams).filter((t) => t.complete).slice(0, region.stateQualifiers);
      poolLog.push({ region: REGION_LABELS[key], count: scored.length, qualifiers: region.stateQualifiers });
      for (const team of scored) {
        pooled.push({ name: `${team.name} (${REGION_LABELS[key]})`, runners: team.runners.map(({ scoring, placePoints, teamPosition, ...rest }) => rest) });
      }
    }
    teams = scoreTeams(pooled);
  }

  const content = `${pageHero({
    eyebrow: "2026 Mock State Meet",
    title,
    description: "The real qualifying teams from all of this division's regions, pooled and re-scored together using the same supplied times -- computed automatically once every region is entered."
  })}
  ${sharedStyles()}
  <section class="section section-paper" aria-labelledby="mr-title">
    <div class="container">
      ${breadcrumb([{ label: "Home", href: "/" }, { label: "Mock Meets", href: "/mock-meets/" }, { label: title }])}

      <div class="mr-explainer">
        <p>This State field is not entered by hand -- it's the real number of qualifying teams pooled automatically from each region's mock regional, once every region has real rosters.</p>
        <a class="button button-primary" href="/mock-meets/">All mock meets ${icon("arrow")}</a>
      </div>

      ${crumbsRow(divisionEntry, "state")}

      <h2 id="mr-title" class="mr-heading">${divisionLabel(divisionEntry)}</h2>

      ${missing.length
        ? emptyState({
            title: "Waiting on regional results",
            description: `The State field pools each region's real qualifying teams automatically, but ${missing.length} region${missing.length === 1 ? "" : "s"} (${missing.map((k) => REGION_LABELS[k]).join(", ")}) still ${missing.length === 1 ? "has" : "have"} no rosters entered yet.`,
            actionLabel: "See every region and division",
            actionHref: "/mock-meets/"
          })
        : `<p class="mr-meta">Pooled from: ${poolLog.map((p) => `${p.region} (top ${p.count} of ${p.qualifiers})`).join(" &middot; ")}</p>` + teamStandingsTable(teams, null)
      }
    </div>
  </section>
  <script src="/scripts/page-view.js" defer></script>`;

  return layout({
    site,
    title,
    description: `Modeled State cross country team standings for ${divisionLabel(divisionEntry)}, pooled from every region's real qualifying teams.`,
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
      return `<a class="mr-region-card" href="${href}"><h3>${REGION_LABELS[key]}</h3><p class="mr-meta" style="margin:0 0 8px;">Top ${region.stateQualifiers} advance</p>${status}</a>`;
    });
    const stateHref = `/mock-meets/state/${divisionEntry.id}/`;
    const stateReady = regionKeys.every((key) => divisionEntry.regions[key].teams.length > 0);
    cards.push(`<a class="mr-region-card" href="${stateHref}" style="border-left:4px solid var(--green);"><h3>State</h3><p class="mr-meta" style="margin:0 0 8px;">Auto-computed from regions</p>${stateReady ? '<span class="mr-status-ready">Ready</span>' : '<span class="mr-status-pending">Waiting on regions</span>'}</a>`);
    return `<div class="mr-division-block"><h2>${divisionLabel(divisionEntry)}</h2><div class="mr-region-grid">${cards.join("")}</div></div>`;
  }).join("");

  const content = `${pageHero({
    eyebrow: "Ohio Cross Country -- Modeled Results",
    title: "2026 Mock Regionals & State",
    description: "Team-only mock meets built on the real 2026 OHSAA regional structure -- four regions, four divisions, boys and girls -- scored from each team's real supplied top-7 season-best times. Individual results are planned as a follow-up."
  })}
  ${sharedStyles()}
  <section class="section section-paper" aria-labelledby="mr-hub-title">
    <div class="container">
      ${breadcrumb([{ label: "Home", href: "/" }, { label: "Mock Meets" }])}

      <div class="mr-explainer">
        <p>These are modeled meets, not real results. The regional groupings and the number of teams that advance to State are OHSAA's own real 2026 structure; every team's score comes from its real supplied runner times.</p>
        <a class="button button-outline" href="/rankings/oatccc/">View the real OATCCC poll ${icon("arrow")}</a>
      </div>

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
    for (const key of REGION_ORDER) {
      if (!divisionEntry.regions[key]) continue;
      pages.push({ pathname: `/mock-meets/regionals/${regionSlug(divisionEntry.id, key)}/`, html: mockRegionalPage(site, divisionEntry, key) });
    }
    pages.push({ pathname: `/mock-meets/state/${divisionEntry.id}/`, html: mockStatePage(site, divisionEntry) });
  }
  return pages;
}
