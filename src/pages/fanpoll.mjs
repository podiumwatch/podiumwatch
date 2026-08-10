import { breadcrumb, layout, pageHero } from "../lib/html.mjs";

const DIVISION_LABELS = ["I", "II", "III", "IV", "V"];

function divisionLabel(divisionNumber) {
  return `Division ${DIVISION_LABELS[divisionNumber - 1] || divisionNumber}`;
}

// One page per sport/gender/division. Only cross country is generated
// right now (see scripts/build.mjs) -- this function itself is already
// sport-aware so track and field can be added later with no changes
// here, once real track division data exists. See
// docs/DECISIONS.md, 2026-08-06.
export function fanPollDivisionPage(site, { sport, sportLabel, sportPath, gender, divisionNumber }) {
  const genderLabel = gender === "girls" ? "Girls" : "Boys";
  const pathname = `/fan-poll/${sportPath}/${gender}/division-${divisionNumber}/`;
  const title = `${sportLabel} ${genderLabel} ${divisionLabel(divisionNumber)} Fan Poll`;

  const content = `${pageHero({
    eyebrow: "Podium Watch Fan Poll",
    title,
    description: `Vote your top 16 ${sportLabel.toLowerCase()} ${genderLabel.toLowerCase()} ${divisionLabel(divisionNumber).toLowerCase()} teams every week. Results are fan-voted, not official.`
  })}

  <style>
    .fan-poll-results-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
    }

    .fan-poll-results-table th,
    .fan-poll-results-table td {
      text-align: left;
      padding: 10px 12px;
      border-bottom: 1px solid rgba(15, 23, 42, 0.12);
      font-size: 0.95em;
    }

    .fan-poll-results-table th { font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.04em; color: rgba(15,23,42,0.6); }

    .fan-poll-movement-up { color: #0a8a3f; font-weight: 700; }
    .fan-poll-movement-down { color: #c62828; font-weight: 700; }
    .fan-poll-movement-flat { color: rgba(15,23,42,0.45); }
    .fan-poll-movement-new { color: #0057d8; font-weight: 700; }

    .fan-poll-builder {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 20px;
    }

    @media (max-width: 760px) {
      .fan-poll-builder { grid-template-columns: 1fr; }
      /* On a phone, show the ballot-in-progress above the team search --
         voters can see it fill up without scrolling past it every time
         they add a team. */
      .fan-poll-ballot-panel { order: -1; }
    }

    .fan-poll-panel-heading {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      font-size: 1.05em;
    }

    .fan-poll-team-list, .fan-poll-ballot-list {
      list-style: none;
      margin: 12px 0 0;
      padding: 0;
      display: grid;
      gap: 8px;
      max-height: 50vh;
      overflow-y: auto;
    }

    .fan-poll-team-row, .fan-poll-ballot-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid rgba(15, 23, 42, 0.15);
      border-radius: 8px;
      background: #fff;
      font-size: 0.95em;
    }

    .fan-poll-team-row .button { min-height: 40px; padding: 8px 16px; }

    .fan-poll-ballot-panel {
      border: 1px solid rgba(0, 191, 99, 0.35);
      border-radius: 12px;
      background: rgba(0, 191, 99, 0.06);
      padding: 14px;
    }

    .fan-poll-ballot-row-controls { display: flex; align-items: center; gap: 6px; }
    .fan-poll-ballot-row-controls button {
      /* At least a 44px touch target -- these are the primary controls
         voters use repeatedly while building a ballot on a phone. */
      width: 44px; height: 44px; border-radius: 8px; border: 1px solid rgba(15,23,42,0.25);
      background: #fff; cursor: pointer; font: inherit; font-size: 1.1em;
    }
    .fan-poll-ballot-row-controls button:disabled { opacity: 0.35; cursor: not-allowed; }
    .fan-poll-ballot-rank { font-weight: 700; width: 26px; text-align: center; flex-shrink: 0; }

    .fan-poll-ballot-count { font-weight: 700; }
    .fan-poll-ballot-count.fan-poll-ballot-count-ready { color: #0a8a3f; }

    .fan-poll-team-search {
      display: block; width: 100%; margin-top: 8px; padding: 12px;
      border: 1px solid rgba(15,23,42,0.22); border-radius: 8px; font: inherit;
    }

    .fan-poll-form-fields { margin-top: 20px; display: grid; gap: 14px; max-width: 480px; }
    .fan-poll-form-fields input[type="email"] {
      padding: 12px; border: 1px solid rgba(15,23,42,0.22); border-radius: 8px; font: inherit;
    }
    .fan-poll-honeypot { position: absolute; left: -9999px; }

    @media (max-width: 760px) {
      .fan-poll-team-list, .fan-poll-ballot-list { max-height: 340px; }
      [data-fan-poll-submit] { width: 100%; justify-content: center; }
    }
  </style>

  <section class="section section-paper" aria-labelledby="fan-poll-results-title">
    <div class="container">
      ${breadcrumb([
        { label: "Home", href: "/" },
        { label: "Fan Poll", href: "/fan-poll/" },
        { label: title }
      ])}
      <div class="section-heading"><div><p class="eyebrow">This week's results</p><h2 id="fan-poll-results-title">${title}</h2></div></div>
      <p data-fan-poll-week-status></p>
      <div data-fan-poll-results-empty hidden><p>No ballots have been counted for this division yet. Be the first to vote below.</p></div>
      <table class="fan-poll-results-table" data-fan-poll-results-table hidden>
        <thead><tr><th>Rank</th><th>Team</th><th>Points</th><th>Ballots</th><th>Change</th></tr></thead>
        <tbody data-fan-poll-results-body></tbody>
      </table>
    </div>
  </section>

  <section class="section" aria-labelledby="fan-poll-ballot-title">
    <div class="container">
      <div class="section-heading"><div><p class="eyebrow">Cast your ballot</p><h2 id="fan-poll-ballot-title">Rank your top 16</h2></div></div>
      <div data-fan-poll-voting-closed hidden><p>Voting is not currently open for this division. Check back for the next voting window.</p></div>
      <div data-fan-poll-ballot-form-wrap>
        <p>Add exactly 16 real ${sportLabel.toLowerCase()} ${genderLabel.toLowerCase()} teams below, then use the up and down arrows to put them in your order. Team 1 gets 16 points, team 16 gets 1 point.</p>
        <div class="fan-poll-builder">
          <div class="fan-poll-team-panel">
            <strong>Available teams</strong>
            <input type="search" placeholder="Search teams" data-fan-poll-team-search class="fan-poll-team-search">
            <ul class="fan-poll-team-list" data-fan-poll-team-list></ul>
          </div>
          <div class="fan-poll-ballot-panel">
            <p class="fan-poll-panel-heading"><strong>Your ballot</strong><span><span class="fan-poll-ballot-count" data-fan-poll-ballot-count>0</span> of 16</span></p>
            <ul class="fan-poll-ballot-list" data-fan-poll-ballot-list></ul>
          </div>
        </div>
        <form class="fan-poll-form-fields" data-fan-poll-ballot-form>
          <label class="fan-poll-honeypot" aria-hidden="true">Leave this blank<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
          <label>Email address<input type="email" name="email" required placeholder="you@example.com"></label>
          <label style="display:flex;align-items:center;gap:8px;">
            <input type="checkbox" name="wants_results_email" style="width:auto;">
            <span>Email me when this week's poll results are published</span>
          </label>
          <p data-fan-poll-form-message aria-live="polite"></p>
          <button class="button button-primary" type="submit" data-fan-poll-submit disabled>Submit ballot (0 of 16 selected)</button>
        </form>
      </div>
    </div>
  </section>

  <script type="application/json" data-fan-poll-config>${JSON.stringify({ sport, gender, division_number: divisionNumber })}</script>
  <script src="/scripts/fan-poll.js" defer></script>`;

  return {
    pathname,
    html: layout({
      site,
      title,
      description: `Vote and see this week's fan-voted top 16 ${sportLabel.toLowerCase()} ${genderLabel.toLowerCase()} ${divisionLabel(divisionNumber).toLowerCase()} teams.`,
      pathname,
      content
    })
  };
}

