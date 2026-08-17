import {
  requireGuardianUser,
  guardianApiError
} from "../../lib/guardian_auth.mjs";
import { getGuardianMe } from "../../lib/guardian_access_service.mjs";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await requireGuardianUser(request);
    const data = await getGuardianMe(user.id);
    return response.status(200).json({ user: { id: user.id, email: user.email }, ...data });
  } catch (error) {
    return guardianApiError(
      response,
      error,
      "The account request could not be completed."
    );
  }
}
