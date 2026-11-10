import merch from "../data/merch.json" with { type: "json" };

// Podium Watch Store card for the 2026 awards voting pages (Zachary,
// 2026-11-10). Placed below the finalists and vote button, never above
// them, never a pop-up. One card cycles through the products and their
// colors every 4 seconds (public/scripts/merch-card.js); the background
// follows the color showing. Only the button or a tap on the photo leaves
// the page, through /go/merch/{placement}/ so clicks count in the sponsor
// report. Settings: src/data/merch.json (+ the admin on/off switch).
//   placement "vote-page": the regular card; "after-vote": the larger card
//   shown in the vote confirmation.

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const merchConfig = merch;
export const merchEnabled = () => Boolean(merch.enabled) && merch.products.some((p) => p.colors.length);

export function merchGoHref(placement, productId, from) {
  return `/go/merch/${encodeURIComponent(placement)}/?p=${encodeURIComponent(productId)}${from ? `&from=${encodeURIComponent(from)}` : ""}`;
}

// The data the browser cycles through (short keys keep it small).
export function merchClientData() {
  return { ms: merch.cycle_ms || 4000, p: merch.products.filter((p) => p.colors.length).map((p) => ({ id: p.id, n: p.name, c: p.colors.map((c) => [c.name, c.image, c.bg, c.bg2, c.fg, c.hex]) })) };
}

export function merchCardHtml({ placement = "vote-page", from = "", large = false } = {}) {
  if (!merchEnabled()) return "";
  const product = merch.products.find((p) => p.colors.length);
  const color = product.colors[0];
  const href = merchGoHref(placement, product.id, from);
  const dots = product.colors.map((c, i) => `<button type="button" class="pwm-dot${i === 0 ? " is-on" : ""}" style="--dot:${esc(c.hex)}" data-pwm-dot="${i}" aria-label="${esc(c.name)}"${i === 0 ? ' aria-pressed="true"' : ' aria-pressed="false"'}></button>`).join("");
  return `<aside class="pwm${large ? " pwm-large" : ""}" data-pwm data-pwm-placement="${esc(placement)}" data-pwm-from="${esc(from)}" aria-label="${esc(merch.label)}" style="--pwm-bg:${esc(color.bg)};--pwm-bg2:${esc(color.bg2)};--pwm-fg:${esc(color.fg)}">
  <div class="pwm-card">
    <a class="pwm-photo" href="${esc(href)}" target="_blank" rel="sponsored noopener" data-pwm-link aria-label="${esc(`${product.name} at the ${merch.label}`)}">
      <img class="is-on" src="${esc(color.image)}" alt="${esc(`${product.name}, ${color.name}`)}" width="480" height="480" loading="lazy" decoding="async" data-pwm-img>
      <img src="${esc(color.image)}" alt="" width="480" height="480" loading="lazy" decoding="async" data-pwm-img aria-hidden="true">
    </a>
    <div class="pwm-text">
      <span class="pwm-label">${esc(merch.label)}</span>
      <h3 class="pwm-head">${esc(large ? merch.after_vote_headline : merch.headline)}</h3>
      <p class="pwm-sub">${esc(merch.subline)}</p>
      <p class="pwm-now" data-pwm-now aria-live="off">${esc(product.name)} &middot; ${esc(color.name)}</p>
      <div class="pwm-dots" role="group" aria-label="Colors" data-pwm-dots>${dots}</div>
      <a class="pwm-button" href="${esc(href)}" target="_blank" rel="sponsored noopener" data-pwm-link>${esc(merch.button)}</a>
    </div>
  </div>
</aside>`;
}

