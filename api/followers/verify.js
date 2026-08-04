import {
  getSiteUrl,
  verifyFollowerToken
} from "../../lib/engagement_service.mjs";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const token = String(request.query?.token || "").trim();
  const siteUrl = getSiteUrl();

  try {
    await verifyFollowerToken(token);
    return response.redirect(
      302,
      `${siteUrl}/follow/?status=verified&token=${encodeURIComponent(token)}`
    );
  } catch (error) {
    return response.redirect(
      302,
      `${siteUrl}/follow/?status=error&message=${encodeURIComponent(
        error.message || "The notification link is invalid."
      )}`
    );
  }
}
