import {
  loadFollowerPreferences,
  updateFollowerPreferences
} from "../../lib/engagement_service.mjs";

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The notification settings request is invalid.");
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
    const body = parseBody(request);
    const token = String(body.token || "").trim();
    const action = String(body.action || "get").trim().toLowerCase();

    const result = action === "get"
      ? await loadFollowerPreferences(token)
      : await updateFollowerPreferences(token, body);

    return response.status(200).json(result);
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Follower preferences error:", error);
    }

    return response.status(status).json({
      error:
        status < 500
          ? error.message
          : "Notification settings could not be loaded."
    });
  }
}
