import { oatcccLayout } from "./layout.mjs";
import { OATCCC_BASE } from "./config.mjs";

// Team verification pages (Part B groundwork), built only with
// OATCCC_LIVE=1 and OATCCC_VERIFICATION_LIVE=1:
//   /oatccc/admin/   the admin queue (Anjanette): list, filter, open,
//                    approve, return with a comment
//   /oatccc/verify/  the athletic director page: submit, status,
//                    comments, resubmit
// Both are private: noindex and out of the sitemap (NOINDEX_NOFOLLOW_PREFIXES
// in src/config/site.mjs). Data comes from /api/oatccc/verification/ as the
// signed-in user; nothing is in the HTML.
//
// Sign-in: email and password through Supabase Auth for now. How athletic
// directors sign in (magic link or a school code) is waiting on Anjanette;
// only the sign-in box in oatccc-verification.js changes when it is decided.

const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0";

function signInBox(who) {
  return `<section class="ox-vcard" data-ox-signin hidden>
    <h2>Sign in</h2>
    <p class="sub">${who}</p>
    <form class="ox-vform" data-ox-signin-form>
      <label>Email <input type="email" name="email" autocomplete="username" required></label>
      <label>Password <input type="password" name="password" autocomplete="current-password" required></label>
      <button class="btn" type="submit">Sign in</button>
      <p class="ox-vmsg" role="status" data-ox-signin-msg></p>
    </form>
  </section>`;
}

function shell({ site, flags, pathname, title, description, heading, intro, mode, body, who }) {
  const content = `<div class="ox-ver ox-wrap" data-ox-ver="${mode}">
    <div class="page-head">
      <h1>${heading}</h1>
      <p class="lead">${intro}</p>
      <p class="ox-vwho" data-ox-who hidden><span data-ox-who-text></span> <button class="btn ghost small" type="button" data-ox-signout>Sign out</button></p>
    </div>
    <section class="ox-vcard" data-ox-loading><p>Loading.</p></section>
    ${signInBox(who)}
    <section class="ox-vcard" data-ox-denied hidden><h2>No access</h2><p data-ox-denied-text>This account is not set up for OATCCC verification.</p></section>
    ${body}
  </div>`;
  return {
    pathname,
    html: oatcccLayout({
      site,
      flags,
      pathname,
      title,
      description,
      tab: "indoor",
      content,
      robots: "noindex, nofollow",
      headScripts: [SUPABASE_JS],
      scripts: ["/scripts/oatccc-verification.js"]
    })
  };
}

export function oatcccVerificationPages(site, flags) {
  const admin = shell({
    site,
    flags,
    pathname: `${OATCCC_BASE}admin/`,
    title: "OATCCC Verification Queue",
    description: "OATCCC Indoor State Meet team verification: the admin queue.",
    heading: "Team verification queue",
    intro: "Every verification form for the Indoor State Meet. Open one to approve it or return it with a comment.",
    mode: "admin",
    who: "For the OATCCC Indoor State Meet Chair.",
    body: `<div data-ox-app hidden>
      <div class="ox-vstats" data-ox-stats></div>
      <div class="ox-vfilters" role="group" aria-label="Filter by status" data-ox-filters></div>
      <div class="ox-vgrid">
        <section class="ox-vcard" aria-labelledby="ox-q-h">
          <h2 id="ox-q-h">Forms</h2>
          <div data-ox-queue></div>
        </section>
        <section class="ox-vcard" aria-live="polite" data-ox-detail>
          <h2>Open a form</h2>
          <p class="sub">Pick a form from the list to see its answers, comments and history.</p>
        </section>
      </div>
    </div>`
  });

  const ad = shell({
    site,
    flags,
    pathname: `${OATCCC_BASE}verify/`,
    title: "OATCCC Team Verification",
    description: "OATCCC Indoor State Meet team verification for athletic directors.",
    heading: "Team verification",
    intro: "Athletic directors: submit your school's verification form for the Indoor State Meet, see its status and answer any questions from the Chair. One form covers both the girls and boys teams.",
    mode: "ad",
    who: "For athletic directors.",
    body: `<div data-ox-app hidden>
      <div class="ox-vfilters" role="group" aria-label="Your schools" data-ox-schools></div>
      <div data-ox-school></div>
    </div>`
  });

  return [admin, ad];
}
