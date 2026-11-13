import catalog from "../data/merch.json" with { type: "json" };
import settings from "../data/merch-card.json" with { type: "json" };

// Merch card v2, "The Podium Collection" (2026-11-11, MERCH_CARD_HANDOFF).
// One set of four product tabs everywhere (catalog.card_products, in
// order), each product's own colors as swatches, a light tint of the
// garment color behind it, and the real price, sizes and store link for
// each color. Products come from src/data/merch.json, saved exactly as
// collected from the live Amaze store; card copy, UTM tags and the on/off
// flag come from src/data/merch-card.json. public/scripts/merch-card.js
// runs it in the browser. Every link goes through
// /go/merch/{placement}/?p=&c= so clicks count in the sponsor report and
// carry utm_content (lib/merch_service.mjs).
//
// Placements (src/data/sponsors.json, sponsor "merch"):
//   vote-page   awards hub
//   ballot      each award ballot page, below the finalists and the vote
//               button (never above the ballot or between finalists)
//   after-vote  the larger card under "Vote counted"
//   home        homepage, the slim strip near the bottom (merchStripHtml)
//   story-end   end of story pages (state recaps included)
//   results-end end of the state, regional and district results hubs
//   rankings-end bottom of rankings pages (never above the presenting
//               sponsors, never inside a list)
//   wrapped     Podium Watch Wrapped pages
//   nav         "Shop" in the menus and footer (store home)
// Never on admin, account, form or OATCCC poll pages.

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// One object for the rest of the site: settings plus the catalog.
export const merchConfig = { ...settings, products: catalog.products, card_products: catalog.card_products, default_product: catalog.default_product, default_color: catalog.default_color, as_of: catalog.as_of };

// The card's products, in tab order: only ones that exist and have colors.
export const cardProducts = () => (catalog.card_products || []).map((id) => catalog.products.find((p) => p.id === id)).filter((p) => p && p.colors.length);
export const merchEnabled = () => Boolean(settings.enabled) && cardProducts().length > 0;

