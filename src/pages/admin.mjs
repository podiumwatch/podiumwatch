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

          <button
            class="button button-outline"
            type="button"
            data-admin-logout
          >
            Sign out
          </button>
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