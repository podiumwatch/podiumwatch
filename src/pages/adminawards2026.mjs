import { adminShell } from "../lib/adminshell.mjs";

// Admin for the 2026 Athlete/Team of the Year: every category's nominees
// ranked by nomination count, with their reasons, a delete button for test
// entries, and a CSV export. Data: api/admin/awards-2026.js.
const styles = `
    .yoya-shell { display:grid; gap:16px; }
    .yoya-bar { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
    .yoya-bar select { padding:9px 10px; border:1px solid var(--line); border-radius:8px; font:inherit; }
    .yoya-cat { padding:16px; border:1px solid var(--line); background:var(--white); }
    .yoya-cat h2 { margin:0; font-size:1.1rem; }
    .yoya-meta { margin:4px 0 10px; color:var(--muted); font-weight:700; font-size:.88rem; }
    .yoya-nominee { padding:10px 0; border-top:1px solid var(--line); }
    .yoya-nominee summary { display:flex; flex-wrap:wrap; gap:6px 12px; align-items:baseline; cursor:pointer; }
    .yoya-nominee summary b { font-variant-numeric:tabular-nums; }
    .yoya-nominee small { color:var(--muted); font-weight:600; }
    .yoya-reasons { display:grid; gap:6px; margin:8px 0 0; padding:0; list-style:none; }
    .yoya-reasons li { display:flex; justify-content:space-between; gap:10px; padding:8px; background:rgba(var(--black-rgb),.04); font-size:.9rem; }
    .yoya-reasons button { flex:0 0 auto; padding:4px 10px; border:1px solid #b42318; border-radius:999px; background:var(--white); color:#b42318; font:inherit; font-size:.8rem; font-weight:800; cursor:pointer; }
    .yoya-empty { margin:0; color:var(--muted); font-weight:600; }
`;

export function adminAwards2026Page(site) {
  const content = `<div class="yoya-shell" data-yoya>
    <section class="info-card" data-yoya-loading><h2>Checking admin access</h2><p>Please wait.</p></section>
    <div class="yoya-shell" data-yoya-dashboard hidden>
      <div class="yoya-bar">
        <select data-yoya-filter><option value="">All categories</option></select>
        <button class="button button-secondary" type="button" data-yoya-refresh>Refresh</button>
        <button class="button button-primary" type="button" data-yoya-csv>Download CSV</button>
        <a class="button button-secondary" href="/awards/2026/" target="_blank" rel="noopener">Public hub</a>
      </div>
      <p class="awards-message" data-yoya-message role="status"></p>
      <div class="yoya-shell" data-yoya-list></div>
    </div>
  </div>`;

  return adminShell({
    site,
    pathname: "/admin/awards/2026/",
    title: "2026 Athlete, Team and Coach of the Year Admin",
    description: "Review 2026 Athlete, Team and Coach of the Year nominations.",
    heading: "2026 Athlete, Team and Coach of the Year",
    intro: "Nominees for each category, ranked by how many times they were nominated, with every reason. Coach nominees are grouped by school, with every coach name nominators typed. Delete test entries here. Finalists and voting come next.",
    styles,
    content,
    scripts: ["/scripts/admin-awards-2026.js"]
  });
}
