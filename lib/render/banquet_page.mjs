import { escapeHtml } from "../../src/lib/content.mjs";
import { breadcrumb, layout } from "../../src/lib/html.mjs";
import { supportSection } from "../../src/lib/support_card.mjs";
import { formatSeconds, BANQUET_MIN_MEETS } from "../../src/lib/banquet_pack.mjs";

// Banquet Pack pages (WO-35):
//   /teams/{slug}/season/{season}/banquet/         print view (letter) and screen
//   /teams/{slug}/season/{season}/banquet/slides/  1920x1080 projector slides
// The share image is api/og/banquet.js. All three read the same pack
// (src/lib/banquet_pack.mjs). Real results only; derived numbers labeled.

export const banquetPath = (slug, season) => `/teams/${slug}/season/${season}/banquet/`;
export const submitResultsHref = (pack) => `/submit-results/?team=${encodeURIComponent(pack.team.display_name)}&sport=cross_country&season=${pack.season}`;

const e = escapeHtml;
const shortDate = (iso) => { const d = new Date(`${String(iso || "").slice(0, 10)}T12:00:00Z`); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }); };
const ordinal = (n) => { const t = n % 100; return `${n}${t >= 11 && t <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[n % 10] || "th"}`; };
const meetShort = (name) => String(name || "").replace(/^OHSAA Cross Country /, "OHSAA ");
const STAGE = { district: "District", regional: "Regional", state: "State" };
const GENDER = { boys: "Boys", girls: "Girls" };
const honorText = (text) => String(text || "").replace(/\b(first|second|third|honorable|team|mention)\b/gi, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
// Fall 2026 season: the class of 2027 are seniors.
export function classLabel(classYear, season) {
  if (!classYear) return "";
  const grade = 12 - (classYear - (season + 1));
  return ({ 12: "Sr.", 11: "Jr.", 10: "So.", 9: "Fr." })[grade] || `'${String(classYear).slice(2)}`;
}
const teamResult = (r) => r.place ? `${ordinal(r.place)}${r.score != null ? ` &middot; ${e(r.score)} pts` : ""}` : `<span class="bq-muted">Team score not posted</span>`;
const pathItem = (p) => p.place ? `${ordinal(p.place)}${p.score != null ? ` &middot; ${e(p.score)} pts` : ""}` : p.individuals_only ? `${e(p.runners)} individual${p.runners === 1 ? "" : "s"}` : "Team score not posted";
const drop = (a) => a.drop ? `&minus;${formatSeconds(a.drop).replace(/^0:/, "")}` : "";
const genderKeys = (pack) => ["boys", "girls"].filter((g) => pack.genders[g].has_data);

export function builtFromLine(pack) {
  return `Built from ${pack.meet_count} meet${pack.meet_count === 1 ? "" : "s"} on Podium Watch. Missing a meet? <a href="${e(submitResultsHref(pack))}">Send the results</a>.`;
}

function logoImg(pack, size) {
  if (!pack.logo?.base) return "";
  return `<picture><source srcset="${pack.logo.base}-256.webp" type="image/webp"><img src="${pack.logo.base}-256.png" alt="${e(pack.team.display_name)} logo" width="${size}" height="${size}"></picture>`;
}

const styles = `<style>
  .bq { --bq-accent:#0f2a1f; --bq-on:#fff; background:var(--paper); padding-bottom:48px; }
  .bq-head { background:var(--bq-accent); color:var(--bq-on); padding:28px 0 24px; }
  .bq-head-grid { display:grid; grid-template-columns:auto 1fr; gap:18px; align-items:center; }
  .bq-logo { width:96px; height:96px; background:#fff; border-radius:16px; display:grid; place-items:center; padding:8px; }
  .bq-logo img { width:100%; height:100%; object-fit:contain; }
  .bq-head .eyebrow { color:inherit; opacity:.85; margin:0; }
  .bq-head h1 { margin:4px 0 0; font-size:clamp(1.8rem, 5vw, 3rem); line-height:1; color:inherit; }
  .bq-built { margin:14px 0 0; font-weight:700; }
  .bq-built a { color:inherit; text-decoration:underline; }
  .bq-tools { display:flex; flex-wrap:wrap; gap:10px; margin-top:16px; }
  .bq-tools .button { background:#fff; color:#111; border-color:#fff; }
  .bq-body { display:grid; gap:22px; padding-top:24px; }
  .bq-card { background:#fff; border:1px solid var(--line); border-radius:var(--radius-card); padding:20px; }
  .bq-card h2 { margin:0 0 4px; font-size:1.35rem; }
  .bq-card h3 { margin:18px 0 8px; font-size:1.05rem; }
  .bq-card > p.bq-sub { margin:0 0 12px; color:var(--muted); font-size:.9rem; }
  .bq-note { border-left:6px solid var(--bq-accent); font-size:1.1rem; font-weight:650; }
  .bq-note small { display:block; margin-top:6px; color:var(--muted); font-weight:600; font-size:.8rem; }
  .bq-gender { display:grid; gap:22px; }
  .bq-gender > h2 { margin:8px 0 0; font-size:1.7rem; border-bottom:4px solid var(--bq-accent); padding-bottom:6px; }
  .bq-table-wrap { overflow-x:auto; }
  .bq table { width:100%; border-collapse:collapse; font-size:.92rem; font-variant-numeric:tabular-nums; }
  .bq th { text-align:left; font-size:.72rem; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); border-bottom:2px solid var(--ink); padding:6px 8px; white-space:nowrap; }
  .bq td { padding:7px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
  .bq td.num { white-space:nowrap; font-weight:800; }
  .bq td a { color:inherit; }
  .bq-muted { color:var(--muted); font-weight:600; }
  .bq-path { display:flex; flex-wrap:wrap; gap:10px; list-style:none; padding:0; margin:0; }
  .bq-path li { border:2px solid var(--bq-accent); border-radius:10px; padding:8px 12px; font-weight:800; }
  .bq-path li span { display:block; font-size:.72rem; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); }
  .bq-state { font-weight:900; font-size:1.1rem; margin:10px 0 0; }
  .bq-awards { list-style:none; padding:0; margin:0; display:grid; gap:8px; }
  .bq-awards li { display:flex; gap:10px; align-items:baseline; flex-wrap:wrap; }
  .bq-badge { font-size:.72rem; font-weight:900; text-transform:uppercase; letter-spacing:.06em; padding:3px 8px; border-radius:999px; background:var(--pale-green); color:var(--green-ink); }
  .bq-badge.win { background:var(--bq-accent); color:var(--bq-on); }
  .bq-seniors { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:12px; }
  .bq-senior { border:1px solid var(--line); border-radius:12px; padding:14px; }
  .bq-senior strong { display:block; font-size:1.1rem; }
  .bq-senior span { display:block; color:var(--muted); font-size:.88rem; }
  .bq-foot { color:var(--muted); font-size:.85rem; }
  .bq-empty { text-align:center; padding:36px 20px; }
  .bq-empty p { max-width:52ch; margin:0 auto 18px; }
  .bq-coach { display:grid; gap:12px; }
  .bq-coach[hidden] { display:none; }
  .bq-coach-list { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:4px 14px; max-height:340px; overflow:auto; border:1px solid var(--line); border-radius:10px; padding:10px; }
  .bq-coach-list label { display:flex; gap:8px; align-items:center; font-weight:600; }
  .bq-coach textarea { width:100%; min-height:70px; font:inherit; padding:10px; border:1px solid var(--line); border-radius:10px; }
  .bq-coach-status { font-weight:700; }
  @media (max-width:560px) {
    .bq-head-grid { grid-template-columns:1fr; }
    .bq-logo { width:72px; height:72px; }
    .bq-card { padding:14px; }
    .bq .hide-sm { display:none; }
  }
  @media print {
    @page { size:letter; margin:0.5in; }
    .sports-ticker, .site-header, .site-footer, .mobile-dock, .breadcrumbs, .bq-tools, .bq-coach-wrap, .sponsor-slot a::after { display:none !important; }
    body, .bq { background:#fff !important; }
    .bq-head { -webkit-print-color-adjust:exact; print-color-adjust:exact; padding:16px; border-radius:12px; }
    .bq-card { border:0; padding:0; break-inside:avoid; }
    .bq-gender { break-before:page; }
    .bq tr { break-inside:avoid; }
    .bq td a { text-decoration:none; }
    .bq-body { gap:16px; }
    .container { width:100%; }
  }
</style>`;

function resultsTable(results) {
  return `<div class="bq-table-wrap"><table><thead><tr><th>Date</th><th>Meet</th><th>Team place</th></tr></thead><tbody>${results.map((r) => `<tr><td class="num">${e(shortDate(r.date))}</td><td>${e(meetShort(r.meet))}</td><td class="num">${teamResult(r)}</td></tr>`).join("")}</tbody></table></div>`;
}

function bestsTable(pack, athletes) {
  return `<div class="bq-table-wrap"><table><thead><tr><th>Athlete</th><th>Class</th><th>Season best</th><th class="hide-sm">Where</th><th>First race on Podium Watch</th><th>Change</th></tr></thead><tbody>${athletes.map((a) => `<tr><td><a href="/athletes/${e(a.slug)}/">${e(a.name)}</a></td><td>${e(classLabel(a.class_year, pack.season))}</td><td class="num">${e(a.best.mark)}</td><td class="hide-sm">${e(meetShort(a.best.meet))}, ${e(shortDate(a.best.date))}</td><td class="num">${a.races > 1 ? `${e(a.first.mark)} <span class="bq-muted">${e(shortDate(a.first.date))}</span>` : `<span class="bq-muted">One race</span>`}</td><td class="num">${drop(a)}</td></tr>`).join("")}</tbody></table></div>`;
}

function genderSection(pack, g) {
  const x = pack.genders[g];
  const label = `${GENDER[g]}${x.division ? ` &middot; ${e(x.division)}` : ""}`;
  const parts = [`<h2>${label}</h2>`];
  if (x.results.length) parts.push(`<section class="bq-card"><h2>Season results</h2><p class="bq-sub">Every meet with ${GENDER[g].toLowerCase()} results on Podium Watch. Team place and score where the meet posted them.</p>${resultsTable(x.results)}</section>`);
  if (x.path.length) parts.push(`<section class="bq-card"><h2>Postseason</h2><ul class="bq-path">${x.path.map((p) => `<li><span>${STAGE[p.stage]}</span>${pathItem(p)}</li>`).join("")}</ul>${x.state?.label ? `<p class="bq-state">${e(x.state.label)}</p>` : ""}</section>`);
  if (x.athletes.length) parts.push(`<section class="bq-card"><h2>Season bests</h2><p class="bq-sub">Each runner's fastest 5K this season. "First race on Podium Watch" is their first 2026 race we have; courses differ, so the change is not a like-for-like comparison.</p>${bestsTable(pack, x.athletes)}</section>`);
  if (x.improved.length) parts.push(`<section class="bq-card"><h2>Most improved</h2><p class="bq-sub">Biggest drop from first race on Podium Watch to season best, runners with at least 3 races. Different courses.</p><div class="bq-table-wrap"><table><thead><tr><th>Athlete</th><th>First race</th><th>Season best</th><th>Change</th></tr></thead><tbody>${x.improved.map((a) => `<tr><td>${e(a.name)}</td><td class="num">${e(a.first.mark)} <span class="bq-muted">${e(shortDate(a.first.date))}</span></td><td class="num">${e(a.best.mark)} <span class="bq-muted">${e(shortDate(a.best.date))}</span></td><td class="num">${drop(a)}</td></tr>`).join("")}</tbody></table></div></section>`);
  if (x.top7_by_meet.length) parts.push(`<section class="bq-card"><h2>Top-7 average by meet</h2><p class="bq-sub">Average of the team's 7 fastest times at each meet where 7 or more ran. Courses differ.</p><div class="bq-table-wrap"><table><thead><tr><th>Date</th><th>Meet</th><th>Runners</th><th>Top-7 average</th></tr></thead><tbody>${x.top7_by_meet.map((m) => `<tr><td class="num">${e(shortDate(m.date))}</td><td>${e(meetShort(m.meet))}</td><td>${e(m.runners)}</td><td class="num">${formatSeconds(m.average)}</td></tr>`).join("")}</tbody></table></div></section>`);
  if (x.all_ohio.length) parts.push(`<section class="bq-card"><h2>All-Ohio</h2><ul class="bq-awards">${x.all_ohio.map((a) => `<li><strong>${e(a.name)}</strong> <span class="bq-badge win">${e(honorText(a.honor))}</span></li>`).join("")}</ul></section>`);
  return `<div class="bq-gender">${parts.join("")}</div>`;
}

function awardsSection(pack) {
  if (!pack.awards.length) return "";
  return `<section class="bq-card"><h2>Podium Watch awards</h2><ul class="bq-awards">${pack.awards.map((a) => `<li><span class="bq-badge${a.result === "Winner" ? " win" : ""}">${a.result}</span> <strong>${e(a.name)}</strong> <span>${e(a.award)}${a.week ? `, week of ${e(shortDate(a.week))}` : ""}</span></li>`).join("")}</ul></section>`;
}

function seniorsSection(pack) {
  if (!pack.seniors.length) return "";
  return `<section class="bq-card"><h2>Seniors</h2><div class="bq-seniors">${pack.seniors.map((a) => `<div class="bq-senior"><strong>${e(a.name)}</strong><span>${GENDER[a.gender]} &middot; Class of ${e(a.class_year)}</span><span>Season best ${e(a.best.mark)}, ${e(meetShort(a.best.meet))}</span><span>${e(a.races)} race${a.races === 1 ? "" : "s"} on Podium Watch</span>${a.honor ? `<span class="bq-badge win">${e(honorText(a.honor))}</span>` : ""}</div>`).join("")}</div></section>`;
}

function coachPanel(pack) {
  if (!pack.claimed) return "";
  return `<div class="bq-coach-wrap"><button type="button" class="button secondary" data-bq-coach-open>Coach tools</button>
  <section class="bq-card bq-coach" data-bq-coach hidden data-team-id="${e(pack.team.id)}" data-season="${pack.season}">
    <h2>Coach tools</h2>
    <p class="bq-sub" data-bq-coach-msg>Signed-in coaches on this team's account can hide athletes and add a note. Times can't be edited.</p>
    <div data-bq-coach-form hidden>
      <label><strong>Note at the top of the pack</strong> (280 characters)<textarea maxlength="280" data-bq-note></textarea></label>
      <p><strong>Show these athletes</strong> (uncheck to hide)</p>
      <div class="bq-coach-list" data-bq-athletes></div>
      <p><button type="button" class="button" data-bq-save>Save</button> <span class="bq-coach-status" data-bq-status role="status"></span></p>
    </div>
  </section></div>`;
}

function headBlock(pack, { tools }) {
  return `<header class="bq-head"><div class="container">
    <div class="bq-head-grid">
      ${pack.logo?.base ? `<div class="bq-logo">${logoImg(pack, 96)}</div>` : ""}
      <div><p class="eyebrow">${pack.season} Cross Country Banquet Pack</p><h1>${e(pack.team.display_name)}</h1></div>
    </div>
    <p class="bq-built">${builtFromLine(pack)}</p>
    ${tools}
  </div></header>`;
}

export function banquetPageHtml(site, pack, { sponsorHtml = "" } = {}) {
  const pathname = banquetPath(pack.team.slug, pack.season);
  const name = pack.team.display_name;
  const crumbs = breadcrumb([{ label: "Home", href: "/" }, { label: "Teams", href: "/teams/" }, { label: name, href: `/teams/${pack.team.slug}/` }, { label: "Banquet Pack" }]);
  const vars = `<style>.bq { --bq-accent:${e(pack.accent)}; --bq-on:${e(pack.accent_text)}; }</style>`;
  let body;
  if (!pack.eligible) {
    body = `${headBlock(pack, { tools: "" })}
    <div class="container bq-body"><section class="bq-card bq-empty">
      <p>A full Banquet Pack needs results from at least ${BANQUET_MIN_MEETS} meets. Send the meets we're missing and the pack builds itself.</p>
      <a class="button" href="${e(submitResultsHref(pack))}">Upload results</a>
    </section></div>`;
  } else {
    const tools = `<div class="bq-tools"><a class="button" href="${pathname}slides/">Projector slides</a><button type="button" class="button" data-bq-print>Print</button><a class="button" href="/api/og/banquet/?slug=${e(pack.team.slug)}&amp;download=1">Share image</a></div>`;
    body = `${headBlock(pack, { tools })}
    <div class="container bq-body">
      ${coachPanel(pack)}
      ${pack.note ? `<section class="bq-card bq-note">${e(pack.note)}<small>From the coaching staff</small></section>` : ""}
      ${sponsorHtml}
      ${awardsSection(pack)}
      ${seniorsSection(pack)}
      ${genderKeys(pack).map((g) => genderSection(pack, g)).join("")}
      <p class="bq-foot">From results on Podium Watch, as posted by each meet. Season bests, changes and averages are arithmetic on those times. Podium Watch &middot; podiumwatch.org/teams/${e(pack.team.slug)}/</p>
    </div>`;
  }
  const content = `${styles}${vars}<div class="bq">${`<div class="container">${crumbs}</div>`}${body}${supportSection({ placement: "banquet", from: pathname })}</div>
  <script src="/scripts/banquet.js" defer></script>`;
  const description = `${name} ${pack.season} cross country season: results, season bests, postseason and honors from Podium Watch, ready to print or project.`;
  return layout({ site, title: `${name} ${pack.season} Banquet Pack`, description, pathname, content, robots: "noindex, follow", image: pack.eligible ? `${site.siteUrl}/api/og/banquet/?slug=${pack.team.slug}` : undefined, imageWidth: 1080, imageHeight: 1350 });
}

// --- Slides --------------------------------------------------------------
const chunk = (list, size) => { const out = []; for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size)); return out; };

