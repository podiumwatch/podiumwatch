import {
  layout,
  pageHero
} from "../lib/html.mjs";

export function adminPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Admin",
    title: "Manage Podium Watch.",
    description:
      "Create, edit, publish, and manage Podium Watch meet pages."
  })}

  <section class="section section-paper">
    <div class="container">
      <div class="info-card" data-admin-loading>
        <h2>Checking your session</h2>
        <p>Please wait while the admin area loads.</p>
      </div>

      <form
        class="info-card"
        data-admin-login
        hidden
        style="max-width: 620px; margin: 0 auto;"
      >
        <p class="eyebrow">Private access</p>
        <h2>Admin sign in</h2>

        <label style="display:block; margin-top:20px;">
          <strong>Password</strong>
          <input
            type="password"
            name="password"
            autocomplete="current-password"
            required
            style="
              display:block;
              width:100%;
              margin-top:8px;
              padding:14px;
              font:inherit;
            "
          >
        </label>

        <p
          data-admin-message
          aria-live="polite"
          style="margin-top:14px;"
        ></p>

        <button
          class="button button-primary"
          type="submit"
          style="margin-top:16px;"
        >
          Sign in
        </button>
      </form>

      <div data-admin-dashboard hidden>
        <div class="section-heading">
          <div>
            <p class="eyebrow">Admin dashboard</p>
            <h2>Meet Manager</h2>
          </div>

          <div style="display:flex;flex-wrap:wrap;gap:10px;">
            <a
              class="button button-primary"
              href="/admin/operations/"
            >
              Operations Center
            </a>

            <a
              class="button button-outline"
              href="/admin/teams/"
            >
              Bulk Team Import
            </a>

            <a
              class="button button-outline"
              href="/admin/statewide-data/"
            >
              Statewide Data
            </a>

            <a
              class="button button-outline"
              href="/admin/athletes/"
            >
              Athlete Data
            </a>

            <a
              class="button button-outline"
              href="/admin/recruiting/"
            >
              Recruit Ratings
            </a>

            <a
              class="button button-outline"
              href="/admin/results-sources/"
            >
              Results Source Manager
            </a>

            <a
              class="button button-outline"
              href="/admin/team-instagram/"
            >
              Team Instagram Changes
            </a>

            <a
              class="button button-primary"
              href="/admin/team-manager/"
            >
              Team Manager
            </a>

            <a
              class="button button-outline"
              href="/admin/team-schedules/"
            >
              Team Schedules
            </a>

            <a
              class="button button-outline"
              href="/admin/team-rosters/"
            >
              Team Rosters
            </a>

            <a
              class="button button-outline"
              href="/admin/team-content/"
            >
              Team Content
            </a>


            <a
              class="button button-outline"
              href="/admin/engagement/"
            >
              Engagement Center
            </a>

            <button
              class="button button-outline"
              type="button"
              data-admin-logout
            >
              Sign out
            </button>
          </div>
        </div>

        <form
          class="info-card"
          data-meet-form
          style="margin-bottom:34px;"
        >
          <p class="eyebrow">Meet Center</p>
          <h2 data-meet-form-title>Create a new meet</h2>

          <input
            type="hidden"
            name="id"
          >

          <p>
            Required fields are marked with an asterisk.
            Leave Published unchecked to save the meet as a draft.
          </p>

          <div
            style="
              display:grid;
              grid-template-columns:repeat(
                auto-fit,
                minmax(240px, 1fr)
              );
              gap:18px;
              margin-top:24px;
            "
          >
            <label>
              <strong>Meet name *</strong>
              <input
                type="text"
                name="name"
                required
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>Page slug *</strong>
              <input
                type="text"
                name="slug"
                required
                placeholder="bob-schul-invitational-2026"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>Sport *</strong>
              <select
                name="sport"
                required
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
                <option value="Cross Country">
                  Cross Country
                </option>
                <option value="Track and Field">
                  Track and Field
                </option>
              </select>
            </label>

            <label>
              <strong>Meet date *</strong>
              <input
                type="date"
                name="meet_date"
                required
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>Start time</strong>
              <input
                type="time"
                name="start_time"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>End date</strong>
              <input
                type="date"
                name="end_date"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>Venue name</strong>
              <input
                type="text"
                name="venue_name"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>Host school</strong>
              <input
                type="text"
                name="host_school"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>Address</strong>
              <input
                type="text"
                name="address"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>City</strong>
              <input
                type="text"
                name="city"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>State</strong>
              <input
                type="text"
                name="state"
                value="Ohio"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>ZIP code</strong>
              <input
                type="text"
                name="zip_code"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>Meet type</strong>
              <select
                name="meet_type"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
                <option value="">Select a type</option>
                <option value="Invitational">
                  Invitational
                </option>
                <option value="Dual Meet">
                  Dual Meet
                </option>
                <option value="Conference">
                  Conference
                </option>
                <option value="District">
                  District
                </option>
                <option value="Regional">
                  Regional
                </option>
                <option value="State">
                  State
                </option>
              </select>
            </label>

            <label>
              <strong>Division</strong>
              <input
                type="text"
                name="division"
                placeholder="Multiple divisions"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>
          </div>

          <label style="display:block;margin-top:20px;">
            <strong>Description</strong>
            <textarea
              name="description"
              rows="4"
              style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
            ></textarea>
          </label>

          <div
            style="
              display:grid;
              grid-template-columns:repeat(
                auto-fit,
                minmax(280px, 1fr)
              );
              gap:18px;
              margin-top:20px;
            "
          >
            <label>
              <strong>Race schedule</strong>
              <textarea
                name="schedule_text"
                rows="6"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              ></textarea>
            </label>

            <label>
              <strong>Parking information</strong>
              <textarea
                name="parking_text"
                rows="6"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              ></textarea>
            </label>

            <label>
              <strong>Admission information</strong>
              <textarea
                name="admission_text"
                rows="6"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              ></textarea>
            </label>

            <label>
              <strong>Bus information</strong>
              <textarea
                name="bus_information"
                rows="6"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              ></textarea>
            </label>

            <label>
              <strong>Awards information</strong>
              <textarea
                name="awards_text"
                rows="6"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              ></textarea>
            </label>

            <label>
              <strong>Course description</strong>
              <textarea
                name="course_description"
                rows="6"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              ></textarea>
            </label>

            <label>
              <strong>Teams attending</strong>
              <textarea
                name="teams_text"
                rows="6"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              ></textarea>
            </label>
          </div>

          <h3 style="margin-top:30px;">Links and files</h3>

          <div
            style="
              display:grid;
              grid-template-columns:repeat(
                auto-fit,
                minmax(280px, 1fr)
              );
              gap:18px;
              margin-top:18px;
            "
          >
            <label>
              <strong>Google Maps URL</strong>
              <input
                type="url"
                name="google_maps_url"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>Official results URL</strong>
              <input
                type="url"
                name="results_url"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>AthleticNet URL</strong>
              <input
                type="url"
                name="athleticnet_url"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>MileSplit URL</strong>
              <input
                type="url"
                name="milesplit_url"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>Registration URL</strong>
              <input
                type="url"
                name="registration_url"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>Official website URL</strong>
              <input
                type="url"
                name="official_website_url"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>Course map URL</strong>
              <input
                type="url"
                name="course_map_url"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>Parking map URL</strong>
              <input
                type="url"
                name="parking_map_url"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>Schedule PDF URL</strong>
              <input
                type="url"
                name="schedule_pdf_url"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>Meet logo URL</strong>
              <input
                type="url"
                name="logo_url"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>Banner image URL</strong>
              <input
                type="url"
                name="banner_image_url"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>Preview article URL</strong>
              <input
                type="url"
                name="preview_article_url"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>Recap article URL</strong>
              <input
                type="url"
                name="recap_article_url"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>

            <label>
              <strong>Instagram URL</strong>
              <input
                type="url"
                name="instagram_url"
                style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"
              >
            </label>
          </div>

          <div
            style="
              display:flex;
              flex-wrap:wrap;
              gap:24px;
              margin-top:26px;
            "
          >
            <label>
              <input
                type="checkbox"
                name="featured"
              >
              Feature this meet
            </label>

            <label>
              <input
                type="checkbox"
                name="published"
              >
              Publish this meet
            </label>
          </div>

          <p
            data-create-message
            aria-live="polite"
            style="margin-top:18px;"
          ></p>

          <div
            style="
              display:flex;
              flex-wrap:wrap;
              gap:12px;
              margin-top:18px;
            "
          >
            <button
              class="button button-primary"
              type="submit"
            >
              <span data-meet-submit-label>
                Create meet
              </span>
            </button>

            <button
              class="button button-outline"
              type="button"
              data-cancel-edit
              hidden
            >
              Cancel editing
            </button>

            <button
              class="button button-outline"
              type="reset"
            >
              Clear form
            </button>
          </div>
        </form>

        <form
          class="info-card"
          data-bulk-form
          style="margin-bottom:34px;"
        >
          <p class="eyebrow">CSV Import</p>
          <h2>Bulk add meets</h2>

          <p>
            Upload a CSV file to create multiple meet pages at once.
            The required columns are name, sport, and meet_date.
          </p>

          <p>
            The meet_date column should use the format 2026-08-25.
            A blank slug will be created automatically from the meet name.
          </p>

          <div
            style="
              display:grid;
              grid-template-columns:repeat(
                auto-fit,
                minmax(260px, 1fr)
              );
              gap:18px;
              margin-top:22px;
            "
          >
            <label>
              <strong>CSV file</strong>
              <input
                type="file"
                name="csv_file"
                accept=".csv,text/csv"
                required
                style="
                  display:block;
                  width:100%;
                  margin-top:8px;
                  padding:12px;
                  font:inherit;
                "
              >
            </label>

            <div>
              <strong>CSV template</strong>

              <div style="margin-top:8px;">
                <button
                  class="button button-outline"
                  type="button"
                  data-download-template
                >
                  Download template
                </button>
              </div>
            </div>
          </div>

          <label
            style="
              display:block;
              margin-top:22px;
            "
          >
            <input
              type="checkbox"
              name="publish_all"
            >
            Publish imported meets when the published column is blank
          </label>

          <p
            data-bulk-message
            aria-live="polite"
            style="margin-top:18px;"
          ></p>

          <div
            data-bulk-results
            style="margin-top:16px;"
          ></div>

          <button
            class="button button-primary"
            type="submit"
            style="margin-top:18px;"
          >
            Import meets
          </button>
        </form>

        <dialog
          data-delete-dialog
          style="
            width:min(560px, calc(100% - 32px));
            padding:0;
            border:0;
            border-radius:16px;
            box-shadow:0 24px 80px rgba(0, 0, 0, 0.35);
          "
        >
          <form
            data-delete-form
            style="padding:28px;"
          >
            <p class="eyebrow">Permanent action</p>
            <h2>Delete meet?</h2>

            <p>
              This permanently deletes
              <strong data-delete-name></strong>.
            </p>

            <p>
              Type the complete meet name below to confirm.
            </p>

            <input
              type="text"
              data-delete-confirmation
              autocomplete="off"
              style="
                display:block;
                width:100%;
                margin-top:12px;
                padding:12px;
                font:inherit;
              "
            >

            <p
              data-delete-message
              aria-live="polite"
              style="margin-top:14px;"
            ></p>

            <div
              style="
                display:flex;
                flex-wrap:wrap;
                gap:12px;
                margin-top:20px;
              "
            >
              <button
                class="button button-outline"
                type="button"
                data-cancel-delete
              >
                Cancel
              </button>

              <button
                class="button button-dark"
                type="submit"
              >
                Delete permanently
              </button>
            </div>
          </form>
        </dialog>

        <section>
          <div class="section-heading">
            <div>
              <p class="eyebrow">Meet database</p>
              <h2>Existing meets</h2>
            </div>

            <span data-meet-count>
              Loading meets...
            </span>
          </div>

          <div
            class="info-card"
            data-meet-filter-controls
            style="
              margin-bottom:24px;
            "
          >
            <div
              style="
                display:flex;
                flex-wrap:wrap;
                align-items:end;
                gap:16px;
              "
            >
              <label
                style="
                  flex:2 1 280px;
                "
              >
                <strong>Search meets</strong>

                <input
                  type="search"
                  data-meet-search
                  placeholder="Search name, city, host, or venue"
                  style="
                    display:block;
                    width:100%;
                    margin-top:8px;
                    padding:11px;
                    font:inherit;
                  "
                >
              </label>

              <label
                style="
                  flex:1 1 180px;
                "
              >
                <strong>Sport</strong>

                <select
                  data-meet-sport-filter
                  style="
                    display:block;
                    width:100%;
                    margin-top:8px;
                    padding:11px;
                    font:inherit;
                  "
                >
                  <option value="">
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

              <label
                style="
                  flex:1 1 170px;
                "
              >
                <strong>Status</strong>

                <select
                  data-meet-status-filter
                  style="
                    display:block;
                    width:100%;
                    margin-top:8px;
                    padding:11px;
                    font:inherit;
                  "
                >
                  <option value="">
                    All statuses
                  </option>

                  <option value="published">
                    Published
                  </option>

                  <option value="draft">
                    Draft
                  </option>
                </select>
              </label>

              <label
                style="
                  flex:1 1 170px;
                "
              >
                <strong>Featured</strong>

                <select
                  data-meet-featured-filter
                  style="
                    display:block;
                    width:100%;
                    margin-top:8px;
                    padding:11px;
                    font:inherit;
                  "
                >
                  <option value="">
                    All meets
                  </option>

                  <option value="featured">
                    Featured
                  </option>

                  <option value="notfeatured">
                    Not featured
                  </option>
                </select>
              </label>

              <label
                style="
                  flex:1 1 150px;
                "
              >
                <strong>Year</strong>

                <select
                  data-meet-year-filter
                  style="
                    display:block;
                    width:100%;
                    margin-top:8px;
                    padding:11px;
                    font:inherit;
                  "
                >
                  <option value="">
                    All years
                  </option>
                </select>
              </label>

              <label
                style="
                  flex:1 1 210px;
                "
              >
                <strong>Sort</strong>

                <select
                  data-meet-sort
                  style="
                    display:block;
                    width:100%;
                    margin-top:8px;
                    padding:11px;
                    font:inherit;
                  "
                >
                  <option value="date-ascending">
                    Date, earliest first
                  </option>

                  <option value="date-descending">
                    Date, latest first
                  </option>

                  <option value="name-ascending">
                    Meet name
                  </option>

                  <option value="city-ascending">
                    City
                  </option>
                </select>
              </label>
            </div>

            <div
              style="
                display:flex;
                flex-wrap:wrap;
                align-items:center;
                gap:12px;
                margin-top:20px;
              "
            >
              <button
                class="button button-outline"
                type="button"
                data-clear-meet-filters
              >
                Clear filters
              </button>

              <button
                class="button button-primary"
                type="button"
                data-export-meets
              >
                Export shown meets
              </button>

              <strong
                data-filtered-meet-count
                style="
                  margin-left:auto;
                "
              >
                Loading meets
              </strong>
            </div>

            <p
              data-meet-filter-empty
              hidden
              style="
                margin-top:20px;
                margin-bottom:0;
              "
            >
              No meets match the selected filters.
            </p>
          </div>

          <div
            class="info-card"
            data-bulk-action-controls
            style="
              display:flex;
              flex-wrap:wrap;
              align-items:end;
              gap:16px;
              margin-bottom:24px;
            "
          >
            <label
              style="
                display:flex;
                align-items:center;
                gap:8px;
                margin-right:auto;
              "
            >
              <input
                type="checkbox"
                data-select-all-meets
              >
              <strong>Select all meets</strong>
            </label>

            <span data-selected-meet-count>
              0 selected
            </span>

            <label>
              <strong>Bulk action</strong>

              <select
                data-bulk-action
                style="
                  display:block;
                  min-width:210px;
                  margin-top:8px;
                  padding:11px;
                  font:inherit;
                "
              >
                <option value="">
                  Choose an action
                </option>

                <option value="publish">
                  Publish selected
                </option>

                <option value="draft">
                  Move selected to draft
                </option>

                <option value="feature">
                  Feature selected
                </option>

                <option value="unfeature">
                  Remove featured status
                </option>
              </select>
            </label>

            <button
              class="button button-primary"
              type="button"
              data-apply-bulk-action
              disabled
            >
              Apply action
            </button>

            <p
              data-bulk-action-message
              aria-live="polite"
              style="
                flex-basis:100%;
                margin:0;
              "
            ></p>
          </div>

          <div
            class="stories-grid"
            data-admin-meet-list
          ></div>
        </section>
      </div>
    </div>
  </section>

  <script
    src="/scripts/admin.js"
    defer
  ></script>

  <script
    src="/scripts/admin-meet-tools.js"
    defer
  ></script>

  <script
    src="/scripts/admin-meet-extras.js"
    defer
  ></script>`;

  return layout({
    site,
    title: "Admin",
    description:
      "Private Podium Watch website management area.",
    pathname: "/admin/",
    content
  });
}