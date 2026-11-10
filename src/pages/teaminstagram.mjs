import { layout, pageHero } from "../lib/html.mjs";

// /teams/instagram/ (short link podiumwatch.org/ig), WO-44: anyone can add
// a school's Instagram account. Search the school, pick which account it
// is, enter the handle, and optionally leave a private email. Every
// submission waits for Podium Watch to check it before it shows on the
// team page. ?team=<team page slug> fills in the school.

const LABELS = ["Boys XC", "Girls XC", "XC & Track", "Boys Track", "Girls Track", "Athletics"];

const styles = `
  .tig-shell { display:grid; gap:18px; max-width:640px; margin:0 auto; }
  .tig-form { display:grid; gap:14px; padding:20px; border:1px solid var(--line); background:var(--white); }
  .tig-form label { display:grid; gap:6px; font-weight:800; }
  .tig-form input, .tig-form select { width:100%; box-sizing:border-box; padding:11px 12px; border:1px solid rgba(var(--black-rgb),.22); border-radius:8px; font:inherit; font-size:16px; background:var(--white); }
  .tig-form small { color:var(--muted); font-weight:600; }
  .tig-results { display:grid; gap:6px; margin:0; padding:0; list-style:none; }
  .tig-results button { width:100%; text-align:left; padding:10px 12px; border:1px solid var(--line); border-radius:8px; background:var(--white); font:inherit; cursor:pointer; }
  .tig-results button small { display:block; color:var(--muted); font-weight:600; }
  .tig-picked { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:10px 12px; border-radius:8px; background:var(--pale-green); font-weight:850; }
  .tig-picked button { border:0; background:none; font:inherit; font-weight:800; text-decoration:underline; cursor:pointer; }
  .tig-hp { position:absolute !important; left:-10000px !important; width:1px !important; height:1px !important; overflow:hidden !important; }
  .tig-message { margin:0; padding:12px; border-radius:8px; font-weight:800; }
  .tig-message[data-tone="success"] { background:rgba(var(--green-rgb),.14); }
  .tig-message[data-tone="error"] { background:rgba(220,38,38,.12); color:#991b1b; }
`;

export function teamInstagramPage(site) {
  const content = `<style>${styles}</style>
  ${pageHero({ eyebrow: "Team Instagram", title: "Add Your Team's Instagram", description: "Help fans find your team. Add each account your school runs: boys and girls cross country, track, or the whole athletic department." })}
  <section class="section section-paper"><div class="container tig-shell" data-tig>
    <form class="tig-form" data-tig-form novalidate>
      <label>School
        <input type="search" data-tig-search placeholder="Start typing your school" autocomplete="off">
      </label>
      <ul class="tig-results" data-tig-results></ul>
      <div class="tig-picked" data-tig-picked hidden><span data-tig-picked-name></span><button type="button" data-tig-change>Change</button></div>
      <label>Which account is this?
        <select name="label" required>
          <option value="">Choose one</option>
          ${LABELS.map((label) => `<option>${label}</option>`).join("")}
        </select>
      </label>
      <label>Instagram handle
        <input type="text" name="handle" required maxlength="80" placeholder="@teamhandle" autocomplete="off" autocapitalize="off" spellcheck="false">
      </label>
      <label>Your email <small>Optional. Private: only Podium Watch sees it, in case we have a question.</small>
        <input type="email" name="email" maxlength="320" autocomplete="email">
      </label>
      <label class="tig-hp" aria-hidden="true">Leave this blank<input type="text" name="pw_hp_field" tabindex="-1" autocomplete="off"></label>
      <p class="tig-message" data-tig-message role="status" hidden></p>
      <button class="button button-primary" type="submit" data-tig-submit>Submit for review</button>
      <small>Podium Watch checks every account before it shows on the team page. Have more than one? Submit each one.</small>
    </form>
  </div></section>
  <script src="/scripts/team-instagram-submit.js" defer></script>`;
  return layout({
    site,
    title: "Add Your Team's Instagram",
    description: "Add your Ohio high school cross country or track team's Instagram account to its Podium Watch team page.",
    pathname: "/teams/instagram/",
    content
  });
}
