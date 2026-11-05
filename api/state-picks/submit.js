import { createHmac } from "node:crypto";
import { submitEntry } from "../../lib/state_picks_service.mjs";

// Public, unauthenticated: saves (or updates, before the lock) one reader's
// eight state champion picks. Same honeypot and hashed-address shape as
// api/article-polls/vote.js. See lib/state_picks_service.mjs.

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const parseError = new Error("Your picks could not be read.");
      parseError.status = 400;
      throw parseError;
    }
  }
  return request.body || {};
}

function addressHash(request) {
  const address = String(request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown")
    .slice(0, 500).split(",")[0].trim();
  const secret = process.env.VOTE_HASH_SECRET || process.env.PODIUM_ADMIN_SESSION_SECRET || "podium-watch-state-picks";
  return createHmac("sha256", secret).update(address).digest("hex");
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);

    // Honeypot: a field real readers never see or fill in.
    if (String(body.website || "").trim()) {
      return response.status(201).json({ submitted: true });
    }

    const result = await submitEntry({
      name: body.name,
      picks: body.picks,
      voterToken: body.voter_token,
      voterIpHash: addressHash(request)
    });

    return response.status(201).json({ submitted: true, ...result });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("State picks submit error:", error);
    return response.status(status).json({
      error: status < 500 ? error.message : "Your picks could not be saved right now. Please try again."
    });
  }
}
