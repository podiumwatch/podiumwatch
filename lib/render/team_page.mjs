import { escapeHtml } from "../../src/lib/content.mjs";
import { layout } from "../../src/lib/html.mjs";
import { pageBand, statCards, dataTable, panel, bandColor } from "../../src/lib/components.mjs";
import { teamColor } from "../team_colors.mjs";

// Team page at /teams/{slug}/ (site redesign step 3, 2026-11-13; first
// built for WO-11). Every module is built from real records
// (lib/team_page_service.mjs) and left out when it has nothing in it.
// Header band in the school color (darkened if white text would fail
// WCAG AA), logo tile, honors, Boys/Girls tabs (real URLs: ?g=girls).
// The school color is used only for the band, stat card edges, rank
// numbers, honor tags and the postseason line.

const e = escapeHtml;
const GENDER = { boys: "Boys", girls: "Girls" };
const ordinal = (n) => { const t = n % 100; return `${n}${t >= 11 && t <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[n % 10] || "th"}`; };
const shortDate = (iso) => { const d = new Date(`${String(iso || "").slice(0, 10)}T12:00:00Z`); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }); };
const clock = (seconds) => { const m = Math.floor(seconds / 60); const s = seconds - m * 60; return `${m}:${s.toFixed(1).padStart(4, "0")}`; };
const meetShort = (name) => String(name || "").replace(/^OHSAA Cross Country /, "");
const siteOf = (name) => String(name || "").replace(/^OHSAA Cross Country (District|Regional|State Championships?)\s*-?\s*/i, "").trim();
// Same rule as lib/team_page_service.mjs (kept here so this file has no
// database import).
const STAGE_RE = [["district", /^OHSAA Cross Country District\b/i], ["regional", /^OHSAA Cross Country Regional\b/i], ["state", /^OHSAA Cross Country State Championships?\b/i]];
const stageOf = (meetName) => (STAGE_RE.find(([, re]) => re.test(String(meetName || ""))) || [])[0] || null;
const STAGES = ["district", "regional", "state"];
const STAGE_LABEL = { district: "District", regional: "Regional", state: "State" };
const pts = (score) => (score != null && score !== "" ? `${score} pts` : "");

function placeTitle(place) {
  if (place === 1) return "State Champion";
  if (place === 2) return "State Runner-up";
  return `${ordinal(place)} at State`;
}

// Real honors only: state finishes, state qualifiers, All-Ohio count.
export function teamHonors(data) {
  const honors = [];
  for (const g of ["boys", "girls"]) {
    const s = data.genders[g].state;
    if (s?.place) honors.push({ label: placeTitle(s.place), note: [`${data.genders[g].division || ""} ${GENDER[g]}`.trim(), pts(s.score)].filter(Boolean).join(" · "), featured: s.place === 1 });
  }
  const qualifiers = data.genders.boys.state_qualifiers + data.genders.girls.state_qualifiers;
  if (qualifiers) honors.push({ label: String(qualifiers), note: `state qualifier${qualifiers === 1 ? "" : "s"}` });
  const allOhio = data.genders.boys.all_ohio + data.genders.girls.all_ohio;
  if (allOhio) honors.push({ label: String(allOhio), note: "All-Ohio" });
  return honors;
}

const hasData = (g) => g.roster.length || g.results.length || g.path.length;

// Postseason path: District, Regional, State. A round skipped by rule
// shows "Bye" with the reason (Division I teams start at regionals); a
// round not reached is gray.
export function postseasonPath(g) {
  if (!g.path.length) return [];
  const byStage = new Map(g.path.map((p) => [p.stage, p]));
  const last = Math.max(...g.path.map((p) => STAGES.indexOf(p.stage)));
  return STAGES.map((stage, i) => {
    const p = byStage.get(stage);
    if (p) return { stage, state: "done", value: p.place ? ordinal(p.place) : "Ran", note: p.place ? pts(p.score) : p.individuals_only ? `${p.runners} individual${p.runners === 1 ? "" : "s"}` : "" };
    if (stage === "district" && g.division === "Division I") return { stage, state: "bye", value: "Bye", note: "D1 teams enter at regionals" };
    if (i > last) return { stage, state: "out", value: "", note: "Not reached" };
    return { stage, state: "out", value: "", note: "No result posted" };
  });
}

