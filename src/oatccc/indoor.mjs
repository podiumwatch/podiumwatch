import { oatcccLayout, linkAttrs, LOGO } from "./layout.mjs";
import { INDOOR_PAGES, LINKS, indoorPath, indoorHref } from "./config.mjs";
import { escapeHtml } from "../lib/content.mjs";
import { formTextHtml } from "./verification_form_text.mjs";

// High School Indoor State Meet pages, /oatccc/indoor/high-school/...
//
// ABCs, Divisions and Eligibility & Verification: ported from the private
// review draft (the private review copy). Review notes, note
// markers, highlight marks, the DRAFT banner, the Questions page and the
// concept page are removed; no other wording is changed.
//
// Overview, Declarations and fees, Meet day and FAQ: copied word for word
// from https://www.oatccc.com/Indoor-Track-Field/High-School-State-Meet/
// (fetched 2026-11-16), conflicts and all (Zachary: "Don't fix them").
// They are built only with OATCCC_INDOOR_FULL_LIVE.
//
// 2026-11-17: Anjanette's answers applied to ABCs, Divisions, Eligibility
// (OATCCC_ANJANETTE_ANSWERS_HANDOFF.md, Part 1). Her sentences are used
// as she wrote them. The official agreement terms on Eligibility are now
// the verification form text itself (verification_form_text.mjs). On the
// FAQ only "for that calendar year" changed (bylaws now academic year).

const ext = (href, text) => `<a${linkAttrs(href)}>${text}</a>`;

function masthead() {
  return `<header class="ox-masthead"><div class="ox-wrap">
  <div class="ox-brand">
    <img src="${LOGO.medium}" alt="OATCCC logo" width="68" height="68">
    <div>
      <span class="ox-brand-org">Ohio Association of Track &amp; Cross Country Coaches</span>
      <span class="ox-brand-meet">2027 Indoor State Championship Meet</span>
    </div>
  </div>
</div></header>
<div class="ox-meetstrip"><div class="ox-wrap">
  <div class="ox-fact"><b>Spire Institute</b><span>Where the meet is held</span></div>
  <div class="ox-fact"><b>Friday, March 5, 2027</b><span>Divisions 3 and 4</span></div>
  <div class="ox-fact"><b>Saturday, March 6, 2027</b><span>Divisions 1, 2 and Seated</span></div>
</div></div>`;
}

function secnav(current, flags) {
  const items = INDOOR_PAGES.map((page) => {
    const href = indoorHref(page.key, flags);
    const isCurrent = page.key === current ? ' aria-current="page"' : "";
    const away = /^https?:/.test(href) ? "<small>On oatccc.com</small>" : "";
    return `<li><a${linkAttrs(href)}${isCurrent}>${escapeHtml(page.label)}${away}</a></li>`;
  }).join("");
  const label = INDOOR_PAGES.find((page) => page.key === current)?.label || "";
  // Open by default (works without JavaScript); oatccc.js folds it on
  // phones and keeps it open on wide screens.
  return `<details class="ox-secnav" open>
    <summary><span>Indoor State Meet<small>${escapeHtml(label)}</small></span><span class="chev" aria-hidden="true"></span></summary>
    <nav aria-label="Indoor State Meet"><ul>${items}</ul></nav>
  </details>`;
}

function contactBand() {
  return `<div class="ox-contact" id="contact">
    <div>
      <h2>Questions?</h2>
      <p>Email the Indoor State Meet Chair, Anjanette Whitman, at ${LINKS.chairEmail}.</p>
    </div>
    <a class="btn" href="${escapeHtml(LINKS.chairMailto)}">Email the Indoor State Meet Chair</a>
  </div>`;
}

function keyDates(prefix) {
  return `<aside class="keydates" aria-labelledby="${prefix}-kd-h">
      <h2 id="${prefix}-kd-h">Key dates</h2>
      <p>Dates to know for the 2027 meet, in order. All times are Eastern Time.</p>
      <div class="kd-year">2026</div>
      <ol class="kd-list">
        <li class="kd"><div class="kd-date"><b>Dec 1</b><span>Tuesday</span></div><div><span class="kd-what">Verification forms are emailed to athletic directors</span><span class="kd-detail">Performances start counting toward the State Meet.</span></div></li>
      </ol>
      <div class="kd-year">2027</div>
      <ol class="kd-list">
        <li class="kd deadline"><div class="kd-date"><b>Feb 5</b><span>Friday</span></div><div><span class="tag dl">Deadline</span><span class="kd-what">Verification forms are due</span><span class="kd-detail">By 11:59 pm.</span></div></li>
        <li class="kd"><div class="kd-date"><b>Feb 6</b><span>Saturday</span></div><div><span class="kd-what">Late verification forms open</span><span class="kd-detail">At 12:00 am (midnight), with a $100 fine.</span></div></li>
        <li class="kd deadline"><div class="kd-date"><b>Feb 15</b><span>Monday</span></div><div><span class="tag dl">Deadline</span><span class="kd-what">Last day for late verification forms</span><span class="kd-detail">By 5:00 pm. No forms are accepted after that.</span></div></li>
        <li class="kd deadline"><div class="kd-date"><b>Feb 21</b><span>Sunday</span></div><div><span class="tag dl">Deadline</span><span class="kd-what">Last day for performances to count</span><span class="kd-detail">Performances on February 21 count.</span></div></li>
        <li class="kd"><div class="kd-date"><b>Feb 24</b><span>Wednesday</span></div><div><span class="kd-what">Finalized top 30 performance lists are posted</span></div></li>
        <li class="kd"><div class="kd-date"><b class="range">Feb 24&ndash;26</b><span>Wed to Fri</span></div><div><span class="kd-what">Declare entries</span><span class="kd-detail">Wednesday at 12:00 noon to Friday at 11:59 pm.</span></div></li>
        <li class="kd deadline"><div class="kd-date"><b>Feb 27</b><span>Saturday</span></div><div><span class="tag dl">Deadline</span><span class="kd-what">Scratch window</span><span class="kd-detail">12:01 am to 12:00 noon. It is open for 12 hours only.</span></div></li>
        <li class="kd"><div class="kd-date"><b>Mar 1</b><span>Monday</span></div><div><span class="kd-what">Final acceptance lists posted</span></div></li>
        <li class="kd deadline"><div class="kd-date"><b>Mar 4</b><span>Thursday</span></div><div><span class="tag dl">Deadline</span><span class="kd-what">Entry fees due by 12noon</span></div></li>
        <li class="kd"><div class="kd-date"><b>Mar 5</b><span>Friday</span></div><div><span class="kd-what">Divisions 3 and 4 compete</span><span class="kd-detail">Registration fees for this day&rsquo;s entries are due by 12:00 noon.</span></div></li>
        <li class="kd"><div class="kd-date"><b>Mar 6</b><span>Saturday</span></div><div><span class="kd-what">Divisions 1, 2 and Seated compete</span><span class="kd-detail">Registration fees for this day&rsquo;s entries are due by 12:00 noon.</span></div></li>
      </ol>
    </aside>`;
}

