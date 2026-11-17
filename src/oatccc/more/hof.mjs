import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { oatcccLayout } from "../layout.mjs";
import { escapeHtml } from "../../lib/content.mjs";
import { HOF_PATHS, AWARD_PAGES } from "./registry.mjs";
import { resolveHref, resolveLinks, OATCCC_ORIGIN } from "./links.mjs";
import { selectAll } from "../../../lib/supabase_paging.mjs";

// Hall of Fame and Awards (OATCCC_HOF_LIVE). The data lives in the
// database (install/103_OATCCC_HALL_OF_FAME.sql, loaded by
// scripts/import-oatccc-hall-of-fame.mjs) and is read here at build time,
// so the bios are never in git and the pages are plain, crawlable HTML.
//
// With no data (migration not run, import not run, or no SUPABASE_URL at
// build time) no Hall of Fame page is built, and scripts/build.mjs treats
// the section as off for that build, so the tab, hub card and every link
// keep pointing to oatccc.com instead of a missing page.
//
// Local previews only: OATCCC_HOF_PREVIEW_FILE=<path to the import's
// hof-import-preview.json> reads that file instead (never in production).

export async function loadHofData(flags, env = process.env) {
  if (!flags.sections?.hof) return null;
  const previewFile = String(env.OATCCC_HOF_PREVIEW_FILE || "").trim();
  if (previewFile && env.VERCEL_ENV !== "production") {
    const preview = JSON.parse(fs.readFileSync(previewFile, "utf8"));
    const idBySlug = new Map(preview.inductees.map((r) => [r.slug, r.slug]));
    return {
      inductees: preview.inductees.map((r) => ({ ...r, id: r.slug })),
      awards: preview.awards,
      recipients: preview.recipients.map(({ inductee_slug, ...r }) => ({ ...r, inductee_id: inductee_slug ? idBySlug.get(inductee_slug) : null }))
    };
  }
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) { console.warn("OATCCC Hall of Fame: no SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY at build time; no Hall of Fame pages built."); return null; }
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const [inductees, awards, recipients] = await Promise.all([
    selectAll(() => client.from("oatccc_hof_inductees").select("id, slug, name, sort_name, induction_year, ed_barker_recipient, school, sport, bio, photo_path, old_url"), { maxRows: 5000 }),
    selectAll(() => client.from("oatccc_awards").select("key, slug, title, intro_html, old_url, sort"), { orderColumn: "key", maxRows: 100 }),
    selectAll(() => client.from("oatccc_award_recipients").select("id, award_key, position, year, year_label, name, school, details, photo_path, inductee_id, old_url"), { maxRows: 20000 })
  ]);
  for (const result of [inductees, awards, recipients]) {
    if (result.error) { console.warn(`OATCCC Hall of Fame: could not read the database (${result.error.message}); no Hall of Fame pages built.`); return null; }
  }
  if (!inductees.data.length) { console.warn("OATCCC Hall of Fame: no inductees in the database yet; no Hall of Fame pages built."); return null; }
  return { inductees: inductees.data, awards: awards.data, recipients: recipients.data };
}

const photoUrl = (photoPath, flags) => (photoPath ? resolveHref(`${OATCCC_ORIGIN}/${encodeURI(photoPath)}`, flags) : null);

