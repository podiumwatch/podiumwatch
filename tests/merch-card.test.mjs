import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { contrastRatio, defaultProductId, fromPrice, merchCardHtml, merchClientData, merchConfig, merchLine, merchSection, merchSeason, merchSetFor, merchSets, merchTint, unavailableNote } from "../src/lib/merch_card.mjs";
import { merchDestination } from "../lib/merch_service.mjs";
import sponsors from "../src/data/sponsors.json" with { type: "json" };

test("merch data: the 3 arch products plus the 10 parent-line products, every photo saved locally", () => {
  assert.deepEqual(merchConfig.products.map((p) => p.id), [
    "ohio-xc-arch-crewneck", "ohio-tf-arch-crewneck", "ohio-tf-arch-tee",
    "ohio-xc-mom-crewneck", "ohio-xc-mom-tee", "ohio-xc-dad-crewneck", "ohio-xc-dad-tee",
    "ohio-tf-mom-crewneck", "ohio-tf-mom-tee", "ohio-tf-dad-crewneck", "ohio-tf-dad-tee",
    "ohio-xc-arch-sticker", "ohio-xc-arch-mug"
  ]);
  for (const product of merchConfig.products) {
    assert.ok(product.colors.length >= 1, product.id);
    assert.ok(["arch", "mom", "dad", "extra"].includes(product.line), product.id);
    for (const color of product.colors) {
      assert.match(color.image, /^\/images\/merch\/[a-z0-9-]+\.webp$/);
      assert.ok(fs.existsSync(`public${color.image}`), `missing ${color.image}`);
      assert.match(color.url, /^https:\/\/app\.amazecommerce\.com\/shop\/podiumwatch\/[a-z0-9-]+\?variant=[0-9a-f-]{36}$/);
    }
  }
});

test("merch card: never loads a store-hosted image", () => {
  const html = merchCardHtml({ placement: "story-end" }) + JSON.stringify(merchClientData());
  assert.doesNotMatch(html, /supabase\.co|amazecommerce\.com\/.*\.webp/);
});

test("merch tint: every color reads at 4.5:1 or better", () => {
  for (const product of merchConfig.products) for (const color of product.colors) {
    const { bg, bg2, fg } = merchTint(color.hex);
    assert.ok(Math.min(contrastRatio(fg, bg), contrastRatio(fg, bg2)) >= 4.5, `${product.id} ${color.name}`);
    assert.ok(contrastRatio("#ffffff", fg) >= 4.5, "button and selected tab text");
  }
});

test("merch default tab: XC Crewneck through Dec. 31 (Eastern), then Track Crewneck", () => {
  assert.equal(defaultProductId(new Date("2026-11-11T15:00:00Z")), "ohio-xc-arch-crewneck");
  assert.equal(defaultProductId(new Date("2027-01-01T04:30:00Z")), "ohio-xc-arch-crewneck", "11:30 PM Dec. 31 in Ohio");
  assert.equal(defaultProductId(new Date("2027-01-01T05:30:00Z")), "ohio-tf-arch-crewneck");
});

test("merch card: tabs, 4 swatches with names, price line, Maroon 3XL note, after-vote headline", () => {
  const html = merchCardHtml({ placement: "vote-page", now: new Date("2026-11-11T15:00:00Z") });
  assert.equal((html.match(/role="tab"/g) || []).length, 3);
  assert.equal((html.match(/class="pwm-swatch"/g) || []).length, 4);
  assert.match(html, /aria-label="Forest Green"/);
  assert.match(html, /Ohio Cross Country Arch Crewneck/);
  assert.match(html, /From \$34\.63 · Sizes S–3XL · Printed when you order and shipped to you/);
  assert.match(html, /Shop the crewneck/);
  assert.match(html, /PODIUM WATCH SHOP/);
  assert.equal(unavailableNote(merchConfig.products[0], "Maroon"), "3XL not available in Maroon");
  assert.equal(unavailableNote(merchConfig.products[0], "Black"), "");
  assert.match(merchCardHtml({ placement: "after-vote", large: true }), /Vote counted\. Now rep Ohio XC\./);
  assert.match(merchSection({ placement: "story-end", from: "/stories/x/" }), /data-pwm-placement="story-end"/);
});

test("merch links: the color's own store link with UTM tags; awards keep the awards campaign", () => {
  const forest = new URL(merchDestination("ohio-xc-arch-crewneck", "forest-green", "vote-page"));
  assert.equal(forest.pathname, "/shop/podiumwatch/ohio-cross-country-arch-crewneck");
  assert.match(forest.searchParams.get("variant"), /^c847d502-/);
  assert.equal(forest.searchParams.get("utm_medium"), "awards");
  assert.equal(forest.searchParams.get("utm_campaign"), "awards2026");
  assert.equal(forest.searchParams.get("utm_content"), "vote-page-ohio-xc-arch-crewneck-forest-green");
  const story = new URL(merchDestination("ohio-tf-arch-tee", "true-royal", "story-end"));
  assert.equal(story.searchParams.get("utm_source"), "podiumwatch");
  assert.equal(story.searchParams.get("utm_medium"), "site");
  assert.equal(story.searchParams.get("utm_campaign"), "merch");
  assert.equal(story.searchParams.get("utm_content"), "story-end-ohio-tf-arch-tee-true-royal");
  assert.equal(new URL(merchDestination("", "", "nav")).pathname, "/shop/podiumwatch");
  const placements = sponsors.find((s) => s.id === "merch").placements.map((p) => p.id);
  for (const id of ["vote-page", "ballot", "after-vote", "story-end", "results-end", "rankings-end", "wrapped", "nav"]) assert.ok(placements.includes(id), id);
});

