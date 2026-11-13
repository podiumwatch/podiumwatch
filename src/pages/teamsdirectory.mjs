// /teams/ (site redesign step 2, 2026-11-13): "Find your team".
// Rendered on the server (api/pages/teams.js) from every published team.
// Big search box, Division and Region chips (real URLs, so a filtered view
// can be shared), a sticky A to Z bar, the current state champions, then
// rows (logo, name, city and region, division tag, school-color edge).
// The first rows are in the HTML; "Load more teams" shows the rest of the
// filtered list from data already in the page (public/scripts/
// teams-directory.js). Search and filters always cover every team.
import { layout } from "../lib/html.mjs";
import { escapeHtml } from "../lib/content.mjs";
import { schoolBaseName } from "../lib/display_names.mjs";
import { pageBand, filterChips, logoTile } from "../lib/components.mjs";

export const TEAMS_FIRST_LOAD = 28;
const DIVISIONS = ["I", "II", "III", "IV"];
const DIVISION_SHORT = { "Division I": "D1", "Division II": "D2", "Division III": "D3", "Division IV": "D4" };
const e = escapeHtml;

export function cleanTeamFilters(query = {}) {
  const search = String(query.search ?? query.q ?? "").replace(/[%_,()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const division = /^[1-4]$/.test(String(query.d ?? "")) ? String(query.d) : "";
  const region = String(query.region ?? "").trim().slice(0, 40);
  return { search, division, region };
}

// Same fields as /api/teams/ searches: school name, city, mascot,
// conference, region (case-insensitive, anywhere in the text).
export function filterTeams(teams, { search = "", division = "", region = "" } = {}) {
  const needle = search.toLowerCase();
  const wanted = division ? `Division ${DIVISIONS[Number(division) - 1]}` : "";
  return teams.filter((team) => {
    if (needle && ![team.school_name, team.city, team.mascot, team.conference, team.region].some((v) => String(v || "").toLowerCase().includes(needle))) return false;
    if (wanted && team.cross_country_boys_division !== wanted && team.cross_country_girls_division !== wanted) return false;
    if (region && String(team.region || "").toLowerCase() !== region.toLowerCase()) return false;
    return true;
  });
}

// "Boys D3 · Girls D4" when they differ, "D3" when both are the same,
// "Boys D3" / "Girls D3" when only one is known, "" when neither.
export function divisionTag(team) {
  const boys = DIVISION_SHORT[team.cross_country_boys_division] || "";
  const girls = DIVISION_SHORT[team.cross_country_girls_division] || "";
  if (boys && girls) return boys === girls ? boys : `Boys ${boys} · Girls ${girls}`;
  if (boys) return `Boys ${boys}`;
  if (girls) return `Girls ${girls}`;
  return "";
}

export const teamLetter = (name) => {
  const c = schoolBaseName(name).trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
};

// Compact row data (also what the page script renders "Load more" from).
export function teamRowData(team, colorOf) {
  return {
    n: schoolBaseName(team.school_name),
    s: team.slug,
    p: [team.city, team.region].filter(Boolean).join(" · "),
    l: team.logo_url || null,
    c: colorOf(team) || null,
    t: divisionTag(team)
  };
}

export function teamRowHtml(row) {
  return `<a class="pw-team-row" href="/teams/${e(row.s)}/"${row.c ? ` style="--pw-edge:${e(row.c)}"` : ""}>${logoTile({ src: row.l, name: row.n, size: "sm" })}<span class="pw-team-main"><b>${e(row.n)}</b>${row.p ? `<span>${e(row.p)}</span>` : ""}</span>${row.t ? `<span class="pw-pill">${e(row.t)}</span>` : ""}<span class="pw-chev" aria-hidden="true">&rsaquo;</span></a>`;
}

function groupsHtml(rows) {
  let html = "";
  let letter = null;
  for (const row of rows) {
    const l = teamLetter(row.n);
    if (l !== letter) {
      if (letter !== null) html += "</div></section>";
      letter = l;
      html += `<section class="pw-letter" id="letter-${e(l)}" data-letter="${e(l)}"><h2>${e(l)}</h2><div class="pw-team-grid">`;
    }
    html += teamRowHtml(row);
  }
  if (letter !== null) html += "</div></section>";
  return html;
}

const champSlug = (href) => (String(href || "").match(/slug=([a-z0-9-]+)/) || [])[1] || null;

export function teamsDirectoryPage(site, { teams = [], filters = {}, champions = null, colorOf = () => null, unavailable = false } = {}) {
  const f = { search: "", division: "", region: "", ...filters };
  const matching = filterTeams(teams, f);
  const rows = matching.map((team) => teamRowData(team, colorOf));
  const firstRows = rows.slice(0, TEAMS_FIRST_LOAD);
  const restRows = rows.slice(TEAMS_FIRST_LOAD);
  const lettersWith = new Set(rows.map((r) => teamLetter(r.n)));
  const regions = [...new Set(teams.map((t) => t.region).filter(Boolean))].sort();

  const link = (changes) => {
    const q = new URLSearchParams();
    const next = { ...f, ...changes };
    if (next.search) q.set("search", next.search);
    if (next.division) q.set("d", next.division);
    if (next.region) q.set("region", next.region);
    const qs = q.toString();
    return `/teams/${qs ? `?${qs}` : ""}`;
  };

  const searchBox = `<form class="pw-bigsearch" action="/teams/" method="get" role="search">
      <label class="visually-hidden" for="teams-search">Search teams</label>
      <input id="teams-search" type="search" name="search" value="${e(f.search)}" placeholder="School, city or conference" autocomplete="off">
      ${f.division ? `<input type="hidden" name="d" value="${e(f.division)}">` : ""}${f.region ? `<input type="hidden" name="region" value="${e(f.region)}">` : ""}
      <button type="submit">Search</button>
    </form>`;

  const band = pageBand({
    crumbs: [{ label: "Home", href: "/" }, { label: "Teams" }],
    title: "Find your team",
    context: "Ohio high school cross country and track programs on Podium Watch.",
    extra: searchBox
  });

  const chips = filterChips([
    { label: "Division", options: [{ label: "All", href: link({ division: "" }), active: !f.division }, ...DIVISIONS.map((_, i) => ({ label: `D${i + 1}`, href: link({ division: String(i + 1) }), active: f.division === String(i + 1) }))] },
    { label: "Region", options: [{ label: "All", href: link({ region: "" }), active: !f.region }, ...regions.map((r) => ({ label: r, href: link({ region: r }), active: f.region.toLowerCase() === r.toLowerCase() }))] }
  ], { label: "Filter teams" });

  const az = `<nav class="pw-az" aria-label="Jump to a letter" data-pw-az><div class="container pw-az-inner">${"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => lettersWith.has(l) ? `<a href="#letter-${l}" data-az="${l}">${l}</a>` : `<span aria-hidden="true">${l}</span>`).join("")}</div></nav>`;

  const champs = (champions?.races || []).filter((race) => race.team?.school);
  const champsRow = champs.length ? `<div class="pw-champs"><span class="pw-chip-label">${e(champions.year)} state champions</span><div class="pw-champs-list">${champs.map((race) => {
    const slug = champSlug(race.team.href);
    const label = `${race.team.school}`;
    const title = `${race.gender === "girls" ? "Girls" : "Boys"} Division ${DIVISIONS[race.division - 1] || race.division}`;
    return slug ? `<a class="pw-champ${race.gender === "girls" ? " pw-girls" : " pw-boys"}" href="/teams/${e(slug)}/" title="${e(title)}">${e(label)}<span class="visually-hidden"> (${e(title)})</span></a>` : `<span class="pw-champ${race.gender === "girls" ? " pw-girls" : " pw-boys"}" title="${e(title)}">${e(label)}<span class="visually-hidden"> (${e(title)})</span></span>`;
  }).join("")}</div></div>` : "";

  const range = (list) => {
    if (!list.length) return "";
    const a = teamLetter(list[0].n), b = teamLetter(list[list.length - 1].n);
    return a === b ? `Showing ${a}` : `Showing ${a} to ${b}`;
  };

  const filtered = f.search || f.division || f.region;
  const results = rows.length
    ? `<div data-teams-list>${groupsHtml(firstRows)}</div>
       <div class="pw-teams-foot"><span data-teams-shown>${firstRows.length} of ${rows.length} shown</span>${restRows.length ? `<button class="pw-loadmore" type="button" data-teams-more>Load more teams</button>` : ""}</div>
       ${restRows.length ? `<script type="application/json" data-teams-rest>${JSON.stringify(restRows).replace(/</g, "\\u003c")}</script>` : ""}`
    : unavailable ? `<div class="pw-empty"><p><b>The team list could not load right now.</b> Try again in a minute.</p></div>`
    : `<div class="pw-empty"><p><b>No teams match ${f.search ? `"${e(f.search)}"` : "these filters"}.</b></p><a href="/teams/">Show all teams</a></div>`;

  const content = `${band}${chips}${az}
<div class="container pw-teams">
  <div class="pw-teams-head"><h2><span data-teams-count>${rows.length}</span> ${rows.length === 1 ? "team" : "teams"}</h2><span class="pw-teams-range" data-teams-range>${e(range(firstRows))}</span></div>
  ${filtered ? "" : champsRow}
  ${results}
  <aside class="pw-claim">
    <div><b>Coaches: is this your program?</b><p>Claim your team page to add your schedule, roster and social links.</p></div>
    <div class="pw-claim-actions"><a class="pw-claim-btn" href="/claim-your-team/">Claim your team</a><a class="pw-claim-link" href="/team-login/">Team account sign in</a></div>
  </aside>
</div>
<script src="/scripts/teams-directory.js" defer></script>`;

  return layout({
    site,
    title: f.search ? `Teams matching "${f.search}"` : "Find your team",
    description: "Find any Ohio high school cross country and track program on Podium Watch: search by school, city or conference, or browse by division and region.",
    pathname: "/teams/",
    canonicalUrl: filtered ? `${site.siteUrl}/teams/` : undefined,
    content
  });
}