// ---------- Pages from the review draft ----------

function abcsBody() {
  return `<div class="ox-page has-dates dates-last">
    <div class="page-head">
      <h1>ABCs of the Indoor Season</h1>
      <p class="lead">What athletes, coaches and schools need to know for the indoor season, in three parts: A, B and C.</p>
    </div>

    ${keyDates("a")}

    <div class="abc">
      <span class="abc-letter" aria-hidden="true">A</span>
      <h2><span class="sr">A: </span>Athletes</h2>
      <div class="pair">
        <div class="verdict">
          <h3>Attached</h3>
          <ul class="sum">
            <li>Member of your high school team</li>
            <li>Meets OHSAA eligibility requirements to participate in athletics</li>
          </ul>
          <p class="result"><b>Eligible</b> to compete in Indoor State Meet</p>
        </div>
        <div class="verdict no">
          <h3>Unattached</h3>
          <ul class="sum">
            <li><strong>NOT</strong> entered as member of your high school team</li>
          </ul>
          <p class="result"><b>NOT eligible</b> to compete in OATCCC Indoor State Meet</p>
        </div>
      </div>
      <p class="fine">All eligible marks for the State Meet must be made when athlete entered as a member of a team</p>
    </div>

    <div class="abc">
      <span class="abc-letter" aria-hidden="true">B</span>
      <h2><span class="sr">B: </span>Board approved &amp; recognized</h2>
      <dl class="reqs">
        <div><dt>Coaches</dt><dd>Must be approved by your Board of Education</dd></div>
        <div><dt>OATCCC membership</dt><dd>Coaches must be paid OATCCC members for the 2026-2027 academic year in order for their athletes to be eligible to compete in the Indoor State Meet</dd></div>
        <div><dt>Indoor team</dt><dd>Must be recognized by your Board of Education</dd></div>
        <div><dt>Proof</dt><dd>Online verification agreement must be signed &amp; submitted by AD to compete in OATCCC State Meet</dd></div>
      </dl>
    </div>

    <div class="abc">
      <span class="abc-letter" aria-hidden="true">C</span>
      <h2><span class="sr">C: </span>Compete</h2>
      <dl class="reqs">
        <div><dt>School team</dt><dd><strong>Must</strong> compete in at least one indoor meet to be considered an interscholastic program</dd></div>
        <div><dt>Length of season</dt><dd>Determined by the school</dd></div>
        <div><dt>Catastrophic insurance</dt><dd>Secured by the school <span class="warn">OHSAA insurance does NOT cover participation</span></dd></div>
      </dl>
    </div>

    <p class="fine" style="margin-top:30px">For more info &amp; updates, go to: ${ext("https://www.oatccc.com", "www.oatccc.com")}</p>
    <div class="nextsteps">
      <a class="btn" href="${indoorPath("eligibility")}">Read the full eligibility rules</a>
    </div>
  </div>`;
}

function enrollmentTable(label, rows) {
  return `<table class="enroll-t">
          <caption>${label}</caption>
          <thead><tr><th scope="col">Division</th><th scope="col">Enrollment</th></tr></thead>
          <tbody>${rows.map(([division, range]) => `<tr><th scope="row">${division}</th><td>${range}</td></tr>`).join("")}</tbody>
        </table>`;
}

// "Divisions by school" (OATCCC_DIVISION_LIST_LIVE, off until Anjanette
// confirms the school-list data issues). The rows come from
// /api/oatccc/divisions (the OATCCC's workbook, loaded into the database);
// none of that data is in this repository. oatccc-divisions.js fills it.
function divisionListSection() {
  return `<section id="by-school" aria-labelledby="d-school-h" data-ox-divisions>
      <h2 id="d-school-h">Divisions by school</h2>
      <p>Find your school&rsquo;s 2027 boys and girls divisions. Schools are listed by their OHSAA tournament name.</p>
      <div class="dlist-tools">
        <label for="dlist-q">Search for a school or city</label>
        <input id="dlist-q" type="search" autocomplete="off" spellcheck="false" placeholder="For example: Mason" data-ox-divisions-q>
      </div>
      <p class="dlist-status" role="status" aria-live="polite" data-ox-divisions-status>Loading the list&hellip;</p>
      <div class="dlist-wrap">
        <table class="dlist" hidden data-ox-divisions-table>
          <thead><tr><th scope="col">School</th><th scope="col">City</th><th scope="col">Boys</th><th scope="col">Girls</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>`;
}

