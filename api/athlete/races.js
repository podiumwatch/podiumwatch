import {
  requireAthleteUser,
  athleteApiError
} from "../../lib/athlete_auth.mjs";
import { getAthleteRaces } from "../../lib/athlete_access_service.mjs";

// Deliberately never returns race_coach_notes -- see
// lib/athlete_access_service.mjs's getAthleteRaces() header comment.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requireAthleteUser(request);
    const data = await getAthleteRaces(user.id);
    return response.status(200).json(data);
  } catch (error) {
    return athleteApiError(
      response,
      error,
      "The races request could not be completed."
    );
  }
}
