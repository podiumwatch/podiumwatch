import { layout, pageHero } from "../lib/html.mjs";

// Writer Portal sign in -- modeled directly on src/pages/teamlogin.mjs's
// exact structure and real Supabase Auth mechanism, minus the "create
// account" panel: writers don't self-register. An account only exists
// after an application (src/pages/apply.mjs) is accepted and an admin
// invites that person from the Supabase dashboard (Stage 1's manual
// invite step -- see install/47_WRITER_PORTAL.sql's header comment).
export function writerLoginPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Writer Portal",
    title: "Sign in to write.",
    description: "For intern writers with an active Podium Watch Writer Portal account."
  })}

  <style>
    .writer-auth-shell { width: min(680px, 100%); margin: 0 auto; }
    .writer-auth-form { display: grid; gap: 18px; }
    .writer-auth-form label { display: block; }
    .writer-auth-form input { display: block; width: 100%; margin-top: 8px; padding: 13px; border: 1px solid rgba(var(--black-rgb),.22); border-radius: 8px; background: var(--white); font: inherit; }
    .writer-auth-message { margin: 0 0 20px; padding: 14px 16px; border-radius: 10px; background: rgba(var(--green-rgb),.1); }
    .writer-auth-link { padding: 0; border: 0; background: transparent; font: inherit; font-weight: 800; text-decoration: underline; cursor: pointer; }
    .writer-auth-help { margin-top: 22px; text-align: center; }
    .writer-auth-loading { text-align: center; }
    @media (max-width: 520px) { .writer-auth-form .button { width: 100%; justify-content: center; } }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="info-card writer-auth-shell writer-auth-loading" data-writer-auth-loading>
        <h2>Loading the Writer Portal</h2>
        <p>Podium Watch is connecting securely to the Writer Portal account system.</p>
      </div>

      <div class="info-card writer-auth-shell" data-writer-auth-shell hidden>
        <p class="writer-auth-message" data-writer-auth-message aria-live="polite" hidden></p>

        <section data-auth-panel="signin">
          <p class="eyebrow">Writer account</p>
          <h2>Sign in</h2>
          <form class="writer-auth-form" data-writer-signin-form>
            <label><strong>Email address</strong><input type="email" name="email" autocomplete="email" required></label>
            <label><strong>Password</strong><input type="password" name="password" autocomplete="current-password" required></label>
            <button class="button button-primary" type="submit">Sign in</button>
          </form>
          <p class="writer-auth-help">
            <button class="writer-auth-link" type="button" data-show-auth-panel="reset">Forgot your password?</button>
          </p>
          <p class="writer-auth-help">Not a writer yet? <a href="/apply/">Apply to write for Podium Watch</a>.</p>
        </section>

        <section data-auth-panel="reset" hidden>
          <p class="eyebrow">Account recovery</p>
          <h2>Reset your password</h2>
          <p>Enter your email address and Podium Watch will send a secure reset link.</p>
          <form class="writer-auth-form" data-writer-reset-form>
            <label><strong>Email address</strong><input type="email" name="email" autocomplete="email" required></label>
            <button class="button button-primary" type="submit">Send reset link</button>
          </form>
          <p class="writer-auth-help">
            <button class="writer-auth-link" type="button" data-show-auth-panel="signin">Return to sign in</button>
          </p>
        </section>

        <section data-auth-panel="update" hidden>
          <p class="eyebrow">Account recovery</p>
          <h2>Choose a new password</h2>
          <form class="writer-auth-form" data-writer-update-password-form>
            <label><strong>New password</strong><input type="password" name="password" autocomplete="new-password" minlength="8" required></label>
            <label><strong>Confirm new password</strong><input type="password" name="confirm_password" autocomplete="new-password" minlength="8" required></label>
            <button class="button button-primary" type="submit">Save new password</button>
          </form>
        </section>
      </div>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/writer-auth-client.js" defer></script>
  <script src="/scripts/writer-login.js" defer></script>`;

  return layout({
    site,
    title: "Writer Sign In",
    description: "Sign in to the Podium Watch Writer Portal.",
    pathname: "/writer-login/",
    content
  });
}
