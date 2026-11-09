import { adminShell } from "../lib/adminshell.mjs";

// Admin: typeable short links (WO-34). Data: api/admin/short-links.js.
const styles = `
    .sl-shell { display:grid; gap:16px; }
    .sl-form { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; align-items:end; }
    .sl-form label { display:grid; gap:5px; font-weight:800; font-size:.88rem; }
    .sl-form input { padding:9px 10px; border:1px solid var(--line); border-radius:8px; font:inherit; }
    .sl-table-wrap { overflow-x:auto; border:1px solid var(--line); background:var(--white); }
    .sl-table { width:100%; min-width:760px; border-collapse:collapse; font-size:.9rem; }
    .sl-table th, .sl-table td { padding:9px 10px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
    .sl-table th { background:#111; color:#fff; font-size:.72rem; letter-spacing:.06em; text-transform:uppercase; }
    .sl-bars { display:flex; gap:2px; align-items:flex-end; height:28px; }
    .sl-bars span { width:7px; background:#0faf68; min-height:1px; }
    .sl-off { color:var(--muted); }
    .sl-table button { padding:5px 11px; border:1px solid var(--line); border-radius:999px; background:var(--white); font:inherit; font-size:.8rem; font-weight:800; cursor:pointer; }
`;

export function adminShortLinksPage(site) {
  const content = `<div class="sl-shell" data-sl>
    <section class="info-card" data-sl-loading><h2>Checking admin access</h2><p>Please wait.</p></section>
    <div class="sl-shell" data-sl-dashboard hidden>
      <section class="info-card">
        <h2>Add or edit a short link</h2>
        <p>Type an existing path to change where it points. Short links answer with a temporary redirect, so a path can be pointed somewhere new next season.</p>
        <form class="sl-form" data-sl-form>
          <label>Path <input name="path" required maxlength="40" placeholder="state" pattern="[a-z0-9][a-z0-9-]{0,39}"></label>
          <label>Goes to <input name="destination" required placeholder="/state/2026/"></label>
          <label>Label <input name="label" maxlength="120" placeholder="2026 State hub"></label>
          <label>Campaign <input name="campaign" maxlength="80" placeholder="xc-wrapup-2026"></label>
          <button class="button button-primary" type="submit">Save</button>
        </form>
      </section>
      <p class="awards-message" data-sl-message role="status"></p>
      <div class="sl-table-wrap"><table class="sl-table"><thead><tr><th>Path</th><th>Goes to</th><th>Label</th><th>Hits (14 days)</th><th>Per day</th><th></th></tr></thead><tbody data-sl-rows></tbody></table></div>
    </div>
  </div>`;

  return adminShell({
    site,
    pathname: "/admin/short-links/",
    title: "Short Links",
    description: "Typeable short links like podiumwatch.org/state and their hits.",
    heading: "Short Links",
    intro: "Short paths for graphics and captions, like podiumwatch.org/state. Each one logs a hit (no personal data) and can be paused or repointed any time.",
    styles,
    content,
    scripts: ["/scripts/admin-short-links.js"]
  });
}
