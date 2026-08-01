import {
  verifyAdminPassword,
  createAdminSessionCookie,
  clearAdminSessionCookie,
  isAdminRequest
} from "../../lib/admin_auth.mjs";

function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      return {};
    }
  }

  return request.body || {};
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method === "GET") {
    return response.status(200).json({
      authenticated: isAdminRequest(request)
    });
  }

  if (request.method === "POST") {
    const body = parseBody(request);
    const password = String(body.password || "");

    if (password) {
      if (!verifyAdminPassword(password)) {
        return response.status(401).json({
          error: "Incorrect admin password."
        });
      }

      response.setHeader(
        "Set-Cookie",
        createAdminSessionCookie(request)
      );

      return response.status(200).json({
        authenticated: true
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

  response.setHeader("Allow", "GET, POST");

  return response.status(405).json({
    error: "Method not allowed."
  });
}