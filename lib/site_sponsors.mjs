import fs from "node:fs";

// Site sponsors (WO-25): who sponsors which pages, shared by the build
// (the "Presented by" slot) and the API (/go/ click redirects and the
// admin Sponsor Report). Source of truth: src/data/sponsors.json.
// Sponsors never appear on OATCCC poll pages (Zachary's rule), and a
// sponsor with no url is shown by name only, never with an invented link.

const sponsorsUrl = new URL("../src/data/sponsors.json", import.meta.url);
export const SPONSOR_FREE_PREFIXES = ["/rankings/oatccc/"];

let cached = null;
export function loadSiteSponsors() {
  if (!cached) cached = JSON.parse(fs.readFileSync(sponsorsUrl, "utf8"));
  return cached;
}

// Pure: the sponsor placement for a page path, or null.
export function placementForPath(pathname, sponsors = loadSiteSponsors()) {
  const path = String(pathname || "");
  if (SPONSOR_FREE_PREFIXES.some((prefix) => path.startsWith(prefix))) return null;
  for (const sponsor of sponsors) {
    for (const placement of sponsor.placements || []) {
      if ((placement.paths || []).some((prefix) => path.startsWith(prefix))) return { sponsor, placement };
    }
  }
  return null;
}

export function findPlacement(sponsorId, placementId, sponsors = loadSiteSponsors()) {
  const sponsor = sponsors.find((item) => item.id === sponsorId);
  const placement = sponsor?.placements?.find((item) => item.id === placementId);
  return sponsor && placement ? { sponsor, placement } : null;
}

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// The "Presented by" slot for a page, or "" when the page has none.
// Links go through /go/{sponsor}/{placement}/ so clicks are counted.
export function sponsorSlotHtml(pathname, sponsors = loadSiteSponsors()) {
  const match = placementForPath(pathname, sponsors);
  if (!match) return "";
  const { sponsor, placement } = match;
  const name = escapeHtml(sponsor.name);
  const label = sponsor.url
    ? `<a href="/go/${encodeURIComponent(sponsor.id)}/${encodeURIComponent(placement.id)}/?from=${encodeURIComponent(pathname)}" rel="sponsored noopener" target="_blank">${name}</a>`
    : `<strong>${name}</strong>`;
  return `<aside class="sponsor-slot" data-sponsor="${escapeHtml(sponsor.id)}" data-placement="${escapeHtml(placement.id)}"><span class="sponsor-slot-label">Presented by</span> ${label}</aside>`;
}
