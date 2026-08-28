import {
  layout,
  pageHero
} from "../lib/html.mjs";

export function meetDetailPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Meet Center",
    title: "Meet information.",
    description:
      "Schedules, directions, results, maps, and important meet details.",
    compact: true
  })}

  <style>
    .meet-detail-shell {
      display: grid;
      gap: 26px;
    }

    .meet-preview-banner {
      padding: 16px 20px;
      border: 2px solid #00bf63;
      border-radius: 12px;
      background: rgba(0, 191, 99, 0.1);
      font-weight: 800;
    }

    .meet-detail-banner {
      width: 100%;
      max-height: 440px;
      object-fit: cover;
      border-radius: 18px;
    }

    .meet-detail-header {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: start;
      gap: 22px;
    }

    .meet-detail-logo {
      width: 110px;
      height: 110px;
      object-fit: contain;
      border-radius: 14px;
      background: #ffffff;
    }

    .meet-detail-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 14px;
    }

    .meet-detail-badge {
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      padding: 6px 11px;
      border-radius: 999px;
      background: rgba(0, 191, 99, 0.14);
      font-size: 0.8rem;
      font-weight: 800;
    }

    .meet-detail-badge-dark {
      background: #111827;
      color: #ffffff;
    }

    .meet-detail-facts {
      display: grid;
      grid-template-columns: repeat(
        auto-fit,
        minmax(190px, 1fr)
      );
      gap: 16px;
    }

    .meet-detail-fact {
      padding: 18px;
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.045);
    }

    .meet-detail-fact p {
      margin: 6px 0 0;
    }

    .meet-detail-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 11px;
    }

    .meet-detail-section {
      padding: 25px;
      border-radius: 16px;
      background: #ffffff;
      box-shadow: 0 12px 34px rgba(15, 23, 42, 0.08);
    }

    .meet-detail-copy {
      white-space: pre-line;
    }

    .meet-photog-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 0;
      border-bottom: 1px solid rgba(15, 23, 42, 0.08);
    }

    .meet-photog-row:last-child {
      border-bottom: 0;
    }

    .meet-detail-message {
      padding: 30px;
      text-align: center;
    }

    @media (max-width: 640px) {
      .meet-detail-header {
        grid-template-columns: 1fr;
      }

      .meet-detail-logo {
        width: 90px;
        height: 90px;
      }

      .meet-detail-actions {
        display: grid;
        grid-template-columns: 1fr;
      }

      .meet-detail-actions .button {
        width: 100%;
        justify-content: center;
      }
    }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div
        class="info-card meet-detail-message"
        data-meet-detail-status
      >
        <h2>Loading meet information</h2>

        <p>
          Podium Watch is gathering the complete meet page.
        </p>
      </div>

      <article
        class="meet-detail-shell"
        data-meet-detail
        hidden
      >
        <div
          class="meet-preview-banner"
          data-meet-preview-banner
          hidden
        >
          Private draft preview. This meet is not visible in the public Meet Center.
        </div>

        <img
          class="meet-detail-banner"
          data-meet-banner
          alt=""
          hidden
        >

        <div class="info-card">
          <div class="meet-detail-header">
            <img
              class="meet-detail-logo"
              data-meet-logo
              alt=""
              hidden
            >

            <div>
              <div
                class="meet-detail-badges"
                data-meet-badges
              ></div>

              <h1 data-meet-name></h1>

              <p
                data-meet-description
                hidden
              ></p>

              <p>
                <strong data-meet-countdown></strong>
              </p>
            </div>
          </div>
        </div>

        <div
          class="meet-detail-facts"
          data-meet-facts
        ></div>

        <div
          class="meet-detail-actions"
          data-primary-meet-actions
        ></div>

        <section
          class="meet-detail-section"
          data-calendar-section
        >
          <p class="eyebrow">
            Save and share
          </p>

          <h2>Keep this meet handy</h2>

          <div
            class="meet-detail-actions"
            data-calendar-actions
          ></div>

          <p
            data-share-message
            aria-live="polite"
            style="margin-bottom:0;"
          ></p>
        </section>

        <div data-meet-information></div>

        <section
          class="meet-detail-section"
          data-meet-results-section
        >
          <p class="eyebrow">
            Results and coverage
          </p>

          <h2>Meet links</h2>

          <div
            class="meet-detail-actions"
            data-result-actions
          ></div>

          <p
            data-result-empty
            hidden
          >
            Results and coverage links will be added when they become available.
          </p>
        </section>

        <section
          class="meet-detail-section"
          data-meet-photographers-section
          hidden
        >
          <p class="eyebrow">Photographer Network</p>
          <h2>Photographers covering this meet</h2>
          <div data-meet-photographers-list></div>
        </section>

        <section
          class="meet-detail-section"
          data-meet-galleries-section
          hidden
        >
          <p class="eyebrow">Photographer Network</p>
          <h2>Galleries from this meet</h2>
          <div data-meet-galleries-list></div>
        </section>

        <div class="meet-detail-actions">
          <a
            class="button button-outline"
            href="/meets/"
          >
            Back to Meet Center
          </a>
        </div>
      </article>
    </div>
  </section>

  <script
    src="/scripts/meet-detail.js"
    defer
  ></script>`;

  return layout({
    site,
    title: "Meet Details",
    description:
      "Schedules, directions, results, maps, and important Ohio meet information.",
    pathname: "/meetdetail/",
    content
  });
}