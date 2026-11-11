import support from "../data/support.json" with { type: "json" };

// "Support Podium Watch" (2026-11-11). Not "donate": Podium Watch is a
// business and support is not tax-deductible. The Stripe payment links
// live in src/data/support.json; every button goes through
// /go/support/{placement}/ so clicks are counted in site_sponsor_clicks
// (Admin > Sponsor report), then on to Stripe. With no Stripe link set,
// /go/support/ lands on /support/ instead.
//
// The card is the same style family as the Podium Watch Shop card
// (src/lib/merch_card.mjs). On the awards hub and after a vote it takes
// turns with the shop card, never both at once (public/scripts/support-card.js).

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const supportConfig = support;
export const supportEnabled = () => Boolean(support.enabled);
export const SUPPORT_PAGE = "/support/";
export const SUPPORT_PLACEMENTS = ["awards-hub", "after-vote", "banquet", "wrapped", "athlete", "support-page"];

const isStripe = (url) => /^https:\/\/(buy|donate)\.stripe\.com\/[A-Za-z0-9_/-]+$/.test(String(url || ""));
export const hasOneTime = () => isStripe(support.one_time_url);
export const hasMonthly = () => isStripe(support.monthly_url);

// Where /go/support/{placement}/ sends the visitor.
export function supportDestination(kind = "", config = support) {
  const monthly = kind === "monthly" && isStripe(config.monthly_url);
  if (monthly) return config.monthly_url;
  if (isStripe(config.one_time_url)) return config.one_time_url;
  return `https://www.podiumwatch.org${SUPPORT_PAGE}`;
}

export function supportGoHref(placement, { kind = "", from = "" } = {}) {
  const params = new URLSearchParams({ ...(kind === "monthly" ? { m: "monthly" } : {}), ...(from ? { from } : {}) });
  const query = params.toString();
  return `/go/support/${encodeURIComponent(placement)}/${query ? `?${query}` : ""}`;
}

export function supportCardHtml({ placement, from = "", large = false } = {}) {
  if (!supportEnabled()) return "";
  const external = hasOneTime() ? ' target="_blank" rel="noopener"' : "";
  return `<aside class="pws${large ? " pws-large" : ""}" data-pws data-pws-placement="${esc(placement)}" aria-label="Support Podium Watch">
  <div class="pws-card">
    <span class="pws-label">Support Podium Watch</span>
    <h3 class="pws-head">${large ? "Vote counted. Help keep it free." : "Keep Ohio running coverage free."}</h3>
    <p class="pws-text">Results, rankings and profiles for every Ohio runner stay free. Support helps pay for photographers and servers.</p>
    <div class="pws-actions">
      <a class="pws-button" href="${esc(supportGoHref(placement, { from }))}"${external}>Support Podium Watch</a>
      <a class="pws-more" href="${SUPPORT_PAGE}">Why it matters</a>
    </div>
    <p class="pws-note">${esc(support.note)}</p>
  </div>
</aside>`;
}

// For pages that don't load the styles yet: card + styles in one call.
export function supportSection({ placement, from = "" } = {}) {
  if (!supportEnabled()) return "";
  return `<style>${supportStyles}</style><section class="pws-section" aria-label="Support Podium Watch"><div class="container pws-section-inner">${supportCardHtml({ placement, from })}</div></section>`;
}

// Takes turns with the shop card (awards hub, after a vote).
export const supportScripts = () => (supportEnabled() ? `<script src="/scripts/support-card.js" defer></script>` : "");

export const supportStyles = `
  .pws { margin: 0 auto; max-width: 820px; border-radius: 18px; padding: 3px; background: linear-gradient(135deg, #0faf68, #08784a 55%, #0faf68); transition: transform .25s ease, box-shadow .25s ease; }
  .pws:hover, .pws:focus-within { transform: translateY(-3px); box-shadow: 0 14px 30px rgba(0,0,0,.18); }
  .pws-card { display: grid; gap: 8px; padding: 16px 16px 14px; border-radius: 15px; background: linear-gradient(135deg, #f6f4ee, #e6f5ec); color: #0d2a1d; }
  .pws-label { font-size: .7rem; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; color: #08784a; }
  .pws-head { margin: 0; font-size: clamp(1.15rem, 4.6vw, 1.45rem); line-height: 1.1; color: inherit; text-wrap: balance; }
  .pws-text { margin: 0; font-size: .92rem; font-weight: 600; line-height: 1.4; max-width: 60ch; }
  .pws-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin-top: 4px; }
  .pws-button { display: inline-flex; align-items: center; min-height: 44px; padding: 11px 18px; border-radius: 999px; background: #08784a; color: #fff; font-weight: 900; font-size: .92rem; text-decoration: none; }
  .pws-button:hover { background: #065f3a; }
  .pws-more { color: #08784a; font-weight: 800; font-size: .9rem; text-decoration: underline; text-underline-offset: 3px; }
  .pws-note { margin: 2px 0 0; font-size: .78rem; font-weight: 600; color: #3d5248; }
  .pws-button:focus-visible, .pws-more:focus-visible { outline: 3px solid #08784a; outline-offset: 2px; }
  .pws-large { margin-top: 12px; }
  .pws-section { padding-block: 8px 32px; }
  .pws-section-inner { max-width: 760px; }
  @media (min-width: 700px) { .pws-card { padding: 18px 22px; } }
  @media (prefers-reduced-motion: reduce) { .pws { transition: none; } .pws:hover, .pws:focus-within { transform: none; } }
  @media print { .pws, .pws-section { display: none !important; } }
`;
