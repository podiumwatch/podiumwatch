import { createHmac } from "node:crypto";
import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import {
  cleanAthleteText,
  isMissingAthleteFoundationError
} from "../../lib/athlete_foundation_service.mjs";

const ALLOWED_TYPES = new Set([
  "name",
  "school",
  "graduation_year",
  "performance",
  "division",
  "college_commitment",
  "duplicate",
  "privacy",
  "other"
]);

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The correction request is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

function cleanEmail(value) {
  const email = cleanAthleteText(value, 320).toLowerCase();

  if (!email) {
    return null;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error("Enter a valid email address or leave it blank.");
    error.status = 400;
    throw error;
  }

  return email;
}

function cleanUrl(value) {
  const cleaned = cleanAthleteText(value, 2000);

  if (!cleaned) {
    return null;
  }

  try {
    const prepared = /^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned)
      ? cleaned
      : `https://${cleaned}`;
    const url = new URL(prepared);

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error();
    }

    return url.href;
  } catch {
    const error = new Error("The source link must be a valid website address.");
    error.status = 400;
    throw error;
  }
}

function clientAddress(request) {
  return cleanAthleteText(
    request.headers["x-forwarded-for"] ||
    request.socket?.remoteAddress ||
    "unknown",
    500
  ).split(",")[0].trim();
}

function addressHash(request) {
  const secret = process.env.VOTE_HASH_SECRET ||
    process.env.PODIUM_ADMIN_SESSION_SECRET ||
    "podium-watch-athlete-corrections";

  return createHmac("sha256", secret)
    .update(clientAddress(request))
    .digest("hex");
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);

    if (cleanAthleteText(body.website, 200)) {
      return response.status(200).json({ submitted: true });
    }

    const athleteSlug = cleanAthleteText(body.athlete_slug, 500)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const type = cleanAthleteText(body.correction_type, 80).toLowerCase();
    const details = cleanAthleteText(body.details, 3000);

    if (!athleteSlug) {
      return response.status(400).json({ error: "Choose an athlete profile." });
    }

    if (!ALLOWED_TYPES.has(type)) {
      return response.status(400).json({ error: "Choose a correction type." });
    }

    if (details.length < 20) {
      return response.status(400).json({
        error: "Please include enough detail for Podium Watch to review the correction."
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("athlete_profiles")
      .select("id, slug")
      .eq("slug", athleteSlug)
      .maybeSingle();

    if (profileError && !isMissingAthleteFoundationError(profileError)) {
      throw profileError;
    }

    const ipHash = addressHash(request);
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabaseAdmin
      .from("athlete_profile_corrections")
      .select("id", { count: "exact", head: true })
      .eq("athlete_slug", athleteSlug)
      .eq("submitted_ip_hash", ipHash)
      .gte("created_at", since);

    if (countError) {
      if (isMissingAthleteFoundationError(countError)) {
        return response.status(409).json({
          error: "The athlete correction database migration has not been installed yet."
        });
      }

      throw countError;
    }

    if (Number(count || 0) >= 3) {
      return response.status(429).json({
        error: "Too many correction requests were submitted recently. Please try again later."
      });
    }

    const { data, error } = await supabaseAdmin
      .from("athlete_profile_corrections")
      .insert({
        profile_id: profile?.id || null,
        athlete_slug: athleteSlug,
        correction_type: type,
        details,
        source_url: cleanUrl(body.source_url),
        submitter_name: cleanAthleteText(body.submitter_name, 200) || null,
        submitter_email: cleanEmail(body.submitter_email),
        submitted_ip_hash: ipHash,
        status: "open",
        metadata: {
          submitted_from: "public_athlete_profile"
        }
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return response.status(201).json({
      submitted: true,
      correction_id: data.id,
      message: "The correction was sent to Podium Watch for review."
    });
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Athlete correction error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "The athlete correction could not be submitted."
    });
  }
}
