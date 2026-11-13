// Site fixes round 1 (2026-11-13): internal notes and file paths never
// reach a public page. Scans the built HTML in dist/ (run after the build;
// npm test builds first) and renders the server-side sponsors page.
// Admin pages are behind sign-in and are not public, so they are skipped.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { sponsorsPageHtml } from "../src/pages/sponsors.mjs";
import { loadSiteSponsors } from "../lib/site_sponsors.mjs";
import { site } from "../src/config/site.mjs";

// File paths and internal notes (A1).
export const INTERNAL_PATTERNS = [/\bsrc\//, /\.json\b/, /\.mjs\b/, /\bno paths\b/i];

// Visible text plus attribute values that are read out or shown (alt,
// title, aria-label, placeholder, content); scripts, styles and URLs are
// not reader text.
export function publicText(html) {
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  const attrs = [...stripped.matchAll(/\s(?:alt|title|aria-label|placeholder|content)="([^"]*)"/gi)].map((m) => m[1]);
  return stripped.replace(/<[^>]+>/g, " ") + " " + attrs.join(" ");
}

function builtPublicPages() {
  const dist = path.resolve("dist");
  if (!fs.existsSync(dist)) return null;
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : entry.name.endsWith(".html") ? [path.join(dir, entry.name)] : []));
  return walk(dist).filter((file) => !path.relative(dist, file).split(path.sep).includes("admin"));
}

test("no file path or internal note in any public built page", (t) => {
  const pages = builtPublicPages();
  if (!pages) return t.skip("dist/ not built");
  assert.ok(pages.length > 100, "the build has its public pages");
  const hits = [];
  for (const file of pages) {
    const text = publicText(fs.readFileSync(file, "utf8"));
    for (const pattern of INTERNAL_PATTERNS) {
      const match = text.match(new RegExp(`.{0,50}${pattern.source}.{0,30}`, pattern.flags));
      if (match) hits.push(`${path.relative("dist", file)}: ${match[0].replace(/\s+/g, " ").trim()}`);
    }
  }
  assert.deepEqual(hits, []);
});

// Internal wording shown to the public (section B). "Coming soon" is
// matched with its capital C, as listed in the handoff.
export const INTERNAL_WORDING = [/ranking file/i, /athlete foundation/i, /percent complete/i, /supplied OHSAA/i, /Coming soon/, /content\/rankings/i];

test("no internal wording in any public built page", (t) => {
  const pages = builtPublicPages();
  if (!pages) return t.skip("dist/ not built");
  const hits = [];
  for (const file of pages) {
    const text = publicText(fs.readFileSync(file, "utf8"));
    for (const pattern of INTERNAL_WORDING) {
      const match = text.match(new RegExp(`.{0,50}${pattern.source}.{0,30}`, pattern.flags));
      if (match) hits.push(`${path.relative("dist", file)}: ${match[0].replace(/\s+/g, " ").trim()}`);
    }
  }
  assert.deepEqual(hits, []);
});

test("no internal wording sent to the public by browser scripts or the athletes API", () => {
  const scripts = fs.readdirSync("public/scripts").filter((name) => name.endsWith(".js") && !name.startsWith("admin-")).map((name) => `public/scripts/${name}`);
  const hits = [];
  for (const file of [...scripts, "api/athletes/index.js"]) {
    const code = fs.readFileSync(file, "utf8").replace(/^\s*\/\/.*$/gm, "");
    for (const pattern of INTERNAL_WORDING) if (pattern.test(code)) hits.push(`${file}: ${pattern.source}`);
  }
  assert.deepEqual(hits, []);
});

test("sponsors page lists only real partners and no internal notes", () => {
  const sponsors = loadSiteSponsors();
  const html = sponsorsPageHtml(site, sponsors, { audience: { available: false }, instagram: null, packages: [] });
  const partners = [...html.matchAll(/<article class="pt-partner"><h3>([^<]*)<\/h3>/g)].map((m) => m[1]);
  const real = sponsors.filter((sponsor) => !sponsor.house).map((sponsor) => sponsor.name.replace(/'/g, "&#039;"));
  assert.deepEqual(partners, real);
  assert.ok(partners.length >= 1);
  for (const sponsor of sponsors.filter((item) => item.house)) {
    assert.ok(!html.includes(`<h3>${sponsor.name}</h3>`), `${sponsor.name} is not listed as a partner`);
    assert.ok(!sponsor.description, `${sponsor.id} keeps its note in internal_note, not description`);
    if (sponsor.internal_note) assert.ok(!html.includes(sponsor.internal_note.slice(0, 40)), `${sponsor.id} internal note not rendered`);
  }
  const text = publicText(html);
  for (const pattern of INTERNAL_PATTERNS) assert.doesNotMatch(text, pattern);
});

test("the partner form's honeypot is hidden from sighted users and screen readers", () => {
  const html = sponsorsPageHtml(site, loadSiteSponsors(), { audience: { available: false }, instagram: null, packages: [] });
  const wrap = html.match(/<div([^>]*)><label>Leave this blank <input([^>]*)><\/label><\/div>/);
  assert.ok(wrap, "honeypot present");
  assert.match(wrap[1], /aria-hidden="true"/);
  assert.match(wrap[1], /left:-9999px/);
  assert.match(wrap[2], /tabindex="-1"/);
});
