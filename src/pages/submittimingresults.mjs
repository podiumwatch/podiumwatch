import { layout, pageHero } from "../lib/html.mjs";

// Public, no-login entry point for timing companies to hand off a
// finished race results file directly -- matches src/pages/
// submitresults.mjs's exact tone and structure (three-step "how this
// works" card, honeypot field, held for review, no account required).
// See lib/timing_submissions_service.mjs for the full safety story:
// nothing submitted here is ever parsed, matched, or imported
// automatically -- it lands hidden for an admin to review and process by
// hand through the existing import tooling.
//
// Upload mechanics: the file itself is uploaded directly from this page
// to Supabase Storage (via a short-lived signed URL), never through a
// Vercel serverless function -- those cap request bodies at 4.5 MB, well
// under this feature's real 25 MB file cap. See public/scripts/
// submit-timing-results.js.
const styles = `
    .submit-timing-shell { display:grid; gap:24px; }
    .submit-timing-steps { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px; }
    .submit-timing-step strong { display:grid; place-items:center; width:38px; height:38px; margin-bottom:14px; border-radius:50%; background:var(--green); color:var(--black); font-size:1rem; }
    .submit-timing-step h3, .submit-timing-step p { margin-bottom:0; }
    .submit-timing-form { display:grid; gap:14px; }
    .submit-timing-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:13px; }
    .submit-timing-form label { display:grid; gap:7px; font-weight:850; }
    .submit-timing-form input, .submit-timing-form select, .submit-timing-form textarea { width:100%; padding:10px 12px; border:1px solid rgba(var(--black-rgb),.22); border-radius:9px; background:var(--white); font:inherit; }
    .submit-timing-wide { grid-column:1 / -1; }
    .submit-timing-honeypot { position:absolute !important; left:-10000px !important; width:1px !important; height:1px !important; overflow:hidden !important; }
    .submit-timing-help { font-weight:500; color:var(--muted); }
    .submit-timing-message { padding:14px 16px; border-radius:10px; font-weight:700; }
    .submit-timing-message[data-tone="success"] { background:rgba(var(--green-rgb),.13); color:var(--green-ink); }
    .submit-timing-message[data-tone="error"] { background:rgba(220,38,38,.12); color:#7a1414; }
    @media (max-width:700px) {
      .submit-timing-fields, .submit-timing-steps { grid-template-columns:1fr; }
      .submit-timing-wide { grid-column:auto; }
    }
`;

export function submitTimingResultsPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Results Intake",
    title: "Send us your finished race results.",
    description:
      "Timing companies can hand off a completed meet's results directly, no account required. Every submission is held privately and reviewed by hand before anything is processed."
  })}

  <style>${styles}</style>

  <section class="section section-paper">
    <div class="container submit-timing-shell">
      <section class="info-card">
        <p class="eyebrow">How this works</p>
        <h2>Three steps, no login</h2>
        <div class="submit-timing-steps" style="margin-top:18px;">
          <article class="submit-timing-step">
            <strong>1</strong>
            <h3>Upload your results file</h3>
            <p>PDF, CSV, XLSX, or a Hy-Tek .hy3 export -- whatever your timing software produces for the finished meet.</p>
          </article>
          <article class="submit-timing-step">
            <strong>2</strong>
            <h3>Podium Watch reviews it</h3>
            <p>Every submission is held privately. Nothing is processed, matched, or published automatically -- an admin reviews it and runs it through our normal import process by hand.</p>
          </article>
          <article class="submit-timing-step">
            <strong>3</strong>
            <h3>We follow up if needed</h3>
            <p>If anything about the meet or the file is unclear, Podium Watch may reach out using the contact information you provide.</p>
          </article>
        </div>
      </section>

      <section class="info-card">
        <div><p class="eyebrow">Submit results</p><h2>Meet results submission</h2></div>
        <form class="submit-timing-form" data-submit-timing-form>
          <div class="submit-timing-fields">
            <label>Meet name<input type="text" name="meet_name" required maxlength="300" placeholder="Springfield Invitational"></label>
            <label>Meet date<input type="date" name="meet_date"></label>
            <label>Division / level<input type="text" name="division_level" maxlength="200" placeholder="Varsity, JV, Division II, etc."></label>
            <label>Timing company name<input type="text" name="timing_company_name" required maxlength="300"></label>
            <label>Contact email<input type="email" name="submitter_email" required maxlength="320"></label>
            <label class="submit-timing-wide">Results file<input type="file" name="results_file" required accept=".pdf,.csv,.xlsx,.xls,.hy3,.txt,application/pdf,text/csv,text/plain"></label>
            <p class="submit-timing-wide submit-timing-help">Accepted: PDF, CSV, XLSX/XLS, Hy-Tek .hy3, or plain text. Up to 25 MB.</p>
            <label class="submit-timing-honeypot" aria-hidden="true">Leave this blank<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
          </div>
          <p class="submit-timing-message" data-submit-timing-message role="status" hidden></p>
          <button class="button button-dark" type="submit" data-submit-timing-button>Submit results</button>
        </form>
      </section>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/submit-timing-results.js" defer></script>`;

  return layout({
    site,
    title: "Submit Timing Results",
    description:
      "Timing companies can submit finished race results to Podium Watch for review, no account required.",
    pathname: "/submit-timing-results/",
    content
  });
}
