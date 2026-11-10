import { merchStatus } from "../../lib/merch_service.mjs";

// Public: is the Podium Watch Store card on? (awards voting pages)
export default async function handler(request, response) {
  try {
    const status = await merchStatus();
    response.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return response.status(200).json({ enabled: status.enabled });
  } catch {
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({ enabled: true });
  }
}
