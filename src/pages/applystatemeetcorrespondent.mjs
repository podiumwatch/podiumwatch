import { layout, pageHero } from "../lib/html.mjs";

// Public, no-login application page for the paid Podium Watch State Meet
// Media Correspondent role covering the 2026 OHSAA State Cross Country
// Championships. Follows the same structure, tone, and safety pattern as
// src/pages/apply.mjs (the intern writer application): a plain-language
// explainer, a real on-site form (honeypot included), held for review --
// nothing here is an OHSAA media credential or a guarantee of selection.
// See lib/state_meet_correspondent_service.mjs for the submission logic
// and install/70_STATE_MEET_CORRESPONDENT_APPLICATIONS.sql for the table.
const styles = `
    .smc-shell { display:grid; gap:24px; }
    .smc-facts { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin:18px 0 0; }
    .smc-fact { padding:16px; border:1px solid var(--line); background:var(--white); text-align:center; }
    .smc-fact strong { display:block; font-size:1rem; }
    .smc-fact span { display:block; margin-top:4px; font-size:.82rem; color:var(--muted); font-weight:600; }
    .smc-list { display:grid; gap:10px; margin:18px 0 0; padding:0; list-style:none; }
    .smc-list li { display:flex; gap:10px; align-items:flex-start; padding:12px 14px; border:1px solid var(--line); background:var(--white); font-weight:600; }
    .smc-list li::before { content:"\\2713"; flex:0 0 auto; display:grid; place-items:center; width:22px; height:22px; border-radius:50%; background:var(--green); color:var(--black); font-size:.8rem; font-weight:900; }
    .smc-schedule-wrap { overflow-x:auto; margin-top:18px; border:1px solid var(--line); }
    .smc-schedule { width:100%; border-collapse:collapse; font-size:.92rem; min-width:420px; }
    .smc-schedule th, .smc-schedule td { padding:10px 14px; text-align:left; border-bottom:1px solid var(--line); }
    .smc-schedule th { background:var(--green); color:#fff; font-size:.78rem; letter-spacing:.04em; text-transform:uppercase; }
    .smc-schedule tr:last-child td { border-bottom:0; }
    .smc-note { margin-top:14px; padding:14px 16px; border:1px solid var(--line); background:rgba(var(--black-rgb),.03); font-size:.88rem; color:var(--muted); font-weight:600; }
    .smc-form { display:grid; gap:14px; }
    .smc-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:13px; }
    .smc-form label { display:grid; gap:7px; font-weight:850; }
    .smc-form input, .smc-form select, .smc-form textarea { width:100%; padding:10px 12px; border:1px solid rgba(var(--black-rgb),.22); border-radius:9px; background:var(--white); font:inherit; }
    .smc-form input:focus, .smc-form select:focus, .smc-form textarea:focus { outline:3px solid var(--green); outline-offset:1px; }
    .smc-form textarea { min-height:100px; resize:vertical; }
    .smc-wide { grid-column:1 / -1; }
    .smc-hint { font-weight:500; color:var(--muted); }
    .smc-radio-row { display:flex; gap:18px; align-items:center; }
    .smc-radio-row label { display:flex; align-items:center; gap:7px; font-weight:600; }
    .smc-radio-row input { width:auto; }
    .smc-error { display:block; margin-top:4px; font-size:.82rem; font-weight:700; color:#b3261e; }
    .smc-field-invalid input, .smc-field-invalid select, .smc-field-invalid textarea { border-color:#b3261e; }
    .smc-consent { grid-column:1 / -1; display:flex; gap:10px; align-items:flex-start; padding:12px 14px; border:1px solid rgba(var(--black-rgb),.14); border-radius:9px; background:rgba(var(--black-rgb),.03); }
    .smc-consent input { width:auto; margin-top:3px; }
    .smc-consent label { font-weight:500; }
    .smc-privacy { font-size:.82rem; color:var(--muted); font-weight:600; }
    .smc-honeypot { position:absolute !important; left:-10000px !important; width:1px !important; height:1px !important; overflow:hidden !important; }
    .smc-message { padding:14px 16px; border-radius:10px; font-weight:700; }
    .smc-message[data-tone="success"] { background:rgba(var(--green-rgb),.13); color:var(--green-ink); }
    .smc-message[data-tone="error"] { background:rgba(220,38,38,.12); color:#7a1414; }
    .smc-confirmation { text-align:center; padding:12px 0; }
    .smc-confirmation h2 { margin-bottom:10px; }
    .smc-confirmation p { max-width:560px; margin:0 auto 20px; color:var(--muted); font-weight:600; }
    @media (max-width:860px) {
      .smc-facts { grid-template-columns:repeat(2,minmax(0,1fr)); }
    }
    @media (max-width:700px) {
      .smc-fields, .smc-facts { grid-template-columns:1fr; }
      .smc-wide { grid-column:auto; }
      .smc-radio-row { flex-direction:column; align-items:flex-start; gap:8px; }
    }
`;

