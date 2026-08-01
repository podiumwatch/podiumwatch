import {
  layout,
  pageHero
} from "../lib/html.mjs";

export function meetsIndexPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Meet Center",
    title: "Find your next meet.",
    description:
      "Browse upcoming and completed Ohio cross country and track meets."
  })}

  <style>
    .meet-center-controls {
      display: grid;
      grid-template-columns: repeat(
        auto-fit,
        minmax(190px, 1fr)
      );
      gap: 16px;
    }

    .meet-center-controls label {
      display: block;
    }

    .meet-center-controls input,
    .meet-center-controls select {
      display: block;
      width: 100%;
      margin-top: 8px;
      padding: 12px;
      border: 1px solid rgba(15, 23, 42, 0.2);
      border-radius: 8px;
      background: #ffffff;
      font: inherit;
    }

    .meet-center-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin-top: 20px;
    }

    .meet-center-toolbar strong {
      margin-left: auto;
    }

    .meet-section {
      margin-top: 44px;
    }

    .meet-section-heading {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 22px;
    }

    .meet-card-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }

    .meet-badge {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 5px 10px;
      border-radius: 999px;
      background: rgba(0, 191, 99, 0.12);
      font-size: 0.78rem;
      font-weight: 800;
      line-height: 1;
    }

    .meet-badge-dark {
      background: #111827;
      color: #ffffff;
    }

    .meet-badge-featured {
      background: #00bf63;
      color: #07130d;
    }

    .meet-card-details {
      display: grid;
      gap: 8px;
      margin: 18px 0;
    }

    .meet-card-details p {
      margin: 0;
    }

    .meet-empty {
      padding: 30px;
      text-align: center;
    }

    @media (max-width: 640px) {
      .meet-center-toolbar {
        align-items: stretch;
      }

      .meet-center-toolbar .button {
        width: 100%;
        justify-content: center;
      }

      .meet-center-toolbar strong {
        width: 100%;
        margin-left: 0;
      }
    }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="info-card">
        <div class="meet-center-controls">
          <label>
            <strong>Search</strong>

            <input
              type="search"
              data-public-meet-search
              placeholder="Meet, host, venue, or city"
            >
          </label>

          <label>
            <strong>Sport</strong>

            <select data-public-meet-sport>
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

          <label>
            <strong>Year</strong>

            <select data-public-meet-year>
              <option value="">
                All years
              </option>
            </select>
          </label>

          <label>
            <strong>City</strong>

            <select data-public-meet-city>
              <option value="">
                All cities
              </option>
            </select>
          </label>

          <label>
            <strong>Division</strong>

            <select data-public-meet-division>
              <option value="">
                All divisions
              </option>
            </select>
          </label>

          <label>
            <strong>Meet type</strong>

            <select data-public-meet-type>
              <option value="">
                All meet types
              </option>
            </select>
          </label>
        </div>

        <div class="meet-center-toolbar">
          <button
            class="button button-outline"
            type="button"
            data-clear-public-meet-filters
          >
            Clear filters
          </button>

          <strong data-public-meet-count>
            Loading meets
          </strong>
        </div>
      </div>

      <div
        class="info-card"
        data-meet-center-status
        style="margin-top:24px;"
      >
        <h2>Loading the Meet Center</h2>
        <p>
          Podium Watch is gathering the latest meet information.
        </p>
      </div>

      <section
        class="meet-section"
        data-upcoming-meet-section
        hidden
      >
        <div class="meet-section-heading">
          <div>
            <p class="eyebrow">Coming up</p>
            <h2>Upcoming meets</h2>
          </div>

          <strong data-upcoming-meet-count></strong>
        </div>

        <div
          class="stories-grid"
          data-upcoming-meet-list
        ></div>
      </section>

      <section
        class="meet-section"
        data-completed-meet-section
        hidden
      >
        <div class="meet-section-heading">
          <div>
            <p class="eyebrow">Past events</p>
            <h2>Completed meets</h2>
          </div>

          <strong data-completed-meet-count></strong>
        </div>

        <div
          class="stories-grid"
          data-completed-meet-list
        ></div>
      </section>
    </div>
  </section>

  <script
    src="/scripts/meet-center.js"
    defer
  ></script>`;

  return layout({
    site,
    title: "Meet Center",
    description:
      "Browse upcoming and completed Ohio cross country and track meets.",
    pathname: "/meets/",
    content
  });
}