import { adminShell } from "../lib/adminshell.mjs";

const styles = `
    .team-ig-shell { display: grid; gap: 20px; }
    .team-ig-actions { display: flex; flex-wrap: wrap; gap: 9px; align-items: center; }
    .team-ig-message { margin: 0; padding: 14px 16px; border-radius: 10px; background: rgba(0,191,99,.12); font-weight: 850; }
    .team-ig-message[data-tone="error"] { color: #991b1b; background: rgba(220,38,38,.12); }
    .team-ig-table-wrap { overflow: auto; border: 1px solid rgba(15,23,42,.12); border-radius: 10px; }
    .team-ig-table { width: 100%; min-width: 900px; border-collapse: collapse; background: #fff; }
    .team-ig-table th, .team-ig-table td { padding: 10px; border-bottom: 1px solid rgba(15,23,42,.09); text-align: left; vertical-align: top; }
    .team-ig-table th { background: #111; color: #fff; font-size: .74rem; text-transform: uppercase; }
    .team-ig-badge { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #e2e8f0; font-size: .75rem; font-weight: 900; }
    .team-ig-badge[data-actor="admin_instagram_revert"] { background: #fef3c7; color: #7c4a03; }
    .team-ig-filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; }
    .team-ig-filters label { display: grid; gap: 6px; font-weight: 850; }
    .team-ig-filters select, .team-ig-filters input { padding: 8px 10px; border: 1px solid rgba(15,23,42,.22); border-radius: 8px; font: inherit; }
    @media (max-width: 700px) { .team-ig-actions { display: grid; } .team-ig-actions .button { width: 100%; justify-content: center; } }
`;

export function adminTeamInstagramPage(site) {
  const content = `<div class="team-ig-shell" data-team-ig-manager>
    <section class="info-card" data-team-ig-loading><h2>Checking admin access</h2><p>Please wait.</p></section>
    <div data-team-ig-dashboard hidden class="team-ig-shell">
      <p class="team-ig-message" data-team-ig-message role="status">Loading team Instagram changes.</p>
      <section class="info-card">
        <div><p class="eyebrow">Change history</p><h2>Every Instagram submission and revert</h2></div>
        <form class="team-ig-filters" data-team-ig-filter-form>
          <label>Show<select name="since_days"><option value="7">Last 7 days</option><option value="30" selected>Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last year</option></select></label>
          <button class="button button-dark" type="submit">Refresh</button>
        </form>
        <div class="team-ig-table-wrap"><table class="team-ig-table"><thead><tr><th>Team</th><th>Change</th><th>When</th><th>Source</th><th>Action</th></tr></thead><tbody data-team-ig-rows></tbody></table></div>
      </section>
    </div>
  </div>`;

  return adminShell({
    site,
    pathname: "/admin/team-instagram/",
    title: "Team Instagram Changes",
    description: "Change history and one-click revert for the public team Instagram submission feature.",
    heading: "Team Instagram Changes",
    intro: "Every public Instagram submission takes effect immediately, with no approval step. This page is the full change history for that feature, with a one-click revert to any previous value.",
    styles,
    content,
    scripts: ["/scripts/admin-team-instagram.js"]
  });
}
