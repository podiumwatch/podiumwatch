import {
  requireGuardianUser,
  guardianApiError
} from "../../lib/guardian_auth.mjs";
import { getGuardianRaces } from "../../lib/guardian_access_service.mjs";

// Deliberately never returns race_coach_notes, and never another
// participant's goals/targets -- see
// lib/guardian_access_service.mjs's getGuardianRaces() header comment.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requireGuardianUser(request);
    const data = await getGuardianRaces(user.id);
    return response.status(200).json(data);
  } catch (error) {
    return guardianApiError(
      response,
      error,
      "The races request could not be completed."
    );
  }
}
