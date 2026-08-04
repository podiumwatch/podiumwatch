import {
  layout,
  pageHero
} from "../lib/html.mjs";

export function claimTeamPage(site) {
  const content = `${pageHero({
    eyebrow: "Claim Your Team",
    title: "Give your program an official home.",
    description:
      "Coaches and approved team representatives can claim an Ohio team page and keep schedules, rosters, results, announcements, recruiting links, and social media current."
  })}

  <style>
    .claim-team-shell {
      display: grid;
      gap: 24px;
    }

    .claim-team-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
    }

    .claim-team-step {
      min-height: 100%;
    }

    .claim-team-step strong {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      margin-bottom: 16px;
      border-radius: 50%;
      background: #00bf63;
      color: #08130d;
      font-size: 1.1rem;
    }

    .claim-team-step h2,
    .claim-team-step p {
      margin-bottom: 0;
    }

    .claim-team-benefits {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .claim-team-benefit {
      padding: 18px;
      border: 1px solid rgba(15, 23, 42, .11);
      border-radius: 12px;
      background: #fff;
    }

    .claim-team-benefit h3,
    .claim-team-benefit p {
      margin-bottom: 0;
    }

    .claim-team-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .claim-team-trust {
      display: grid;
      grid-template-columns: minmax(0, 1.3fr) minmax(260px, .7fr);
      gap: 20px;
      align-items: center;
      border-left: 6px solid #00bf63;
    }

    @media (max-width: 760px) {
      .claim-team-grid,
      .claim-team-benefits,
      .claim-team-trust {
        grid-template-columns: 1fr;
      }

      .claim-team-actions {
        display: grid;
        grid-template-columns: 1fr;
      }

      .claim-team-actions .button {
        width: 100%;
        justify-content: center;
      }
    }
  </style>

  <section class="section section-paper">
    <div class="container claim-team-shell">
      <section class="info-card claim-team-trust">
        <div>
          <p class="eyebrow">Free team management</p>
          <h2>Official information, controlled by the people closest to the program</h2>
          <p>
            Podium Watch team claims are reviewed so public pages remain trustworthy. Claiming a page does not make every submitted detail official. Source labels, moderation tools, and correction reports remain active.
          </p>
        </div>

        <div class="claim-team-actions">
          <a class="button button-primary" href="/team-login/">
            Sign in or create account
          </a>

          <a class="button button-outline" href="/teams/">
            Find your team
          </a>
        </div>
      </section>

      <div class="claim-team-grid">
        <article class="info-card claim-team-step">
          <strong>1</strong>
          <h2>Find the school</h2>
          <p>
            Search the Team Directory or Ohio School Directory. Imported schools may already have an unclaimed public page ready for a coach.
          </p>
        </article>

        <article class="info-card claim-team-step">
          <strong>2</strong>
          <h2>Create a secure account</h2>
          <p>
            Use an email address you can verify. Tell Podium Watch your role and connection to the school.
          </p>
        </article>

        <article class="info-card claim-team-step">
          <strong>3</strong>
          <h2>Request team access</h2>
          <p>
            Unclaimed pages may approve the first verified representative automatically. Existing team managers review additional requests.
          </p>
        </article>
      </div>

      <section class="info-card">
        <p class="eyebrow">What team managers can publish</p>
        <h2>One place for the information families and athletes need</h2>

        <div class="claim-team-benefits" style="margin-top:20px;">
          <article class="claim-team-benefit">
            <h3>Schedules and meet links</h3>
            <p>Connect official team schedules with Podium Watch Meet Center pages.</p>
          </article>

          <article class="claim-team-benefit">
            <h3>Rosters and seasons</h3>
            <p>Maintain current boys, girls, varsity, and junior high roster information.</p>
          </article>

          <article class="claim-team-benefit">
            <h3>Results and achievements</h3>
            <p>Share verified accomplishments, meet recaps, and program milestones.</p>
          </article>

          <article class="claim-team-benefit">
            <h3>Recruiting information</h3>
            <p>Add approved coach contacts, questionnaires, school websites, and recruiting links.</p>
          </article>

          <article class="claim-team-benefit">
            <h3>Announcements and media</h3>
            <p>Publish practice updates, team news, graphics, photos, and Podium Watch coverage.</p>
          </article>

          <article class="claim-team-benefit">
            <h3>Analytics and followers</h3>
            <p>See privacy safe engagement totals and grow a repeat audience around the program.</p>
          </article>
        </div>
      </section>

      <section class="info-card">
        <p class="eyebrow">Start here</p>
        <h2>Search before creating a new page</h2>
        <p>
          The statewide foundation is designed to reduce duplicate school profiles. Search the official school list and Team Directory before creating a new program.
        </p>

        <div class="claim-team-actions" style="margin-top:18px;">
          <a class="button button-primary" href="/ohio-schools/">
            Search official schools
          </a>

          <a class="button button-outline" href="/teams/">
            Search team pages
          </a>

          <a class="button button-dark" href="/team-login/">
            Open team account
          </a>
        </div>
      </section>
    </div>
  </section>`;

  return layout({
    site,
    title: "Claim Your Team",
    description:
      "Claim an Ohio high school cross country or track team page and manage schedules, rosters, results, announcements, recruiting links, and official team information.",
    pathname: "/claim-your-team/",
    content
  });
}
