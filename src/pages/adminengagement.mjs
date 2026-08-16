import { adminShell } from "../lib/adminshell.mjs";

const styles = `
    .engagement-shell { display:grid; gap:26px; }
    .engagement-message { padding:15px 18px; border-radius:12px; background:rgba(0,191,99,.12); }
    .engagement-tabs { display:flex; flex-wrap:wrap; gap:9px; }
    .engagement-tab[aria-selected="true"] { background:#111827; color:#fff; }
    .engagement-panel { display:grid; gap:22px; }
    .engagement-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:14px; }
    .engagement-stat { padding:20px; border-radius:14px; background:#fff; box-shadow:0 10px 28px rgba(15,23,42,.07); }
    .engagement-stat strong { display:block; font-size:2rem; line-height:1; }
    .engagement-stat span { display:block; margin-top:8px; font-weight:800; }
    .engagement-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px; }
    .engagement-form { display:grid; gap:16px; }
    .engagement-fields { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:14px; }
    .engagement-form label { display:block; font-weight:800; }
    .engagement-form input, .engagement-form select, .engagement-form textarea { display:block; width:100%; margin-top:7px; padding:11px; border:1px solid rgba(15,23,42,.2); border-radius:9px; font:inherit; background:#fff; }
    .engagement-checkbox { display:flex !important; align-items:center; gap:9px; }
    .engagement-checkbox input { width:auto; margin:0; }
    .engagement-actions { display:flex; flex-wrap:wrap; gap:10px; }
    .engagement-table-wrap { overflow:auto; border:1px solid rgba(15,23,42,.12); border-radius:12px; }
    .engagement-table { width:100%; min-width:850px; border-collapse:collapse; background:#fff; }
    .engagement-table th, .engagement-table td { padding:12px; text-align:left; border-bottom:1px solid rgba(15,23,42,.09); vertical-align:top; }
    .engagement-table th { background:#111827; color:#fff; }
    .engagement-list { display:grid; gap:10px; }
    .engagement-row { display:flex; justify-content:space-between; gap:16px; padding:12px 0; border-bottom:1px solid rgba(15,23,42,.1); }
    .engagement-status { display:inline-flex; padding:5px 9px; border-radius:999px; background:rgba(0,191,99,.13); font-size:.76rem; font-weight:900; }
    .engagement-status-warning { background:rgba(245,158,11,.17); }
    .engagement-status-error { background:rgba(220,38,38,.14); color:#991b1b; }
    @media (max-width:800px) { .engagement-grid { grid-template-columns:1fr; } }
`;

