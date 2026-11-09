import { recordShortLinkHit, resolveShortLink } from "../../lib/short_links_service.mjs";

// Public short links (WO-34): vercel.json rewrites one-segment paths that
// aren't real pages (podiumwatch.org/state/) here. A known, active path
// answers with a temporary 302 (so it can be repointed next season) and
// logs one hit; anything else gets the site's normal 404 page.

export function tagDestination(destination, path) {
  if (!destination.startsWith("/")) return destination;
  const [base, hash = ""] = destination.split("#");
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}utm_medium=short_link&utm_campaign=${encodeURIComponent(path)}${hash ? `#${hash}` : ""}`;
}

async function notFound(request, response) {
  response.setHeader("Cache-Control", "public, s-maxage=60");
  try {
    const host = request.headers["x-forwarded-host"] || request.headers.host || "www.podiumwatch.org";
    const page = await fetch(`https://${host}/404.html`);
    if (page.ok) {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      return response.status(404).send(await page.text());
    }
  } catch {
    // fall through to the plain response
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  return response.status(404).send('<!doctype html><meta charset="utf-8"><title>Page not found | Podium Watch</title><p>Page not found. <a href="/">Go to Podium Watch</a></p>');
}

export default async function handler(request, response) {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.setHeader("Allow", "GET, HEAD");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const path = String(request.query?.path || "");
  let link = null;
  try {
    link = await resolveShortLink(path);
  } catch (error) {
    console.error("Short link lookup failed:", error);
  }
  if (!link) return notFound(request, response);

  if (request.method === "GET") {
    await recordShortLinkHit({ path: link.path, referer: request.headers.referer, userAgent: request.headers["user-agent"] });
  }
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Podium-Short-Link", link.path);
  // Tag site pages with the short link so the visit is credited to it
  // (WO-42). Outside links are sent as they are.
  response.setHeader("Location", tagDestination(link.destination, link.path));
  return response.status(302).end();
}