function divisionsBody(flags = {}) {
  const divisionList = flags.divisionList ? divisionListSection() : "";
  const pending = `<td class="pending" data-l="Ohio MileSplit page">Link will be added when it is posted</td>`;
  return `<div class="ox-page has-dates dates-last">
    <div class="page-head">
      <h1>Divisions</h1>
      <p class="lead">Four School Divisions for the Indoor State Meet! Athletes qualify within their own division, and each division has its own Ohio MileSplit page.</p>
    </div>

    ${keyDates("d")}

    <section aria-labelledby="d-find-h">
      <h2 id="d-find-h">When each division competes</h2>
      <table class="divs">
        <thead><tr><th scope="col">Division</th><th scope="col">Competes</th><th scope="col">Ohio MileSplit page</th></tr></thead>
        <tbody>
          <tr><th scope="row">Division 1</th><td class="day" data-l="Competes"><b>Saturday, March 6, 2027</b></td>${pending}</tr>
          <tr><th scope="row">Division 2</th><td class="day" data-l="Competes"><b>Saturday, March 6, 2027</b></td>${pending}</tr>
          <tr><th scope="row">Division 3</th><td class="day" data-l="Competes"><b>Friday, March 5, 2027</b></td>${pending}</tr>
          <tr><th scope="row">Division 4</th><td class="day" data-l="Competes"><b>Friday, March 5, 2027</b></td>${pending}</tr>
          <tr><th scope="row">Seated Division</th><td class="day" data-l="Competes"><b>Saturday, March 6, 2027</b></td>${pending}</tr>
        </tbody>
      </table>
    </section>

    <section aria-labelledby="d-how-h">
      <h2 id="d-how-h">How athletes and relays qualify in Divisions 1 to 4</h2>
      <p>The steps apply equally to athletes and relays. The finalized performance lists are the finalized top 30 lists.</p>
      <ol class="steps">
        <li><b>Make the top 30</b><span>Each division has a finalized top 30 list for each event. Finalized top 30 performance lists are posted February 24, 2027.</span></li>
        <li><b>Declare</b><span>An athlete or relay on the list is considered only if an entry is declared. Declarations are open from Wednesday, February 24, at 12:00 noon to Friday, February 26, 2027, at 11:59 pm.</span></li>
        <li><b>The top 16 qualify</b><span>The top 16 declared athletes or relays in each event qualify for the State Meet in their division.</span></li>
      </ol>
      <p class="fine">This is the rule in the OATCCC&rsquo;s words: &ldquo;The top 16 declared athletes in each event from the top 30 performance lists in each Division qualify for the State Meet in their Division.&rdquo;</p>
    </section>

    <section aria-labelledby="d-seat-h">
      <div class="seated">
        <h2 id="d-seat-h">Seated Division</h2>
        <ul class="plain">
          <li>No performance qualification standards</li>
          <li>Direct registration on MileSplit</li>
          <li>Must be a member of a verified team. <a href="${indoorPath("eligibility")}#verification">See how verification works.</a></li>
        </ul>
        <p>The references to the finalized performance lists do not apply to seated athletes. All seated athletes are entered in the meet so long as they have one performance time or mark to submit. They must declare in the same window of time as the other divisions February 24-26. Same fees apply but there are no relays.</p>
      </div>
    </section>

    <section aria-labelledby="d-set-h">
      <h2 id="d-set-h">How divisions are set</h2>
      <p>Divisions are based on 2026-2027 OHSAA Enrollment Figures. Division 1 is determined by the enrollment figure of the top 15% of the schools verified for the 2026 Indoor Track &amp; Field Season. The other 3 divisions equally divide the remaining verified schools from the 2026 Indoor Track &amp; Field Season and use those enrollment figures.</p>
      <div class="enroll">
        ${enrollmentTable("Girls", [["D-1", "449 and up"], ["D-2", "207 - 448"], ["D-3", "124 - 206"], ["D-4", "1 - 123"]])}
        ${enrollmentTable("Boys", [["D-1", "465 and up"], ["D-2", "221 - 464"], ["D-3", "125 - 220"], ["D-4", "1 - 124"]])}
      </div>
    </section>
    ${divisionList}
  </div>`;
}

