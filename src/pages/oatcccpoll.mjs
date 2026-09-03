import { breadcrumb, icon, layout, pageHero } from "../lib/html.mjs";
import oatcccPoll from "../data/oatccc-coaches-poll.json" with { type: "json" };

// OATCCC Coaches Poll -- a single static page displaying every official
// Ohio Association of Track and Cross Country Coaches cross country poll
// (Boys/Girls, Divisions 1-4) OATCCC has published this season, reusing
// the gender-tabs-plus-division-select interaction already built for the
// homepage's Power Rankings widget rather than inventing a new pattern.
//
// Data lives in src/data/oatccc-coaches-poll.json as `{ sourceUrl, weeks:
// [...] }`, oldest week first -- updating the poll each week is pushing
// one more entry onto that array (still no admin tool, database, or
// import pipeline involved). A fresh visit to this page always shows the
// LAST entry (2026-09-02: "when you click the link, it should
// automatically take you to the [most recent] poll"); a week selector
// lets a visitor go back and see any earlier poll, including Pre-Season.
//
// Movement arrows (2026-09-02, same request) compare whichever week is
// currently selected against the entry immediately before it in the
// array -- not hardcoded to "Week 1 vs Pre-Season" -- so next week's
// entry automatically gets correct arrows against Week 1 with no code
// change. A school only gets an arrow when it has a real, comparable
// numeric rank in BOTH weeks (a rank like Boys Division 3's "25'" is
// parsed down to its leading integer for this comparison only -- the
// digits are what moved, the mark is just OATCCC's own notation.
// A school with no rank in the prior week -- newly ranked, or the
// selected week IS the first one -- shows no arrow at all, never a
// guessed value).
//
// Every rank/school/points/first-place-vote value in each week here is
// exactly what OATCCC's own published Google Sheet showed that week,
// including real oddities that are deliberately NOT "corrected" -- see
// this file's own git history for exactly which quirks were preserved
// in which week's data, since a new one can appear in any future update.

