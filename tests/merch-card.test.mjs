import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { cardProducts, contrastRatio, defaultColorIndex, isLightGarment, merchCardHtml, merchClientData, merchConfig, merchLine, merchSection, merchTint, orderedSizes } from "../src/lib/merch_card.mjs";
import { merchDestination } from "../lib/merch_service.mjs";

// Merch card v2, "The Podium Collection" (MERCH_CARD_HANDOFF, 2026-11-11).

test("merch data: merch.json is the supplied store export, 7 products, 4 on the card in order", () => {
  const raw = JSON.parse(fs.readFileSync("src/data/merch.json", "utf8"));
  assert.deepEqual(Object.keys(raw), ["as_of", "products", "card_products", "default_product", "default_color"], "saved as supplied, no settings mixed in");
  assert.equal(raw.products.length, 7);
  assert.deepEqual(cardProducts().map((p) => p.tab), ["PODIUM Varsity", "PODIUM Outline", "RUN OHIO Tee", "XC Mom"]);
  assert.deepEqual(cardProducts().map((p) => p.colors.length), [4, 3, 3, 4]);
});

test("merch data: every card photo is saved locally under /images/merch/", () => {
  for (const product of cardProducts()) for (const color of product.colors) {
    assert.match(color.image, /^\/images\/merch\/[a-z0-9-]+\.webp$/);
    assert.ok(fs.existsSync(`public${color.image}`), `missing ${color.image}`);
  }
});

