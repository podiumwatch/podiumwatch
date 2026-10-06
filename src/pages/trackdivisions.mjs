import { layout, pageHero, breadcrumb } from "../lib/html.mjs";
import trackData from "../data/track-divisions-2027-28.json" with { type: "json" };

const DIVISIONS = [1, 2, 3, 4, 5];

const TRACK_CSS = `
.td-tabs { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 20px; }
.td-tabs a { padding:9px 16px; border:1px solid var(--line); border-radius:999px; background:var(--white); color:var(--ink); font-weight:700; text-decoration:none; }
.td-tabs a:hover { background:var(--pale-green); }
.td-search { display:block; width:100%; max-width:420px; margin:0 0 24px; padding:12px 14px; border:1px solid var(--line); border-radius:10px; font:inherit; background:var(--white); }
.td-block { margin:0 0 40px; }
.td-block > h2 { margin:0 0 6px; font-size:1.5rem; }
.td-block > p { margin:0 0 14px; color:var(--muted); font-size:.92rem; }
.td-table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:12px; background:var(--white); }
.td-table { width:100%; border-collapse:collapse; font-size:.92rem; }
.td-table th, .td-table td { padding:10px 12px; text-align:left; border-bottom:1px solid var(--line); vertical-align:top; }
.td-table th { background:var(--green); color:#fff; font-size:.8rem; letter-spacing:.04em; text-transform:uppercase; position:sticky; top:0; }
.td-table td.num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
.td-table tr:last-child td { border-bottom:0; }
.td-moved { color:#b45309; font-weight:700; }
.td-hidden { display:none !important; }
`;

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
const escape = escapeHtml;

function rowsFor(gender, division) {
  return trackData.rows
    .filter((row) => row.sport === gender && row.division2026_27 === String(division))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function divisionTable(gender, division) {
  const rows = rowsFor(gender, division);
  const body = rows.map((row) => {
    const moved = row.division2025_26 && row.division2025_26 !== row.division2026_27;
    return `<tr data-search="${escape(`${row.name} ${row.city} ${row.district}`.toLowerCase())}"><td><strong>${escape(row.name)}</strong></td><td>${escape(row.city)}</td><td>${escape(row.district)}</td><td class="num">${escape(row.enrollment)}</td><td class="${moved ? "td-moved" : ""}">${row.division2025_26 ? `Division ${escape(row.division2025_26)}` : "Not listed"}</td></tr>`;
  }).join("");
  return `<section class="td-block" id="${gender}-${division}" aria-labelledby="${gender}-${division}-title"><h2 id="${gender}-${division}-title">${gender === "boys" ? "Boys" : "Girls"} Division ${division}</h2><p>${rows.length} school${rows.length === 1 ? "" : "s"} for 2026-27 and 2027-28.</p><div class="td-table-wrap"><table class="td-table"><thead><tr><th>School</th><th>City</th><th>District</th><th>Enrollment</th><th>2025-26</th></tr></thead><tbody>${body}</tbody></table></div></section>`;
}

export function trackDivisionsPage(site) {
  const pathname = "/track-divisions/";
  const title = "Track Divisions 2026-27 and 2027-28";
  const jump = ["boys", "girls"].flatMap((gender) => DIVISIONS.map((d) => `<a href="#${gender}-${d}">${gender === "boys" ? "Boys" : "Girls"} D${d}</a>`)).join("");
  const sections = ["boys", "girls"].flatMap((gender) => DIVISIONS.map((d) => divisionTable(gender, d))).join("");

  const content = `${pageHero({
    eyebrow: "OHSAA 2026-27 and 2027-28",
    title: "Track and Field Divisions",
    description: "Official OHSAA track and field division assignments for the 2026-27 and 2027-28 seasons, for boys and girls across Divisions I through V."
  })}
  <style>${TRACK_CSS}</style>
  <section class="section section-paper" aria-labelledby="td-title">
    <div class="container">
      ${breadcrumb([{ label: "Home", href: "/" }, { label: "Track Divisions" }])}
      <p class="mr-projection-note">Source: OHSAA Girls and Boys Track and Field Divisional Alignments. Schools highlighted in orange moved division since 2025-26.</p>
      <h2 id="td-title" class="visually-hidden">Track and field divisions</h2>
      <nav class="td-tabs" aria-label="Jump to division">${jump}</nav>
      <input class="td-search" type="search" placeholder="Search a school, city, or district" aria-label="Search schools" data-td-search>
      <p data-td-empty hidden>No schools match that search.</p>
      ${sections}
    </div>
  </section>
  <script>(()=>{const input=document.querySelector('[data-td-search]');const empty=document.querySelector('[data-td-empty]');if(!input)return;input.addEventListener('input',()=>{const q=input.value.trim().toLowerCase();let shown=0;document.querySelectorAll('tbody tr[data-search]').forEach(tr=>{const match=!q||tr.dataset.search.includes(q);tr.classList.toggle('td-hidden',!match);if(match)shown++;});document.querySelectorAll('.td-block').forEach(block=>{const any=block.querySelector('tbody tr:not(.td-hidden)');block.classList.toggle('td-hidden',!any);});if(empty)empty.hidden=shown>0;});})();</script>`;

  return layout({
    site,
    title,
    description: "Official OHSAA track and field division assignments for boys and girls, 2026-27 and 2027-28.",
    pathname,
    content
  });
}
