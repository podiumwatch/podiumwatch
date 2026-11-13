import { escapeHtml } from "../lib/content.mjs";
import { layout } from "../lib/html.mjs";
import { HUB_STAGES, HUB_YEARS, hubPath } from "../config/season_hubs.mjs";
import { smallLogoHtml } from "../lib/team_logo_html.mjs";
import { pageBand, podiumCards, panel } from "../lib/components.mjs";
import { sponsorSlotHtml } from "../../lib/site_sponsors.mjs";

// Season results pages (site redesign step 5, 2026-11-13; first built for
// WO-37): /state/{year}/, /regionals/{year}/, /districts/{year}/, rendered
// on the server by api/pages/season-hub.js. One division on screen at a
// time; each division has its own address (/state/2026/boys-d1/) and the
// first one is also the page's main address. Official results only,
// exactly as imported; the page never computes a place, time or score.

const e = escapeHtml;
const ROMAN = { 1: "I", 2: "II", 3: "III", 4: "IV" };
const ordinal = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return "";
  const t = n % 100;
  return `${n}${t >= 11 && t <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[n % 10] || "th"}`;
};
const genderLabel = (g) => (g === "girls" ? "Girls" : "Boys");
const siteName = (meet) => String(meet?.name || "").replace(/^OHSAA Cross Country (District|Regional) - /, "");
const longDate = (iso) => { const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }); };
const link = (href, text) => (href ? `<a href="${e(href)}">${e(text)}</a>` : e(text));
const school = (href, text, logo) => `${smallLogoHtml(logo)}${link(href, text)}`;
export const divisionKey = (gender, division) => `${gender}-d${division}`;
const STAGE_BUTTON = { districts: "Districts", regionals: "Regionals", state: "State" };

// The divisions with results, girls first then boys, D1 to D4.
export function hubDivisions(races) {
  const keys = new Set(races.map((race) => divisionKey(race.gender, race.division)));
  return ["girls", "boys"].flatMap((g) => [1, 2, 3, 4].map((d) => divisionKey(g, d))).filter((k) => keys.has(k));
}

// All-Ohio place ranges from the data (the honor labels the official
// import stored), e.g. "first team: places 1 to 20".
export function allOhioLine(runners) {
  const range = (re) => {
    const places = runners.filter((r) => re.test(r.honor_label || "")).map((r) => Number(r.place)).filter(Number.isFinite);
    return places.length ? { from: Math.min(...places), to: Math.max(...places) } : null;
  };
  const first = range(/first team/i);
  const second = range(/second team/i);
  const parts = [first ? `first team: places ${first.from} to ${first.to}` : "", second ? `second team: places ${second.from} to ${second.to}` : ""].filter(Boolean);
  return parts.length ? `All-Ohio ${parts.join(" · ")}` : "";
}

// fullResults false (regionals, districts): the top 10 only, as before;
// the official full results are linked for each site.
function runnerRows(runners, id, { fullResults = true, total = runners.length } = {}) {
  const shown = fullResults ? runners : runners.slice(0, 10);
  if (!fullResults) return `<table class="pw-table" id="${e(id)}"><thead><tr><th scope="col" class="pw-col-rank"></th><th scope="col" class="pw-col-name">Athlete</th><th scope="col" class="pw-col-time">Time</th></tr></thead><tbody>${shown.map((r) => `<tr><td class="pw-col-rank">${e(r.place)}</td><td class="pw-col-name"><b>${link(r.href, r.name)}</b><span class="pw-sub">${school(r.team_href, r.school, r.logo)}${r.grade ? ` · Grade ${e(r.grade)}` : ""}</span></td><td class="pw-col-time">${e(r.mark_text || "")}</td></tr>`).join("")}</tbody></table>${total > 10 ? `<p class="pw-note">Top 10 of ${total} finishers. Full results are linked above.</p>` : ""}`;
  return `<table class="pw-table" id="${e(id)}"><thead><tr><th scope="col" class="pw-col-rank"></th><th scope="col" class="pw-col-name">Athlete</th><th scope="col" class="pw-col-time">Time</th></tr></thead><tbody>${runners.map((r, i) => `<tr${i >= 10 ? " hidden data-pw-more-row" : ""}><td class="pw-col-rank">${e(r.place)}</td><td class="pw-col-name"><b>${link(r.href, r.name)}</b><span class="pw-sub">${school(r.team_href, r.school, r.logo)}${r.grade ? ` · Grade ${e(r.grade)}` : ""}</span></td><td class="pw-col-time">${e(r.mark_text || "")}</td></tr>`).join("")}</tbody></table>${runners.length > 10 ? `<button class="pw-more" type="button" data-pw-more aria-controls="${e(id)}" aria-expanded="false">Show all ${runners.length} finishers</button>` : ""}`;
}

