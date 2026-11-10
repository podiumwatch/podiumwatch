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
    .team-ig-coverage { margin: 6px 0 10px; font-weight: 850; }
    .team-ig-handle { display: inline-block; margin: 0 8px 4px 0; }
    .team-ig-handle small { color: #64748b; font-weight: 800; }
    .team-ig-bulk { display: grid; gap: 10px; }
    .team-ig-bulk textarea { width: 100%; padding: 10px; border: 1px solid rgba(15,23,42,.22); border-radius: 8px; font: inherit; box-sizing: border-box; }
    .team-ig-note { color: #64748b; font-weight: 700; font-size: .85rem; }
    @media (max-width: 700px) { .team-ig-actions { display: grid; } .team-ig-actions .button { width: 100%; justify-content: center; } }
`;

export function adminTeamInstagramPage(site) {
  const content = `<div class="team-ig-shell" data-team-ig-manager>
    <section class="info-card" data-team-ig-loading><h2>Checking admin access</h2><p>Please wait.</p></section>
    <div data-team-ig-dashboard hidden class="team-ig-shell">
      <p class="team-ig-message" data-team-ig-message role="status">Loading team Instagram changes.</p>
      <section class="info-card">
        <div><p class="eyebrow">Waiting for review</p><h2>Pending Instagram submissions</h2><p>Open each handle to make sure it's really the team's account before approving. Approving makes it live on the team page right away.</p></div>
        <div class="team-ig-table-wrap"><table class="team-ig-table"><thead><tr><th>Team</th><th>Submitted handle</th><th>Label</th><th>Submitted</th><th>Action</th></tr></thead><tbody data-team-ig-pending><tr><td colspan="5">Loading.</td></tr></tbody></table></div>
      </section>
      <section class="info-card" data-igd>
        <div><p class="eyebrow">Instagram directory</p><h2>Every team and its accounts</h2></div>
        <p class="team-ig-coverage" data-igd-coverage>Loading coverage.</p>
        <form class="team-ig-filters" data-igd-filters>
          <label>Search<input type="search" name="q" placeholder="School"></label>
          <label>Show<select name="show"><option value="all">All teams</option><option value="none">No account yet</option><option value="pending">Has pending</option><option value="state">2026 state meet teams</option><option value="state_none">State teams, no account</option></select></label>
          <button class="button button-outline" type="button" data-igd-export="csv">Export CSV</button>
          <button class="button button-outline" type="button" data-igd-export="json">Export JSON</button>
        </form>
        <div class="team-ig-table-wrap"><table class="team-ig-table"><thead><tr><th>School</th><th>Division</th><th>Approved accounts</th><th>Pending</th></tr></thead><tbody data-igd-rows><tr><td colspan="4">Loading.</td></tr></tbody></table></div>
        <p class="team-ig-note" data-igd-count></p>
      </section>
      <section class="info-card">
        <div><p class="eyebrow">Bulk add</p><h2>Paste accounts</h2><p>One per line: <code>School, Label, @handle</code>. Labels: Boys XC, Girls XC, XC &amp; Track, Boys Track, Girls Track, Athletics. A school name shared by two schools needs its city, like <code>Perry (Massillon), Boys XC, @perryxc</code>. Every line goes in as pending for review.</p></div>
        <form class="team-ig-bulk" data-igd-bulk><textarea name="text" rows="6" placeholder="Russia, XC &amp; Track, @raiders_tf_xc"></textarea><button class="button button-dark" type="submit">Add as pending</button></form>
        <div data-igd-bulk-out></div>
      </section>
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
    title: "Instagram Directory",
    description: "Team Instagram accounts: review queue, directory and coverage, bulk add, export and change history.",
    heading: "Instagram Directory",
    intro: "Submissions from /teams/instagram/ (podiumwatch.org/ig), team pages and bulk adds wait here for your approval. Open each handle to check it's really the team's account. Below: every team with its labeled accounts, coverage, bulk add and export.",
    styles,
    content,
    scripts: ["/scripts/admin-team-instagram.js", "/scripts/admin-instagram-directory.js"]
  });
}
