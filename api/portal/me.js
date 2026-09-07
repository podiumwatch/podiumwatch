import { requirePortalUser, getOrCreatePortalProfile, portalApiError } from "../../lib/portal_auth.mjs";
import { cleanAthleteText } from "../../lib/athlete_foundation_service.mjs";
import { updateOwnProfile, listOwnArticles, createArticle, getOwnArticle, updateOwnArticle, submitOwnArticle, requestImageUploadSlot } from "../../lib/writer_portal_service.mjs";

// Writer-facing: everything a signed-in writer can do to their own
// account -- read/update their own profile, list their own articles.
// Never touches anyone else's data; a writer's own portal_profiles row is
// looked up strictly by their verified auth user id, never a client-
// supplied id.

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
    const user = await requirePortalUser(request);
    const body = parseBody(request);
    const action = cleanAthleteText(body.action, 80).toLowerCase() || "get_profile";
    let data;

    if (action === "get_profile") {
      data = { profile: await getOrCreatePortalProfile(user.id) };
    } else if (action === "update_profile") {
      data = { profile: await updateOwnProfile(user.id, {
        fullName: body.full_name,
        school: body.school,
        grade: body.grade,
        bio: body.bio
      }) };
    } else if (action === "list_articles") {
      data = { articles: await listOwnArticles(user.id) };
    } else if (action === "create_article") {
      data = { article: await createArticle(user.id) };
    } else if (action === "get_article") {
      data = { article: await getOwnArticle(user.id, body.article_id) };
    } else if (action === "update_article") {
      data = { article: await updateOwnArticle(user.id, body.article_id, {
        title: body.title,
        dek: body.dek,
        body: body.body,
        category: body.category,
        tags: body.tags,
        featuredImageUrl: body.featured_image_url,
        photoCredit: body.photo_credit
      }) };
    } else if (action === "submit_article") {
      data = { article: await submitOwnArticle(user.id, body.article_id) };
    } else if (action === "request_image_upload") {
      data = await requestImageUploadSlot({ fileName: body.file_name, userId: user.id });
    } else {
      const error = new Error("Unsupported Writer Portal action.");
      error.status = 400;
      throw error;
    }

    return response.status(200).json(data);
  } catch (error) {
    return portalApiError(response, error, "The Writer Portal request could not be completed.");
  }
}
