import { sponsorsPageHtml } from "../../src/pages/sponsors.mjs";
import { publicPartnerData } from "../../lib/partner_page_service.mjs";
import { loadSiteSponsors } from "../../lib/site_sponsors.mjs";
import { site } from "../../src/config/site.mjs";

// /sponsors/ rendered on the server (vercel.json rewrite), so audience
// numbers, packages and prices are in the HTML without JavaScript. If the
// numbers can't be read, the page still renders with "on request" text.

export default async function handler(request, response) {
  let data = null;
  try {
    data = await publicPartnerData();
  } catch (error) {
    console.error("Partner page data error:", error);
  }
  if (!data) {
    const { PARTNER_PACKAGES } = await import("../../lib/partner_page_service.mjs");
    data = { audience: { available: false }, instagram: null, packages: PARTNER_PACKAGES.map((item) => ({ ...item, price: null })) };
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=86400");
  return response.status(200).send(sponsorsPageHtml(site, loadSiteSponsors(), data));
}
