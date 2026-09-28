import { closeScheduledNominations } from "../../lib/awards_service.mjs";

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers?.authorization || "";
  return Boolean(secret) && authorization === `Bearer ${secret}`;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  if (!authorized(request)) {
    return response.status(401).json({ error: "Unauthorized." });
  }

  try {
    const result = await closeScheduledNominations();
    if (result.failed.length) {
      console.error("Close scheduled nominations cron: some weeks failed to close:", result.failed);
    }
    return response.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Close scheduled nominations cron error:", error);
    return response.status(500).json({
      error: "Scheduled nominations could not be closed."
    });
  }
}