export function banquetSlides(pack) {
  const slides = [];
  const name = e(pack.team.display_name);
  slides.push({ kind: "title", html: `${pack.logo?.base ? `<div class="sl-logo">${logoImg(pack, 300)}</div>` : ""}<p class="sl-kicker">${pack.season} Cross Country</p><h1 class="sl-huge">${name}</h1>${pack.note ? `<p class="sl-note">${e(pack.note)}</p>` : ""}` });
  for (const g of genderKeys(pack)) {
    const x = pack.genders[g];
    const tag = `${GENDER[g]}${x.division ? ` &middot; ${e(x.division)}` : ""}`;
    chunk(x.results, 8).forEach((rows, i, all) => slides.push({ kind: "table", html: `<p class="sl-kicker">${tag}</p><h2>Season results${all.length > 1 ? ` <small>${i + 1}/${all.length}</small>` : ""}</h2><table><thead><tr><th>Date</th><th>Meet</th><th>Team</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${e(shortDate(r.date))}</td><td>${e(meetShort(r.meet))}</td><td class="r">${teamResult(r)}</td></tr>`).join("")}</tbody></table>` }));
    if (x.path.length) slides.push({ kind: "path", html: `<p class="sl-kicker">${tag}</p><h2>Postseason</h2><div class="sl-path">${x.path.map((p) => `<div><span>${STAGE[p.stage]}</span><strong>${pathItem(p)}</strong></div>`).join("")}</div>${x.state?.label ? `<p class="sl-big">${e(x.state.label)}</p>` : ""}` });
    chunk(x.athletes, 8).forEach((rows, i, all) => slides.push({ kind: "table", html: `<p class="sl-kicker">${tag}</p><h2>Season bests${all.length > 1 ? ` <small>${i + 1}/${all.length}</small>` : ""}</h2><table><thead><tr><th>Athlete</th><th>Class</th><th>Best</th><th>First race on Podium Watch</th></tr></thead><tbody>${rows.map((a) => `<tr><td>${e(a.name)}</td><td>${e(classLabel(a.class_year, pack.season))}</td><td class="r">${e(a.best.mark)}</td><td class="r">${a.races > 1 ? e(a.first.mark) : "&ndash;"}</td></tr>`).join("")}</tbody></table><p class="sl-foot">Different courses.</p>` }));
    if (x.improved.length) slides.push({ kind: "table", html: `<p class="sl-kicker">${tag}</p><h2>Most improved</h2><table><thead><tr><th>Athlete</th><th>First race</th><th>Season best</th><th>Change</th></tr></thead><tbody>${x.improved.map((a) => `<tr><td>${e(a.name)}</td><td class="r">${e(a.first.mark)}</td><td class="r">${e(a.best.mark)}</td><td class="r">${drop(a)}</td></tr>`).join("")}</tbody></table><p class="sl-foot">First race on Podium Watch to season best, at least 3 races. Different courses.</p>` });
    if (x.top7_by_meet.length) chunk(x.top7_by_meet, 8).forEach((rows) => slides.push({ kind: "table", html: `<p class="sl-kicker">${tag}</p><h2>Top-7 average by meet</h2><table><thead><tr><th>Date</th><th>Meet</th><th>Average</th></tr></thead><tbody>${rows.map((m) => `<tr><td>${e(shortDate(m.date))}</td><td>${e(meetShort(m.meet))}</td><td class="r">${formatSeconds(m.average)}</td></tr>`).join("")}</tbody></table><p class="sl-foot">Meets where 7 or more ran. Courses differ.</p>` }));
    if (x.all_ohio.length) slides.push({ kind: "list", html: `<p class="sl-kicker">${tag}</p><h2>All-Ohio</h2><ul class="sl-list">${x.all_ohio.map((a) => `<li><strong>${e(a.name)}</strong><span>${e(honorText(a.honor))}</span></li>`).join("")}</ul>` });
  }
  if (pack.awards.length) chunk(pack.awards, 6).forEach((rows) => slides.push({ kind: "list", html: `<p class="sl-kicker">Podium Watch</p><h2>Awards</h2><ul class="sl-list">${rows.map((a) => `<li><strong>${e(a.name)}</strong><span>${a.result}, ${e(a.award)}${a.week ? `, week of ${e(shortDate(a.week))}` : ""}</span></li>`).join("")}</ul>` }));
  for (const a of pack.seniors) {
    const races = a.races_list.slice(-7);
    slides.push({ kind: "senior", html: `<p class="sl-kicker">Senior &middot; ${GENDER[a.gender]} &middot; Class of ${e(a.class_year)}</p><h1 class="sl-huge">${e(a.name)}</h1><div class="sl-senior"><div><span>Season best</span><strong>${e(a.best.mark)}</strong><em>${e(meetShort(a.best.meet))}</em></div><div><span>Races on Podium Watch</span><strong>${e(a.races)}</strong></div>${a.honor ? `<div><span>Honor</span><strong class="sm">${e(honorText(a.honor))}</strong></div>` : ""}</div><table class="sl-races"><tbody>${races.map((r) => `<tr><td>${e(shortDate(r.date))}</td><td>${e(meetShort(r.meet))}</td><td class="r">${e(r.mark)}</td></tr>`).join("")}</tbody></table>` });
  }
  slides.push({ kind: "end", html: `<p class="sl-kicker">${pack.season} Cross Country</p><h1 class="sl-huge">Thank you</h1><p class="sl-note">${name} &middot; podiumwatch.org/teams/${e(pack.team.slug)}/</p>` });
  return slides;
}

export function banquetSlidesHtml(site, pack, { sponsorName = "" } = {}) {
  const pathname = `${banquetPath(pack.team.slug, pack.season)}slides/`;
  const slides = banquetSlides(pack);
  const sponsor = sponsorName ? `<span>Presented by ${e(sponsorName)}</span>` : "";
  const content = `<style>
  html, body { margin:0; height:100%; background:#000; overflow:hidden; }
  .skip-link { display:none; }
  .sl-stage { position:fixed; inset:0; overflow:hidden; }
  .sl-deck { width:1920px; height:1080px; position:absolute; left:50%; top:50%; transform-origin:center; transform:translate(-50%, -50%); }
  .sl { position:absolute; inset:0; display:none; flex-direction:column; justify-content:center; padding:90px 120px 120px; box-sizing:border-box; background:${e(pack.accent)}; color:${e(pack.accent_text)}; font-family:Outfit, Arial, Helvetica, sans-serif; }
  .sl.on { display:flex; }
  .sl-kicker { margin:0 0 14px; font-size:34px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; opacity:.85; }
  .sl h2 { margin:0 0 30px; font-size:84px; line-height:1; font-family:"Big Shoulders Display", Impact, sans-serif; text-transform:uppercase; }
  .sl h2 small { font-size:40px; opacity:.7; }
  .sl-huge { margin:0; font-size:150px; line-height:.95; font-family:"Big Shoulders Display", Impact, sans-serif; text-transform:uppercase; }
  .sl-logo { width:300px; height:300px; background:#fff; border-radius:36px; padding:24px; box-sizing:border-box; margin-bottom:40px; }
  .sl-logo img { width:100%; height:100%; object-fit:contain; }
  .sl-note { margin:30px 0 0; font-size:44px; font-weight:700; max-width:1500px; }
  .sl table { width:100%; border-collapse:collapse; font-size:40px; font-variant-numeric:tabular-nums; }
  .sl th { text-align:left; font-size:26px; letter-spacing:.1em; text-transform:uppercase; opacity:.75; padding:0 16px 12px; border-bottom:4px solid currentColor; }
  .sl td { padding:11px 16px; border-bottom:2px solid color-mix(in srgb, currentColor 25%, transparent); }
  .sl td.r { white-space:nowrap; font-weight:800; }
  .sl .bq-muted { opacity:.7; font-weight:600; font-size:.8em; }
  .sl-foot { margin:22px 0 0; font-size:28px; opacity:.8; }
  .sl-path { display:flex; gap:40px; }
  .sl-path div { border:5px solid currentColor; border-radius:24px; padding:30px 40px; min-width:380px; }
  .sl-path span, .sl-senior span { display:block; font-size:30px; letter-spacing:.1em; text-transform:uppercase; opacity:.8; }
  .sl-path strong { display:block; font-size:64px; margin-top:8px; }
  .sl-big { margin:44px 0 0; font-size:64px; font-weight:900; }
  .sl-list { list-style:none; margin:0; padding:0; display:grid; gap:22px; }
  .sl-list li strong { font-size:56px; display:block; }
  .sl-list li span { font-size:34px; opacity:.85; }
  .sl-senior { display:flex; gap:70px; margin:40px 0 30px; }
  .sl-senior strong { display:block; font-size:96px; line-height:1; margin-top:8px; font-family:"Big Shoulders Display", Impact, sans-serif; }
  .sl-senior strong.sm { font-size:56px; font-family:inherit; }
  .sl-senior em { display:block; font-style:normal; font-size:30px; margin-top:6px; opacity:.85; }
  .sl-races { font-size:32px !important; max-width:1400px; }
  .sl-races td { padding:8px 16px !important; }
  .sl-brand { position:absolute; left:120px; right:120px; bottom:44px; display:flex; justify-content:space-between; font-size:26px; font-weight:800; opacity:.8; }
  .sl-ui { position:fixed; right:14px; bottom:12px; display:flex; gap:8px; align-items:center; font:600 14px Arial, sans-serif; color:#fff; opacity:.35; transition:opacity .2s; z-index:2; }
  .sl-ui:hover, .sl-ui:focus-within { opacity:1; }
  .sl-ui button, .sl-ui a { background:#222; color:#fff; border:1px solid #555; border-radius:8px; padding:8px 12px; font:inherit; cursor:pointer; text-decoration:none; }
</style>
<div class="sl-stage"><div class="sl-deck" data-sl-deck>
${slides.map((s, i) => `<section class="sl kind-${s.kind}${i === 0 ? " on" : ""}" aria-roledescription="slide" aria-label="${i + 1} of ${slides.length}">${s.html}<div class="sl-brand"><span>Podium Watch &middot; ${name(pack)}</span>${sponsor}<span>${i + 1} / ${slides.length}</span></div></section>`).join("\n")}
</div></div>
<div class="sl-ui"><button type="button" data-sl-prev aria-label="Previous slide">&larr;</button><button type="button" data-sl-next aria-label="Next slide">&rarr;</button><button type="button" data-sl-full>Full screen</button><a href="${banquetPath(pack.team.slug, pack.season)}">Exit</a></div>
<script src="/scripts/banquet-slides.js" defer></script>`;
  return layout({ site, title: `${pack.team.display_name} ${pack.season} Banquet Slides`, description: `Projector slides for the ${pack.team.display_name} ${pack.season} cross country banquet.`, pathname, content, robots: "noindex, nofollow", chromeless: true });
}

function name(pack) { return e(pack.team.display_name); }