function eligibilityBody(flags = {}) {
  return `<div class="ox-page has-dates">
    <div class="page-head">
      <h1>Eligibility &amp; Verification</h1>
      <p class="lead">Before an athlete can compete at the 2027 Indoor State Meet, the school&rsquo;s athletic director must verify the team. Coaches, athletes and performances must also meet the rules on this page.</p>
      <p class="onpage"><b>On this page</b>
        <a href="#todo">What you need to do</a>
        <a href="#verification">How verification works</a>
        <a href="#verified-list">2027 School Verification List</a>
        <a href="#mistakes">Mistakes to avoid</a>
        <a href="#terms">Official agreement terms</a>
        <a href="#contact">Questions</a>
      </p>
    </div>

    ${keyDates("e")}

    <section id="todo" aria-labelledby="todo-h">
      <h2 id="todo-h">What you need to do</h2>
      <div class="roles">
        <div class="role">
          <h3>Athletic directors</h3>
          <ul class="checks">
            <li>Watch for the verification email. It is sent to all OHSAA listed athletic directors starting December 1, 2026.</li>
            <li>Sign and submit one online form for your school, using the link emailed to you. It covers both the girls and boys teams.</li>
            <li>Submit it by <span class="when">Friday, February 5, 2027, at 11:59 pm</span>.</li>
            <li>Late forms are accepted from <span class="when">Saturday, February 6, 2027, at 12:00 am (midnight)</span> to <span class="when">Monday, February 15, 2027, at 5:00 pm</span>, with a $100 fine. No forms are accepted after that.</li>
          </ul>
        </div>
        <div class="role">
          <h3>Coaches</h3>
          <ul class="checks">
            <li>Be recognized and approved by your local Board of Education for 2026-2027.</li>
            <li>Be a paid OATCCC member for the 2026-2027 academic year. The membership is only required for coaches to enter athletes in the Indoor State Meet. ${ext(LINKS.join, "Join the OATCCC")}. Select Login/Signup and follow the prompts.</li>
            <li>Make sure athletes are entered for your school team at meets that use MileSplit for registration.</li>
          </ul>
        </div>
        <div class="role">
          <h3>Athletes and parents</h3>
          <ul class="checks">
            <li>Compete as a member of your school&rsquo;s indoor team. Marks made &ldquo;unattached&rdquo; or with a club team do not count.</li>
            <li>Meet your local Board of Education and OHSAA eligibility requirements.</li>
            <li>Earn your marks from December 1, 2026, through and including <span class="when">February 21, 2027</span>, at meets that use MileSplit for registration.</li>
            <li>Make sure your school&rsquo;s team is verified. <a href="#verified-list">See the verification list.</a></li>
            <li>In Divisions 1 to 4, be on the finalized top 30 lists posted on Ohio MileSplit. Being on the lists is only the first step. An entry must also be declared, and the top 16 declared athletes or relays in each event qualify. Finalized top 30 performance lists are posted February 24, 2027. <a href="${indoorPath("divisions")}">See Divisions.</a></li>
            <li>The Seated Division has no performance qualification standards. All seated athletes are entered in the meet so long as they have one performance time or mark to submit. <a href="${indoorPath("divisions")}">See Divisions.</a></li>
          </ul>
        </div>
        <div class="role">
          <h3>State Meet entries</h3>
          <ul class="checks">
            <li>The coach or person designated by the coach declares, scratches, and pays. The scratch link and the payment link are posted on the MileSplit meet page for each division. The scratch link is posted during the scratch window. The payment link is posted and active once the final acceptance lists are posted.</li>
            <li>Declare each entry from <span class="when">Wednesday, February 24, at 12:00 noon</span> to <span class="when">Friday, February 26, 2027, at 11:59 pm</span>.</li>
            <li>If you need to scratch (withdraw) an athlete or relay, do it on <span class="when">Saturday, February 27, 2027</span>, between 12:01 am and 12:00 noon.</li>
            <li>The entry fees are due by 12 noon the day of the meet that the team or athlete is competing.</li>
          </ul>
        </div>
      </div>
    </section>

    <section id="verification" aria-labelledby="ver-h">
      <h2 id="ver-h">How verification works</h2>
      <div class="two">
        <div>
          <h3>Verification Forms</h3>
          <ul class="plain">
            <li>Online verification forms are emailed to all OHSAA listed athletic directors starting on December 1st.</li>
            <li>The link is emailed to the AD. If the AD does not receive or cannot find the email, they need to email the Indoor State Meet Chairperson for the link.</li>
            <li><strong>The verification form link is not available on this website. It is emailed directly to each school&rsquo;s athletic director.</strong></li>
            <li>Only one form per school is needed to cover both girls and boys teams.</li>
          </ul>
        </div>
        <div>
          <h3>Verification Lists</h3>
          <ul class="plain">
            <li>The list includes all schools with teams verified by their athletic director.</li>
            <li>The list covers both girls and boys teams for the school listed.</li>
          </ul>
        </div>
      </div>
      <div class="tip">
        <h3>Of note</h3>
        <p>Athletic directors should check their spam folders if they do not see the verification email in their inbox.</p>
        <p>If the fields in the form cannot be seen, use internet that is not school-based as the filters may block the content. Use home or cellular service instead.</p>
      </div>
    </section>

    <section id="verified-list" aria-labelledby="vl-h">
      <h2 id="vl-h">2027 School Verification List</h2>
      <div class="vlist">
        <p>The list of verified schools will appear here.</p>
        <p>If you do not see your school listed, ask your AD if they submitted the online form emailed to them. If they can't find it, contact the Indoor State Meet Chairperson.</p>
      </div>
    </section>

    <section id="mistakes" aria-labelledby="mis-h">
      <h2 id="mis-h">Mistakes to avoid</h2>
      <ul class="mistakes">
        <li><b>Competing unattached or for a club team</b>Those performances are not eligible. An athlete&rsquo;s affiliation cannot be changed after the performance.</li>
        <li><b>Counting a meet that only posts results on MileSplit</b>The meet must use MileSplit for its registration process. Results listed on MileSplit are not enough.</li>
        <li><b>Missing the verification deadline</b>Forms received after February 5 require a $100 fine. After Monday, February 15, 2027, at 5:00 pm, no forms are accepted. Athletes on a team that has not been verified are left off the finalized performance lists and cannot compete.</li>
        <li><b>Planning to substitute after a scratch</b>No substitutions can be made. The next declared entry from any team moves up, and a scratch cannot be undone.</li>
        <li><b>Expecting a refund</b>No refunds are issued if athletes do not compete.</li>
        <li><b>Paying late</b>If the registration fee is not paid by 12:00 noon on the day of the meet, the athlete or team does not compete.</li>
        <li><b>A coach or athlete who does not meet the rules</b>The OATCCC may exclude the team, or any of its athletes or coaches, from the State Meet and apply sanctions to the team&rsquo;s future participation in OATCCC events.</li>
      </ul>
    </section>

    <section id="terms" aria-labelledby="terms-h">
      <h2 id="terms-h">Official agreement terms</h2>
      ${flags.terms ? `<p class="section-intro">The terms in the verification form signed by the athletic director are the official rules. They are the same as the content shown in the verification section. This is that form&rsquo;s text, word for word.</p>
      <div class="terms-tools">
        <button class="btn ghost small" type="button" data-ox-print>Print this page</button>
      </div>
      <div class="formtext">
        ${formTextHtml({ heading: 3 })}
      </div>` : `<p class="section-intro">The terms in the verification form signed by the athletic director are the official rules.</p>`}
    </section>
  </div>`;
}

