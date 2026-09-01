import { requireMyPodiumUser, myPodiumApiError } from "../../lib/my_podium_auth.mjs";
import { getPodiumPlayAccountSummary } from "../../lib/podium_play_service.mjs";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const hasAuthHeader = Boolean(request.headers.authorization || request.headers.Authorization);
    // A present-but-invalid/expired token is a real 401, not a silent
    // fall-back to guest mode -- only a genuinely ABSENT header means
    // "this is a deliberate guest lookup."
    const user = hasAuthHeader ? await requireMyPodiumUser(request) : null;
    const installId = user ? undefined : String(request.query?.installId || "");

    const summary = await getPodiumPlayAccountSummary({ user, installId });
    return response.status(200).json(summary);
  } catch (error) {
    return myPodiumApiError(response, error, "Unable to load your Podium Play account.");
  }
}
