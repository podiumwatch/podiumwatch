import { ImageResponse } from "@vercel/og";
import { cardFonts } from "../../lib/og/front_page_card.mjs";
import { awardsCategoryCard, awardsFinalistCard } from "../../lib/og/awards_card.mjs";
import { finalistLogo, loadShareCategory, logoDataUrl } from "../../lib/awards_share_service.mjs";
import { site } from "../../src/config/site.mjs";

// Public: 2026 awards share image, 1200x630.
// GET ?category=<slug>[&finalist=<nominee key>]&v=<state+version>
// The page's share tags set "v" (lib/awards_share.mjs shareImageUrl), so a
// new state (VOTE NOW, VOTING CLOSED, WINNER) or finalist list is a new
// URL. Cached at the edge; real finalist rows only.

export default async function handler(request, response) {
  try {
    const data = await loadShareCategory(request.query?.category);
    if (!data) return response.status(404).json({ error: "No such award category." });
    const { category, share } = data;
    const key = String(request.query?.finalist || "");
    let card;
    if (key) {
      const finalist = share.finalists.find((item) => item.key === key);
      if (!finalist) return response.status(404).json({ error: "No such finalist." });
      const logo = finalistLogo(finalist, category.award);
      card = awardsFinalistCard(category, share, finalist, logo ? { ...logo, src: await logoDataUrl(logo.base, site.siteUrl) } : null);
    } else {
      const shown = share.state === "winner" && share.winners.length ? share.winners : share.finalists;
      const logos = new Map(await Promise.all(shown.map(async (item) => {
        const logo = finalistLogo(item, category.award);
        return [item.key, logo ? { ...logo, src: await logoDataUrl(logo.base, site.siteUrl) } : null];
      })));
      card = awardsCategoryCard(category, share, logos);
    }
    const png = Buffer.from(await new ImageResponse(card.element, { width: card.width, height: card.height, fonts: cardFonts() }).arrayBuffer());
    response.setHeader("Content-Type", "image/png");
    response.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return response.status(200).send(png);
  } catch (error) {
    console.error("Awards share image error:", error);
    response.setHeader("Cache-Control", "no-store");
    return response.status(500).json({ error: "The image could not be made." });
  }
}
