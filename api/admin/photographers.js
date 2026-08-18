import { isAdminRequest } from "../../lib/admin_auth.mjs";
import {
  adminListPhotographers,
  adminGetPhotographer,
  adminCreatePhotographer,
  adminUpdatePhotographer,
  adminSetSports,
  adminSetServiceAreas,
  adminAddPortfolioItem,
  adminRemovePortfolioItem
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

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  if (!isAdminRequest(request)) {
    return response.status(401).json({ error: "Admin sign in required." });
  }

  try {
    const body = parseBody(request);
    const action = cleanText(body.action).toLowerCase();
    let data;

    switch (action) {
      case "list":
        data = { photographers: await adminListPhotographers({ search: body.search, status: body.status }) };
        break;
      case "detail":
        data = { photographer: await adminGetPhotographer(body.id) };
        break;
      case "create":
        data = { photographer: await adminCreatePhotographer(body) };
        break;
      case "update":
        data = { photographer: await adminUpdatePhotographer(body.id, body) };
        break;
      case "set_sports":
        data = { sports: await adminSetSports(body.id, body.sports) };
        break;
      case "set_service_areas":
        data = { service_areas: await adminSetServiceAreas(body.id, body.service_areas) };
        break;
      case "add_portfolio_item":
        data = { item: await adminAddPortfolioItem(body.id, body) };
        break;
      case "remove_portfolio_item":
        data = await adminRemovePortfolioItem(body.portfolio_id);
        break;
      default: {
        const error = new Error("Unknown photographer admin action.");
        error.status = 400;
        throw error;
      }
    }

    return response.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("The photographer admin request could not be completed.", error);
    return response.status(status).json({ error: status < 500 ? error.message : "The photographer admin request could not be completed." });
  }
}
