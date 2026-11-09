import { escapeHtml } from "../lib/content.mjs";
import { breadcrumb, layout, pageHero } from "../lib/html.mjs";
import { HUB_STAGES, HUB_YEARS, hubPath } from "../config/season_hubs.mjs";

// Season results hubs (WO-37): /state/{year}/, /regionals/{year}/,
// /districts/{year}/, rendered on the server by api/pages/season-hub.js
// with every result in the HTML. Official results only, exactly as
// imported; the page never computes a place, time or score.

const styles = `
  .sh-shell { display:grid; gap:26px; }
  .sh-shell > * { min-width:0; }
  .sh-tabs, .sh-jump { display:flex; flex-wrap:wrap; gap:8px; }
  .sh-tabs a, .sh-jump a { padding:7px 13px; border:1px solid var(--line); border-radius:999px; background:var(--white); font-weight:800; font-size:.88rem; text-decoration:none; color:inherit; }
  .sh-tabs a[aria-current="page"] { background:var(--green); color:var(--white); border-color:var(--green); }
  .sh-source { margin:0; color:var(--muted); font-weight:650; font-size:.9rem; }
  .sh-champs { display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:12px; }
  .sh-champ { display:grid; gap:8px; padding:14px 16px; border:1px solid var(--line); border-top:5px solid var(--green); background:var(--white); }
  .sh-champ.is-girls { border-top-color:#EC4899; }
  .sh-champ h3 { margin:0; font-size:1rem; letter-spacing:.04em; text-transform:uppercase; }
  .sh-champ p { margin:0; }
  .sh-label { display:block; color:var(--muted); font-size:.74rem; font-weight:850; letter-spacing:.06em; text-transform:uppercase; }
  .sh-num { font-variant-numeric:tabular-nums; font-weight:850; white-space:nowrap; }
  .sh-race { display:grid; gap:14px; padding:18px; border:1px solid var(--line); background:var(--white); scroll-margin-top:90px; }
  .sh-race > *, .sh-site > *, .sh-cols > *, details.sh-more { min-width:0; }
  .sh-race h2, .sh-race h3 { margin:0; }
  .sh-race-head { display:flex; flex-wrap:wrap; justify-content:space-between; gap:6px 14px; align-items:baseline; }
  .sh-podium { display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:8px; margin:0; padding:0; list-style:none; }
  .sh-podium li { padding:10px 12px; border:1px solid var(--line); }
  .sh-podium b { display:block; font-size:1.05rem; }
  .sh-cols { display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:14px; }
  .sh-list { margin:0; padding:0; list-style:none; display:grid; gap:4px; }
  .sh-list li { display:grid; grid-template-columns:2.6em 1fr auto; gap:8px; align-items:baseline; }
  .sh-list li small { grid-column:2 / 3; color:var(--muted); font-weight:650; }
  .sh-table-wrap { overflow-x:auto; }
  .sh-table { width:100%; min-width:290px; border-collapse:collapse; font-size:.9rem; }
  .sh-sub { display:block; color:var(--muted); font-weight:650; font-size:.8rem; }
  .sh-sub a { color:inherit; }
  .sh-table th, .sh-table td { padding:6px 8px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
  .sh-table th { font-size:.7rem; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); white-space:nowrap; }
  .sh-table td:first-child, .sh-table th:first-child { width:3em; }
  details.sh-more summary { cursor:pointer; font-weight:850; padding:6px 0; }
  .sh-note { color:var(--muted); font-size:.86rem; font-weight:600; margin:0; }
  .sh-site { display:grid; gap:14px; }
  .sh-site > h2 { margin:0; }
  .sh-photos { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:10px; }
  .sh-photos figure { margin:0; }
  .sh-photos img { width:100%; aspect-ratio:4 / 3; object-fit:cover; display:block; }
  .sh-photos figcaption { color:var(--muted); font-size:.8rem; font-weight:650; padding-top:4px; }
`;

const ordinal = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return "";
  const t = n % 100;
  return `${n}${t >= 11 && t <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[n % 10] || "th"}`;
};
const genderLabel = (g) => (g === "girls" ? "Girls" : "Boys");
const raceId = (race) => `${race.gender}-d${race.division}${race.session ? `-s${race.session}` : ""}${race.meet?.slug ? `-${race.meet.slug.replace(/^\d{4}-ohsaa-(district|regional)-/, "")}` : ""}`;
const stateRaceId = (race) => `${race.gender}-d${race.division}`;
const siteName = (meet) => String(meet?.name || "").replace(/^OHSAA Cross Country (District|Regional) - /, "");
const shortDate = (iso) => { const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }); };
const link = (href, text) => (href ? `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>` : escapeHtml(text));
const raceTitle = (race, sessionsInRace = false) => `${genderLabel(race.gender)} ${race.divisionLabel}${sessionsInRace && race.session ? `, race ${race.session}` : ""}`;

