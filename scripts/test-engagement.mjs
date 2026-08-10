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

const { ANALYTICS_EVENT_TYPES } = await import("../lib/engagement_service.mjs");

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

console.log("Engagement analytics validation passed.");
console.log("ANALYTICS_EVENT_TYPES checked: pace_calculator_use is allowed, every original team-page event type is still allowed, and an arbitrary unregistered type is rejected.");
console.log("Pace calculator usage tracking checked at the source level: correct event type, shared visitor/session id scheme, per-session dedup key, the tracking endpoint, and a safety wrapper that can never interrupt the calculator itself.");
console.log("Admin Engagement Center's friendly label for the new event type checked.");
