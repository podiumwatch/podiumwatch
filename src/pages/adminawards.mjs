import { adminShell } from "../lib/adminshell.mjs";

const styles = `
    .awards-shell { display: grid; gap: 20px; }
    .awards-type-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
    .awards-type-tabs button { padding: 9px 16px; border-radius: 999px; border: 1px solid rgba(15,23,42,.22); background: #fff; font-weight: 850; cursor: pointer; }
    .awards-type-tabs button[aria-pressed="true"] { background: #111; color: #fff; border-color: #111; }
    .awards-message { margin: 0; padding: 14px 16px; border-radius: 10px; background: rgba(0,191,99,.12); font-weight: 850; }
    .awards-message[data-tone="error"] { color: #991b1b; background: rgba(220,38,38,.12); }
    .awards-week-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
    .awards-week-row select { padding: 8px 10px; border: 1px solid rgba(15,23,42,.22); border-radius: 8px; font: inherit; min-width: 260px; }
    .awards-badge { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #e2e8f0; font-size: .74rem; font-weight: 900; text-transform: uppercase; letter-spacing: .02em; }
    .awards-badge[data-phase="nominations_open"] { background: #dcfce7; color: #166534; }
    .awards-badge[data-phase="nominations_closed"] { background: #fef3c7; color: #7c4a03; }
    .awards-badge[data-phase="voting_open"] { background: #dbeafe; color: #1e40af; }
    .awards-badge[data-phase="voting_closed"] { background: #ede9fe; color: #5b21b6; }
    .awards-badge[data-phase="winner_announced"] { background: #111; color: #fff; }
    .awards-badge[data-phase="scheduled"], .awards-badge[data-phase="not_scheduled"] { background: #e2e8f0; color: #334155; }
    .awards-stats { display: flex; flex-wrap: wrap; gap: 18px; margin: 4px 0 0; }
    .awards-stat { display: grid; gap: 2px; }
    .awards-stat b { font-size: 1.3rem; }
    .awards-stat span { font-size: .74rem; text-transform: uppercase; letter-spacing: .03em; color: #64748b; }
    .awards-actions { display: flex; flex-wrap: wrap; gap: 9px; }
    .awards-table-wrap { overflow: auto; border: 1px solid rgba(15,23,42,.12); border-radius: 10px; }
    .awards-table { width: 100%; min-width: 960px; border-collapse: collapse; background: #fff; }
    .awards-table th, .awards-table td { padding: 10px; border-bottom: 1px solid rgba(15,23,42,.09); text-align: left; vertical-align: top; font-size: .88rem; }
    .awards-table th { background: #111; color: #fff; font-size: .72rem; text-transform: uppercase; }
    .awards-table td.awards-reason { max-width: 320px; white-space: pre-wrap; }
    .awards-inline-form { display: grid; gap: 8px; margin-top: 10px; padding: 12px; border: 1px dashed rgba(15,23,42,.25); border-radius: 8px; background: #f8fafc; }
    .awards-inline-form label { display: grid; gap: 4px; font-weight: 800; font-size: .82rem; }
    .awards-inline-form input, .awards-inline-form textarea { padding: 7px 9px; border: 1px solid rgba(15,23,42,.22); border-radius: 7px; font: inherit; }
    .awards-inline-form textarea { min-height: 64px; resize: vertical; }
    .awards-inline-form input[type="file"] { border: 1px dashed rgba(15,23,42,.3); background: #fff; padding: 8px 9px; }
    .awards-upload-status { font-size: .8rem; font-weight: 800; color: #475569; }
    .awards-finalist-card { display: grid; grid-template-columns: 64px 1fr auto; gap: 12px; align-items: start; padding: 12px; border: 1px solid rgba(15,23,42,.12); border-radius: 10px; background: #fff; }
    .awards-finalist-card img { width: 64px; height: 64px; border-radius: 8px; object-fit: cover; background: #e2e8f0; }
    .awards-finalist-card .awards-finalist-photo-empty { width: 64px; height: 64px; border-radius: 8px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: .7rem; color: #64748b; text-align: center; }
    .awards-finalist-meta { font-size: .82rem; color: #475569; }
    .awards-finalist-actions { display: grid; gap: 6px; justify-items: end; }
    .awards-finalist-list { display: grid; gap: 10px; }
    .awards-winner-pill { background: #111; color: #fff; padding: 3px 9px; border-radius: 999px; font-size: .72rem; font-weight: 900; text-transform: uppercase; }
    .awards-create-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
    .awards-create-fields label { display: grid; gap: 6px; font-weight: 850; }
    .awards-create-fields input, .awards-create-fields select { padding: 8px 10px; border: 1px solid rgba(15,23,42,.22); border-radius: 8px; font: inherit; }
    [data-type-only] { display: none !important; }
    [data-awards-manager][data-active-type="aotw"] [data-type-only="aotw"] { display: grid !important; }
    [data-awards-manager][data-active-type="totw"] [data-type-only="totw"] { display: grid !important; }
    @media (max-width: 700px) { .awards-actions { display: grid; } .awards-actions .button { width: 100%; justify-content: center; } .awards-finalist-card { grid-template-columns: 56px 1fr; } .awards-finalist-actions { grid-column: 1 / -1; justify-items: start; } }
`;

