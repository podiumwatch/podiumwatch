import { ImageResponse } from "@vercel/og";
import { loadAllLeads, publicLead } from "../../lib/front_page_service.mjs";
import { leadRuns, runLabel } from "../../src/lib/front_page_timeline.mjs";
import { cardFonts, frontPageCard } from "../../lib/og/front_page_card.mjs";
import { site } from "../../src/config/site.mjs";

// Public: "ON THE FRONT PAGE" share card PNG for one lead (WO-43).
// GET ?lead=<id>&size=post|story[&download=1]
// The date is when it led (its real run), or its scheduled start if it
// has not run yet.

export default async function handler(request, response) {
  const leadId = String(request.query?.lead || "");
  const size = request.query?.size === "story" ? "story" : "post";
  try {
    const leads = await loadAllLeads();
    const lead = leads.find((row) => row.id === leadId && row.status !== "cancelled");
    if (!lead) return response.status(404).json({ error: "That front page lead was not found." });
    const run = leadRuns(leads).find((r) => r.lead.id === lead.id);
    const dateLabel = runLabel(run || { startsAt: lead.starts_at, endsAt: lead.starts_at }).replace(/ to now$/, "");
    const { element, width, height } = frontPageCard({ lead: publicLead(lead), dateLabel, size, siteUrl: site.siteUrl, logoUrl: `${site.siteUrl}/images/branding/podium_watch_logo_light.png` });
    const image = new ImageResponse(element, { width, height, fonts: cardFonts() });
    const png = Buffer.from(await image.arrayBuffer());
    response.setHeader("Content-Type", "image/png");
    response.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
    if (request.query?.download) response.setHeader("Content-Disposition", `attachment; filename="front-page-${lead.story_slug}-${size === "story" ? "1080x1920" : "1080x1350"}.png"`);
    return response.status(200).send(png);
  } catch (error) {
    console.error("Front page card error:", error);
    return response.status(500).json({ error: "The card could not be made." });
  }
}
