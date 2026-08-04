import { layout, pageHero } from "../lib/html.mjs";

export function followPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Team Alerts",
    title: "Manage your team alerts.",
    description:
      "Choose the teams and updates you want, switch between immediate alerts and a weekly recap, or stop notifications at any time."
  })}

  <style>
    .follow-shell { display:grid; gap:24px; }
    .follow-message { padding:16px 18px; border-radius:12px; background:rgba(0,191,99,.12); }
    .follow-card { display:grid; gap:18px; padding:24px; border-radius:16px; background:#fff; box-shadow:0 12px 32px rgba(15,23,42,.08); }
    .follow-card h2, .follow-card p { margin-bottom:0; }
    .follow-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:14px; }
    .follow-option { display:flex; gap:10px; align-items:flex-start; padding:14px; border:1px solid rgba(15,23,42,.12); border-radius:11px; background:rgba(15,23,42,.03); }
    .follow-option input { margin-top:3px; }
    .follow-actions { display:flex; flex-wrap:wrap; gap:10px; }
    .follow-empty { padding:28px; text-align:center; }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="follow-shell">
        <p class="follow-message" data-follow-message aria-live="polite" hidden></p>

        <div class="info-card" data-follow-loading>
          <h2>Loading notification settings</h2>
          <p>Podium Watch is checking your secure notification link.</p>
        </div>

        <div data-follow-content hidden>
          <div class="section-heading">
            <div>
              <p class="eyebrow">Notification settings</p>
              <h2 data-follow-email>Your followed teams</h2>
            </div>
            <button class="button button-outline" type="button" data-follow-unsubscribe-all>
              Stop all alerts
            </button>
          </div>

          <div class="follow-shell" data-follow-list></div>

          <div class="info-card follow-empty" data-follow-empty hidden>
            <h2>No active team alerts</h2>
            <p>Open a published team profile and use the follow form to add a team.</p>
            <a class="button button-primary" href="/teams/">Browse teams</a>
          </div>
        </div>
      </div>
    </div>
  </section>

  <script src="/scripts/follow.js" defer></script>`;

  return layout({
    site,
    title: "Manage Team Alerts",
    description: "Manage Podium Watch team notifications and weekly recaps.",
    pathname: "/follow/",
    content
  });
}
