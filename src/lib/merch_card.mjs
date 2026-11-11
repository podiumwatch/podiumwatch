import merch from "../data/merch.json" with { type: "json" };

// Podium Watch Shop card (2026-11-11, from the merch handoff). Product
// tabs (XC Crewneck, Track Crewneck, Track Tee), 4 color swatches each,
// a light tint of the garment color behind it, and the real price, sizes
// and store link for each color from src/data/merch.json. No cycling:
// the visitor picks. public/scripts/merch-card.js runs it in the browser.
// Every link goes through /go/merch/{placement}/?p=&c= so clicks count in
// the sponsor report and carry utm_content (lib/merch_service.mjs).
//
// Placements (src/data/sponsors.json, sponsor "merch"):
//   vote-page   awards hub and above the finalists on each ballot page
//   ballot      after the finalists, before the vote button
//   after-vote  the larger card under "Vote counted"
//   story-end   end of story pages (state recaps included)
//   results-end end of the state, regional and district results hubs
//   rankings-end bottom of rankings pages (never above the presenting
//               sponsors, never inside a list)
//   wrapped     Podium Watch Wrapped pages
//   nav         "Shop" in the menus and footer (store home)
// Never on admin, account, form or OATCCC poll pages.

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const merchConfig = merch;
export const merchEnabled = () => Boolean(merch.enabled) && merch.products.some((p) => p.colors.length);