// ---------- Pages copied from oatccc.com (OATCCC_INDOOR_FULL_LIVE) ----------

const milesplit = ext(LINKS.milesplitOhio, "MileSplit Ohio");
const contactUrl = ext(LINKS.contact, "https://www.oatccc.com/Contact-Us/");

function overviewBody() {
  return `<div class="ox-page">
    <div class="page-head">
      <h1>2027 Indoor High School State Championship Meet</h1>
    </div>
    <section aria-labelledby="o-meet-h">
      <div class="block">
        <h2 id="o-meet-h">2027 Indoor State Championship Meet</h2>
        <h3>Spire Institute</h3>
        <ul>
          <li>D3 &amp; D4 Fri., March 5, 2027</li>
          <li>D1, D2 &amp; Seated Sat., March 6, 2027</li>
        </ul>
      </div>
    </section>
    <section aria-labelledby="o-perf-h">
      <h2 id="o-perf-h">Performance List Information</h2>
      <div class="block">
        <p><strong>NEW for 2027</strong></p>
        <p>The OAT&amp;CCC Performance Lists in each division (D1, D2, D3 &amp; D4) posted on MileSplit will reflect only the TOP 30 athletes or relay teams in each event on verified teams. The lists will be posted on ${milesplit}</p>
        <p>Only marks meeting the following requirements will be included on the performance lists:</p>
        <ul>
          <li>Performances must occur during the 2027 indoor track &amp; field season from December 1, 2026 until February 21, 2027.</li>
          <li>Performances must occur at an indoor track &amp; field meet that uses MileSplit for its registration process, regardless of the state in which the meet is contested. Note&mdash;Performances from meets that have results listed on MileSplit but did not use MileSplit for the registration process shall not be considered for eligibility in the 2027 OATCCC Indoor State Track &amp; Field Championship Meet.</li>
          <li>Performances shall be by an athlete entered in a meet using MileSplit registration and the athlete must be entered as representing their verified school&rsquo;s Indoor Track &amp; Field team. Performances by athletes designated as &ldquo;unattached&rdquo; or with a club team shall not be eligible to be considered for the 2027 OATCCC Indoor State Track &amp; Field Championship Meet. An athlete&rsquo;s affiliation associated with a performance shall not be changed after the performance has been accomplished to comply with this requirement as stated.</li>
          <li>Races 200m and longer performed on a 200m track flat track are converted to times as though they were performed on a banked or 300m track shown only on officially posted performance lists on MileSplit. These times will not show on the drop-down rankings, in the meet results, or on an athlete&rsquo;s profile.</li>
          <li>The starting heights in the high jump and pole vault will be posted after the final acceptance lists are posted.</li>
        </ul>
        <p>The final performance lists posted on ${milesplit} on February 24, 2027, will only reflect athletes who are members of verified indoor track &amp; field teams.</p>
      </div>
    </section>
    <section aria-labelledby="o-qual-h">
      <h2 id="o-qual-h">Qualification</h2>
      <div class="block">
        <p>To be eligible for participation in the Indoor State Meet:</p>
        <ul>
          <li>An athlete or relay team must be listed on the FINAL TOP 30 PERFORMANCE LIST posted on ${milesplit} for each event in which they intend to compete.</li>
          <li>The top 16 athletes or relay teams in each event that declare their intent to compete will be accepted into the meet.</li>
          <li>Each school is limited to 2 entries in any individual event and 1 relay team per relay event.</li>
        </ul>
      </div>
    </section>
    <section aria-labelledby="o-host-h">
      <h2 id="o-host-h">Meet Hosts &amp; Timers</h2>
      <div class="block">
        <p>Thank you for hosting and timing meets during the Indoor Track &amp; Field season. Your efforts help make the experience great for everyone.</p>
        <p>The main criteria to make your meet a qualifying meet to the OAT&amp;CCC Indoor State Track &amp; Field State Meet is that the registration for your meet must be completed through MileSplit.com supported by any state&rsquo;s MileSplit.com platform.</p>
        <p>Here are some helpful tips that make the acquiring the data more accurate:</p>
        <ul>
          <li>Do not combine high school and middle school runners in one race.</li>
          <li>Do not combine girls and boys in one race.</li>
          <li>Do not report mixed gender relays under one gender&rsquo;s race. For instance, a mixed gender 4x400m listed as a boys or girls 4x400m or under both.</li>
          <li>Encourage teams to have separate MileSplit team pages and rosters for their Middle and High School teams.</li>
          <li>Report to MileSplit that you have a 200m flat track to allow for conversions to be applied on published MileSplit performance lists.</li>
          <li>Use MileSplit Live Results.</li>
          <li>Report results to MileSplit on the same day and immediately after the meet.</li>
        </ul>
        <p>Please note and help spread the word that the ranking lists on MileSplit include ALL results reported to MileSplit. These rankings include teams that are not verified by OAT&amp;CCC for eligibility in the State Meet sponsored by the OAT&amp;CCC. For the terms of eligibility and verification please see the Eligibility &amp; Verification tab on the OAT&amp;CCC Indoor State Meet website. Only the performance lists officially published by MileSplit are the rankings considered for eligibility to the OAT&amp;CCC Indoor State Meet. Only these lists show the conversions from 200m flat tracks to oversized or banked tracks.</p>
        <p>For more information, contact the Indoor State Meet Chair listed at ${contactUrl}</p>
      </div>
    </section>
    <section aria-labelledby="o-vol-h">
      <h2 id="o-vol-h">Volunteer Information</h2>
      <div class="block">
        <p>Volunteer groups are welcome on a limited basis. Please check back for more information.</p>
      </div>
    </section>
  </div>`;
}

