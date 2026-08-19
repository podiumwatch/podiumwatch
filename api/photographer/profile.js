import {
  requirePhotographerUser,
  photographerApiError
} from "../../lib/photographer_auth.mjs";
import {
  getMyPhotographerListing,
  updateMyPhotographerListing,
  submitMyPhotographerListing,
  selfSetSports,
  selfSetServiceAreas,
  selfAddPortfolioItem,
  selfRemovePortfolioItem,
  selfAddMeetCoverage,
  selfRemoveMeetCoverage,
  selfAddGallery,
  selfRemoveGallery,
  getMyPartnershipStory,
  submitMyPartnershipStoryInfo
} from "../../lib/photographer_service.mjs";

function cleanText(value) {
  return String(value ?? "").trim();
}

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The submitted request is invalid.");
      error.status = 400;
      throw error;
    }
  }
  return request.body || {};
}

// A signed-in photographer managing their OWN listing only -- every
// action here is ownership-checked inside lib/photographer_service.mjs
// against the real signed-in user, never trusting the id in the request
// body alone. Mirrors api/team/roster.js's one-endpoint action-dispatch
// shape.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requirePhotographerUser(request);
    const body = parseBody(request);
    const action = cleanText(body.action).toLowerCase();
    let data;

    switch (action) {
      case "detail":
        data = { photographer: await getMyPhotographerListing(user.id, body.id) };
        break;
      case "update":
        data = { photographer: await updateMyPhotographerListing(user.id, body.id, body) };
        break;
      case "submit":
        data = { photographer: await submitMyPhotographerListing(user.id, body.id) };
        break;
      case "set_sports":
        data = { sports: await selfSetSports(user.id, body.id, body.sports) };
        break;
      case "set_service_areas":
        data = { service_areas: await selfSetServiceAreas(user.id, body.id, body.service_areas) };
        break;
      case "add_portfolio_item":
        data = { item: await selfAddPortfolioItem(user.id, body.id, body) };
        break;
      case "remove_portfolio_item":
        data = await selfRemovePortfolioItem(user.id, body.portfolio_id);
        break;
      case "add_meet_coverage":
        data = { coverage: await selfAddMeetCoverage(user.id, body.id, body) };
        break;
      case "remove_meet_coverage":
        data = await selfRemoveMeetCoverage(user.id, body.coverage_id);
        break;
      case "add_gallery":
        data = { gallery: await selfAddGallery(user.id, body.id, body) };
        break;
      case "remove_gallery":
        data = await selfRemoveGallery(user.id, body.gallery_id);
        break;
      case "get_partnership_story":
        data = await getMyPartnershipStory(user.id, body.id);
        break;
      case "submit_partnership_story":
        data = await submitMyPartnershipStoryInfo(user.id, body.id, body);
        break;
      default: {
        const error = new Error("Unknown photographer action.");
        error.status = 400;
        throw error;
      }
    }

    return response.status(200).json(data);
  } catch (error) {
    return photographerApiError(response, error, "The photographer request could not be completed.");
  }
}