function runnerTable(runners, { caption } = {}) {
  return `<div class="sh-table-wrap"><table class="sh-table">${caption ? `<caption class="visually-hidden">${escapeHtml(caption)}</caption>` : ""}<thead><tr><th>Place</th><th>Athlete</th><th>Gr.</th><th>Time</th></tr></thead><tbody>${runners.map((r) => `<tr><td class="sh-num">${escapeHtml(ordinal(r.place))}</td><td>${link(r.href, r.name)}<small class="sh-sub">${link(r.team_href, r.school)}${r.honor_label ? ` &middot; ${escapeHtml(r.honor_label.replace(/^All-Ohio /, "All-Ohio "))}` : ""}</small></td><td>${r.grade ? escapeHtml(r.grade) : ""}</td><td class="sh-num">${escapeHtml(r.mark_text || "")}</td></tr>`).join("")}</tbody></table></div>`;
}
function teamList(teams) {
  return `<ol class="sh-list">${teams.map((t) => `<li><span class="sh-num">${escapeHtml(ordinal(t.place_numeric) || t.place_text || "")}</span><span>${link(t.href, t.school)}</span><span class="sh-num">${t.score ?? ""}</span></li>`).join("")}</ol>`;
}
function sourceLine(stage, meets) {
  const links = meets.filter((m) => m.results_url || m.athleticnet_url);
  const official = links.length === 1
    ? `<a href="${escapeHtml(links[0].results_url || links[0].athleticnet_url)}" target="_blank" rel="noopener noreferrer">official results on Athletic.net</a>`
    : "official results on Athletic.net (linked for each site below)";
  return `<p class="sh-source">Source: ${official}.${stage.timingCredit ? ` ${escapeHtml(stage.timingCredit)}.` : ""} Places, times and team scores appear exactly as posted. Missing or wrong? <a href="/submit-results/">Send a correction</a>.</p>`;
}

