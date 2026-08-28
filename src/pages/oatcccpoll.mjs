import { breadcrumb, icon, layout, pageHero } from "../lib/html.mjs";
import oatcccPoll from "../data/oatccc-coaches-poll.json" with { type: "json" };

// OATCCC Coaches Poll -- a single static page displaying all 8 official
// Ohio Association of Track and Cross Country Coaches cross country
// polls (Boys/Girls, Divisions 1-4), reusing the exact
// gender-tabs-plus-division-select interaction already built for the
// homepage's Power Rankings widget (see homePage() in scripts/build.mjs)
// rather than inventing a new pattern or generating 8 separate routes.
// Data lives in src/data/oatccc-coaches-poll.json, a plain data file --
// updating the poll each week is just replacing that file, no admin
// tool, database, or import pipeline involved.
//
// Every rank/school/points/first-place-vote value here is exactly what
// OATCCC's own published Google Sheet shows, including two real
// oddities in the official source that are deliberately NOT "corrected":
// Boys Division 3 has a row (Triway) with no rank number filled in by
// OATCCC itself, sitting between ranks 24 and 26; Girls Division 4 has
// "Dayton Christian" listed twice, at two different ranks. Both are
// reproduced as published, not merged, renumbered, or dropped.

function formatDate(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const DIVISION_LABELS = { 1: "Division I", 2: "Division II", 3: "Division III", 4: "Division IV" };

export function oatcccCoachesPollPage(site) {
  const pathname = "/rankings/oatccc/";
  const title = "OATCCC Cross Country Coaches Poll";
  const pollDateText = formatDate(oatcccPoll.pollDate);

  const content = `${pageHero({
    eyebrow: "Ohio Cross Country",
    title: "2026 OATCCC Coaches Poll",
    description: `The official Ohio Association of Track and Cross Country Coaches poll -- all four divisions, boys and girls -- shared here exactly as published.`
  })}

  <style>
    .oatccc-credit {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 32px;
      padding: 22px 26px;
      border: 1px solid var(--line);
      border-left: 6px solid var(--green);
      background: var(--paper);
    }
    .oatccc-credit p { margin: 0; max-width: 60ch; color: var(--ink); }
    .oatccc-credit .button { flex-shrink: 0; }

    .oatccc-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 10px 20px;
      margin-bottom: 20px;
    }
    .oatccc-meta .oatccc-poll-date { font-size: 1.1rem; font-weight: 800; }
    .oatccc-meta .oatccc-poll-note { color: var(--muted); }

    .oatccc-controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }
    .oatccc-gender-tabs { display: flex; gap: 10px; }
    .oatccc-gender-tabs button {
      min-height: 44px;
      padding: 10px 22px;
      border: 1px solid var(--ink);
      background: transparent;
      color: var(--ink);
      font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
      font-size: 0.88rem;
      letter-spacing: 1px;
      text-transform: uppercase;
      cursor: pointer;
    }
    .oatccc-gender-tabs button.active { color: var(--black); background: var(--green); border-color: var(--green); }

    .oatccc-division-select {
      min-height: 44px;
      padding: 10px 14px;
      border: 1px solid var(--ink);
      background: var(--white);
      color: var(--ink);
      font: inherit;
      font-weight: 700;
    }

    .oatccc-table-wrap { width: 100%; overflow-x: auto; border: 1px solid var(--line); background: var(--white); }
    .oatccc-table { width: 100%; border-collapse: collapse; }
    .oatccc-table th, .oatccc-table td { text-align: left; padding: 12px 14px; border-bottom: 1px solid var(--line); }
    .oatccc-table th {
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      color: var(--white);
      background: var(--black);
      white-space: nowrap;
    }
    .oatccc-table td.oatccc-cell-rank { font-weight: 800; width: 1%; white-space: nowrap; }
    .oatccc-table td.oatccc-cell-school { font-weight: 700; }
    .oatccc-table td.oatccc-cell-num { font-variant-numeric: tabular-nums; }
    .oatccc-table tbody tr:nth-child(even) { background: #fafafa; }

    @media (max-width: 560px) {
      .oatccc-credit { flex-direction: column; align-items: flex-start; }
      .oatccc-table th, .oatccc-table td { padding: 10px; font-size: 0.9rem; }
    }
  </style>

  <section class="section section-paper" aria-labelledby="oatccc-poll-title">
    <div class="container">
      ${breadcrumb([{ label: "Home", href: "/" }, { label: "Rankings", href: "/rankings/" }, { label: title }])}

      <div class="oatccc-credit">
        <p>Rankings provided by the Ohio Association of Track and Cross Country Coaches. Podium Watch is sharing the official coaches poll with full credit to OATCCC.</p>
        <a class="button button-primary" href="${oatcccPoll.sourceUrl}" target="_blank" rel="noopener noreferrer">View Original Poll at OATCCC ${icon("arrow")}</a>
      </div>

      <div class="oatccc-meta">
        <span class="oatccc-poll-date">${oatcccPoll.pollLabel} &middot; ${pollDateText}</span>
        <span class="oatccc-poll-note">Straight from OATCCC's own Google Sheet, division by division.</span>
      </div>

      <div class="section-heading">
        <div><p class="eyebrow">All 8 polls</p><h2 id="oatccc-poll-title">Boys and girls, Divisions I through IV</h2></div>
      </div>

      <div class="oatccc-controls" role="group" aria-label="Choose a poll">
        <div class="oatccc-gender-tabs" role="group" aria-label="Choose gender">
          <button type="button" class="active" data-oatccc-gender="boys">Boys</button>
          <button type="button" data-oatccc-gender="girls">Girls</button>
        </div>
        <label>
          <span class="visually-hidden">Choose division</span>
          <select class="oatccc-division-select" data-oatccc-division>
            <option value="1">Division I</option>
            <option value="2">Division II</option>
            <option value="3">Division III</option>
            <option value="4">Division IV</option>
          </select>
        </label>
      </div>

      <p data-oatccc-heading style="font-weight:800;font-size:1.1rem;margin-bottom:10px;"></p>

      <div class="oatccc-table-wrap">
        <table class="oatccc-table">
          <thead><tr><th>Rank</th><th>School</th><th>Points</th><th>First Place Votes</th></tr></thead>
          <tbody data-oatccc-rows></tbody>
        </table>
      </div>
    </div>
  </section>

  <script type="application/json" data-oatccc-data>${JSON.stringify(oatcccPoll).replaceAll("<", "\\u003c")}</script>
  <script>(()=>{
    const dataEl = document.querySelector('[data-oatccc-data]');
    const data = JSON.parse(dataEl.textContent);
    const rowsEl = document.querySelector('[data-oatccc-rows]');
    const headingEl = document.querySelector('[data-oatccc-heading]');
    const select = document.querySelector('[data-oatccc-division]');
    const genderButtons = Array.from(document.querySelectorAll('[data-oatccc-gender]'));
    const labels = { 1: 'Division I', 2: 'Division II', 3: 'Division III', 4: 'Division IV' };
    let gender = 'boys';

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function draw() {
      const division = select.value;
      const rows = (data.divisions[gender] && data.divisions[gender][division]) || [];
      headingEl.textContent = (gender === 'boys' ? 'Boys' : 'Girls') + ' ' + labels[division];
      rowsEl.innerHTML = rows.map((row) => (
        '<tr>' +
          '<td class="oatccc-cell-rank">' + (row.rank != null ? escapeHtml(row.rank) : '--') + '</td>' +
          '<td class="oatccc-cell-school">' + escapeHtml(row.school) + '</td>' +
          '<td class="oatccc-cell-num">' + (row.points != null ? escapeHtml(row.points) : '--') + '</td>' +
          '<td class="oatccc-cell-num">' + (row.first_place_votes != null ? escapeHtml(row.first_place_votes) : '--') + '</td>' +
        '</tr>'
      )).join('');
    }

    genderButtons.forEach((button) => button.addEventListener('click', () => {
      gender = button.dataset.oatcccGender;
      genderButtons.forEach((item) => item.classList.toggle('active', item === button));
      draw();
    }));
    select.addEventListener('change', draw);
    draw();
  })();</script>

  <script src="/scripts/page-view.js" defer></script>`;

  return layout({
    site,
    title,
    description: `The official 2026 OATCCC cross country coaches poll -- all eight polls, boys and girls Divisions I through IV -- shared with full credit to the Ohio Association of Track and Cross Country Coaches.`,
    pathname,
    content
  });
}
