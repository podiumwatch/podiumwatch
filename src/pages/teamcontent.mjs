import {
  layout,
  pageHero
} from "../lib/html.mjs";

export function teamContentPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Team Pages",
    title: "Team Content Hub.",
    description:
      "Publish announcements, results, achievements, media, recruiting links, and Podium Watch coverage from one place."
  })}

  <style>
    .team-content-shell {
      display: grid;
      gap: 28px;
    }

    .team-content-toolbar,
    .team-content-actions,
    .team-content-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    .team-content-toolbar {
      justify-content: space-between;
    }

    .team-content-message {
      padding: 14px 16px;
      border-radius: 10px;
      background: rgba(0, 191, 99, 0.1);
    }

    .team-content-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
      gap: 14px;
    }

    .team-content-summary-card {
      padding: 18px;
      border-radius: 13px;
      background: rgba(15, 23, 42, 0.05);
    }

    .team-content-summary-card strong {
      display: block;
      font-size: 1.8rem;
      line-height: 1;
    }

    .team-content-summary-card span {
      display: block;
      margin-top: 8px;
      font-weight: 750;
    }

    .team-content-filters {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 14px;
      align-items: end;
    }

    .team-content-filters label,
    .team-content-form label {
      display: block;
    }

    .team-content-filters input,
    .team-content-filters select,
    .team-content-form input,
    .team-content-form select,
    .team-content-form textarea {
      display: block;
      width: 100%;
      margin-top: 7px;
      padding: 11px;
      border: 1px solid rgba(15, 23, 42, 0.2);
      border-radius: 9px;
      background: #ffffff;
      font: inherit;
    }

    .team-content-list {
      display: grid;
      gap: 18px;
    }

    .team-content-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 22px;
      padding: 22px;
      border: 1px solid rgba(15, 23, 42, 0.14);
      border-radius: 14px;
      background: #ffffff;
    }

    .team-content-card h3,
    .team-content-card p {
      margin: 0;
    }

    .team-content-card p {
      margin-top: 9px;
    }

    .team-content-badge {
      display: inline-flex;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(0, 191, 99, 0.14);
      font-size: 0.78rem;
      font-weight: 850;
    }

    .team-content-badge-dark {
      background: #111827;
      color: #ffffff;
    }

    .team-content-badge-warning {
      background: rgba(245, 158, 11, 0.18);
      color: #92400e;
    }

    .team-content-badge-danger {
      background: rgba(220, 38, 38, 0.14);
      color: #991b1b;
    }

    .team-content-card-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-content: start;
      gap: 8px;
      max-width: 340px;
    }

    .team-content-empty {
      padding: 32px;
      text-align: center;
    }

    .team-content-dialog {
      width: min(960px, calc(100% - 28px));
      max-height: calc(100vh - 40px);
      padding: 0;
      border: 0;
      border-radius: 16px;
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.3);
    }

    .team-content-dialog::backdrop {
      background: rgba(15, 23, 42, 0.68);
    }

    .team-content-dialog-shell {
      display: grid;
      max-height: calc(100vh - 40px);
      overflow: auto;
    }

    .team-content-dialog-header {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
      padding: 20px 22px;
      border-bottom: 1px solid rgba(15, 23, 42, 0.12);
      background: #ffffff;
    }

    .team-content-dialog-header h2 {
      margin: 0;
    }

    .team-content-form {
      display: grid;
      gap: 20px;
      padding: 22px;
    }

    .team-content-fields {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
    }

    .team-content-check {
      display: flex !important;
      align-items: center;
      gap: 9px;
    }

    .team-content-check input {
      width: auto;
      margin: 0;
    }

    .team-content-admin-box {
      padding: 18px;
      border-radius: 12px;
      background: rgba(245, 158, 11, 0.1);
    }

    .team-content-admin-box h3 {
      margin-top: 0;
    }

    @media (max-width: 760px) {
      .team-content-card {
        grid-template-columns: 1fr;
      }

      .team-content-card-actions,
      .team-content-toolbar,
      .team-content-actions {
        display: grid;
        justify-content: stretch;
        max-width: none;
      }

      .team-content-card-actions .button,
      .team-content-toolbar .button,
      .team-content-actions .button {
        width: 100%;
        justify-content: center;
      }
    }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="info-card" data-team-content-loading>
        <h2>Loading Team Content Hub</h2>
        <p>Podium Watch is checking your access and loading this team's content.</p>
      </div>

      <div class="team-content-shell" data-team-content hidden>
        <div class="team-content-admin-box" data-team-content-admin-notice hidden>
          <strong>Podium Watch admin mode</strong>
          <p>You can edit, publish, archive, lock, suspend, restore, or permanently remove any item.</p>
        </div>

        <div class="team-content-toolbar">
          <div>
            <p class="eyebrow">Team Content Hub</p>
            <h2 data-team-content-name></h2>
            <p data-team-content-account></p>
          </div>

          <div class="team-content-actions">
            <a class="button button-outline" data-team-content-profile href="/team/" target="_blank" rel="noopener noreferrer">Preview team page</a>
            <a class="button button-outline" data-team-content-return href="/team-dashboard/">Return to dashboard</a>
            <button class="button button-outline" type="button" data-team-content-signout>Sign out</button>
          </div>
        </div>

        <p class="team-content-message" data-team-content-message aria-live="polite" hidden></p>

        <section class="info-card">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Publishing summary</p>
              <h2>Team content</h2>
            </div>

            <button class="button button-primary" type="button" data-team-content-add>Add content</button>
          </div>

          <div class="team-content-summary">
            <div class="team-content-summary-card"><strong data-content-total>0</strong><span>Total items</span></div>
            <div class="team-content-summary-card"><strong data-content-published>0</strong><span>Published</span></div>
            <div class="team-content-summary-card"><strong data-content-draft>0</strong><span>Drafts</span></div>
            <div class="team-content-summary-card"><strong data-content-featured>0</strong><span>Featured</span></div>
            <div class="team-content-summary-card"><strong data-content-archived>0</strong><span>Archived</span></div>
          </div>
        </section>

        <section class="info-card">
          <p class="eyebrow">Find content</p>
          <h2>Filter team posts</h2>

          <div class="team-content-filters">
            <label>
              <strong>Search</strong>
              <input type="search" data-content-search placeholder="Search titles, meets, seasons, or text">
            </label>

            <label>
              <strong>Content type</strong>
              <select data-content-type-filter>
                <option value="">All types</option>
                <option value="announcement">Announcements</option>
                <option value="result">Results</option>
                <option value="achievement">Achievements</option>
                <option value="coverage">Podium Watch coverage</option>
                <option value="media">Media</option>
              </select>
            </label>

            <label>
              <strong>Status</strong>
              <select data-content-status-filter>
                <option value="">All statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
                <option value="featured">Featured</option>
                <option value="suspended">Suspended</option>
                <option value="locked">Admin locked</option>
              </select>
            </label>

            <button class="button button-outline" type="button" data-content-clear-filters>Clear filters</button>
          </div>
        </section>

        <section>
          <div class="team-content-list" data-team-content-list></div>
          <div class="info-card team-content-empty" data-team-content-empty hidden>
            <h2>No content found</h2>
            <p>Add a team announcement, result, achievement, media item, or Podium Watch coverage link.</p>
          </div>
        </section>
      </div>
    </div>
  </section>

  <dialog class="team-content-dialog" data-team-content-dialog>
    <div class="team-content-dialog-shell">
      <div class="team-content-dialog-header">
        <h2 data-team-content-dialog-title>Add team content</h2>
        <button class="button button-outline" type="button" data-team-content-dialog-close>Close</button>
      </div>

      <form class="team-content-form" data-team-content-form>
        <input type="hidden" name="item_id">

        <div class="team-content-fields">
          <label>
            <strong>Content type</strong>
            <select name="content_type" required>
              <option value="announcement">Announcement</option>
              <option value="result">Team result</option>
              <option value="achievement">Achievement</option>
              <option value="coverage">Podium Watch coverage</option>
              <option value="media">Media</option>
            </select>
          </label>

          <label>
            <strong>Status</strong>
            <select name="status" required>
              <option value="draft">Private draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>

          <label>
            <strong>Date</strong>
            <input type="date" name="event_date">
          </label>

          <label>
            <strong>Season label</strong>
            <input type="text" name="season_label" maxlength="120" placeholder="2026 Cross Country">
          </label>
        </div>

        <label>
          <strong>Title</strong>
          <input type="text" name="title" maxlength="220" required>
        </label>

        <label>
          <strong>Short summary</strong>
          <textarea name="summary" rows="3" maxlength="800" placeholder="A short description for cards and featured content"></textarea>
        </label>

        <label>
          <strong>Full details</strong>
          <textarea name="body_text" rows="7" maxlength="16000" placeholder="Add the full announcement, result recap, achievement details, or media description"></textarea>
        </label>

        <div class="team-content-fields">
          <label>
            <strong>Sport</strong>
            <select name="sport_scope">
              <option value="All">All sports</option>
              <option value="Cross Country">Cross Country</option>
              <option value="Indoor Track">Indoor Track</option>
              <option value="Outdoor Track">Outdoor Track</option>
              <option value="Track and Field">Track and Field</option>
            </select>
          </label>

          <label>
            <strong>Program</strong>
            <select name="program_scope">
              <option value="combined">Boys and Girls</option>
              <option value="boys">Boys</option>
              <option value="girls">Girls</option>
            </select>
          </label>

          <label data-content-result-field>
            <strong>Meet or event</strong>
            <input type="text" name="meet_name" maxlength="220">
          </label>

          <label data-content-result-field>
            <strong>Place or finish</strong>
            <input type="text" name="result_place" maxlength="120" placeholder="1st place">
          </label>

          <label data-content-result-field>
            <strong>Team score or result</strong>
            <input type="text" name="result_score" maxlength="160">
          </label>
        </div>

        <div class="team-content-fields">
          <label>
            <strong>Main link</strong>
            <input type="url" name="url" maxlength="2000" placeholder="Article, results, gallery, or official page">
          </label>

          <label>
            <strong>Button label</strong>
            <input type="text" name="cta_label" maxlength="80" placeholder="Read the full story">
          </label>

          <label>
            <strong>Image URL</strong>
            <input type="url" name="image_url" maxlength="2000">
          </label>

          <label>
            <strong>Video URL</strong>
            <input type="url" name="video_url" maxlength="2000">
          </label>

          <label data-content-media-field>
            <strong>Media type</strong>
            <select name="media_kind">
              <option value="photo">Photo</option>
              <option value="graphic">Graphic</option>
              <option value="video">Video</option>
              <option value="gallery">Gallery</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label>
            <strong>Source name</strong>
            <input type="text" name="source_name" maxlength="180" placeholder="Podium Watch, timing company, school, or publication">
          </label>

          <label data-content-media-field>
            <strong>Photographer</strong>
            <input type="text" name="photographer_name" maxlength="180">
          </label>

          <label data-content-media-field>
            <strong>Photographer website</strong>
            <input type="url" name="photographer_url" maxlength="2000">
          </label>
        </div>

        <div class="team-content-fields">
          <label class="team-content-check">
            <input type="checkbox" name="featured">
            <strong>Feature this item near the top of the team page</strong>
          </label>


          <label class="team-content-check">
            <input type="checkbox" name="notify_followers" checked>
            <strong>Send this update to team followers when it is first published</strong>
          </label>

          <label>
            <strong>Featured order</strong>
            <input type="number" name="featured_rank" min="0" max="9999" value="0">
          </label>

          <label>
            <strong>Manual display order</strong>
            <input type="number" name="sort_order" min="-9999" max="9999" value="0">
          </label>
        </div>

        <div class="team-content-admin-box" data-team-content-moderation hidden>
          <h3>Podium Watch moderation</h3>
          <div class="team-content-fields">
            <label class="team-content-check">
              <input type="checkbox" name="suspended">
              <strong>Hide this item from the public page</strong>
            </label>

            <label class="team-content-check">
              <input type="checkbox" name="admin_locked">
              <strong>Prevent team managers from editing this item</strong>
            </label>
          </div>

          <label>
            <strong>Private moderation note</strong>
            <textarea name="moderation_note" rows="4" maxlength="4000"></textarea>
          </label>
        </div>

        <div class="team-content-actions">
          <button class="button button-primary" type="submit">Save content</button>
          <button class="button button-outline" type="button" data-team-content-delete hidden>Delete permanently</button>
        </div>
      </form>
    </div>
  </dialog>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/team-auth-client.js" defer></script>
  <script src="/scripts/team-content.js" defer></script>`;

  return layout({
    site,
    title: "Team Content Hub",
    description:
      "Manage team announcements, results, achievements, media, recruiting links, and Podium Watch coverage.",
    pathname: "/team-content/",
    content
  });
}
