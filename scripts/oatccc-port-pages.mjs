// Copies the text of the oatccc.com pages in src/oatccc/more/registry.mjs,
// word for word, from the crawl (_private/oatccc-crawl/, made by
// scripts/oatccc-crawl.mjs) into src/oatccc/more/content/<key>.html.
//
// What changes, and nothing else:
//   - only the main content (no oatccc.com menus, footer, sponsor carousel
//     or page banner; our layout supplies those)
//   - only plain tags (headings, paragraphs, lists, tables, links, images,
//     bold/italic); classes, styles and scripts are dropped; buttons that
//     only run oatccc.com scripts (scroll, pop-ups) are dropped
//   - phone numbers are left off public pages (Zachary, 2026-11-17). Every
//     one left off is written to _private/oatccc-crawl/phones-left-off.json
//     for the report
//   - links and images stay as absolute oatccc.com addresses; the build
//     points them at our pages or the Storage bucket when those are on
//     (src/oatccc/more/links.mjs)
// Email addresses are kept exactly as they appear (Zachary, 2026-11-17).
//
//   node scripts/oatccc-port-pages.mjs [key ...]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanMain, loadPage as loadCrawlPage } from "../lib/oatccc_port.mjs";
import { MORE_PAGES } from "../src/oatccc/more/registry.mjs";
import { portPolls, portAcademic, portLeadership } from "./oatccc-port-special.mjs";

// Pages with their own layout (see oatccc-port-special.mjs).
const SPECIAL = { polls: portPolls, academic: portAcademic, leadership: portLeadership };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CRAWL = path.join(ROOT, "_private", "oatccc-crawl");
const OUT = path.join(ROOT, "src", "oatccc", "more", "content");
const ORIGIN = "https://www.oatccc.com";

const want = process.argv.slice(2);
const phones = [];
const missing = [];
fs.mkdirSync(OUT, { recursive: true });
for (const spec of MORE_PAGES) {
  if (want.length && !want.includes(spec.key)) continue;
  const parts = [];
  for (const old of spec.old) {
    const page = loadCrawlPage(old, CRAWL);
    if (!page) { missing.push({ key: spec.key, old }); continue; }
    // Some oatccc.com addresses just send people to the home page (the
    // Midwest Meet page today): nothing to copy.
    if (page.finalUrl && old !== "/" && new URL(page.finalUrl).pathname === "/") { missing.push({ key: spec.key, old, reason: "oatccc.com sends this address to its home page" }); continue; }
    const body = SPECIAL[spec.key] ? SPECIAL[spec.key](page).html.trim() : cleanMain(page, phones);
    // Two oatccc.com addresses can show the same page (/Sponsors/ and
    // /About-Us/Sponsors/): copy it once; both still redirect here.
    if (parts.some((part) => part.includes(`\n${body}\n</div>`))) { console.log(`${spec.key}: ${old} is the same page as one already copied`); continue; }
    parts.push(`<!-- from ${ORIGIN}${old} -->\n<div class="ox-moved" data-old="${old}">\n${body}\n</div>`);
  }
  if (!parts.length) continue;
  const header = `<!-- OATCCC page "${spec.key}" for ${spec.path}. Copied word for word from oatccc.com by scripts/oatccc-port-pages.mjs (phone numbers left off). Do not edit the wording. -->\n`;
  fs.writeFileSync(path.join(OUT, `${spec.key}.html`), header + parts.join("\n") + "\n");
  console.log(`${spec.key}: ${parts.length} source page(s)`);
}
const phoneFile = path.join(CRAWL, "phones-left-off.json");
const previous = want.length && fs.existsSync(phoneFile) ? JSON.parse(fs.readFileSync(phoneFile, "utf8")).filter((p) => !phones.some((n) => n.page === p.page)) : [];
fs.writeFileSync(phoneFile, JSON.stringify([...previous, ...phones], null, 1));
console.log(`Phone numbers left off: ${phones.length}. Missing source pages: ${JSON.stringify(missing)}`);