export function fanPollIndexPage(site) {
  const pathname = "/fan-poll/";
  const divisions = [1, 2, 3, 4];

  const content = `${pageHero({
    eyebrow: "Podium Watch Fan Poll",
    title: "Vote in the Podium Watch Fan Poll.",
    description: "A weekly, reader-voted top 16 ranking per division."
  })}

  <section class="section section-paper"><div class="container">
    <div class="section-heading"><div><p class="eyebrow">Cross Country</p><h2>Boys and girls, Divisions I through IV</h2></div></div>
    <div class="gender-tabs"><a href="/fan-poll/cross-country/boys/division-1/">Boys</a><a href="/fan-poll/cross-country/girls/division-1/">Girls</a></div>
    <div class="division-grid" style="margin-top:16px;">
      ${divisions.map((division) => `<a class="division-card" href="/fan-poll/cross-country/boys/division-${division}/"><strong>Division ${DIVISION_LABELS[division - 1]}</strong><span>Boys fan poll</span></a>`).join("")}
    </div>
    <div class="division-grid" style="margin-top:16px;">
      ${divisions.map((division) => `<a class="division-card" href="/fan-poll/cross-country/girls/division-${division}/"><strong>Division ${DIVISION_LABELS[division - 1]}</strong><span>Girls fan poll</span></a>`).join("")}
    </div>
  </div></section>`;

  return {
    pathname,
    html: layout({
      site,
      title: "Fan Poll",
      description: "Vote in Podium Watch's weekly fan-voted top 16 cross country rankings.",
      pathname,
      content
    })
  };
}