// --- Color --------------------------------------------------------------
const rgb = (hex) => { const h = String(hex).replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const toHex = (values) => `#${values.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
// mix(hex, white, whitePct): whitePct of white, the rest the color.
export const mixWhite = (hex, whitePct) => toHex(rgb(hex).map((v) => v * (1 - whitePct / 100) + 255 * (whitePct / 100)));
export const luminance = (hex) => { const [r, g, b] = rgb(hex).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
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
// Very light garments (Ivory, White, Ash, Sand) get a thin outline and a
// soft shadow behind the photo so the shirt doesn't melt into the card.
export const LIGHT_GARMENT = 0.55;
export const isLightGarment = (hex) => luminance(hex) >= LIGHT_GARMENT;

// --- Products -------------------------------------------------------------
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
// The store lists sizes in any order; show smallest to largest.
export const orderedSizes = (sizes = []) => [...sizes].sort((a, b) => (SIZE_ORDER.indexOf(a) + 1 || 99) - (SIZE_ORDER.indexOf(b) + 1 || 99));
// "$34.63": the S-XL price exactly as the store lists it.
export function basePrice(product) {
  const match = String(product.price?.["S-XL"] || "").match(/^\$\d+(?:\.\d{2})?/);
  return match ? match[0] : "";
}
const sizeRange = (sizes) => { const list = orderedSizes(sizes); return list.length > 1 ? `Sizes ${list[0]}–${list.at(-1)}` : list.length ? `Size ${list[0]}` : ""; };
// "$34.63 · Sizes S–3XL"
export const merchLine = (product) => [basePrice(product), sizeRange(product.sizes)].filter(Boolean).join(" · ");
export const merchEyebrow = (product) => settings.eyebrow_by_product?.[product.id] || settings.eyebrow;
// The color a product's tab opens on (catalog.default_color), else its first.
export function defaultColorIndex(product) {
  const i = product.colors.findIndex((c) => c.name === catalog.default_color?.[product.id]);
  return i >= 0 ? i : 0;
}
// The tab the card opens on (catalog.default_product), else the first.
export function defaultProductIndex(products = cardProducts()) {
  const i = products.findIndex((p) => p.id === catalog.default_product);
  return i >= 0 ? i : 0;
}
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
// c: [name, image, bg, bg2, fg, hex, slug, unavailable note, light (1/0)]
export function merchClientData() {
  const products = cardProducts();
  return {
    dp: defaultProductIndex(products),
    h: settings.headline,
    av: settings.after_vote_headline,
    b: settings.button,
    l: settings.label,
    p: products.map((p) => ({
      id: p.id, tab: p.tab, t: p.title, line: merchLine(p), e: merchEyebrow(p), dc: defaultColorIndex(p),
      c: p.colors.map((c) => { const tint = merchTint(c.hex); return [c.name, c.image, tint.bg, tint.bg2, tint.fg, c.hex, colorSlug(c.name), unavailableNote(p, c.name), isLightGarment(c.hex) ? 1 : 0]; })
    }))
  };
}

export function merchCardHtml({ placement = "vote-page", from = "", large = false } = {}) {
  if (!merchEnabled()) return "";
  const products = cardProducts();
  const pi = defaultProductIndex(products);
  const product = products[pi];
  const ci = defaultColorIndex(product);
  const color = product.colors[ci];
  const tint = merchTint(color.hex);
  const href = merchGoHref(placement, product.id, color.name, from);
  const note = unavailableNote(product, color.name);
  const tabs = products.map((p, i) => `<button type="button" role="tab" class="pwm-tab" data-pwm-tab="${esc(p.id)}" aria-selected="${i === pi}"${i === pi ? "" : ' tabindex="-1"'}>${esc(p.tab)}</button>`).join("");
  const swatches = product.colors.map((c, i) => `<button type="button" role="radio" class="pwm-swatch" style="--sw:${esc(c.hex)}" data-pwm-swatch="${i}" aria-label="${esc(c.name)}" aria-checked="${i === ci}"${i === ci ? "" : ' tabindex="-1"'}></button>`).join("");
  const headline = large ? settings.after_vote_headline : settings.headline;
  return `<aside class="pwm${large ? " pwm-large" : ""}" data-pwm data-pwm-placement="${esc(placement)}" data-pwm-from="${esc(from)}" data-pwm-product="${esc(product.id)}" aria-label="${esc(settings.label)}" style="--pwm-bg:${tint.bg};--pwm-bg2:${tint.bg2};--pwm-fg:${tint.fg}">
  <div class="pwm-card">
    <div class="pwm-tabs" role="tablist" aria-label="Products">${tabs}</div>
    <div class="pwm-body">
      <a class="pwm-photo${isLightGarment(color.hex) ? " is-light" : ""}" href="${esc(href)}" target="_blank" rel="sponsored noopener" data-pwm-link aria-label="${esc(`${product.title}, ${color.name}, at the ${settings.label}`)}">
        <img class="is-on" src="${esc(color.image)}" alt="${esc(`${product.title} in ${color.name}`)}" width="1000" height="1000" loading="lazy" decoding="async" data-pwm-img>
        <img src="${esc(color.image)}" alt="" width="1000" height="1000" loading="lazy" decoding="async" data-pwm-img aria-hidden="true">
      </a>
      <div class="pwm-text">
        <span class="pwm-label" data-pwm-eyebrow>${esc(merchEyebrow(product))}</span>
        <h3 class="pwm-head">${esc(headline)}</h3>
        <p class="pwm-title" data-pwm-title>${esc(product.title)}</p>
        <p class="pwm-line" data-pwm-line>${esc(merchLine(product))}</p>
        <p class="pwm-color" data-pwm-color>Color: ${esc(color.name)}</p>
        <div class="pwm-swatches" role="radiogroup" aria-label="Colors" data-pwm-swatches>${swatches}</div>
        <p class="pwm-note" data-pwm-note${note ? "" : " hidden"}>${esc(note)}</p>
        <a class="pwm-button" href="${esc(href)}" target="_blank" rel="sponsored noopener" data-pwm-link data-pwm-button>${esc(settings.button)}</a>
      </div>
    </div>
  </div>
</aside>`;
}

// Homepage redesign (step 7, 2026-11-13): one slim dark strip near the
// bottom of the homepage instead of the large card under the lead. The
// default product and color, the same /go/merch/ tracking link, no script.
export function merchStripHtml({ placement = "home", from = "/" } = {}) {
  if (!merchEnabled()) return "";
  const products = cardProducts();
  const product = products[defaultProductIndex(products)];
  const color = product.colors[defaultColorIndex(product)];
  const href = merchGoHref(placement, product.id, color.name, from);
  return `<aside class="pw-shop" aria-label="${esc(settings.label)}">
  <a class="pw-shop-photo" href="${esc(href)}" target="_blank" rel="sponsored noopener" tabindex="-1" aria-hidden="true"><img src="${esc(color.image)}" alt="" width="120" height="120" loading="lazy" decoding="async"></a>
  <div class="pw-shop-text"><p class="pw-shop-eyebrow">${esc(merchEyebrow(product))}</p><h2>${esc(settings.headline)}</h2><p>${esc(`${product.title} in ${color.name}`)} &middot; ${esc(merchLine(product))}</p></div>
  <a class="pw-shop-button" href="${esc(href)}" target="_blank" rel="sponsored noopener">${esc(settings.button)}</a>
</aside>`;
}

// One <script> pair per page that has any card (data + behavior).
export function merchScripts() {
  if (!merchEnabled()) return "";
  return `<script type="application/json" data-pwm-data>${JSON.stringify(merchClientData()).replaceAll("<", "\\u003c")}</script>
  <script src="/scripts/merch-card.js" defer></script>`;
}

// A card with its styles and scripts, for pages that don't already load
// them (homepage, stories, results hubs, rankings): one call per page.
export function merchSection({ placement, from = "" } = {}) {
  if (!merchEnabled()) return "";
  return `<style>${merchStyles}</style><section class="pwm-section" aria-label="${esc(settings.label)}"><div class="container pwm-section-inner">${merchCardHtml({ placement, from })}</div></section>${merchScripts()}`;
}

export const merchStyles = `
  @property --pwm-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
  .pwm { margin: 0 auto; max-width: 820px; border-radius: 18px; padding: 3px; background: conic-gradient(from var(--pwm-angle), #0faf68, #f2c94c, #ec4899, #3b82f6, #0faf68); animation: pwm-spin 6s linear infinite; transition: transform .25s ease, box-shadow .25s ease; contain: layout paint; }
  .pwm.is-paused { animation-play-state: paused; }
  .pwm:hover, .pwm:focus-within { transform: translateY(-3px); box-shadow: 0 14px 30px rgba(0,0,0,.18); }
  @keyframes pwm-spin { to { --pwm-angle: 360deg; } }
  .pwm-card { display: grid; gap: 10px; padding: 12px 14px 14px; border-radius: 15px; background: linear-gradient(135deg, var(--pwm-bg), var(--pwm-bg2)); color: var(--pwm-fg); transition: background .4s ease, color .4s ease; }
  .pwm-tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 3px; padding: 3px; border-radius: 22px; background: rgba(255,255,255,.55); }
  .pwm-tab { min-width: 0; min-height: 40px; padding: 5px 4px; border: 0; border-radius: 18px; background: transparent; color: inherit; font: inherit; font-size: .72rem; font-weight: 850; line-height: 1.1; cursor: pointer; overflow-wrap: anywhere; }
  .pwm-tab[aria-selected="true"] { background: var(--pwm-fg); color: #fff; }
  .pwm-body { display: grid; grid-template-columns: 1fr; gap: 10px; }
  .pwm-photo { position: relative; display: block; height: 210px; border-radius: 14px; transition: box-shadow .2s ease, background .2s ease; }
  .pwm-photo.is-light { background: rgba(255,255,255,.35); box-shadow: inset 0 0 0 1px rgba(0,0,0,.14), 0 6px 18px rgba(0,0,0,.10); }
  .pwm-photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; opacity: 0; transition: opacity .15s ease; }
  .pwm-photo.is-light img { filter: drop-shadow(0 2px 4px rgba(0,0,0,.22)); }
  .pwm-photo img.is-on { opacity: 1; }
  .pwm-text { display: grid; gap: 5px; align-content: start; min-width: 0; }
  .pwm-label { font-size: .7rem; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; }
  .pwm-head { margin: 0; font-size: clamp(1.2rem, 5vw, 1.55rem); line-height: 1.08; color: inherit; text-wrap: balance; }
  .pwm-title { margin: 2px 0 0; font-size: .98rem; font-weight: 800; }
  .pwm-line { margin: 0; font-size: .88rem; font-weight: 650; line-height: 1.35; font-variant-numeric: tabular-nums; }
  .pwm-color { margin: 2px 0 0; font-size: .86rem; font-weight: 850; }
  .pwm-swatches { display: flex; flex-wrap: nowrap; gap: 10px; padding: 4px 2px; }
  .pwm-swatch { flex: none; width: 38px; height: 38px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.3); background: var(--sw); cursor: pointer; padding: 0; transition: transform .12s ease, box-shadow .12s ease; }
  .pwm-swatch:hover { transform: scale(1.08); }
  .pwm-swatch[aria-checked="true"] { box-shadow: 0 0 0 3px var(--pwm-fg); }
  .pwm-note { margin: 0; font-size: .8rem; font-weight: 700; }
  .pwm-button { position: relative; overflow: hidden; justify-self: start; display: inline-flex; align-items: center; margin-top: 4px; padding: 11px 18px; border-radius: 999px; background: var(--pwm-fg); color: #fff; font-weight: 900; font-size: .92rem; text-decoration: none; white-space: nowrap; }
  .pwm-button::after { content: ""; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,.4) 50%, transparent 70%); transform: translateX(-120%); }
  .pwm:hover .pwm-button::after, .pwm:focus-within .pwm-button::after, .pwm-button:active::after { transform: translateX(120%); transition: transform .7s ease; }
  .pwm-button:focus-visible, .pwm-swatch:focus-visible, .pwm-photo:focus-visible, .pwm-tab:focus-visible { outline: 3px solid var(--pwm-fg); outline-offset: 2px; }
  .pwm-large { margin-top: 12px; }
  .pwm-section { padding-block: 8px 32px; }
  .pwm-section-inner { max-width: 760px; }
  @media (min-width: 700px) {
    .pwm-card { padding: 14px 20px 18px; }
    .pwm-body { grid-template-columns: 250px minmax(0, 1fr); gap: 22px; align-items: center; }
    .pwm-photo { height: 250px; }
    .pwm-tab { font-size: .84rem; }
  }
  @media (prefers-reduced-motion: reduce) {
    .pwm { animation: none; transition: none; }
    .pwm:hover, .pwm:focus-within { transform: none; }
    .pwm-card, .pwm-photo, .pwm-photo img, .pwm-swatch { transition: none; }
    .pwm:hover .pwm-button::after, .pwm:focus-within .pwm-button::after { transition: none; transform: translateX(-120%); }
  }
`;
