import { adminShell } from "../lib/adminshell.mjs";

// Admin: partner page settings and inquiries (WO-26).
// Data: api/admin/partner-page.js.
const styles = `
    .pp-shell { display:grid; gap:18px; }
    .pp-form { display:grid; gap:14px; }
    .pp-row { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px; }
    .pp-form label { display:grid; gap:5px; font-weight:800; font-size:.88rem; }
    .pp-form input { padding:9px 10px; border:1px solid var(--line); border-radius:8px; font:inherit; }
    .pp-pkg { display:grid; grid-template-columns:1fr 200px auto; gap:10px; align-items:center; padding:10px; border-top:1px solid var(--line); }
    .pp-pkg small { color:var(--muted); display:block; }
    .pp-inq { padding:12px; border-top:1px solid var(--line); display:grid; gap:4px; }
    .pp-inq small { color:var(--muted); }
    @media (max-width:640px) { .pp-pkg { grid-template-columns:1fr; } }
`;

export function adminPartnerPage(site) {
  const content = `<div class="pp-shell" data-pp>
    <section class="info-card" data-pp-loading><h2>Checking admin access</h2><p>Please wait.</p></section>
    <div class="pp-shell" data-pp-dashboard hidden>
      <section class="info-card">
        <h2>Partner page numbers and prices</h2>
        <p>Shown on <a href="/sponsors/" target="_blank" rel="noopener">/sponsors/</a>. Site visitors and page views are filled in automatically once there are 30 full days of them.</p>
        <form class="pp-form" data-pp-form>
          <div class="pp-row">
            <label>Instagram followers <input name="instagram_followers" inputmode="numeric" placeholder="12500"></label>
            <label>Instagram accounts reached this month <input name="instagram_monthly_reach" inputmode="numeric" placeholder="400000"></label>
            <label>Instagram numbers as of <input name="instagram_as_of" type="date"></label>
          </div>
          <div data-pp-packages></div>
          <button class="button button-primary" type="submit">Save</button>
          <p class="awards-message" data-pp-message role="status"></p>
        </form>
      </section>
      <section class="info-card">
        <h2>Inquiries</h2>
        <div data-pp-inquiries></div>
      </section>
    </div>
  </div>`;

  return adminShell({
    site,
    pathname: "/admin/partner-page/",
    title: "Partner Page",
    description: "Instagram numbers, package prices and inquiries for the Partner with Podium Watch page.",
    heading: "Partner Page",
    intro: "Set the numbers and prices the public partner page shows, and see every inquiry it receives.",
    styles,
    content,
    scripts: ["/scripts/admin-partner-page.js"]
  });
}
