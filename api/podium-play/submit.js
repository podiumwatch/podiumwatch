import { requireMyPodiumUser, myPodiumApiError } from "../../lib/my_podium_auth.mjs";
import { submitPodiumPlayAttempt } from "../../lib/podium_play_service.mjs";

function parseBody(request) {
  if (typeof request.body === "string") {
    if (request.body.length > 5000) {
      const error = new Error("The request is too large.");
      error.status = 413;
      throw error;
    }
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The request is invalid.");
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
    const hasAuthHeader = Boolean(request.headers.authorization || request.headers.Authorization);
    // A present-but-invalid/expired token is a real 401, not a silent
    // fall-back to guest mode -- only a genuinely ABSENT header means
    // "this is a deliberate guest submission."
    const user = hasAuthHeader ? await requireMyPodiumUser(request) : null;

    const result = await submitPodiumPlayAttempt({
      user,
      installId: user ? undefined : String(body.installId || ""),
      gameType: String(body.gameType || ""),
      rawInput: body.rawInput
    });
    return response.status(200).json(result);
  } catch (error) {
    return myPodiumApiError(response, error, "Unable to submit that Podium Play result.");
  }
}