function declarationsBody() {
  return `<div class="ox-page">
    <div class="page-head">
      <h1>Declarations</h1>
    </div>
    <section aria-label="Declarations">
      <div class="block">
        <p class="ox-callout">Declarations are made completely through the MileSplit registration option on the MileSplit meet page for each division. Declaring does not guarantee entry. It only allows an athlete or relay team to be declared in the meet if they are on the top 30 list.</p>
        <p>Declarations must be completed on MileSplit Ohio</p>
        <p>Here is important information to know about the 2026 Indoor State Meet Declaration Process:</p>
        <ul>
          <li>MileSplit Performance Lists are posted HERE</li>
          <li>You must declare athletes on the MileSplit Meet pages:
            <ul>
              <li>Division 1</li>
              <li>Division 2</li>
              <li>Division 3</li>
              <li>Division 4</li>
              <li>Seated Division (no qualification standards - direct registration on MileSplit)</li>
            </ul>
          </li>
          <li>Opens February 24th 12:00noon</li>
          <li>Closes February 26th at 11:59pm</li>
          <li>Only athletes on verified teams with performances from MileSplit registration meets are eligible</li>
          <li>The top 16 declarations from the official MileSplit published top 30 performance list are accepted</li>
          <li>Enter your alternate names when declaring a relay. All alternates must be on your MileSplit roster to be eligible to compete. Any relay members not on your MileSplit roster will disqualify the relay team</li>
          <li>Starting heights will be posted on the MileSplit meet pages</li>
          <li>Print/save your confirmation sheet to make sure all declarations are entered</li>
          <li>No late declarations accepted</li>
          <li>Final acceptance lists will be posted on MileSplit on Monday, March 1st</li>
        </ul>
        <p>All declarations are made on the OHMileSplit meet registration page similar to entering athletes in a regular season meet. Do NOT import entries - skip this step. Only athletes and relay teams in the top 30 will be accepted. A pop-up window will appear rejecting any athletes or relays not in the top 30 once you try to submit them.</p>
        <p>Print your declaration lists to confirm your submissions. Computer and internet connection issues are not an excuse for omitting a declaration. Print and save your confirmation!</p>
        <p>To view and print your declarations, click on MAKE PAYMENT, then PRINT INVOICE. Payments can be made starting Monday, March 1, 2027.</p>
        <p>The cost per individual entry is $15.00. The cost per relay team entry is $25.00.</p>
        <p>All final entries accepted into the State Meet will be posted on Monday, March 1, 2027, under the ENTRY tab of each MileSplit meet page for each division and are considered entered in the meet. The final entry fee invoice will reflect only those athletes and relays on the final acceptance lists. Payment must be made for all those on the final acceptance lists even if the athlete or relay chooses not to compete. Again, do not pay the invoice until Sunday after the final acceptance lists are posted.</p>
        <p>Click on &ldquo;Registration Closed - View Your Entries&rdquo; to submit payment.</p>
        <p>All entry fees are paid online and due by Thursday, March 4, 2027 at 12noon.</p>
      </div>
    </section>
  </div>`;
}

