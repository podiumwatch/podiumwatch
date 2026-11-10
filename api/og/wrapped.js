import { ImageResponse } from "@vercel/og";
import { loadWrapped, wrappedIsLive } from "../../lib/wrapped_service.mjs";
import { wrappedCard } from "../../lib/og/wrapped_card.mjs";
import { cardFonts } from "../../lib/og/front_page_card.mjs";
import { isAdminRequest } from "../../lib/admin_auth.mjs";

// Public: Podium Watch Wrapped share image (WO-36).
// GET ?slug=<athlete slug>&size=story|post[&download=1]
// Only for public profiles with at least 3 public 2026 results, and only
// after the admin launch date (an admin can preview before it).

export default async function handler(request, response) {
  const slug = String(request.query?.slug || "").toLowerCase();
  const size = request.query?.size === "story" ? "story" : "post";
  if (!/^[a-z0-9-]{1,200}$/.test(slug)) return response.status(400).json({ error: "Missing athlete." });
  try {
    const admin = isAdminRequest(request);
    if (!admin && !(await wrappedIsLive())) return response.status(404).json({ error: "Podium Watch Wrapped isn't out yet." });
    const w = await loadWrapped(slug);
    if (!w || w.merged || w.private || !w.eligible) return response.status(404).json({ error: "No Wrapped card for this athlete." });
    const { element, width, height } = wrappedCard(w, { size });
    const png = Buffer.from(await new ImageResponse(element, { width, height, fonts: cardFonts() }).arrayBuffer());
    response.setHeader("Content-Type", "image/png");
    response.setHeader("Cache-Control", admin ? "private, no-store" : "public, s-maxage=3600, stale-while-revalidate=86400");
    if (request.query?.download) response.setHeader("Content-Disposition", `attachment; filename="podium-watch-wrapped-2026-${slug}-${size === "story" ? "1080x1920" : "1080x1350"}.png"`);
    return response.status(200).send(png);
  } catch (error) {
    console.error("Wrapped image error:", error);
    return response.status(500).json({ error: "The image could not be made." });
  }
}