function stateBody(hub) {
  const { races, fastest, stories, photos } = hub;
  const order = [...races].sort((a, b) => (a.gender === b.gender ? a.division - b.division : a.gender === "girls" ? -1 : 1));
  const champs = order.map((race) => {
    const ind = race.runners[0];
    const team = race.teams[0];
    return `<article class="sh-champ${race.gender === "girls" ? " is-girls" : ""}"><h3><a href="#${stateRaceId(race)}">${escapeHtml(raceTitle(race))}</a></h3>
      ${ind ? `<p><span class="sh-label">Individual champion</span>${link(ind.href, ind.name)}, ${escapeHtml(ind.school)} <span class="sh-num">${escapeHtml(ind.mark_text)}</span></p>` : ""}
      ${team ? `<p><span class="sh-label">Team champion</span>${link(team.href, team.school)} <span class="sh-num">${team.score} points</span></p>` : ""}
    </article>`;
  }).join("");
  const raceSections = order.map((race) => {
    const firstTeam = race.runners.filter((r) => /first team/i.test(r.honor_label || ""));
    const secondTeam = race.runners.filter((r) => /second team/i.test(r.honor_label || ""));
    return `<section class="sh-race" id="${stateRaceId(race)}" aria-labelledby="${stateRaceId(race)}-title">
      <div class="sh-race-head"><h2 id="${stateRaceId(race)}-title">${escapeHtml(raceTitle(race))}</h2><span class="sh-note">${race.runners.length} finishers &middot; ${race.teams.length} teams</span></div>
      ${race.teams.length ? `<div><h3 class="sh-label">Team podium</h3><ol class="sh-podium">${race.teams.slice(0, 3).map((t) => `<li><span class="sh-label">${escapeHtml(ordinal(t.place_numeric))}</span><b>${link(t.href, t.school)}</b><span class="sh-num">${t.score} points</span></li>`).join("")}</ol></div>` : ""}
      <div><h3 class="sh-label">Top 10</h3>${runnerTable(race.runners.slice(0, 10), { caption: `${raceTitle(race)} top 10` })}</div>
      <details class="sh-more"><summary>Full results: all ${race.runners.length} finishers</summary>${runnerTable(race.runners, { caption: `${raceTitle(race)} full results` })}</details>
      ${race.teams.length > 3 ? `<details class="sh-more"><summary>All ${race.teams.length} team scores</summary>${teamList(race.teams)}</details>` : ""}
      ${firstTeam.length || secondTeam.length ? `<p class="sh-note">All-Ohio: ${firstTeam.length} first team, ${secondTeam.length} second team (<a href="#all-ohio">lists</a>).</p>` : ""}
    </section>`;
  }).join("");
  const allOhio = order.map((race) => {
    const list = (label) => race.runners.filter((r) => new RegExp(label, "i").test(r.honor_label || ""));
    const first = list("first team"), second = list("second team");
    if (!first.length && !second.length) return "";
    const ol = (rows) => `<ol class="sh-list">${rows.map((r) => `<li><span class="sh-num">${escapeHtml(ordinal(r.place))}</span><span>${link(r.href, r.name)}</span><span></span><small>${escapeHtml(r.school)}</small></li>`).join("")}</ol>`;
    return `<details class="sh-more"><summary>${escapeHtml(raceTitle(race))}</summary><div class="sh-cols"><div><h3 class="sh-label">First team (${first.length})</h3>${ol(first)}</div><div><h3 class="sh-label">Second team (${second.length})</h3>${ol(second)}</div></div></details>`;
  }).join("");
  const fastestList = (rows) => `<ol class="sh-list">${rows.map((r, i) => `<li><span class="sh-num">${i + 1}</span><span>${link(r.href, r.name)}</span><span class="sh-num">${escapeHtml(r.mark_text)}</span><small>${escapeHtml(r.school)} &middot; ${escapeHtml(r.race.divisionLabel)}, ${escapeHtml(ordinal(r.place))}</small></li>`).join("")}</ol>`;
  const recaps = stories.filter((s) => s.kind === "recap");
  const previews = stories.filter((s) => s.kind === "preview");
  const storyList = (list) => `<ul class="sh-list">${list.map((s) => `<li style="grid-template-columns:1fr"><a href="/stories/${escapeHtml(s.slug)}/">${escapeHtml(s.title)}</a></li>`).join("")}</ul>`;
  return `
    <nav class="sh-jump" aria-label="Jump to a race">${order.map((race) => `<a href="#${stateRaceId(race)}">${escapeHtml(`${genderLabel(race.gender)} D${race.division}`)}</a>`).join("")}<a href="#all-ohio">All-Ohio</a><a href="#fastest">Fastest times</a>${stories.length ? `<a href="#stories">Stories</a>` : ""}</nav>
    <section aria-labelledby="champions-title" class="sh-site"><h2 id="champions-title">Champions</h2><div class="sh-champs">${champs}</div></section>
    ${raceSections}
    <section class="sh-race" id="all-ohio" aria-labelledby="all-ohio-title"><h2 id="all-ohio-title">All-Ohio by division</h2>
      <p class="sh-note">All-Ohio honors by state meet place: Division I places 1 to 20 first team and 21 to 40 second team; Divisions II to IV places 1 to 24 and 25 to 48.</p>${allOhio}</section>
    ${fastest ? `<section class="sh-race" id="fastest" aria-labelledby="fastest-title"><h2 id="fastest-title">Fastest times of the day</h2><p class="sh-note">Across all four divisions, same course, same day.</p><div class="sh-cols"><div><h3 class="sh-label">Girls</h3>${fastestList(fastest.girls)}</div><div><h3 class="sh-label">Boys</h3>${fastestList(fastest.boys)}</div></div></section>` : ""}
    ${stories.length ? `<section class="sh-race" id="stories" aria-labelledby="stories-title"><h2 id="stories-title">Stories</h2>${recaps.length ? storyList(recaps) : ""}${previews.length ? `<h3 class="sh-label">Before the meet</h3><p class="sh-note">Previews written before the race. Their picks were projections, not results.</p>${storyList(previews)}` : ""}</section>` : ""}
    ${photos.length ? `<section class="sh-race" aria-labelledby="photos-title"><h2 id="photos-title">Photos</h2><div class="sh-photos">${photos.map((p) => `<figure><img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.meet || "Meet photo")}" loading="lazy"><figcaption>Photo: ${escapeHtml(p.credit)}</figcaption></figure>`).join("")}</div></section>` : ""}`;
}

