import { breadcrumb, emptyState, icon, layout, pageHero } from "../lib/html.mjs";
import { scoreTeams, selectIndividualQualifiers } from "../lib/mock_scoring.mjs";
import districtsData from "../data/mock-districts-2026.json" with { type: "json" };

// 2026 Mock Districts -- one projected race per real OHSAA 2026 district
// site (12 sites, 71 races: boys/girls x Divisions II-IV; Division I has
// no districts in 2026 and goes straight to regionals), feeding the
// existing Mock Regionals. Built from dataimports/district_meets_2026.json
// (the real site/race/qualifier-count structure) plus each school's real
// 2026 season-best 5K times already in our own database -- never a model,
// matching the basis the existing Mock Regionals/State pages use. See
// dataimports/build-mock-districts-data.mjs for exactly how
// src/data/mock-districts-2026.json is built (school -> real
// ohio_schools match -> real ohio_school_divisions division -> the one
// race at that site with that gender/division) and MOCK_DISTRICTS_BRIEF.md
// for the original spec.
//
// A school entered at a site is never silently dropped when something
// can't be resolved (ambiguous Hilliard-Darby-style race split, no
// official division on file, no season-best time on file yet) -- each
// race's `missing` list (in the data file) names it and says why, shown
// openly on the page rather than hidden.
//
// Qualifying rule (implemented via the same engine as Mock Regionals,
// src/lib/mock_scoring.mjs -- nothing reimplemented here):
//   1. scoreTeams(): top 5 score, 6th/7th displace, <5 runners = incomplete.
//   2. Top N teams by team score advance -- shown with a cut line after
//      team N and the next 2 teams dimmed (not highlighted, not hidden).
//   3. selectIndividualQualifiers(): the first 2N finishers NOT on a
//      qualifying team, in real finish order (ties at the cutoff included
//      whole).
// Three Northeast sites (GlenOak, Lorain County CC, Madison) have no
// teams_advance/individuals_advance yet (OHSAA posts them Oct 20) --
// those races show every team's projected order with no cut line and no
// individual qualifiers, per the brief.

const GENDER_LABEL = { boys: "Boys", girls: "Girls" };
const DIVISION_LABEL = { 2: "Division II", 3: "Division III", 4: "Division IV" };
const REGION_ORDER = ["Central", "East", "Southeast", "Northeast", "Northwest", "Southwest"];

