import { layout, pageHero } from "../lib/html.mjs";

const STATUS_LABELS = {
  needs_revision: "Needs Revision",
  draft: "Drafts",
  submitted: "Submitted, Awaiting Review",
  approved: "Approved",
  published: "Published",
  archived: "Archived"
};
const STATUS_ORDER = ["needs_revision", "draft", "submitted", "approved", "published", "archived"];

const styles = `
    .writer-portal-shell { display:grid; gap:24px; }
    .writer-portal-nav { display:flex; flex-wrap:wrap; gap:10px; }
    .writer-status-group { margin-top: 22px; }
    .writer-status-group:first-child { margin-top: 0; }
    .writer-status-label { font-weight: 900; text-transform: uppercase; letter-spacing: .04em; font-size: .78rem; color: var(--muted); margin-bottom: 10px; }
    .writer-article-row { display:flex; justify-content:space-between; gap:14px; padding:12px 14px; border:1px solid rgba(var(--black-rgb),.12); border-radius:9px; margin-bottom:8px; color: inherit; text-decoration: none; }
    .writer-article-row:hover { border-color: var(--green); background: rgba(var(--green-rgb),.06); }
    .writer-empty { padding:12px 14px; color: var(--muted); font-weight: 600; }
    .writer-attention-banner { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px; padding:16px 18px; border-radius:10px; background:rgba(230,167,0,.14); border-left:4px solid #e6a700; font-weight:800; }
    .writer-attention-banner[data-tone="success"] { background:rgba(var(--green-rgb),.13); border-left-color:var(--green); }
    .writer-assignment-row { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:flex-start; gap:12px; padding:14px; border:1px solid rgba(var(--black-rgb),.12); border-radius:9px; margin-bottom:8px; }
    .writer-assignment-main { min-width:0; }
    .writer-assignment-title { font-weight:800; }
    .writer-assignment-meta { color: var(--muted); font-size: .85rem; margin-top: 2px; }
    .writer-assignment-notes { font-size: .88rem; margin-top: 6px; color: var(--ink); }
    .writer-assignment-due { font-weight: 800; }
    .writer-assignment-due[data-overdue="true"] { color: #c0392b; }
`;

// Writer Portal dashboard shell (Stage 1): lists the signed-in writer's
// own articles grouped by status. Always shows empty groups for now --
// Stage 2 adds the actual writing editor that creates articles.
export function writerPortalPage(site) {
  const groups = STATUS_ORDER.map((status) => `
      <div class="writer-status-group" data-writer-status-group="${status}">
        <p class="writer-status-label">${STATUS_LABELS[status]}</p>
        <div data-writer-status-list></div>
      </div>`).join("");

  const content = `${pageHero({
    eyebrow: "Podium Watch Writer Portal",
    title: "Your articles.",
    description: "Everything you've written for Podium Watch, grouped by where it stands."
  })}

  <style>${styles}</style>

  <section class="section section-paper">
    <div class="container writer-portal-shell" data-writer-portal-loading>
      <div class="info-card"><h2>Loading your Writer Portal account</h2><p>Please wait.</p></div>
    </div>

    <div class="container writer-portal-shell" data-writer-portal-root hidden>
      <div class="writer-portal-nav">
        <a class="button button-outline" href="/writer-portal/profile/">Your profile</a>
        <a class="button button-outline" href="/writer-portal/calendar/">Editorial calendar</a>
        <a class="button button-outline" href="/writer-portal/style-guide/">Style guide</a>
        <a class="button button-outline" href="/writer-portal/admin/review/" data-writer-admin-link hidden>Review queue</a>
        <a class="button button-outline" href="/writer-portal/admin/" data-writer-admin-link hidden>Manage writers</a>
        <button class="button button-outline" type="button" data-writer-sign-out>Sign out</button>
      </div>

      <div class="writer-attention-banner" data-writer-attention-banner hidden>
        <span data-writer-attention-text></span>
        <a class="button button-dark" data-writer-attention-link href="/writer-portal/write/">Fix it now</a>
      </div>

      <section class="info-card" data-writer-assignments-card hidden>
        <p class="eyebrow">Assigned to you</p>
        <h2>Your assignments</h2>
        <div data-writer-assignments-list></div>
      </section>

      <section class="info-card">
        <p class="eyebrow">Welcome</p>
        <h2 data-writer-welcome>Your articles</h2>
        <a class="button button-primary" href="/writer-portal/write/">New Article</a>
        ${groups}
      </section>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/writer-auth-client.js" defer></script>
  <script src="/scripts/writer-portal.js" defer></script>`;

  return layout({
    site,
    title: "Writer Portal",
    description: "Podium Watch Writer Portal dashboard.",
    pathname: "/writer-portal/",
    content
  });
}