function teamRows(teams, id) {
  return `<table class="pw-table" id="${e(id)}"><thead><tr><th scope="col" class="pw-col-rank"></th><th scope="col" class="pw-col-name">Team</th><th scope="col" class="pw-col-time">Points</th></tr></thead><tbody>${teams.map((t, i) => `<tr${i >= 8 ? " hidden data-pw-more-row" : ""}><td class="pw-col-rank">${e(ordinal(t.place_numeric) ? t.place_numeric : t.place_text || "")}</td><td class="pw-col-name"><b>${school(t.href, t.school, t.logo)}</b></td><td class="pw-col-time">${e(t.score ?? "")}</td></tr>`).join("")}</tbody></table>${teams.length > 8 ? `<button class="pw-more" type="button" data-pw-more aria-controls="${e(id)}" aria-expanded="false">Show all ${teams.length} teams</button>` : ""}`;
}

// One race: team podium, then individuals beside team scores.
function raceBlock(race, { idBase, title = null, fullResults = true, siteRace = false }) {
  const champion = race.runners[0];
  const line = allOhioLine(race.runners);
  const podium = race.teams.length ? podiumCards(race.teams.slice(0, 3).map((t, i) => ({ label: i === 0 ? "Team champion" : ordinal(t.place_numeric), name: t.school, href: t.href, sub: t.score != null ? `${t.score} points` : "" })), { gender: race.gender }) : "";
  const individuals = race.runners.length ? panel({
    title: "Individuals",
    sub: champion ? `Champion: ${champion.name}, ${champion.school}, ${champion.mark_text}` : "",
    body: `${line ? `<p class="pw-allohio">${e(line)}</p>` : ""}${runnerRows(race.runners, `${idBase}-runners`, { fullResults })}`
  }) : "";
  const teams = race.teams.length ? panel({ title: "Team scores", sub: "Low score wins", body: teamRows(race.teams, `${idBase}-teams`) }) : "";
  return `<section class="pw-race${race.gender === "girls" ? " pw-girls" : " pw-boys"}" id="${e(idBase)}">
  ${title || siteRace ? `<div class="pw-race-head"><h3>${e(title || "")}</h3><span>${race.runners.length} finishers · ${race.teams.length} teams</span></div>` : ""}
  ${podium}
  <div class="pw-race-grid"><div>${individuals}</div><div>${teams}</div></div>
</section>`;
}

function sourceLine(stage, meets) {
  const links = meets.filter((m) => m.results_url || m.athleticnet_url);
  const official = links.length === 1
    ? `<a href="${e(links[0].results_url || links[0].athleticnet_url)}" target="_blank" rel="noopener noreferrer">official results on Athletic.net</a>`
    : "official results on Athletic.net (linked for each site)";
  return `<p class="pw-source">Source: ${official}.${stage.timingCredit ? ` ${e(stage.timingCredit)}.` : ""} Places, times and team scores appear exactly as posted. Missing or wrong? <a href="/submit-results/">Send a correction</a>.</p>`;
}

