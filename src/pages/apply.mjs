import { layout, pageHero } from "../lib/html.mjs";

// Public, no-login entry point for high school students applying to write
// for Podium Watch -- matches src/pages/submitrecruitingactivity.mjs's
// exact tone and structure (three-step "how this works" explanation,
// honeypot field, held for review, no account required). See
// lib/intern_applications_service.mjs for the full safety story: nothing
// submitted here becomes a writer for the site on its own -- an admin
// reviews every application by hand, with a parent/guardian in the loop
// since applicants are minors.
const styles = `
    .apply-shell { display:grid; gap:24px; }
    .apply-steps { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px; }
    .apply-step strong { display:grid; place-items:center; width:38px; height:38px; margin-bottom:14px; border-radius:50%; background:var(--green); color:var(--black); font-size:1rem; }
    .apply-step h3, .apply-step p { margin-bottom:0; }
    .apply-form { display:grid; gap:14px; }
    .apply-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:13px; }
    .apply-form label { display:grid; gap:7px; font-weight:850; }
    .apply-form input, .apply-form select, .apply-form textarea { width:100%; padding:10px 12px; border:1px solid rgba(var(--black-rgb),.22); border-radius:9px; background:var(--white); font:inherit; }
    .apply-form textarea { min-height:100px; resize:vertical; }
    .apply-wide { grid-column:1 / -1; }
    .apply-hint { font-weight:500; color:var(--muted); }
    .apply-consent { grid-column:1 / -1; display:flex; gap:10px; align-items:flex-start; padding:12px 14px; border:1px solid rgba(var(--black-rgb),.14); border-radius:9px; background:rgba(var(--black-rgb),.03); }
    .apply-consent input { width:auto; margin-top:3px; }
    .apply-consent label { font-weight:500; }
    .apply-coverage { grid-column:1 / -1; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; padding:4px 0; }
    .apply-coverage-option { display:flex; align-items:center; gap:9px; font-weight:600; }
    .apply-coverage-option input { width:auto; }
    .apply-honeypot { position:absolute !important; left:-10000px !important; width:1px !important; height:1px !important; overflow:hidden !important; }
    .apply-message { padding:14px 16px; border-radius:10px; font-weight:700; }
    .apply-message[data-tone="success"] { background:rgba(var(--green-rgb),.13); color:var(--green-ink); }
    .apply-message[data-tone="error"] { background:rgba(220,38,38,.12); color:#7a1414; }
    @media (max-width:700px) {
      .apply-fields, .apply-steps, .apply-coverage { grid-template-columns:1fr; }
      .apply-wide { grid-column:auto; }
    }
`;

export function applyPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Intern Writers",
    title: "Write for Podium Watch.",
    description:
      "Podium Watch is looking for high school writers who want to cover Ohio cross country and track and field, whether you're aiming for a career in sports media or you just love the sport. This is an unpaid intern writer role -- in return you get a byline, an author page, editorial feedback, and clips for college or journalism applications."
  })}

  <style>${styles}</style>

  <section class="section section-paper">
    <div class="container apply-shell">
      <section class="info-card">
        <p class="eyebrow">How this works</p>
        <h2>Three steps, no login</h2>
        <div class="apply-steps" style="margin-top:18px;">
          <article class="apply-step">
            <strong>1</strong>
            <h3>Apply with a writing sample</h3>
            <p>Tell us about yourself and write a short recap of a real or hypothetical cross country or track race so we can see how you write.</p>
          </article>
          <article class="apply-step">
            <strong>2</strong>
            <h3>Podium Watch reviews it</h3>
            <p>Because applicants are high school students, we ask a parent or guardian to be aware of and consent to your participation. Every application is reviewed by hand.</p>
          </article>
          <article class="apply-step">
            <strong>3</strong>
            <h3>We follow up by email</h3>
            <p>Whether or not it's a fit right now, Podium Watch will follow up using the email address you provide.</p>
          </article>
        </div>
      </section>

      <section class="info-card">
        <div><p class="eyebrow">Apply</p><h2>Intern writer application</h2></div>
        <form class="apply-form" data-apply-form>
          <div class="apply-fields">
            <label>Full name<input type="text" name="full_name" required maxlength="200"></label>
            <label>Your email<input type="email" name="email" required maxlength="320"></label>
            <label>Phone <span class="apply-hint">(optional)</span><input type="tel" name="phone" maxlength="40"></label>
            <label>Grade<select name="grade" required>
              <option value="">Select grade</option>
              <option value="9th grade">9th grade</option>
              <option value="10th grade">10th grade</option>
              <option value="11th grade">11th grade</option>
              <option value="12th grade">12th grade</option>
            </select></label>
            <label class="apply-wide">School<input type="text" name="school" required maxlength="200"></label>
            <label>Parent/guardian name<input type="text" name="parent_name" required maxlength="200"></label>
            <label>Parent/guardian email<input type="email" name="parent_email" required maxlength="320"></label>
            <div class="apply-consent">
              <input type="checkbox" id="parent_consent" name="parent_consent" required>
              <label for="parent_consent">I have discussed this with my parent/guardian and they consent to my participation, including publication of my name and writing on the Podium Watch website.</label>
            </div>
            <fieldset class="apply-wide" style="border:0; padding:0; margin:0;">
              <legend class="apply-hint" style="margin-bottom:9px;">What would you want to cover?</legend>
              <div class="apply-coverage">
                <label class="apply-coverage-option"><input type="checkbox" name="coverage_interests" value="My own school">My own school</label>
                <label class="apply-coverage-option"><input type="checkbox" name="coverage_interests" value="A specific region/division">A specific region/division</label>
                <label class="apply-coverage-option"><input type="checkbox" name="coverage_interests" value="Rankings & polls commentary">Rankings & polls commentary</label>
                <label class="apply-coverage-option"><input type="checkbox" name="coverage_interests" value="Feature stories / profiles">Feature stories / profiles</label>
                <label class="apply-coverage-option"><input type="checkbox" name="coverage_interests" value="Recruiting coverage">Recruiting coverage</label>
              </div>
            </fieldset>
            <label class="apply-wide">Availability <span class="apply-hint">(how often could you file a piece?)</span><input type="text" name="availability" maxlength="300" placeholder="e.g. 1-2 pieces per week during XC season"></label>
            <label class="apply-wide">Why do you want to write for Podium Watch?<textarea name="why_interested" required maxlength="3000"></textarea></label>
            <label class="apply-wide">Writing sample <span class="apply-hint">(write a 150-200 word recap of a real or hypothetical cross country or track race)</span><textarea name="writing_sample" required maxlength="8000" style="min-height:160px;"></textarea></label>
            <label class="apply-wide">Portfolio, school newspaper, or social link <span class="apply-hint">(optional)</span><input type="url" name="portfolio_link" placeholder="https://"></label>
            <label class="apply-honeypot" aria-hidden="true">Leave this blank<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
          </div>
          <p class="apply-message" data-apply-message role="status" hidden></p>
          <button class="button button-dark" type="submit" data-apply-button>Submit application</button>
        </form>
      </section>
    </div>
  </section>

  <script src="/scripts/apply.js" defer></script>`;

  return layout({
    site,
    title: "Write for Podium Watch",
    description:
      "Apply to write for Podium Watch as a high school intern writer covering Ohio cross country and track and field. No account required.",
    pathname: "/apply/",
    content
  });
}
