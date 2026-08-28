import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import { requireMyPodiumUser, myPodiumApiError } from "../../lib/my_podium_auth.mjs";

const MAX_ATHLETES = 50;
const SCHEMA_VERSION = 1;

function parseBody(request) {
  if (typeof request.body === "string") {
    if (request.body.length > 20000) {
      const error = new Error("The sync request is too large.");
      error.status = 413;
      throw error;
    }
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The sync request is invalid.");
      error.status = 400;
      throw error;
    }
  }
  return request.body || {};
}

function cleanString(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

// Defensive validation, not trust -- a signed-in user's own browser is
// still an untrusted client. Rejects anything that doesn't match the
// exact shape public/scripts/my-podium-store.js already produces rather
// than passing an arbitrary blob straight through to the database.
function validatePreferences(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    const error = new Error("Preferences must be an object.");
    error.status = 400;
    throw error;
  }

  if (Number(input.schemaVersion) !== SCHEMA_VERSION) {
    const error = new Error("This preferences version is not supported.");
    error.status = 400;
    throw error;
  }

  let team = null;
  if (input.team && typeof input.team === "object") {
    const id = cleanString(input.team.id, 200);
    const slug = cleanString(input.team.slug, 200);
    if (!id || !slug) {
      const error = new Error("A followed team needs a real id and slug.");
      error.status = 400;
      throw error;
    }
    team = {
      id,
      slug,
      schoolName: cleanString(input.team.schoolName, 200),
      sport: ["cross_country", "track_and_field"].includes(input.team.sport) ? input.team.sport : null,
      gender: ["boys", "girls"].includes(input.team.gender) ? input.team.gender : null,
      alertsRequestedAt: input.team.alertsRequestedAt ? cleanString(input.team.alertsRequestedAt, 40) : null
    };
  }

  const athletesInput = Array.isArray(input.athletes) ? input.athletes.slice(0, MAX_ATHLETES) : [];
  const athletes = athletesInput
    .filter((athlete) => athlete && typeof athlete === "object" && cleanString(athlete.id, 200))
    .map((athlete) => ({
      id: cleanString(athlete.id, 200),
      slug: athlete.slug ? cleanString(athlete.slug, 200) : null,
      displayName: cleanString(athlete.displayName, 200)
    }));

  return {
    schemaVersion: SCHEMA_VERSION,
    team,
    athletes,
    updatedAt: input.updatedAt ? cleanString(input.updatedAt, 40) : new Date().toISOString()
  };
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requireMyPodiumUser(request);
    const body = parseBody(request);
    const preferences = validatePreferences(body.preferences);
    const clientUpdatedAt = preferences.updatedAt ? new Date(preferences.updatedAt) : null;

    if (!clientUpdatedAt || Number.isNaN(clientUpdatedAt.getTime())) {
      const error = new Error("The sync request is missing a valid timestamp.");
      error.status = 400;
      throw error;
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("my_podium_accounts")
      .select("preferences, client_updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    // Last-write-wins: a stale device pushing an older snapshot than
    // what's already stored does not clobber a newer edit made
    // elsewhere -- it gets the winning (stored) state back instead, so
    // the caller can reconcile down rather than up.
    if (existing?.client_updated_at && new Date(existing.client_updated_at) > clientUpdatedAt) {
      return response.status(200).json({
        preferences: existing.preferences,
        client_updated_at: existing.client_updated_at,
        conflict: true
      });
    }

    const { data: saved, error: saveError } = await supabaseAdmin
      .from("my_podium_accounts")
      .upsert(
        { user_id: user.id, preferences, client_updated_at: clientUpdatedAt.toISOString() },
        { onConflict: "user_id" }
      )
      .select("preferences, client_updated_at")
      .single();

    if (saveError) {
      throw saveError;
    }

    return response.status(200).json({
      preferences: saved.preferences,
      client_updated_at: saved.client_updated_at,
      conflict: false
    });
  } catch (error) {
    return myPodiumApiError(response, error, "Unable to sync My Podium.");
  }
}
