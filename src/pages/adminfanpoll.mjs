import { layout, pageHero } from "../lib/html.mjs";

export function adminFanPollPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Admin",
    title: "Fan Poll",
    description: "Schedule voting weeks and open or close voting per sport, gender, and division. Only cross country is turned on for voters right now -- see docs/DECISIONS.md, 2026-08-06."
  })}
  <style>
    .fan-poll-admin-shell { display: grid; gap: 20px; }
    .fan-poll-admin-actions { display: flex; flex-wrap: wrap; gap: 9px; align-items: center; }
    .fan-poll-admin-message { margin: 0; padding: 14px 16px; border-radius: 10px; background: rgba(0,191,99,.12); font-weight: 850; }
    .fan-poll-admin-message[data-tone="error"] { color: #991b1b; background: rgba(220,38,38,.12); }
    .fan-poll-admin-table-wrap { overflow: auto; border: 1px solid rgba(15,23,42,.12); border-radius: 10px; }
    .fan-poll-admin-table { width: 100%; min-width: 900px; border-collapse: collapse; background: #fff; }
    .fan-poll-admin-table th, .fan-poll-admin-table td { padding: 10px; border-bottom: 1px solid rgba(15,23,42,.09); text-align: left; vertical-align: top; }
    .fan-poll-admin-table th { background: #111; color: #fff; font-size: .74rem; text-transform: uppercase; }
    .fan-poll-admin-badge { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #e2e8f0; font-size: .75rem; font-weight: 900; }
    .fan-poll-admin-badge[data-status="voting_open"] { background: #dcfce7; color: #166534; }
    .fan-poll-admin-badge[data-status="voting_closed"] { background: #e2e8f0; color: #334155; }
    .fan-poll-admin-badge[data-status="scheduled"] { background: #fef3c7; color: #7c4a03; }
    .fan-poll-admin-create-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
    .fan-poll-admin-create-fields label { display: grid; gap: 6px; font-weight: 850; }
    .fan-poll-admin-create-fields select, .fan-poll-admin-create-fields input { padding: 8px 10px; border: 1px solid rgba(15,23,42,.22); border-radius: 8px; font: inherit; }
    @media (max-width: 700px) { .fan-poll-admin-actions { display: grid; } .fan-poll-admin-actions .button { width: 100%; justify-content: center; } }
  </style>
  <section class="section section-paper"><div class="container fan-poll-admin-shell" data-fan-poll-admin-manager>
    <section class="info-card" data-fan-poll-admin-loading><h2>Checking admin access</h2><p>Please wait.</p></section>
    <div data-fan-poll-admin-dashboard hidden class="fan-poll-admin-shell">
      <div class="fan-poll-admin-actions">
        <a class="button button-outline" href="/admin/">Admin</a>
        <a class="button button-outline" href="/fan-poll/" target="_blank" rel="noopener">View public Fan Poll</a>
      </div>
      <p class="fan-poll-admin-message" data-fan-poll-admin-message role="status">Loading fan poll weeks.</p>

      <section class="info-card">
        <div><p class="eyebrow">Schedule a week</p><h2>Create a new voting week</h2></div>
        <form class="fan-poll-admin-create-fields" data-fan-poll-admin-create-form>
          <label>Sport<select name="sport"><option value="cross_country">Cross Country</option></select></label>
          <label>Gender<select name="gender"><option value="boys">Boys</option><option value="girls">Girls</option></select></label>
          <label>Division<select name="division_number"><option value="1">I</option><option value="2">II</option><option value="3">III</option><option value="4">IV</option></select></label>
          <label>Season year<input type="number" name="season_year" value="2026" required></label>
          <label>Voting opens<input type="datetime-local" name="voting_opens" required></label>
          <label>Voting closes<input type="datetime-local" name="voting_closes" required></label>
          <label style="align-self:end;"><button class="button button-primary" type="submit">Schedule week</button></label>
        </form>
      </section>

      <section class="info-card">
        <div><p class="eyebrow">All scheduled weeks</p><h2>Open and close voting</h2></div>
        <div class="fan-poll-admin-table-wrap"><table class="fan-poll-admin-table"><thead><tr><th>Poll</th><th>Voting window</th><th>Status</th><th>Action</th></tr></thead><tbody data-fan-poll-admin-rows></tbody></table></div>
      </section>
    </div>
  </div></section>
  <script src="/scripts/admin-fan-poll.js" defer></script>`;
  return layout({
    site,
    title: "Fan Poll Admin",
    description: "Schedule Fan Poll voting weeks and open or close voting per sport, gender, and division.",
    pathname: "/admin/fan-poll/",
    content
  });
}
