import {
  isAdminRequest
} from "../../lib/admin_auth.mjs";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");

    return response.status(405).json({
      error: "Method not allowed."
    });
  }

  return response.status(200).json({
    authenticated: isAdminRequest(request)
  });
}