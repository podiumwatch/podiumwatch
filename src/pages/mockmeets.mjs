import { breadcrumb, icon, layout, pageHero } from "../lib/html.mjs";

// 2026 Ohio XC Mock Meets (September 17 snapshot) -- a one-off companion
// results page for the "A New View from No. 1" story. Podium Watch did not
// time these races; they are modeled scores computed from each team's top
// 24-selected runners' real, independently supplied season-best 5K times,
// combined across different courses and dates into a hypothetical race per
// division. See the methodology panel on this page and the article for the
// full explanation -- this comment is scope only, not a restatement.
//
// The dataset (public/data/mock-meets-2026-09-17.json, 192 teams / 1,339
// athletes) is fetched client-side rather than embedded inline like the
// much smaller OATCCC poll JSON (src/pages/oatcccpoll.mjs) -- at ~520KB,
// inlining it would add that weight to every page load's initial HTML
// parse. Fetching it once, after the shell renders, follows the same
// pattern already established by /search-index.json (public/scripts/
// site-search.js) for a large, page-agnostic static JSON asset.
//
// Two of the eight divisions (Boys D3, Girls D3) are marked
// `provisional: true` in the data because of a same-surname pair on one
// roster in each (full detail in the methodology panel and the dataset's
// own `notes`). This page must keep that visible, not bury it -- see
// Publishing_Handoff.md's explicit requirement and the user's own
// confirmed choice to publish with clear provisional labels rather than
// wait on manual identity confirmation.

const SNAPSHOT_DATE = "2026-09-17";
const DATA_URL = "/data/mock-meets-2026-09-17.json";
const ARTICLE_HREF = "/stories/ohio-xc-top-24-mock-meets-september-17-2026/";

