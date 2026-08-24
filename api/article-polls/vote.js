import { createHmac } from "node:crypto";
import { castVote } from "../../lib/article_poll_service.mjs";

// Public, unauthenticated endpoint: casts one Reader Predictions vote for
// one poll on one preseason article. Identified by an anonymous hashed
// browser token, never a name or email -- see install/22_ARTICLE_POLLS.sql
// and lib/article_poll_service.mjs. Structurally a near-mirror of
// api/fan-poll/ballot.js (honeypot, hashed requester IP, same error-status
// shape) since that is the closest existing "cast a public vote" endpoint
// on this project.

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const parseError = new Error("The vote could not be read.");
      parseError.status = 400;
      throw parseError;
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
    "podium-watch-article-polls";

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

    // Honeypot: a field real readers never see or fill in.
    if (String(body.website || "").trim()) {
      return response.status(201).json({ submitted: true });
    }

    const result = await castVote({
      articleSlug: body.article_slug,
      pollId: body.poll_id,
      optionId: body.option_id,
      voterToken: body.voter_token,
      voterIpHash: addressHash(request)
    });

    return response.status(201).json({ submitted: true, ...result });
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Article poll vote error:", error);
    }

    return response.status(status).json({
      error: status < 500 ? error.message : "Your vote could not be recorded right now."
    });
  }
}
