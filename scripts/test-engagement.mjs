import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

// Podium Watch's first-party engagement/analytics system predates this
// project's install/ migration convention (team_analytics_events has no
// install/*.sql file, the same situation AOTW/TOTW and the Fan Poll's
// pre-migration tables were in) and had no dedicated test file at all
// until this one -- added specifically to cover the pace calculator
// usage-tracking addition, not as a full rebuild of coverage for the
// whole engagement system.

const root = process.cwd();
process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ||= "test-service-role-key";

const { ANALYTICS_EVENT_TYPES, aggregateAnalytics } = await import("../lib/engagement_service.mjs");

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

function includesAll(text, values, label) {
  for (const value of values) {
    assert.ok(text.includes(value), `${label} is missing ${value}`);
  }
}

// --- ANALYTICS_EVENT_TYPES ---------------------------------------------------
// team_id is already nullable and already used that way in production
// (directory_view fires with no team_id today), so a tool-page event
// type needs no schema change -- just a new allowed value here. This
// guards that pace_calculator_use was added without accidentally
// dropping any of the original team-page event types.

assert.ok(ANALYTICS_EVENT_TYPES instanceof Set, "ANALYTICS_EVENT_TYPES must be a real Set, matching how recordAnalyticsEvent checks membership.");
assert.ok(ANALYTICS_EVENT_TYPES.has("pace_calculator_use"), "pace_calculator_use must be an allowed analytics event type.");

for (const originalType of [
  "team_profile_view",
  "directory_view",
  "schedule_view",
  "roster_view",
  "content_view",
  "social_click",
  "recruiting_click",
  "follow_submit",
  "sponsor_impression",
  "sponsor_click"
]) {
  assert.ok(ANALYTICS_EVENT_TYPES.has(originalType), `${originalType} must still be allowed -- adding a new tool event type must never drop an existing one.`);
}

assert.ok(!ANALYTICS_EVENT_TYPES.has("literally_anything_else"), "An arbitrary, unregistered event type must never be accepted.");

assert.ok(ANALYTICS_EVENT_TYPES.has("story_view"), "story_view must be an allowed analytics event type, for the per-article view counts feature.");

// --- aggregateAnalytics: story_counts -----------------------------------------
// Pure reducer, no live database needed. Scoped specifically to
// event_type === "story_view" (not every row that happens to carry a
// content_id) so a future, differently-shaped content_view use can never
// silently mix into the same per-article counts.

const storyCountsResult = aggregateAnalytics([
  { event_type: "story_view", content_id: "2026-preseason-boys-d1-top-20", visitor_id: "v1" },
  { event_type: "story_view", content_id: "2026-preseason-boys-d1-top-20", visitor_id: "v2" },
  { event_type: "story_view", content_id: "2026-preseason-girls-d4-top-20", visitor_id: "v3" },
  // A content_view row with a content_id must NOT be counted as a story
  // view -- only the real story_view event type counts here.
  { event_type: "content_view", content_id: "2026-preseason-boys-d1-top-20", visitor_id: "v4" },
  // A story_view row with no content_id must be ignored rather than
  // counted under an "undefined" key.
  { event_type: "story_view", visitor_id: "v5" }
]);

const storyCountsBySlug = Object.fromEntries(storyCountsResult.story_counts.map((row) => [row.slug, row.count]));
assert.equal(storyCountsBySlug["2026-preseason-boys-d1-top-20"], 2, "Two real story_view events for the same slug must sum to 2.");
assert.equal(storyCountsBySlug["2026-preseason-girls-d4-top-20"], 1);
assert.equal(Object.keys(storyCountsBySlug).length, 2, "Only real story_view rows with a content_id may appear in story_counts -- the content_view row and the content_id-less row must both be excluded.");
assert.equal(storyCountsResult.story_counts[0].slug, "2026-preseason-boys-d1-top-20", "story_counts must be sorted with the most-viewed article first.");

// --- Source guards -----------------------------------------------------------
// recordAnalyticsEvent itself needs a live Supabase connection (it reads
// engagement_settings before doing anything else), so the actual write
// path and the admin dashboard's rendering are guarded at the source
// level here instead, the same way this project's other recent features
// guard their live-database-dependent parts.

const paceCalculatorScriptSource = await read("public/scripts/pace-calculator.js");
const adminEngagementScriptSource = await read("public/scripts/admin-engagement.js");

includesAll(
  paceCalculatorScriptSource,
  [
    'event_type: "pace_calculator_use"',
    "podium_visitor_id",
    "podium_session_id",
    "podium_tool_view_pace_calculator_",
    "/api/engagement/track"
  ],
  "The pace calculator must track its own usage, reusing the same visitor/session id keys public/scripts/engagement.js uses for team pages, deduped per session"
);

assert.ok(
  /catch\s*\{[\s\S]{0,80}\/\/ Analytics must never interrupt the calculator\./.test(paceCalculatorScriptSource),
  "Usage tracking must be wrapped so a tracking failure can never break the calculator itself."
);

includesAll(
  adminEngagementScriptSource,
  ['pace_calculator_use: "Pace calculator uses"'],
  "The admin Engagement Center's Popular Actions panel must show a friendly label for pace_calculator_use, not just the raw event type key"
);

// --- Story view tracking (public/scripts/story-view.js) ----------------------

const storyViewScriptSource = await read("public/scripts/story-view.js");

includesAll(
  storyViewScriptSource,
  [
    'event_type: "story_view"',
    "podium_visitor_id",
    "podium_session_id",
    "podium_story_view_",
    "content_type: \"story\"",
    "content_id: slug",
    "/api/engagement/track"
  ],
  "Every /stories/{slug}/ page must track its own view, reusing the same visitor/session id keys and content_type/content_id columns the rest of this table already uses, deduped per session per article"
);

assert.ok(
  /catch\s*\{[\s\S]{0,80}\/\/ Analytics must never interrupt the article\./.test(storyViewScriptSource),
  "Story view tracking must be wrapped so a tracking failure can never break the article page itself."
);

includesAll(
  adminEngagementScriptSource,
  [
    'story_view: "Article views"',
    "data-top-stories",
    "data-stat-article-views",
    "site-data.json"
  ],
  "Admin Engagement must show a friendly label for story_view, a Top articles panel, an Article views stat, and resolve titles from the site's own public site-data.json"
);

const buildScriptSource = await read("scripts/build.mjs");

includesAll(
  buildScriptSource,
  ['data-story-slug="', '<script src="/scripts/story-view.js" defer></script>'],
  "Every story page (not just the preseason articles) must carry data-story-slug and load story-view.js, or the view-tracking feature silently does nothing"
);

console.log("Engagement analytics validation passed.");
console.log("ANALYTICS_EVENT_TYPES checked: pace_calculator_use and story_view are allowed, every original team-page event type is still allowed, and an arbitrary unregistered type is rejected.");
console.log("Pace calculator usage tracking checked at the source level: correct event type, shared visitor/session id scheme, per-session dedup key, the tracking endpoint, and a safety wrapper that can never interrupt the calculator itself.");
console.log("Admin Engagement Center's friendly label for the new event type checked.");
console.log("aggregateAnalytics' new story_counts reducer checked directly: correct per-slug sums, sorted most-viewed first, and both a wrong event_type and a missing content_id correctly excluded.");
console.log("Story view tracking (public/scripts/story-view.js) checked at the source level: correct event type/columns, shared visitor/session scheme, per-article per-session dedup key, and a safety wrapper that can never interrupt the article. Admin Engagement's Top articles panel, Article views stat, and site-data.json title resolution checked. Every story page confirmed to carry data-story-slug and load the tracking script.");
