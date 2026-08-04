import {
  layout,
  pageHero
} from "../lib/html.mjs";

export function teamEditorPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Team Pages",
    title: "Edit your team page.",
    description:
      "Manage your program information, official social accounts, branding, coaches, and public profile."
  })}

  <style>
    .team-editor-shell {
      display: grid;
      gap: 28px;
    }

    .team-editor-form {
      display: grid;
      gap: 22px;
    }

    .team-editor-fields {
      display: grid;
      grid-template-columns: repeat(
        auto-fit,
        minmax(230px, 1fr)
      );
      gap: 18px;
    }

    .team-editor-form label {
      display: block;
    }

    .team-editor-form input,
    .team-editor-form select,
    .team-editor-form textarea {
      display: block;
      width: 100%;
      margin-top: 8px;
      padding: 12px;
      border: 1px solid rgba(15, 23, 42, 0.22);
      border-radius: 8px;
      background: #ffffff;
      font: inherit;
    }

    .team-editor-form input[type="color"] {
      min-height: 50px;
      padding: 5px;
    }

    .team-editor-form input[type="checkbox"] {
      display: inline-block;
      width: auto;
      margin: 0 8px 0 0;
    }

    .team-editor-message {
      padding: 14px 16px;
      border-radius: 10px;
      background: rgba(0, 191, 99, 0.1);
    }

    .team-editor-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .team-editor-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }

    .team-editor-badge {
      display: inline-flex;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(0, 191, 99, 0.14);
      font-size: 0.8rem;
      font-weight: 800;
    }

    .team-editor-badge-dark {
      background: #111827;
      color: #ffffff;
    }

    .team-editor-section-heading {
      margin-top: 12px;
      margin-bottom: 0;
    }

    .team-social-list {
      display: grid;
      gap: 14px;
      margin-top: 22px;
    }

    .team-social-item {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 14px;
      padding: 18px;
      border: 1px solid rgba(15, 23, 42, 0.15);
      border-radius: 12px;
      background: #ffffff;
    }

    .team-social-item-main {
      flex: 1 1 280px;
    }

    .team-social-item h3,
    .team-social-item p {
      margin: 0;
    }

    .team-social-item p {
      margin-top: 6px;
    }

    .team-image-preview {
      display: grid;
      grid-template-columns: minmax(100px, 140px) 1fr;
      gap: 20px;
      align-items: center;
      padding: 18px;
      border: 1px solid rgba(15, 23, 42, 0.15);
      border-radius: 12px;
      background: #ffffff;
    }

    .team-logo-preview {
      width: 120px;
      height: 120px;
      object-fit: contain;
      border-radius: 12px;
      background: #ffffff;
    }

    .team-banner-preview {
      width: 100%;
      max-height: 260px;
      object-fit: cover;
      border-radius: 14px;
    }

    @media (max-width: 640px) {
      .team-editor-actions {
        display: grid;
        grid-template-columns: 1fr;
      }

      .team-editor-actions .button {
        width: 100%;
        justify-content: center;
      }

      .team-image-preview {
        grid-template-columns: 1fr;
      }
    }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div
        class="info-card"
        data-team-editor-loading
      >
        <h2>Loading your team page</h2>

        <p>
          Podium Watch is checking your account and team permissions.
        </p>
      </div>

      <div
        class="team-editor-shell"
        data-team-editor
        hidden
      >
        <div class="section-heading">
          <div>
            <p class="eyebrow">
              Team editor
            </p>

            <h2 data-editor-team-name></h2>

            <div
              class="team-editor-badges"
              data-editor-team-badges
            ></div>
          </div>

          <div class="team-editor-actions">
            <a
              class="button button-outline"
              href="/team-dashboard/"
            >
              Team dashboard
            </a>

            <a
              class="button button-primary"
              data-team-preview-link
              target="_blank"
              rel="noopener noreferrer"
              hidden
            >
              Preview team page
            </a>

            <button
              class="button button-outline"
              type="button"
              data-team-editor-signout
            >
              Sign out
            </button>
          </div>
        </div>

        <p
          class="team-editor-message"
          data-team-editor-message
          aria-live="polite"
          hidden
        ></p>

        <section class="info-card">
          <p class="eyebrow">
            Social spotlight
          </p>

          <h2>Official social media accounts</h2>

          <p>
            These links will appear prominently near the top of the public team page.
            You can add separate accounts for boys, girls, cross country, track, or the entire program.
          </p>

          <div
            class="team-social-list"
            data-team-social-list
          ></div>

          <p
            data-team-social-empty
            hidden
          >
            No social media accounts have been added yet.
          </p>

          <form
            class="team-editor-form"
            data-team-social-form
            style="margin-top:28px;"
          >
            <input
              type="hidden"
              name="social_id"
            >

            <div class="team-editor-fields">
              <label>
                <strong>Platform</strong>

                <select
                  name="platform"
                  required
                >
                  <option value="Instagram">
                    Instagram
                  </option>

                  <option value="X">
                    X
                  </option>

                  <option value="Facebook">
                    Facebook
                  </option>

                  <option value="TikTok">
                    TikTok
                  </option>

                  <option value="YouTube">
                    YouTube
                  </option>

                  <option value="Linktree">
                    Linktree
                  </option>

                  <option value="Website">
                    Website
                  </option>

                  <option value="Other">
                    Other
                  </option>
                </select>
              </label>

              <label>
                <strong>Button label</strong>

                <input
                  type="text"
                  name="label"
                  placeholder="Example: Boys Cross Country Instagram"
                >
              </label>

              <label>
                <strong>Account URL</strong>

                <input
                  type="text"
                  name="url"
                  placeholder="https://"
                  required
                >
              </label>

              <label>
                <strong>Sport</strong>

                <select name="sport_scope">
                  <option value="All">
                    All sports
                  </option>

                  <option value="Cross Country">
                    Cross Country
                  </option>

                  <option value="Track and Field">
                    Track and Field
                  </option>
                </select>
              </label>

              <label>
                <strong>Program</strong>

                <select name="program_scope">
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
                <strong>Display order</strong>

                <input
                  type="number"
                  name="sort_order"
                  value="0"
                  min="0"
                  max="999"
                >
              </label>
            </div>

            <label>
              <input
                type="checkbox"
                name="published"
                checked
              >

              Show this account on the public team page
            </label>

            <div class="team-editor-actions">
              <button
                class="button button-primary"
                type="submit"
              >
                <span data-social-submit-label>
                  Add social account
                </span>
              </button>

              <button
                class="button button-outline"
                type="button"
                data-cancel-social-edit
                hidden
              >
                Cancel editing
              </button>
            </div>
          </form>
        </section>

        <section class="info-card">
          <p class="eyebrow">
            Public identity
          </p>

          <h2>Team profile</h2>

          <form
            class="team-editor-form"
            data-team-profile-form
          >
            <input
              type="hidden"
              name="team_id"
            >

            <h3 class="team-editor-section-heading">
              School information
            </h3>

            <div class="team-editor-fields">
              <label>
                <strong>School name</strong>

                <input
                  type="text"
                  name="school_name"
                  required
                >
              </label>

              <label>
                <strong>Page address</strong>

                <input
                  type="text"
                  name="slug"
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
            </div>

            <h3 class="team-editor-section-heading">
              Coaches and contact
            </h3>

            <div class="team-editor-fields">
              <label>
                <strong>Head coach setup</strong>

                <select
                  name="head_coach_setup"
                  required
                >
                  <option value="combined">
                    One coach for Boys and Girls
                  </option>

                  <option value="separate">
                    Separate Boys and Girls coaches
                  </option>

                  <option value="boys_only">
                    Boys head coach only
                  </option>

                  <option value="girls_only">
                    Girls head coach only
                  </option>
                </select>
              </label>

              <label data-combined-head-coach>
                <strong>Boys and Girls head coach</strong>

                <input
                  type="text"
                  name="head_coach"
                >
              </label>

              <label
                data-boys-head-coach
                hidden
              >
                <strong>Boys head coach</strong>

                <input
                  type="text"
                  name="head_boys_coach"
                >
              </label>

              <label
                data-girls-head-coach
                hidden
              >
                <strong>Girls head coach</strong>

                <input
                  type="text"
                  name="head_girls_coach"
                >
              </label>

              <label>
                <strong>Public contact email</strong>

                <input
                  type="email"
                  name="public_contact_email"
                >
              </label>

              <label>
                <strong>Recruiting contact email</strong>

                <input
                  type="email"
                  name="recruiting_contact_email"
                >
              </label>
            </div>

            <label>
              <strong>Assistant coaches</strong>

              <textarea
                name="assistant_coaches_text"
                rows="4"
                placeholder="List coaches one per line"
              ></textarea>
            </label>

            <h3 class="team-editor-section-heading">
              Program story
            </h3>

            <label>
              <strong>Team overview</strong>

              <textarea
                name="description"
                rows="5"
                placeholder="Tell visitors about your program"
              ></textarea>
            </label>

            <label>
              <strong>Program history</strong>

              <textarea
                name="history_text"
                rows="5"
                placeholder="Championships, state appearances, records, and notable seasons"
              ></textarea>
            </label>

            <label>
              <strong>Team traditions</strong>

              <textarea
                name="traditions_text"
                rows="5"
                placeholder="Share the traditions and culture that make your program unique"
              ></textarea>
            </label>

            <h3 class="team-editor-section-heading">
              Divisions
            </h3>

            <div class="team-editor-fields">
              <label>
                <strong>Cross Country Boys</strong>

                <input
                  type="text"
                  name="cross_country_boys_division"
                  placeholder="Example: Division IV"
                >
              </label>

              <label>
                <strong>Cross Country Girls</strong>

                <input
                  type="text"
                  name="cross_country_girls_division"
                >
              </label>

              <label>
                <strong>Track Boys</strong>

                <input
                  type="text"
                  name="track_boys_division"
                >
              </label>

              <label>
                <strong>Track Girls</strong>

                <input
                  type="text"
                  name="track_girls_division"
                >
              </label>
            </div>

            <h3 class="team-editor-section-heading">
              Branding
            </h3>

            <div class="team-editor-fields">
              <label>
                <strong>Primary color</strong>

                <input
                  type="color"
                  name="primary_color"
                  value="#00bf63"
                >
              </label>

              <label>
                <strong>Secondary color</strong>

                <input
                  type="color"
                  name="secondary_color"
                  value="#111827"
                >
              </label>

              <label>
                <strong>Logo image URL</strong>

                <input
                  type="text"
                  name="logo_url"
                  placeholder="https://"
                >
              </label>

              <label>
                <strong>Banner image URL</strong>

                <input
                  type="text"
                  name="banner_image_url"
                  placeholder="https://"
                >
              </label>
            </div>

            <div
              class="team-image-preview"
              data-team-image-preview
              hidden
            >
              <img
                class="team-logo-preview"
                data-team-logo-preview
                alt="Team logo preview"
                hidden
              >

              <div>
                <strong>Image preview</strong>

                <p>
                  Your logo and banner will appear at the top of the public team page.
                </p>
              </div>
            </div>

            <img
              class="team-banner-preview"
              data-team-banner-preview
              alt="Team banner preview"
              hidden
            >

            <h3 class="team-editor-section-heading">
              Program links
            </h3>

            <div class="team-editor-fields">
              <label>
                <strong>Team website</strong>

                <input
                  type="text"
                  name="website_url"
                  placeholder="https://"
                >
              </label>

              <label>
                <strong>Athletics website</strong>

                <input
                  type="text"
                  name="athletics_url"
                  placeholder="https://"
                >
              </label>

              <label>
                <strong>Linktree or links page</strong>

                <input
                  type="text"
                  name="links_page_url"
                  placeholder="https://"
                >
              </label>

              <label>
                <strong>Recruiting questionnaire</strong>

                <input
                  type="text"
                  name="recruiting_questionnaire_url"
                  placeholder="https://"
                >
              </label>

              <label>
                <strong>Team store</strong>

                <input
                  type="text"
                  name="team_store_url"
                  placeholder="https://"
                >
              </label>

              <label>
                <strong>Fundraiser</strong>

                <input
                  type="text"
                  name="fundraiser_url"
                  placeholder="https://"
                >
              </label>
            </div>

            <label>
              <input
                type="checkbox"
                name="published"
              >

              Publish this team page
            </label>

            <p>
              Leave this unchecked while we finish building and testing the page.
            </p>

            <button
              class="button button-primary"
              type="submit"
            >
              Save team profile
            </button>
          </form>
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
    src="/scripts/team-editor.js"
    defer
  ></script>`;

  return layout({
    site,
    title: "Team Editor",
    description:
      "Manage your Podium Watch team page.",
    pathname: "/team-editor/",
    content
  });
}