import { recordPresencePing } from "../../lib/engagement_service.mjs";

function parseBody(request) {
  if (typeof request.body === "string") {
    if (request.body.length > 5000) {
      const error = new Error("Presence request is too large.");
      error.status = 413;
      throw error;
    }

    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("Presence request is invalid.");
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
    const result = await recordPresencePing(parseBody(request));
    return response.status(200).json(result);
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Presence ping error:", error);
    }

    return response.status(status).json({
      error: status < 500 ? error.message : "Presence ping could not be recorded."
    });
  }
}
