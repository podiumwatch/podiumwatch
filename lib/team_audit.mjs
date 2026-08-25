import { supabaseAdmin } from "./supabase-admin.mjs";

const COMPLETION_FIELDS = [
  ["mascot", 5],
  ["conference", 5],
  ["region", 5],
  ["head_coach", 8],
  ["head_boys_coach", 8],
  ["head_girls_coach", 8],
  ["description", 12],
  ["logo_url", 12],
  ["banner_image_url", 8],
  ["website_url", 5],
  ["athletics_url", 5],
  ["public_contact_email", 5],
  ["cross_country_boys_division", 4],
  ["cross_country_girls_division", 4],
  ["track_boys_division", 4],
  ["track_girls_division", 4]
];

function hasValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return String(value ?? "").trim() !== "";
}

function sanitizeJson(value, depth = 0) {
  if (depth > 5) {
    return "[truncated]";
  }

  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    const text = typeof value === "string"
      ? value.slice(0, 5000)
      : value;

    return text;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 100)
      .map((item) => sanitizeJson(item, depth + 1));
  }

  if (typeof value === "object") {
    const result = {};

    Object.entries(value)
      .slice(0, 100)
      .forEach(([key, item]) => {
        result[String(key).slice(0, 120)] = sanitizeJson(
          item,
          depth + 1
        );
      });

    return result;
  }

  return String(value).slice(0, 5000);
}

// contentSignals reflects the two things a visitor actually comes to a
// team page for -- a real roster and a real schedule -- which, before
// this, earned a claimed team's completion score nothing at all. A
// coach could reach 100% (every field below filled in: mascot,
// conference, coach names, description, logo, division assignments)
// while the page had zero athletes and zero meets connected, because
// none of that was ever part of what "complete" measured. Confirmed
// live: Russia (an actively-managed team, real live races run through
// Split Watch, recruiting contacts filled in) sat at 56% with neither a
// published roster nor a published schedule -- both sections exist and
// work, they just weren't counted or prompted for.
export function calculateTeamCompletion(team, socialLinks = [], contentSignals = {}) {
  const totalWeight = COMPLETION_FIELDS.reduce(
    (sum, [, weight]) => sum + weight,
    0
  ) + 8 + 14 + 14;

  let earned = 0;

  COMPLETION_FIELDS.forEach(([field, weight]) => {
    if (hasValue(team?.[field])) {
      earned += weight;
    }
  });

  if (
    Array.isArray(socialLinks) &&
    socialLinks.some((link) => link?.published && hasValue(link?.url))
  ) {
    earned += 8;
  }

  if (contentSignals?.hasPublishedSchedule) {
    earned += 14;
  }

  if (contentSignals?.hasPublishedRoster) {
    earned += 14;
  }

  return Math.max(
    0,
    Math.min(100, Math.round((earned / totalWeight) * 100))
  );
}

// Whether a team has ever published a real schedule (at least one
// team_meet_connections row marked published) or a real roster (at
// least one team_seasons row a coach has published or archived --
// matching the exact same status filter api/teams/roster.js already
// uses to decide what a visitor may see). A cheap existence check, not
// a full fetch -- every caller of calculateTeamCompletion() already
// fetches or can cheaply fetch the real rows themselves when they need
// the actual content, not just whether it exists.
export async function getPublishedContentSignals(teamId) {
  const [scheduleResult, rosterResult] = await Promise.all([
    supabaseAdmin
      .from("team_meet_connections")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("published", true),
    supabaseAdmin
      .from("team_seasons")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .in("status", ["published", "archived"])
  ]);

  if (scheduleResult.error) {
    throw scheduleResult.error;
  }

  if (rosterResult.error) {
    throw rosterResult.error;
  }

  return {
    hasPublishedSchedule: (scheduleResult.count || 0) > 0,
    hasPublishedRoster: (rosterResult.count || 0) > 0
  };
}

export function getChangedFields(beforeData, afterData, fields) {
  return fields.filter((field) => {
    const beforeValue = beforeData?.[field] ?? null;
    const afterValue = afterData?.[field] ?? null;

    return JSON.stringify(beforeValue) !== JSON.stringify(afterValue);
  });
}

export function pickTeamFields(source, fields) {
  const result = {};

  fields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(source || {}, field)) {
      result[field] = source[field];
    }
  });

  return result;
}

export async function writeTeamChange({
  teamId = null,
  actorType = "system",
  actorId = null,
  action,
  summary,
  changedFields = [],
  beforeData = {},
  afterData = {},
  metadata = {}
}) {
  try {
    const { error } = await supabaseAdmin
      .from("team_change_log")
      .insert({
        team_id: teamId,
        actor_type: actorType,
        actor_id: actorId ? String(actorId).slice(0, 500) : null,
        action: String(action || "team_change").slice(0, 200),
        summary: String(summary || "Team information changed.").slice(0, 1000),
        changed_fields: Array.isArray(changedFields)
          ? changedFields.map((field) => String(field).slice(0, 120)).slice(0, 100)
          : [],
        before_data: sanitizeJson(beforeData),
        after_data: sanitizeJson(afterData),
        metadata: sanitizeJson(metadata)
      });

    if (error) {
      console.error("Unable to write team change record:", error);
    }
  } catch (error) {
    console.error("Unable to write team change record:", error);
  }
}
