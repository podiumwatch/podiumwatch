import { adminShell } from "../lib/adminshell.mjs";
import { escapeHtml } from "../lib/content.mjs";

// Admin: front page lead story (WO-43). Data: api/admin/front-page.js.
// The published story list is built into the page (stories are files);
// choosing one copies its title, summary, photo and credit into the lead.
const styles = `
    .fpa-shell { display:grid; gap:16px; }
    .fpa-form { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; align-items:end; }
    .fpa-form label { display:grid; gap:5px; font-weight:800; font-size:.88rem; }
    .fpa-form input, .fpa-form select { padding:9px 10px; border:1px solid var(--line); border-radius:8px; font:inherit; background:var(--white); min-width:0; }
    .fpa-wide { grid-column:1 / -1; }
    .fpa-picked { display:flex; flex-wrap:wrap; gap:6px; min-height:10px; }
    .fpa-picked button { padding:4px 10px; border:1px solid var(--line); border-radius:999px; background:var(--pale-green); font:inherit; font-size:.8rem; font-weight:800; cursor:pointer; }
    .fpa-results { display:flex; flex-wrap:wrap; gap:6px; }
    .fpa-results button { padding:4px 10px; border:1px dashed var(--line); border-radius:999px; background:var(--white); font:inherit; font-size:.8rem; cursor:pointer; }
    .fpa-card { display:grid; gap:6px; padding:14px; border:1px solid var(--line); background:var(--white); }
    .fpa-card.is-current { border-left:5px solid var(--green); }
    .fpa-card h3 { margin:0; font-size:1.05rem; }
    .fpa-meta { color:var(--muted); font-weight:650; font-size:.85rem; margin:0; }
    .fpa-actions { display:flex; flex-wrap:wrap; gap:8px; }
    .fpa-actions a, .fpa-actions button { padding:6px 12px; border:1px solid var(--line); border-radius:999px; background:var(--white); font:inherit; font-size:.82rem; font-weight:800; cursor:pointer; text-decoration:none; color:inherit; }
    .fpa-list { display:grid; gap:10px; }
    .fpa-log { width:100%; border-collapse:collapse; font-size:.86rem; }
    .fpa-log td, .fpa-log th { padding:6px 8px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
    .fpa-warn { color:#b42318; font-weight:750; font-size:.85rem; margin:0; }
    .fpa-also-rows { display:grid; gap:12px; }
    .fpa-also-row { display:grid; gap:8px; padding:12px; border:1px solid var(--line); background:var(--white); }
    .fpa-also-row > label { display:grid; gap:5px; font-weight:800; font-size:.88rem; }
    .fpa-also-row select, .fpa-also-row input { padding:9px 10px; border:1px solid var(--line); border-radius:8px; font:inherit; background:var(--white); min-width:0; }
`;

export function adminFrontPagePage(site, stories) {
  const storyOptions = stories.map((s) => `<option value="${escapeHtml(s.slug)}">${escapeHtml(s.story_date)} &middot; ${escapeHtml(s.title)}</option>`).join("");
  const content = `<div class="fpa-shell" data-fpa>
    <script type="application/json" data-fpa-stories>${JSON.stringify(stories).replaceAll("<", "\\u003c")}</script>
    <section class="info-card" data-fpa-loading><h2>Checking admin access</h2><p>Please wait.</p></section>
    <div class="fpa-shell" data-fpa-dashboard hidden>
      <section class="info-card"><h2>On the front page now</h2><div data-fpa-current></div></section>
      <section class="info-card">
        <h2>Make front page lead</h2>
        <p>One lead at a time. A lead with a later start takes over when it starts; with no lead set, the newest published story leads. Times are your local time.</p>
        <form class="fpa-form" data-fpa-form>
          <label class="fpa-wide">Story <select name="slug" required><option value="">Choose a published story</option>${storyOptions}</select></label>
          <p class="fpa-warn fpa-wide" data-fpa-story-note hidden></p>
          <label>Kicker <input name="kicker" maxlength="40" placeholder="STATE MEET"></label>
          <label>Start <input name="starts_at" type="datetime-local" required></label>
          <label>End (optional) <input name="ends_at" type="datetime-local"></label>
          <div class="fpa-wide"><label>Featured athletes <input data-fpa-search="athlete" placeholder="Type a name"></label><div class="fpa-results" data-fpa-results="athlete"></div><div class="fpa-picked" data-fpa-picked="athlete"></div></div>
          <div class="fpa-wide"><label>Featured teams <input data-fpa-search="team" placeholder="Type a school"></label><div class="fpa-results" data-fpa-results="team"></div><div class="fpa-picked" data-fpa-picked="team"></div></div>
          <p class="fpa-meta fpa-wide">Featured athletes and teams get "Featured on the Podium Watch front page" on their profiles once the story runs. Pick only people the story is really about.</p>
          <button class="button button-primary" type="submit">Make front page lead</button>
        </form>
      </section>
      <section class="info-card">
        <h2>Also in the front page rotation</h2>
        <p>The homepage lead changes every 8 seconds through 8 stories: the lead above first, then up to 4 stories you pick here (in this order), then the newest stories. Picked stories count as being on the front page: the story gets the date line and a spot in /front-page/, and the athletes and teams you mark as featured get the "Featured on the Podium Watch front page" badge. With no picks, the newest stories fill the rotation.</p>
        <div data-fpa-also-current></div>
        <form class="fpa-form" data-fpa-also-form>
          <div class="fpa-also-rows fpa-wide">${[1, 2, 3, 4].map((n) => `<div class="fpa-also-row" data-fpa-also-row="${n}">
            <label>Story ${n}${n > 1 ? " (optional)" : ""} <select data-fpa-also-slug><option value="">None</option>${storyOptions}</select></label>
            <label>Featured athletes <input data-fpa-search="athlete-${n}" placeholder="Type a name"></label><div class="fpa-results" data-fpa-results="athlete-${n}"></div><div class="fpa-picked" data-fpa-picked="athlete-${n}"></div>
            <label>Featured teams <input data-fpa-search="team-${n}" placeholder="Type a school"></label><div class="fpa-results" data-fpa-results="team-${n}"></div><div class="fpa-picked" data-fpa-picked="team-${n}"></div>
          </div>`).join("")}</div>
          <label>Start <input name="starts_at" type="datetime-local" required></label>
          <label>End (optional) <input name="ends_at" type="datetime-local"></label>
          <div class="fpa-actions fpa-wide"><button class="button button-primary" type="submit">Put these on the front page</button> <button type="button" data-fpa-also-clear>Clear picks (newest stories only)</button></div>
        </form>
      </section>
      <p class="awards-message" data-fpa-message role="status"></p>
      <section class="info-card"><h2>Queue</h2><div class="fpa-list" data-fpa-queue></div></section>
      <section class="info-card"><h2>History</h2><div class="fpa-list" data-fpa-history></div></section>
      <section class="info-card"><h2>Change log</h2><div style="overflow-x:auto"><table class="fpa-log"><thead><tr><th>When</th><th>What</th><th>Story</th><th>Who</th></tr></thead><tbody data-fpa-log></tbody></table></div></section>
    </div>
  </div>`;

  return adminShell({
    site,
    pathname: "/admin/front-page/",
    title: "Front Page",
    description: "Choose the homepage lead story, queue the next ones, and download the front page share cards.",
    heading: "Front Page",
    intro: "Pick the story that leads the homepage, schedule what comes next, and download the ON THE FRONT PAGE share cards.",
    styles,
    content,
    scripts: ["/scripts/admin-front-page.js"]
  });
}