function meetDayBody() {
  return `<div class="ox-page">
    <div class="page-head">
      <h1>Meet Day Information</h1>
    </div>
    <section aria-label="Meet Day Information">
      <div class="block">
        <ul>
          <li>The meet is located at SPIRE Institute: 5201 SPIRE Circle, Geneva, OH (Track &amp; Field building is at the far East end of the property)</li>
          <li>2027 NFHS and OHSAA competition rules will be in effect and applicable USATF competition rules for non-OHSAA events.</li>
          <li>All competitors must compete in school-issued uniform with all uniform rules in effect.</li>
          <li>One alternate relay pass is issued per relay team. All other alternate relay athletes must pay for entry as a spectator.</li>
          <li>Live streaming of the event will be available on ${milesplit}</li>
          <li>Results will be available on the Division Meet pages on ${milesplit}</li>
          <li>Athletic training staff and a physician will be provided by The Cleveland Clinic.</li>
          <li>Official Indoor State Meet shirts will be available for purchase on-site only.</li>
          <li>Use of electronics by athletes in the competition area is strictly prohibited. This includes cell phones, ear buds, headphones, etc. Violations will result in removal from the area and may lead to disqualification.</li>
          <li>No chairs may be brought into the facility for use by spectators, coaches or athletes.</li>
        </ul>
        <p>No outside food allowed in the facility besides personal food &amp; beverage items for athletes. (no team camp food or beverages)</p>
      </div>
    </section>
    <section aria-labelledby="m-links-h">
      <h2 id="m-links-h">Links</h2>
      <div class="block">
        <p>Phonetic Spelling Form: Please provide the phonetic spellings of athlete names here to let the announcers know how to properly pronounce their names.</p>
        <p>${ext(LINKS.phoneticForm, "Phonetic Spelling Form")}</p>
        <p>OATCCC Spectator Tickets: All spectator tickets will be sold online in advance and on-site. NO CASH ACCEPTED.</p>
        <p>${ext(LINKS.tickets, "OATCCC Spectator Tickets")}</p>
        <p>Parking is payable online. Download the app or register online to pay in advance and avoid internet connection delays. There is no parking fee for official school vehicles.</p>
        <p>${ext(LINKS.parkingFee, "Spectator Parking Fee")}</p>
      </div>
    </section>
    <section aria-labelledby="m-dl-h">
      <h2 id="m-dl-h">Downloads</h2>
      <div class="block">
        <p>Parking Map</p>
        <p>Onsite Food Options</p>
      </div>
    </section>
    <section aria-labelledby="m-sched-h">
      <h2 id="m-sched-h">Meet Schedule</h2>
      <div class="block">
        <p>Please check back for updated schedule links.</p>
        <ul>
          <li>Updated Division 3 &amp; 4 Meet Schedule</li>
          <li>Updated Division 1, 2 &amp; Seated Meet Schedule</li>
        </ul>
      </div>
    </section>
    <section aria-labelledby="m-heat-h">
      <h2 id="m-heat-h">Heat &amp; Flight Sheets</h2>
      <div class="block">
        <p>Heat &amp; Flight Sheets will be posted on ${ext("http://oh.milesplit.com/", "oh.milesplit.com")} the week of the meet.</p>
      </div>
    </section>
    <section aria-labelledby="m-shirt-h">
      <h2 id="m-shirt-h">2027 Indoor State Meet T-Shirts</h2>
      <div class="block">
        <p>Official State Meet t-shirts will be available on-site only. No pre-orders will be available. Cash and credit/debit cards will be accepted. Exact change is appreciated if using cash.</p>
      </div>
    </section>
  </div>`;
}

function faqBody() {
  const qa = (q, a) => `<dt>${q}</dt><dd>${a}</dd>`;
  return `<div class="ox-page">
    <div class="page-head">
      <h1>Indoor State Meet FAQs</h1>
    </div>
    <section aria-labelledby="f-ath-h">
      <h2 id="f-ath-h">Athlete, Team &amp; Coach Information</h2>
      <dl class="block faq">
        ${qa("Can an individual athlete compete in the State Meet whose school does not sponsor an indoor track &amp; field team?", "NO. Only an athlete who is a member of a team which is approved and recognized by their high school may compete.")}
        ${qa("Can a student from a school that does not sponsor a team be a part of a school&rsquo;s team that does sponsor Indoor Track &amp; FIeld?", "NO. Only students enrolled at a school that sponsors Indoor Track &amp; Field can be a member of that school&rsquo;s team.")}
        ${qa("What defines an indoor track &amp; field team being approved and recognized by its high school?", "The school must be a member in good-standing with the OHSAA, the local Board of Education must approve the existence of the indoor track &amp; field team and the Board of Education must approve the coaches which facilitate the team.")}
        ${qa("How does the team prove to the OAT&amp;CCC that it is approved and recognized by its high school?", `The athletic director of a school sponsoring an Indoor Team must submit the online verification agreement form emailed directly to the AD. The online verification agreement form must be submitted by the AD by February 5th at 11:59pm. If the AD did not receive the link to this agreement, then contact the Indoor State Meet Chair listed at ${contactUrl}`)}
        ${qa("Must an indoor track &amp; field team be associated with a school which is a member of the OHSAA for that academic year?", "YES")}
        ${qa("Can an indoor track &amp; field team consist of one athlete?", "YES.There are no parameters as to how many athletes must exist on the team for it to be recognized as a team.")}
        ${qa("Must an athlete or team have a coach at the State Meet?", "YES. Athletes and teams must be accompanied by a Board-approved coach and a member of the OAT&amp;CCC. A parent or legal guardian cannot serve as a coach if not approved by the high school&rsquo;s local Board of Education. Only a school&rsquo;s coach who is an OATCCC member can pick-up the coach and athlete credentials.")}
        ${qa("What defines a Board-approved coach?", `A coach which has been approved and recognized by the local Board of Education to represent and facilitate the Board-approved team. This must be verified in compliance with the OAT&amp;CCC online verification agreement form submitted by the school&rsquo;s athletic director by February 5th at 11:59pm. If the AD did not receive the link to this agreement, then contact the Indoor State Meet Chair listed at ${contactUrl}`)}
        ${qa("Do the Board-approved coaches of the Board-approved team need to be paid members of the OAT&amp;CCC?", "YES. All coaches who are coaching athletes at the OATCCC State Meet must be paid members of the OAT&amp;CCC for the 2026-2027 academic year. No coaches will be allowed into the meet for the purpose of coaching if they are not paid members of the OAT&amp;CCC.")}
        ${qa("What if a coach arrives at the State Meet and is not a paid member of the OAT&amp;CCC?", `That coach must submit their membership &amp; payment online then show proof of this to receive in order to gain access to the meet. This may be done at: ${ext(LINKS.join, "https://oatccc-oh.finalforms-amp.com/")}`)}
        ${qa("How many coaches per team will be admitted to the meet?", "All coaches who are 2027 OAT&amp;CCC members are admitted to the meet at no charge. However, the only coaches allowed on the infield are those coaching field events.")}
      </dl>
    </section>
    <section aria-labelledby="f-qual-h">
      <h2 id="f-qual-h">State Meet Qualification Information</h2>
      <dl class="block faq">
        ${qa("Will a mark achieved while an athlete or relay team competed as an unattached athlete or relay team count as a qualifying mark for the State Meet?", "NO. All qualifying marks must be achieved while that athlete or relay team competed for their Board-approved indoor track &amp; field team. The athlete&rsquo;s or relay&rsquo;s affiliation cannot be retroactively changed to associate that athlete or relay team with a Board-approved indoor track &amp; field team.")}
        ${qa("Can marks from any indoor meet from that season be accepted as qualifying marks to the State Meet?", "NO. Only marks achieved in meets using MileSplit as the registration platform shall be accepted. These meets may be held in any state from December 1, 2026 through February 21, 2027.")}
        ${qa("What marks are eligible for the State Meet?", "The marks listed on the final top 30 performance list as posted by Ohio on verified teams.")}
        ${qa("How many marks qualify for the State Meet per division?", "The top 16 marks declared.")}
        ${qa("How many athletes from the same team can qualify to the State Meet in each individual event?", "Coaches may only declare TWO competitors to compete in an event from the top 30 list. Note: only ONE relay team per school is eligible to compete even if the event is not full.")}
        ${qa("What are the starting heights for the high jump and pole vault?", "The starting heights in the high jump and pole vault will be posted on the oh.milesplit.com meet pages.")}
        ${qa("Are the 55m dash, 55m hurdles, and mile converted to the 60m dash, 60m hurdles, and 1600m run?", "YES")}
        ${qa("Are races 200m and longer performed on a 200m flat track converted to times as though they were performed on a banked or 300m track.", "Yes. The converted times will only appear on the officially published rankings lists. The converted times will not show in the meet results, ranking &ldquo;drop-down&rdquo; lists on MileSplit, or on an athlete&rsquo;s profile page.")}
      </dl>
    </section>
    <section aria-labelledby="f-day-h">
      <h2 id="f-day-h">Meet Day Information</h2>
      <dl class="block faq">
        ${qa("Will the NFHS and OHSAA uniform rules be in effect?", "YES")}
        ${qa("Can relay alternates come to the meet if they are not already competing in another event?", "Each relay team will receive one additional athlete pass for an alternate. All other alternates who are not already competing in the meet must pay to enter the meet.")}
        ${qa("Will there be a livestream of the event?", `${milesplit} will livestream the event. A paid subscription is needed to access the stream. Get more info at: oh.milesplit.com`)}
        ${qa("Will there be live results posted?", "Live results will be posted on oh.milesplit.com.")}
        ${qa("Will there be heat/flight sheets available for coaches at the meet?", "Heat/flight sheets will be available online at oh.milesplit.com and www.oatccc.com to print prior to coming to the meet.")}
        ${qa("Will the meet be scored?", "The top 2 athletes from each team may score with the top eight marks of those eligible athletes scoring in each event. Scoring as follows 1st through 8th place: 10-8-6-5-4-3-2-1.")}
        ${qa("Will there be awards?", "The top 8 in each event will receive a medal.")}
        ${qa("Will there be team championship awards?", "Yes")}
        ${qa("Will there be meet t-shirts for sale?", "YES. There will be t-shirts available on-site. No pre-orders will be available. Cash and credit/debit cards will be accepted. Exact change is appreciated if using cash.")}
      </dl>
    </section>
  </div>`;
}

