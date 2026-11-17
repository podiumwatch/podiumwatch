// Special layouts for scripts/oatccc-port-pages.mjs (Zachary's handoff,
// 2026-11-17):
//   Coaches' Polls: Google Sheets stay as links; old PDFs as a year table.
//   Academic All-Ohio: the archive as a year table.
// The OATCCC's own words are kept (labels, headings, rules); only the
// layout changes from oatccc.com's tabs and icon tiles to tables.
import * as cheerio from "cheerio";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const words = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const absolute = (href, base) => { try { return new URL(href, base).href; } catch { return href; } };

// Coaches' Polls: oatccc.com shows one vertical tab per year. Years with
// Google Sheets list them under "Girls Coaches Poll" / "Boys Coaches Poll";
// older years list one PDF per poll.
export function portPolls(page) {
  const $ = cheerio.load(page.mainHtml);
  const base = page.finalUrl || page.url;
  const years = $(".resp-tabs-list li").map((_, li) => words($(li).text())).get();
  const panes = $(".resp-tabs-container").first().children("div").get();
  const sheetYears = [];
  const pdfYears = [];
  let intro = "";
  panes.forEach((pane, i) => {
    const year = years[i] || "";
    const $pane = $(pane);
    const groups = [];
    $pane.find("h5").each((_, h) => {
      const label = words($(h).text());
      if (/^Click on the desired poll/i.test(label)) { intro = intro || label; return; }
      const links = $(h).parent().find("a[href]").map((__, a) => ({ text: words($(a).text()), href: absolute($(a).attr("href"), base) })).get();
      if (links.length && /Coaches Poll$/i.test(label)) groups.push({ label, links });
    });
    if (groups.length) { sheetYears.push({ year, groups }); return; }
    const pdfs = $pane.find("a[href]").map((_, a) => ({ text: words($(a).find("h5").text() || $(a).text()), href: absolute($(a).attr("href"), base) })).get().filter((l) => l.text);
    if (pdfs.length) pdfYears.push({ year, pdfs });
  });
  const heading = words($("h2").first().text()) || "Poll Results";
  const linkList = (links) => `<ul class="ox-linklist">${links.map((l) => `<li><a href="${esc(l.href)}">${esc(l.text)}</a></li>`).join("")}</ul>`;
  const groupLabels = [...new Set(sheetYears.flatMap((y) => y.groups.map((g) => g.label)))];
  let html = `<h2>${esc(heading)}</h2>\n`;
  if (sheetYears.length) {
    html += `${intro ? `<p>${esc(intro)}</p>\n` : ""}<table class="ox-yeartable">\n<thead><tr><th scope="col">Year</th>${groupLabels.map((g) => `<th scope="col">${esc(g)}</th>`).join("")}</tr></thead>\n<tbody>\n`;
    html += sheetYears.map((y) => `<tr><th scope="row">${esc(y.year)}</th>${groupLabels.map((g) => { const group = y.groups.find((x) => x.label === g); return `<td>${group ? linkList(group.links) : ""}</td>`; }).join("")}</tr>`).join("\n");
    html += `\n</tbody>\n</table>\n`;
  }
  if (pdfYears.length) {
    html += `<h3>Earlier polls</h3>\n<table class="ox-yeartable">\n<thead><tr><th scope="col">Year</th><th scope="col">Polls</th></tr></thead>\n<tbody>\n`;
    html += pdfYears.map((y) => `<tr><th scope="row">${esc(y.year)}</th><td>${linkList(y.pdfs)}</td></tr>`).join("\n");
    html += `\n</tbody>\n</table>\n`;
  }
  return { html, years, sheetYears: sheetYears.map((y) => y.year), pdfYears: pdfYears.map((y) => y.year) };
}

// Academic All-Ohio: two columns (Cross Country, Track & Field), each with
// its rules and one tile per file ("2024 Girls", "2020", "Yearly Totals").
export function portAcademic(page) {
  const $ = cheerio.load(page.mainHtml);
  const base = page.finalUrl || page.url;
  let html = "";
  const notes = [];
  $("h2").each((_, h2) => {
    const title = words($(h2).text());
    const col = $(h2).parent();
    const rules = col.find("ul").first().find("li").map((__, li) => words($(li).text())).get();
    const tiles = col.find("h5").map((__, h5) => {
      const a = $(h5).closest("a");
      return { label: words($(h5).text()), href: a.length ? absolute(a.attr("href"), base) : null };
    }).get();
    const other = tiles.filter((t) => !/^\d{4}\b/.test(t.label));
    const byYear = new Map();
    for (const t of tiles.filter((t) => /^\d{4}\b/.test(t.label))) {
      const year = t.label.slice(0, 4);
      byYear.set(year, [...(byYear.get(year) || []), t]);
    }
    const cell = (t) => (t.href ? `<a href="${esc(t.href)}">${esc(t.label)}</a>` : `${esc(t.label)} <span class="ox-nofile">(no file posted on oatccc.com)</span>`);
    for (const t of tiles) if (!t.href) notes.push(`${title}: "${t.label}" has no file on oatccc.com`);
    html += `<h2>${esc(title)}</h2>\n<ul>${rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>\n`;
    if (other.length) html += `<p>${other.map(cell).join(" ")}</p>\n`;
    html += `<table class="ox-yeartable">\n<thead><tr><th scope="col">Year</th><th scope="col">Files</th></tr></thead>\n<tbody>\n`;
    html += [...byYear.entries()].map(([year, list]) => `<tr><th scope="row">${esc(year)}</th><td><ul class="ox-linklist">${list.map((t) => `<li>${cell(t)}</li>`).join("")}</ul></td></tr>`).join("\n");
    html += `\n</tbody>\n</table>\n`;
  });
  return { html, notes };
}
