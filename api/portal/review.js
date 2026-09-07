import { requirePortalStaff, portalApiError } from "../../lib/portal_auth.mjs";
import { cleanAthleteText } from "../../lib/athlete_foundation_service.mjs";
import {
  listArticlesForReview,
  getArticleForReview,
  addEditorNote,
  requestRevision,
  approveArticle,
  publishArticle,
  archiveArticle,
  getPortalStats
} from "../../lib/writer_portal_service.mjs";

// Staff-only (portal role editor/admin -- NOT the site's shared admin
// password): the review queue. Every transition here writes a
// portal_article_revisions snapshot (inside the service functions) and,
// for request_revision, a portal_editor_notes row the writer can read.

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
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const { user } = await requirePortalStaff(request);
    const body = parseBody(request);
    const action = cleanAthleteText(body.action, 80).toLowerCase() || "list";
    let data;

    if (action === "list") {
      data = { articles: await listArticlesForReview({ status: body.status, category: body.category, authorId: body.author_id }) };
    } else if (action === "get") {
      data = { article: await getArticleForReview(body.article_id) };
    } else if (action === "add_note") {
      await addEditorNote({ articleId: body.article_id, editorId: user.id, note: body.note, anchorText: body.anchor_text });
      data = { article: await getArticleForReview(body.article_id) };
    } else if (action === "get_stats") {
      data = await getPortalStats();
    } else if (action === "request_revision") {
      await requestRevision({ articleId: body.article_id, editorId: user.id, note: body.note });
      data = { article: await getArticleForReview(body.article_id) };
    } else if (action === "approve") {
      data = { article: await approveArticle({ articleId: body.article_id }) };
    } else if (action === "publish") {
      data = { article: await publishArticle({ articleId: body.article_id }) };
    } else if (action === "archive") {
      data = { article: await archiveArticle({ articleId: body.article_id }) };
    } else {
      const error = new Error("Unsupported Writer Portal review action.");
      error.status = 400;
      throw error;
    }

    return response.status(200).json(data);
  } catch (error) {
    return portalApiError(response, error, "The Writer Portal review request could not be completed.");
  }
}
