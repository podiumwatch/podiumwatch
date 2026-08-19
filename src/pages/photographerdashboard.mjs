import {
  layout,
  pageHero
} from "../lib/html.mjs";
import { SPORTS, REGIONS } from "../../lib/photographer_constants.mjs";

// A signed-in photographer's own dashboard: create your listing (first
// run), edit it, manage sports/service areas/portfolio, and submit for
// review. Admin approval (status -> approved, featured, founding,
// verification, plan) happens only in /admin/photographers/ -- this
// page never exposes those controls.
export function photographerDashboardPage(site) {
  const sportChecklist = SPORTS.map(
    (s) => `<label class="photog-dash-checkbox"><input type="checkbox" name="sports" value="${s.value}">${s.label}</label>`
  ).join("");
  const regionChecklist = REGIONS.map(
    (r) => `<label class="photog-dash-checkbox"><input type="checkbox" name="regions" value="${r}">${r}</label>`
  ).join("");

  const content = `${pageHero({
    eyebrow: "Podium Watch Photographer Network",
    title: "Your listing.",
    description: "Manage your Photographer Network profile.",
    compact: true
  })}

  <style>
    .photog-dash-shell { display: grid; gap: 22px; }
    .photog-dash-header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; }
    .photog-dash-panel { padding: 24px; border-radius: 16px; background: #ffffff; box-shadow: 0 12px 34px rgba(15, 23, 42, 0.08); display: grid; gap: 16px; }
    .photog-dash-status-banner { padding: 16px 18px; border-radius: 12px; font-weight: 800; }
    .photog-dash-status-banner[data-status="draft"] { background: #e2e8f0; color: #334155; }
    .photog-dash-status-banner[data-status="submitted"], .photog-dash-status-banner[data-status="pending_review"] { background: rgba(245, 158, 11, 0.18); color: #7c4a03; }
    .photog-dash-status-banner[data-status="approved"] { background: rgba(0, 191, 99, 0.18); color: #065f46; }
    .photog-dash-status-banner[data-status="rejected"], .photog-dash-status-banner[data-status="suspended"] { background: rgba(220, 38, 38, 0.13); color: #991b1b; }
    .photog-dash-message { padding: 14px 16px; border-radius: 10px; background: rgba(0, 191, 99, 0.1); }
    .photog-dash-message[data-tone="error"] { background: rgba(220, 38, 38, 0.12); color: #991b1b; }
    .photog-dash-form { display: grid; gap: 14px; }
    .photog-dash-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px; }
    .photog-dash-form label { display: grid; gap: 7px; font-weight: 850; }
    .photog-dash-form input, .photog-dash-form textarea { width: 100%; padding: 10px 12px; border: 1px solid rgba(15, 23, 42, 0.22); border-radius: 9px; background: #fff; font: inherit; }
    .photog-dash-form textarea { min-height: 90px; resize: vertical; }
    .photog-dash-wide { grid-column: 1 / -1; }
    .photog-dash-checkbox { display: flex !important; flex-direction: row !important; align-items: center; gap: 9px; font-weight: 700 !important; }
    .photog-dash-checkbox input { width: auto; }
    .photog-dash-checklist { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
    .photog-dash-actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .photog-dash-portfolio-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px; border: 1px solid rgba(15, 23, 42, 0.1); border-radius: 9px; }
    .photog-dash-portfolio-row img { width: 60px; height: 44px; object-fit: cover; border-radius: 6px; }
    .photog-dash-meet-results { display: grid; gap: 6px; max-height: 220px; overflow: auto; margin-bottom: 6px; }
    .photog-dash-meet-result { width: 100%; padding: 10px 12px; border: 1px solid rgba(15, 23, 42, 0.14); border-radius: 8px; background: #fff; text-align: left; cursor: pointer; font: inherit; }
    .photog-dash-meet-result:hover, .photog-dash-meet-result:focus-visible { border-color: #00bf63; }
    .photog-dash-list-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 0; border-bottom: 1px solid rgba(15, 23, 42, 0.08); }
    .photog-dash-list-row:last-child { border-bottom: 0; }
    .photog-dash-status-tag { display: inline-flex; padding: 3px 9px; border-radius: 999px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; background: rgba(15, 23, 42, 0.08); margin-left: 8px; }
    .photog-dash-status-tag[data-status="published"] { background: rgba(0, 191, 99, 0.18); color: #065f46; }
    .photog-dash-status-tag[data-status="rejected"] { background: rgba(220, 38, 38, 0.13); color: #991b1b; }
    @media (max-width: 700px) {
      .photog-dash-fields { grid-template-columns: 1fr; }
      .photog-dash-wide { grid-column: auto; }
    }
  </style>

  <section class="section section-paper">
    <div class="container photog-dash-shell">
      <div class="info-card" data-photog-dash-loading>
        <h2>Loading your listing</h2>
        <p>Please wait while Podium Watch securely loads your account.</p>
      </div>

      <div class="photog-dash-header" data-photog-dash-root hidden>
        <div>
          <p class="eyebrow" data-photog-dash-account></p>
        </div>
        <button class="button button-outline" type="button" data-photog-dash-signout>Sign out</button>
      </div>

      <p class="photog-dash-message" data-photog-dash-message role="status" hidden></p>

      <div data-photog-dash-content hidden>
        <div class="photog-dash-status-banner" data-photog-dash-status-banner hidden></div>

        <section class="photog-dash-panel">
          <div><p class="eyebrow">Your listing</p><h2 data-photog-dash-form-title>Create your listing</h2></div>
          <form class="photog-dash-form" data-photog-dash-core-form>
            <div class="photog-dash-fields">
              <label class="photog-dash-wide">Business name<input name="business_name" required></label>
              <label>Photographer name<input name="photographer_name"></label>
              <label>City<input name="city"></label>
              <label>State<input name="state" value="OH" maxlength="2"></label>
              <label>ZIP code<input name="zip_code"></label>
              <label>Website<input type="url" name="website_url" placeholder="https://"></label>
              <label>Instagram<input type="url" name="instagram_url" placeholder="https://"></label>
              <label>Facebook<input type="url" name="facebook_url" placeholder="https://"></label>
              <label>Business email<input type="email" name="business_email"></label>
              <label>Business phone<input name="business_phone"></label>
              <label>Profile image URL<input type="url" name="profile_image_url" placeholder="https://"></label>
              <label>Logo URL<input type="url" name="logo_url" placeholder="https://"></label>
              <label class="photog-dash-wide">Short description<input name="short_description" maxlength="300"></label>
              <label class="photog-dash-wide">About<textarea name="about"></textarea></label>
              <label class="photog-dash-checkbox photog-dash-wide"><input type="checkbox" name="statewide_travel">Available for statewide travel</label>
            </div>
            <div class="photog-dash-actions">
              <button class="button button-primary" type="submit" data-photog-dash-save-label>Create listing</button>
            </div>
          </form>
        </section>

        <section class="photog-dash-panel" data-photog-dash-children hidden>
          <div><p class="eyebrow">Sports covered</p></div>
          <form class="photog-dash-form" data-photog-dash-sports-form>
            <div class="photog-dash-checklist">${sportChecklist}</div>
            <button class="button button-dark" type="submit">Save sports</button>
          </form>
        </section>

        <section class="photog-dash-panel" data-photog-dash-children hidden>
          <div><p class="eyebrow">Service areas</p><p>Regions use Ohio's own region names. Counties/cities are free text.</p></div>
          <form class="photog-dash-form" data-photog-dash-areas-form>
            <div class="photog-dash-checklist">${regionChecklist}</div>
            <label>Counties served (comma-separated)<input name="counties" placeholder="Shelby, Darke, Miami"></label>
            <label>Cities served (comma-separated)<input name="cities" placeholder="Sidney, Piqua"></label>
            <button class="button button-dark" type="submit">Save service areas</button>
          </form>
        </section>

        <section class="photog-dash-panel" data-photog-dash-children hidden>
          <div><p class="eyebrow">Portfolio</p><p>Up to 12 images. Paste a link to an image hosted elsewhere.</p></div>
          <form class="photog-dash-form" data-photog-dash-portfolio-form>
            <label class="photog-dash-wide">Image URL<input type="url" name="image_url" placeholder="https://" required></label>
            <label class="photog-dash-wide">Caption<input name="caption"></label>
            <button class="button button-dark" type="submit">Add image</button>
          </form>
          <div data-photog-dash-portfolio-list></div>
        </section>

        <section class="photog-dash-panel" data-photog-dash-children hidden>
          <div><p class="eyebrow">Meet coverage</p><p>Mark a real Podium Watch meet you're covering. Search below -- never a duplicate meet, always the real one.</p></div>
          <label>Search meets<input type="search" data-photog-dash-meet-search placeholder="Meet name, host, or city"></label>
          <div class="photog-dash-meet-results" data-photog-dash-meet-results></div>
          <form class="photog-dash-form" data-photog-dash-coverage-form>
            <input type="hidden" name="meet_id">
            <div class="photog-dash-fields">
              <label>Selected meet<input name="meet_label" readonly placeholder="Search and pick a meet above"></label>
              <label>Status<select name="coverage_status">
                <option value="planned">Planned</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select></label>
              <label class="photog-dash-wide">Notes (optional)<input name="public_notes" maxlength="300"></label>
            </div>
            <button class="button button-dark" type="submit">Add coverage</button>
          </form>
          <div data-photog-dash-coverage-list></div>
        </section>

        <section class="photog-dash-panel" data-photog-dash-children hidden>
          <div><p class="eyebrow">Galleries</p><p>Link to your own gallery platform -- Podium Watch never hosts your photos. New galleries need a quick Podium Watch review before they show publicly.</p></div>
          <form class="photog-dash-form" data-photog-dash-gallery-form>
            <input type="hidden" name="meet_id">
            <div class="photog-dash-fields">
              <label class="photog-dash-wide">Gallery title<input name="title" required></label>
              <label class="photog-dash-wide">Gallery URL<input type="url" name="gallery_url" placeholder="https://" required></label>
              <label class="photog-dash-wide">Linked meet (optional -- search above first, then submit)<input name="meet_label" readonly placeholder="No meet selected"></label>
            </div>
            <button class="button button-dark" type="submit">Add gallery</button>
          </form>
          <div data-photog-dash-gallery-list></div>
        </section>

        <section class="photog-dash-panel" data-photog-dash-children hidden>
          <div><p class="eyebrow">Ready for review?</p><p>Submitting sends your listing to Podium Watch for approval. You can keep editing until it's approved.</p></div>
          <div class="photog-dash-actions">
            <button class="button button-primary" type="button" data-photog-dash-submit>Submit for review</button>
            <a class="button button-outline" data-photog-dash-view-profile hidden target="_blank" rel="noopener">View public profile</a>
          </div>
        </section>
      </div>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/team-auth-client.js" defer></script>
  <script src="/scripts/photographer-dashboard.js" defer></script>`;

  return layout({
    site,
    title: "Your Photographer Listing",
    description: "Manage your Podium Watch Photographer Network listing.",
    pathname: "/photographer-dashboard/",
    content
  });
}
