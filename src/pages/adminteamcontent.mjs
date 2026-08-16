import { adminShell } from "../lib/adminshell.mjs";

const styles = `
    .admin-content-shell {
      display: grid;
      gap: 28px;
    }

    .admin-content-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 14px;
    }

    .admin-content-summary-card {
      padding: 18px;
      border-radius: 13px;
      background: rgba(15, 23, 42, 0.05);
    }

    .admin-content-summary-card strong {
      display: block;
      font-size: 1.8rem;
      line-height: 1;
    }

    .admin-content-summary-card span {
      display: block;
      margin-top: 8px;
      font-weight: 750;
    }

    .admin-content-actions,
    .admin-content-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
      align-items: center;
    }

    .admin-content-search {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: end;
    }

    .admin-content-search label {
      display: block;
    }

    .admin-content-search input {
      display: block;
      width: 100%;
      margin-top: 7px;
      padding: 12px;
      border: 1px solid rgba(15, 23, 42, 0.2);
      border-radius: 9px;
      background: #ffffff;
      font: inherit;
    }

    .admin-content-team-list,
    .admin-content-recent-list {
      display: grid;
      gap: 16px;
    }

    .admin-content-team-card,
    .admin-content-recent-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 20px;
      padding: 20px;
      border: 1px solid rgba(15, 23, 42, 0.14);
      border-radius: 14px;
      background: #ffffff;
    }

    .admin-content-team-card h3,
    .admin-content-team-card p,
    .admin-content-recent-card h3,
    .admin-content-recent-card p {
      margin: 0;
    }

    .admin-content-team-card p,
    .admin-content-recent-card p {
      margin-top: 7px;
    }

    .admin-content-badge {
      display: inline-flex;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(0, 191, 99, 0.14);
      font-size: 0.78rem;
      font-weight: 850;
    }

    .admin-content-badge-dark {
      background: #111827;
      color: #ffffff;
    }

    .admin-content-badge-danger {
      background: rgba(220, 38, 38, 0.14);
      color: #991b1b;
    }

    .admin-content-message {
      padding: 14px 16px;
      border-radius: 10px;
      background: rgba(0, 191, 99, 0.1);
    }

    .admin-content-empty {
      padding: 28px;
      text-align: center;
    }

    @media (max-width: 720px) {
      .admin-content-search,
      .admin-content-team-card,
      .admin-content-recent-card {
        grid-template-columns: 1fr;
      }

      .admin-content-actions {
        display: grid;
      }

      .admin-content-actions .button,
      .admin-content-search .button {
        width: 100%;
        justify-content: center;
      }
    }
`;

export function adminTeamContentPage(site) {
  const content = `<div class="info-card" data-admin-content-loading>
    <h2>Checking admin access</h2>
    <p>Podium Watch is loading the Team Content Manager.</p>
  </div>

  <div class="admin-content-shell" data-admin-content hidden>
    <p class="admin-content-message" data-admin-content-message aria-live="polite" hidden></p>

    <section class="info-card">
      <p class="eyebrow">Content totals</p>
      <h2>Publishing overview</h2>

      <div class="admin-content-summary">
        <div class="admin-content-summary-card"><strong data-admin-content-total>0</strong><span>Total items</span></div>
        <div class="admin-content-summary-card"><strong data-admin-content-published>0</strong><span>Published</span></div>
        <div class="admin-content-summary-card"><strong data-admin-content-draft>0</strong><span>Drafts</span></div>
        <div class="admin-content-summary-card"><strong data-admin-content-featured>0</strong><span>Featured</span></div>
        <div class="admin-content-summary-card"><strong data-admin-content-suspended>0</strong><span>Hidden</span></div>
        <div class="admin-content-summary-card"><strong data-admin-content-locked>0</strong><span>Admin locked</span></div>
      </div>
    </section>

    <section class="info-card">
      <p class="eyebrow">Find a program</p>
      <h2>Open any team's Content Hub</h2>

      <form class="admin-content-search" data-admin-content-search-form>
        <label>
          <strong>School, city, mascot, conference, or page address</strong>
          <input type="search" name="search" placeholder="Search team profiles">
        </label>
        <button class="button button-primary" type="submit">Search teams</button>
      </form>

      <div class="admin-content-team-list" data-admin-content-team-list style="margin-top:20px;"></div>
      <div class="admin-content-empty" data-admin-content-team-empty hidden>
        <h3>No teams found</h3>
        <p>Try a different school, city, mascot, or conference.</p>
      </div>
    </section>

    <section class="info-card">
      <p class="eyebrow">Recently changed</p>
      <h2>Latest team content</h2>
      <div class="admin-content-recent-list" data-admin-content-recent-list></div>
      <div class="admin-content-empty" data-admin-content-recent-empty hidden>
        <h3>No team content yet</h3>
        <p>New announcements, results, achievements, media, and coverage will appear here.</p>
      </div>
    </section>
  </div>`;

  return adminShell({
    site,
    pathname: "/admin/team-content/",
    title: "Admin Team Content Manager",
    description: "Review and manage announcements, results, achievements, media, recruiting information, and Podium Watch coverage for every team.",
    heading: "Team Content Manager.",
    intro: "Review every team's announcements, results, achievements, media, recruiting information, and Podium Watch coverage.",
    styles,
    content,
    scripts: ["/scripts/admin-team-content.js"]
  });
}
