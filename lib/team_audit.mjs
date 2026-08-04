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

export function calculateTeamCompletion(team, socialLinks = []) {
  const totalWeight = COMPLETION_FIELDS.reduce(
    (sum, [, weight]) => sum + weight,
    0
  ) + 8;

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

  return Math.max(
    0,
    Math.min(100, Math.round((earned / totalWeight) * 100))
  );
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