const PAGES = {
  overview: { body: overviewBody, title: "2027 Indoor High School State Championship Meet", description: "The 2027 OATCCC Indoor High School State Championship Meet at Spire Institute: performance lists, qualification, meet hosts and timers." },
  abcs: { body: abcsBody, title: "ABCs of the Indoor Season", description: "What athletes, coaches and schools need to know for the 2027 OATCCC Indoor State Meet, in three parts: A, B and C." },
  divisions: { body: divisionsBody, title: "Indoor State Meet Divisions", description: "The four school divisions and the Seated Division at the 2027 OATCCC Indoor State Championship Meet, and when each competes." },
  eligibility: { body: eligibilityBody, title: "Indoor Eligibility & Verification", description: "How athletic directors verify their indoor track and field team for the 2027 OATCCC Indoor State Meet, and the official agreement terms." },
  declarations: { body: declarationsBody, title: "Indoor State Meet Declarations and Fees", description: "How to declare entries on MileSplit Ohio for the 2027 OATCCC Indoor State Meet, and the entry fees." },
  meetday: { body: meetDayBody, title: "Indoor State Meet Day Information", description: "Meet day at SPIRE Institute: rules, tickets, parking, food, schedule, heat sheets and shirts for the 2027 OATCCC Indoor State Meet." },
  faq: { body: faqBody, title: "Indoor State Meet FAQs", description: "Answers to common questions about the 2027 OATCCC Indoor State Meet: athletes, teams, coaches, qualification and meet day." }
};

// Returns [{ pathname, html }] for every indoor page these flags allow.
export function oatcccIndoorPages(site, flags) {
  return INDOOR_PAGES
    .filter((page) => !page.full || flags.indoorFull)
    .map((page) => {
      const spec = PAGES[page.key];
      const pathname = indoorPath(page.key);
      const content = `<div class="ox-shell ox-wrap">${secnav(page.key, flags)}<div class="ox-content">${spec.body(flags)}${contactBand()}</div></div>`;
      return {
        pathname,
        html: oatcccLayout({
          site,
          flags,
          pathname,
          title: spec.title,
          description: spec.description,
          tab: "indoor",
          mast: masthead(),
          content,
          scripts: page.key === "divisions" && flags.divisionList ? ["/scripts/oatccc.js", "/scripts/oatccc-divisions.js"] : ["/scripts/oatccc.js"]
        })
      };
    });
}