function statFor(g, stage) {
  const p = g.path.find((x) => x.stage === stage);
  if (!p || !p.place) return null;
  const result = g.results.find((r) => stageOf(r.meet) === stage);
  const where = stage === "state" ? "" : siteOf(p.meet);
  return { label: STAGE_LABEL[stage], value: ordinal(p.place), note: [pts(p.score), where, shortDate(result?.date)].filter(Boolean).join(" · ") };
}

function genderBody(data, gender, g) {
  // Stat cards: state, regional (or district when that was the last round), top-7 average, roster.
  const cards = statCards([
    statFor(g, "state") || { label: "State", value: null },
    statFor(g, "regional") || statFor(g, "district") || { label: "Regional", value: null },
    { label: "Top-7 average", value: g.top7_average ? clock(g.top7_average) : null, note: "Season bests, different courses" },
    { label: "Roster", value: g.roster.length || null, note: `runner${g.roster.length === 1 ? "" : "s"} with a ${data.season} time` }
  ]);

  const roster = g.roster.length ? panel({
    title: `${data.season} roster`,
    sub: "Ranked by season best. Tap a name for the athlete's page.",
    body: `${dataTable({
      id: `roster-${gender}`,
      caption: `${data.team.display_name} ${GENDER[gender].toLowerCase()} ${data.season} roster by season best`,
      first: 7,
      moreLabel: (n) => `Show ${n} more runner${n === 1 ? "" : "s"}`,
      columns: [{ key: "rank", label: "", kind: "rank" }, { key: "name", label: g.roster.length >= 7 ? "Top 7" : "Runner", kind: "name" }, { key: "cls", label: "Class", kind: "text", phone: false }, { key: "best", label: "Season best", kind: "time" }],
      rows: g.roster.map((r, i) => ({ rank: i + 1, name: { text: r.name, href: `/athletes/${r.slug}/`, sub: meetShort(r.best_meet), tags: [r.honor ? String(r.honor).replace(/\b[a-z]/g, (c) => c.toUpperCase()) : null] }, cls: r.class_year || "", best: r.best }))
    })}<p class="pw-note">Times are each runner's fastest 5K of ${data.season} in Podium Watch results. Courses differ.</p>`
  }) : "";

  const path = postseasonPath(g);
  const pathPanel = path.length ? panel({
    title: "Postseason path",
    body: `<ol class="pw-path">${path.map((p) => `<li class="pw-path-${p.state}"><small>${STAGE_LABEL[p.stage]}</small>${p.value ? `<b>${e(p.value)}</b>` : ""}${p.note ? `<span>${e(p.note)}</span>` : ""}</li>`).join("")}</ol>`
  }) : "";

  const resultRow = (r, hidden) => `<li${hidden ? " hidden data-pw-more-row" : ""}>${shortDate(r.date) ? `<span class="pw-date">${e(shortDate(r.date))}</span>` : `<span class="pw-date pw-date-none" aria-hidden="true"></span>`}<span class="pw-res-meet"><b>${e(meetShort(r.meet))}</b>${r.place ? "" : `<span>Team score not posted</span>`}</span>${r.place ? `<span class="pw-res-place"><b>${e(ordinal(r.place))}</b>${r.score != null ? `<small>${e(r.score)} pts</small>` : ""}</span>` : "<span></span>"}</li>`;
  const resultsPanel = g.results.length ? panel({
    title: `${data.season} season results`,
    body: `<ol class="pw-results" id="results-${gender}">${g.results.map((r, i) => resultRow(r, i >= 4)).join("")}</ol>${g.results.length > 4 ? `<button class="pw-more" type="button" data-pw-more aria-controls="results-${gender}" aria-expanded="false">Show the full season</button>` : ""}`
  }) : "";

  return `${cards}
  <div class="pw-team-grid2">
    <div>${roster}</div>
    <div class="pw-stack">${pathPanel}${resultsPanel}${coachPanel(data)}</div>
  </div>`;
}

