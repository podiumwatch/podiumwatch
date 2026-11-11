import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { contrastRatio, defaultProductId, merchCardHtml, merchClientData, merchConfig, merchSection, merchTint, unavailableNote } from "../src/lib/merch_card.mjs";
import { merchDestination } from "../lib/merch_service.mjs";
import sponsors from "../src/data/sponsors.json" with { type: "json" };

test("merch data: 3 products, 4 colors each, every photo saved locally", () => {
  assert.deepEqual(merchConfig.products.map((p) => p.tab), ["XC Crewneck", "Track Crewneck", "Track Tee"]);
  for (const product of merchConfig.products) {
    assert.equal(product.colors.length, 4, product.id);
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
  assert.match(html, /\$34\.63 · Sizes S–3XL · Printed when you order and shipped to you/);
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
