import { adminShell } from "../lib/adminshell.mjs";

const styles = `
    .admin-roster-shell,
    .admin-roster-results {
      display: grid;
      gap: 22px;
    }

    .admin-roster-form {
      display: grid;
      grid-template-columns: minmax(240px, 1fr) auto;
      gap: 12px;
      align-items: end;
    }

    .admin-roster-form input {
      display: block;
      width: 100%;
      margin-top: 8px;
      padding: 12px;
      border: 1px solid rgba(15, 23, 42, 0.22);
      border-radius: 9px;
      font: inherit;
    }

    .admin-roster-message {
      padding: 14px 16px;
      border-radius: 10px;
      background: rgba(0, 191, 99, 0.1);
    }

    .admin-roster-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 18px;
      align-items: center;
      padding: 20px;
      border: 1px solid rgba(15, 23, 42, 0.14);
      border-radius: 14px;
      background: #ffffff;
    }

    .admin-roster-card h3,
    .admin-roster-card p {
      margin: 0;
    }

    .admin-roster-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }

    .admin-roster-badge {
      display: inline-flex;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(0, 191, 99, 0.14);
      font-size: 0.78rem;
      font-weight: 850;
    }

    .admin-roster-badge-dark {
      background: #111827;
      color: #ffffff;
    }

    @media (max-width: 700px) {
      .admin-roster-form,
      .admin-roster-card {
        grid-template-columns: 1fr;
      }

      .admin-roster-form .button,
      .admin-roster-card .button {
        width: 100%;
        justify-content: center;
      }
    }
`;

export function adminTeamRostersPage(site) {
  const content = `<div class="info-card" data-admin-roster-loading>
    <h2>Checking admin access</h2>
    <p>Please wait while Podium Watch loads the roster manager.</p>
  </div>

  <div class="admin-roster-shell" data-admin-roster hidden>
    <p class="admin-roster-message" data-admin-roster-message aria-live="polite" hidden></p>

    <section class="info-card">
      <p class="eyebrow">Find a program</p>
      <h2>Search team rosters</h2>

      <form class="admin-roster-form" data-admin-roster-search-form>
        <label>
          <strong>School, city, mascot, or conference</strong>
          <input type="search" name="search" placeholder="Search teams">
        </label>
        <button class="button button-primary" type="submit">Search teams</button>
      </form>
    </section>

    <section>
      <div class="section-heading">
        <div>
          <p class="eyebrow">Team profiles</p>
          <h2>Roster access</h2>
        </div>
        <p><strong data-admin-roster-count>0</strong> teams found</p>
      </div>

      <div class="admin-roster-results" data-admin-roster-results></div>
      <div class="info-card" data-admin-roster-empty hidden>No team profiles were found.</div>
    </section>
  </div>`;

  return adminShell({
    site,
    pathname: "/admin/team-rosters/",
    title: "Admin Team Rosters",
    description: "Manage every Podium Watch team roster, season archive, and athlete import.",
    heading: "Team rosters.",
    intro: "Search every team and manage current rosters, season archives, athlete links, and roster imports.",
    styles,
    content,
    scripts: ["/scripts/admin-team-rosters.js"]
  });
}
