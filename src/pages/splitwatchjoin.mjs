import {
  layout,
  pageHero
} from "../lib/html.mjs";

// The public front door to Split Watch -- reachable from the
// main site nav with no sign-in required. A team's coach generates a
// short code (from Team Home) and shares it with race-day volunteers;
// typing it in here gets them straight to that team's Race Command
// Center. This is the entire "access model" this page exists for -- see
// lib/race_day_auth.mjs for how the code itself is verified and
// sessioned. A coach with a full account can still just sign in as
// before; this is an additional door, not a replacement for that one.
export function splitWatchJoinPage(site) {
  const content = `${pageHero({
    eyebrow: "Split Watch",
    title: "Enter your team's race day code.",
    description: "Ask your coach for the current code -- it gets you straight into live race timing, no account needed."
  })}

  <section class="section section-paper">
    <div class="container" style="max-width:560px;">
      <div class="info-card" data-swj-shell>
        <p class="swj-message" data-swj-message role="status" hidden></p>

        <form data-swj-form>
          <label style="display:block;font-weight:850;margin-bottom:8px;">Race day code</label>
          <input
            type="text"
            name="code"
            data-swj-code-input
            placeholder="e.g. XK4P7QRT"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            style="display:block;width:100%;padding:18px;font-size:1.4rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;text-align:center;border:2px solid rgba(15,23,42,0.22);border-radius:10px;font-family:inherit;"
          >
          <button class="button button-primary" type="submit" style="width:100%;margin-top:16px;font-size:1.1rem;padding:16px;" data-swj-submit>Continue</button>
        </form>

        <p style="margin-top:20px;text-align:center;">
          Already have a Podium Watch coach account?
          <a href="/team-login/">Sign in instead</a>
        </p>
      </div>
    </div>
  </section>

  <script src="/scripts/split-watch-join.js" defer></script>`;

  return layout({
    site,
    title: "Split Watch",
    description: "Enter your team's race day code to get straight into live race timing.",
    pathname: "/split-watch/join/",
    content
  });
}