function stateExtras(hub) {
  const { fastest, stories, photos } = hub;
  const fastestList = (rows) => `<ol class="pw-fast">${rows.map((r, i) => `<li><span class="pw-fast-n">${i + 1}</span><span><b>${link(r.href, r.name)}</b><span class="pw-sub">${school(r.team_href, r.school, r.logo)} · ${e(`${genderLabel(r.race.gender)} D${r.race.division}`)}</span></span><span class="pw-fast-t">${e(r.mark_text)}</span></li>`).join("")}</ol>`;
  const recaps = stories.filter((s) => s.kind === "recap");
  const previews = stories.filter((s) => s.kind === "preview");
  const storyList = (list) => `<ul class="pw-mates">${list.map((s) => `<li><a href="/stories/${e(s.slug)}/"><b>${e(s.title)}</b></a></li>`).join("")}</ul>`;
  const parts = [];
  if (fastest && (fastest.girls.length || fastest.boys.length)) parts.push(panel({ title: "Fastest times of the day", sub: "Across all four divisions, same course, same day.", id: "fastest", body: `<div class="pw-race-grid pw-pad"><div><h4 class="pw-mini">Girls</h4>${fastestList(fastest.girls)}</div><div><h4 class="pw-mini">Boys</h4>${fastestList(fastest.boys)}</div></div>` }));
  if (stories.length) parts.push(panel({ title: "Stories", id: "stories", body: `${recaps.length ? storyList(recaps) : ""}${previews.length ? `<p class="pw-note">Before the meet: previews written before the race. Their picks were projections, not results.</p>${storyList(previews)}` : ""}` }));
  if (photos.length) parts.push(panel({ title: "Photos", body: `<div class="pw-photos">${photos.map((p) => `<figure><img src="${e(p.url)}" alt="${e(p.meet || "Meet photo")}" loading="lazy"><figcaption>Photo: ${e(p.credit)}</figcaption></figure>`).join("")}</div>` }));
  return parts.length ? `<div class="pw-extras">${parts.join("")}</div>` : "";
}