// --- Color --------------------------------------------------------------
const rgb = (hex) => { const h = String(hex).replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const toHex = (values) => `#${values.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
// mix(hex, white, whitePct): whitePct of white, the rest the color.
export const mixWhite = (hex, whitePct) => toHex(rgb(hex).map((v) => v * (1 - whitePct / 100) + 255 * (whitePct / 100)));
const luminance = (hex) => { const [r, g, b] = rgb(hex).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrastRatio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

export const MERCH_TEXT = "#141414";
// The card background for a garment color: a light tint (78% and 64%
// white), and a text color with at least 4.5:1 on the darker end. If the
// usual text color falls short, the text gets darker, never the tint.
export function merchTint(hex) {
  const bg = mixWhite(hex, 78);
  const bg2 = mixWhite(hex, 64);
  let fg = MERCH_TEXT;
  if (Math.min(contrastRatio(fg, bg), contrastRatio(fg, bg2)) < 4.5) fg = "#000000";
  return { bg, bg2, fg };
}

// --- Products -------------------------------------------------------------
// XC Crewneck first through Dec. 31, 2026 (Eastern), then Track Crewneck.
export function defaultProductId(now = new Date()) {
  const d = merch.default_product;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
  return today <= d.until ? d.before : d.after;
}

const sizeRange = (sizes) => (sizes.length ? `${sizes[0]}–${sizes.at(-1)}` : "");
export const merchLine = (product) => `${product.price["S-XL"]} · ${merch.line.replace("{sizes}", sizeRange(product.sizes))}`;
// "3XL not available in Maroon" for each size the store doesn't sell in a color.
export function unavailableNote(product, colorName) {
  const sizes = (product.unavailable || []).map((entry) => String(entry)).filter((entry) => entry.startsWith(`${colorName} `)).map((entry) => entry.slice(colorName.length + 1));
  return sizes.length ? `${sizes.join(", ")} not available in ${colorName}` : "";
}
export const colorSlug = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function merchGoHref(placement, productId, color, from) {
  const params = new URLSearchParams({ p: productId, ...(color ? { c: colorSlug(color) } : {}), ...(from ? { from } : {}) });
  return `/go/merch/${encodeURIComponent(placement)}/?${params.toString()}`;
}

// The data the browser needs (short keys keep it small).
export function merchClientData() {
  return {
    d: merch.default_product,
    av: merch.after_vote_headline,
    p: merch.products.filter((p) => p.colors.length).map((p) => ({
      id: p.id, tab: p.tab, t: p.title, line: merchLine(p), b: p.button,
      c: p.colors.map((c) => { const tint = merchTint(c.hex); return [c.name, c.image, tint.bg, tint.bg2, tint.fg, c.hex, colorSlug(c.name), unavailableNote(p, c.name)]; })
    }))
  };
}

export function merchCardHtml({ placement = "vote-page", from = "", large = false, now = new Date() } = {}) {
  if (!merchEnabled()) return "";
  const products = merch.products.filter((p) => p.colors.length);
  const product = products.find((p) => p.id === defaultProductId(now)) || products[0];
  const color = product.colors[0];
  const tint = merchTint(color.hex);
  const href = merchGoHref(placement, product.id, color.name, from);
  const note = unavailableNote(product, color.name);
  const tabs = products.map((p) => `<button type="button" role="tab" class="pwm-tab" data-pwm-tab="${esc(p.id)}" aria-selected="${p.id === product.id}"${p.id === product.id ? "" : ' tabindex="-1"'}>${esc(p.tab)}</button>`).join("");
  const swatches = product.colors.map((c, i) => `<button type="button" role="radio" class="pwm-swatch" style="--sw:${esc(c.hex)}" data-pwm-swatch="${i}" aria-label="${esc(c.name)}" aria-checked="${i === 0}"${i === 0 ? "" : ' tabindex="-1"'}></button>`).join("");
  const headline = large ? merch.after_vote_headline : product.title;
  return `<aside class="pwm${large ? " pwm-large" : ""}" data-pwm data-pwm-placement="${esc(placement)}" data-pwm-from="${esc(from)}" data-pwm-product="${esc(product.id)}" aria-label="${esc(merch.label)}" style="--pwm-bg:${tint.bg};--pwm-bg2:${tint.bg2};--pwm-fg:${tint.fg}">
  <div class="pwm-card">
    <div class="pwm-tabs" role="tablist" aria-label="Products">${tabs}</div>
    <div class="pwm-body">
      <a class="pwm-photo" href="${esc(href)}" target="_blank" rel="sponsored noopener" data-pwm-link aria-label="${esc(`${product.title}, ${color.name}, at the ${merch.label}`)}">
        <img class="is-on" src="${esc(color.image)}" alt="${esc(`${product.title} in ${color.name}`)}" width="1000" height="1000" loading="lazy" decoding="async" data-pwm-img>
        <img src="${esc(color.image)}" alt="" width="1000" height="1000" loading="lazy" decoding="async" data-pwm-img aria-hidden="true">
      </a>
      <div class="pwm-text">
        <span class="pwm-label">${esc(merch.eyebrow)}</span>
        <h3 class="pwm-head" data-pwm-head>${esc(headline)}</h3>
        ${large ? `<p class="pwm-title" data-pwm-title>${esc(product.title)}</p>` : ""}
        <p class="pwm-line" data-pwm-line>${esc(merchLine(product))}</p>
        <p class="pwm-color" data-pwm-color>Color: ${esc(color.name)}</p>
        <div class="pwm-swatches" role="radiogroup" aria-label="Colors" data-pwm-swatches>${swatches}</div>
        <p class="pwm-note" data-pwm-note${note ? "" : " hidden"}>${esc(note)}</p>
        <a class="pwm-button" href="${esc(href)}" target="_blank" rel="sponsored noopener" data-pwm-link data-pwm-button>${esc(product.button)}</a>
      </div>
    </div>
  </div>
</aside>`;
}

// One <script> pair per page that has any card (data + behavior).
export function merchScripts() {
  if (!merchEnabled()) return "";
  return `<script type="application/json" data-pwm-data>${JSON.stringify(merchClientData()).replaceAll("<", "\\u003c")}</script>
  <script src="/scripts/merch-card.js" defer></script>`;
}

// A card with its styles and scripts, for pages that don't already load
// them (stories, results hubs, rankings): one call at the end of the page.
export function merchSection({ placement, from = "" } = {}) {
  if (!merchEnabled()) return "";
  return `<style>${merchStyles}</style><section class="pwm-section" aria-label="${esc(merch.label)}"><div class="container pwm-section-inner">${merchCardHtml({ placement, from })}</div></section>${merchScripts()}`;
}

export const merchStyles = `
  @property --pwm-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
  .pwm { margin: 0 auto; max-width: 820px; border-radius: 18px; padding: 3px; background: conic-gradient(from var(--pwm-angle), #0faf68, #f2c94c, #ec4899, #3b82f6, #0faf68); animation: pwm-spin 6s linear infinite; transition: transform .25s ease, box-shadow .25s ease; contain: layout paint; }
  .pwm.is-paused { animation-play-state: paused; }
  .pwm:hover, .pwm:focus-within { transform: translateY(-3px); box-shadow: 0 14px 30px rgba(0,0,0,.18); }
  @keyframes pwm-spin { to { --pwm-angle: 360deg; } }
  .pwm-card { display: grid; gap: 10px; padding: 12px 14px 14px; border-radius: 15px; background: linear-gradient(135deg, var(--pwm-bg), var(--pwm-bg2)); color: var(--pwm-fg); transition: background .4s ease, color .4s ease; }
  .pwm-tabs { display: flex; gap: 4px; padding: 3px; border-radius: 999px; background: rgba(255,255,255,.55); }
  .pwm-tab { flex: 1 1 0; min-width: 0; min-height: 38px; padding: 5px 6px; border: 0; border-radius: 999px; background: transparent; color: inherit; font: inherit; font-size: .76rem; font-weight: 850; line-height: 1.1; cursor: pointer; }
  .pwm-tab[aria-selected="true"] { background: var(--pwm-fg); color: #fff; }
  .pwm-body { display: grid; grid-template-columns: 1fr; gap: 10px; }
  .pwm-photo { position: relative; display: block; height: 200px; }
  .pwm-photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; opacity: 0; transition: opacity .15s ease; mix-blend-mode: multiply; }
  .pwm-photo img.is-on { opacity: 1; }
  .pwm-text { display: grid; gap: 5px; align-content: start; min-width: 0; }
  .pwm-label { font-size: .7rem; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; }
  .pwm-head { margin: 0; font-size: clamp(1.15rem, 4.6vw, 1.45rem); line-height: 1.1; color: inherit; }
  .pwm-title { margin: 0; font-size: .95rem; font-weight: 800; }
  .pwm-line { margin: 0; font-size: .86rem; font-weight: 650; line-height: 1.35; }
  .pwm-color { margin: 2px 0 0; font-size: .86rem; font-weight: 850; }
  .pwm-swatches { display: flex; flex-wrap: wrap; gap: 10px; padding: 4px 2px; }
  .pwm-swatch { flex: none; width: 38px; height: 38px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.3); background: var(--sw); cursor: pointer; padding: 0; transition: transform .12s ease, box-shadow .12s ease; }
  .pwm-swatch:hover { transform: scale(1.08); }
  .pwm-swatch[aria-checked="true"] { box-shadow: 0 0 0 3px var(--pwm-fg); }
  .pwm-note { margin: 0; font-size: .8rem; font-weight: 700; }
  .pwm-button { position: relative; overflow: hidden; justify-self: start; display: inline-flex; align-items: center; margin-top: 4px; padding: 11px 18px; border-radius: 999px; background: var(--pwm-fg); color: #fff; font-weight: 900; font-size: .92rem; text-decoration: none; white-space: nowrap; }
  .pwm-button::after { content: ""; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,.4) 50%, transparent 70%); transform: translateX(-120%); }
  .pwm:hover .pwm-button::after, .pwm:focus-within .pwm-button::after, .pwm-button:active::after { transform: translateX(120%); transition: transform .7s ease; }
  .pwm-button:focus-visible, .pwm-swatch:focus-visible, .pwm-photo:focus-visible, .pwm-tab:focus-visible { outline: 3px solid var(--pwm-fg); outline-offset: 2px; }
  .pwm-large { margin-top: 12px; }
  .pwm-tabs { border-radius: 22px; }
  .pwm-tab { border-radius: 18px; }
  .pwm-section { padding-block: 8px 32px; }
  .pwm-section-inner { max-width: 760px; }
  @media (min-width: 700px) {
    .pwm-card { padding: 14px 20px 18px; }
    .pwm-body { grid-template-columns: 240px minmax(0, 1fr); gap: 22px; align-items: center; }
    .pwm-photo { height: 240px; }
    .pwm-tab { font-size: .86rem; }
  }
  @media (prefers-reduced-motion: reduce) {
    .pwm { animation: none; transition: none; }
    .pwm:hover, .pwm:focus-within { transform: none; }
    .pwm-card, .pwm-photo img, .pwm-swatch { transition: none; }
    .pwm:hover .pwm-button::after, .pwm:focus-within .pwm-button::after { transition: none; transform: translateX(-120%); }
  }
`;
