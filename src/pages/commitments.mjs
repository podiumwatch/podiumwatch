import { layout, pageHero } from "../lib/html.mjs";
import { commitmentRowHtml, filterOptionsHtml } from "../lib/commitment_rows.mjs";

// College commitment tracker, one page per class (WO-38). Rows come from
// /api/commitments/?class=YYYY (public, sourced commitments only) and are
// filtered in the browser by level and event group. Every row links to
// the athlete's profile and to its public source.
const styles = `
  .cm-shell { display:grid; gap:18px; max-width:880px; margin:0 auto; }
  .cm-filters { display:flex; flex-wrap:wrap; gap:10px; align-items:end; }
  .cm-filters label { display:grid; gap:5px; font-weight:800; font-size:.88rem; }
  .cm-filters select { padding:9px 10px; border:1px solid var(--line); border-radius:8px; font:inherit; background:var(--white); }
  .cm-list { display:grid; gap:10px; margin:0; padding:0; list-style:none; }
  .cm-row { display:grid; grid-template-columns:1fr auto; gap:6px 14px; padding:14px 16px; border:1px solid var(--line); border-left:5px solid var(--green); background:var(--white); }
  .cm-row.is-girls { border-left-color:#EC4899; }
  .cm-row b { font-size:1.05rem; }
  .cm-row small { color:var(--muted); font-weight:650; }
  .cm-college { font-weight:850; }
  .cm-meta { grid-column:1 / -1; display:flex; flex-wrap:wrap; gap:4px 12px; color:var(--muted); font-size:.86rem; font-weight:650; }
  .cm-empty { color:var(--muted); font-weight:650; }
  .cm-cta { display:flex; flex-wrap:wrap; gap:10px; }
  .cm-tabs { display:flex; flex-wrap:wrap; gap:8px; }
  .cm-tabs a { padding:8px 14px; border:1px solid var(--line); border-radius:999px; background:var(--white); font-weight:800; text-decoration:none; color:inherit; }
  .cm-tabs a[aria-current="page"] { background:var(--green); color:#fff; border-color:var(--green); }
  @media (max-width:560px) { .cm-row { grid-template-columns:1fr; } }
`;

// Rendered on the server by api/pages/commitments.js with the class's
// rows in the HTML; the browser only filters them.
export function commitmentsPage(site, classYear, allYears, rows = []) {
  const pathname = `/commitments/${classYear}/`;
  const options = filterOptionsHtml(rows);
  const content = `<style>${styles}</style>
  ${pageHero({
    eyebrow: "College commitments",
    title: `Class of ${classYear} Commitments`,
    description: `Ohio cross country and track athletes in the class of ${classYear} who have committed to run in college. Every listing links to its public announcement.`
  })}
  <section class="section section-paper"><div class="container cm-shell" data-commitments data-class-year="${classYear}">
    <nav class="cm-tabs" aria-label="Class year">${allYears.map((year) => `<a href="/commitments/${year}/"${year === classYear ? ' aria-current="page"' : ""}>Class of ${year}</a>`).join("")}</nav>
    <div class="cm-filters">
      <label>Level <select data-cm-level>${options.levels}</select></label>
      <label>Event group <select data-cm-event>${options.events}</select></label>
      <p class="cm-count" data-cm-count role="status">${rows.length} commitment${rows.length === 1 ? "" : "s"}</p>
    </div>
    <ul class="cm-list" data-cm-list>${rows.length ? rows.map(commitmentRowHtml).join("") : `<li class="cm-empty">No commitments listed for the class of ${classYear} yet.</li>`}</ul>
    <div class="info-card">
      <h2>Missing a commitment?</h2>
      <p>Athletes, parents and coaches can report one. Podium Watch lists it once it's confirmed by a public source, like the college's announcement, a coach's post or the athlete's own post. No source, no listing.</p>
      <div class="cm-cta"><a class="button button-primary" href="/recruiting/submit-activity/">Report a commitment</a></div>
    </div>
  </div></section>
  <script src="/scripts/commitments.js" defer></script>`;

  return layout({
    site,
    title: `Class of ${classYear} College Commitments`,
    description: `Ohio high school cross country and track athletes in the class of ${classYear} committed to run in college, each with its public announcement.`,
    pathname,
    content
  });
}

