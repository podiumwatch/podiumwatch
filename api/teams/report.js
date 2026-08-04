import crypto from "node:crypto";
import { supabaseAdmin } from "../../lib/supabase-admin.mjs";
import { writeTeamChange } from "../../lib/team_audit.mjs";

const ALLOWED_REASONS = new Set([
  "wrong_information",
  "fake_ownership",
  "inappropriate_content",
  "duplicate_team",
  "outdated_link",
  "other"
]);

function cleanText(value, maxLength = 4000) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function cleanEmail(value) {
  const email = cleanText(value, 320).toLowerCase();

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

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The submitted report is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

function getFingerprint(request) {
  const forwarded = request.headers["x-forwarded-for"];
  const ip = String(Array.isArray(forwarded) ? forwarded[0] : forwarded || "")
    .split(",")[0]
    .trim();
  const userAgent = String(request.headers["user-agent"] || "").slice(0, 500);
  const secret = process.env.PODIUM_ADMIN_SESSION_SECRET || "podium-watch-report-limit";

  return crypto
    .createHmac("sha256", secret)
    .update(`${ip}|${userAgent}`)
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

    if (cleanText(body.website, 200)) {
      return response.status(200).json({ submitted: true });
    }

    const teamId = cleanText(body.team_id, 100);
    const reason = cleanText(body.reason, 80).toLowerCase();
    const details = cleanText(body.details, 3000);
    const reporterName = cleanText(body.reporter_name, 200) || null;
    const reporterEmail = cleanEmail(body.reporter_email);

    if (!teamId) {
      const error = new Error("Choose a team page to report.");
      error.status = 400;
      throw error;
    }

    if (!ALLOWED_REASONS.has(reason)) {
      const error = new Error("Choose a valid reason for the report.");
      error.status = 400;
      throw error;
    }

    if (details.length < 20) {
      const error = new Error("Please include at least 20 characters explaining the problem.");
      error.status = 400;
      throw error;
    }

    const { data: team, error: teamError } = await supabaseAdmin
      .from("team_pages")
      .select("id, school_name, published, suspended, archived_at, merged_into_team_id")
      .eq("id", teamId)
      .maybeSingle();

    if (teamError) {
      throw teamError;
    }

    if (
      !team ||
      !team.published ||
      team.suspended ||
      team.archived_at ||
      team.merged_into_team_id
    ) {
      const error = new Error("This team page is not available for reporting.");
      error.status = 404;
      throw error;
    }

    const fingerprint = getFingerprint(request);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabaseAdmin
      .from("team_reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_fingerprint", fingerprint)
      .gte("created_at", oneHourAgo);

    if (countError) {
      throw countError;
    }

    if (Number(count) >= 5) {
      const error = new Error("Too many reports were submitted from this device. Please try again later.");
      error.status = 429;
      throw error;
    }

    const { data: report, error } = await supabaseAdmin
      .from("team_reports")
      .insert({
        team_id: teamId,
        reporter_name: reporterName,
        reporter_email: reporterEmail,
        reporter_fingerprint: fingerprint,
        reason,
        details,
        status: "open"
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    await writeTeamChange({
      teamId,
      actorType: "system",
      actorId: "public_report",
      action: "team_report_submitted",
      summary: "A visitor submitted a report about the team page.",
      changedFields: ["team_reports"],
      metadata: {
        report_id: report.id,
        reason
      }
    });

    return response.status(201).json({
      submitted: true,
      report_id: report.id
    });
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Public team report error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "The team report could not be submitted."
    });
  }
}
