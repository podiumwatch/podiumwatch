// Parses the crawled oatccc.com Hall of Fame and award pages
// (scripts/oatccc-crawl.mjs) into rows for install/103_OATCCC_HALL_OF_FAME.sql.
// Used by scripts/import-oatccc-hall-of-fame.mjs. Pure functions: no
// network, no database. Words are kept exactly; nothing is guessed (no
// school or sport is inferred for inductees; oatccc.com has no such
// fields).
import * as cheerio from "cheerio";
import { cleanMain } from "./oatccc_port.mjs";

export const ORIGIN = "https://www.oatccc.com";
const words = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const abs = (href, base = ORIGIN) => { try { return new URL(href, base).href; } catch { return href; } };
const pathOf = (href) => { try { return decodeURI(new URL(href, ORIGIN).pathname); } catch { return null; } };
// Storage key for an oatccc.com image: its path without the leading slash.
export const photoKey = (src) => { const p = pathOf(src); return p ? p.replace(/^\/+/, "") : null; };
const PLACEHOLDER = /Ohio-Association-of-Track-Cross-Country(-Coaches)?(-Team)?\.jpg$/i;

export function slugify(text) {
  return String(text).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[“”"'’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// "Brittany Erin Atkinson" -> "Atkinson Brittany Erin" for sorting.
function sortName(first, last, name) {
  return words(last && first ? `${last} ${first}` : name).toLowerCase();
}

// The /HOF/ list: one tile per inductee with year, first/last name, photo
// and an "Ed Barker Recipient" line when it applies.
export function parseInducteeList(listPage) {
  const $ = cheerio.load(listPage.mainHtml);
  const out = [];
  $(".js-filter-item").each((_, el) => {
    const $el = $(el);
    const link = $el.find("a[href*='View-Bio']").first();
    if (!link.length) return;
    const name = words($el.find("h6").first().text());
    const year = Number($el.attr("data-year") || words($el.find("p strong").first().text()));
    const img = $el.find("img").first().attr("src");
    out.push({
      name,
      first: words($el.attr("data-fname")),
      last: words($el.attr("data-lname")),
      year: Number.isFinite(year) ? year : null,
      edBarker: /Ed Barker Recipient/i.test($el.text()),
      oldUrl: abs(link.attr("href")),
      photo: img && !PLACEHOLDER.test(img) ? photoKey(img) : null
    });
  });
  return out;
}

// One bio page: "Name (year)", optional "Ed Barker Recipient", photo, and
// the bio in a white-space:pre-wrap paragraph (line breaks kept).
export function parseBio(page) {
  const $ = cheerio.load(page.mainHtml);
  const heading = words($("h2").first().text());
  const m = heading.match(/^(.*)\s+\((\d{4})\)$/);
  const bioEl = $("p[style*='pre-wrap']").first();
  const bio = (bioEl.length ? bioEl.text() : "").replace(/\r\n/g, "\n").replace(/^\n+|\s+$/g, "");
  const img = $("img").first().attr("src");
  return {
    name: m ? words(m[1]) : heading,
    year: m ? Number(m[2]) : null,
    edBarker: /Ed Barker Recipient/i.test($("strong").map((_, s) => $(s).text()).get().join(" ")),
    bio,
    photo: img && !PLACEHOLDER.test(img) ? photoKey(img) : null,
    oldUrl: page.url
  };
}

// Inductees: the list gives name parts and year; each bio page adds the
// bio, Ed Barker flag and photo. Slug: name + year (the handoff's
// <name-year>), unique.
export function buildInductees(listPage, bioPages) {
  const bios = new Map(bioPages.map((p) => [pathOf(p.url)?.toLowerCase(), parseBio(p)]));
  const used = new Set();
  const problems = [];
  const tiles = parseInducteeList(listPage).filter((tile) => {
    // oatccc.com lists one empty placeholder tile; it is not a person.
    if (/^NONE SELECTED$/i.test(tile.name)) { problems.push(`Skipped a list entry named "${tile.name}" (${tile.oldUrl}): a blank placeholder on oatccc.com`); return false; }
    return true;
  });
  const rows = tiles.map((tile) => {
    const bio = bios.get(pathOf(tile.oldUrl)?.toLowerCase());
    if (!bio) problems.push(`No bio page crawled for ${tile.name} (${tile.oldUrl})`);
    else if (bio.year && tile.year && bio.year !== tile.year) problems.push(`${tile.name}: year ${tile.year} on the list, ${bio.year} on the bio page`);
    if (bio && bio.name && words(bio.name) !== tile.name) problems.push(`${tile.name}: shown as "${bio.name}" on the bio page`);
    const year = tile.year || bio?.year;
    let slug = slugify(`${tile.name} ${year}`);
    for (let n = 2; used.has(slug); n++) slug = slugify(`${tile.name} ${year} ${n}`);
    used.add(slug);
    return {
      slug,
      name: tile.name,
      sort_name: sortName(tile.first, tile.last, tile.name),
      induction_year: year,
      ed_barker_recipient: Boolean(tile.edBarker || bio?.edBarker),
      school: null,
      sport: null,
      bio: bio?.bio || "",
      photo_path: bio?.photo || tile.photo || null,
      old_url: tile.oldUrl
    };
  });
  return { rows, problems };
}

// Award pages. intro_html: the page's own words without the recipients
// (tiles, tables, cards) and without the search/filter controls.
const RECIPIENT_PARTS = ".js-filter-item, table, figure, article.post-news, .post-news-body, form, .resp-tabs-list";
export function awardIntro(page, kind = "") {
  // On card pages the h2s are the year headings of the recipients.
  const html = cleanMain(page, [], { extraRemove: kind === "cards" ? `${RECIPIENT_PARTS}, h2.js-leadership` : RECIPIENT_PARTS })
    .replace(/<p>\s*Reset Filter\s*<\/p>/gi, "")
    .replace(/^(?:\s*<hr>)+|(?:<hr>\s*)+$/g, "")
    .replace(/(?:<hr>\s*){2,}/g, "<hr>\n")
    .trim();
  return html.replace(/<[^>]+>/g, "").trim() ? html : "";
}

// Recipients, in page order. `kind` picks the layout oatccc.com uses.
export function parseAwardRecipients(page, kind) {
  const $ = cheerio.load(page.mainHtml);
  const rows = [];
  const yearOf = (label) => { const m = String(label).match(/\b(19|20)\d{2}\b/); return m ? Number(m[0]) : null; };
  if (kind === "tiles") {
    $(".js-filter-item").each((_, el) => {
      const $el = $(el);
      const name = words($el.find("h6").first().text());
      if (!name) return;
      const label = words($el.find("p strong").first().text());
      const link = $el.find("a[href*='View-Bio']").first().attr("href");
      const img = $el.find("img").first().attr("src");
      rows.push({ name, year: yearOf(label), year_label: label || null, school: null, details: null, photo_path: img && !PLACEHOLDER.test(img) ? photoKey(img) : null, old_url: link ? abs(link) : null });
    });
  } else if (kind === "table") {
    $("table").first().find("tr").each((i, tr) => {
      const cells = $(tr).find("td").map((_, td) => words($(td).text())).get();
      if (cells.length < 2) return;
      const [year, name, school, details] = cells;
      rows.push({ name, year: yearOf(year), year_label: year || null, school: school || null, details: details || null, photo_path: null, old_url: null });
    });
  } else if (kind === "cards") {
    // Coaches of the Year and the Middle School award: a heading per year,
    // then cards with a name (h6) and the lines below it (h5 / h6 em).
    $("h2").each((_, h2) => {
      const heading = words($(h2).text());
      const column = $(h2).parent();
      column.find(".post-news-body").each((__, body) => {
        const $b = $(body);
        const name = words($b.children("h6").first().text());
        if (!name) return;
        const lines = [];
        $b.find("h5, h6 em").each((___, el) => {
          const html = $(el).html() || "";
          for (const part of html.split(/<br\s*\/?>/i)) { const t = words(cheerio.load(`<i>${part}</i>`)("i").text()); if (t) lines.push(t); }
        });
        const card = $b.closest("[class*='cell-']");
        const img = card.find("img").first().attr("src");
        rows.push({ name, year: yearOf(heading), year_label: heading, school: null, details: lines.join(" / ") || null, photo_path: img && !PLACEHOLDER.test(img) ? photoKey(img) : null, old_url: null });
      });
    });
  }
  // The same blank "NONE SELECTED" placeholder as on the Hall of Fame list.
  return rows.filter((row) => !/^NONE SELECTED$/i.test(row.name)).map((row, i) => ({ ...row, position: i + 1 }));
}
