import { adminShell } from "../lib/adminshell.mjs";
import { SPORTS, REGIONS } from "../../lib/photographer_constants.mjs";
import { MONTHLY_PRICE_CENTS, ANNUAL_PRICE_CENTS, formatUsd } from "../../lib/photographer_membership_config.mjs";

const styles = `
    .photog-admin-shell { display:grid; gap:24px; }
    .photog-admin-message { margin:0; padding:14px 17px; border-radius:10px; background:rgba(0,191,99,.12); font-weight:800; }
    .photog-admin-message[data-tone="error"] { color:#991b1b; background:rgba(220,38,38,.12); }
    .photog-admin-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px; }
    .photog-admin-panel { display:grid; gap:16px; }
    .photog-admin-panel h2, .photog-admin-panel p { margin-bottom:0; }
    .photog-admin-form { display:grid; gap:14px; }
    .photog-admin-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:13px; }
    .photog-admin-form label { display:grid; gap:7px; font-weight:850; }
    .photog-admin-form input, .photog-admin-form select, .photog-admin-form textarea { width:100%; padding:10px 12px; border:1px solid rgba(15,23,42,.22); border-radius:9px; background:#fff; font:inherit; }
    .photog-admin-form textarea { min-height:90px; resize:vertical; }
    .photog-admin-wide { grid-column:1 / -1; }
    .photog-admin-checkbox { display:flex !important; flex-direction:row !important; align-items:center; gap:9px; }
    .photog-admin-checkbox input { width:auto; }
    .photog-admin-checklist { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:8px; }
    .photog-admin-actions { display:flex; flex-wrap:wrap; gap:10px; }
    .photog-admin-list { display:grid; gap:10px; max-height:600px; overflow:auto; }
    .photog-admin-list-item { width:100%; padding:13px; border:1px solid rgba(15,23,42,.12); border-radius:11px; background:#fff; text-align:left; cursor:pointer; }
    .photog-admin-list-item:hover, .photog-admin-list-item:focus-visible { border-color:#00bf63; }
    .photog-admin-list-item strong, .photog-admin-list-item span { display:block; }
    .photog-admin-list-item span { margin-top:4px; color:#64748b; font-size:.85rem; }
    .photog-admin-badge { display:inline-flex; padding:3px 9px; border-radius:999px; background:rgba(0,191,99,.13); font-size:.72rem; font-weight:900; text-transform:uppercase; margin-right:6px; }
    .photog-admin-badge[data-status="draft"], .photog-admin-badge[data-status="submitted"], .photog-admin-badge[data-status="pending_review"] { background:#e2e8f0; color:#334155; }
    .photog-admin-badge[data-status="approved"], .photog-admin-badge[data-status="published"] { background:rgba(0,191,99,.18); color:#065f46; }
    .photog-admin-badge[data-status="rejected"], .photog-admin-badge[data-status="suspended"] { background:rgba(220,38,38,.13); color:#991b1b; }
    .photog-admin-portfolio-row { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px; border:1px solid rgba(15,23,42,.1); border-radius:9px; }
    .photog-admin-portfolio-row img { width:60px; height:44px; object-fit:cover; border-radius:6px; }
    @media (max-width:900px) { .photog-admin-grid { grid-template-columns:1fr; } }
    @media (max-width:650px) { .photog-admin-fields { grid-template-columns:1fr; } .photog-admin-wide { grid-column:auto; } }
`;