export const merchStyles = `
  @property --pwm-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
  .pwm { --pwm-h: 268px; margin: 0; border-radius: 18px; padding: 3px; background: conic-gradient(from var(--pwm-angle), #0faf68, #f2c94c, #ec4899, #3b82f6, #0faf68); animation: pwm-spin 6s linear infinite; transition: transform .25s ease, box-shadow .25s ease; contain: layout paint; }
  .pwm.is-paused, .pwm.is-static { animation-play-state: paused; }
  .pwm:hover, .pwm:focus-within { transform: translateY(-3px); box-shadow: 0 14px 30px rgba(0,0,0,.18); }
  @keyframes pwm-spin { to { --pwm-angle: 360deg; } }
  .pwm-card { height: var(--pwm-h); box-sizing: border-box; display: grid; grid-template-columns: minmax(0, 42%) minmax(0, 1fr); gap: 14px; align-items: center; padding: 14px 16px; border-radius: 15px; background: linear-gradient(135deg, var(--pwm-bg), var(--pwm-bg2)); color: var(--pwm-fg); transition: background .8s ease, color .8s ease; overflow: hidden; }
  .pwm-photo { position: relative; display: block; height: 100%; min-height: 0; }
  .pwm-photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; opacity: 0; transition: opacity .8s ease; filter: drop-shadow(0 8px 14px rgba(0,0,0,.22)); }
  .pwm-photo img.is-on { opacity: 1; }
  .pwm-text { display: grid; gap: 6px; align-content: center; min-width: 0; }
  .pwm-label { font-size: .7rem; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; opacity: .85; }
  .pwm-head { margin: 0; font-size: clamp(1.25rem, 4.6vw, 1.6rem); line-height: 1.05; color: inherit; }
  .pwm-sub { margin: 0; font-size: .86rem; font-weight: 650; line-height: 1.3; }
  .pwm-now { margin: 0; font-size: .76rem; font-weight: 800; opacity: .9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pwm-dots { display: flex; gap: 6px; overflow-x: auto; padding: 3px 2px 5px; scrollbar-width: thin; min-height: 32px; box-sizing: border-box; }
  .pwm-dot { flex: none; width: 24px; height: 24px; border-radius: 50%; border: 2px solid rgba(255,255,255,.85); box-shadow: 0 0 0 1px rgba(0,0,0,.35); background: var(--dot); cursor: pointer; padding: 0; }
  .pwm-dot.is-on { box-shadow: 0 0 0 2px var(--pwm-fg); transform: scale(1.12); }
  .pwm-button { position: relative; overflow: hidden; justify-self: start; display: inline-flex; align-items: center; padding: 10px 16px; border-radius: 999px; background: var(--pwm-fg); color: var(--pwm-bg); font-weight: 900; font-size: .9rem; text-decoration: none; }
  .pwm-button::after { content: ""; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,.55) 50%, transparent 70%); transform: translateX(-120%); }
  .pwm:hover .pwm-button::after, .pwm:focus-within .pwm-button::after, .pwm-button:active::after { transform: translateX(120%); transition: transform .7s ease; }
  .pwm-button:focus-visible, .pwm-dot:focus-visible, .pwm-photo:focus-visible { outline: 3px solid var(--pwm-fg); outline-offset: 2px; }
  .pwm-button { white-space: nowrap; }
  .pwm-large { --pwm-h: 340px; margin-top: 12px; }
  .pwm-large .pwm-card { grid-template-columns: minmax(0, 34%) minmax(0, 1fr); }
  .pwm-large .pwm-head { font-size: clamp(1.3rem, 5.2vw, 2rem); }
  @media (min-width: 700px) { .pwm { --pwm-h: 250px; } .pwm-large { --pwm-h: 300px; } .pwm-card, .pwm-large .pwm-card { grid-template-columns: 220px minmax(0, 1fr); gap: 22px; padding: 16px 22px; } }
  @media (prefers-reduced-motion: reduce) {
    .pwm { animation: none; transition: none; }
    .pwm:hover, .pwm:focus-within { transform: none; }
    .pwm-card, .pwm-photo img { transition: none; }
    .pwm:hover .pwm-button::after, .pwm:focus-within .pwm-button::after { transition: none; transform: translateX(-120%); }
  }
`;
