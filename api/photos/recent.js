import { listRecentSelectedPhotos } from "../../lib/photo_submissions_service.mjs";

// Public, no-login, read-only. Only ever returns already-selected photos --
// see listRecentSelectedPhotos for exactly what that means. Powers the
// homepage "Recent meet photos" module and the /photos/ gallery page.

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const limit = Number(request.query?.limit) || 12;
    const photos = await listRecentSelectedPhotos({ limit });
    return response.status(200).json({ photos });
  } catch (error) {
    console.error("Recent photos error:", error);
    return response.status(500).json({ error: "Recent photos could not be loaded." });
  }
}