export function adminPhotographersPage(site) {
  const sportChecklist = SPORTS.map(
    (s) => `<label class="photog-admin-checkbox"><input type="checkbox" name="sports" value="${s.value}">${s.label}</label>`
  ).join("");
  const regionChecklist = REGIONS.map(
    (r) => `<label class="photog-admin-checkbox"><input type="checkbox" name="regions" value="${r}">${r}</label>`
  ).join("");

  const content = `<div class="photog-admin-shell" data-photog-admin>
      <p class="photog-admin-message" data-photog-admin-message role="status" hidden></p>

      <section class="info-card photog-admin-panel">
        <div><p class="eyebrow">Moderation queue</p><h2>Pending galleries</h2><p>External gallery links wait here until approved -- nothing shows publicly until you review it.</p></div>
        <div class="photog-admin-list" data-photog-pending-galleries><p>Loading...</p></div>
      </section>

      <div class="photog-admin-grid">
        <section class="info-card photog-admin-panel">
          <div><p class="eyebrow">Photographer Network</p><h2>Find a photographer listing</h2></div>
          <form class="photog-admin-form" data-photog-search-form>
            <label>Search<input type="search" name="search" placeholder="Business name, photographer name, or city"></label>
            <label>Status<select name="status">
              <option value="">Any status</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="pending_review">Pending review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select></label>
            <button class="button button-dark" type="submit">Search</button>
          </form>
          <button class="button button-outline" type="button" data-photog-new>+ Add new photographer</button>
          <div class="photog-admin-list" data-photog-list><p>Loading photographers...</p></div>
        </section>

        <section class="info-card photog-admin-panel" data-photog-editor-panel>
          <div><p class="eyebrow">Listing editor</p><h2 data-photog-editor-title>Add a photographer</h2></div>

          <form class="photog-admin-form" data-photog-core-form>
            <input type="hidden" name="id">
            <div class="photog-admin-fields">
              <label class="photog-admin-wide">Business name<input name="business_name" required></label>
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
              <label class="photog-admin-wide">Short description<input name="short_description" maxlength="300"></label>
              <label class="photog-admin-wide">About<textarea name="about"></textarea></label>
              <label class="photog-admin-checkbox photog-admin-wide"><input type="checkbox" name="statewide_travel">Available for statewide travel</label>
            </div>

            <div class="photog-admin-fields">
              <label>Status<select name="status">
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="pending_review">Pending review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="suspended">Suspended</option>
              </select></label>
              <label>Verification<select name="verification_status">
                <option value="unverified">Unverified</option>
                <option value="verified">Verified</option>
              </select></label>
              <label class="photog-admin-checkbox"><input type="checkbox" name="featured">Featured</label>
              <label class="photog-admin-checkbox"><input type="checkbox" name="founding_photographer">Founding Photographer (permanent launch badge -- independent of billing)</label>
              <label class="photog-admin-checkbox"><input type="checkbox" name="public_visible" checked>Public visible</label>
              <label class="photog-admin-wide">Admin notes<textarea name="admin_notes"></textarea></label>
            </div>

            <div class="photog-admin-actions">
              <button class="button button-primary" type="submit">Save listing</button>
              <a class="button button-outline" href="/photographers/" target="_blank" rel="noopener">View directory</a>
              <a class="button button-outline" data-photog-view-profile hidden target="_blank" rel="noopener">View public profile</a>
            </div>
          </form>

          <section data-photog-children-section hidden>
            <h3>Sports covered</h3>
            <form class="photog-admin-form" data-photog-sports-form>
              <div class="photog-admin-checklist">${sportChecklist}</div>
              <button class="button button-dark" type="submit">Save sports</button>
            </form>

            <h3 style="margin-top:16px;">Service areas</h3>
            <p>Regions reuse Ohio's existing athletic-district taxonomy. County/city are free text.</p>
            <form class="photog-admin-form" data-photog-areas-form>
              <div class="photog-admin-checklist">${regionChecklist}</div>
              <label>Counties served (comma-separated)<input name="counties" placeholder="Shelby, Darke, Miami"></label>
              <label>Cities served (comma-separated)<input name="cities" placeholder="Sidney, Piqua"></label>
              <button class="button button-dark" type="submit">Save service areas</button>
            </form>

            <h3 style="margin-top:16px;">Portfolio</h3>
            <form class="photog-admin-form" data-photog-portfolio-form>
              <label class="photog-admin-wide">Image URL<input type="url" name="image_url" placeholder="https://" required></label>
              <label class="photog-admin-wide">Caption<input name="caption"></label>
              <button class="button button-dark" type="submit">Add image</button>
            </form>
            <div class="photog-admin-list" data-photog-portfolio-list></div>

            <h3 style="margin-top:16px;">Meet coverage</h3>
            <div class="photog-admin-list" data-photog-coverage-list><p>No meet coverage marked.</p></div>

            <h3 style="margin-top:16px;">Galleries</h3>
            <div class="photog-admin-list" data-photog-gallery-list><p>No galleries.</p></div>

            <h3 style="margin-top:16px;">Membership billing</h3>
            <p>No payment processor is connected yet -- this manually grants or revokes membership (e.g. for a photographer who paid outside of Stripe, or ahead of checkout going live). One membership, two billing intervals: monthly (${formatUsd(MONTHLY_PRICE_CENTS)}/mo) or annual (${formatUsd(ANNUAL_PRICE_CENTS)}/yr) -- both grant identical core features. Setting an ANNUAL subscription to active grants the one-time partnership story benefit automatically, once, below.</p>
            <form class="photog-admin-form" data-photog-billing-form>
              <div class="photog-admin-fields">
                <label>Billing interval<select name="billing_interval">
                  <option value="">Not set</option>
                  <option value="monthly">Monthly (${formatUsd(MONTHLY_PRICE_CENTS)}/mo)</option>
                  <option value="annual">Annual (${formatUsd(ANNUAL_PRICE_CENTS)}/yr)</option>
                </select></label>
                <label>Subscription status<select name="status">
                  <option value="inactive">Inactive</option>
                  <option value="active">Active</option>
                  <option value="trialing">Trialing</option>
                  <option value="past_due">Past due</option>
                  <option value="canceled">Canceled</option>
                </select></label>
                <label>Current period start<input type="date" name="current_period_start"></label>
                <label>Renews/expires<input type="date" name="current_period_end"></label>
                <label class="photog-admin-checkbox"><input type="checkbox" name="cancel_at_period_end">Cancel at period end</label>
                <label>Canceled on<input type="date" name="canceled_at"></label>
                <label>Payment status<select name="payment_status">
                  <option value="">Unknown</option>
                  <option value="succeeded">Succeeded</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select></label>
                <label class="photog-admin-wide">Billing notes<textarea name="admin_notes"></textarea></label>
              </div>
              <button class="button button-dark" type="submit">Save billing status</button>
            </form>
          </section>
        </section>
      </div>

      <section class="info-card photog-admin-panel">
        <div><p class="eyebrow">Annual launch benefit</p><h2>Partnership stories</h2><p>Annual members become eligible for one Podium Watch partnership announcement story. Review submitted info here and move it through the workflow -- publishing the real article still happens through the normal editorial content process.</p></div>
        <div class="photog-admin-list" data-photog-story-queue><p>Loading...</p></div>
      </section>
    </div>`;

  return adminShell({
    site,
    pathname: "/admin/photographers/",
    title: "Photographer Network",
    description: "Private Podium Watch admin tool for the Photographer Network directory: review, approve, and manage photographer listings.",
    heading: "Photographer Network.",
    intro: "Review submissions, manage listing status, sports, service areas, and portfolios.",
    styles,
    content,
    scripts: ["/scripts/admin-photographers.js"]
  });
}
