// Team and athlete pages easy to reach (2026-11-11): names link only on an
// exact, unique match; never a guess.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { athleteHrefFor, buildLinkIndex, normalizeName, resolveLinks, teamHrefForName, teamHrefForSchoolId } from "../lib/name_links.mjs";
import { site } from "../src/config/site.mjs";

const index = buildLinkIndex({
  teams: [
    { slug: "mason-mason-972", ohio_school_id: "s-mason" },
    { slug: "little-miami-morrow-884", ohio_school_id: "s-lm" },
    { slug: "garfield-akron-1", ohio_school_id: "s-garfield-akron" }
  ],
  schools: [
    { id: "s-mason", school_name: "Mason", city: "Mason" },
    { id: "s-lm", school_name: "Little Miami", city: "Morrow" },
    { id: "s-garfield-akron", school_name: "Garfield", city: "Akron" },
    { id: "s-garfield-hamilton", school_name: "Garfield", city: "Hamilton" },
    { id: "s-nopage", school_name: "Quiet Valley", city: "Somewhere" }
  ],
  athletes: [
    { slug: "ryne-reynolds-little-miami-2027", display_name: "Ryne Reynolds", current_school_id: "s-lm" },
    { slug: "sam-lee-mason-2027", display_name: "Sam Lee", current_school_id: "s-mason" },
    { slug: "sam-lee-mason-2029", display_name: "Sam Lee", current_school_id: "s-mason" },
    { slug: "no-school-2028", display_name: "No School", current_school_id: null }
  ],
  aliases: { "Morrow Little Miami HS": "s-lm" }
});

test("normalizing: case, punctuation, accents and spacing only", () => {
  assert.equal(normalizeName("  St. Ignatius  "), "st ignatius");
  assert.equal(normalizeName("Zoë O’Brien"), "zoe obrien");
  assert.equal(normalizeName("Archbishop Alter & Co"), "archbishop alter and co");
});

test("schools: exact unique matches link; ambiguous or page-less schools don't", () => {
  assert.equal(teamHrefForName(index, "Mason"), "/teams/mason-mason-972/");
  assert.equal(teamHrefForName(index, "little miami"), "/teams/little-miami-morrow-884/");
  assert.equal(teamHrefForName(index, "Garfield"), null, "two schools are named Garfield");
  assert.equal(teamHrefForName(index, "Garfield (Akron)"), "/teams/garfield-akron-1/", "the city makes it unique");
  assert.equal(teamHrefForName(index, "Akron Garfield"), "/teams/garfield-akron-1/");
  assert.equal(teamHrefForName(index, "Quiet Valley"), null, "no published team page");
  assert.equal(teamHrefForName(index, "Gar. Garfield"), null, "abbreviations are never expanded by guessing");
  assert.equal(teamHrefForName(index, "Morrow Little Miami HS"), "/teams/little-miami-morrow-884/", "checked alias");
  assert.equal(teamHrefForSchoolId(index, "s-mason"), "/teams/mason-mason-972/");
  assert.equal(teamHrefForSchoolId(index, "s-nopage"), null);
});

test("athletes: exact name plus school, unique; a name alone never links", () => {
  assert.equal(athleteHrefFor(index, "Ryne Reynolds", "Little Miami"), "/athletes/ryne-reynolds-little-miami-2027/");
  assert.equal(athleteHrefFor(index, "Ryne Reynolds", "Mason"), null, "different school");
  assert.equal(athleteHrefFor(index, "Ryne Reynolds", ""), null);
  assert.equal(athleteHrefFor(index, "Sam Lee", "Mason"), null, "two profiles share the name and school");
  assert.equal(athleteHrefFor(index, "Ryne Reynold", "Little Miami"), null, "no fuzzy matching");
});

