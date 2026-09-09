import { layout, pageHero } from "../lib/html.mjs";

const styles = `
    .writer-cal-shell { display:grid; gap:20px; }
    .writer-cal-top { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px; }
    .writer-cal-nav { display:flex; align-items:center; gap:12px; }
    .writer-cal-nav button { padding:8px 14px; }
    .writer-cal-month-label { font-weight:900; font-size:1.15rem; min-width:170px; text-align:center; }
    .writer-cal-grid { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:1px; background:rgba(var(--black-rgb),.12); border:1px solid rgba(var(--black-rgb),.12); border-radius:10px; overflow:hidden; }
    .writer-cal-weekday { padding:8px; background:var(--black); color:var(--white); font-size:.7rem; font-weight:900; text-transform:uppercase; text-align:center; }
    .writer-cal-day { min-height:96px; padding:6px; background:var(--white); display:flex; flex-direction:column; gap:4px; }
    .writer-cal-day[data-outside="true"] { background:#f7f7f5; color:var(--muted); }
    .writer-cal-day-number { font-size:.78rem; font-weight:800; }
    .writer-cal-idea-chip { display:block; width:100%; padding:3px 6px; border-radius:5px; background:rgba(var(--green-rgb),.16); font-size:.72rem; font-weight:700; text-align:left; border:0; cursor:pointer; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .writer-cal-idea-chip[data-mine="true"] { background: var(--green); color: var(--black); }
    .writer-cal-unscheduled { display:grid; gap:8px; }
    .writer-cal-form { display:grid; gap:10px; max-width:520px; }
    .writer-cal-form label { display:grid; gap:5px; font-weight:800; font-size:.88rem; }
    .writer-cal-form input, .writer-cal-form select, .writer-cal-form textarea { padding:9px 10px; border:1px solid rgba(var(--black-rgb),.22); border-radius:8px; font:inherit; }
    .writer-cal-panel { position:fixed; inset:0; background:rgba(0,0,0,.45); display:flex; align-items:flex-start; justify-content:center; padding:40px 16px; overflow:auto; z-index:50; }
    .writer-cal-panel-card { background:var(--white); border-radius:14px; padding:24px; max-width:520px; width:100%; display:grid; gap:14px; }
    .writer-cal-panel-actions { display:flex; flex-wrap:wrap; gap:8px; }
    .writer-cal-message { padding:10px 14px; border-radius:9px; font-weight:700; }
    .writer-cal-message[data-tone="error"] { background:rgba(220,38,38,.12); color:#7a1414; }
    .writer-cal-message[data-tone="success"] { background:rgba(var(--green-rgb),.13); color:var(--green-ink); }
    @media (max-width:760px) {
      .writer-cal-day { min-height:64px; }
      .writer-cal-weekday { font-size:.6rem; }
    }
`;

const CATEGORY_OPTIONS = [
  ["", "No category"],
  ["race_recap", "Race Recap"],
  ["meet_preview", "Meet Preview"],
  ["feature", "Feature"],
  ["rankings_polls", "Rankings & Polls"],
  ["recruiting", "Recruiting"],
  ["other", "Other"]
];

export function writerPortalCalendarPage(site) {
  const categoryOptions = CATEGORY_OPTIONS.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");

  const content = `${pageHero({
    eyebrow: "Podium Watch Writer Portal",
    title: "Editorial calendar.",
    description: "Story ideas by target date. Claim an open idea, or start writing from one already assigned to you."
  })}

  <style>${styles}</style>

  <section class="section section-paper">
    <div class="container writer-cal-shell" data-writer-cal-loading>
      <div class="info-card"><h2>Loading the calendar</h2><p>Please wait.</p></div>
    </div>

    <div class="container writer-cal-shell" data-writer-cal-root hidden>
      <div class="writer-cal-top">
        <a class="button button-outline" href="/writer-portal/">Back to your articles</a>
        <button class="button button-primary" type="button" data-writer-cal-add hidden>Add story idea</button>
      </div>

      <div class="writer-cal-nav">
        <button class="button button-outline" type="button" data-writer-cal-prev>&larr; Previous</button>
        <span class="writer-cal-month-label" data-writer-cal-month-label></span>
        <button class="button button-outline" type="button" data-writer-cal-next>Next &rarr;</button>
      </div>

      <div class="writer-cal-grid" data-writer-cal-grid></div>

      <section class="info-card" data-writer-cal-unscheduled-section hidden>
        <h3>No target date</h3>
        <div class="writer-cal-unscheduled" data-writer-cal-unscheduled></div>
      </section>
    </div>
  </section>

  <div class="writer-cal-panel" data-writer-cal-form-panel hidden>
    <div class="writer-cal-panel-card">
      <h2 data-writer-cal-form-title>Add story idea</h2>
      <form class="writer-cal-form" data-writer-cal-form>
        <input type="hidden" name="idea_id">
        <label>Title<input type="text" name="title" required maxlength="300"></label>
        <label>Description<textarea name="description" maxlength="2000" rows="3"></textarea></label>
        <label>Category<select name="category">${categoryOptions}</select></label>
        <label>Target date <span style="font-weight:500;color:var(--muted);">(optional)</span><input type="date" name="target_date"></label>
        <label>Assign to <span style="font-weight:500;color:var(--muted);">(optional -- leave open for any writer to claim)</span>
          <select name="assigned_to" data-writer-cal-assignee-select><option value="">Open (unassigned)</option></select>
        </label>
        <p class="writer-cal-message" data-writer-cal-form-message role="status" hidden></p>
        <div class="writer-cal-panel-actions">
          <button class="button button-primary" type="submit">Save</button>
          <button class="button button-outline" type="button" data-writer-cal-delete hidden>Delete</button>
          <button class="button button-outline" type="button" data-writer-cal-cancel>Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <div class="writer-cal-panel" data-writer-cal-detail-panel hidden>
    <div class="writer-cal-panel-card">
      <p class="eyebrow" data-writer-cal-detail-category></p>
      <h2 data-writer-cal-detail-title></h2>
      <p data-writer-cal-detail-description></p>
      <p style="color:var(--muted);font-weight:700;" data-writer-cal-detail-meta></p>
      <p class="writer-cal-message" data-writer-cal-detail-message role="status" hidden></p>
      <div class="writer-cal-panel-actions" data-writer-cal-detail-actions></div>
      <button class="button button-outline" type="button" data-writer-cal-detail-close>Close</button>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/writer-auth-client.js" defer></script>
  <script src="/scripts/writer-portal-calendar.js" defer></script>`;

  return layout({
    site,
    title: "Editorial Calendar",
    description: "Podium Watch Writer Portal editorial calendar.",
    pathname: "/writer-portal/calendar/",
    content
  });
}