function sitesBody(hub) {
  const bySite = new Map();
  for (const race of hub.races) { const k = race.meet.id; if (!bySite.has(k)) bySite.set(k, []); bySite.get(k).push(race); }
  const sites = [...bySite.values()].sort((a, b) => siteName(a[0].meet).localeCompare(siteName(b[0].meet)));
  const siteId = (meet) => meet.slug.replace(/^\d{4}-ohsaa-(district|regional)-/, "");
  return `
    <nav class="sh-jump" aria-label="Jump to a site">${sites.map((list) => `<a href="#${escapeHtml(siteId(list[0].meet))}">${escapeHtml(siteName(list[0].meet))}</a>`).join("")}</nav>
    ${sites.map((list) => {
      const meet = list[0].meet;
      const multi = new Set(list.map((r) => `${r.gender}|${r.division}`)).size !== list.length;
      const official = meet.results_url || meet.athleticnet_url;
      return `<section class="sh-site" id="${escapeHtml(siteId(meet))}" aria-labelledby="${escapeHtml(siteId(meet))}-title">
        <h2 id="${escapeHtml(siteId(meet))}-title">${escapeHtml(siteName(meet))}</h2>
        <p class="sh-source">${escapeHtml(shortDate(meet.meet_date))}${meet.venue_name ? ` &middot; ${escapeHtml(meet.venue_name)}` : ""}${official ? ` &middot; <a href="${escapeHtml(official)}" target="_blank" rel="noopener noreferrer">Official full results</a>` : ""}</p>
        ${list.sort((a, b) => (a.gender === b.gender ? a.division - b.division || (a.session || 0) - (b.session || 0) : a.gender === "girls" ? -1 : 1)).map((race) => `<section class="sh-race" id="${escapeHtml(raceId(race))}">
          <div class="sh-race-head"><h3>${escapeHtml(raceTitle(race, multi))}</h3><span class="sh-note">${race.runners.length} finishers &middot; ${race.teams.length} teams</span></div>
          <div class="sh-cols">
            <div><h4 class="sh-label">Top 10</h4>${runnerTable(race.runners.slice(0, 10), { caption: `${siteName(meet)} ${raceTitle(race, multi)} top 10` })}</div>
            ${race.teams.length ? `<div><h4 class="sh-label">Team scores</h4>${teamList(race.teams)}</div>` : ""}
          </div>
        </section>`).join("")}
      </section>`;
    }).join("")}`;
}

export function seasonHubPage(site, hub) {
  const { stage, year, stageKey, meets, races } = hub;
  const pathname = hubPath(stageKey, year);
  const first = meets[0];
  const isState = stageKey === "state";
  const tabs = Object.keys(HUB_STAGES).filter((key) => (HUB_YEARS[key] || []).includes(year));
  const eyebrow = isState ? `${shortDate(first.meet_date)}${first.venue_name ? ` · ${first.venue_name}` : ""}` : `${shortDate(first.meet_date)} · ${meets.length} sites`;
  const description = isState
    ? `Official results from the ${year} Ohio high school cross country state meet: all ${races.length} champions, team scores, All-Ohio teams and full results for every race.`
    : `Official results from the ${year} Ohio high school cross country ${stage.level === "regional" ? "regionals" : "districts"}: winners, top 10 and team scores for every race at all ${meets.length} sites.`;
  const content = `<style>${styles}</style>
  ${pageHero({ eyebrow, title: stage.heading(year), description })}
  <section class="section section-paper"><div class="container sh-shell">
    ${breadcrumb([{ label: "Home", href: "/" }, { label: "Results", href: "/meets/?view=results" }, { label: stage.heading(year) }])}
    <nav class="sh-tabs" aria-label="Postseason round">${tabs.map((key) => `<a href="${hubPath(key, year)}"${key === stageKey ? ' aria-current="page"' : ""}>${escapeHtml(key === "state" ? "State" : key === "regionals" ? "Regionals" : "Districts")}</a>`).join("")}</nav>
    ${sourceLine(stage, meets)}
    ${isState ? stateBody(hub) : sitesBody(hub)}
  </div></section>`;

  const jsonLd = isState ? [{
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: stage.heading(year),
    sport: "Cross country running",
    startDate: first.meet_date,
    eventStatus: "https://schema.org/EventScheduled",
    location: { "@type": "Place", name: first.venue_name || first.city || "Ohio", address: { "@type": "PostalAddress", addressLocality: first.city || undefined, addressRegion: "OH", addressCountry: "US" } },
    url: `${site.siteUrl}${pathname}`
  }] : [];

  return layout({ site, title: stage.title(year), description, pathname, content, jsonLd });
}