test("resolve: returns only names with pages, within limits", () => {
  const out = resolveLinks(index, { s: ["Mason", "Garfield"], a: [["Ryne Reynolds", "Little Miami"], ["Sam Lee", "Mason"]], i: ["s-lm", "s-nopage"] });
  assert.deepEqual(out, {
    schools: { Mason: "/teams/mason-mason-972/" },
    athletes: { "Ryne Reynolds~Little Miami": "/athletes/ryne-reynolds-little-miami-2027/" },
    ids: { "s-lm": "/teams/little-miami-morrow-884/" }
  });
  const many = resolveLinks(index, { s: Array.from({ length: 1000 }, () => "Mason") });
  assert.equal(Object.keys(many.schools).length, 1);
});

test("pages mark school and athlete names; the linker loads everywhere; the endpoint is CDN cached", () => {
  assert.match(fs.readFileSync("scripts/build.mjs", "utf8"), /<span data-pw-school="\$\{escapeHtml\(row\.school\)\}">/);
  assert.match(fs.readFileSync("public/scripts/ranking-leaders.js", "utf8"), /data-pw-school=/);
  assert.match(fs.readFileSync("public/scripts/ranking-leaders.js", "utf8"), /window\.pwNameLinks\(rowsEl\)/);
  assert.match(fs.readFileSync("src/pages/mockregionals.mjs", "utf8"), /data-pw-fallback/);
  assert.match(fs.readFileSync("src/pages/oatcccpoll.mjs", "utf8"), /data-pw-school=/);
  const awards = fs.readFileSync("public/scripts/awards-2026.js", "utf8");
  assert.match(awards, /page\.dataset\.pwSchoolId = item\.id/);
  assert.match(awards, /page\.dataset\.pwAthleteSchool = item\.school/);
  const linker = fs.readFileSync("public/scripts/name-links.js", "utf8");
  assert.match(linker, /ATHLETE_HEADS/, "recap tables: Athlete and School columns");
  assert.match(linker, /\.sort\(\)/, "sorted names so every visitor asks the same URL");
  assert.match(fs.readFileSync("src/lib/html.mjs", "utf8"), /<script src="\/scripts\/name-links\.js" defer><\/script>/);
  assert.match(fs.readFileSync("api/links/index.js", "utf8"), /s-maxage=900, stale-while-revalidate=86400/);
  const hub = fs.readFileSync("src/pages/seasonhub.mjs", "utf8");
  assert.match(hub, /link\(r\.href, r\.name\)/, "results hubs already link athletes by ID");
  assert.match(hub, /school\(r\.team_href/, "and schools by ID");
});

test("header: a Teams menu with Teams and Athletes; Teams in the mobile bar; homepage Find your team", () => {
  const menu = site.navigation.find((group) => group.label === "Teams");
  assert.ok(menu, "Teams menu");
  assert.deepEqual(menu.items.map((item) => item.href), ["/teams/", "/athletes/"]);
  const html = fs.readFileSync("src/lib/html.mjs", "utf8");
  assert.match(html, /<a href="\/teams\/" aria-label="Teams" data-dock-path="\/teams\/">/);
  assert.match(fs.readFileSync("src/styles/main.css", "utf8"), /\.mobile-dock \{[^}]*grid-template-columns:repeat\(6,1fr\)/);
  const build = fs.readFileSync("scripts/build.mjs", "utf8");
  assert.match(build, /<form class="home-find-team-form" action="\/teams\/" method="get" role="search">/);
  assert.match(fs.readFileSync("public/scripts/team-directory.js", "utf8"), /get\("search"\)/);
});

test("aliases from Zachary map to exactly the school named (2026-11-11)", async () => {
  const file = JSON.parse(fs.readFileSync("src/data/school-name-aliases.json", "utf8"));
  assert.deepEqual(Object.keys(file.aliases).sort(), ["Cincinnati CHCA", "Dub. Jerome", "Fenwick", "Hartley", "MVCA", "Olen. Liberty"]);
  const ids = Object.values(file.aliases).map((v) => v.school_id);
  assert.equal(new Set(ids).size, ids.length, "each alias is a different school");
  for (const id of ids) assert.match(id, /^[0-9a-f-]{36}$/);
});

test("division rules: Green and Lakewood link only in Division I, to the school given", async () => {
  const { buildLinkIndex, teamHrefForName, athleteHrefFor, parseDivision, resolveLinks } = await import("../lib/name_links.mjs");
  const file = JSON.parse(fs.readFileSync("src/data/school-name-aliases.json", "utf8"));
  const idx = buildLinkIndex({
    teams: [
      { slug: "green-uniontown-670", ohio_school_id: "dd03a2bd-bbd9-4268-9d49-c386a6948867" },
      { slug: "lakewood-lakewood-832", ohio_school_id: "96173f9b-8b5d-4974-ba3e-a659dabd24d0" },
      { slug: "lakewood-hebron-830", ohio_school_id: "dac2542e-f628-4e26-b565-e120a3f97a7d" }
    ],
    schools: [
      { id: "dd03a2bd-bbd9-4268-9d49-c386a6948867", school_name: "Green", city: "Uniontown" },
      { id: "392ac88f-95e6-47f3-9c47-866ead48c79f", school_name: "Green", city: "Franklin Furnace" },
      { id: "96173f9b-8b5d-4974-ba3e-a659dabd24d0", school_name: "Lakewood", city: "Lakewood" },
      { id: "dac2542e-f628-4e26-b565-e120a3f97a7d", school_name: "Lakewood", city: "Hebron" },
      { id: "solo", school_name: "Mason", city: "Mason" }
    ],
    athletes: [{ slug: "dane-whittaker-green-2027", display_name: "Dane Whittaker", current_school_id: "dd03a2bd-bbd9-4268-9d49-c386a6948867" }],
    divisionAliases: [...file.division_aliases, { label: "Mason", division: 1, school_id: "elsewhere" }]
  });
  assert.equal(teamHrefForName(idx, "Green"), null);
  assert.equal(teamHrefForName(idx, "Green", "Division I"), "/teams/green-uniontown-670/");
  assert.equal(teamHrefForName(idx, "Green", 2), null, "no rule for Division II");
  assert.equal(teamHrefForName(idx, "Lakewood", "1"), "/teams/lakewood-lakewood-832/");
  assert.equal(teamHrefForName(idx, "Lakewood", "D3"), null);
  assert.equal(athleteHrefFor(idx, "Dane Whittaker", "Green", 1), "/athletes/dane-whittaker-green-2027/");
  assert.equal(athleteHrefFor(idx, "Dane Whittaker", "Green", 2), null);
  assert.deepEqual(resolveLinks(idx, { s: ["Green@1", "Green@2", "Green"], a: [["Dane Whittaker", "Green", "1"]] }).schools, { "Green@1": "/teams/green-uniontown-670/" });
  assert.deepEqual(Object.keys(resolveLinks(idx, { a: [["Dane Whittaker", "Green", "1"]] }).athletes), ["Dane Whittaker~Green~1"]);
  assert.equal(parseDivision("Girls Division II"), 2);
  assert.equal(parseDivision("Division 12"), null);
  const linker = fs.readFileSync("public/scripts/name-links.js", "utf8");
  assert.match(linker, /headingDivision/, "recap tables take their division from the heading above");
  for (const [file, pattern] of [["scripts/build.mjs", /class="ranking-row" data-pw-division=/], ["public/scripts/ranking-leaders.js", /data-pw-division="\$\{escapeHtml\(entry\.division/], ["src/pages/mockregionals.mjs", /data-pw-division="\$\{division\}"/], ["src/pages/oatcccpoll.mjs", /rowsEl\.dataset\.pwDivision = division/]]) assert.match(fs.readFileSync(file, "utf8"), pattern, file);
});
