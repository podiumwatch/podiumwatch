import { layout, pageHero } from "../lib/html.mjs";

// Public, no-login entry point for parents, coaches, and photographers to
// hand off bulk meet photos -- either a direct upload or a shared album
// link. Matches src/pages/submittimingresults.mjs's exact tone and
// two-step signed-upload mechanics; see public/scripts/submit-photos.js
// for the client-side compression that keeps this feature's storage cost
// low (design discussed 2026-09-30, install/69_PHOTO_SUBMISSIONS.sql).
const styles = `
    .submit-photos-shell { display:grid; gap:24px; }
    .submit-photos-steps { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px; }
    .submit-photos-step strong { display:grid; place-items:center; width:38px; height:38px; margin-bottom:14px; border-radius:50%; background:var(--green); color:var(--black); font-size:1rem; }
    .submit-photos-step h3, .submit-photos-step p { margin-bottom:0; }
    .submit-photos-tabs { display:flex; gap:8px; }
    .submit-photos-tab { padding:9px 16px; border-radius:999px; border:1px solid rgba(var(--black-rgb),.22); background:var(--white); font-weight:800; cursor:pointer; }
    .submit-photos-tab[aria-selected="true"] { background:var(--black); color:var(--white); border-color:var(--black); }
    .submit-photos-form { display:grid; gap:14px; }
    .submit-photos-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:13px; }
    .submit-photos-form label { display:grid; gap:7px; font-weight:850; }
    .submit-photos-form input, .submit-photos-form select, .submit-photos-form textarea { width:100%; padding:10px 12px; border:1px solid rgba(var(--black-rgb),.22); border-radius:9px; background:var(--white); font:inherit; }
    .submit-photos-wide { grid-column:1 / -1; }
    .submit-photos-checkbox { display:flex; flex-direction:row; align-items:flex-start; gap:9px; font-weight:600; }
    .submit-photos-checkbox input { width:auto; margin-top:3px; }
    .submit-photos-honeypot { position:absolute !important; left:-10000px !important; width:1px !important; height:1px !important; overflow:hidden !important; }
    .submit-photos-help { font-weight:500; color:var(--muted); }
    .submit-photos-message { padding:14px 16px; border-radius:10px; font-weight:700; }
    .submit-photos-message[data-tone="success"] { background:rgba(var(--green-rgb),.13); color:var(--green-ink); }
    .submit-photos-message[data-tone="error"] { background:rgba(220,38,38,.12); color:#7a1414; }
    .submit-photos-previews { display:grid; grid-template-columns:repeat(auto-fill,minmax(84px,1fr)); gap:8px; margin-top:4px; }
    .submit-photos-previews img { width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px; border:1px solid rgba(var(--black-rgb),.15); }
    .submit-photos-hidden { display:none !important; }
    @media (max-width:700px) {
      .submit-photos-fields, .submit-photos-steps { grid-template-columns:1fr; }
      .submit-photos-wide { grid-column:auto; }
    }
`;

export function submitPhotosPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Photo Intake",
    title: "Share your meet photos with us.",
    description:
      "Parents, coaches, and photographers can send meet photos for articles and Instagram, no account required. Upload photos directly or just share a link to an album you already have."
  })}

  <style>${styles}</style>

  <section class="section section-paper">
    <div class="container submit-photos-shell">
      <section class="info-card">
        <p class="eyebrow">How this works</p>
        <h2>Two ways to share, either one works</h2>
        <div class="submit-photos-steps" style="margin-top:18px;">
          <article class="submit-photos-step">
            <strong>1</strong>
            <h3>Upload or link</h3>
            <p>Upload photos straight from this page, or paste a link to a Google Photos, iCloud, or other album you already made.</p>
          </article>
          <article class="submit-photos-step">
            <strong>2</strong>
            <h3>Tell us the credit</h3>
            <p>Every submission needs a photo credit and your confirmation that we have permission to use these photos.</p>
          </article>
          <article class="submit-photos-step">
            <strong>3</strong>
            <h3>We pick what we use</h3>
            <p>Podium Watch reviews every submission privately and selects photos for articles and Instagram by hand.</p>
          </article>
        </div>
      </section>

      <section class="info-card">
        <div><p class="eyebrow">Submit photos</p><h2>Meet photo submission</h2></div>
        <div class="submit-photos-tabs" role="tablist">
          <button type="button" class="submit-photos-tab" role="tab" aria-selected="true" data-photos-tab="upload">Upload photos</button>
          <button type="button" class="submit-photos-tab" role="tab" aria-selected="false" data-photos-tab="link">Share an album link</button>
        </div>
        <form class="submit-photos-form" data-submit-photos-form>
          <input type="hidden" name="source_type" value="upload" data-photos-source-type>
          <div class="submit-photos-fields">
            <label>Your name<input type="text" name="submitter_name" required maxlength="200"></label>
            <label>Contact email<input type="email" name="submitter_email" required maxlength="320"></label>
            <label>You are a<select name="submitter_role"><option value="parent">Parent</option><option value="coach">Coach</option><option value="photographer">Photographer</option><option value="other" selected>Other</option></select></label>
            <label>Photo credit (how we should credit you)<input type="text" name="credit_name" required maxlength="200"></label>
            <label>Meet name<input type="text" name="meet_name" required maxlength="300" placeholder="Springfield Invitational"></label>
            <label>Meet date<input type="date" name="meet_date"></label>
            <label class="submit-photos-wide">School (optional)<input type="text" name="school_name" maxlength="300" placeholder="Leave blank if multiple schools"></label>

            <label class="submit-photos-wide" data-photos-upload-field>Photos<input type="file" name="photos_file" accept="image/jpeg,image/png,image/webp" multiple></label>
            <p class="submit-photos-wide submit-photos-help" data-photos-upload-field>Up to 150 photos. Each one is resized in your browser before uploading, so this works even on a slow connection.</p>
            <div class="submit-photos-wide submit-photos-previews" data-photos-previews></div>

            <label class="submit-photos-wide submit-photos-hidden" data-photos-link-field>Album link<input type="url" name="album_url" maxlength="2000" placeholder="https://photos.app.goo.gl/..."></label>
            <p class="submit-photos-wide submit-photos-help submit-photos-hidden" data-photos-link-field>Make sure the link is set to "anyone with the link can view" so we can see the photos.</p>

            <label class="submit-photos-wide">Anything else we should know? (optional)<textarea name="permission_note" maxlength="2000" rows="2"></textarea></label>
            <label class="submit-photos-wide submit-photos-checkbox"><input type="checkbox" name="permission_confirmed" required value="true"> I confirm I have permission to share these photos with Podium Watch, and understand Podium Watch may use them in articles and on social media with credit.</label>
            <label class="submit-photos-honeypot" aria-hidden="true">Leave this blank<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
          </div>
          <p class="submit-photos-message" data-submit-photos-message role="status" hidden></p>
          <button class="button button-dark" type="submit" data-submit-photos-button>Submit photos</button>
        </form>
      </section>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/submit-photos.js" defer></script>`;

  return layout({
    site,
    title: "Submit Meet Photos",
    description:
      "Parents, coaches, and photographers can submit meet photos to Podium Watch for review, no account required.",
    pathname: "/submit-photos/",
    content
  });
}
