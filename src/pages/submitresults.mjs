import {
  layout,
  pageHero
} from "../lib/html.mjs";

export function submitResultsPage(site) {
  const content = `${pageHero({
    eyebrow: "Submit Results",
    title: "Ran or timed a meet? Send us the results.",
    description:
      "Coaches, timers, and meet hosts can share raw meet results directly with Podium Watch, no account required. Every submission is reviewed by hand before anything becomes public."
  })}

  <style>
    .submit-results-shell { display:grid; gap:24px; }
    .submit-results-form { display:grid; gap:14px; }
    .submit-results-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:13px; }
    .submit-results-form label { display:grid; gap:7px; font-weight:850; }
    .submit-results-form input, .submit-results-form select, .submit-results-form textarea { width:100%; padding:10px 12px; border:1px solid rgba(15,23,42,.22); border-radius:9px; background:#fff; font:inherit; }
    .submit-results-form textarea { min-height:220px; resize:vertical; font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:.92rem; }
    .submit-results-wide { grid-column:1 / -1; }
    .submit-results-honeypot { position:absolute !important; left:-10000px !important; width:1px !important; height:1px !important; overflow:hidden !important; }
    .submit-results-help { font-weight:500; color:rgba(15,23,42,.68); }
    .submit-results-message { padding:14px 16px; border-radius:10px; font-weight:700; }
    .submit-results-message[data-tone="success"] { background:rgba(0,191,99,.13); color:#08130d; }
    .submit-results-message[data-tone="error"] { background:rgba(226,58,58,.12); color:#7a1414; }
    .submit-results-steps { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px; }
    .submit-results-step strong { display:grid; place-items:center; width:38px; height:38px; margin-bottom:14px; border-radius:50%; background:#00bf63; color:#08130d; font-size:1rem; }
    .submit-results-step h3, .submit-results-step p { margin-bottom:0; }
    @media (max-width:700px) {
      .submit-results-fields, .submit-results-steps { grid-template-columns:1fr; }
      .submit-results-wide { grid-column:auto; }
    }
  </style>

  <section class="section section-paper">
    <div class="container submit-results-shell">
      <section class="info-card">
        <p class="eyebrow">How this works</p>
        <h2>Three steps, no login</h2>
        <div class="submit-results-steps" style="margin-top:18px;">
          <article class="submit-results-step">
            <strong>1</strong>
            <h3>Paste or upload</h3>
            <p>Paste the results text you already have, or upload the file your timing software exported -- a Hy-Tek or MeetPro semi-colon delimited export works best, but PDF, CSV, HTML, and plain text are all accepted.</p>
          </article>
          <article class="submit-results-step">
            <strong>2</strong>
            <h3>Podium Watch reviews it</h3>
            <p>Every submission is parsed and held privately for review. Nothing is imported or published automatically, and nothing is ever treated as an official source without separate verification.</p>
          </article>
          <article class="submit-results-step">
            <strong>3</strong>
            <h3>We follow up if needed</h3>
            <p>If anything about the meet or results is unclear, Podium Watch may reach out using the contact information you provide.</p>
          </article>
        </div>
      </section>

      <section class="info-card">
        <div><p class="eyebrow">Submit a meet</p><h2>Meet results submission</h2></div>
        <form class="submit-results-form" data-submit-results-form>
          <div class="submit-results-fields">
            <label>Meet name<input type="text" name="meet_name" required maxlength="300" placeholder="Springfield Invitational"></label>
            <label>Meet date<input type="date" name="meet_date" required></label>
            <label>Sport<select name="sport" required><option value="">Choose a sport</option><option value="cross_country">Cross Country</option><option value="indoor_track">Indoor Track</option><option value="outdoor_track">Outdoor Track</option></select></label>
            <label>Season year<input type="number" name="season_year" required min="2000" max="2200" placeholder="2025"></label>
            <label>Location (optional)<input type="text" name="meet_location" maxlength="300" placeholder="City, venue"></label>
            <label>Gender (optional, if the whole file is one)<select name="gender"><option value="">Mixed / use each row</option><option value="boys">Boys</option><option value="girls">Girls</option></select></label>
            <label class="submit-results-wide">Paste results text<textarea name="text" maxlength="2000000" placeholder="Paste the full results here, including headers -- place, athlete, school, and time or mark for each row."></textarea></label>
            <label class="submit-results-wide">Or upload a results file<input type="file" name="results_file" accept=".csv,.txt,.html,.htm,.pdf,.xlsx,text/csv,text/plain,text/html,application/pdf"></label>
            <p class="submit-results-wide submit-results-help">Uploading a file is optional if you already pasted text above. Files must be smaller than 12 MB; save older XLS files as XLSX first.</p>
            <label>Your name<input type="text" name="submitter_name" required maxlength="200"></label>
            <label>Email for follow up<input type="email" name="submitter_email" required maxlength="320"></label>
            <label>Organization (optional)<input type="text" name="submitter_organization" maxlength="200" placeholder="Timing company, school, or team"></label>
            <label class="submit-results-wide">Anything else we should know? (optional)<textarea name="note" maxlength="2000" style="min-height:80px;font-family:inherit;font-size:inherit;"></textarea></label>
            <label class="submit-results-honeypot" aria-hidden="true">Leave this blank<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
          </div>
          <p class="submit-results-message" data-submit-results-message role="status" hidden></p>
          <button class="button button-dark" type="submit" data-submit-results-button>Submit results</button>
        </form>
      </section>
    </div>
  </section>

  <script src="/scripts/submit-results.js" defer></script>`;

  return layout({
    site,
    title: "Submit Results",
    description:
      "Coaches, timers, and meet hosts can submit Ohio high school cross country and track and field results to Podium Watch for review, no account required.",
    pathname: "/submit-results/",
    content
  });
}
