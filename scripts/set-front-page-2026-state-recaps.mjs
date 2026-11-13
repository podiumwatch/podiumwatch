// One-time (Zachary, 2026-11-10): put the four 2026 state recaps in the
// front page rotation by hand, Division IV, III, II, I, right after the
// lead, featuring each division's individual champions and its team
// champions and runners-up. Needs install/92. Same path as Admin > Front
// Page > "Also in the front page rotation" (setAlsoStories), so it is
// logged in the change log and can be cleared there.
//
//   node --env-file=.env.local scripts/set-front-page-2026-state-recaps.mjs [--apply]
import fs from "node:fs";
import path from "node:path";
import { parseFrontMatter } from "../src/lib/content.mjs";
import { setAlsoStories } from "../lib/front_page_service.mjs";
import { supabaseAdmin as db } from "../lib/supabase-admin.mjs";
import { fileURLToPath } from "node:url";

const APPLY = process.argv.includes("--apply");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Ids checked by name and school on 2026-11-10 (exactly one match each).
const RECAPS = [
  { file: "20261110_division_iv_state_recap_2026.md", athletes: { "Bennett Lehman (Ansonia)": "ed669091-fc8f-4c58-9bca-0c18ca8b7b6b", "Natalie Nixon (Ottawa Hills)": "bd9e271d-4e06-480f-a030-6706ddcfcd60" }, teams: { "Mount Gilead": "55d013a7-d3dd-4284-a308-3d7b1a2387e3", Russia: "63f303ea-7730-496b-b2dd-46a10794b59e", "Liberty Center": "4005131e-56ef-4b8b-bde6-b22a51c3d76a", Minster: "cf4899fb-42eb-40f4-8c38-432ee7016649" } },
  { file: "20261110_division_iii_state_recap_2026.md", athletes: { "Brice Fuller (Fairless)": "311c00be-f72a-4345-8823-588bd8770d98", "Gwen Huddle (Napoleon)": "b588a023-a30d-461d-8bb6-85f317b00c47" }, teams: { "Woodridge (Peninsula)": "5f0fea80-4726-4db1-b7d0-3f01646fe1d5", "Fairless (Brewster)": "1f3124e2-a716-46ac-bf19-68cc4a6e5cb2", "Oakwood (Dayton)": "828eb8b6-717c-4aca-bafe-c87b479e36a9", Huron: "8de71b9b-7bdd-44db-be34-216d3616979c" } },
  { file: "20261110_division_ii_state_recap_2026.md", athletes: { "Ian Res (West Geauga)": "f3157e47-1f9f-4036-831d-b780ef201685", "Julia Bocik (Sylvania Southview)": "8b1d1e3c-c5ac-4c70-a342-185bcde76256" }, teams: { "Bowling Green": "7ae43cd1-a560-4656-a536-131f38647648", Lexington: "1753763d-971b-4592-9f11-4d8282e7009a", Aurora: "f46b17d4-8f1a-4c66-995e-2602de74c977", "Bishop Watterson (Columbus)": "db476859-4b96-4d55-b8e8-970ec7a4ee8a" } },
  { file: "20261110_division_i_state_recap_2026.md", athletes: { "Ryne Reynolds (Little Miami)": "3ead6d5d-0ecd-499f-86ab-1617c19364d8", "Reese Galinger (Teays Valley)": "07de88b8-1b59-4020-81e5-f0606c5aad57" }, teams: { Springboro: "25d506b2-b717-44d3-9f0a-6b74cbf82ff7", Beavercreek: "4d88a784-1bda-4693-9d22-c256d38d1c51", Milford: "95ddd571-4e48-4aa2-9daa-4af266fb4556", Mason: "1836a870-ffd1-40a7-8c9c-ca2745ac2fd8" } }
];

const items = [];
for (const recap of RECAPS) {
  const { data } = parseFrontMatter(fs.readFileSync(path.join(root, "content/stories", recap.file), "utf8"), recap.file);
  if (data.draft) throw new Error(`${data.slug} is a draft.`);
  // Same story shape the admin page sends (scripts/build.mjs frontStoryShape).
  const image = data.featuredImage || data.heroImage || null;
  items.push({
    story: { slug: data.slug, title: data.title, summary: data.description.length > 150 ? `${data.description.slice(0, 147).trimEnd()}...` : data.description, kicker: String(data.category || "").toUpperCase() || null, image_url: image, image_alt: data.heroAlt || data.featuredImageAlt || "", image_credit: data.imageCredit || null, byline: !data.author || data.author === "Podium Watch" ? "Podium Watch Staff" : data.author, date: data.date },
    linked_profile_ids: Object.values(recap.athletes),
    linked_team_ids: Object.values(recap.teams)
  });
}
// Every id must still be a live profile or team page.
const profileIds = items.flatMap((i) => i.linked_profile_ids);
const teamIds = items.flatMap((i) => i.linked_team_ids);
const [{ data: profiles }, { data: teams }] = await Promise.all([
  db.from("athlete_profiles").select("id, display_name").in("id", profileIds).is("merged_into_profile_id", null),
  db.from("team_pages").select("id, school_name").in("id", teamIds).is("merged_into_team_id", null)
]);
if (profiles.length !== profileIds.length || teams.length !== teamIds.length) throw new Error("A featured profile or team was not found.");
for (const [i, item] of items.entries()) console.log(`${i + 1}. ${item.story.title}\n   athletes: ${Object.keys(RECAPS[i].athletes).join(", ")}\n   teams: ${Object.keys(RECAPS[i].teams).join(", ")}`);
if (!APPLY) { console.log("Dry run. Add --apply to put them in the rotation."); process.exit(0); }
const result = await setAlsoStories({ items, actor: "Podium Watch Admin" });
console.log(`In the rotation now: ${result.also.map((row) => `#${row.position} ${row.story_slug}`).join(", ")}`);
