// Site redesign step 2: /teams/ directory logic and school colors.
// Fake teams only (obviously fake names), except the color check, which
// runs over every color seeded from the real logos.
import test from "node:test";
import assert from "node:assert/strict";
import { filterTeams, divisionTag, teamsDirectoryPage, cleanTeamFilters, TEAMS_FIRST_LOAD } from "../src/pages/teamsdirectory.mjs";
import { bandColor, contrastWithWhite } from "../src/lib/components.mjs";
import { site } from "../src/config/site.mjs";
import { teamColor, DEFAULT_TEAM_COLOR, allSchoolColors } from "../lib/team_colors.mjs";

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const fakeTeams = Array.from({ length: 60 }, (_, i) => ({
  id: `t${i}`, slug: `test-school-${i}`, school_name: `${letters[i % 26]}Test School ${i}`, city: `Test City ${i}`,
  region: i % 2 ? "Northeast" : "Southwest", mascot: null, conference: i === 5 ? "Test Conference" : null, logo_url: i % 3 ? `/images/teams/test-${i}.png` : null,
  primary_color: DEFAULT_TEAM_COLOR, cross_country_boys_division: `Division ${["I", "II", "III", "IV"][i % 4]}`, cross_country_girls_division: i % 5 === 0 ? "Division IV" : `Division ${["I", "II", "III", "IV"][i % 4]}`
})).sort((a, b) => a.school_name.localeCompare(b.school_name));

test("division tags: both when different, one when the same or only one is known", () => {
  assert.equal(divisionTag({ cross_country_boys_division: "Division III", cross_country_girls_division: "Division IV" }), "Boys D3 · Girls D4");
  assert.equal(divisionTag({ cross_country_boys_division: "Division II", cross_country_girls_division: "Division II" }), "D2");
  assert.equal(divisionTag({ cross_country_boys_division: "Division I", cross_country_girls_division: null }), "Boys D1");
  assert.equal(divisionTag({ cross_country_boys_division: null, cross_country_girls_division: "Division IV" }), "Girls D4");
  assert.equal(divisionTag({}), "");
});

test("search and filters cover every team", () => {
  assert.equal(filterTeams(fakeTeams, {}).length, 60);
  assert.deepEqual(filterTeams(fakeTeams, { search: "test conference" }).map((t) => t.id), ["t5"]);
  assert.ok(filterTeams(fakeTeams, { search: "test city 59" }).some((t) => t.id === "t59"), "the last team is searchable");
  assert.ok(filterTeams(fakeTeams, { division: "4" }).every((t) => [t.cross_country_boys_division, t.cross_country_girls_division].includes("Division IV")));
  assert.ok(filterTeams(fakeTeams, { region: "northeast" }).every((t) => t.region === "Northeast"));
  assert.deepEqual(cleanTeamFilters({ search: " a%b ", d: "9", region: "East" }), { search: "a b", division: "", region: "East" });
  assert.equal(cleanTeamFilters({ search: "Mason" }).search, "Mason", "the homepage's ?search= keeps working");
});

test("page: first rows in the HTML, the rest as data, chips are real URLs", () => {
  const html = teamsDirectoryPage(site, { teams: fakeTeams, filters: {}, champions: { year: 2026, races: [{ gender: "girls", division: 1, team: { school: "Test Champion", href: "/team/?slug=test-champion-1" } }] } });
  assert.equal((html.match(/class="pw-team-row"/g) || []).length, TEAMS_FIRST_LOAD);
  const rest = JSON.parse(html.match(/<script type="application\/json" data-teams-rest>([\s\S]*?)<\/script>/)[1]);
  assert.equal(rest.length, 60 - TEAMS_FIRST_LOAD);
  assert.match(html, /<span data-teams-count>60<\/span> teams/);
  assert.match(html, /href="\/teams\/\?d=4"/);
  assert.match(html, /href="\/teams\/\?region=Northeast"/);
  assert.match(html, /href="\/teams\/test-champion-1\/"/, "champion links to its team page");
  assert.match(html, /href="\/claim-your-team\/"/);
  assert.match(html, /href="\/team-login\/"/);
  assert.doesNotMatch(html, /percent complete|Available to claim/i, "no completion or per-card claim status");
  assert.match(html, /class="pw-logo pw-logo-sm pw-logo-initials" aria-hidden="true">/, "a team without a logo gets an initials tile");
});

test("page: filtered views drop the champions row; no match shows a way back", () => {
  const filtered = teamsDirectoryPage(site, { teams: fakeTeams, filters: { search: "Test City 1" }, champions: { year: 2026, races: [{ gender: "boys", division: 1, team: { school: "Test Champion", href: "/team/?slug=x" } }] } });
  assert.doesNotMatch(filtered, /state champions/);
  const none = teamsDirectoryPage(site, { teams: fakeTeams, filters: { search: "no such school" } });
  assert.match(none, /No teams match "no such school"/);
  assert.match(none, /href="\/teams\/">Show all teams/);
});

test("school color: a team's own color wins, the old default does not count", () => {
  const logoTeam = { slug: "springboro-springboro-1470", logo_url: "/images/teams/springboro-springboro-1470-256.png" };
  assert.equal(teamColor({ ...logoTeam, primary_color: "#123456" }), "#123456");
  assert.match(teamColor({ ...logoTeam, primary_color: DEFAULT_TEAM_COLOR }), /^#[0-9a-f]{6}$/, "falls back to the logo color");
  assert.equal(teamColor({ slug: "test-no-such-team", logo_url: null, primary_color: DEFAULT_TEAM_COLOR }), null);
});

test("every school color (logo-sampled and overrides) passes WCAG AA with white text once banded", () => {
  const colors = allSchoolColors();
  assert.ok(colors.length >= 20);
  for (const color of colors) assert.ok(contrastWithWhite(bandColor(color)) >= 4.5, `${color} -> ${bandColor(color)}`);
  assert.ok(colors.some((c) => contrastWithWhite(c) < 4.5), "the set includes light colors that had to be darkened");
  assert.equal(bandColor("not a color"), "#090909");
});
