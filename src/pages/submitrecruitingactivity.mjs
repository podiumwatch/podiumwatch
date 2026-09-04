import { layout, pageHero } from "../lib/html.mjs";

// Public, no-login entry point for reporting recruiting activity (interest,
// offers, visits, commitments, signings) -- matches src/pages/
// submitresults.mjs's exact tone and structure (three-step "how this
// works" explanation, honeypot field, held for review, no account
// required). See lib/recruiting_tips_service.mjs for the full safety
// story: nothing submitted here ever becomes a public fact on its own.
const styles = `
    .submit-activity-shell { display:grid; gap:24px; }
    .submit-activity-steps { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px; }
    .submit-activity-step strong { display:grid; place-items:center; width:38px; height:38px; margin-bottom:14px; border-radius:50%; background:var(--green); color:var(--black); font-size:1rem; }
    .submit-activity-step h3, .submit-activity-step p { margin-bottom:0; }
    .submit-activity-form { display:grid; gap:14px; }
    .submit-activity-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:13px; }
    .submit-activity-form label { display:grid; gap:7px; font-weight:850; }
    .submit-activity-form input, .submit-activity-form select, .submit-activity-form textarea { width:100%; padding:10px 12px; border:1px solid rgba(var(--black-rgb),.22); border-radius:9px; background:var(--white); font:inherit; }
    .submit-activity-form textarea { min-height:100px; resize:vertical; }
    .submit-activity-wide { grid-column:1 / -1; }
    .submit-activity-honeypot { position:absolute !important; left:-10000px !important; width:1px !important; height:1px !important; overflow:hidden !important; }
    .submit-activity-help { font-weight:500; color:var(--muted); }
    .submit-activity-message { padding:14px 16px; border-radius:10px; font-weight:700; }
    .submit-activity-message[data-tone="success"] { background:rgba(var(--green-rgb),.13); color:var(--green-ink); }
    .submit-activity-message[data-tone="error"] { background:rgba(220,38,38,.12); color:#7a1414; }
    @media (max-width:700px) {
      .submit-activity-fields, .submit-activity-steps { grid-template-columns:1fr; }
      .submit-activity-wide { grid-column:auto; }
    }
`;

export function submitRecruitingActivityPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Recruiting",
    title: "Report an offer or commitment.",
    description:
      "Athletes, coaches, and family and fans can tell us about interest, offers, visits, commitments, and signings, no account required. Every submission is reviewed by hand before anything becomes public."
  })}

  <style>${styles}</style>

  <section class="section section-paper">
    <div class="container submit-activity-shell">
      <section class="info-card">
        <p class="eyebrow">How this works</p>
        <h2>Three steps, no login</h2>
        <div class="submit-activity-steps" style="margin-top:18px;">
          <article class="submit-activity-step">
            <strong>1</strong>
            <h3>Tell us what happened</h3>
            <p>Who it's about, which school is involved, and what kind of update it is -- interest, an offer, a visit, a commitment, or a signing.</p>
          </article>
          <article class="submit-activity-step">
            <strong>2</strong>
            <h3>Podium Watch reviews it</h3>
            <p>Every submission is held privately and matched to the right athlete by hand. Nothing is published automatically, and no offer or commitment appears publicly without review.</p>
          </article>
          <article class="submit-activity-step">
            <strong>3</strong>
            <h3>We follow up if needed</h3>
            <p>If anything is unclear, Podium Watch may reach out using the contact information you provide.</p>
          </article>
        </div>
      </section>

      <section class="info-card">
        <div><p class="eyebrow">Submit an update</p><h2>Recruiting activity submission</h2></div>
        <form class="submit-activity-form" data-submit-activity-form>
          <div class="submit-activity-fields">
            <label>Athlete's name<input type="text" name="athlete_name" required maxlength="200" placeholder="First and last name"></label>
            <label>Athlete's high school<input type="text" name="school_name" required maxlength="200" placeholder="Exact school name"></label>
            <label>Graduation year (optional)<input type="number" name="graduation_year" min="2000" max="2200" placeholder="2027"></label>
            <label>Gender (optional)<select name="gender"><option value="">Not specified</option><option value="boys">Boys</option><option value="girls">Girls</option></select></label>
            <label>What kind of update is this?<select name="activity_type" required>
              <option value="">Choose one</option>
              <option value="interest">Interest from a college</option>
              <option value="offer">Offer</option>
              <option value="visit">Visit</option>
              <option value="commitment">Commitment</option>
              <option value="signing">Signing</option>
              <option value="other">Other</option>
            </select></label>
            <label>College<input type="text" name="college_name" required maxlength="250" placeholder="Youngstown State"></label>
            <label>College division (optional)<input type="text" name="college_division" maxlength="100" placeholder="NCAA Division I"></label>
            <label>Date (optional)<input type="date" name="activity_date"></label>
            <label class="submit-activity-wide">Link to an announcement (optional, but helps review go faster)<input type="url" name="source_url" placeholder="https://"></label>
            <label class="submit-activity-wide">Anything else we should know? (optional)<textarea name="notes"></textarea></label>
            <label>Your name<input type="text" name="submitter_name" required maxlength="200"></label>
            <label>Email for follow up<input type="email" name="submitter_email" required maxlength="320"></label>
            <label>You are the athlete's... (optional)<select name="submitter_role">
              <option value="">Prefer not to say</option>
              <option value="athlete">Athlete</option>
              <option value="coach">Coach</option>
              <option value="family">Parent or family member</option>
              <option value="fan">Fan or follower</option>
              <option value="other">Other</option>
            </select></label>
            <label class="submit-activity-honeypot" aria-hidden="true">Leave this blank<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
          </div>
          <p class="submit-activity-message" data-submit-activity-message role="status" hidden></p>
          <button class="button button-dark" type="submit" data-submit-activity-button>Submit for review</button>
        </form>
      </section>
    </div>
  </section>

  <script src="/scripts/submit-recruiting-activity.js" defer></script>`;

  return layout({
    site,
    title: "Report an Offer or Commitment",
    description:
      "Athletes, coaches, and fans can report recruiting interest, offers, visits, commitments, and signings to Podium Watch for review, no account required.",
    pathname: "/recruiting/submit-activity/",
    content
  });
}
