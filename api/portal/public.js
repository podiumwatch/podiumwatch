import { cleanAthleteText } from "../../lib/athlete_foundation_service.mjs";
import { getPublishedArticleBySlug, getAuthorPublicProfile } from "../../lib/writer_portal_service.mjs";

// Public, unauthenticated: powers /writer-portal/articles/ and
// /writer-portal/authors/. Both underlying service functions already
// filter to status='published' -- a draft, submitted, or archived
// article is never reachable here regardless of what a caller asks for.

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The request is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "public, max-age=30, s-maxage=120, stale-while-revalidate=600");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);
    const action = cleanAthleteText(body.action, 80).toLowerCase();
    let data;

    if (action === "get_article") {
      data = { article: await getPublishedArticleBySlug(body.slug) };
    } else if (action === "get_author") {
      data = await getAuthorPublicProfile(body.profile_id);
    } else {
      const error = new Error("Unsupported request.");
      error.status = 400;
      throw error;
    }

    return response.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("Writer Portal public request error:", error);
    return response.status(status).json({
      error: status < 500 ? error.message : "This could not be loaded."
    });
  }
}
