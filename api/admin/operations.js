import { isAdminRequest } from "../../lib/admin_auth.mjs";
import { getDashboard } from "../../lib/operations_service.mjs";

// Thin handler -- all dashboard/task-building logic lives in
// lib/operations_service.mjs (extracted 2026-08-16 as part of the admin
// redesign so api/admin/dashboard-summary.js can reuse the exact same
// task list for sidebar badges and the needs-attention panel, rather
// than a second implementation of it). This route's own behavior is
// unchanged.
function parseBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("The Operations Center request is invalid.");
      error.status = 400;
      throw error;
    }
  }

  return request.body || {};
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (!isAdminRequest(request)) {
    return response.status(401).json({
      error: "Podium Watch admin sign in required."
    });
  }

  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");

    return response.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const body = request.method === "POST"
      ? parseBody(request)
      : request.query || {};
    const days = [7, 30, 90].includes(Number(body.days))
      ? Number(body.days)
      : 30;
    const dashboard = await getDashboard(days);

    return response.status(200).json(dashboard);
  } catch (error) {
    const status = Number(error?.status) || 500;

    if (status >= 500) {
      console.error("Operations Center route error:", error);
    }

    return response.status(status).json({
      error:
        status < 500
          ? error.message
          : "The Operations Center could not be loaded."
    });
  }
}
