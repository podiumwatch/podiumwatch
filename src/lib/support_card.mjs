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
// Zachary's Support arch logos (2026-11-11), trimmed and resized from
// support-pw-arch-BLACK/WHITE-transparent.png: black on the light card,
// white on the dark /support/ hero.
export const SUPPORT_LOGO_BLACK = "/images/branding/support-pw-arch-black.webp";
export const SUPPORT_LOGO_WHITE = "/images/branding/support-pw-arch-white.webp";
export const SUPPORT_PLACEMENTS = ["awards-hub", "after-vote", "after-vote-panel", "banquet", "wrapped", "athlete", "support-page"];

// After-vote support panel (Zachary, 2026-11-11): slides in under "Vote
// counted" the first time a browser votes, inside the vote section (not a
// modal), with a close button. Copy exactly as given.
export const SUPPORT_PANEL_COPY = {
  title: "Support Podium Watch",
  body: "If you've enjoyed our coverage of Ohio cross country and track runners, consider a one-time contribution. We truly appreciate your support and want to keep Podium Watch the best Ohio XC and track coverage in the state.",
  button: "Support Podium Watch",
  small: "Not tax-deductible."
};

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
    <img class="pws-logo" src="${SUPPORT_LOGO_BLACK}" width="600" height="643" alt="" loading="lazy" decoding="async">
    <div class="pws-body">
    <span class="pws-label">Support Podium Watch</span>
    <h3 class="pws-head">${large ? "Vote counted. Help keep it free." : "Keep Ohio running coverage free."}</h3>
    <p class="pws-text">Results, rankings and profiles for every Ohio runner stay free. Support helps pay for photographers and servers.</p>
    <div class="pws-actions">
      <a class="pws-button" href="${esc(supportGoHref(placement, { from }))}"${external}>Support Podium Watch</a>
      <a class="pws-more" href="${SUPPORT_PAGE}">Why it matters</a>
    </div>
    <p class="pws-note">${esc(support.note)}</p>
    </div>
  </div>
</aside>`;
}

// Shown once per browser by public/scripts/support-card.js on the first vote.
export function supportPanelHtml({ from = "" } = {}) {
  if (!supportEnabled()) return "";
  const external = hasOneTime() ? ' target="_blank" rel="noopener"' : "";
  return `<div class="pws-panel" data-pws-panel role="region" aria-labelledby="pws-panel-title" hidden>
  <button type="button" class="pws-panel-close" data-pws-panel-close aria-label="Close">✕</button>
  <img class="pws-panel-logo" src="${SUPPORT_LOGO_BLACK}" width="600" height="643" alt="" loading="lazy" decoding="async">
  <div class="pws-panel-body">
    <h3 class="pws-panel-title" id="pws-panel-title">${esc(SUPPORT_PANEL_COPY.title)}</h3>
    <p class="pws-panel-text">${esc(SUPPORT_PANEL_COPY.body)}</p>
    <a class="pws-button" href="${esc(supportGoHref("after-vote-panel", { from }))}"${external}>${esc(SUPPORT_PANEL_COPY.button)}</a>
    <p class="pws-note">${esc(SUPPORT_PANEL_COPY.small)}</p>
  </div>
</div>`;
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
  .pws-card { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 14px; align-items: start; padding: 16px 16px 14px; border-radius: 15px; background: linear-gradient(135deg, #f6f4ee, #e6f5ec); color: #0d2a1d; }
  .pws-logo { width: 100%; height: auto; }
  .pws-body { display: grid; gap: 8px; min-width: 0; }
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
  .pws-panel { position: relative; display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 14px; align-items: start; margin: 12px 0 4px; padding: 16px 44px 14px 16px; border: 2px solid #0faf68; border-radius: 16px; background: linear-gradient(135deg, #f6f4ee, #e6f5ec); color: #0d2a1d; animation: pws-slide .35s ease-out both; }
  .pws-panel[hidden] { display: none; }
  @keyframes pws-slide { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: none; } }
  .pws-panel-logo { width: 100%; height: auto; }
  .pws-panel-body { display: grid; gap: 8px; justify-items: start; min-width: 0; }
  .pws-panel-title { margin: 0; font-size: 1.2rem; line-height: 1.15; color: inherit; }
  .pws-panel-text { margin: 0; font-size: .92rem; font-weight: 600; line-height: 1.45; max-width: 62ch; }
  .pws-panel-close { position: absolute; top: 6px; right: 6px; width: 40px; height: 40px; border: 0; border-radius: 50%; background: transparent; color: #0d2a1d; font: inherit; font-size: 1.1rem; font-weight: 900; cursor: pointer; }
  .pws-panel-close:hover { background: rgba(8,120,74,.12); }
  .pws-panel-close:focus-visible { outline: 3px solid #08784a; outline-offset: 1px; }
  @media (max-width: 699px) {
    .pws-panel { grid-template-columns: 56px minmax(0, 1fr); align-items: center; row-gap: 10px; }
    .pws-panel-body { display: contents; }
    .pws-panel-text, .pws-panel .pws-button, .pws-panel .pws-note { grid-column: 1 / -1; }
    .pws-panel .pws-button { justify-self: start; white-space: nowrap; }
  }
  @media (min-width: 700px) { .pws-panel { grid-template-columns: 96px minmax(0, 1fr); gap: 20px; padding: 18px 52px 16px 20px; } }
  @media (prefers-reduced-motion: reduce) { .pws-panel { animation: none; } }
  @media (min-width: 700px) { .pws-card { grid-template-columns: 120px minmax(0, 1fr); gap: 22px; align-items: center; padding: 18px 22px; } }
  @media (prefers-reduced-motion: reduce) { .pws { transition: none; } .pws:hover, .pws:focus-within { transform: none; } }
  @media print { .pws, .pws-section { display: none !important; } }
`;
