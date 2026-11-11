import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SUPPORT_PLACEMENTS, supportCardHtml, supportConfig, supportDestination, supportGoHref, supportSection } from "../src/lib/support_card.mjs";
import { supportPage } from "../src/pages/support.mjs";
import { site } from "../src/config/site.mjs";
import sponsors from "../src/data/sponsors.json" with { type: "json" };

const STRIPE = { one_time_url: "https://buy.stripe.com/test_abc123", monthly_url: "https://buy.stripe.com/test_month9" };

test("support: never called a donation, and says it is not tax-deductible", () => {
  const html = supportPage(site) + supportCardHtml({ placement: "athlete" }) + supportCardHtml({ placement: "after-vote", large: true });
  assert.doesNotMatch(html, /donat/i);
  assert.match(html, /Podium Watch is a small Ohio business\. Support is not tax-deductible\./);
  assert.equal(supportConfig.note, "Podium Watch is a small Ohio business. Support is not tax-deductible.");
});

test("support page: no made-up numbers in the copy", () => {
  const text = supportPage(site).replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
  const main = text.slice(text.indexOf("Keep Ohio running coverage free."), text.indexOf("Other ways to help"));
  assert.doesNotMatch(main, /\d/, "the support copy carries no figures");
});

test("support links: every button is counted at /go/support/{placement}/", () => {
  assert.equal(supportGoHref("athlete", { from: "/athletes/x/" }), "/go/support/athlete/?from=%2Fathletes%2Fx%2F");
  assert.equal(supportGoHref("support-page", { kind: "monthly" }), "/go/support/support-page/?m=monthly");
  assert.match(supportCardHtml({ placement: "banquet", from: "/teams/x/banquet/2026/" }), /href="\/go\/support\/banquet\/\?from=/);
  const entry = sponsors.find((s) => s.id === "support");
  assert.ok(entry, "support is in src/data/sponsors.json");
  assert.deepEqual(entry.placements.map((p) => p.id).sort(), [...SUPPORT_PLACEMENTS].sort());
  for (const id of SUPPORT_PLACEMENTS) assert.match(id, /^[a-z0-9-]{1,80}$/, "fits site_sponsor_clicks.placement_id");
});

test("support destination: the Stripe link, monthly when asked, /support/ when no link is set", () => {
  assert.equal(supportDestination("", STRIPE), STRIPE.one_time_url);
  assert.equal(supportDestination("monthly", STRIPE), STRIPE.monthly_url);
  assert.equal(supportDestination("monthly", { one_time_url: STRIPE.one_time_url, monthly_url: "" }), STRIPE.one_time_url);
  assert.equal(supportDestination("", { one_time_url: "", monthly_url: "" }), "https://www.podiumwatch.org/support/");
  assert.equal(supportDestination("", { one_time_url: "https://evil.example/pay", monthly_url: "" }), "https://www.podiumwatch.org/support/", "only Stripe links");
});

test("support card: placed on the awards hub and after a vote (taking turns with the shop), Banquet Pack, Wrapped, athlete pages", () => {
  const awards = fs.readFileSync("src/pages/yearlyawards2026.mjs", "utf8");
  assert.match(awards, /data-pw-alt="merch"/);
  assert.match(awards, /data-pw-alt="support" hidden/);
  assert.match(awards, /data-pws-after hidden/);
  assert.ok(awards.indexOf("supportScripts()") < awards.indexOf("merchScripts()", awards.indexOf("supportScripts()") - 200), "support-card.js loads before merch-card.js");
  assert.match(fs.readFileSync("lib/render/athlete_page.mjs", "utf8"), /supportSection\(\{ placement: "athlete"/);
  assert.match(fs.readFileSync("lib/render/banquet_page.mjs", "utf8"), /supportSection\(\{ placement: "banquet"/);
  assert.match(fs.readFileSync("lib/render/wrapped_page.mjs", "utf8"), /supportCardHtml\(\{ placement: "wrapped"/);
  const merch = fs.readFileSync("public/scripts/merch-card.js", "utf8");
  assert.match(merch, /data-pw-alt-off/, "the shop card stays hidden when it's support's turn");
  assert.match(supportSection({ placement: "athlete" }), /@media print \{ \.pws, \.pws-section \{ display: none/);
});

test("footer: a Support Podium Watch link on every page", () => {
  assert.match(fs.readFileSync("src/lib/html.mjs", "utf8"), /<a class="footer-support" href="\/support\/">Support Podium Watch<\/a>/);
});

test("Stripe: the one-time link is set, no monthly link, and the page button goes through /go/support/", () => {
  assert.equal(supportConfig.one_time_url, "https://buy.stripe.com/6oU8wP5xf9c75uJaKG28801");
  assert.equal(supportConfig.monthly_url, "");
  assert.equal(supportDestination(""), "https://buy.stripe.com/6oU8wP5xf9c75uJaKG28801");
  assert.equal(supportDestination("monthly"), "https://buy.stripe.com/6oU8wP5xf9c75uJaKG28801");
  const page = supportPage(site);
  assert.ok(page.includes('href="/go/support/support-page/" target="_blank" rel="noopener">Support Podium Watch</a>'), "one button, straight to Stripe through /go/support/");
  assert.doesNotMatch(page, /Support monthly|coming soon/);
});

test("logos: white arch on the /support/ hero, black arch on the card, files saved locally", () => {
  assert.ok(supportPage(site).includes('<img class="sp-logo" src="/images/branding/support-pw-arch-white.webp"'));
  assert.ok(supportCardHtml({ placement: "athlete" }).includes('<img class="pws-logo" src="/images/branding/support-pw-arch-black.webp"'));
  for (const name of ["black", "white"]) assert.ok(fs.existsSync(`public/images/branding/support-pw-arch-${name}.webp`), name);
});

test("after-vote panel: exact copy, black logo, /go/support/after-vote-panel/, once per browser, not a modal", async () => {
  const { supportPanelHtml, SUPPORT_PANEL_COPY } = await import("../src/lib/support_card.mjs");
  const html = supportPanelHtml({ from: "/awards/2026/athlete-boys-d1/" });
  assert.equal(SUPPORT_PANEL_COPY.title, "Support Podium Watch");
  assert.equal(SUPPORT_PANEL_COPY.body, "If you've enjoyed our coverage of Ohio cross country and track runners, consider a one-time contribution. We truly appreciate your support and want to keep Podium Watch the best Ohio XC and track coverage in the state.");
  assert.equal(SUPPORT_PANEL_COPY.small, "Not tax-deductible.");
  assert.ok(html.includes("If you&#39;ve enjoyed our coverage of Ohio cross country and track runners"));
  assert.ok(html.includes('href="/go/support/after-vote-panel/?from=%2Fawards%2F2026%2Fathlete-boys-d1%2F" target="_blank" rel="noopener">Support Podium Watch</a>'));
  assert.ok(html.includes('src="/images/branding/support-pw-arch-black.webp"'));
  assert.ok(html.includes('aria-label="Close">✕</button>'));
  assert.ok(html.includes(" hidden>"), "hidden until the first vote");
  assert.doesNotMatch(html, /role="dialog"|aria-modal/);
  const js = fs.readFileSync("public/scripts/support-card.js", "utf8");
  assert.ok(js.includes('"podium_support_panel_seen"'));
  assert.ok(js.includes("localStorage.setItem(PANEL_KEY"));
  const page = fs.readFileSync("src/pages/yearlyawards2026.mjs", "utf8");
  assert.ok(page.indexOf("data-yoy-vote-message") < page.indexOf("supportPanelHtml({ from: pathname })"), "under the vote message");
  assert.ok(page.indexOf("supportPanelHtml({ from: pathname })") < page.indexOf("data-pwm-after hidden"), "above the after-vote cards");
});

test("after a vote: the merch card every time until voting closes, then the support rule again (2026-11-11)", async () => {
  const { YEARLY_AWARDS_SCHEDULE } = await import("../lib/yearly_awards_2026.mjs");
  const script = fs.readFileSync("public/scripts/support-card.js", "utf8");
  const until = script.match(/MERCH_EVERY_VOTE_UNTIL = Date\.parse\("([^"]+)"\)/)?.[1];
  assert.equal(Date.parse(until), Date.parse(YEARLY_AWARDS_SCHEDULE.voting_close_at), "switches back exactly when voting closes");
  assert.equal(new Date(until).toLocaleString("en-US", { timeZone: "America/New_York" }), "11/13/2026, 9:00:00 PM");
  assert.ok(script.indexOf("MERCH_EVERY_VOTE_UNTIL &&") < script.indexOf("if (panelTurn())"), "checked before the first-vote panel");
});