export function seasonHubPage(site, hub, { division: requested = null } = {}) {
  const { stage, year, stageKey, meets, races } = hub;
  const basePath = hubPath(stageKey, year);
  const isState = stageKey === "state";
  const divisions = hubDivisions(races);
  const division = divisions.includes(requested) ? requested : divisions[0] || null;
  const isMain = division === divisions[0];
  const pathname = basePath;
  const divisionHref = (k) => (k === divisions[0] ? basePath : `${basePath}${k}/`);
  const [gender, dnum] = division ? [division.split("-")[0], Number(division.split("-d")[1])] : ["", 0];
  const divisionTitle = division ? `${genderLabel(gender)} Division ${ROMAN[dnum]}` : "";
  const first = meets[0];

  const stagesWithYear = Object.keys(HUB_STAGES).filter((key) => (HUB_YEARS[key] || []).includes(year));
  const stageButtons = `<nav class="pw-stagebtns" aria-label="Postseason round">${["districts", "regionals", "state"].filter((k) => stagesWithYear.includes(k)).map((key) => `<a href="${hubPath(key, year)}"${key === stageKey ? ' aria-current="page"' : ""}>${STAGE_BUTTON[key]}</a>`).join("")}</nav>`;
  const credit = sponsorSlotHtml(basePath);
  const context = isState
    ? [longDate(first.meet_date), first.venue_name].filter(Boolean).join(" · ")
    : `${longDate(first.meet_date)} · ${meets.length} sites`;
  const band = pageBand({
    crumbs: [{ label: "Home", href: "/" }, { label: "Results", href: "/meets/?view=results" }, { label: stage.heading(year) }],
    title: stage.heading(year),
    context,
    credit: credit ? `<div class="pw-band-credit">${credit}</div>` : "",
    extra: stageButtons,
    tabs: divisions.map((k) => ({ label: `${genderLabel(k.split("-")[0])} D${k.split("-d")[1]}`, href: divisionHref(k), active: k === division, gender: k.split("-")[0] })),
    tabsLabel: "Divisions"
  });

  const divisionRaces = races.filter((race) => divisionKey(race.gender, race.division) === division);
  let body = "";
  if (isState) {
    const race = divisionRaces[0];
    body = race ? `<div class="pw-race-top"><h2>${e(divisionTitle)}</h2><span>${race.runners.length} finishers · ${race.teams.length} teams</span></div>${raceBlock(race, { idBase: division })}` : "";
  } else {
    const bySite = new Map();
    for (const race of divisionRaces) { const k = race.meet.id; if (!bySite.has(k)) bySite.set(k, []); bySite.get(k).push(race); }
    const sites = [...bySite.values()].sort((a, b) => siteName(a[0].meet).localeCompare(siteName(b[0].meet)));
    const siteId = (meet) => meet.slug.replace(/^\d{4}-ohsaa-(district|regional)-/, "");
    body = `<div class="pw-race-top"><h2>${e(divisionTitle)}</h2><span>${sites.length} site${sites.length === 1 ? "" : "s"}</span></div>
    ${sites.length > 1 ? `<nav class="pw-sitejump" aria-label="Jump to a site">${sites.map((list) => `<a href="#${e(siteId(list[0].meet))}">${e(siteName(list[0].meet))}</a>`).join("")}</nav>` : ""}
    ${sites.map((list) => {
      const meet = list[0].meet;
      const official = meet.results_url || meet.athleticnet_url;
      const multi = list.length > 1;
      return `<section class="pw-site" id="${e(siteId(meet))}"><div class="pw-site-head"><h2>${e(siteName(meet))}</h2><p>${e(longDate(meet.meet_date))}${meet.venue_name ? ` · ${e(meet.venue_name)}` : ""}${official ? ` · <a href="${e(official)}" target="_blank" rel="noopener noreferrer">Official full results</a>` : ""}</p></div>
      ${list.sort((a, b) => (a.session || 0) - (b.session || 0)).map((race) => raceBlock(race, { idBase: `${siteId(meet)}-${division}${race.session ? `-s${race.session}` : ""}`, title: multi && race.session ? `Race ${race.session}` : null, fullResults: stage.fullResults, siteRace: true })).join("")}</section>`;
    }).join("")}`;
  }

  const content = `${band}<div class="container pw-hub">${body}${sourceLine(stage, meets)}${isState ? stateExtras(hub) : ""}</div>
<script>
// Old links like /state/2026/#boys-d1 land on that division's own page.
(function(){var m=location.hash.match(/^#((?:girls|boys)-d[1-4])$/);if(!m)return;var t=${JSON.stringify(Object.fromEntries(divisions.map((k) => [k, divisionHref(k)])))}[m[1]];if(t&&t!==location.pathname)location.replace(t);})();
</script>`;

  const description = isState
    ? `Official ${divisionTitle} results from the ${year} Ohio high school cross country state meet: team podium, every finisher, team scores and All-Ohio.`
    : `Official ${divisionTitle} results from the ${year} Ohio high school cross country ${stage.level === "regional" ? "regionals" : "districts"}: every site's finishers and team scores.`;
  const jsonLd = isState ? [{
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: stage.heading(year),
    sport: "Cross country running",
    startDate: first.meet_date,
    eventStatus: "https://schema.org/EventScheduled",
    location: { "@type": "Place", name: first.venue_name || first.city || "Ohio", address: { "@type": "PostalAddress", addressLocality: first.city || undefined, addressRegion: "OH", addressCountry: "US" } },
    url: `${site.siteUrl}${basePath}`
  }] : [];

  return layout({
    site,
    title: isMain ? stage.title(year) : `${divisionTitle} | ${stage.title(year)}`,
    description,
    pathname,
    canonicalUrl: isMain ? undefined : `${site.siteUrl}${divisionHref(division)}`,
    content,
    jsonLd
  });
}