function formatDate(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function oatcccCoachesPollPage(site) {
  const pathname = "/rankings/oatccc/";
  const title = "OATCCC Cross Country Coaches Poll";
  const latestWeekIndex = oatcccPoll.weeks.length - 1;

  // Every week's date pre-formatted server-side so the client script
  // never needs its own date-formatting logic -- it only ever looks up
  // a value already computed here.
  const weeksForClient = oatcccPoll.weeks.map((week) => ({
    pollLabel: week.pollLabel,
    pollDate: week.pollDate,
    pollDateText: formatDate(week.pollDate),
    divisions: week.divisions
  }));

  const content = `${pageHero({
    eyebrow: "Ohio Cross Country",
    title: "2026 OATCCC Coaches Poll",
    description: `The official Ohio Association of Track and Cross Country Coaches poll -- all four divisions, boys and girls -- shared here exactly as published, with every past poll still available.`
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

    .oatccc-division-select, .oatccc-week-select {
      min-height: 44px;
      padding: 10px 14px;
      border: 1px solid var(--ink);
      background: var(--white);
      color: var(--ink);
      font: inherit;
      font-weight: 700;
    }
    .oatccc-week-select { border-color: var(--green-dark); font-weight: 800; }

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
    .oatccc-table td.oatccc-cell-move { font-variant-numeric: tabular-nums; font-weight: 800; white-space: nowrap; }
    .oatccc-move-up { color: var(--green-dark); }
    .oatccc-move-down { color: var(--danger); }
    .oatccc-move-none { color: var(--muted); }
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
        <span class="oatccc-poll-date" data-oatccc-poll-date></span>
        <span class="oatccc-poll-note">Straight from OATCCC's own Google Sheet, division by division. Green/red shows movement from the previous poll.</span>
      </div>

      <div class="section-heading">
        <div><p class="eyebrow">Every poll this season</p><h2 id="oatccc-poll-title">Boys and girls, Divisions I through IV</h2></div>
      </div>

      <div class="oatccc-controls" role="group" aria-label="Choose a poll">
        <label>
          <span class="visually-hidden">Choose a week</span>
          <select class="oatccc-week-select" data-oatccc-week></select>
        </label>
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
          <thead><tr><th>Rank</th><th>School</th><th>Points</th><th>First Place Votes</th><th>Move</th></tr></thead>
          <tbody data-oatccc-rows></tbody>
        </table>
      </div>

      <div class="info-card" style="margin-top:36px;">
        <p class="eyebrow">Podium Watch analysis</p>
        <h2>Reading Between the Lines of Ohio's Preseason Cross Country Polls</h2>
        <p>The coaches released their 2026 preseason rankings this week. A look back at who actually won last November explains most of what's on the ballot, and exposes a few places where the voting hasn't caught up to reality.</p>
        <a class="button button-primary" href="/stories/2026-oatccc-preseason-poll-analysis/">Read the full analysis ${icon("arrow")}</a>
      </div>
    </div>
  </section>

  <script type="application/json" data-oatccc-data>${JSON.stringify({ weeks: weeksForClient, latestWeekIndex }).replaceAll("<", "\\u003c")}</script>
  <script>(()=>{
    const dataEl = document.querySelector('[data-oatccc-data]');
    const data = JSON.parse(dataEl.textContent);
    const rowsEl = document.querySelector('[data-oatccc-rows]');
    const headingEl = document.querySelector('[data-oatccc-heading]');
    const dateEl = document.querySelector('[data-oatccc-poll-date]');
    const divisionSelect = document.querySelector('[data-oatccc-division]');
    const weekSelect = document.querySelector('[data-oatccc-week]');
    const genderButtons = Array.from(document.querySelectorAll('[data-oatccc-gender]'));
    const labels = { 1: 'Division I', 2: 'Division II', 3: 'Division III', 4: 'Division IV' };
    let gender = 'boys';

    // A fresh visit always lands on the most recent poll -- the LAST
    // entry in data.weeks -- per the same "click the link, land on the
    // current poll" requirement that drove this whole feature.
    weekSelect.innerHTML = data.weeks.map((week, index) =>
      '<option value="' + index + '"' + (index === data.latestWeekIndex ? ' selected' : '') + '>' + escapeHtml(week.pollLabel) + '</option>'
    ).join('');
    let weekIndex = data.latestWeekIndex;

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // A rank like "25'" is still real rank 25 for movement math -- the
    // mark is OATCCC's own notation, not a different number. Returns
    // null (never guessed) for anything with no real leading integer.
    function numericRank(rank) {
      if (typeof rank === 'number') return rank;
      const parsed = parseInt(rank, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }

    function moveCellHtml(currentRank, previousRows, school) {
      if (!previousRows) return '';
      const previousRow = previousRows.find((row) => row.school === school);
      if (!previousRow) return '';
      const currentNum = numericRank(currentRank);
      const previousNum = numericRank(previousRow.rank);
      if (currentNum === null || previousNum === null) return '';
      const diff = previousNum - currentNum;
      if (diff === 0) return '<span class="oatccc-move-none">--</span>';
      if (diff > 0) return '<span class="oatccc-move-up">\u25B2' + diff + '</span>';
      return '<span class="oatccc-move-down">\u25BC' + Math.abs(diff) + '</span>';
    }

    function draw() {
      const division = divisionSelect.value;
      const week = data.weeks[weekIndex];
      const rows = (week.divisions[gender] && week.divisions[gender][division]) || [];
      const previousWeek = weekIndex > 0 ? data.weeks[weekIndex - 1] : null;
      const previousRows = previousWeek ? ((previousWeek.divisions[gender] && previousWeek.divisions[gender][division]) || []) : null;

      headingEl.textContent = (gender === 'boys' ? 'Boys' : 'Girls') + ' ' + labels[division];
      dateEl.textContent = week.pollLabel + ' \u00b7 ' + week.pollDateText;
      rowsEl.innerHTML = rows.map((row) => (
        '<tr>' +
          '<td class="oatccc-cell-rank">' + (row.rank != null ? escapeHtml(row.rank) : '--') + '</td>' +
          '<td class="oatccc-cell-school">' + escapeHtml(row.school) + '</td>' +
          '<td class="oatccc-cell-num">' + (row.points != null ? escapeHtml(row.points) : '--') + '</td>' +
          '<td class="oatccc-cell-num">' + (row.first_place_votes != null ? escapeHtml(row.first_place_votes) : '--') + '</td>' +
          '<td class="oatccc-cell-move">' + moveCellHtml(row.rank, previousRows, row.school) + '</td>' +
        '</tr>'
      )).join('');
    }

    genderButtons.forEach((button) => button.addEventListener('click', () => {
      gender = button.dataset.oatcccGender;
      genderButtons.forEach((item) => item.classList.toggle('active', item === button));
      draw();
    }));
    divisionSelect.addEventListener('change', draw);
    weekSelect.addEventListener('change', () => { weekIndex = Number(weekSelect.value); draw(); });
    draw();
  })();</script>

  <script src="/scripts/page-view.js" defer></script>`;

  return layout({
    site,
    title,
    description: `The official 2026 OATCCC cross country coaches poll -- all eight polls, boys and girls Divisions I through IV -- shared with full credit to the Ohio Association of Track and Cross Country Coaches, with every past poll and week-to-week movement available.`,
    pathname,
    content
  });
}
