import {
  clearAdminSessionCookie
} from "../../lib/admin_auth.mjs";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");

    return response.status(405).json({
      error: "Method not allowed."
    });
  }

  response.setHeader(
    "Set-Cookie",
    clearAdminSessionCookie(request)
  );

  return response.status(200).json({
    authenticated: false
  });
}