test("merch card: never loads a store-hosted image", () => {
  const html = merchCardHtml({ placement: "ballot" }) + JSON.stringify(merchClientData());
  assert.doesNotMatch(html, /supabase\.co|amazecommerce\.com\/[^"]*\.webp/);
});

test("merch tint: every card color's text reads at 4.5:1 or better on both ends of the tint", () => {
  for (const product of cardProducts()) for (const color of product.colors) {
    const { bg, bg2, fg } = merchTint(color.hex);
    assert.ok(contrastRatio(fg, bg) >= 4.5 && contrastRatio(fg, bg2) >= 4.5, `${product.id} ${color.name}`);
  }
});

test("light garments (Ivory, White, Ash, Sand) get an outlined photo; dark ones don't", () => {
  const all = Object.fromEntries(cardProducts().flatMap((p) => p.colors.map((c) => [`${p.id}:${c.name}`, isLightGarment(c.hex)])));
  for (const key of ["run-ohio-tee:Ivory", "ohio-xc-mom-crewneck:White", "ohio-xc-mom-crewneck:Ash", "podium-varsity-outline-crewneck:Ash", "podium-varsity-outline-crewneck:Sand", "ohio-xc-mom-crewneck:Sand"]) assert.equal(all[key], true, key);
  for (const key of ["podium-varsity-crewneck:Forest Green", "podium-varsity-crewneck:Navy", "run-ohio-tee:Grey"]) assert.equal(all[key], false, key);
});

test("merch card: opens on PODIUM Varsity in Forest Green with the handoff copy", () => {
  const html = merchCardHtml({ placement: "ballot", from: "/awards/2026/athlete-boys-d1/" });
  assert.match(html, /aria-selected="true"[^>]*>PODIUM Varsity</);
  assert.match(html, />THE PODIUM COLLECTION</);
  assert.match(html, />NEW MERCH\. JUST DROPPED\.</);
  assert.match(html, />PODIUM Varsity Crewneck</);
  assert.match(html, />\$34\.63 · Sizes S–3XL</);
  assert.match(html, />Color: Forest Green</);
  assert.match(html, />Shop the collection</);
  assert.match(html, /aria-label="Forest Green" aria-checked="true"/);
  assert.equal((html.match(/class="pwm-swatch"/g) || []).length, 4);
  assert.equal((html.match(/role="tab"/g) || []).length, 4);
  assert.match(html, /href="\/go\/merch\/ballot\/\?p=podium-varsity-crewneck&amp;c=forest-green&amp;from=%2Fawards%2F2026%2Fathlete-boys-d1%2F"/);
});

test("after-vote card swaps the headline only", () => {
  const html = merchCardHtml({ placement: "after-vote", large: true });
  assert.match(html, />Vote counted\. New merch just dropped\.</);
  assert.match(html, />PODIUM Varsity Crewneck</);
});

test("each tab opens on its default color; XC Mom has its own eyebrow", () => {
  const data = merchClientData();
  const byId = Object.fromEntries(data.p.map((p) => [p.id, p]));
  assert.equal(byId["podium-varsity-outline-crewneck"].c[byId["podium-varsity-outline-crewneck"].dc][0], "Sport Grey");
  assert.equal(byId["run-ohio-tee"].c[byId["run-ohio-tee"].dc][0], "Ivory");
  assert.equal(byId["ohio-xc-mom-crewneck"].c[byId["ohio-xc-mom-crewneck"].dc][0], "Light Pink");
  assert.equal(byId["ohio-xc-mom-crewneck"].e, "PODIUM WATCH SHOP");
  assert.equal(byId["run-ohio-tee"].e, "THE PODIUM COLLECTION");
  assert.equal(data.p[data.dp].id, "podium-varsity-crewneck");
  assert.equal(defaultColorIndex(cardProducts()[0]), 0);
});

test("price line: the S-XL price exactly as listed, sizes smallest to largest", () => {
  assert.deepEqual(orderedSizes(["S", "XL", "M", "3XL", "L", "2XL"]), ["S", "M", "L", "XL", "2XL", "3XL"]);
  const tee = cardProducts().find((p) => p.id === "run-ohio-tee");
  assert.equal(merchLine(tee), "$29.35 · Sizes S–3XL");
});

test("merch links: Forest Green PODIUM Varsity opens its own variant with the podium-collection UTM tags", () => {
  const url = new URL(merchDestination("podium-varsity-crewneck", "forest-green", "after-vote"));
  assert.equal(url.origin + url.pathname, "https://app.amazecommerce.com/shop/podiumwatch/podium-varsity-crewneck");
  assert.equal(url.searchParams.get("variant"), "8997415d-1acf-4aed-9d21-630745e84036");
  assert.equal(url.searchParams.get("utm_source"), "podiumwatch");
  assert.equal(url.searchParams.get("utm_medium"), "site");
  assert.equal(url.searchParams.get("utm_campaign"), "podium-collection");
  assert.equal(url.searchParams.get("utm_content"), "after-vote-podium-varsity-crewneck-forest-green");
  const nav = new URL(merchDestination("", "", "nav"));
  assert.equal(nav.origin + nav.pathname, merchConfig.store_url);
  assert.equal(nav.searchParams.get("utm_content"), "nav");
});

test("placements: ballot card below the vote button, none above the ballot, homepage strip at the bottom", () => {
  const page = fs.readFileSync("src/pages/yearlyawards2026.mjs", "utf8");
  const ballot = page.slice(page.indexOf('id="vote"'), page.indexOf("data-yoy-closed"));
  assert.ok(ballot.indexOf("data-yoy-cast") < ballot.indexOf("data-yoy-ballot-shop"), "ballot card comes after the vote button");
  assert.ok(ballot.indexOf("data-yoy-vote-message") < ballot.indexOf("data-pwm-after"), "after-vote card sits under the confirmation");
  const beforeBallot = page.slice(page.indexOf("Submit nomination"), page.indexOf('id="vote"'));
  assert.doesNotMatch(beforeBallot, /merchCardHtml/, "no card above the ballot");
  // Homepage redesign (step 7): one slim strip near the bottom, after the
  // Tools row, instead of the large card under the lead story.
  const home = fs.readFileSync("src/pages/home.mjs", "utf8");
  assert.match(home, /merchStripHtml\(\{ placement: "home", from: "\/" \}\)/);
  assert.ok(home.indexOf('id="tools-title"') < home.indexOf("${shopHtml}"), "shop strip comes after the Tools row");
  const sponsors = JSON.parse(fs.readFileSync("src/data/sponsors.json", "utf8"));
  const placements = (sponsors.sponsors || sponsors).find((s) => s.id === "merch").placements.map((p) => p.id);
  for (const id of ["vote-page", "ballot", "after-vote", "home", "story-end", "results-end", "rankings-end", "nav"]) assert.ok(placements.includes(id), id);
});

test("the old card is gone: no White Logo Shirt, no audience sets", () => {
  const html = merchSection({ placement: "story-end" }) + fs.readFileSync("public/scripts/merch-card.js", "utf8");
  assert.doesNotMatch(html, /White Logo Shirt|REP THE SPORT|data-pwm-aud|podium_merch_turn/);
});
