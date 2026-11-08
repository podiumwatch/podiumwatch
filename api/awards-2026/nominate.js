import { submitNomination } from "../../lib/yearly_awards_2026_service.mjs";

// Public, no login: one nomination for one 2026 Athlete/Team of the Year
// category. Only nominees from that category's real pool are accepted.
// Same hidden trap field as the weekly awards. See
// lib/yearly_awards_2026_service.mjs.

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

    // Hidden trap field: real people never see or fill it in.
    if (String(body.website || "").trim()) {
      return response.status(201).json({ submitted: true });
    }

    const result = await submitNomination({
      slug: body.category,
      nomineeId: body.nominee_id,
      reason: body.reason,
      firstName: body.first_name,
      browserToken: body.browser_token,
      address: clientAddress(request)
    });

    return response.status(201).json({ submitted: true, ...result });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("Yearly awards nomination error:", error);
    return response.status(status).json({
      error: status < 500 ? error.message : "Your nomination could not be saved right now. Please try again."
    });
  }
}
