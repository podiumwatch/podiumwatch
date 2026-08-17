import {
  layout,
  pageHero
} from "../lib/html.mjs";

// Mirrors src/pages/athletelogin.mjs structurally and byte-for-byte in
// CSS (same class names, same panel layout) -- Team Workspace Phase
// Three's guardian tier is a distinct, coach-invited, signed-in account
// separate from an athlete's own login, but built the exact same way:
// signup is only offered when a valid, unredeemed ?invite=<token> is
// present, and there is no open self-serve guardian signup. See
// lib/guardian_access_service.mjs and
// install/13_GUARDIAN_AND_SPECTATOR_ACCESS.sql.
export function guardianLoginPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Guardian Access",
    title: "Follow your athlete.",
    description: "See your athlete's race plans and results -- only if their coach has invited you."
  })}

  <style>
    .team-auth-shell {
      width: min(680px, 100%);
      margin: 0 auto;
    }

    .team-auth-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 24px;
    }

    .team-auth-tabs button {
      width: 100%;
    }

    .team-auth-form {
      display: grid;
      gap: 18px;
    }

    .team-auth-form label {
      display: block;
    }

    .team-auth-form input {
      display: block;
      width: 100%;
      margin-top: 8px;
      padding: 13px;
      border: 1px solid rgba(15, 23, 42, 0.22);
      border-radius: 8px;
      background: #ffffff;
      font: inherit;
    }

    .team-auth-form .athlete-consent-row {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }

    .team-auth-form .athlete-consent-row input {
      width: auto;
      margin-top: 4px;
    }

    .team-auth-message {
      margin: 0 0 20px;
      padding: 14px 16px;
      border-radius: 10px;
      background: rgba(0, 191, 99, 0.1);
    }

    .athlete-invite-banner {
      margin: 0 0 20px;
      padding: 16px;
      border-radius: 10px;
      background: rgba(0, 191, 99, 0.12);
    }

    .team-auth-link {
      padding: 0;
      border: 0;
      background: transparent;
      font: inherit;
      font-weight: 800;
      text-decoration: underline;
      cursor: pointer;
    }

    .team-auth-help {
      margin-top: 22px;
      text-align: center;
    }

    .team-auth-loading {
      text-align: center;
    }

    @media (max-width: 520px) {
      .team-auth-tabs {
        grid-template-columns: 1fr;
      }

      .team-auth-form .button {
        width: 100%;
        justify-content: center;
      }
    }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="info-card team-auth-shell team-auth-loading" data-guardian-auth-loading>
        <h2>Loading your account</h2>
        <p>Podium Watch is connecting securely to the account system.</p>
      </div>

      <div class="info-card team-auth-shell" data-guardian-auth-shell hidden>
        <p class="athlete-invite-banner" data-guardian-invite-banner hidden></p>
        <p class="team-auth-message" data-guardian-auth-message aria-live="polite" hidden></p>

        <div class="team-auth-tabs" data-guardian-auth-tabs>
          <button class="button button-primary" type="button" data-show-auth-panel="signin">Sign in</button>
          <button class="button button-outline" type="button" data-show-auth-panel="signup" data-guardian-signup-tab hidden>Create account</button>
        </div>

        <section data-auth-panel="signin">
          <p class="eyebrow">Your account</p>
          <h2>Sign in</h2>

          <form class="team-auth-form" data-guardian-signin-form>
            <label><strong>Email address</strong><input type="email" name="email" autocomplete="email" required></label>
            <label><strong>Password</strong><input type="password" name="password" autocomplete="current-password" required></label>
            <button class="button button-primary" type="submit">Sign in</button>
          </form>

          <p class="team-auth-help">
            <button class="team-auth-link" type="button" data-show-auth-panel="reset">Forgot your password?</button>
          </p>
        </section>

        <section data-auth-panel="signup" hidden>
          <p class="eyebrow">New account</p>
          <h2>Create your account</h2>
          <p>This connects your account to the race plans and results your athlete's coach shares.</p>

          <form class="team-auth-form" data-guardian-signup-form>
            <label><strong>Your name</strong><input type="text" name="display_name" autocomplete="name" required></label>
            <label><strong>Email address</strong><input type="email" name="email" autocomplete="email" required></label>
            <label><strong>Password</strong><input type="password" name="password" autocomplete="new-password" minlength="8" required></label>
            <label><strong>Confirm password</strong><input type="password" name="confirm_password" autocomplete="new-password" minlength="8" required></label>

            <label class="athlete-consent-row">
              <input type="checkbox" name="consent" required>
              <span>I am the parent or guardian of this athlete, and I consent to this account viewing their Podium Watch race plans and results.</span>
            </label>

            <button class="button button-primary" type="submit">Create account</button>
          </form>
        </section>

        <section data-auth-panel="reset" hidden>
          <p class="eyebrow">Account recovery</p>
          <h2>Reset your password</h2>
          <p>Enter your email address and Podium Watch will send a secure reset link.</p>

          <form class="team-auth-form" data-guardian-reset-form>
            <label><strong>Email address</strong><input type="email" name="email" autocomplete="email" required></label>
            <button class="button button-primary" type="submit">Send reset link</button>
          </form>

          <p class="team-auth-help">
            <button class="team-auth-link" type="button" data-show-auth-panel="signin">Return to sign in</button>
          </p>
        </section>

        <section data-auth-panel="update" hidden>
          <p class="eyebrow">Account recovery</p>
          <h2>Choose a new password</h2>

          <form class="team-auth-form" data-guardian-update-password-form>
            <label><strong>New password</strong><input type="password" name="password" autocomplete="new-password" minlength="8" required></label>
            <label><strong>Confirm new password</strong><input type="password" name="confirm_password" autocomplete="new-password" minlength="8" required></label>
            <button class="button button-primary" type="submit">Save new password</button>
          </form>
        </section>
      </div>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/team-auth-client.js" defer></script>
  <script src="/scripts/guardian-login.js" defer></script>`;

  return layout({
    site,
    title: "Guardian Account",
    description: "Create or sign in to a Podium Watch guardian account -- invite only.",
    pathname: "/guardian-login/",
    content
  });
}
