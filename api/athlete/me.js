import {
  requireAthleteUser,
  athleteApiError
} from "../../lib/athlete_auth.mjs";
import { getAthleteMe } from "../../lib/athlete_access_service.mjs";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requireAthleteUser(request);
    const data = await getAthleteMe(user.id);
    return response.status(200).json({ user: { id: user.id, email: user.email }, ...data });
  } catch (error) {
    return athleteApiError(
      response,
      error,
      "The account request could not be completed."
    );
  }
}