export function adminEngagementPage(site) {
  const content = `<div class="engagement-shell">
      <div class="info-card" data-engagement-auth-loading>
        <h2>Checking admin access</h2>
        <p>Podium Watch is confirming your secure admin session.</p>
      </div>

      <p class="engagement-message" data-engagement-message aria-live="polite" hidden></p>

      <div class="engagement-shell" data-engagement-dashboard hidden>
        <div class="section-heading">
          <div>
            <p class="eyebrow">Audience and monetization</p>
            <h2>Notifications, analytics, and sponsors</h2>
          </div>
          <div class="engagement-actions">
            <select data-engagement-days style="padding:11px;border-radius:9px;font:inherit;">
              <option value="7">Last 7 days</option>
              <option value="30" selected>Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
        </div>

        <div class="engagement-tabs" role="tablist">
          <button class="button button-outline engagement-tab" type="button" data-engagement-tab="overview" aria-selected="true">Overview</button>
          <button class="button button-outline engagement-tab" type="button" data-engagement-tab="notifications">Notifications</button>
          <button class="button button-outline engagement-tab" type="button" data-engagement-tab="sponsors">Sponsors</button>
          <button class="button button-outline engagement-tab" type="button" data-engagement-tab="activity">Activity</button>
        </div>

        <section class="engagement-panel" data-engagement-panel="overview">
          <div class="engagement-stats">
            <div class="engagement-stat"><strong data-stat-subscribers>0</strong><span>Subscribers</span></div>
            <div class="engagement-stat"><strong data-stat-follows>0</strong><span>Active team follows</span></div>
            <div class="engagement-stat"><strong data-stat-views>0</strong><span>Team profile views</span></div>
            <div class="engagement-stat"><strong data-stat-visitors>0</strong><span>Unique visitors</span></div>
            <div class="engagement-stat"><strong data-stat-sponsor-clicks>0</strong><span>Sponsor clicks</span></div>
          </div>

          <div class="engagement-grid">
            <section class="info-card">
              <p class="eyebrow">Top teams</p>
              <h2>Most active team pages</h2>
              <div class="engagement-list" data-top-teams></div>
            </section>
            <section class="info-card">
              <p class="eyebrow">Popular actions</p>
              <h2>Audience activity</h2>
              <div class="engagement-list" data-activity-summary></div>
            </section>
            <section class="info-card">
              <p class="eyebrow">Sponsor performance</p>
              <h2>Tracked sponsor activity</h2>
              <div class="engagement-list" data-sponsor-performance></div>
            </section>
            <section class="info-card">
              <p class="eyebrow">Configuration</p>
              <h2>System readiness</h2>
              <div class="engagement-list" data-engagement-configuration></div>
            </section>
          </div>
        </section>

        <section class="engagement-panel" data-engagement-panel="notifications" hidden>
          <div class="engagement-grid">
            <form class="info-card engagement-form" data-notification-settings-form>
              <div>
                <p class="eyebrow">Email controls</p>
                <h2>Notification settings</h2>
              </div>
              <div class="engagement-fields">
                <label>Mode
                  <select name="notification_mode">
                    <option value="paused">Paused</option>
                    <option value="test">Testing only</option>
                    <option value="live">Live</option>
                  </select>
                </label>
                <label>Test email
                  <input type="email" name="test_email">
                </label>
                <label>Default delivery
                  <select name="default_frequency">
                    <option value="weekly">Weekly recap</option>
                    <option value="immediate">Immediate</option>
                  </select>
                </label>
                <label>Maximum emails per run
                  <input type="number" name="emails_per_run" min="1" max="500" value="100">
                </label>
              </div>
              <label class="engagement-checkbox"><input type="checkbox" name="public_following_enabled"> Allow visitors to follow teams</label>
              <label class="engagement-checkbox"><input type="checkbox" name="analytics_enabled"> Record first party team analytics</label>
              <label class="engagement-checkbox"><input type="checkbox" name="sponsor_display_enabled"> Display active sponsor placements</label>
              <div class="engagement-actions">
                <button class="button button-primary" type="submit">Save notification settings</button>
              </div>
            </form>

            <section class="info-card">
              <p class="eyebrow">Delivery testing</p>
              <h2>Test and process alerts</h2>
              <p>Use testing mode until your Resend domain and Vercel environment variables are ready.</p>
              <div class="engagement-actions">
                <button class="button button-outline" type="button" data-send-test-email>Send test email</button>
                <button class="button button-outline" type="button" data-process-notifications>Process immediate queue</button>
                <button class="button button-outline" type="button" data-process-weekly>Process weekly recap</button>
              </div>
            </section>
          </div>
        </section>

        <section class="engagement-panel" data-engagement-panel="sponsors" hidden>
          <div class="engagement-grid">
            <form class="info-card engagement-form" data-sponsor-form>
              <div><p class="eyebrow">Sponsor records</p><h2>Add or edit a sponsor</h2></div>
              <input type="hidden" name="sponsor_id">
              <div class="engagement-fields">
                <label>Name<input type="text" name="name" required></label>
                <label>Status<select name="status"><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option><option value="ended">Ended</option></select></label>
                <label>Website URL<input type="url" name="website_url"></label>
                <label>Logo URL<input type="url" name="logo_url"></label>
                <label>Contact name<input type="text" name="contact_name"></label>
                <label>Contact email<input type="email" name="contact_email"></label>
                <label>Start date<input type="datetime-local" name="starts_at"></label>
                <label>End date<input type="datetime-local" name="ends_at"></label>
              </div>
              <label>Description<textarea name="description" rows="4"></textarea></label>
              <label>Private notes<textarea name="notes" rows="3"></textarea></label>
              <div class="engagement-actions"><button class="button button-primary" type="submit">Save sponsor</button><button class="button button-outline" type="button" data-clear-sponsor>Clear</button></div>
            </form>

            <form class="info-card engagement-form" data-placement-form>
              <div><p class="eyebrow">Ad placements</p><h2>Place a sponsor</h2></div>
              <input type="hidden" name="placement_id">
              <div class="engagement-fields">
                <label>Sponsor<select name="sponsor_id" required></select></label>
                <label>Placement<select name="placement_type"><option value="directory">Team Directory</option><option value="team_profile">Team profile</option><option value="schedule">Schedule section</option><option value="roster">Roster section</option><option value="results">Results section</option><option value="email">Email alerts</option></select></label>
                <label>Specific team<select name="team_id"><option value="">All teams</option></select></label>
                <label>Priority<input type="number" name="priority" value="100" min="0" max="9999"></label>
                <label>Headline<input type="text" name="headline"></label>
                <label>Button label<input type="text" name="button_label" value="Learn more"></label>
                <label>Destination URL<input type="url" name="destination_url" required></label>
                <label>Image URL<input type="url" name="image_url"></label>
                <label>Start date<input type="datetime-local" name="starts_at"></label>
                <label>End date<input type="datetime-local" name="ends_at"></label>
              </div>
              <label>Placement message<textarea name="body_text" rows="3"></textarea></label>
              <label class="engagement-checkbox"><input type="checkbox" name="active" checked> Placement is active</label>
              <div class="engagement-actions"><button class="button button-primary" type="submit">Save placement</button><button class="button button-outline" type="button" data-clear-placement>Clear</button></div>
            </form>
          </div>

          <section class="info-card">
            <p class="eyebrow">Sponsors</p><h2>Current sponsor records</h2>
            <div class="engagement-table-wrap"><table class="engagement-table"><thead><tr><th>Sponsor</th><th>Status</th><th>Dates</th><th>Actions</th></tr></thead><tbody data-sponsor-rows></tbody></table></div>
          </section>

          <section class="info-card">
            <p class="eyebrow">Placements</p><h2>Active and scheduled placements</h2>
            <div class="engagement-table-wrap"><table class="engagement-table"><thead><tr><th>Sponsor</th><th>Placement</th><th>Team</th><th>Status</th><th>Actions</th></tr></thead><tbody data-placement-rows></tbody></table></div>
          </section>
        </section>

        <section class="engagement-panel" data-engagement-panel="activity" hidden>
          <section class="info-card">
            <p class="eyebrow">Notification queue</p><h2>Recent alert events</h2>
            <div class="engagement-table-wrap"><table class="engagement-table"><thead><tr><th>Team</th><th>Alert</th><th>Status</th><th>Created</th></tr></thead><tbody data-notification-event-rows></tbody></table></div>
          </section>
          <section class="info-card">
            <p class="eyebrow">Email delivery</p><h2>Recent delivery attempts</h2>
            <div class="engagement-table-wrap"><table class="engagement-table"><thead><tr><th>Recipient</th><th>Type</th><th>Status</th><th>Sent</th></tr></thead><tbody data-delivery-rows></tbody></table></div>
          </section>
        </section>
      </div>
    </div>`;

  return adminShell({
    site,
    pathname: "/admin/engagement/",
    title: "Engagement Center",
    description: "Podium Watch notifications, followers, analytics, and sponsor management.",
    heading: "Engagement Center.",
    intro: "Control team followers, email alerts, analytics, sponsor placements, delivery testing, and audience growth from one secure dashboard.",
    styles,
    content,
    scripts: ["/scripts/admin-engagement.js"]
  });
}