function coachPanel(data) {
  const t = data.team;
  const slug = encodeURIComponent(t.slug);
  const links = [
    `<a href="/team/?slug=${slug}">Follow this team</a>`,
    `<a href="/teams/${slug}/season/${data.season}/banquet/">${data.season} Banquet Pack</a>`,
    `<a href="/api/og/team/?slug=${slug}&amp;download=1" download>Share card</a>`,
    ...data.instagram.map((i) => `<a href="${e(i.url)}" target="_blank" rel="noopener noreferrer">Instagram: @${e(i.handle)} <small>${e(i.label)}</small></a>`),
    `<a href="/teams/instagram/?team=${slug}">Add your team's Instagram</a>`,
    ...(data.featured || []).map((story) => `<a href="${e(story.href)}">On the Podium Watch front page</a>`),
    data.claimed ? `<a href="/team-login/">Coach tools: sign in</a>` : `<a href="/claim-your-team/">Coach tools: claim this team</a>`
  ];
  return panel({
    title: "For coaches and families",
    body: `<div class="pw-coach">${links.join("")}
    <details class="pw-report"><summary>Wrong logo or name? Tell us</summary>
      <form class="tp-report" data-tp-report data-team-id="${e(t.id)}">
        <label class="visually-hidden" for="tp-report-details">What is wrong</label>
        <textarea id="tp-report-details" name="details" rows="3" maxlength="1000">The logo or name on this page is wrong. </textarea>
        <label class="visually-hidden" for="tp-report-email">Your email (optional)</label>
        <input id="tp-report-email" type="email" name="reporter_email" placeholder="Your email (optional)" maxlength="320">
        <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">
        <button class="pw-claim-btn" type="submit">Send</button>
        <p class="pw-note" data-tp-report-message role="status"></p>
      </form>
    </details></div>`
  });
}

export function teamPageHtml(site, data, { gender: requested = null } = {}) {
  const t = data.team;
  const name = t.display_name;
  const pathname = `/teams/${t.slug}/`;
  const genderKeys = ["boys", "girls"].filter((g) => hasData(data.genders[g]));
  const gender = genderKeys.includes(requested) ? requested : genderKeys[0] || null;
  const color = teamColor({ slug: t.slug, primary_color: t.primary_color, logo_url: t.logo_url });
  const band = bandColor(color);
  const divisions = ["boys", "girls"].filter((g) => data.genders[g].division).map((g) => `${GENDER[g]} ${data.genders[g].division}`);
  const logoSrc = data.logo?.base ? `${data.logo.base}-256.webp` : data.logo?.external || null;

  const header = pageBand({
    crumbs: [{ label: "Home", href: "/" }, { label: "Teams", href: "/teams/" }, { label: name }],
    title: name,
    context: ["Ohio high school cross country", ...divisions].join(" · "),
    color: color || null,
    logo: { src: logoSrc, name },
    honors: teamHonors(data),
    tabs: genderKeys.map((g) => ({ label: GENDER[g], href: g === genderKeys[0] ? pathname : `${pathname}?g=${g}`, active: g === gender, gender: g })),
    tabsLabel: "Boys and girls"
  });

  const body = gender
    ? genderBody(data, gender, data.genders[gender])
    : `<p class="pw-none">No ${data.season} results on Podium Watch yet.</p><div class="pw-stack pw-none-stack">${coachPanel(data)}</div>`;

  const content = `${header}<div class="container pw-team-body" style="--pw-band:${e(band)}">${body}</div><script src="/scripts/team-page.js" defer></script>`;

  const logoAbs = data.logo?.base ? `${site.siteUrl}${data.logo.base}-512.webp` : undefined;
  const jsonLd = [{
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name: `${name} Cross Country`,
    sport: "Cross country running",
    url: `${site.siteUrl}${pathname}`,
    ...(logoAbs ? { logo: logoAbs, image: logoAbs } : {}),
    ...(t.city ? { location: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: t.city, addressRegion: "OH", addressCountry: "US" } } } : {}),
    memberOf: { "@type": "SportsOrganization", name: "Ohio high school cross country" }
  }];
  const stateLine = ["boys", "girls"].map((g) => data.genders[g].state?.label).filter(Boolean).join("; ");
  const description = `${name}${t.city ? ` (${t.city})` : ""} cross country on Podium Watch: ${data.season} roster, season results${stateLine ? `, ${stateLine}` : ""}.`.slice(0, 158);
  const isSecond = gender && gender !== genderKeys[0];
  return layout({
    site,
    title: `${name}${isSecond ? ` ${GENDER[gender]}` : ""} Cross Country`,
    description,
    pathname,
    canonicalUrl: isSecond ? `${site.siteUrl}${pathname}?g=${gender}` : undefined,
    content,
    jsonLd,
    image: logoAbs,
    robots: genderKeys.length ? undefined : "noindex, follow"
  });
}