const RESPONSIBILITIES = [
  "Conduct short video interviews after races",
  "Interview individual athletes, teams, and coaches",
  "Gather immediate post race reactions and quotes",
  "Identify interesting stories developing throughout the meet",
  "Communicate with Podium Watch during the day",
  "Represent Podium Watch professionally while working in credentialed media areas",
  "Follow all OHSAA media rules and instructions"
];

const CANDIDATE_TRAITS = [
  "College student interested in sports journalism, sports broadcasting, communications, journalism, media production, or a related field",
  "Comfortable approaching and interviewing athletes and coaches",
  "Comfortable appearing on camera if needed, but primarily comfortable conducting interviews",
  "Able to record clear vertical video using a phone or camera",
  "Knowledge of cross country or track and field is preferred but not required",
  "Dependable and available for the full state meet",
  "Professional around high school athletes, coaches, families, and OHSAA staff",
  "Able to work independently in a busy sports environment"
];

const WHY_PODIUM_WATCH = [
  "Real published sports media experience",
  "Opportunity to cover an OHSAA state championship",
  "Interview experience with athletes and coaches",
  "Published work through Podium Watch",
  "Portfolio material for sports journalism or broadcasting",
  "Experience covering a live championship event",
  "Paid assignment"
];

const SCHEDULE = [
  ["10:00 AM", "Division I Girls"],
  ["10:40 AM", "Division I Boys"],
  ["11:10 AM", "Division I Awards"],
  ["11:50 AM", "Division II Girls"],
  ["12:30 PM", "Division II Boys"],
  ["1:00 PM", "Division II Awards"],
  ["1:40 PM", "Division III Girls"],
  ["2:20 PM", "Division III Boys"],
  ["2:50 PM", "Division III Awards"],
  ["3:30 PM", "Division IV Girls"],
  ["4:10 PM", "Division IV Boys"],
  ["4:40 PM", "Division IV Awards"]
];

export function applyStateMeetCorrespondentPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Opportunity",
    title: "Cover the OHSAA State Cross Country Championships",
    description:
      "Podium Watch is looking for a college student interested in sports journalism, broadcasting, or sports media to serve as our State Meet Media Correspondent at the 2026 OHSAA State Cross Country Championships."
  })}

  <style>${styles}</style>

  <section class="section section-paper">
    <div class="container smc-shell">
      <section class="info-card">
        <div class="smc-facts">
          <div class="smc-fact"><strong>Saturday, November 7, 2026</strong><span>Event date</span></div>
          <div class="smc-fact"><strong>Fortress Obetz</strong><span>Memorial Park, 4175 Alum Creek Dr.</span></div>
          <div class="smc-fact"><strong>Obetz, Ohio 43207</strong><span>Location</span></div>
          <div class="smc-fact"><strong>Paid Opportunity</strong><span>Compensation</span></div>
        </div>
      </section>

      <section class="info-card">
        <p class="eyebrow">The Assignment</p>
        <h2>Help tell the story of one of Ohio's biggest meets</h2>
        <p>You will represent Podium Watch throughout the OHSAA State Cross Country Championships and help tell the stories coming out of one of the biggest high school cross country meets in Ohio.</p>
        <p>Your primary responsibility will be conducting short post race video interviews with athletes, teams, and coaches.</p>
        <p>You may also gather quotes, reactions, story ideas, and other information that Podium Watch can use in articles and social media coverage.</p>
        <p class="smc-hint">Podium Watch will submit the person selected for this role through OHSAA's own media credential application process, as an assigned Podium Watch media representative, correspondent, or stringer. Final media credential approval is controlled by OHSAA -- applying here does not guarantee a credential or selection.</p>
      </section>

      <section class="info-card">
        <p class="eyebrow">What You Will Do</p>
        <h2>Responsibilities</h2>
        <ul class="smc-list">${RESPONSIBILITIES.map((item) => `<li>${item}</li>`).join("")}</ul>
      </section>

      <section class="info-card">
        <p class="eyebrow">Who We Are Looking For</p>
        <h2>Ideal applicant</h2>
        <ul class="smc-list">${CANDIDATE_TRAITS.map((item) => `<li>${item}</li>`).join("")}</ul>
      </section>

      <section class="info-card">
        <p class="eyebrow">Why Work With Podium Watch</p>
        <h2>What this opportunity offers</h2>
        <ul class="smc-list">${WHY_PODIUM_WATCH.map((item) => `<li>${item}</li>`).join("")}</ul>
      </section>

      <section class="info-card">
        <p class="eyebrow">Event Schedule</p>
        <h2>Saturday, November 7, 2026</h2>
        <p>This is essentially a full day assignment, from the first race through the final awards.</p>
        <div class="smc-schedule-wrap">
          <table class="smc-schedule">
            <thead><tr><th>Time</th><th>Race</th></tr></thead>
            <tbody>${SCHEDULE.map(([time, race]) => `<tr><td>${time}</td><td>${race}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      </section>

      <section class="info-card" data-smc-form-section>
        <div><p class="eyebrow">Apply</p><h2>State Meet Media Correspondent application</h2></div>
        <form class="smc-form" data-smc-form novalidate>
          <div class="smc-fields">
            <label>First name<input type="text" name="first_name" required maxlength="100" autocomplete="given-name"></label>
            <label>Last name<input type="text" name="last_name" required maxlength="100" autocomplete="family-name"></label>
            <label>Email address<input type="email" name="email" required maxlength="320" autocomplete="email"></label>
            <label>Phone number<input type="tel" name="phone" required maxlength="40" autocomplete="tel"></label>
            <label>College or university<input type="text" name="college" required maxlength="200"></label>
            <label>Major or area of study<input type="text" name="major" required maxlength="200"></label>
            <label class="smc-wide">Current year in college<select name="college_year" required>
              <option value="">Select year</option>
              <option value="Freshman">Freshman</option>
              <option value="Sophomore">Sophomore</option>
              <option value="Junior">Junior</option>
              <option value="Senior">Senior</option>
              <option value="Graduate Student">Graduate Student</option>
              <option value="Other">Other</option>
            </select></label>

            <fieldset class="smc-wide" style="border:0; padding:0; margin:0;">
              <legend class="smc-hint" style="margin-bottom:9px;">Are you at least 18 years old?</legend>
              <div class="smc-radio-row">
                <label><input type="radio" name="is_18_or_older" value="true" required>Yes</label>
                <label><input type="radio" name="is_18_or_older" value="false">No</label>
              </div>
            </fieldset>

            <fieldset class="smc-wide" style="border:0; padding:0; margin:0;">
              <legend class="smc-hint" style="margin-bottom:9px;">Can you attend the OHSAA State Cross Country Championships on Saturday, November 7, 2026 at Fortress Obetz?</legend>
              <div class="smc-radio-row">
                <label><input type="radio" name="available_nov_7" value="true" required>Yes</label>
                <label><input type="radio" name="available_nov_7" value="false">No</label>
              </div>
            </fieldset>

            <fieldset class="smc-wide" style="border:0; padding:0; margin:0;">
              <legend class="smc-hint" style="margin-bottom:9px;">Can you be available for most or all of the event, approximately from the morning through the final awards?</legend>
              <div class="smc-radio-row">
                <label><input type="radio" name="available_full_day" value="true" required>Yes</label>
                <label><input type="radio" name="available_full_day" value="false">No</label>
              </div>
            </fieldset>

            <label class="smc-wide">Tell us why you are interested in this opportunity.<textarea name="interest_reason" required maxlength="3000"></textarea></label>
            <label class="smc-wide">Tell us about any journalism, interviewing, broadcasting, photography, videography, social media, or sports media experience you have. <span class="smc-hint">(optional)</span><textarea name="experience" maxlength="3000"></textarea></label>

            <fieldset class="smc-wide" style="border:0; padding:0; margin:0;">
              <legend class="smc-hint" style="margin-bottom:9px;">Are you comfortable approaching athletes and coaches for interviews?</legend>
              <div class="smc-radio-row">
                <label><input type="radio" name="comfortable_interviewing" value="true" required>Yes</label>
                <label><input type="radio" name="comfortable_interviewing" value="false">No</label>
              </div>
            </fieldset>

            <fieldset class="smc-wide" style="border:0; padding:0; margin:0;">
              <legend class="smc-hint" style="margin-bottom:9px;">Are you comfortable recording vertical video interviews using a phone or camera?</legend>
              <div class="smc-radio-row">
                <label><input type="radio" name="comfortable_video" value="true" required>Yes</label>
                <label><input type="radio" name="comfortable_video" value="false">No</label>
              </div>
            </fieldset>

            <label class="smc-wide">How familiar are you with cross country and track and field?<select name="xc_track_familiarity" required>
              <option value="">Select familiarity</option>
              <option value="Very familiar">Very familiar</option>
              <option value="Somewhat familiar">Somewhat familiar</option>
              <option value="A little familiar">A little familiar</option>
              <option value="Not familiar yet">Not familiar yet</option>
            </select></label>

            <label>Portfolio or personal website URL <span class="smc-hint">(optional)</span><input type="url" name="portfolio_url" maxlength="2000" placeholder="https://"></label>
            <label>LinkedIn URL <span class="smc-hint">(optional)</span><input type="url" name="linkedin_url" maxlength="2000" placeholder="https://"></label>
            <label>Instagram or social media handle <span class="smc-hint">(optional)</span><input type="text" name="social_handle" maxlength="200" placeholder="@yourhandle"></label>
            <label>YouTube or video portfolio URL <span class="smc-hint">(optional)</span><input type="url" name="video_url" maxlength="2000" placeholder="https://"></label>
            <label class="smc-wide">Other relevant link <span class="smc-hint">(optional)</span><input type="url" name="other_url" maxlength="2000" placeholder="https://"></label>
            <label class="smc-wide">Additional notes <span class="smc-hint">(optional)</span><textarea name="additional_notes" maxlength="3000"></textarea></label>

            <div class="smc-consent">
              <input type="checkbox" id="credential_acknowledgement" name="credential_acknowledgement" required>
              <label for="credential_acknowledgement">I understand that submitting this application does not guarantee selection or an OHSAA media credential.</label>
            </div>

            <label class="smc-honeypot" aria-hidden="true">Leave this blank<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
          </div>

          <p class="smc-privacy">Application information will be used by Podium Watch only for evaluating candidates for this media opportunity.</p>

          <p class="smc-message" data-smc-message role="status" hidden></p>
          <button class="button button-dark" type="submit" data-smc-button>Submit Application</button>
        </form>

        <div class="smc-confirmation" data-smc-confirmation hidden>
          <h2>Application Received</h2>
          <p>Thank you for applying to cover the 2026 OHSAA State Cross Country Championships with Podium Watch. We will review your application and contact selected candidates using the email or phone number provided.</p>
          <a class="button button-dark" href="/">Return to Podium Watch</a>
        </div>
      </section>
    </div>
  </section>

  <script src="/scripts/apply-state-meet-correspondent.js" defer></script>`;

  return layout({
    site,
    title: "State Meet Media Correspondent Application | Podium Watch",
    description:
      "Apply to represent Podium Watch as a paid media correspondent at the 2026 OHSAA State Cross Country Championships at Fortress Obetz.",
    pathname: "/apply/state-meet-correspondent/",
    content
  });
}
