import { findPlacement } from "../../../lib/site_sponsors.mjs";
import { deviceClass } from "../../../lib/short_links_service.mjs";
import { merchDestination } from "../../../lib/merch_service.mjs";
import { supportDestination } from "../../../src/lib/support_card.mjs";

// Sponsor click redirect (WO-25): /go/{sponsor}/{placement}/?from=/page/
// records one click in site_sponsor_clicks (install/85) and sends the
// visitor to the sponsor's own link from src/data/sponsors.json. A click
// that can't be recorded still redirects; an unknown sponsor or one with
// no link goes home.
// The Podium Watch Shop card (/go/merch/{placement}/?p=&c=) goes to that
// color's own store link with UTM tags (lib/merch_service.mjs).
// Support Podium Watch (/go/support/{placement}/, ?m=monthly) goes to the
// Stripe link in src/data/support.json, or /support/ when none is set.

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  const match = findPlacement(String(request.query?.sponsor || ""), String(request.query?.placement || ""));
  if (!match || !match.sponsor.url) {
    response.setHeader("Location", "/");
    return response.status(302).end();
  }

  const from = String(request.query?.from || "");
  try {
    const { supabaseAdmin } = await import("../../../lib/supabase-admin.mjs");
    const { error } = await supabaseAdmin.from("site_sponsor_clicks").insert({
      sponsor_id: match.sponsor.id,
      placement_id: match.placement.id,
      page_path: /^\/[^\s]{0,299}$/.test(from) ? from : null,
      device_class: deviceClass(request.headers["user-agent"])
    });
    if (error) console.error("Sponsor click not recorded:", error);
  } catch (error) {
    console.error("Sponsor click not recorded:", error);
  }

  const destination = match.sponsor.id === "merch"
    ? merchDestination(String(request.query?.p || ""), String(request.query?.c || ""), match.placement.id)
    : match.sponsor.id === "support"
      ? supportDestination(String(request.query?.m || ""))
      : match.sponsor.url;
  response.setHeader("Location", destination);
  return response.status(302).end();
}