export function adminAwardsPage(site) {
  const content = `<div class="awards-shell" data-awards-manager data-active-type="aotw">
    <section class="info-card" data-awards-loading><h2>Checking admin access</h2><p>Please wait.</p></section>
    <div data-awards-dashboard hidden class="awards-shell">
      <div class="awards-type-tabs" data-awards-type-tabs>
        <button type="button" data-awards-type="aotw" aria-pressed="true">Athlete of the Week</button>
        <button type="button" data-awards-type="totw" aria-pressed="false">Team of the Week</button>
      </div>
      <p class="awards-message" data-awards-message role="status">Loading weeks.</p>

      <section class="info-card">
        <div><p class="eyebrow">Choose a week</p><h2>Week</h2></div>
        <div class="awards-week-row">
          <select data-awards-week-select></select>
          <span class="awards-badge" data-awards-phase-badge data-phase="scheduled">Scheduled</span>
        </div>
        <div class="awards-stats" data-awards-stats></div>
        <div class="awards-actions" data-awards-week-actions style="margin-top:12px;"></div>
      </section>

      <section class="info-card">
        <div><p class="eyebrow">Skip the public form</p><h2>Add a nomination yourself</h2></div>
        <p>Use this when you want to feature an athlete or team nobody happened to submit -- it goes straight into the list below as an already-reviewed nomination, ready to promote to a finalist.</p>
        <form class="awards-create-fields" data-awards-nominate-form>
          <label data-type-only="aotw">Athlete name<input type="text" name="athlete_name"></label>
          <label data-type-only="totw">Team name<input type="text" name="team_name"></label>
          <label>School<input type="text" name="school" required></label>
          <label data-type-only="totw">Sport<input type="text" name="sport" value="Cross Country"></label>
          <label data-type-only="totw">Division<input type="text" name="division"></label>
          <label data-type-only="aotw">Grade<input type="text" name="grade"></label>
          <label data-type-only="aotw">Gender<select name="gender"><option value="girls">Girls</option><option value="boys">Boys</option></select></label>
          <label data-type-only="aotw">Event<input type="text" name="event_name"></label>
          <label data-type-only="aotw">Performance<input type="text" name="performance" placeholder="e.g. 16:42"></label>
          <label data-type-only="totw">Achievement<input type="text" name="achievement"></label>
          <label>Meet name<input type="text" name="meet_name"></label>
          <label>Performance date<input type="date" name="performance_date"></label>
          <label>Result link (optional)<input type="text" name="result_url"></label>
          <label>Photo link (optional)<input type="text" name="photo_url"></label>
          <label>Your name<input type="text" name="nominator_name" value="Podium Watch Admin"></label>
          <label>Your email<input type="email" name="nominator_email" value="podiumwatchohio@gmail.com" required></label>
          <label style="grid-column:1/-1;">Why this nomination<textarea name="reason" rows="3" required style="width:100%;padding:8px 10px;border:1px solid rgba(15,23,42,.22);border-radius:8px;font:inherit;"></textarea></label>
          <label style="align-self:end;"><button class="button button-primary" type="submit">Add nomination</button></label>
        </form>
      </section>

      <section class="info-card">
        <div><p class="eyebrow">Public submissions</p><h2>Nominations</h2></div>
        <div class="awards-table-wrap"><table class="awards-table"><thead><tr>
          <th>Nominee</th><th>Details</th><th>Reason</th><th>Nominator</th><th>Reviewed</th><th>Promote</th>
        </tr></thead><tbody data-awards-nomination-rows></tbody></table></div>
      </section>

      <section class="info-card">
        <div><p class="eyebrow">Up for a vote</p><h2>Finalists</h2></div>
        <div class="awards-finalist-list" data-awards-finalist-list></div>
        <div class="awards-actions" data-awards-winner-actions style="margin-top:12px;"></div>
      </section>

      <section class="info-card">
        <div><p class="eyebrow">Schedule ahead</p><h2>Create a new week</h2></div>
        <form class="awards-create-fields" data-awards-create-form>
          <label>Nominations open<input type="datetime-local" name="nomination_opens" required></label>
          <label>Nominations close<input type="datetime-local" name="nomination_closes" required></label>
          <label>Voting opens<input type="datetime-local" name="voting_opens" required></label>
          <label>Voting closes<input type="datetime-local" name="voting_closes" required></label>
          <label style="align-self:end;"><button class="button button-primary" type="submit">Schedule week</button></label>
        </form>
      </section>
    </div>
  </div>`;

  return adminShell({
    site,
    pathname: "/admin/awards/",
    title: "Weekly Awards Admin",
    description: "View Athlete of the Week and Team of the Week nominations, promote finalists, and select winners.",
    heading: "Weekly Awards",
    intro: "View nominations for Athlete of the Week and Team of the Week, promote the ones you choose to official finalists, and select the winner once voting closes.",
    styles,
    content,
    scripts: ["/scripts/admin-awards.js"]
  });
}
