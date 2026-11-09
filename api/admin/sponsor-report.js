import { isAdminRequest } from "../../lib/admin_auth.mjs";
import { sponsorReport, sponsorReportCsv } from "../../lib/sponsor_report_service.mjs";

// Admin only: Sponsor Report (WO-25). POST { month: "YYYY-MM" } returns
// JSON; GET ?month=YYYY-MM&format=csv downloads it.

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!isAdminRequest(request)) return response.status(401).json({ error: "Podium Watch admin sign in required." });

  try {
    if (request.method === "GET" && String(request.query?.format || "") === "csv") {
      const report = await sponsorReport({ month: request.query?.month });
      response.setHeader("Content-Type", "text/csv; charset=utf-8");
      response.setHeader("Content-Disposition", `attachment; filename="podium-watch-sponsor-report-${report.month}.csv"`);
      return response.status(200).send(sponsorReportCsv(report));
    }
    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST");
      return response.status(405).json({ error: "Method not allowed." });
    }
    const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
    return response.status(200).json(await sponsorReport({ month: body.month }));
  } catch (error) {
    console.error("Sponsor report error:", error);
    return response.status(500).json({ error: "The sponsor report could not be loaded." });
  }
}
