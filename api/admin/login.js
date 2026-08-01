import {
  createAdminSessionCookie,
  verifyAdminPassword
} from "../../lib/admin_auth.mjs";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");

    return response.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const body =
      typeof request.body === "string"
        ? JSON.parse(request.body)
        : request.body || {};

    const password = String(body.password || "");

    if (!verifyAdminPassword(password)) {
      return response.status(401).json({
        error: "Incorrect password."
      });
    }

    response.setHeader(
      "Set-Cookie",
      createAdminSessionCookie(request)
    );

    return response.status(200).json({
      authenticated: true
    });
  } catch (error) {
    console.error("Admin login error:", error);

    return response.status(500).json({
      error: "Unable to sign in right now."
    });
  }
}