function bioHtml(text) {
  return String(text || "").split(/\n{2,}/).map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`).join("\n");
}

function hofNav(current) {
  const items = [
    { key: "hof", href: HOF_PATHS.hof, label: "Hall of Fame" },
    { key: "awards", href: HOF_PATHS.awards, label: "All awards" },
    ...AWARD_PAGES.map((a) => ({ key: a.key, href: `${HOF_PATHS.awards}${a.slug}/`, label: a.title }))
  ];
  return `<nav class="ox-morenav" aria-label="Hall of Fame and awards"><ul>${items.map((i) => `<li><a href="${i.href}"${i.key === current ? ' aria-current="page"' : ""}>${escapeHtml(i.label)}</a></li>`).join("")}</ul></nav>`;
}

function shell(site, flags, { pathname, title, description, nav, body, scripts = [] }) {
  const content = `<div class="ox-wrap ox-more ox-hof">
  <div class="page-head"><p class="ox-kicker">Hall of Fame &amp; Awards</p><h1>${escapeHtml(title)}</h1></div>
  ${nav}
  ${body}
  <p class="ox-source">This page is shared from oatccc.com with the OATCCC&rsquo;s permission.</p>
</div>`;
  return { pathname, html: oatcccLayout({ site, flags, pathname, title, description, tab: "hof", content, scripts }) };
}

function listPage(site, flags, data) {
  const people = [...data.inductees].sort((a, b) => b.induction_year - a.induction_year || a.sort_name.localeCompare(b.sort_name));
  const years = [...new Set(people.map((p) => p.induction_year))].sort((a, b) => b - a);
  const cards = people.map((p) => {
    const img = photoUrl(p.photo_path, flags);
    return `<li class="ox-hofcard" data-name="${escapeHtml(`${p.name} ${p.school || ""}`.toLowerCase())}" data-hof-year="${p.induction_year}" data-barker="${p.ed_barker_recipient ? 1 : 0}">
  <a href="${HOF_PATHS.hof}${p.slug}/">${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy" width="160" height="200">` : '<span class="ox-hofnoimg" aria-hidden="true"></span>'}<b>${escapeHtml(p.name)}</b></a>
  <span>${p.induction_year}${p.ed_barker_recipient ? ' <em class="ox-badge">Ed Barker Recipient</em>' : ""}</span>
</li>`;
  }).join("\n");
  const body = `<form class="ox-hoffilters" role="search" data-ox-hof-filters onsubmit="return false">
  <label>Search by name or school <input type="search" name="q" autocomplete="off" data-ox-hof-q></label>
  <label>Year <select name="year" data-ox-hof-year><option value="">All years</option>${years.map((y) => `<option value="${y}">${y}</option>`).join("")}</select></label>
  <label class="ox-check"><input type="checkbox" name="barker" data-ox-hof-barker> <span>Ed Barker Recipients only</span></label>
</form>
<p class="ox-hofcount" role="status" aria-live="polite" data-ox-hof-count>${people.length} inductees</p>
<ul class="ox-hofgrid" data-ox-hof-list>
${cards}
</ul>`;
  return shell(site, flags, { pathname: HOF_PATHS.hof, title: "OATCCC Hall of Fame", description: `The OATCCC Hall of Fame: ${people.length} inductees since ${years[years.length - 1]}.`, nav: hofNav("hof"), body, scripts: ["/scripts/oatccc-hof.js"] });
}

function inducteePage(site, flags, person, data) {
  const img = photoUrl(person.photo_path, flags);
  const awards = data.recipients.filter((r) => r.inductee_id === person.id);
  const awardTitle = (key) => data.awards.find((a) => a.key === key)?.title || key;
  const awardSlug = (key) => data.awards.find((a) => a.key === key)?.slug;
  const honors = awards.length
    ? `<h2>Awards</h2><ul>${awards.map((r) => `<li><a href="${HOF_PATHS.awards}${awardSlug(r.award_key)}/">${escapeHtml(awardTitle(r.award_key))}</a>${r.year_label ? `, ${escapeHtml(r.year_label)}` : ""}${r.details ? ` (${escapeHtml(r.details)})` : ""}</li>`).join("")}</ul>`
    : "";
  const body = `<article class="ox-inductee">
  ${img ? `<img class="ox-inductee-photo" src="${escapeHtml(img)}" alt="${escapeHtml(person.name)}" width="240" height="300">` : ""}
  <div>
    <p class="ox-inductee-year">Inducted ${person.induction_year}</p>
    ${person.ed_barker_recipient ? `<p><strong>Ed Barker Recipient</strong></p>` : ""}
    ${person.school ? `<p>${escapeHtml(person.school)}</p>` : ""}
    <h2>About ${escapeHtml(person.name)}</h2>
    <div class="ox-prose">${bioHtml(person.bio) || "<p></p>"}</div>
    ${honors}
    <p><a class="btn2" href="${HOF_PATHS.hof}">All Hall of Fame inductees</a></p>
  </div>
</article>`;
  return shell(site, flags, { pathname: `${HOF_PATHS.hof}${person.slug}/`, title: `${person.name} (${person.induction_year})`, description: `${person.name}, OATCCC Hall of Fame ${person.induction_year}${person.ed_barker_recipient ? ", Ed Barker Recipient" : ""}.`, nav: hofNav(""), body });
}

function awardsIndex(site, flags, data) {
  const items = AWARD_PAGES.map((a) => {
    const count = data.recipients.filter((r) => r.award_key === a.key).length;
    return `<li><a href="${HOF_PATHS.awards}${a.slug}/"><b>${escapeHtml(a.title)}</b><span>${count} ${count === 1 ? "recipient" : "recipients"}</span></a></li>`;
  }).join("");
  const body = `<ul class="ox-awardlist">${items}</ul>`;
  return shell(site, flags, { pathname: HOF_PATHS.awards, title: "OATCCC Awards", description: "OATCCC awards: Ed Barker, Coaches of the Year, Fred Dafler, SEI and the Middle School State Award.", nav: hofNav("awards"), body });
}

function awardPage(site, flags, award, data) {
  const rows = data.recipients
    .filter((r) => r.award_key === award.key)
    .sort((a, b) => (b.year || 0) - (a.year || 0) || a.position - b.position);
  const has = (field) => rows.some((r) => r[field]);
  const slugById = new Map(data.inductees.map((p) => [p.id, p.slug]));
  const head = `<tr><th scope="col">Year</th><th scope="col">Name</th>${has("school") ? '<th scope="col">School</th>' : ""}${has("details") ? '<th scope="col">Details</th>' : ""}</tr>`;
  const body = rows.map((r) => {
    const slug = r.inductee_id ? slugById.get(r.inductee_id) : null;
    const name = slug ? `<a href="${HOF_PATHS.hof}${slug}/">${escapeHtml(r.name)}</a>` : escapeHtml(r.name);
    return `<tr data-name="${escapeHtml(`${r.name} ${r.school || ""} ${r.details || ""}`.toLowerCase())}"><td>${escapeHtml(r.year_label || (r.year ? String(r.year) : ""))}</td><th scope="row">${name}</th>${has("school") ? `<td>${escapeHtml(r.school || "")}</td>` : ""}${has("details") ? `<td>${escapeHtml(r.details || "")}</td>` : ""}</tr>`;
  }).join("\n");
  const intro = award.intro_html ? `<div class="ox-prose">${resolveLinks(award.intro_html, flags)}</div>` : "";
  const html = `${intro}
<form class="ox-hoffilters" role="search" data-ox-award-filter onsubmit="return false"><label>Search recipients <input type="search" autocomplete="off" data-ox-award-q></label></form>
<p class="ox-hofcount" role="status" aria-live="polite" data-ox-award-count>${rows.length} ${rows.length === 1 ? "recipient" : "recipients"}, newest first</p>
<div class="ox-prose"><table class="ox-awardtable" data-ox-award-table><thead>${head}</thead><tbody>
${body}
</tbody></table></div>`;
  return shell(site, flags, { pathname: `${HOF_PATHS.awards}${award.slug}/`, title: award.title, description: `${award.title}: OATCCC recipients, newest first.`, nav: hofNav(award.key), body: html, scripts: ["/scripts/oatccc-hof.js"] });
}

export function oatcccHofPages(site, flags, data) {
  if (!flags.sections?.hof || !data) return [];
  const awards = AWARD_PAGES.map((page) => ({ ...page, ...(data.awards.find((a) => a.key === page.key) || {}) })).filter((a) => a.intro_html !== undefined || data.recipients.some((r) => r.award_key === a.key));
  return [
    listPage(site, flags, data),
    ...data.inductees.map((person) => inducteePage(site, flags, person, data)),
    awardsIndex(site, flags, data),
    ...awards.map((award) => awardPage(site, flags, award, data))
  ];
}
