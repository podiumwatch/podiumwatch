import { adminShell } from "../lib/adminshell.mjs";

// Admin: Logo Review (WO-11). Data: api/admin/team-logos.js.
const styles = `
  .lr-shell { display:grid; gap:16px; }
  .lr-coverage { font-weight:850; margin:0; }
  .lr-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); gap:10px; }
  .lr-card { display:grid; gap:6px; align-content:start; padding:10px; border:1px solid var(--line); border-radius:10px; background:var(--white); }
  .lr-card img { width:96px; height:96px; object-fit:contain; background:repeating-conic-gradient(#f1f1f1 0 25%, #fff 0 50%) 50% / 16px 16px; border-radius:6px; }
  .lr-card small { color:var(--muted); font-weight:650; overflow-wrap:anywhere; }
  .lr-card b { font-size:.92rem; }
  .lr-card button, .lr-pick button { padding:5px 10px; border:1px solid var(--line); border-radius:999px; background:var(--white); font:inherit; font-size:.8rem; font-weight:800; cursor:pointer; }
  .lr-card .is-done { color:#063d28; font-weight:850; }
  .lr-pick { display:flex; flex-wrap:wrap; gap:6px; }
  .lr-pick input { width:100%; padding:7px 9px; border:1px solid var(--line); border-radius:8px; font:inherit; font-size:.85rem; box-sizing:border-box; }
  .lr-list { margin:0; padding-left:18px; columns:2 260px; }
  .lr-list li { break-inside:avoid; }
`;

export function adminTeamLogosPage(site) {
  const content = `<div class="lr-shell" data-lr>
    <section class="info-card" data-lr-loading><h2>Checking admin access</h2><p>Please wait.</p></section>
    <div class="lr-shell" data-lr-dashboard hidden>
      <section class="info-card"><h2>Coverage</h2><p class="lr-coverage" data-lr-coverage></p><p class="awards-message" data-lr-message role="status"></p></section>
      <section class="info-card"><h2>To review</h2><p>Map names that matched no school, or more than one. Pick the right school and assign in one click. Nothing is assigned automatically.</p><div class="lr-grid" data-lr-review></div></section>
      <section class="info-card"><h2>Files no school uses</h2><p>Logo files nobody's name pointed to. Assign one if you recognize it.</p><div class="lr-grid" data-lr-unused></div></section>
      <section class="info-card"><h2>Teams with no logo</h2><p>2026 state meet teams first.</p><ul class="lr-list" data-lr-without></ul></section>
      <section class="info-card"><h2>Missing and unconvertible files</h2><p>Named in logo_map.json but not in the folder, or in a format that can't be converted. Send these files to add them.</p><ul class="lr-list" data-lr-missing></ul></section>
    </div>
  </div>`;
  return adminShell({
    site,
    pathname: "/admin/team-logos/",
    title: "Logo Review",
    description: "School logos: coverage, files to review and assign, teams without a logo, missing files.",
    heading: "Logo Review",
    intro: "School logos on team pages and results. Matched logos are already live. Review the ones that need a person: pick the school and assign it in one click. Every assignment is logged.",
    styles,
    content,
    scripts: ["/scripts/admin-team-logos.js"]
  });
}
