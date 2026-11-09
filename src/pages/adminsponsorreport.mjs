import { adminShell } from "../lib/adminshell.mjs";

// Admin: Sponsor Report (WO-25). Data: api/admin/sponsor-report.js.
const styles = `
    .spr-shell { display:grid; gap:16px; }
    .spr-bar { display:flex; flex-wrap:wrap; gap:10px; align-items:end; }
    .spr-bar label { display:grid; gap:5px; font-weight:800; font-size:.88rem; }
    .spr-bar input { padding:9px 10px; border:1px solid var(--line); border-radius:8px; font:inherit; }
    .spr-table-wrap { overflow-x:auto; border:1px solid var(--line); background:var(--white); }
    .spr-table { width:100%; min-width:720px; border-collapse:collapse; font-size:.92rem; }
    .spr-table th, .spr-table td { padding:10px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
    .spr-table th { background:#111; color:#fff; font-size:.72rem; letter-spacing:.06em; text-transform:uppercase; }
    .spr-table td.num { font-variant-numeric:tabular-nums; font-weight:800; }
    .spr-table ol { margin:0; padding-left:18px; }
    @media print { .admin-shell-nav, .spr-bar, header, footer, .sports-ticker { display:none !important; } }
`;

export function adminSponsorReportPage(site) {
  const content = `<div class="spr-shell" data-spr>
    <section class="info-card" data-spr-loading><h2>Checking admin access</h2><p>Please wait.</p></section>
    <div class="spr-shell" data-spr-dashboard hidden>
      <div class="spr-bar">
        <label>Month <input type="month" data-spr-month></label>
        <button class="button button-secondary" type="button" data-spr-load>Show</button>
        <button class="button button-primary" type="button" data-spr-csv>Download CSV</button>
        <button class="button button-secondary" type="button" data-spr-print>Print or save as PDF</button>
      </div>
      <p class="awards-message" data-spr-message role="status"></p>
      <div class="spr-table-wrap"><table class="spr-table"><thead><tr><th>Sponsor</th><th>Placement</th><th>Impressions</th><th>Clicks</th><th>Click rate</th><th>Top pages</th></tr></thead><tbody data-spr-rows></tbody></table></div>
      <p class="spr-note">Impressions are page views of the pages carrying the placement. Clicks are counted through each sponsor link; bots are left out.</p>
    </div>
  </div>`;

  return adminShell({
    site,
    pathname: "/admin/sponsor-report/",
    title: "Sponsor Report",
    description: "Monthly impressions, clicks and click rate for each site sponsor placement.",
    heading: "Sponsor Report",
    intro: "Monthly numbers for each sponsor placement, ready to send a sponsor. Sponsors and their pages are set in src/data/sponsors.json.",
    styles,
    content,
    scripts: ["/scripts/admin-sponsor-report.js"]
  });
}
