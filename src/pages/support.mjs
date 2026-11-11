import { layout } from "../lib/html.mjs";
import { SUPPORT_LOGO_WHITE, hasMonthly, hasOneTime, supportConfig, supportGoHref } from "../lib/support_card.mjs";

// /support/ (2026-11-11): "Support Podium Watch", never "donate". Podium
// Watch is a business; support is not tax-deductible, and the page says so.
// Plain words and real facts only, no numbers. Buttons go through
// /go/support/support-page/ (counted), then to the Stripe links in
// src/data/support.json. Short link: /support (Vercel's trailing-slash
// redirect sends it here).
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const styles = `
  .sp-hero { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 28px; align-items: center; }
  .sp-logo { width: clamp(110px, 20vw, 190px); height: auto; }
  @media (max-width: 560px) { .sp-hero { grid-template-columns: 1fr; gap: 16px; } .sp-logo { width: 120px; } }
  .sp-wrap { display: grid; gap: 22px; max-width: 760px; }
  .sp-list { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
  .sp-list li { display: grid; gap: 4px; padding: 16px 18px; border-radius: 14px; background: #fff; border: 1px solid rgba(9,9,9,.08); }
  .sp-list strong { font-size: 1.05rem; }
  .sp-list span { color: #3f3f3f; line-height: 1.5; }
  .sp-actions { display: flex; flex-wrap: wrap; gap: 12px; }
  .sp-actions .button { min-height: 48px; }
  .sp-note { margin: 0; font-weight: 700; }
  .sp-small { margin: 0; color: #555; font-size: .92rem; line-height: 1.5; }
  .sp-pending { margin: 0; padding: 14px 16px; border-radius: 12px; background: #fff; border: 1px dashed rgba(9,9,9,.25); }
`;

export function supportPage(site) {
  const external = ' target="_blank" rel="noopener"';
  const buttons = [
    hasOneTime() ? `<a class="button button-primary" href="${esc(supportGoHref("support-page"))}"${external}>${hasMonthly() ? "Support once" : "Support Podium Watch"}</a>` : "",
    hasMonthly() ? `<a class="button button-dark" href="${esc(supportGoHref("support-page", { kind: "monthly" }))}"${external}>Support monthly</a>` : ""
  ].filter(Boolean).join("");

  const content = `<style>${styles}</style>
  <section class="page-hero"><div class="container sp-hero">
    <img class="sp-logo" src="${SUPPORT_LOGO_WHITE}" width="600" height="643" alt="Support Podium Watch">
    <div><p class="eyebrow">Support Podium Watch</p><h1>Keep Ohio running coverage free.</h1><p>Podium Watch covers Ohio high school cross country and track and field. Support from readers helps keep it free for every runner, family and coach.</p></div>
  </div></section>
  <section class="section section-paper">
    <div class="container"><div class="sp-wrap">
      <h2>Why it matters</h2>
      <ul class="sp-list">
        <li><strong>Free for every Ohio runner</strong><span>Results, rankings and athlete profiles on Podium Watch are free for every runner in the state.</span></li>
        <li><strong>Photographers</strong><span>Support helps pay photographers to cover meets, so more athletes get photos from their races.</span></li>
        <li><strong>Servers</strong><span>Results, live pages and voting run on servers and a database that cost more as more people use them, most of all on big meet days.</span></li>
      </ul>
      ${buttons ? `<div class="sp-actions">${buttons}</div>` : `<p class="sp-pending">Support links are coming soon. Until then, the <a href="/go/merch/nav/" target="_blank" rel="noopener">Podium Watch Shop</a> helps too.</p>`}
      <p class="sp-note">${esc(supportConfig.note)}</p>
      ${buttons ? `<p class="sp-small">Payments are handled by Stripe. Podium Watch never sees your card number.</p>` : ""}
      <p class="sp-small">Other ways to help: share a results page or story with your team, follow <a href="${esc(site.instagramUrl)}" target="_blank" rel="noopener noreferrer">@podiumwatch on Instagram</a>, or pick something from the <a href="/go/merch/nav/" target="_blank" rel="noopener">Podium Watch Shop</a>.</p>
    </div></div>
  </section>`;

  return layout({
    site,
    title: "Support Podium Watch",
    description: "Support Podium Watch and help keep Ohio high school running results, rankings and athlete profiles free. Podium Watch is a small Ohio business; support is not tax-deductible.",
    pathname: "/support/",
    content
  });
}
