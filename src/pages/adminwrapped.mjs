import { adminShell } from "../lib/adminshell.mjs";

// Admin: Podium Watch Wrapped launch (WO-36). Before the launch date the
// public sees "coming soon"; admins can preview any runner's card.
export function adminWrappedPage(site) {
  const content = `<div class="fpa-shell" data-wra>
    <section class="info-card" data-wra-loading><h2>Checking admin access</h2><p>Please wait.</p></section>
    <div data-wra-dashboard hidden style="display:grid;gap:16px">
      <section class="info-card">
        <h2>Launch</h2>
        <p><strong data-wra-state>...</strong></p>
        <form data-wra-form style="display:flex;flex-wrap:wrap;gap:10px;align-items:end">
          <label style="display:grid;gap:5px;font-weight:800">Launch date and time (your local time)<input type="datetime-local" name="launch_at" required style="padding:9px 10px;border:1px solid var(--line);border-radius:8px;font:inherit"></label>
          <button class="button button-primary" type="submit">Set launch</button>
          <button class="button button-secondary" type="button" data-wra-now>Launch now</button>
          <button class="button button-secondary" type="button" data-wra-clear>Take it down</button>
        </form>
        <p class="awards-message" data-wra-message role="status"></p>
      </section>
      <section class="info-card">
        <h2>Preview a card</h2>
        <p>Open any runner's Wrapped page before launch (admin only). Use the athlete's page address, for example paxson-bixler-russia-2029.</p>
        <form data-wra-preview style="display:flex;flex-wrap:wrap;gap:10px;align-items:end">
          <label style="display:grid;gap:5px;font-weight:800">Athlete slug<input name="slug" required pattern="[a-z0-9-]+" style="padding:9px 10px;border:1px solid var(--line);border-radius:8px;font:inherit"></label>
          <button class="button button-primary" type="submit">Open preview</button>
        </form>
      </section>
    </div>
  </div>`;
  return adminShell({ site, pathname: "/admin/wrapped/", title: "Wrapped", description: "Set the Podium Watch Wrapped launch date and preview cards.", heading: "Podium Watch Wrapped", intro: "Free 2026 season share cards. Public at /wrapped/ from the launch date; short link podiumwatch.org/wrapped.", content, scripts: ["/scripts/admin-wrapped.js"] });
}
