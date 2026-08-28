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

    .meet-badge {
      display: inline-flex;
      align-items: center;
      min-height: 0;
      padding: 3px 8px;
      background: rgba(15, 175, 104, 0.12);
      color: var(--green-dark);
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      line-height: 1.4;
    }

    .meet-badge-dark {
      background: var(--black);
      color: var(--white);
    }

    .meet-badge-featured {
      background: var(--green);
      color: var(--white);
    }

    .meet-empty {
      padding: 30px;
      text-align: center;
    }

    .meet-center-tabs {
      display: flex;
      gap: 8px;
      margin-top: 24px;
      border-bottom: 1px solid var(--line);
    }

    .meet-center-tab {
      appearance: none;
      background: none;
      border: none;
      border-bottom: 3px solid transparent;
      padding: 10px 4px;
      margin-bottom: -1px;
      font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
      font-size: 1rem;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: var(--muted);
      cursor: pointer;
    }

    .meet-center-tab[aria-selected="true"] {
      color: var(--ink);
      border-bottom-color: var(--green);
    }

    .meet-center-tab:hover {
      color: var(--ink);
    }

    .meet-load-more {
      margin-top: 18px;
      width: 100%;
    }

    @media (max-width: 640px) {
      .meet-center-tabs {
        gap: 4px;
      }

      .meet-center-tab {
        flex: 1;
        text-align: center;
        font-size: 0.88rem;
      }
    }

    /* Meet Center feedback (2026-08-26): the previous card grid only fit
       about 6 meets on screen at once and read as mostly empty space
       around one big button. A compact, scannable row -- date chip, name,
       key details, the whole row itself the link -- fits far more of a
       150+ meet list on screen and is a single large tap target on
       mobile, not a separate nested button. */
    .meet-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .meet-row {
      display: grid;
      grid-template-columns: 68px minmax(0, 1fr) auto;
      align-items: center;
      gap: 18px;
      padding: 14px 18px;
      border: 1px solid var(--line);
      background: var(--white);
      color: var(--ink);
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .meet-row:hover,
    .meet-row:focus-visible {
      border-color: var(--green);
      box-shadow: var(--shadow);
    }

    .meet-row-featured {
      border-left: 4px solid var(--green);
    }

    .meet-row-date {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 8px 4px;
      text-align: center;
      background: var(--paper);
      border: 1px solid var(--line);
    }

    .meet-row-date-month {
      font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
      font-size: 0.68rem;
      letter-spacing: 1px;
      color: var(--green-dark);
    }

    .meet-row-date-day {
      font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
      font-size: 1.55rem;
      line-height: 1.1;
    }

    .meet-row-main {
      min-width: 0;
    }

    .meet-row-name {
      display: block;
      margin-bottom: 4px;
      font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
      font-size: 1.15rem;
      line-height: 1.2;
      text-transform: uppercase;
      overflow-wrap: break-word;
    }

    .meet-row-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 5px 10px;
      color: var(--muted);
      font-size: 0.85rem;
    }

    .meet-row-action {
      font-weight: 800;
      font-size: 0.82rem;
      color: var(--green-dark);
      white-space: nowrap;
      text-transform: uppercase;
      letter-spacing: 0.02em;
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

      .meet-row {
        grid-template-columns: 52px minmax(0, 1fr);
        gap: 4px 14px;
        padding: 12px 14px;
      }

      .meet-row-date {
        grid-row: 1 / 3;
        padding: 6px 2px;
      }

      .meet-row-date-day {
        font-size: 1.3rem;
      }

      .meet-row-name {
        font-size: 1.02rem;
      }

      .meet-row-action {
        grid-column: 2 / 3;
        margin-top: 4px;
        padding-top: 8px;
        border-top: 1px solid var(--line);
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

      <div class="meet-center-tabs" role="tablist" aria-label="Meet Center view" data-meet-view-tabs hidden>
        <button class="meet-center-tab" type="button" role="tab" data-meet-view-tab data-view="today">Today</button>
        <button class="meet-center-tab" type="button" role="tab" data-meet-view-tab data-view="upcoming">Upcoming</button>
        <button class="meet-center-tab" type="button" role="tab" data-meet-view-tab data-view="results">Results</button>
      </div>

      <section class="meet-section" data-meet-view-panel="today" hidden>
        <div class="meet-section-heading">
          <div>
            <p class="eyebrow">Today in Ohio</p>
            <h2>Today's meets</h2>
          </div>

          <strong data-meet-count="today"></strong>
        </div>

        <div class="meet-list" data-meet-list="today"></div>
        <button class="button button-outline meet-load-more" type="button" data-load-more="today" hidden>Load more meets</button>
      </section>

      <section class="meet-section" data-meet-view-panel="upcoming" hidden>
        <div class="meet-section-heading">
          <div>
            <p class="eyebrow">Coming up</p>
            <h2>Upcoming meets</h2>
          </div>

          <strong data-meet-count="upcoming"></strong>
        </div>

        <div class="meet-list" data-meet-list="upcoming"></div>
        <button class="button button-outline meet-load-more" type="button" data-load-more="upcoming" hidden>Load more meets</button>
      </section>

      <section class="meet-section" data-meet-view-panel="results" hidden>
        <div class="meet-section-heading">
          <div>
            <p class="eyebrow">Past events</p>
            <h2>Results</h2>
          </div>

          <strong data-meet-count="results"></strong>
        </div>

        <div class="meet-list" data-meet-list="results"></div>
        <button class="button button-outline meet-load-more" type="button" data-load-more="results" hidden>Load more meets</button>
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