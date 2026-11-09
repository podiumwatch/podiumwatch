import { isAdminRequest } from "../../lib/admin_auth.mjs";
import { commitmentCardSvg, listCommitments } from "../../lib/commitments_service.mjs";

// Admin only: the 1080x1350 "Committed" share card for one public
// commitment (WO-38), as an SVG download for the post queue.
// GET ?class=2027&id=<activity id>

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!isAdminRequest(request)) return response.status(401).json({ error: "Podium Watch admin sign in required." });
  try {
    const classYear = Number(request.query?.class);
    const rows = await listCommitments({ classYear });
    const row = rows.find((item) => item.id === String(request.query?.id || ""));
    if (!row) return response.status(404).json({ error: "That public commitment was not found for this class." });
    response.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="committed-${row.athlete_slug}.svg"`);
    return response.status(200).send(commitmentCardSvg({ ...row, class_year: classYear }));
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("Commitment card error:", error);
    return response.status(status).json({ error: status < 500 ? error.message : "The card could not be made." });
  }
}
