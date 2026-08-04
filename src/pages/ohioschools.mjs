import {
  layout,
  pageHero
} from "../lib/html.mjs";

export function ohioSchoolsPage(site) {
  const content = `${pageHero({
    eyebrow: "Official Ohio school data",
    title: "Ohio School and Division Directory.",
    description:
      "Search the supplied official 2026 and 2027 boys cross country division assignments by school, city, athletic district, and division."
  })}

  <style>
    .ohio-schools-shell {
      display: grid;
      gap: 26px;
    }

    .ohio-schools-source {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 22px;
      align-items: center;
      border-left: 6px solid #00bf63;
    }

    .ohio-schools-source h2,
    .ohio-schools-source p {
      margin-bottom: 0;
    }

    .ohio-school-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 14px;
    }

    .ohio-school-stat {
      padding: 20px;
      border: 1px solid rgba(15, 23, 42, .11);
      border-radius: 14px;
      background: #fff;
      box-shadow: 0 12px 28px rgba(15, 23, 42, .05);
    }

    .ohio-school-stat strong {
      display: block;
      font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
      font-size: clamp(2rem, 5vw, 3rem);
      line-height: 1;
    }

    .ohio-school-stat span {
      display: block;
      margin-top: 9px;
      font-weight: 900;
    }

    .ohio-schools-filters {
      display: grid;
      gap: 18px;
    }

    .ohio-schools-fields {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 15px;
    }

    .ohio-schools-fields label {
      display: grid;
      gap: 8px;
      font-weight: 850;
    }

    .ohio-schools-fields input,
    .ohio-schools-fields select {
      width: 100%;
      min-height: 47px;
      padding: 10px 12px;
      border: 1px solid rgba(15, 23, 42, .22);
      border-radius: 9px;
      background: #fff;
      font: inherit;
    }

    .ohio-schools-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 11px;
    }

    .ohio-schools-message {
      margin: 0;
      padding: 14px 16px;
      border-radius: 10px;
      background: rgba(0, 191, 99, .12);
      font-weight: 800;
    }

    .ohio-schools-message[data-tone="error"] {
      color: #991b1b;
      background: rgba(220, 38, 38, .12);
    }

    .ohio-schools-results-heading {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: end;
      gap: 16px;
    }

    .ohio-schools-results-heading h2,
    .ohio-schools-results-heading p {
      margin-bottom: 0;
    }

    .ohio-schools-table-wrap {
      overflow-x: auto;
      border: 1px solid rgba(15, 23, 42, .12);
      border-radius: 14px;
      background: #fff;
    }

    .ohio-schools-table {
      width: 100%;
      min-width: 860px;
      border-collapse: collapse;
    }

    .ohio-schools-table th,
    .ohio-schools-table td {
      padding: 14px 13px;
      border-bottom: 1px solid rgba(15, 23, 42, .1);
      text-align: left;
      vertical-align: top;
    }

    .ohio-schools-table th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: #111827;
      color: #fff;
      font-size: .78rem;
      letter-spacing: .04em;
      text-transform: uppercase;
    }

    .ohio-schools-table tbody tr:last-child td {
      border-bottom: 0;
    }

    .ohio-school-name {
      font-weight: 900;
    }

    .ohio-school-badge {
      display: inline-flex;
      padding: 5px 9px;
      border-radius: 999px;
      background: rgba(0, 191, 99, .13);
      font-size: .75rem;
      font-weight: 900;
    }

    .ohio-school-badge-change {
      color: #7c4a03;
      background: rgba(245, 158, 11, .18);
    }

    .ohio-school-mobile-list {
      display: none;
      gap: 14px;
    }

    .ohio-school-card {
      display: grid;
      gap: 12px;
      padding: 19px;
      border: 1px solid rgba(15, 23, 42, .12);
      border-radius: 14px;
      background: #fff;
    }

    .ohio-school-card h3,
    .ohio-school-card p {
      margin: 0;
    }

    .ohio-school-card-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .ohio-school-card-grid span {
      display: block;
      color: #64748b;
      font-size: .76rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    .ohio-school-card-grid strong {
      display: block;
      margin-top: 3px;
    }


    .ohio-schools-pagination {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 12px;
      margin-top: 20px;
    }

    .ohio-schools-pagination p {
      min-width: 120px;
      margin: 0;
      text-align: center;
      font-weight: 900;
    }

    .ohio-schools-footer-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 20px;
    }

    @media (max-width: 720px) {
      .ohio-schools-source,
      .ohio-schools-footer-grid {
        grid-template-columns: 1fr;
      }

      .ohio-schools-table-wrap {
        display: none;
      }

      .ohio-school-mobile-list {
        display: grid;
      }

      .ohio-schools-actions {
        display: grid;
        grid-template-columns: 1fr;
      }

      .ohio-schools-actions .button {
        width: 100%;
        justify-content: center;
      }
    }
  </style>

  <section class="section section-paper">
    <div class="container ohio-schools-shell" data-ohio-schools-page>
      <section class="info-card ohio-schools-source">
        <div>
          <p class="eyebrow">Official source</p>
          <h2>2026 and 2027 boys cross country divisions</h2>
          <p>
            This directory uses the supplied OHSAA boys cross country division document. It does not represent girls cross country or track school divisions.
          </p>
        </div>

        <a
          class="button button-outline"
          href="https://www.ohsaa.org/sports/cc/tournament-info"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open OHSAA source
        </a>
      </section>

      <div class="ohio-school-stats" data-ohio-school-stats>
        <article class="ohio-school-stat">
          <strong data-ohio-stat-schools>556</strong>
          <span>Official schools</span>
        </article>

        <article class="ohio-school-stat">
          <strong data-ohio-stat-d1>78</strong>
          <span>Division I</span>
        </article>

        <article class="ohio-school-stat">
          <strong data-ohio-stat-d2>160</strong>
          <span>Division II</span>
        </article>

        <article class="ohio-school-stat">
          <strong data-ohio-stat-d3>160</strong>
          <span>Division III</span>
        </article>

        <article class="ohio-school-stat">
          <strong data-ohio-stat-d4>158</strong>
          <span>Division IV</span>
        </article>

        <article class="ohio-school-stat">
          <strong data-ohio-stat-moved>57</strong>
          <span>Changed divisions</span>
        </article>
      </div>

      <section class="info-card">
        <p class="eyebrow">School search</p>
        <h2>Find an Ohio program</h2>

        <form class="ohio-schools-filters" data-ohio-schools-form>
          <div class="ohio-schools-fields">
            <label>
              School or city
              <input
                type="search"
                name="search"
                placeholder="Search school, city, or OHSAA ID"
                autocomplete="off"
              >
            </label>

            <label>
              2026 and 2027 division
              <select name="division">
                <option value="">All divisions</option>
                <option value="Division I">Division I</option>
                <option value="Division II">Division II</option>
                <option value="Division III">Division III</option>
                <option value="Division IV">Division IV</option>
              </select>
            </label>

            <label>
              Athletic district
              <select name="athletic_district">
                <option value="">All districts</option>
                <option value="Central">Central</option>
                <option value="East">East</option>
                <option value="Northeast">Northeast</option>
                <option value="Northwest">Northwest</option>
                <option value="Southeast">Southeast</option>
                <option value="Southwest">Southwest</option>
              </select>
            </label>

            <label>
              Division movement
              <select name="changed_only">
                <option value="false">All schools</option>
                <option value="true">Changed divisions only</option>
              </select>
            </label>
          </div>

          <div class="ohio-schools-actions">
            <button class="button button-primary" type="submit">
              Search schools
            </button>

            <button
              class="button button-outline"
              type="button"
              data-ohio-schools-clear
            >
              Clear filters
            </button>
          </div>
        </form>
      </section>

      <p
        class="ohio-schools-message"
        data-ohio-schools-message
        aria-live="polite"
      >
        Loading official school data.
      </p>

      <section>
        <div class="ohio-schools-results-heading">
          <div>
            <p class="eyebrow">Official assignments</p>
            <h2>School results</h2>
          </div>

          <p>
            <strong data-ohio-schools-count>0</strong>
            schools found
          </p>
        </div>

        <div class="ohio-schools-table-wrap" style="margin-top:20px;">
          <table class="ohio-schools-table">
            <thead>
              <tr>
                <th>School</th>
                <th>City</th>
                <th>Athletic district</th>
                <th>2026 and 2027</th>
                <th>2025 and 2026</th>
                <th>Boys enrollment</th>
                <th>Team page</th>
              </tr>
            </thead>
            <tbody data-ohio-schools-table-body></tbody>
          </table>
        </div>

        <div
          class="ohio-school-mobile-list"
          data-ohio-schools-mobile-list
          style="margin-top:20px;"
        ></div>

        <div
          class="empty-state compact-empty"
          data-ohio-schools-empty
          hidden
        >
          <div class="empty-state-mark">OH</div>
          <h2>No schools match those filters</h2>
          <p>Try a broader school name, another district, or all divisions.</p>
        </div>

        <nav
          class="ohio-schools-pagination"
          aria-label="Ohio school directory pages"
          data-ohio-schools-pagination
        >
          <button
            class="button button-outline"
            type="button"
            data-ohio-schools-prev
          >
            Previous page
          </button>

          <p data-ohio-schools-page-status>Page 1 of 1</p>

          <button
            class="button button-outline"
            type="button"
            data-ohio-schools-next
          >
            Next page
          </button>
        </nav>
      </section>

      <div class="ohio-schools-footer-grid">
        <section class="info-card">
          <p class="eyebrow">Track postseason</p>
          <h2>Regional sites and representation</h2>
          <p>
            View the corrected 2026 track regional dates, locations, times, and district representation from the supplied OHSAA document.
          </p>
          <a class="button button-outline" href="/tournament-hub/">
            Open Tournament Hub
          </a>
        </section>

        <section class="info-card">
          <p class="eyebrow">Coaches and team representatives</p>
          <h2>Claim your team page</h2>
          <p>
            Add official schedules, rosters, results, announcements, recruiting links, and social media to your school profile.
          </p>
          <a class="button button-primary" href="/claim-your-team/">
            Start team claim
          </a>
        </section>
      </div>
    </div>
  </section>

  <script src="/scripts/ohio-schools.js" defer></script>`;

  return layout({
    site,
    title: "Ohio School and Division Directory",
    description:
      "Search official 2026 and 2027 OHSAA boys cross country division assignments by Ohio school, city, athletic district, and division.",
    pathname: "/ohio-schools/",
    content
  });
}
