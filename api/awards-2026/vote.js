import { castVote, myVotes, VOTING_BUSY_MESSAGE } from "../../lib/yearly_awards_2026_service.mjs";

// Public, no login: one vote per category per browser every hour for the 2026
// Athlete, Team and Coach of the Year. Votes are Redis entries (see
// lib/yearly_awards_2026_votes.mjs). Live counts are public through the status API, not this endpoint.
// Same hidden trap field as nominations. Cloudflare Turnstile is checked
// once its keys are set.
//
// POST { category, finalist, browser_token, website, turnstile_token }
// POST { action: "mine", categories: [...], browser_token } returns which
//   finalist this browser already voted for in each category.

function readBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      return {};
    }
  }
  return request.body ?? {};
}

function clientAddress(request) {
  return String(request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown").slice(0, 500).split(",")[0].trim();
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = readBody(request);

    if (body.action === "mine") {
      return response.status(200).json({ votes: await myVotes({ browserToken: body.browser_token, slugs: Array.isArray(body.categories) ? body.categories : [] }) });
    }

    // Hidden trap field: real people never see or fill it in.
    if (String(body.website || "").trim()) {
      return response.status(201).json({ voted: true });
    }

    const result = await castVote({
      slug: body.category,
      finalistKey: body.finalist,
      browserToken: body.browser_token,
      turnstileToken: body.turnstile_token,
      address: clientAddress(request)
    });
    return response.status(201).json({ voted: true, ...result });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500 && error?.code !== "VOTING_BUSY") console.error("Yearly awards vote error:", error);
    // 503 VOTING_BUSY: Redis failed and nothing was counted (logged in
    // castVote). Any other server error gets the same safe message.
    if (status === 503) response.setHeader("Retry-After", "60");
    return response.status(status).json({
      error: status < 500 ? error.message : VOTING_BUSY_MESSAGE,
      ...(error?.votedFor ? { voted_for: error.votedFor } : {}),
      ...(error?.nextVoteAt ? { next_vote_at: error.nextVoteAt } : {})
    });
  }
}