const PROJECTION_NOTE = `Projected from each school's real 2026 season-best 5K times already in Podium Watch's database -- not a real meet result. A school entered at this site but not shown below is listed under "Entered but not shown" with the real reason (no official division on file, a Race 1/Race 2 split we can't resolve, or no season-best time on file yet). As of ${districtsData.asOf}.`;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatPoints(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function genderAccent(gender) {
  return gender === "girls" ? "#EC4899" : "#0FAF68";
}

function raceSlug(race) {
  const label = race.race_label ? `-${race.race_label.toLowerCase().replace(/\s+/g, "-")}` : "";
  return `${race.gender}-d${race.division}${label}`;
}

function raceTitle(race) {
  return `${GENDER_LABEL[race.gender]} ${DIVISION_LABEL[race.division]}${race.race_label ? ` (${race.race_label})` : ""}`;
}

function sharedStyles() {
  return `<style>
    .md-note { margin: 0 0 24px; padding: 14px 18px; border: 1px dashed var(--line); color: var(--muted); font-size: .86rem; }
    .md-region-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; margin-bottom: 36px; }
    .md-region-block { margin-bottom: 40px; }
    .md-region-block h2 { margin-bottom: 14px; }
    .md-site-card { display: block; padding: 18px 20px; border: 1px solid var(--line); background: var(--white); }
    .md-site-card:hover, .md-site-card:focus-visible { border-color: var(--green); }
    .md-site-card h3 { margin: 0 0 6px; font-size: 1.05rem; }
    .md-site-card p { margin: 0 0 4px; color: var(--muted); font-size: .86rem; }

    .md-race-nav { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 28px; }
    .md-race-nav a { padding: 7px 14px; border: 1px solid var(--line); border-radius: 999px; font-weight: 700; font-size: .82rem; color: var(--ink); background: var(--white); }
    .md-race-nav a[data-md-gender="girls"] { border-color: #EC4899; }
    .md-race-nav a[data-md-gender="boys"] { border-color: var(--green); }

    .md-race-section { margin-bottom: 56px; padding-top: 10px; border-top: 1px solid var(--line); }
    .md-race-header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 10px; margin: 18px 0 6px; }
    .md-race-header h2 { margin: 0; }
    .md-race-meta { color: var(--muted); font-size: .9rem; margin: 0 0 20px; }
    .md-pending-note { margin: 0 0 20px; padding: 12px 16px; border-left: 4px solid var(--muted); background: var(--paper); color: var(--ink); font-size: .9rem; }

    .md-table-wrap { width: 100%; overflow-x: auto; border: 1px solid var(--line); background: var(--white); margin-bottom: 18px; }
    .md-table { width: 100%; border-collapse: collapse; }
    .md-table th, .md-table td { text-align: left; padding: 10px 14px; border-bottom: 1px solid var(--line); vertical-align: top; font-size: .9rem; }
    .md-table th { font-size: .74rem; letter-spacing: .5px; text-transform: uppercase; color: var(--white); background: var(--black); white-space: nowrap; }
    .md-table td.md-num { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .md-table tr.md-advances td { background: #f0faf3; }
    .md-table tr.md-dimmed td { color: var(--muted); background: #fafafa; }
    .md-table tr.md-incomplete td { color: var(--muted); font-style: italic; }
    .md-cutline-row td { padding: 0; border: none; }
    .md-cutline { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
    .md-cutline::before, .md-cutline::after { content: ""; flex: 1; border-top: 2px dashed var(--ink); }
    .md-cutline span { font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif; font-size: .78rem; letter-spacing: .06em; text-transform: uppercase; color: var(--ink); white-space: nowrap; }

    .md-tag { display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: .64rem; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
    .md-tag-team { background: var(--green); color: var(--black); }
    .md-tag-ind { background: #111; color: #fff; }

    .md-missing { margin: 8px 0 0; padding: 12px 16px; border: 1px solid var(--line); background: var(--paper); font-size: .84rem; color: var(--muted); }
    .md-missing summary { cursor: pointer; font-weight: 700; color: var(--ink); }
    .md-missing ul { margin: 10px 0 0; padding-left: 18px; }

    @media (max-width: 700px) {
      .md-table th:nth-child(4), .md-table td:nth-child(4),
      .md-table th:nth-child(5), .md-table td:nth-child(5) { display: none; }
    }
  </style>`;
}

// Combined finish order for the top-32 table: every team runner (scoring
// or displaced -- all have a real place) plus every individual qualifier,
// tagged TEAM when they scored for a race-qualifying team, IND when they
// advance individually, blank otherwise (a non-qualifying team's own
// runner who didn't make the individual cut -- still ran, just doesn't
// advance).
function combinedFinishOrder(scoredTeams, qualifyingTeamNames, individualQualifiers) {
  const individualNames = new Set(individualQualifiers.map((r) => `${r.name}|${r.originalTeam}`));
  const fromTeams = scoredTeams.flatMap((team) =>
    team.runners.map((r) => ({
      name: r.name,
      school: team.name,
      seasonBest: r.seasonBest,
      placePoints: r.placePoints,
      tag: qualifyingTeamNames.has(team.name) ? "TEAM" : (individualNames.has(`${r.name}|${team.name}`) ? "IND" : null)
    }))
  );
  return fromTeams.sort((a, b) => a.placePoints - b.placePoints);
}

function teamStandingsHtml(scoredTeams, teamsAdvance) {
  if (!scoredTeams.length) return "";
  const complete = scoredTeams.filter((t) => t.complete);
  const incomplete = scoredTeams.filter((t) => !t.complete);
  const rows = [];
  complete.forEach((team, index) => {
    const rank = index + 1;
    const advances = teamsAdvance != null && rank <= teamsAdvance;
    const dimmed = teamsAdvance != null && rank > teamsAdvance && rank <= teamsAdvance + 2;
    if (teamsAdvance != null && rank === teamsAdvance + 1) {
      rows.push(`<tr class="md-cutline-row"><td colspan="5"><div class="md-cutline"><span>Regional cut line &middot; top ${teamsAdvance} advance</span></div></td></tr>`);
    }
    rows.push(`<tr class="${advances ? "md-advances" : dimmed ? "md-dimmed" : ""}">` +
      `<td class="md-num">${rank}</td>` +
      `<td>${escapeHtml(team.name)}${advances ? ' <span class="md-tag md-tag-team">Advances</span>' : ""}</td>` +
      `<td class="md-num">${formatPoints(team.score)}</td>` +
      `<td class="md-num">${team.sixthPlace != null ? formatPoints(team.sixthPlace) : "--"}</td>` +
      `<td class="md-num">${team.seventhPlace != null ? formatPoints(team.seventhPlace) : "--"}</td>` +
      `</tr>`);
  });
  incomplete.forEach((team) => {
    rows.push(`<tr class="md-incomplete"><td>--</td><td>${escapeHtml(team.name)} (fewer than 5 runners on file)</td><td>--</td><td>--</td><td>--</td></tr>`);
  });
  return `<div class="md-table-wrap"><table class="md-table">
    <thead><tr><th>Place</th><th>School</th><th>Score</th><th>6th</th><th>7th</th></tr></thead>
    <tbody>${rows.join("")}</tbody>
  </table></div>`;
}

function combinedTableHtml(rows, limit) {
  const shown = limit ? rows.slice(0, limit) : rows;
  const body = shown.map((r) =>
    `<tr><td class="md-num">${formatPoints(r.placePoints)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.school)}</td><td class="md-num">${escapeHtml(r.seasonBest)}</td><td>${r.tag === "TEAM" ? '<span class="md-tag md-tag-team">TEAM</span>' : r.tag === "IND" ? '<span class="md-tag md-tag-ind">IND</span>' : ""}</td></tr>`
  ).join("");
  return `<div class="md-table-wrap"><table class="md-table">
    <thead><tr><th>Place</th><th>Runner</th><th>School</th><th>Season best</th><th></th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

function missingHtml(missing) {
  if (!missing.length) return "";
  const items = missing.map((m) => `<li>${escapeHtml(m.school)} -- ${escapeHtml(m.reason)}</li>`).join("");
  return `<details class="md-missing"><summary>${missing.length} school${missing.length === 1 ? "" : "s"} entered but not shown</summary><ul>${items}</ul></details>`;
}

function raceSectionHtml(race) {
  const accent = genderAccent(race.gender);
  const title = raceTitle(race);
  const pending = race.teams_advance == null;

  if (!race.teams.length) {
    return `<div class="md-race-section" id="${raceSlug(race)}">
      <div class="md-race-header"><h2 style="color:${accent}">${title}</h2><span class="md-race-meta">${escapeHtml(race.start_time)}</span></div>
      ${emptyState({
        title: "Not enough data yet",
        description: `No schools at this site/division/gender currently have a real season-best time, official division, or clean race assignment on file -- nothing to project yet.`,
        actionLabel: "See every site",
        actionHref: "/mock-meets/districts/"
      })}
      ${missingHtml(race.missing)}
    </div>`;
  }

  const { teams: scoredTeams, individuals: scoredIndividuals } = scoreTeams(race.teams, []);
  const individualQualifiers = pending ? [] : selectIndividualQualifiers(scoredTeams, scoredIndividuals, race.teams_advance, race.individuals_advance || 0);
  const qualifyingTeamNames = new Set(pending ? [] : scoredTeams.filter((t) => t.complete).slice(0, race.teams_advance).map((t) => t.name));
  const finishOrder = combinedFinishOrder(scoredTeams, qualifyingTeamNames, individualQualifiers);

  const metaLine = pending
    ? `${escapeHtml(race.start_time)} &middot; <strong>Qualifier numbers announced Oct 20</strong>`
    : `${escapeHtml(race.start_time)} &middot; Top <strong>${race.teams_advance}</strong> team${race.teams_advance === 1 ? "" : "s"} + <strong>${race.individuals_advance}</strong> individuals advance to ${escapeHtml(district_regional_for(race))}`;

  return `<div class="md-race-section" id="${raceSlug(race)}">
    <div class="md-race-header"><h2 style="color:${accent}">${title}</h2></div>
    <p class="md-race-meta">${metaLine}</p>
    ${pending ? `<p class="md-pending-note">OHSAA posts the real team/individual qualifier counts for this site Oct 20 -- shown here as projected order only, no cut line yet.</p>` : ""}
    ${teamStandingsHtml(scoredTeams, pending ? null : race.teams_advance)}
    <h3>Top 32 (combined)</h3>
    ${combinedTableHtml(finishOrder, 32)}
    ${!pending ? `<h3>All ${individualQualifiers.length} individual qualifiers</h3>${combinedTableHtml(individualQualifiers.map((r) => ({ ...r, school: r.originalTeam, tag: "IND" })), null)}` : ""}
    ${missingHtml(race.missing)}
  </div>`;
}

function district_regional_for(race) {
  const site = districtsData.sites.find((s) => s.key === race.site);
  return site ? site.regional : "regionals";
}

export function mockDistrictsSitePage(site, siteKey) {
  const siteEntry = districtsData.sites.find((s) => s.key === siteKey);
  if (!siteEntry) return null;
  const pathname = `/mock-meets/districts/${siteKey.toLowerCase()}/`;
  const title = `${siteEntry.name} District -- Mock Districts`;
  const siteRaces = districtsData.races.filter((r) => r.site === siteKey).sort((a, b) => a.start_time.localeCompare(b.start_time));

  const nav = siteRaces.map((r) => `<a href="#${raceSlug(r)}" data-md-gender="${r.gender}">${raceTitle(r)}</a>`).join("");

  const content = `${pageHero({
    eyebrow: "2026 Mock Districts",
    title,
    description: `Projected results for every race at ${siteEntry.name}, built from each school's real 2026 season-best 5K times. Feeds the ${siteEntry.regional} regional.`
  })}
  ${sharedStyles()}
  <section class="section section-paper" aria-labelledby="md-title">
    <div class="container">
      ${breadcrumb([{ label: "Home", href: "/" }, { label: "Mock Meets", href: "/mock-meets/" }, { label: "Districts", href: "/mock-meets/districts/" }, { label: siteEntry.name }])}
      <h2 id="md-title" class="visually-hidden">${title}</h2>
      <p class="md-note">${PROJECTION_NOTE}</p>
      <nav class="md-race-nav" aria-label="Jump to a race">${nav}</nav>
      ${siteRaces.map(raceSectionHtml).join("")}
    </div>
  </section>
  <script src="/scripts/page-view.js" defer></script>`;

  return layout({
    site,
    title,
    description: `Projected 2026 district cross country results for ${siteEntry.name}, every division and gender.`,
    pathname,
    content
  });
}

export function mockDistrictsHubPage(site) {
  const pathname = "/mock-meets/districts/";
  const title = "2026 Mock Districts";

  const byRegion = new Map();
  for (const s of districtsData.sites) {
    if (!byRegion.has(s.region)) byRegion.set(s.region, []);
    byRegion.get(s.region).push(s);
  }

  const regionBlocks = REGION_ORDER.filter((r) => byRegion.has(r)).map((region) => {
    const cards = byRegion.get(region).map((s) => {
      const races = districtsData.races.filter((r) => r.site === s.key).sort((a, b) => a.start_time.localeCompare(b.start_time));
      const first = races[0];
      return `<a class="md-site-card" href="/mock-meets/districts/${s.key.toLowerCase()}/">
        <h3>${escapeHtml(s.name)}</h3>
        <p>${races.length} race${races.length === 1 ? "" : "s"} &middot; first race ${first ? escapeHtml(first.start_time) : "--"}</p>
        <p>Feeds ${escapeHtml(s.regional)} regional</p>
      </a>`;
    }).join("");
    return `<div class="md-region-block"><h2>${escapeHtml(region)}</h2><div class="md-region-grid">${cards}</div></div>`;
  }).join("");

  const content = `${pageHero({
    eyebrow: "Ohio Cross Country -- Modeled Results",
    title,
    description: `Projected results for every real 2026 OHSAA district cross country race (${districtsData.meetDate}), who would advance to the ${districtsData.regionalDate} regionals. Division I has no districts in 2026.`
  })}
  ${sharedStyles()}
  <section class="section section-paper" aria-labelledby="md-hub-title">
    <div class="container">
      ${breadcrumb([{ label: "Home", href: "/" }, { label: "Mock Meets", href: "/mock-meets/" }, { label: "Districts" }])}
      <h2 id="md-hub-title" class="visually-hidden">Pick a district site</h2>
      <p class="md-note">${PROJECTION_NOTE}</p>
      ${regionBlocks}
    </div>
  </section>
  <script src="/scripts/page-view.js" defer></script>`;

  return layout({
    site,
    title,
    description: "Projected 2026 OHSAA district cross country results, grouped by region, for every site, division, and gender.",
    pathname,
    content
  });
}

export function mockDistrictsAllPages(site) {
  const pages = [{ pathname: "/mock-meets/districts/", html: mockDistrictsHubPage(site) }];
  for (const s of districtsData.sites) {
    const html = mockDistrictsSitePage(site, s.key);
    if (html) pages.push({ pathname: `/mock-meets/districts/${s.key.toLowerCase()}/`, html });
  }
  return pages;
}
