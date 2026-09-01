import { requireMyPodiumUser, myPodiumApiError } from "../../lib/my_podium_auth.mjs";
import { getPodiumPlayAccountSummary } from "../../lib/podium_play_service.mjs";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requireMyPodiumUser(request);
    const summary = await getPodiumPlayAccountSummary(user);
    return response.status(200).json(summary);
  } catch (error) {
    return myPodiumApiError(response, error, "Unable to load your Podium Play account.");
  }
}
