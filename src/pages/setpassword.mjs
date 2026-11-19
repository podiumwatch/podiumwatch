import { layout, pageHero } from "../lib/html.mjs";

// /set-password/ (2026-11-17): where Supabase invite and password-recovery
// links land (they used to land on the homepage; the homepage now forwards
// them here, src/pages/home.mjs). The person sets a password, then OATCCC
// staff go to the verification admin page and everyone else to the
// homepage. Expired or already-used links get a clear message.
//
// Works with every link shape Supabase sends: the default
// "#access_token=...&type=invite|recovery", "?token_hash=...&type=..."
// (the recommended email template), and "?code=..." (PKCE). Logic:
// public/scripts/set-password.js. Private page: noindex, out of the
// sitemap (NOINDEX_NOFOLLOW_PREFIXES in src/config/site.mjs).
//
// staffUrl: where OATCCC staff go after setting a password. Only
// /oatccc/admin/ when that page is built (OATCCC_VERIFICATION_LIVE);
// otherwise staff go to the homepage like everyone else.
export function setPasswordPage(site, { staffUrl = "/" } = {}) {
  const content = `${pageHero({
    eyebrow: "Podium Watch account",
    title: "Set your password.",
    description: "Choose a password for your Podium Watch account."
  })}

  <style>
    .sp-shell { width: min(560px, 100%); margin: 0 auto; }
    .sp-form { display: grid; gap: 16px; }
    .sp-form label { display: block; font-weight: 700; }
    .sp-form input { display: block; width: 100%; margin-top: 8px; padding: 13px; border: 1px solid rgba(var(--black-rgb),.22); border-radius: 8px; background: var(--white); font: inherit; }
    .sp-form small { display: block; margin-top: 6px; font-weight: 400; opacity: .75; }
    .sp-msg { margin: 0 0 18px; padding: 14px 16px; border-radius: 10px; background: rgba(var(--green-rgb),.1); }
    .sp-msg.is-error { background: rgba(200, 40, 40, .1); }
    .sp-shell [hidden] { display: none !important; }
    @media (max-width: 520px) { .sp-form .button { width: 100%; justify-content: center; } }
  </style>

  <section class="section section-paper">
    <div class="container">
      <div class="info-card sp-shell" data-sp data-staff-url="${staffUrl}">
        <p class="sp-msg" role="status" aria-live="polite" data-sp-msg>Checking your link&hellip;</p>

        <form class="sp-form" data-sp-form hidden novalidate>
          <p data-sp-who></p>
          <label for="sp-pass">New password
            <input id="sp-pass" name="password" type="password" autocomplete="new-password" minlength="8" required>
            <small>At least 8 characters.</small>
          </label>
          <label for="sp-pass2">Type it again
            <input id="sp-pass2" name="confirm" type="password" autocomplete="new-password" minlength="8" required>
          </label>
          <button class="button button-primary" type="submit">Set password</button>
        </form>

        <div data-sp-expired hidden>
          <h2>This link has expired or was already used.</h2>
          <p>Links in invite and password emails work once and expire after a short time. Ask the person who invited you to send a new invite, or use &ldquo;Forgot password&rdquo; on the page where you sign in to get a new link.</p>
          <p><a class="button" href="/">Go to the homepage</a></p>
        </div>

        <div data-sp-nolink hidden>
          <h2>Open the link from your email.</h2>
          <p>This page sets your password from an invite or password-reset email. Open the newest email from Podium Watch and click its link on this device.</p>
          <p><a class="button" href="/">Go to the homepage</a></p>
        </div>
      </div>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/set-password.js" defer></script>`;

  return layout({
    site,
    title: "Set Your Password",
    description: "Set the password for your Podium Watch account.",
    pathname: "/set-password/",
    robots: "noindex, nofollow",
    content
  });
}
