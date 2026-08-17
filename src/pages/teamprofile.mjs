import {
  layout,
  pageHero
} from "../lib/html.mjs";

export function teamProfilePage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Team Profiles",
    title: "Team profile.",
    description:
      "Official program information, social accounts, schedules, rosters, results, and Podium Watch coverage."
  })}

  <style>
    .team-profile-shell {
      display: grid;
      gap: 26px;
      --team-primary: #00bf63;
      --team-secondary: #111827;
    }

    .team-profile-preview-notice,
    .team-profile-claim-notice,
    .team-profile-message {
      padding: 16px 18px;
      border-radius: 12px;
      background: #ffffff;
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
    }

    .team-profile-preview-notice {
      border: 2px solid var(--team-primary);
      font-weight: 800;
    }

    .team-profile-claim-notice {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 18px;
      align-items: center;
      border-left: 6px solid var(--team-primary);
    }

    .team-profile-claim-notice h2,
    .team-profile-claim-notice p {
      margin-bottom: 6px;
    }

    .team-profile-banner {
      width: 100%;
      max-height: 430px;
      object-fit: cover;
      border-radius: 18px;
    }

    .team-profile-hero {
      position: relative;
      overflow: hidden;
      padding: 32px;
      border-radius: 20px;
      background: var(--team-secondary);
      color: #ffffff;
      box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18);
    }

    .team-profile-hero::after {
      content: "";
      position: absolute;
      right: -90px;
      bottom: -120px;
      width: 300px;
      height: 300px;
      border-radius: 50%;
      background: var(--team-primary);
      opacity: 0.22;
    }

    .team-profile-identity {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 24px;
      align-items: center;
    }

    .team-profile-logo {
      width: 135px;
      height: 135px;
      object-fit: contain;
      border: 4px solid rgba(255, 255, 255, 0.9);
      border-radius: 18px;
      background: #ffffff;
    }

    .team-profile-live-strip {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 20px;
      border-radius: 12px;
      background: #dc2626;
      color: #ffffff;
      font-weight: 800;
    }

    .team-profile-live-strip a {
      color: #ffffff;
    }

    .team-profile-live-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-size: 0.82rem;
    }

    .team-profile-live-badge::before {
      content: "";
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #ffffff;
      animation: team-profile-live-pulse 1.6s ease-in-out infinite;
    }

    @keyframes team-profile-live-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }

    .team-profile-hero h1 {
      margin: 0;
      color: #ffffff;
    }

    .team-profile-location {
      margin: 10px 0 0;
      opacity: 0.9;
    }

    .team-profile-badges,
    .team-profile-socials,
    .team-profile-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .team-profile-badges {
      margin-bottom: 14px;
    }

    .team-profile-badge {
      display: inline-flex;
      padding: 7px 11px;
      border-radius: 999px;
      background: var(--team-primary);
      color: #07130d;
      font-size: 0.8rem;
      font-weight: 900;
    }

    .team-profile-badge-light {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
    }

    .team-profile-socials {
      position: relative;
      z-index: 1;
      margin-top: 25px;
    }

    .team-profile-social-link {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      padding: 10px 15px;
      border: 1px solid rgba(255, 255, 255, 0.38);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
      font-weight: 900;
      text-decoration: none;
    }

    .team-profile-social-link:hover {
      background: var(--team-primary);
      color: #07130d;
    }

    .team-profile-meta {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 22px;
      align-items: center;
      padding: 20px;
      border-radius: 15px;
      background: #ffffff;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.07);
    }

    .team-profile-progress {
      overflow: hidden;
      height: 11px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.1);
    }

    .team-profile-progress span {
      display: block;
      height: 100%;
      width: 0;
      background: var(--team-primary);
    }

    .team-profile-facts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 16px;
    }

    .team-profile-fact {
      padding: 18px;
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.05);
    }

    .team-profile-fact p {
      margin: 6px 0 0;
    }

    .team-profile-section {
      padding: 27px;
      border-radius: 17px;
      background: #ffffff;
      box-shadow: 0 12px 34px rgba(15, 23, 42, 0.08);
    }

    .team-instagram-current { font-weight: 800; font-size: 1.05rem; }
    .team-instagram-current a { color: inherit; }
    .team-instagram-help { color: rgba(15, 23, 42, .68); font-weight: 500; margin: 8px 0; }
    .team-instagram-details summary { cursor: pointer; font-weight: 800; margin-top: 10px; }
    .team-instagram-form { display: grid; gap: 12px; max-width: 360px; margin-top: 12px; }
    .team-instagram-form label { display: grid; gap: 6px; font-weight: 800; }
    .team-instagram-form input { width: 100%; padding: 10px 12px; border: 1px solid rgba(15,23,42,.22); border-radius: 9px; background: #fff; font: inherit; }
    .team-instagram-honeypot { position: absolute !important; left: -10000px !important; width: 1px !important; height: 1px !important; overflow: hidden !important; }
    .team-instagram-message { padding: 10px 12px; border-radius: 8px; font-weight: 700; }
    .team-instagram-message[data-tone="success"] { background: rgba(0,191,99,.13); color: #08130d; }
    .team-instagram-message[data-tone="error"] { background: rgba(226,58,58,.12); color: #7a1414; }

    .engagement-sponsor-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
    }

    .engagement-sponsor-card {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 18px;
      align-items: center;
      padding: 20px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-left: 5px solid var(--team-primary);
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.03);
    }

    .engagement-sponsor-card img {
      width: 96px;
      max-height: 74px;
      object-fit: contain;
      border-radius: 10px;
      background: #ffffff;
    }

    .engagement-sponsor-card h3,
    .engagement-sponsor-card p {
      margin: 0 0 8px;
    }

    .engagement-sponsor-label {
      grid-column: 1 / -1;
      font-size: 0.72rem;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(15, 23, 42, 0.58);
    }

    .engagement-follow-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(300px, 0.8fr);
      gap: 24px;
      align-items: start;
    }

    .engagement-follow-form {
      display: grid;
      gap: 13px;
      padding: 20px;
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.04);
    }

    .engagement-follow-form label {
      display: block;
    }

    .engagement-follow-form input,
    .engagement-follow-form select {
      display: block;
      width: 100%;
      margin-top: 7px;
      padding: 11px;
      border: 1px solid rgba(15, 23, 42, 0.2);
      border-radius: 9px;
      font: inherit;
      background: #ffffff;
    }

    .engagement-follow-check {
      display: flex !important;
      align-items: flex-start;
      gap: 9px;
      font-weight: 750;
    }

    .engagement-follow-check input {
      width: auto;
      margin: 3px 0 0;
    }

    .engagement-follow-message {
      margin: 0;
      padding: 12px;
      border-radius: 9px;
      background: rgba(0, 191, 99, 0.12);
    }

    .engagement-follow-honeypot {
      position: absolute !important;
      left: -10000px !important;
    }

    @media (max-width: 760px) {
      .engagement-follow-layout,
      .engagement-sponsor-card {
        grid-template-columns: 1fr;
      }
    }

    .team-profile-copy {
      white-space: pre-line;
    }

    .team-profile-division-grid,
    .team-profile-coming-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 15px;
    }

    .team-profile-division-card,
    .team-profile-coming-card {
      padding: 18px;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.05);
    }

    .team-profile-division-card {
      border-left: 5px solid var(--team-primary);
    }

    .team-profile-path-intro { margin: 0 0 4px; font-weight: 800; }
    .team-profile-path-tabs { margin: 14px 0 4px; }
    .team-profile-path-note {
      margin: 18px 0 0; padding: 13px 15px; border-left: 5px solid var(--team-primary);
      border-radius: 10px; background: rgba(15, 23, 42, 0.05); font-weight: 750;
    }

    .team-profile-schedule-grid,
    .team-profile-schedule-list {
      display: grid;
      gap: 16px;
    }

    .team-profile-schedule-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .team-profile-schedule-column {
      display: grid;
      align-content: start;
      gap: 14px;
    }

    .team-profile-meet-card {
      display: grid;
      gap: 11px;
      padding: 18px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-left: 5px solid var(--team-primary);
      border-radius: 13px;
      background: rgba(15, 23, 42, 0.035);
    }

    .team-profile-meet-card h3,
    .team-profile-meet-card p {
      margin: 0;
    }

    .team-profile-meet-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .team-profile-meet-badge {
      display: inline-flex;
      padding: 5px 9px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.08);
      font-size: 0.75rem;
      font-weight: 850;
    }

    .team-profile-meet-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
    }

    .team-profile-meet-note {
      white-space: pre-line;
      color: rgba(15, 23, 42, 0.72);
    }

    .team-profile-schedule-empty {
      padding: 18px;
      border-radius: 11px;
      background: rgba(15, 23, 42, 0.05);
    }


    .team-profile-roster-controls,
    .team-profile-roster-badges,
    .team-profile-athlete-links {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .team-profile-roster-controls {
      margin: 18px 0 22px;
    }

    .team-profile-roster-season {
      padding: 10px 14px;
      border: 1px solid rgba(15, 23, 42, 0.18);
      border-radius: 999px;
      background: #ffffff;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }

    .team-profile-roster-season[aria-pressed="true"] {
      background: var(--team-primary, #00bf63);
      color: #ffffff;
      border-color: transparent;
    }

    .team-profile-roster-groups {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 22px;
    }

    .team-profile-roster-group {
      display: grid;
      gap: 14px;
      align-content: start;
    }

    .team-profile-athlete-card {
      display: grid;
      gap: 12px;
      padding: 18px;
      border: 1px solid rgba(15, 23, 42, 0.13);
      border-radius: 14px;
      background: #ffffff;
    }

    .team-profile-athlete-card h3,
    .team-profile-athlete-card p {
      margin: 0;
    }

    .team-profile-roster-badge,
    .team-profile-athlete-link {
      display: inline-flex;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(0, 191, 99, 0.13);
      font-size: 0.78rem;
      font-weight: 850;
    }

    .team-profile-athlete-link {
      border: 1px solid rgba(15, 23, 42, 0.16);
      background: #ffffff;
      color: inherit;
      text-decoration: none;
    }

    .team-profile-roster-empty {
      padding: 20px;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.05);
      text-align: center;
    }

    .team-profile-report-form {
      display: grid;
      gap: 15px;
      max-width: 760px;
    }

    .team-profile-report-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
    }

    .team-profile-report-form label {
      display: block;
    }

    .team-profile-report-form input,
    .team-profile-report-form select,
    .team-profile-report-form textarea {
      display: block;
      width: 100%;
      margin-top: 7px;
      padding: 11px;
      border: 1px solid rgba(15, 23, 42, 0.2);
      border-radius: 9px;
      background: #ffffff;
      font: inherit;
    }

    .team-profile-honeypot {
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    }

    .team-content-public-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 18px;
    }

    .team-content-public-card,
    .team-content-public-media-card,
    .team-content-public-recruiting-card {
      overflow: hidden;
      border: 1px solid rgba(15, 23, 42, 0.13);
      border-radius: 14px;
      background: #ffffff;
    }

    .team-content-public-card-body {
      display: grid;
      gap: 11px;
      padding: 20px;
    }

    .team-content-public-card h3,
    .team-content-public-card p,
    .team-content-public-media-card h3,
    .team-content-public-media-card p,
    .team-content-public-recruiting-card h3,
    .team-content-public-recruiting-card p {
      margin: 0;
    }

    .team-content-public-image {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      background: rgba(15, 23, 42, 0.06);
    }

    .team-content-public-meta,
    .team-content-public-source {
      color: rgba(15, 23, 42, 0.68);
      font-size: 0.86rem;
      font-weight: 750;
    }

    .team-content-public-copy {
      white-space: pre-line;
    }

    .team-content-public-result {
      padding: 11px 13px;
      border-radius: 9px;
      background: rgba(0, 191, 99, 0.11);
    }

    .team-content-public-recruiting-card {
      padding: 20px;
    }

    .team-content-public-recruiting-card .button,
    .team-content-public-card .button,
    .team-content-public-media-card .button {
      width: fit-content;
    }

    .team-profile-loading {
      padding: 32px;
      text-align: center;
    }

    @media (max-width: 680px) {
      .team-profile-identity,
      .team-profile-claim-notice,
      .team-profile-meta {
        grid-template-columns: 1fr;
      }

      .team-profile-logo {
        width: 105px;
        height: 105px;
      }

      .team-profile-socials,
      .team-profile-actions {
        display: grid;
        grid-template-columns: 1fr;
      }

      .team-profile-social-link,
      .team-profile-actions .button,
      .team-profile-claim-notice .button {
        width: 100%;
        justify-content: center;
      }

      .team-profile-schedule-grid {
        grid-template-columns: 1fr;
      }


      .team-profile-roster-groups {
        grid-template-columns: 1fr;
      }

      .team-profile-meet-actions {
        display: grid;
      }

      .team-profile-meet-actions .button {
        width: 100%;
        justify-content: center;
      }
    }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="info-card team-profile-loading" data-team-profile-loading>
        <h2>Loading team profile</h2>
        <p>Podium Watch is gathering this program's information.</p>
      </div>

      <article class="team-profile-shell" data-team-profile hidden>
        <div class="team-profile-preview-notice" data-team-profile-preview-notice hidden>
          Private preview. This page may not currently be listed publicly.
        </div>

        <div class="team-profile-claim-notice" data-team-profile-claim-notice hidden>
          <div>
            <h2>This team has not been claimed</h2>
            <p>Are you a coach or approved team representative? Connect your account to complete and manage this page.</p>
          </div>
          <a class="button button-primary" data-team-profile-claim-link href="/team-login/">Sign in to claim this team</a>
        </div>

        <img class="team-profile-banner" data-team-profile-banner alt="" hidden>

        <header class="team-profile-hero">
          <div class="team-profile-identity">
            <img class="team-profile-logo" data-team-profile-logo alt="" hidden>
            <div>
              <div class="team-profile-badges" data-team-profile-badges></div>
              <h1 data-team-profile-name></h1>
              <p class="team-profile-location" data-team-profile-location></p>
            </div>
          </div>
          <div class="team-profile-socials" data-team-profile-socials></div>
        </header>

        <div class="team-profile-live-strip" data-team-profile-live-strip hidden></div>

        <section class="team-profile-section team-instagram-section">
          <div><p class="eyebrow">Community submitted</p><h2>Team Instagram</h2></div>
          <p data-team-instagram-current class="team-instagram-current" hidden></p>
          <p data-team-instagram-empty class="team-instagram-help">No Instagram handle has been submitted for this team yet.</p>
          <details class="team-instagram-details">
            <summary>Submit or update this team's Instagram</summary>
            <p class="team-instagram-help">No account needed. Submissions are checked automatically (a valid handle format, and that the account is real) and take effect right away. One submission is accepted per team every few hours.</p>
            <form class="team-instagram-form" data-team-instagram-form>
              <label>Instagram handle<input type="text" name="handle" required maxlength="60" placeholder="@teamhandle"></label>
              <label class="team-instagram-honeypot" aria-hidden="true">Leave this blank<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
              <p class="team-instagram-message" data-team-instagram-message role="status" hidden></p>
              <button class="button button-dark" type="submit" data-team-instagram-button>Submit</button>
            </form>
          </details>
        </section>

        <section class="team-profile-meta">
          <div>
            <p class="eyebrow">Profile completion</p>
            <h2 data-team-profile-completion>0 percent complete</h2>
            <div class="team-profile-progress"><span data-team-profile-progress></span></div>
          </div>
          <p data-team-profile-updated></p>
        </section>

        <section class="team-profile-section">
          <div class="team-profile-facts" data-team-profile-facts></div>
        </section>

        <section class="team-profile-section" data-team-sponsor-section hidden>
          <p class="eyebrow">Podium Watch partners</p>
          <h2>Supporting Ohio running</h2>
          <div class="engagement-sponsor-grid" data-team-sponsor-list></div>
        </section>

        <section class="team-profile-section" data-team-overview-section hidden>
          <p class="eyebrow">Program overview</p>
          <h2>About the team</h2>
          <p class="team-profile-copy" data-team-overview></p>
        </section>

        <section class="team-profile-section" data-team-coaches-section hidden>
          <p class="eyebrow">Coaching staff</p>
          <h2>Team contacts</h2>
          <p class="team-profile-copy" data-team-coaches></p>
          <div class="team-profile-actions" data-team-contact-actions style="margin-top:18px;"></div>
        </section>

        <section class="team-profile-section" data-team-divisions-section hidden>
          <p class="eyebrow">OHSAA divisions</p>
          <h2>Program divisions</h2>
          <div class="team-profile-division-grid" data-team-divisions></div>
        </section>

        <section class="team-profile-section" data-team-path-section hidden>
          <p class="eyebrow">OHSAA cross country tournament</p>
          <h2>Path to State</h2>
          <p class="team-profile-path-intro" data-team-path-intro></p>
          <div class="gender-tabs tournament-tabs team-profile-path-tabs" role="group" aria-label="Choose a program" data-team-path-tabs hidden>
            <button type="button" data-team-path-gender="boys" aria-pressed="true">Boys</button>
            <button type="button" data-team-path-gender="girls" aria-pressed="false">Girls</button>
          </div>
          <ol class="path-to-state" data-team-path-roadmap></ol>
          <p class="team-profile-path-note" data-team-path-note hidden></p>
          <p class="path-to-state-source" data-team-path-source></p>
        </section>

        <section class="team-profile-section" data-team-history-section hidden>
          <p class="eyebrow">Program history</p>
          <h2>Team history</h2>
          <p class="team-profile-copy" data-team-history></p>
        </section>

        <section class="team-profile-section" data-team-traditions-section hidden>
          <p class="eyebrow">Program identity</p>
          <h2>Traditions</h2>
          <p class="team-profile-copy" data-team-traditions></p>
        </section>

        <section class="team-profile-section" data-team-schedule-section hidden>
          <p class="eyebrow">Meet Center schedule</p>
          <h2>Team schedule</h2>
          <div class="team-profile-schedule-grid">
            <div class="team-profile-schedule-column">
              <h3>Upcoming meets</h3>
              <div class="team-profile-schedule-list" data-team-schedule-upcoming></div>
              <div class="team-profile-schedule-empty" data-team-schedule-upcoming-empty hidden>No upcoming meets are connected.</div>
            </div>
            <div class="team-profile-schedule-column">
              <h3>Completed meets</h3>
              <div class="team-profile-schedule-list" data-team-schedule-completed></div>
              <div class="team-profile-schedule-empty" data-team-schedule-completed-empty hidden>No completed meets are connected.</div>
            </div>
          </div>
        </section>


        <section class="team-profile-section" data-team-roster-section hidden>
          <p class="eyebrow">Published team rosters</p>
          <h2 data-team-roster-heading>Team roster</h2>
          <p data-team-roster-description></p>
          <div class="team-profile-roster-controls" data-team-roster-seasons></div>
          <div class="team-profile-roster-groups">
            <div class="team-profile-roster-group">
              <h3>Boys roster</h3>
              <div class="team-profile-roster-group" data-team-roster-boys></div>
              <div class="team-profile-roster-empty" data-team-roster-boys-empty hidden>No boys are listed for this season.</div>
            </div>
            <div class="team-profile-roster-group">
              <h3>Girls roster</h3>
              <div class="team-profile-roster-group" data-team-roster-girls></div>
              <div class="team-profile-roster-empty" data-team-roster-girls-empty hidden>No girls are listed for this season.</div>
            </div>
          </div>
        </section>

        <section class="team-profile-section" data-team-content-featured-section hidden>
          <p class="eyebrow">Featured by the team</p>
          <h2>Featured content</h2>
          <div class="team-content-public-grid" data-team-content-featured-list></div>
        </section>

        <section class="team-profile-section" data-team-content-announcements-section hidden>
          <p class="eyebrow">Program updates</p>
          <h2>Announcements</h2>
          <div class="team-content-public-grid" data-team-content-announcements-list></div>
        </section>

        <section class="team-profile-section" data-team-content-results-section hidden>
          <p class="eyebrow">Competition recap</p>
          <h2>Team results</h2>
          <div class="team-content-public-grid" data-team-content-results-list></div>
        </section>

        <section class="team-profile-section" data-team-content-achievements-section hidden>
          <p class="eyebrow">Program accomplishments</p>
          <h2>Achievements</h2>
          <div class="team-content-public-grid" data-team-content-achievements-list></div>
        </section>

        <section class="team-profile-section" data-team-content-coverage-section hidden>
          <p class="eyebrow">Podium Watch</p>
          <h2>Coverage and features</h2>
          <div class="team-content-public-grid" data-team-content-coverage-list></div>
        </section>

        <section class="team-profile-section" data-team-content-media-section hidden>
          <p class="eyebrow">Photos and video</p>
          <h2>Media gallery</h2>
          <div class="team-content-public-grid" data-team-content-media-list></div>
        </section>

        <section class="team-profile-section" data-team-content-recruiting-section hidden>
          <p class="eyebrow">College recruiting and program links</p>
          <h2>Recruiting information</h2>
          <div class="team-content-public-grid" data-team-content-recruiting-list></div>
        </section>

        <section class="team-profile-section engagement-follow-layout" data-team-follow-section hidden></section>

        <section class="team-profile-section" data-team-report-section>
          <p class="eyebrow">Help keep profiles accurate</p>
          <h2>Report a problem with this page</h2>
          <p>Use this only for incorrect information, duplicate profiles, ownership concerns, inappropriate content, or outdated links.</p>

          <p class="team-profile-message" data-team-report-message hidden></p>

          <form class="team-profile-report-form" data-team-report-form>
            <div class="team-profile-report-grid">
              <label>
                <strong>Reason</strong>
                <select name="reason" required>
                  <option value="wrong_information">Wrong information</option>
                  <option value="fake_ownership">Ownership concern</option>
                  <option value="inappropriate_content">Inappropriate content</option>
                  <option value="duplicate_team">Duplicate team profile</option>
                  <option value="outdated_link">Outdated social or website link</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                <strong>Your name</strong>
                <input type="text" name="reporter_name" placeholder="Optional">
              </label>
              <label>
                <strong>Your email</strong>
                <input type="email" name="reporter_email" placeholder="Optional">
              </label>
            </div>
            <label>
              <strong>What needs corrected?</strong>
              <textarea name="details" rows="5" minlength="20" maxlength="3000" required></textarea>
            </label>
            <label class="team-profile-honeypot" aria-hidden="true">
              Website
              <input type="text" name="website" tabindex="-1" autocomplete="off">
            </label>
            <button class="button button-outline" type="submit">Submit report</button>
          </form>
        </section>

        <div class="team-profile-actions">
          <a class="button button-outline" href="/teams/">Back to Team Directory</a>
          <a class="button button-primary" data-team-profile-return href="/team-dashboard/" hidden>Return to team dashboard</a>
        </div>
      </article>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/team-auth-client.js" defer></script>
  <script src="/scripts/path-to-state.js" defer></script>
  <script src="/scripts/team-profile.js" defer></script>
  <script src="/scripts/team-content-public.js" defer></script>
  <script src="/scripts/engagement.js" defer></script>`;

  return layout({
    site,
    title: "Team Profile",
    description: "Official team information, social media accounts, schedules, rosters, results, and Podium Watch coverage.",
    pathname: "/team/",
    content
  });
}
