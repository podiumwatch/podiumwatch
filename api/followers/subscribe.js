import { requestTeamFollow } from "../../lib/engagement_service.mjs";

function parseBody(request) {
  if (typeof request.body === "string") {
    if (request.body.length > 20000) {
      const error = new Error("The follow request is too large.");
      error.status = 413;
      throw error;
    }

    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The follow request is invalid.");
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

    if (String(body.website || "").trim()) {
      return response.status(200).json({ requested: true });
    }

    const result = await requestTeamFollow({
      teamId: String(body.team_id || "").trim(),
      email: body.email,
      frequency: body.frequency,
      preferences:
        body.preferences && typeof body.preferences === "object"
          ? body.preferences
          : {},
      source: "team_profile"
    });

    return response.status(200).json(result);
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Team follow request error:", error);
    }

    return response.status(status).json({
      error:
        status < 500
          ? error.message
          : "The team follow request could not be completed."
    });
  }
}
