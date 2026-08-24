import { getArticleResults } from "../../lib/article_poll_service.mjs";

// Public, unauthenticated, read-only endpoint: the current Reader
// Predictions results for every poll on one preseason article, plus (when
// the browser's own hashed vote token is supplied) which polls this
// browser has already voted in. Used both on initial page load (so a
// returning reader sees real standings and their own past pick instead of
// an empty ballot) and right after a vote to refresh every poll's totals.

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const parseError = new Error("The request could not be read.");
      parseError.status = 400;
      throw parseError;
    }
  }

  return request.body || {};
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);

    const result = await getArticleResults({
      articleSlug: body.article_slug,
      voterToken: body.voter_token
    });

    return response.status(200).json(result);
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Article poll results error:", error);
    }

    return response.status(status).json({
      error: status < 500 ? error.message : "Results could not be loaded right now."
    });
  }
}
