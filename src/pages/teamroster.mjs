import {
  layout,
  pageHero
} from "../lib/html.mjs";

export function teamRosterPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Team Pages",
    title: "Team rosters.",
    description:
      "Build current rosters, publish season archives, import athletes, and carry a team into its next season."
  })}

  <style>
    .team-roster-shell,
    .team-roster-grid,
    .team-roster-list,
    .team-roster-import-preview,
    .team-roster-social-list {
      display: grid;
      gap: 20px;
    }

    .team-roster-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .team-roster-panel {
      padding: 24px;
      border-radius: 16px;
      background: #ffffff;
      box-shadow: 0 12px 34px rgba(15, 23, 42, 0.08);
    }

    .team-roster-panel-full {
      grid-column: 1 / -1;
    }

    .team-roster-header,
    .team-roster-actions,
    .team-roster-badges,
    .team-roster-card-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .team-roster-header {
      justify-content: space-between;
      align-items: center;
    }

    .team-roster-header h2,
    .team-roster-header p,
    .team-roster-panel h2,
    .team-roster-panel h3 {
      margin-bottom: 0;
    }

    .team-roster-form {
      display: grid;
      gap: 18px;
      margin-top: 20px;
    }

    .team-roster-fields {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 16px;
    }

    .team-roster-form label {
      display: block;
    }

    .team-roster-form input,
    .team-roster-form select,
    .team-roster-form textarea,
    .team-roster-toolbar input,
    .team-roster-toolbar select {
      display: block;
      width: 100%;
      margin-top: 8px;
      padding: 12px;
      border: 1px solid rgba(15, 23, 42, 0.22);
      border-radius: 9px;
      background: #ffffff;
      font: inherit;
    }

    .team-roster-season-move-note {
      margin: -8px 0 0;
      padding: 10px 12px;
      border-radius: 8px;
      background: rgba(245, 158, 11, 0.14);
      font-size: 0.85rem;
    }

    .team-roster-form input[type="checkbox"] {
      display: inline-block;
      width: auto;
      margin: 0 8px 0 0;
    }

    .team-roster-message,
    .team-roster-admin-notice {
      padding: 14px 16px;
      border-radius: 10px;
      background: rgba(0, 191, 99, 0.1);
    }

    .team-roster-admin-notice {
      background: rgba(59, 130, 246, 0.12);
    }

    .team-roster-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
      gap: 14px;
      margin-top: 20px;
    }

    .team-roster-stat {
      padding: 18px;
      border-radius: 13px;
      background: rgba(15, 23, 42, 0.05);
    }

    .team-roster-stat strong {
      display: block;
      font-size: 1.7rem;
      line-height: 1;
    }

    .team-roster-stat span {
      display: block;
      margin-top: 8px;
      font-weight: 750;
    }

    .team-roster-progress {
      overflow: hidden;
      height: 12px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.1);
    }

    .team-roster-progress span {
      display: block;
      height: 100%;
      width: 0;
      background: #00bf63;
    }

    .team-roster-toolbar {
      display: grid;
      grid-template-columns: minmax(230px, 2fr) repeat(2, minmax(170px, 1fr));
      gap: 14px;
      margin: 20px 0;
    }

    .team-roster-card {
      display: grid;
      gap: 14px;
      padding: 20px;
      border: 1px solid rgba(15, 23, 42, 0.14);
      border-radius: 14px;
      background: #ffffff;
    }

    .team-roster-card-main {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 18px;
      align-items: start;
    }

    .team-roster-card h3,
    .team-roster-card p {
      margin: 0;
    }

    .team-roster-badge {
      display: inline-flex;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(0, 191, 99, 0.14);
      font-size: 0.78rem;
      font-weight: 850;
    }

    .team-roster-badge-dark {
      background: #111827;
      color: #ffffff;
    }

    .team-roster-badge-warning {
      background: rgba(245, 158, 11, 0.18);
      color: #92400e;
    }

    .team-roster-detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
    }

    .team-roster-detail {
      padding: 12px;
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.05);
    }

    .team-roster-detail strong,
    .team-roster-detail span {
      display: block;
    }

    .team-roster-detail span {
      margin-top: 4px;
    }

    .team-roster-empty {
      padding: 28px;
      text-align: center;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.05);
    }

    .team-roster-import-row {
      padding: 14px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 10px;
    }

    .team-roster-import-row-error {
      border-color: rgba(220, 38, 38, 0.35);
      background: rgba(220, 38, 38, 0.06);
    }

    .team-roster-consent {
      display: grid;
      gap: 10px;
      padding: 16px;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.05);
    }

    .team-roster-consent label {
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }

    .team-roster-consent input {
      width: auto;
      margin-top: 4px;
    }

    dialog.team-roster-dialog {
      width: min(900px, calc(100% - 28px));
      max-height: calc(100vh - 40px);
      overflow: auto;
      padding: 0;
      border: 0;
      border-radius: 18px;
      box-shadow: 0 28px 100px rgba(0, 0, 0, 0.35);
    }

    dialog.team-roster-dialog::backdrop {
      background: rgba(15, 23, 42, 0.72);
    }

    .team-roster-dialog-body {
      padding: 26px;
    }

    @media (max-width: 840px) {
      .team-roster-grid,
      .team-roster-toolbar,
      .team-roster-card-main {
        grid-template-columns: 1fr;
      }

      .team-roster-card-actions,
      .team-roster-actions {
        display: grid;
      }

      .team-roster-card-actions .button,
      .team-roster-actions .button {
        width: 100%;
        justify-content: center;
      }
    }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="info-card" data-team-roster-loading>
        <h2>Checking roster access</h2>
        <p>Please wait while Podium Watch securely loads the team roster.</p>
      </div>

      <div class="team-roster-shell" data-team-roster hidden>
        <p class="team-roster-admin-notice" data-team-roster-admin-notice hidden>
          Podium Watch admin mode is active. Changes are recorded in the team history.
        </p>

        <div class="team-roster-header">
          <div>
            <p class="eyebrow">Roster manager</p>
            <h2 data-team-roster-name></h2>
            <p data-team-roster-account></p>
          </div>

          <div class="team-roster-actions">
            <a class="button button-outline" data-team-roster-profile href="/team/">View team profile</a>
            <a class="button button-outline" data-team-roster-return href="/team-dashboard/">Team dashboard</a>
            <button class="button button-outline" type="button" data-team-roster-signout>Sign out</button>
          </div>
        </div>

        <p class="team-roster-message" data-team-roster-message aria-live="polite" hidden></p>

        <div class="team-roster-grid">
          <section class="team-roster-panel">
            <p class="eyebrow">Season setup</p>
            <h2>Create a roster season</h2>

            <form class="team-roster-form" data-create-season-form>
              <div class="team-roster-fields">
                <label>
                  <strong>Season year</strong>
                  <input type="number" name="season_year" min="2000" max="2100" required>
                </label>

                <label>
                  <strong>School year begins</strong>
                  <input type="number" name="academic_year_start" min="2000" max="2100" required>
                </label>

                <label>
                  <strong>Sport</strong>
                  <select name="sport" required>
                    <option value="Cross Country">Cross Country</option>
                    <option value="Indoor Track">Indoor Track</option>
                    <option value="Outdoor Track">Outdoor Track</option>
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
              </div>

              <label>
                <strong>Season name</strong>
                <input type="text" name="name" placeholder="2026 Cross Country">
              </label>

              <label>
                <input type="checkbox" name="is_current">
                Make this the current season for this sport and program
              </label>

              <button class="button button-primary" type="submit">Create season</button>
            </form>
          </section>

          <section class="team-roster-panel">
            <p class="eyebrow">Current selection</p>
            <h2>Season controls</h2>

            <label style="display:block;margin-top:20px;">
              <strong>Roster season</strong>
              <select data-season-select style="display:block;width:100%;margin-top:8px;padding:12px;font:inherit;"></select>
            </label>

            <div data-season-empty class="team-roster-empty" style="margin-top:18px;" hidden>
              Create the first season to begin building a roster.
            </div>

            <form class="team-roster-form" data-season-form hidden>
              <input type="hidden" name="season_id">

              <div class="team-roster-fields">
                <label>
                  <strong>Season name</strong>
                  <input type="text" name="name" required>
                </label>

                <label>
                  <strong>Season year</strong>
                  <input type="number" name="season_year" min="2000" max="2100" required>
                </label>

                <label>
                  <strong>School year begins</strong>
                  <input type="number" name="academic_year_start" min="2000" max="2100" required>
                </label>

                <label>
                  <strong>Sport</strong>
                  <select name="sport">
                    <option value="Cross Country">Cross Country</option>
                    <option value="Indoor Track">Indoor Track</option>
                    <option value="Outdoor Track">Outdoor Track</option>
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

                <label>
                  <strong>Visibility</strong>
                  <select name="status">
                    <option value="draft">Private draft</option>
                    <option value="published">Published roster</option>
                    <option value="archived">Published archive</option>
                  </select>
                </label>

                <label>
                  <strong>Start date</strong>
                  <input type="date" name="start_date">
                </label>

                <label>
                  <strong>End date</strong>
                  <input type="date" name="end_date">
                </label>
              </div>

              <label>
                <strong>Season notes</strong>
                <textarea name="notes" rows="3"></textarea>
              </label>

              <label>
                <input type="checkbox" name="is_current">
                Mark as the current season
              </label>

              <button class="button button-primary" type="submit">Save season</button>
            </form>
          </section>

          <section class="team-roster-panel team-roster-panel-full" data-roster-section hidden>
            <div class="team-roster-header">
              <div>
                <p class="eyebrow">Athletes</p>
                <h2 data-roster-season-title>Season roster</h2>
              </div>

              <button class="button button-primary" type="button" data-add-athlete>Add athlete</button>
            </div>

            <div class="team-roster-summary">
              <div class="team-roster-stat"><strong data-roster-total>0</strong><span>Athletes</span></div>
              <div class="team-roster-stat"><strong data-roster-completion>0%</strong><span>Roster completion</span></div>
              <div class="team-roster-stat"><strong data-roster-missing-grade>0</strong><span>Missing grade</span></div>
              <div class="team-roster-stat"><strong data-roster-missing-events>0</strong><span>Missing events</span></div>
            </div>

            <div style="margin-top:16px;">
              <div class="team-roster-progress"><span data-roster-progress></span></div>
              <p data-roster-warning style="margin:10px 0 0;"></p>
            </div>

            <div class="team-roster-toolbar">
              <label>
                <strong>Search roster</strong>
                <input type="search" data-roster-search placeholder="Search athlete name">
              </label>

              <label>
                <strong>Program</strong>
                <select data-roster-gender-filter>
                  <option value="">All athletes</option>
                  <option value="boys">Boys</option>
                  <option value="girls">Girls</option>
                  <option value="unspecified">Missing program</option>
                </select>
              </label>

              <label>
                <strong>Status</strong>
                <select data-roster-status-filter>
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="injured">Injured</option>
                  <option value="inactive">Inactive</option>
                  <option value="graduated">Graduated</option>
                  <option value="transferred">Transferred</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>

            <div class="team-roster-list" data-roster-list></div>
            <div class="team-roster-empty" data-roster-empty hidden>No athletes match this roster view.</div>
          </section>

          <section class="team-roster-panel team-roster-panel-full" data-rollover-section hidden>
            <p class="eyebrow">Next season</p>
            <h2>Move the roster forward</h2>
            <p>
              Copy athletes into another season. Grades advance only when the target school year is later. Athletes moving beyond grade 12 are archived as graduates.
            </p>

            <form class="team-roster-form" data-rollover-form>
              <input type="hidden" name="source_season_id">

              <label>
                <strong>Target season</strong>
                <select name="target_season_id" required></select>
              </label>

              <label>
                <input type="checkbox" name="make_target_current" checked>
                Make the target the current season
              </label>

              <label>
                <input type="checkbox" name="archive_source">
                Archive the source season after copying the roster
              </label>

              <button class="button button-primary" type="submit">Move roster to target season</button>
            </form>
          </section>

          <section class="team-roster-panel team-roster-panel-full" data-import-section hidden>
            <div class="team-roster-header">
              <div>
                <p class="eyebrow">CSV import</p>
                <h2>Upload a full roster</h2>
                <p>Preview every athlete before saving. Existing athletes are updated rather than duplicated.</p>
              </div>

              <button class="button button-outline" type="button" data-roster-template>Download CSV template</button>
            </div>

            <form class="team-roster-form" data-roster-import-form>
              <label>
                <strong>Roster CSV</strong>
                <input type="file" name="roster_file" accept=".csv,text/csv" required>
              </label>

              <div class="team-roster-actions">
                <button class="button button-primary" type="submit">Preview roster import</button>
                <button class="button button-outline" type="button" data-roster-import-clear>Clear import</button>
              </div>
            </form>

            <div data-roster-import-results hidden style="margin-top:24px;">
              <div class="team-roster-summary">
                <div class="team-roster-stat"><strong data-import-total>0</strong><span>Total rows</span></div>
                <div class="team-roster-stat"><strong data-import-new>0</strong><span>New athletes</span></div>
                <div class="team-roster-stat"><strong data-import-add>0</strong><span>Existing athletes added</span></div>
                <div class="team-roster-stat"><strong data-import-update>0</strong><span>Roster updates</span></div>
                <div class="team-roster-stat"><strong data-import-error>0</strong><span>Errors</span></div>
              </div>

              <div class="team-roster-import-preview" data-roster-import-preview style="margin-top:20px;"></div>

              <button class="button button-primary" type="button" data-roster-import-commit>Import roster</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  </section>

  <dialog class="team-roster-dialog" data-athlete-dialog>
    <div class="team-roster-dialog-body">
      <div class="team-roster-header">
        <div>
          <p class="eyebrow">Roster athlete</p>
          <h2 data-athlete-dialog-title>Add athlete</h2>
        </div>
        <button class="button button-outline" type="button" data-athlete-dialog-close>Close</button>
      </div>

      <form class="team-roster-form" data-athlete-form>
        <input type="hidden" name="entry_id">
        <input type="hidden" name="athlete_id">

        <label>
          <strong>Roster season</strong>
          <select name="season_id" data-athlete-season-select required></select>
        </label>
        <p class="team-roster-season-move-note" data-athlete-season-move-note hidden>
          Saving will move this athlete off their current season onto the one selected above --
          it won't create a duplicate entry.
        </p>

        <div class="team-roster-fields">
          <label><strong>First name</strong><input type="text" name="first_name" required></label>
          <label><strong>Last name</strong><input type="text" name="last_name" required></label>
          <label><strong>Preferred name</strong><input type="text" name="preferred_name"></label>
          <label>
            <strong>Program</strong>
            <select name="gender" required>
              <option value="boys">Boys</option>
              <option value="girls">Girls</option>
              <option value="unspecified">Not listed</option>
            </select>
          </label>
          <label><strong>Grade</strong><input type="number" name="grade" min="6" max="12"></label>
          <label><strong>Graduation year</strong><input type="number" name="graduation_year" min="2000" max="2100"></label>
          <label>
            <strong>Roster status</strong>
            <select name="roster_status">
              <option value="active">Active</option>
              <option value="injured">Injured</option>
              <option value="inactive">Inactive</option>
              <option value="graduated">Graduated</option>
              <option value="transferred">Transferred</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label><strong>Sort order</strong><input type="number" name="sort_order" min="-9999" max="9999" value="0"></label>
        </div>

        <label><strong>Events</strong><input type="text" name="events" placeholder="5K, 1600, 3200"></label>
        <label><strong>Personal bests</strong><textarea name="personal_bests" rows="4" placeholder="5K: 16:05.20&#10;1600: 4:28.10"></textarea></label>

        <div class="team-roster-fields">
          <label><strong>Photo URL</strong><input type="url" name="photo_url"></label>
          <label><strong>Hometown</strong><input type="text" name="hometown"></label>
          <label><strong>College commitment</strong><input type="text" name="college_commitment"></label>
        </div>

        <label><strong>Athlete bio</strong><textarea name="bio" rows="4"></textarea></label>
        <label><strong>Roster notes</strong><textarea name="notes" rows="3"></textarea></label>

        <div class="team-roster-fields">
          <label><input type="checkbox" name="captain"> Team captain</label>
          <label><input type="checkbox" name="athlete_public_visible" checked> Athlete may appear on published rosters</label>
          <label><input type="checkbox" name="entry_public_visible" checked> Show this season entry publicly</label>
        </div>

        <div class="team-roster-actions">
          <button class="button button-primary" type="submit">Save athlete</button>
          <button class="button button-outline" type="button" data-remove-athlete-entry hidden>Remove from season</button>
        </div>
      </form>

      <section data-athlete-invite-section hidden style="margin-top:30px;">
        <p class="eyebrow">Athlete access</p>
        <h3>Invite to Podium Watch</h3>
        <p>Invite this athlete to see their own race plans and results. Only a coach-issued invite can create their account -- there is no open signup.</p>

        <div class="team-roster-social-list" data-athlete-invite-list></div>

        <form class="team-roster-form" data-athlete-invite-form>
          <input type="hidden" name="team_athlete_id">
          <div class="team-roster-fields">
            <label><strong>Athlete's email</strong><input type="email" name="invited_email" required></label>
            <label><strong>Athlete's name (optional)</strong><input type="text" name="invited_name"></label>
          </div>
          <button class="button button-primary" type="submit">Send invite</button>
        </form>
      </section>

      <section data-guardian-invite-section hidden style="margin-top:30px;">
        <p class="eyebrow">Guardian access</p>
        <h3>Invite a parent or guardian</h3>
        <p>Invite a parent or guardian to follow this athlete's race plans and results. Only a coach-issued invite can create their account -- there is no open signup. More than one guardian per athlete is fine.</p>

        <div class="team-roster-social-list" data-guardian-invite-list></div>

        <form class="team-roster-form" data-guardian-invite-form>
          <input type="hidden" name="team_athlete_id">
          <div class="team-roster-fields">
            <label><strong>Guardian's email</strong><input type="email" name="invited_email" required></label>
            <label><strong>Guardian's name (optional)</strong><input type="text" name="invited_name"></label>
          </div>
          <button class="button button-primary" type="submit">Send invite</button>
        </form>
      </section>

      <section data-athlete-social-section hidden style="margin-top:30px;">
        <p class="eyebrow">Athlete links</p>
        <h3>Social and recruiting links</h3>
        <p>
          A link cannot be published until athlete consent, guardian consent, and team approval are all confirmed.
        </p>

        <div class="team-roster-social-list" data-athlete-social-list></div>

        <form class="team-roster-form" data-athlete-social-form>
          <input type="hidden" name="season_id">
          <input type="hidden" name="athlete_id">
          <input type="hidden" name="roster_entry_id">
          <input type="hidden" name="link_id">

          <div class="team-roster-fields">
            <label>
              <strong>Platform</strong>
              <select name="platform">
                <option value="Instagram">Instagram</option>
                <option value="X">X</option>
                <option value="TikTok">TikTok</option>
                <option value="YouTube">YouTube</option>
                <option value="Other">Recruiting Profile or Other</option>
              </select>
            </label>
            <label><strong>Label</strong><input type="text" name="label"></label>
            <label><strong>URL</strong><input type="url" name="url" required></label>
            <label><strong>Sort order</strong><input type="number" name="sort_order" value="0"></label>
          </div>

          <div class="team-roster-consent">
            <label><input type="checkbox" name="athlete_consent_confirmed"> The athlete gave permission to publish this link</label>
            <label><input type="checkbox" name="guardian_consent_confirmed"> A parent or guardian gave permission to publish this link</label>
            <label><input type="checkbox" name="approved_by_team"> The team approved this as an appropriate link</label>
            <label><input type="checkbox" name="published"> Publish this link on the public roster</label>
          </div>

          <button class="button button-primary" type="submit">Save athlete link</button>
        </form>
      </section>
    </div>
  </dialog>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/team-auth-client.js" defer></script>
  <script src="/scripts/team-roster.js" defer></script>`;

  return layout({
    site,
    title: "Team Rosters",
    description:
      "Manage Podium Watch team roster seasons, athletes, archives, and roster imports.",
    pathname: "/team-roster/",
    content
  });
}
