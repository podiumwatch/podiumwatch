import { createHmac } from "node:crypto";
import { submitBallot } from "../../lib/fan_poll_service.mjs";

// Public, unauthenticated endpoint: anyone can submit a 16-team ranked
// ballot for an open Fan Poll week, identified by email (hashed before
// it ever reaches the database) rather than an anonymous browser token.
// The one-ballot-per-email-per-week database constraint is enforced
// atomically inside cast_fan_poll_ballot_v1 -- see
// lib/fan_poll_service.mjs and install/09_FAN_POLL.sql.

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The ballot is invalid.");
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
    "podium-watch-fan-poll";

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

    // Honeypot: a field real voters never see or fill in.
    if (String(body.website || "").trim()) {
      return response.status(201).json({ submitted: true });
    }

    const result = await submitBallot({
      weekId: body.week_id,
      email: body.email,
      entries: body.entries,
      wantsResultsEmail: body.wants_results_email === true,
      voterIpHash: addressHash(request)
    });

    return response.status(201).json({
      submitted: true,
      ballot_id: result.ballotId,
      message: `Your ballot for ${result.week.title} has been recorded. Thanks for voting!`
    });
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Fan poll ballot submission error:", error);
    }

    return response.status(status).json({
      error: status < 500 ? error.message : "Your ballot could not be submitted right now."
    });
  }
}
