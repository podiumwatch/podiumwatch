import { createHmac } from "node:crypto";
import { submitTeamInstagramHandle } from "../../lib/team_instagram_service.mjs";

// Public, unauthenticated endpoint: anyone on a team's page can submit or
// update that team's Instagram handle, no account required. Unlike almost
// every other submission path in this project, an accepted change here
// takes effect immediately rather than waiting for admin review -- see
// lib/team_instagram_service.mjs and docs/DECISIONS.md (2026-08-06) for the
// full safety story (automated validation, rate limiting, and a fully
// logged, instantly reversible change).

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The submission is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

function clientAddress(request) {
  return String(
    request.headers["x-forwarded-for"] ||
    request.socket?.remoteAddress ||
    "unknown"
  ).slice(0, 500).split(",")[0].trim();
}

function addressHash(request) {
  const secret = process.env.VOTE_HASH_SECRET ||
    process.env.PODIUM_ADMIN_SESSION_SECRET ||
    "podium-watch-team-instagram";

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

    // Honeypot: a field real submitters never see or fill in.
    if (String(body.website || "").trim()) {
      return response.status(201).json({ submitted: true });
    }

    const teamId = String(body.team_id || "").trim();
    if (!teamId) {
      return response.status(400).json({ error: "Choose a team." });
    }

    const result = await submitTeamInstagramHandle({
      teamId,
      handleInput: body.handle,
      actorIdHash: addressHash(request)
    });

    return response.status(200).json({
      submitted: true,
      handle: result.handle,
      message: `Instagram updated to @${result.handle}.`
    });
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Team Instagram submission error:", error);
    }

    return response.status(status).json({
      error: status < 500
        ? error.message
        : "The submission could not be completed. Please try again."
    });
  }
}
