import { escapeHtml } from "../lib/content.mjs";
import { icon, layout, pageHero } from "../lib/html.mjs";

// "Partner with Podium Watch" (/sponsors/, WO-26), rendered on the server
// by api/pages/sponsors.js so the numbers, packages and prices are in the
// HTML itself (no "Loading" without JavaScript). public/scripts/
// partner-page.js only handles the inquiry form.
const styles = `<style>
    .pt-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; }
    .pt-stat { padding:18px; border:1px solid var(--line); background:var(--white); }
    .pt-stat strong { display:block; font-size:2rem; line-height:1.05; font-variant-numeric:tabular-nums; }
    .pt-stat span { color:var(--muted); font-weight:700; font-size:.9rem; }
    .pt-partner, .pt-package { padding:18px; border:1px solid var(--line); border-left:5px solid var(--green); background:var(--white); }
    .pt-partner h3, .pt-package h3 { margin:0 0 6px; }
    .pt-partner p, .pt-package p { margin:0 0 8px; }
    .pt-price { font-weight:900; }
    .pt-form { display:grid; gap:12px; max-width:640px; }
    .pt-form label { display:grid; gap:6px; font-weight:800; }
    .pt-form input, .pt-form select, .pt-form textarea { padding:11px; border:1px solid rgba(var(--black-rgb),.22); border-radius:8px; font:inherit; font-size:16px; background:var(--white); }
    .pt-form textarea { min-height:110px; }
    .pt-note { color:var(--muted); font-weight:650; font-size:.9rem; }
    .pt-stack { display:grid; gap:34px; }
    .pt-group { margin:18px 0 8px; font-size:.82rem; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); }
  </style>`;

const number = (value) => Number(value).toLocaleString("en-US");
const shortDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function statsHtml(data) {
  const tiles = [];
  if (data?.audience?.available) {
    tiles.push([number(data.audience.visitors), `site visitors, last ${data.audience.window_days} days`]);
    tiles.push([number(data.audience.page_views), `page views, last ${data.audience.window_days} days`]);
  }
  if (data?.instagram?.followers) tiles.push([number(data.instagram.followers), "Instagram followers"]);
  if (data?.instagram?.monthly_reach) tiles.push([number(data.instagram.monthly_reach), `Instagram accounts reached${data.instagram.as_of ? `, month to ${shortDate(data.instagram.as_of)}` : ""}`]);
  return tiles.length
    ? tiles.map(([value, label]) => `<div class="pt-stat"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join("")
    : '<p class="pt-note">Current audience numbers are available on request.</p>';
}

const WINTER = new Set(["state-hub", "banquet-pack", "wrapped", "nationals", "commitments"]);

function packagesHtml(packages) {
  const card = (item) => `<article class="pt-package"><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p><p class="pt-price">${item.price ? escapeHtml(item.price) : "Ask for pricing"}</p></article>`;
  const yearRound = packages.filter((item) => !WINTER.has(item.id));
  const winter = packages.filter((item) => WINTER.has(item.id));
  if (!packages.length) return '<p class="pt-note">Ask us about current packages.</p>';
  return `${yearRound.length ? `<p class="pt-group">Year-round</p><div class="pt-grid">${yearRound.map(card).join("")}</div>` : ""}${winter.length ? `<p class="pt-group">This winter</p><div class="pt-grid">${winter.map(card).join("")}</div>` : ""}`;
}

export function sponsorsPageHtml(site, sponsors, data) {
  const packages = data?.packages || [];
  // Only real partners. House entries (Podium Watch's own Shop and Support
  // cards) are left out, and their internal_note is never rendered.
  const partnerList = sponsors.filter((sponsor) => !sponsor.house).map((sponsor) => `<article class="pt-partner"><h3>${escapeHtml(sponsor.name)}</h3>${sponsor.description ? `<p>${escapeHtml(sponsor.description)}</p>` : ""}${sponsor.url ? `<a class="text-link" href="${escapeHtml(sponsor.url)}" target="_blank" rel="sponsored noopener noreferrer">Visit ${escapeHtml(sponsor.name)} ${icon("arrow")}</a>` : ""}</article>`).join("");
  const options = packages.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
  const content = `${pageHero({ eyebrow: "Partner with Podium Watch", title: "Reach Ohio's running families.", description: "Podium Watch covers Ohio high school cross country and track and field for athletes, parents and coaches across the state. Partners reach them on the pages they come back to every week." })}
  ${styles}
  <section class="section section-paper"><div class="container pt-stack" data-partner-page>
    <div>
      <p class="eyebrow">Who reads us</p>
      <h2>Athletes, parents and coaches in every corner of Ohio.</h2>
      <p>Full rankings and results for every division, free. Profiles for thousands of Ohio runners. Meet coverage, state previews and stories you won't find anywhere else, plus a daily Instagram following across the state.</p>
      <div class="pt-grid">${statsHtml(data)}</div>
    </div>
    <div>
      <p class="eyebrow">Current partners</p>
      <div class="pt-grid">${partnerList}</div>
    </div>
    <div>
      <p class="eyebrow">Packages</p>
      <h2>Ways to partner</h2>
      ${packagesHtml(packages)}
      <p class="pt-note">Every package is labeled as a sponsorship. Partners never affect rankings, results or coverage.</p>
    </div>
    <div class="info-card">
      <p class="eyebrow">Get in touch</p>
      <h2>Tell us what you have in mind.</h2>
      <form class="pt-form" data-partner-form novalidate>
        <label>Your name <input name="name" required maxlength="120" autocomplete="name"></label>
        <label>Business or organization <input name="organization" maxlength="160" autocomplete="organization"></label>
        <label>Email <input name="email" type="email" required maxlength="254" autocomplete="email"></label>
        <label>Interested in <select name="package"><option value="">Not sure yet</option>${options}<option value="other">Something else</option></select></label>
        <label>Message <textarea name="message" maxlength="2000" placeholder="What would you like to promote, and when?"></textarea></label>
        <div aria-hidden="true" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden"><label>Leave this blank <input name="pw_hp_field" tabindex="-1" autocomplete="off"></label></div>
        <button class="button button-primary" type="submit">Send</button>
        <p class="pt-note" data-partner-message role="status" aria-live="polite"></p>
      </form>
      <p class="pt-note">Or email <a href="mailto:${site.contactEmail}?subject=Podium%20Watch%20partnership">${escapeHtml(site.contactEmail)}</a>.</p>
    </div>
    <div class="info-card">
      <p class="eyebrow">Our policy</p>
      <p>Sponsors support Podium Watch's coverage. They have no say in rankings, results, or editorial decisions. Sponsored content is always labeled. See our <a href="/standards/">Editorial Standards</a>.</p>
    </div>
  </div></section>
  <script src="/scripts/partner-page.js" defer></script>`;
  return layout({ site, title: "Partner with Podium Watch", description: "Sponsor Podium Watch and reach Ohio high school cross country and track athletes, parents and coaches. Packages, audience numbers and contact.", pathname: "/sponsors/", content });
}
