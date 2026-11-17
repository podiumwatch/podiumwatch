import { oatcccLayout, linkAttrs, LOGO } from "./layout.mjs";
import { LINKS, OATCCC_BASE, indoorPath, indoorHref } from "./config.mjs";

// /oatccc/ -- the OATCCC homepage. Layout, wording and dates from the
// approved hub preview (OATCCC-Hub-PREVIEW.html, 2026-11-16), without its
// "Preview" banner and pop-up messages. "Athletic director sign-in" shows
// only with OATCCC_VERIFICATION_LIVE.
export function oatcccHubPage(site, flags) {
  const eligibility = indoorPath("eligibility");
  const meetInfo = indoorHref("overview", flags);
  const adSignIn = flags.verification
    ? `<a class="btn2" href="${OATCCC_BASE}verify/">Athletic director sign-in</a>`
    : "";

  const mast = `<header class="ox-hubmast"><div class="ox-wrap">
  <img src="${LOGO.medium}" width="76" height="76" alt="OATCCC logo">
  <div><small>Ohio Association of Track &amp; Cross Country Coaches</small><h1>OATCCC</h1><p>Coaches serving Ohio cross country and track and field since 1941.</p></div>
</div></header>`;

  const content = `<div class="ox-hub ox-wrap">

  <section class="ox-next" aria-label="Next deadline">
    <div class="when">Dec 1<span>Tuesday</span></div>
    <div>
      <span class="tag">Next up</span>
      <h2>Indoor verification forms go to athletic directors</h2>
      <p>Performances start counting toward the 2027 Indoor State Meet the same day. Verification is due Feb 5, 2027 at 11:59 PM.</p>
    </div>
    <div class="acts"><a class="btn2 w" href="${eligibility}">Eligibility &amp; Verification</a>${adSignIn}</div>
  </section>

  <div class="ox-grid3">
    <article class="ox-card main">
      <span class="k">High School</span>
      <h3>2027 Indoor State Championship</h3>
      <p class="d">March 5&ndash;6, 2027 &middot; SPIRE Institute, Geneva</p>
      <p>Divisions 3 and 4 on Friday. Divisions 1, 2 and Seated on Saturday.</p>
      <a class="go"${linkAttrs(meetInfo)}>Meet information</a>
    </article>
    <article class="ox-card">
      <span class="k">Clinic</span>
      <h3>2027 Track &amp; Field Coaches Clinic</h3>
      <p class="d">January 28&ndash;30, 2027 &middot; Hilton Columbus at Easton</p>
      <p>Preregistration closes Monday, January 25 at noon.</p>
      <a class="go"${linkAttrs(LINKS.clinic)}>Clinic details</a>
    </article>
    <article class="ox-card">
      <span class="k">Middle School</span>
      <h3>Middle School Indoor State Meet</h3>
      <p class="d">2027 date and site coming soon</p>
      <p>Registration runs through MileSplit Ohio.</p>
      <span class="soon">Details posted when the OATCCC confirms them</span>
    </article>
  </div>

  <div class="ox-two">
    <section class="ox-panel" aria-labelledby="ox-cal-h">
      <h2 id="ox-cal-h">Indoor season calendar</h2>
      <p class="sub">2027 Indoor State Meet. All times Eastern.</p>
      <ul class="ox-cal">
        <li><b>Dec 1<small>Tue</small></b><span>Verification forms emailed to athletic directors<em>Performances start counting</em></span></li>
        <li class="dl"><b>Feb 5<small>Fri</small></b><span>Verification due, 11:59 PM</span></li>
        <li><b>Feb 6<small>Sat</small></b><span>Late verification opens, 12:00 AM<em>$100 fine</em></span></li>
        <li class="dl"><b>Feb 15<small>Mon</small></b><span>Late verification closes, 5:00 PM<em>$100 fine</em></span></li>
        <li><b>Feb 21<small>Sun</small></b><span>Performance window closes</span></li>
        <li><b>Feb 24<small>Wed</small></b><span>Performance lists posted, declarations open at noon</span></li>
        <li class="big"><b>Mar 5&ndash;6<small>Fri&ndash;Sat</small></b><span>Indoor State Championship<em>SPIRE Institute, Geneva</em></span></li>
      </ul>
    </section>

    <div>
      <section class="ox-panel" aria-labelledby="ox-mem-h">
        <h2 id="ox-mem-h">For coaches</h2>
        <div class="ox-join">
          <h3>Join or renew for 2026-2027</h3>
          <p>Coaches must be paid members for the 2026-2027 academic year. The membership is only required for coaches to enter athletes in the Indoor State Meet.</p>
          <a class="btn2"${linkAttrs(LINKS.join)}>Join the OATCCC</a>
        </div>
      </section>
      <section class="ox-panel" aria-labelledby="ox-ppl-h" style="margin-top:18px">
        <h2 id="ox-ppl-h">Who to contact</h2>
        <ul class="ox-people">
          <li><b>Matt Schock</b><span>President</span></li>
          <li><b>Anjanette Whitman</b><span>Indoor State Meet Chair</span></li>
          <li><b>Doug Joy</b><span>Middle School Indoor State Chair</span></li>
          <li><b>Wayne Clark</b><span>Track Clinic Chairman</span></li>
        </ul>
        <a class="btn2 o"${linkAttrs(LINKS.contact)} style="margin-top:12px">All contacts</a>
      </section>
    </div>
  </div>

  <div class="ox-progs">
    <a class="ox-prog"${linkAttrs(LINKS.coachesPoll)}><h3>Coaches&rsquo; Polls</h3><p>Every division, boys and girls, all season.</p></a>
    <a class="ox-prog"${linkAttrs(LINKS.hallOfFame)}><h3>Hall of Fame</h3><p>Inductees from 1964 to 2026.</p></a>
    <a class="ox-prog"${linkAttrs(LINKS.academicAllOhio)}><h3>Academic All-Ohio</h3><p>State qualifiers with a 3.5 GPA or better.</p></a>
    <div class="ox-prog"><h3>Scholarships &amp; Grants</h3><p>Marv Crosten, Dale Gabor Seated Athlete and elementary school grants.</p>
      <p class="links"><a${linkAttrs(LINKS.crostenScholarship)}>Marv Crosten</a><a${linkAttrs(LINKS.gaborScholarship)}>Dale Gabor</a><a${linkAttrs(LINKS.elementaryGrant)}>Elementary grants</a></p></div>
  </div>
</div>`;

  return oatcccLayout({
    site,
    flags,
    pathname: OATCCC_BASE,
    title: "OATCCC",
    description: "The Ohio Association of Track & Cross Country Coaches on Podium Watch: the 2027 Indoor State Championship, the indoor season calendar, coaches' membership and contacts.",
    tab: "home",
    mast,
    content
  });
}
