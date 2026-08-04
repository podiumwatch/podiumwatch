import {
  layout,
  pageHero
} from "../lib/html.mjs";

export function teamDashboardPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Team Pages",
    title: "Team dashboard.",
    description:
      "Create, claim, and manage your program's Podium Watch team page."
  })}

  <style>
    .team-dashboard-grid {
      display: grid;
      gap: 28px;
    }

    .team-dashboard-form {
      display: grid;
      gap: 18px;
    }

    .team-dashboard-fields {
      display: grid;
      grid-template-columns: repeat(
        auto-fit,
        minmax(230px, 1fr)
      );
      gap: 18px;
    }

    .team-dashboard-form label {
      display: block;
    }

    .team-dashboard-form input,
    .team-dashboard-form select,
    .team-dashboard-form textarea {
      display: block;
      width: 100%;
      margin-top: 8px;
      padding: 12px;
      border: 1px solid rgba(15, 23, 42, 0.22);
      border-radius: 8px;
      background: #ffffff;
      font: inherit;
    }

    .team-account-message {
      padding: 14px 16px;
      border-radius: 10px;
      background: rgba(0, 191, 99, 0.1);
    }

    .team-school-results {
      display: grid;
      gap: 14px;
      margin-top: 20px;
    }

    .team-school-result {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
      padding: 18px;
      border: 1px solid rgba(15, 23, 42, 0.15);
      border-radius: 12px;
      background: #ffffff;
    }

    .team-school-result div:first-child {
      flex: 1 1 300px;
    }

    .team-school-result h3,
    .team-school-result p {
      margin: 0;
    }

    .team-school-result p {
      margin-top: 6px;
    }

    .team-page-card-status,
    .team-social-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 14px 0;
    }

    .team-page-badge {
      display: inline-flex;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(0, 191, 99, 0.14);
      font-size: 0.8rem;
      font-weight: 800;
    }

    .team-page-badge-dark {
      background: #111827;
      color: #ffffff;
    }

    .team-social-buttons a {
      padding: 8px 11px;
      border: 1px solid rgba(15, 23, 42, 0.2);
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 800;
      text-decoration: none;
    }

    .team-social-heading {
      margin-top: 28px;
    }

    .team-access-grid {
      display: grid;
      gap: 20px;
      margin-top: 20px;
    }

    .team-access-card {
      display: grid;
      gap: 18px;
      padding: 20px;
      border: 1px solid rgba(15, 23, 42, 0.14);
      border-radius: 14px;
      background: #ffffff;
    }

    .team-access-card h3,
    .team-access-card h4,
    .team-access-card p {
      margin: 0;
    }

    .team-access-list {
      display: grid;
      gap: 12px;
    }

    .team-access-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
      padding: 14px;
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.05);
    }

    .team-access-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }

    .team-access-actions select {
      min-width: 120px;
      padding: 9px;
      border: 1px solid rgba(15, 23, 42, 0.22);
      border-radius: 8px;
      background: #ffffff;
      font: inherit;
    }

    .team-access-note {
      color: rgba(15, 23, 42, 0.7);
      font-size: 0.9rem;
    }

    @media (max-width: 640px) {
      .team-school-result .button,
      .team-dashboard-form .button {
        width: 100%;
        justify-content: center;
      }

      .team-access-row {
        grid-template-columns: 1fr;
      }

      .team-access-actions {
        display: grid;
        justify-content: stretch;
      }

      .team-access-actions .button,
      .team-access-actions select {
        width: 100%;
      }
    }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div
        class="info-card"
        data-team-dashboard-loading
      >
        <h2>Checking your team account</h2>

        <p>
          Please wait while Podium Watch securely loads your account.
        </p>
      </div>

      <div
        class="team-dashboard-grid"
        data-team-dashboard
        hidden
      >
        <div class="section-heading">
          <div>
            <p class="eyebrow">
              Team account
            </p>

            <h2>
              Welcome,
              <span data-team-user-name></span>
            </h2>

            <p data-team-user-email></p>
          </div>

          <button
            class="button button-outline"
            type="button"
            data-team-signout
          >
            Sign out
          </button>
        </div>

        <p
          class="team-account-message"
          data-team-dashboard-message
          aria-live="polite"
          hidden
        ></p>

        <section class="info-card">
          <p class="eyebrow">
            Your programs
          </p>

          <h2>Team pages you manage</h2>

          <div
            class="stories-grid"
            data-owned-team-list
          ></div>

          <p
            data-owned-team-empty
            hidden
          >
            You do not manage a team page yet.
          </p>
        </section>

        <section
          class="info-card"
          data-team-owner-access
          hidden
        >
          <p class="eyebrow">
            Team ownership
          </p>

          <h2>Access requests and managers</h2>

          <p>
            Team owners can approve new managers and control who can edit each program. Podium Watch only needs to step in when there is a dispute.
          </p>

          <div
            class="team-access-grid"
            data-team-owner-access-list
          ></div>
        </section>

        <section class="info-card">
          <p class="eyebrow">
            Find your program
          </p>

          <h2>Search existing team pages</h2>

          <form
            class="team-dashboard-form"
            data-team-search-form
          >
            <label>
              <strong>
                School, city, or mascot
              </strong>

              <input
                type="search"
                name="query"
                placeholder="Search by school, city, or mascot"
                required
              >
            </label>

            <button
              class="button button-primary"
              type="submit"
            >
              Search schools
            </button>
          </form>

          <div
            class="team-school-results"
            data-team-search-results
          ></div>
        </section>

        <section
          class="info-card"
          data-team-claim-panel
          hidden
        >
          <p class="eyebrow">
            Request access
          </p>

          <h2>
            Claim
            <span data-claim-team-name></span>
          </h2>

          <form
            class="team-dashboard-form"
            data-team-claim-form
          >
            <input
              type="hidden"
              name="team_id"
            >

            <div class="team-dashboard-fields">
              <label>
                <strong>Your name</strong>

                <input
                  type="text"
                  name="requester_name"
                  required
                >
              </label>

              <label>
                <strong>Your role</strong>

                <select
                  name="requester_role"
                  required
                >
                  <option value="">
                    Select your role
                  </option>

                  <option value="Head Coach">
                    Head Coach
                  </option>

                  <option value="Assistant Coach">
                    Assistant Coach
                  </option>

                  <option value="Athletic Director">
                    Athletic Director
                  </option>

                  <option value="School Administrator">
                    School Administrator
                  </option>

                  <option value="Team Media Representative">
                    Team Media Representative
                  </option>
                </select>
              </label>
            </div>

            <label>
              <strong>
                Anything Podium Watch should know
              </strong>

              <textarea
                name="message"
                rows="4"
              ></textarea>
            </label>

            <div
              style="
                display:flex;
                flex-wrap:wrap;
                gap:12px;
              "
            >
              <button
                class="button button-primary"
                type="submit"
              >
                Submit access request
              </button>

              <button
                class="button button-outline"
                type="button"
                data-cancel-team-claim
              >
                Cancel
              </button>
            </div>
          </form>
        </section>

        <section class="info-card">
          <p class="eyebrow">
            New team page
          </p>

          <h2>Create a private team page</h2>

          <p>
            Search first to make sure your school does not already have a page.
          </p>

          <form
            class="team-dashboard-form"
            data-create-team-form
          >
            <div class="team-dashboard-fields">
              <label>
                <strong>School name</strong>

                <input
                  type="text"
                  name="school_name"
                  required
                >
              </label>

              <label>
                <strong>Mascot</strong>

                <input
                  type="text"
                  name="mascot"
                >
              </label>

              <label>
                <strong>City</strong>

                <input
                  type="text"
                  name="city"
                  required
                >
              </label>

              <label>
                <strong>State</strong>

                <input
                  type="text"
                  name="state"
                  value="Ohio"
                  required
                >
              </label>

              <label>
                <strong>ZIP code</strong>

                <input
                  type="text"
                  name="zip_code"
                >
              </label>

              <label>
                <strong>Conference</strong>

                <input
                  type="text"
                  name="conference"
                >
              </label>

              <label>
                <strong>Ohio region</strong>

                <select name="region">
                  <option value="">
                    Select a region
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

                <select
                  name="program_level"
                  required
                >
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

                <select
                  name="program_scope"
                  required
                >
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
                <strong>Head coach</strong>

                <input
                  type="text"
                  name="head_coach"
                >
              </label>

              <label>
                <strong>
                  Public contact email
                </strong>

                <input
                  type="email"
                  name="public_contact_email"
                >
              </label>

              <label>
                <strong>
                  Recruiting contact email
                </strong>

                <input
                  type="email"
                  name="recruiting_contact_email"
                >
              </label>
            </div>

            <h3 class="team-social-heading">
              Official team links
            </h3>

            <p>
              These will be displayed prominently on the public team page.
            </p>

            <div class="team-dashboard-fields">
              <label>
                <strong>Instagram</strong>

                <input
                  type="text"
                  name="instagram_url"
                  placeholder="instagram.com/yourteam"
                >
              </label>

              <label>
                <strong>X</strong>

                <input
                  type="text"
                  name="x_url"
                  placeholder="x.com/yourteam"
                >
              </label>

              <label>
                <strong>Facebook</strong>

                <input
                  type="text"
                  name="facebook_url"
                >
              </label>

              <label>
                <strong>TikTok</strong>

                <input
                  type="text"
                  name="tiktok_url"
                >
              </label>

              <label>
                <strong>YouTube</strong>

                <input
                  type="text"
                  name="youtube_url"
                >
              </label>

              <label>
                <strong>Linktree or links page</strong>

                <input
                  type="text"
                  name="links_page_url"
                >
              </label>

              <label>
                <strong>Team website</strong>

                <input
                  type="text"
                  name="website_url"
                >
              </label>

              <label>
                <strong>Athletics website</strong>

                <input
                  type="text"
                  name="athletics_url"
                >
              </label>

              <label>
                <strong>
                  Recruiting questionnaire
                </strong>

                <input
                  type="text"
                  name="recruiting_questionnaire_url"
                >
              </label>

              <label>
                <strong>Team store</strong>

                <input
                  type="text"
                  name="team_store_url"
                >
              </label>

              <label>
                <strong>Fundraiser</strong>

                <input
                  type="text"
                  name="fundraiser_url"
                >
              </label>
            </div>

            <button
              class="button button-primary"
              type="submit"
            >
              Create private team page
            </button>
          </form>
        </section>

        <section
          class="info-card"
          data-team-claims-section
          hidden
        >
          <p class="eyebrow">
            Access requests
          </p>

          <h2>Your team claims</h2>

          <div
            class="stories-grid"
            data-team-claims-list
          ></div>
        </section>
      </div>
    </div>
  </section>

  <script
    src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0"
    defer
  ></script>

  <script
    src="/scripts/team-auth-client.js"
    defer
  ></script>

  <script
    src="/scripts/team-dashboard.js"
    defer
  ></script>`;

  return layout({
    site,
    title: "Team Dashboard",
    description:
      "Create, claim, and manage your Podium Watch team page.",
    pathname: "/team-dashboard/",
    content
  });
}