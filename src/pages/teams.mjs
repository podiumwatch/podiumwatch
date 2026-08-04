import {
  layout,
  pageHero
} from "../lib/html.mjs";

export function teamsPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Team Profiles",
    title: "Find your team.",
    description:
      "Search Ohio cross country and track programs, discover official social media accounts, and explore team schedules, rosters, results, and coverage."
  })}

  <style>
    .team-directory-shell {
      display: grid;
      gap: 28px;
    }

    .team-directory-search {
      display: grid;
      gap: 20px;
    }

    .team-directory-fields {
      display: grid;
      grid-template-columns: repeat(
        auto-fit,
        minmax(210px, 1fr)
      );
      gap: 16px;
    }

    .team-directory-search label {
      display: block;
    }

    .team-directory-search input,
    .team-directory-search select {
      display: block;
      width: 100%;
      margin-top: 8px;
      padding: 12px;
      border: 1px solid rgba(15, 23, 42, 0.22);
      border-radius: 9px;
      background: #ffffff;
      font: inherit;
    }

    .team-directory-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .team-directory-status {
      padding: 14px 16px;
      border-radius: 10px;
      background: rgba(0, 191, 99, 0.1);
    }

    .team-directory-heading {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: end;
      gap: 16px;
    }

    .team-directory-heading h2,
    .team-directory-heading p {
      margin-bottom: 0;
    }

    .team-directory-grid {
      display: grid;
      grid-template-columns: repeat(
        auto-fit,
        minmax(270px, 1fr)
      );
      gap: 20px;
    }


    .directory-sponsor-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }

    .engagement-sponsor-card {
      display: grid;
      gap: 14px;
      padding: 20px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-left: 5px solid #00bf63;
      border-radius: 14px;
      background: #ffffff;
    }

    .engagement-sponsor-card img {
      max-width: 180px;
      max-height: 70px;
      object-fit: contain;
    }

    .engagement-sponsor-card h3,
    .engagement-sponsor-card p {
      margin: 0;
    }

    .engagement-sponsor-label {
      font-size: 0.72rem;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(15, 23, 42, 0.58);
    }

    .team-directory-card {
      overflow: hidden;
      display: flex;
      flex-direction: column;
      min-height: 100%;
      border: 1px solid rgba(15, 23, 42, 0.13);
      border-radius: 16px;
      background: #ffffff;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.07);
    }

    .team-directory-card-top {
      height: 12px;
      background: var(
        --directory-team-primary,
        #00bf63
      );
    }

    .team-directory-card-body {
      display: grid;
      gap: 16px;
      padding: 22px;
      flex: 1;
    }

    .team-directory-card-identity {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 16px;
      align-items: center;
    }

    .team-directory-logo {
      width: 76px;
      height: 76px;
      object-fit: contain;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 12px;
      background: #ffffff;
    }

    .team-directory-logo-placeholder {
      display: grid;
      place-items: center;
      width: 76px;
      height: 76px;
      border-radius: 12px;
      background: var(
        --directory-team-secondary,
        #111827
      );
      color: #ffffff;
      font-size: 1.25rem;
      font-weight: 900;
    }

    .team-directory-card h3,
    .team-directory-card p {
      margin: 0;
    }

    .team-directory-card-location {
      margin-top: 5px !important;
      color: rgba(15, 23, 42, 0.7);
    }

    .team-directory-badges,
    .team-directory-socials {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .team-directory-badge {
      display: inline-flex;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(0, 191, 99, 0.13);
      font-size: 0.78rem;
      font-weight: 850;
    }

    .team-directory-badge-dark {
      background: #111827;
      color: #ffffff;
    }

    .team-directory-social {
      display: inline-flex;
      padding: 6px 9px;
      border: 1px solid rgba(15, 23, 42, 0.16);
      border-radius: 8px;
      font-size: 0.78rem;
      font-weight: 800;
    }

    .team-directory-card-actions {
      margin-top: auto;
    }

    .team-directory-card-actions .button {
      width: 100%;
      justify-content: center;
    }

    .team-directory-empty {
      padding: 34px;
      text-align: center;
    }

    .team-directory-manager {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 20px;
      align-items: center;
    }

    .team-directory-manager h2,
    .team-directory-manager p {
      margin-bottom: 0;
    }

    @media (max-width: 680px) {
      .team-directory-actions {
        display: grid;
        grid-template-columns: 1fr;
      }

      .team-directory-actions .button {
        width: 100%;
        justify-content: center;
      }

      .team-directory-manager {
        grid-template-columns: 1fr;
      }

      .team-directory-manager .button {
        width: 100%;
        justify-content: center;
      }
    }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="team-directory-shell">
        <section class="info-card">
          <p class="eyebrow">
            Team search
          </p>

          <h2>Search Ohio programs</h2>

          <form
            class="team-directory-search"
            data-team-directory-form
          >
            <div class="team-directory-fields">
              <label>
                <strong>
                  School, city, mascot, or conference
                </strong>

                <input
                  type="search"
                  name="search"
                  placeholder="Search team profiles"
                >
              </label>

              <label>
                <strong>Ohio region</strong>

                <select name="region">
                  <option value="">
                    All regions
                  </option>

                  <option value="Northeast">
                    Northeast
                  </option>

                  <option value="Northwest">
                    Northwest
                  </option>

                  <option value="Central">
                    Central
                  </option>

                  <option value="Southeast">
                    Southeast
                  </option>

                  <option value="Southwest">
                    Southwest
                  </option>
                </select>
              </label>

              <label>
                <strong>Program level</strong>

                <select name="program_level">
                  <option value="">
                    All levels
                  </option>

                  <option value="high_school">
                    High School
                  </option>

                  <option value="middle_school">
                    Middle School
                  </option>

                  <option value="club">
                    Club
                  </option>
                </select>
              </label>

              <label>
                <strong>Program</strong>

                <select name="program_scope">
                  <option value="">
                    All programs
                  </option>

                  <option value="combined">
                    Boys and Girls
                  </option>

                  <option value="boys">
                    Boys
                  </option>

                  <option value="girls">
                    Girls
                  </option>
                </select>
              </label>


              <label>
                <strong>Boys XC division</strong>

                <select name="cross_country_boys_division">
                  <option value="">All divisions</option>
                  <option value="Division I">Division I</option>
                  <option value="Division II">Division II</option>
                  <option value="Division III">Division III</option>
                  <option value="Division IV">Division IV</option>
                </select>
              </label>
            </div>

            <div class="team-directory-actions">
              <button
                class="button button-primary"
                type="submit"
              >
                Search teams
              </button>

              <button
                class="button button-outline"
                type="button"
                data-team-directory-clear
              >
                Clear filters
              </button>
            </div>
          </form>
        </section>

        <p
          class="team-directory-status"
          data-team-directory-status
          aria-live="polite"
          hidden
        ></p>


        <section class="info-card" data-directory-sponsor-section hidden>
          <p class="eyebrow">Podium Watch partners</p>
          <h2>Supporting Ohio running</h2>
          <div class="directory-sponsor-grid" data-directory-sponsor-list></div>
        </section>

        <section>
          <div class="team-directory-heading">
            <div>
              <p class="eyebrow">
                Team profiles
              </p>

              <h2>Explore programs</h2>
            </div>

            <p>
              <strong data-team-directory-count>
                0
              </strong>
              teams found
            </p>
          </div>

          <div
            class="team-directory-grid"
            data-team-directory-results
            style="margin-top:22px;"
          ></div>

          <div
            class="info-card team-directory-empty"
            data-team-directory-empty
            hidden
          >
            <h2>No team profiles found</h2>

            <p>
              Try changing the search or clearing the filters.
            </p>
          </div>
        </section>

        <section class="info-card team-directory-manager">
          <div>
            <p class="eyebrow">
              Coaches and team representatives
            </p>

            <h2>Manage your program</h2>

            <p>
              Create or claim a team page to publish official social accounts, schedules, rosters, results, announcements, and program information.
            </p>
          </div>

          <div class="team-directory-actions">
            <a
              class="button button-primary"
              href="/claim-your-team/"
            >
              Claim your team
            </a>

            <a
              class="button button-outline"
              href="/team-login/"
            >
              Team account
            </a>
          </div>
        </section>
      </div>
    </div>
  </section>

  <script
    src="/scripts/team-directory.js"
    defer
  ></script>
  <script src="/scripts/engagement.js" defer></script>`;

  return layout({
    site,
    title: "Team Directory",
    description:
      "Search Ohio cross country and track team profiles, official social media accounts, schedules, rosters, and results.",
    pathname: "/teams/",
    content
  });
}