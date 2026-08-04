import { layout, pageHero } from "../lib/html.mjs";

export function teamInsightsPage(site) {
  const content = `${pageHero({
    eyebrow: "Team Dashboard",
    title: "Team insights.",
    description:
      "See profile traffic, follower growth, popular sections, notification delivery, and sponsor activity without exposing follower email addresses."
  })}

  <style>
    .insights-shell { display:grid; gap:24px; }
    .insights-toolbar { display:flex; flex-wrap:wrap; justify-content:space-between; gap:14px; align-items:center; }
    .insights-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(155px,1fr)); gap:14px; }
    .insights-stat { padding:20px; border-radius:14px; background:#fff; box-shadow:0 10px 28px rgba(15,23,42,.07); }
    .insights-stat strong { display:block; font-size:2rem; line-height:1; }
    .insights-stat span { display:block; margin-top:8px; font-weight:800; }
    .insights-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px; }
    .insights-list { display:grid; gap:10px; margin-top:16px; }
    .insights-row { display:flex; justify-content:space-between; gap:16px; padding:12px 0; border-bottom:1px solid rgba(15,23,42,.1); }
    .insights-row:last-child { border-bottom:0; }
    .insights-message { padding:15px 18px; border-radius:12px; background:rgba(0,191,99,.12); }
    @media (max-width:760px) { .insights-grid { grid-template-columns:1fr; } }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="insights-shell">
        <div class="info-card" data-team-insights-loading>
          <h2>Loading team insights</h2>
          <p>Podium Watch is confirming your team account.</p>
        </div>

        <p class="insights-message" data-team-insights-message hidden></p>

        <div class="insights-shell" data-team-insights hidden>
          <div class="insights-toolbar">
            <div>
              <p class="eyebrow">Team performance</p>
              <h2 data-team-insights-name>Team insights</h2>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:10px;">
              <select data-team-insights-days style="padding:11px;border-radius:9px;font:inherit;">
                <option value="7">Last 7 days</option>
                <option value="30" selected>Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
              <a class="button button-outline" href="/team-dashboard/">Team dashboard</a>
            </div>
          </div>

          <div class="insights-stats">
            <div class="insights-stat"><strong data-insight-followers>0</strong><span>Followers</span></div>
            <div class="insights-stat"><strong data-insight-views>0</strong><span>Profile views</span></div>
            <div class="insights-stat"><strong data-insight-visitors>0</strong><span>Unique visitors</span></div>
            <div class="insights-stat"><strong data-insight-clicks>0</strong><span>Link clicks</span></div>
            <div class="insights-stat"><strong data-insight-emails>0</strong><span>Emails sent</span></div>
          </div>

          <div class="insights-grid">
            <section class="info-card">
              <p class="eyebrow">Traffic</p>
              <h2>Popular activity</h2>
              <div class="insights-list" data-insight-activity></div>
            </section>

            <section class="info-card">
              <p class="eyebrow">Sections</p>
              <h2>Most viewed areas</h2>
              <div class="insights-list" data-insight-sections></div>
            </section>

            <section class="info-card">
              <p class="eyebrow">Notifications</p>
              <h2>Recent team alerts</h2>
              <div class="insights-list" data-insight-events></div>
            </section>

            <section class="info-card">
              <p class="eyebrow">Privacy</p>
              <h2>What teams can see</h2>
              <p>Team managers can see totals and activity trends. Follower email addresses remain private and are available only to Podium Watch administration for notification support.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/team-auth-client.js" defer></script>
  <script src="/scripts/team-insights.js" defer></script>`;

  return layout({
    site,
    title: "Team Insights",
    description: "Team profile analytics, followers, notifications, and sponsor activity.",
    pathname: "/team-insights/",
    content
  });
}