export function mockMeetsPage(site) {
  const pathname = "/rankings/mock-meets/2026-09-17/";
  const title = "2026 Ohio XC Mock Meets -- OATCCC Top 24, September 17";

  const content = `${pageHero({
    eyebrow: "Ohio Cross Country -- Modeled Results",
    title: "2026 Mock Meets: OATCCC Top 24",
    description: "Every OATCCC coaches poll top-24 team, boys and girls, Divisions I through IV, scored as a single hypothetical race from each runner's real supplied season-best 5K time. Not a real meet -- see how below."
  })}

  <style>
    .mm-explainer {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
      gap: 18px; margin-bottom: 28px; padding: 22px 26px;
      border: 1px solid var(--line); border-left: 6px solid var(--green); background: var(--paper);
    }
    .mm-explainer p { margin: 0; max-width: 62ch; color: var(--ink); }
    .mm-explainer .button { flex-shrink: 0; }

    .mm-meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 18px; margin-bottom: 20px; }
    .mm-meta strong { font-size: 1.05rem; }
    .mm-meta span { color: var(--muted); }

    .mm-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin-bottom: 18px; }
    .mm-gender-tabs { display: flex; gap: 10px; }
    .mm-gender-tabs button {
      min-height: 44px; padding: 10px 22px; border: 1px solid var(--ink); background: transparent; color: var(--ink);
      font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif; font-size: .88rem; letter-spacing: 1px;
      text-transform: uppercase; cursor: pointer;
    }
    .mm-gender-tabs button.active { color: var(--black); background: var(--green); border-color: var(--green); }
    .mm-division-select, .mm-view-select {
      min-height: 44px; padding: 10px 14px; border: 1px solid var(--ink); background: var(--white); color: var(--ink);
      font: inherit; font-weight: 700;
    }
    .mm-search-wrap { position: relative; flex: 1 1 220px; min-width: 220px; }
    .mm-search { width: 100%; min-height: 44px; padding: 10px 14px; border: 1px solid var(--ink); font: inherit; }
    .mm-search-results {
      position: absolute; z-index: 20; top: calc(100% + 4px); left: 0; right: 0; max-height: 340px; overflow-y: auto;
      background: var(--white); border: 1px solid var(--ink); box-shadow: 0 10px 24px rgba(0,0,0,.15);
    }
    .mm-search-results button {
      display: flex; width: 100%; align-items: baseline; justify-content: space-between; gap: 10px;
      padding: 10px 14px; border: 0; border-bottom: 1px solid var(--line); background: var(--white); color: var(--ink);
      font: inherit; text-align: left; cursor: pointer;
    }
    .mm-search-results button:hover, .mm-search-results button:focus-visible { background: var(--paper); }
    .mm-search-results .mm-search-sub { color: var(--muted); font-size: .82rem; }
    .mm-search-empty { padding: 12px 14px; color: var(--muted); }

    .mm-provisional {
      display: none; margin-bottom: 20px; padding: 16px 20px; border: 1px solid var(--danger); border-left: 6px solid var(--danger);
      background: #fff5f5;
    }
    .mm-provisional.is-visible { display: block; }
    .mm-provisional .mm-provisional-badge {
      display: inline-block; margin-bottom: 8px; padding: 3px 10px; border-radius: 999px; background: var(--danger); color: var(--white);
      font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif; font-size: .72rem; letter-spacing: 1px; text-transform: uppercase;
    }
    .mm-provisional p { margin: 0; color: var(--ink); }

    .mm-heading { font-weight: 800; font-size: 1.15rem; margin-bottom: 10px; }

    .mm-table td.mm-cell-rank { font-weight: 800; white-space: nowrap; }
    .mm-table th { white-space: nowrap; }
    .mm-table td.mm-cell-school { font-weight: 700; }
    .mm-table td.mm-cell-num { font-variant-numeric: tabular-nums; }
    .mm-move-up { color: var(--green-dark); font-weight: 800; }
    .mm-move-down { color: var(--danger); font-weight: 800; }
    .mm-move-none { color: var(--muted); font-weight: 800; }
    .mm-team-toggle {
      min-height: 34px; padding: 6px 12px; border: 1px solid var(--ink); background: var(--white); color: var(--ink);
      font-weight: 700; font-size: .82rem; cursor: pointer;
    }
    .mm-detail-row td { padding: 0 !important; }
    .mm-roster { width: 100%; border-collapse: collapse; background: #fafafa; }
    .mm-roster th, .mm-roster td { padding: 8px 14px; text-align: left; border-bottom: 1px solid var(--line); font-size: .88rem; }
    .mm-roster th { font-size: .7rem; letter-spacing: .5px; text-transform: uppercase; color: var(--muted); }
    .mm-role-scored { color: var(--green-dark); font-weight: 700; }
    .mm-role-displaced { color: var(--muted); }
    .mm-tied-tag { margin-left: 6px; padding: 1px 7px; border-radius: 999px; background: var(--paper); border: 1px solid var(--line); font-size: .7rem; letter-spacing: .3px; text-transform: uppercase; color: var(--muted); }

    .mm-downloads { display: flex; flex-wrap: wrap; gap: 12px; margin: 22px 0; }
    .mm-loading, .mm-error { padding: 40px 20px; text-align: center; color: var(--muted); }
    .mm-error { color: var(--danger); }

    .mm-methodology { margin-top: 40px; }

    .mm-highlight { outline: 3px solid var(--green); outline-offset: -3px; }
  </style>

  <section class="section section-paper" aria-labelledby="mm-title">
    <div class="container">
      ${breadcrumb([{ label: "Home", href: "/" }, { label: "Rankings", href: "/rankings/" }, { label: "Mock Meets" }])}

      <div class="mm-explainer">
        <p>Podium Watch scored a hypothetical race for each division using every OATCCC top-24 team's supplied season-best 5K times. It is a modeling exercise, not a real meet result -- full context in the article.</p>
        <a class="button button-primary" href="${ARTICLE_HREF}">Read the article ${icon("arrow")}</a>
      </div>

      <div class="mm-meta">
        <strong>September 17, 2026 snapshot</strong>
        <span>Five score, sixth and seventh displace, identical times share averaged points.</span>
      </div>

      <div class="section-heading">
        <div><p class="eyebrow">All eight divisions</p><h2 id="mm-title">Boys and girls, Divisions I through IV</h2></div>
      </div>

      <div class="mm-controls" role="group" aria-label="Choose a division and view">
        <div class="mm-gender-tabs" role="group" aria-label="Choose gender">
          <button type="button" class="active" data-mm-gender="boys">Boys</button>
          <button type="button" data-mm-gender="girls">Girls</button>
        </div>
        <label>
          <span class="visually-hidden">Choose division</span>
          <select class="mm-division-select" data-mm-division>
            <option value="1">Division I</option>
            <option value="2">Division II</option>
            <option value="3">Division III</option>
            <option value="4">Division IV</option>
          </select>
        </label>
        <label>
          <span class="visually-hidden">Choose view</span>
          <select class="mm-view-select" data-mm-view>
            <option value="teams">Team standings</option>
            <option value="individuals">Individual results</option>
          </select>
        </label>
        <div class="mm-search-wrap">
          <label><span class="visually-hidden">Search teams and athletes</span>
            <input type="search" class="mm-search" data-mm-search placeholder="Search any team or athlete (all divisions)&hellip;" autocomplete="off">
          </label>
          <div class="mm-search-results" data-mm-search-results hidden></div>
        </div>
      </div>

      <div class="mm-provisional" data-mm-provisional>
        <span class="mm-provisional-badge">Provisional division</span>
        <p data-mm-provisional-text></p>
      </div>

      <p class="mm-heading" data-mm-heading></p>

      <div data-mm-loading class="mm-loading">Loading mock meet results&hellip;</div>
      <div data-mm-error class="mm-error" hidden>Could not load the mock meet results. Try reloading the page.</div>

      <div data-mm-content hidden>
        <div class="table-scroll" tabindex="0" data-mm-teams-wrap>
          <table class="mm-table">
            <thead><tr><th>Place</th><th>School</th><th>Poll rank</th><th>Change</th><th>Score</th><th>First five</th><th>Sixth</th><th>Seventh</th><th></th></tr></thead>
            <tbody data-mm-teams-rows></tbody>
          </table>
        </div>

        <div class="table-scroll" tabindex="0" data-mm-individuals-wrap hidden>
          <table class="mm-table">
            <thead><tr><th>Place</th><th>Athlete</th><th>School</th><th>Season best</th><th>Modeled points</th></tr></thead>
            <tbody data-mm-individuals-rows></tbody>
          </table>
        </div>

        <div class="mm-downloads">
          <button type="button" class="button button-outline" data-mm-download="teams">Download team standings (CSV) ${icon("arrow")}</button>
          <button type="button" class="button button-outline" data-mm-download="individuals">Download individual results (CSV) ${icon("arrow")}</button>
        </div>
      </div>

      <div class="info-card mm-methodology">
        <p class="eyebrow">Methodology</p>
        <h2>How these scores were modeled</h2>
        <p>First five score, sixth and seventh displace, and identical listed marks share their averaged occupied places rather than each claiming a whole place -- which is why some scores include a half point. Every runner's time is the season best supplied for this project, not necessarily run on the same course or date as any other runner in the field, so this is supporting context for the coaches poll, not a race result or a championship prediction.</p>
        <p style="margin-top:14px;"><a class="text-link" href="${ARTICLE_HREF}">Read the full article for all eight divisions ${icon("arrow")}</a></p>
      </div>
    </div>
  </section>

  <script type="application/json" data-mm-config>${JSON.stringify({ dataUrl: DATA_URL, snapshotDate: SNAPSHOT_DATE, articleHref: ARTICLE_HREF }).replaceAll("<", "\\u003c")}</script>
  <script src="/scripts/mock-meets.js" defer></script>
  <script src="/scripts/page-view.js" defer></script>`;

  return layout({
    site,
    title,
    description: "Modeled mock meet results for every OATCCC coaches poll top-24 team -- boys and girls, Divisions I through IV, September 17, 2026 snapshot. Team standings, individual results, and CSV downloads.",
    pathname,
    content
  });
}
