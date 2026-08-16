import {
  requireAthleteUser,
  athleteApiError
} from "../../lib/athlete_auth.mjs";
import {
  validateInviteToken,
  redeemInvite
} from "../../lib/athlete_access_service.mjs";

function cleanText(value) {
  return String(value ?? "").trim();
}

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The submitted request is invalid.");
      error.status = 400;
      throw error;
    }
  }
  return request.body || {};
}

// validate_token is public (no account exists yet at that point --
// that's the whole reason invites exist). redeem requires a real,
// just-created-or-existing athlete account, since the invite can only
// be attached to a specific auth user id after they have one.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = parseBody(request);
    const action = cleanText(body.action).toLowerCase();

    if (action === "validate_token") {
      const data = await validateInviteToken(body.token);
      return response.status(200).json(data);
    }

    if (action === "redeem") {
      const user = await requireAthleteUser(request);
      const data = await redeemInvite({
        rawToken: body.token,
        userId: user.id,
        consentConfirmedBy: body.consent_confirmed_by || user.email
      });
      return response.status(200).json(data);
    }

    const error = new Error("Unknown invite action.");
    error.status = 400;
    throw error;
  } catch (error) {
    return athleteApiError(
      response,
      error,
      "The invite request could not be completed."
    );
  }
}