test("parent lines: exact titles, prices, sizes, colors and links from the store export (2026-11-11)", () => {
  const byId = Object.fromEntries(merchConfig.products.map((p) => [p.id, p]));
  assert.equal(byId["ohio-xc-mom-crewneck"].title, "Ohio XC Mom Crewneck");
  assert.deepEqual(byId["ohio-xc-mom-crewneck"].price, { "S-XL": "$34.63", "2XL": "$37.13", "3XL": "$39.64" });
  assert.deepEqual(byId["ohio-xc-mom-crewneck"].colors.map((c) => [c.name, c.hex]), [["Sand", "#e7d3b3"], ["Light Pink", "#f3d4e3"], ["Ash", "#ededed"], ["White", "#ffffff"]]);
  assert.equal(byId["ohio-tf-dad-tee"].title, "Ohio Track Dad Tee");
  assert.equal(byId["ohio-tf-dad-tee"].colors[2].url, "https://app.amazecommerce.com/shop/podiumwatch/ohio-track-dad-tee?variant=71ed75e7-e897-4c15-ab81-36ca9b0a2101");
  assert.equal(byId["ohio-xc-arch-sticker"].price["S-XL"], "$9.43 (5″×5″ only)");
  assert.deepEqual(byId["ohio-xc-arch-mug"].sizes, ["11 oz"]);
});

test("prices read From the S-XL price, never rounded", () => {
  const byId = Object.fromEntries(merchConfig.products.map((p) => [p.id, p]));
  assert.equal(fromPrice(byId["ohio-xc-dad-tee"]), "From $29.35");
  assert.equal(fromPrice(byId["ohio-xc-arch-sticker"]), "From $9.43");
  assert.equal(merchLine(byId["ohio-xc-arch-mug"]), "From $18.57 · Size 11 oz · Printed when you order and shipped to you");
});

test("sets: Mom on girls award pages, Dad on boys, a rotating mix elsewhere; XC lines until Dec. 31, then Track", () => {
  const nov = new Date("2026-11-11T15:00:00Z");
  const feb = new Date("2027-02-01T15:00:00Z");
  assert.equal(merchSeason(nov), "xc");
  assert.equal(merchSeason(feb), "tf");
  assert.deepEqual(merchSetFor("girls", { now: nov }), ["ohio-xc-arch-crewneck", "ohio-xc-mom-crewneck", "ohio-xc-mom-tee"]);
  assert.deepEqual(merchSetFor("boys", { now: nov }), ["ohio-xc-arch-crewneck", "ohio-xc-dad-crewneck", "ohio-xc-dad-tee"]);
  assert.deepEqual(merchSetFor("girls", { now: feb }), ["ohio-tf-arch-crewneck", "ohio-tf-mom-crewneck", "ohio-tf-mom-tee"]);
  const mix = merchSets("xc").mix;
  assert.equal(mix.length, 3);
  const shown = new Set(mix.flat());
  for (const id of ["ohio-xc-mom-crewneck", "ohio-xc-dad-crewneck", "ohio-xc-mom-tee", "ohio-xc-dad-tee", "ohio-xc-arch-sticker", "ohio-xc-arch-mug", "ohio-tf-arch-tee", "ohio-xc-arch-crewneck"]) assert.ok(shown.has(id), id);
  assert.deepEqual(merchSetFor("mix", { now: nov, turn: 1 }), mix[1]);
  for (const set of mix) assert.equal(set.length, 3);
  assert.match(merchCardHtml({ placement: "ballot", audience: "girls", now: nov }), /data-pwm-aud="girls"[\s\S]*Mom Crewneck/);
  assert.match(fs.readFileSync("src/pages/yearlyawards2026.mjs", "utf8"), /placement: "ballot", from: pathname, audience: category\.gender/);
  assert.deepEqual(merchClientData().s.xc.boys, merchSets("xc").boys);
});

test("swatches still link each color's own store link through /go/merch/", () => {
  const link = new URL(merchDestination("ohio-xc-mom-crewneck", "light-pink", "story-end"));
  assert.equal(link.origin + link.pathname, "https://app.amazecommerce.com/shop/podiumwatch/ohio-xc-mom-crewneck");
  assert.equal(link.searchParams.get("variant"), "aa3de4ca-c6bd-4b46-bc83-42cc7dfd0727");
  assert.equal(link.searchParams.get("utm_content"), "story-end-ohio-xc-mom-crewneck-light-pink");
  assert.ok(fs.readFileSync("public/scripts/merch-card.js", "utf8").includes("/go/merch/" + "$" + "{encodeURIComponent(placement)}/"));
});
