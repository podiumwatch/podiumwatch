import { layout, pageHero } from "../lib/html.mjs";

const styles = `
    .writer-profile-shell { display:grid; gap:24px; }
    .writer-profile-form { display:grid; gap:16px; max-width: 560px; }
    .writer-profile-form label { display:grid; gap:7px; font-weight:850; }
    .writer-profile-form input, .writer-profile-form textarea { width:100%; padding:10px 12px; border:1px solid rgba(var(--black-rgb),.22); border-radius:9px; background:var(--white); font:inherit; }
    .writer-profile-form textarea { min-height:110px; resize:vertical; }
    .writer-profile-message { padding:14px 16px; border-radius:10px; font-weight:700; }
    .writer-profile-message[data-tone="success"] { background:rgba(var(--green-rgb),.13); color:var(--green-ink); }
    .writer-profile-message[data-tone="error"] { background:rgba(220,38,38,.12); color:#7a1414; }
`;

export function writerPortalProfilePage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Writer Portal",
    title: "Your profile.",
    description: "This shows up on your author page once you have a published piece."
  })}

  <style>${styles}</style>

  <section class="section section-paper">
    <div class="container writer-profile-shell" data-writer-profile-loading>
      <div class="info-card"><h2>Loading your profile</h2><p>Please wait.</p></div>
    </div>

    <div class="container writer-profile-shell" data-writer-profile-root hidden>
      <a class="button button-outline" href="/writer-portal/" style="width:fit-content;">Back to your articles</a>

      <section class="info-card">
        <form class="writer-profile-form" data-writer-profile-form>
          <label>Name<input type="text" name="full_name" required maxlength="200"></label>
          <label>School<input type="text" name="school" maxlength="200"></label>
          <label>Grade<input type="text" name="grade" maxlength="30" placeholder="Freshman, Sophomore, Junior, or Senior"></label>
          <label>Short bio<textarea name="bio" maxlength="2000"></textarea></label>
          <p class="writer-profile-message" data-writer-profile-message role="status" hidden></p>
          <button class="button button-primary" type="submit">Save changes</button>
        </form>
      </section>
    </div>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0" defer></script>
  <script src="/scripts/writer-auth-client.js" defer></script>
  <script src="/scripts/writer-portal-profile.js" defer></script>`;

  return layout({
    site,
    title: "Your Profile",
    description: "Edit your Podium Watch Writer Portal profile.",
    pathname: "/writer-portal/profile/",
    content
  });
}
