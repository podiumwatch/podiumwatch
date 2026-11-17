import { escapeHtml } from "../lib/content.mjs";

// The 2027 Indoor State Track & Field Meet Verification Form, word for
// word from Anjanette's final text (OATCCC_VERIFICATION_FORM_TEXT.md,
// approved fixes applied, Nov 17, 2026). That file is the OATCCC's and is
// never committed; this module is the one copy the site uses.
//
// Used by BOTH the Eligibility & Verification page (official agreement
// terms) and the athletic director form, so the two can never drift apart
// (Zachary, 2026-11-17).
//
// DO NOT EDIT any string here except to match a new text from the OATCCC.
// The waiver paragraph is the OATCCC's legal text: never edit it.
// tests/oatccc-form-text.test.mjs checks the waiver against a fixed
// fingerprint, and checks everything against the .md file when it is on
// disk.

export const FORM_TITLE = "2027 Indoor State Track & Field Meet Verification Form";

export const FORM_DEADLINE = "Verification Form Submission Deadline: Friday, February 5, 2027, 11:59 PM";

export const FORM_ATTENTION = "Attention Athletic Director:";

export const FORM_INTRO = [
  "The 2027 Ohio Association of Track & Cross Country Coaches (\"OATCCC\") High School Indoor State Track & Field Championship Meet (the \"Meet\") will be contested on March 5 and 6, 2027. Of note, the Meet is not sponsored by or affiliated with the OHSAA. The OHSAA catastrophic insurance does not cover participation of the athletes competing in the Meet.",
  "In order for your school to be eligible to participate in the 2027 OATCCC Indoor State Track & Field Championship Meet, you must sign and submit ONE Verification Agreement for your school to cover both your girls' and boys' teams if you have both. The Verification Agreement for your school is due by 2/5/2027. Late submissions are permitted from 2/6/2027 until 2/15/2027 at 5:00pm after paying a fine of $100.00.",
  "The following rules, regulations, waivers and releases apply only to the eligibility of and participation in the 2027 OATCCC Indoor State Track & Field Championship Meet by a school, indoor track & field team and/or indoor track & field athlete. These rules, regulations, waivers and releases do not apply to a school, indoor track & field team and/or indoor track & field athlete participating in a meet or other competition designated as an indoor track & field event during the 2027 Indoor Track & Field season.",
  "Please direct any questions to the OATCCC Indoor State Meet Chair, Anjanette Whitman, at awhitman@oatccc.com."
];

export const FORM_GROUPS = [
  {
    lead: "In consideration for participating with the 2027 OATCCC Indoor State Track & Field Championship Meet, all of the following regulations shall be complied with by the school, Indoor Track & Field team coaches and any other representative of the school and/or Indoor Track & Field team sponsored by the school:",
    items: [
      "A school sponsored Indoor Track & Field team is defined as having one or more students competing as an Indoor Track & Field athlete for a school with one or more local Board of Education approved adults designated as the coach of the team;",
      "The participating Indoor Track & Field team's school must be a member of the OHSAA for the 2026-2027 academic year and must abide by the regulations to be a member in good standing with the OHSAA;",
      "The participating Indoor Track & Field team must be approved and recognized by the local Board of Education for the 2026-2027 academic year;",
      "All coaches representing the participating Indoor Track & Field team must be recognized and approved by the local Board of Education for the 2026-2027 academic year;",
      "All coaches representing the participating Indoor Track & Field team must be paid members in good standing with the OATCCC for the 2026-2027 academic year. Membership may be acquired by visiting www.oatccc.com;",
      "All student-athletes associated with the participating Indoor Track & Field team must meet all local Board of Education and OHSAA eligibility requirements for participation in athletics; and",
      "If the Indoor Track & Field team participating is represented by a coach or student-athlete who does not meet the above regulations, then the OATCCC may exclude the team or any of its competitors or coaches from participating in the 2027 Indoor State Track & Field Meet and apply sanctions to the team's future participation with OATCCC events."
    ]
  },
  {
    lead: "In order for performance marks to be considered for eligibility for the 2027 OATCCC Indoor State Track & Field Championship Meet, they must meet all of the following terms:",
    items: [
      "Performances must occur during the 2027 indoor track & field season from December 1, 2026 through and including February 21, 2027.",
      "Performances must occur at an indoor track & field meet that uses MileSplit for its registration process, regardless of the state in which the meet is contested. Note: Performances from meets that have results listed on MileSplit but did not use MileSplit for the registration process shall not be considered for eligibility in the 2027 OATCCC Indoor State Track & Field Championship Meet.",
      "Performances shall be by an athlete entered in a meet using MileSplit registration and the athlete must be entered as representing their verified school's Indoor Track & Field team. Performances by athletes designated as \"unattached\" or with a club team shall not be eligible to be considered for the 2027 OATCCC Indoor State Track & Field Championship Meet. An athlete's affiliation associated with a performance shall not be changed after the performance has been accomplished to comply with this requirement as stated."
    ]
  },
  {
    lead: "In further consideration for participating in the 2027 OATCCC Indoor State Track & Field Championship Meet, all of the following deadlines shall be complied with by the school, Indoor Track & Field team coaches and any other representative of the school and Indoor Track & Field team sponsored by the school:",
    items: [
      "Verification of an Indoor Track & Field team being sponsored by and complying with all regulations of the OATCCC must be received from 12/1/2026 at 12:00am to 2/5/2027 at 11:59pm. Verification shall only be considered valid and be accepted using the online form with the link provided to the athletic director of the school.",
      "Late submissions of verification forms as described above will be subject to a $100.00 fine made payable to the Ohio Association of Track & Cross Country Coaches. The fine is payable only by an electronic invoice sent directly to the Athletic Director after contacting the State Meet Chair. A late submission of the verification form shall only be received from 2/6/2027 12:00am until 2/15/2027 at 5:00pm. No verification forms will be accepted past the 2/15/2027 late submission deadline. Any athlete associated with a team that has not been verified shall not be included on the finalized performance lists and shall not be eligible to compete at the 2027 OATCCC Indoor State Track & Field Championship Meet.",
      "Performances eligible for the 2027 OATCCC Indoor State Track & Field Championship Meet must occur from December 1, 2026 through and including February 21, 2027. Performances that occur before or after this time frame shall not be eligible for consideration for the 2027 OATCCC Indoor State Track & Field Championship Meet.",
      "The declaration of an athlete's entry to compete in the 2027 OATCCC Indoor State Track & Field Championship Meet shall be made from 2/24/2027 at 12:00pm until 2/26/2027 at 11:59pm. Only athletes appearing on the finalized performance lists posted on Ohio MileSplit are eligible to compete in the 2027 OATCCC Indoor State Track & Field Championship Meet. There will be a registration fee assessed for every individual event entry and each relay team entered and accepted for the competition. No refunds will be issued if athletes do not compete.",
      "All registration fees shall be paid by no later than 12:00pm the day of the meet for the team or athlete entered. If the registration fee is not paid by this deadline, then the athlete or team shall not compete in the meet."
    ]
  }
];

export const FORM_WAIVER_HEADING = "Participation waiver and release of liability, assumption of risk and indemnity for participating with the 2027 OATCCC Indoor State Track & Field Championship Meet:";

// The OATCCC's legal text. Never edit.
export const FORM_WAIVER = "The school on behalf of the sponsored participating Indoor Track & Field team and its participants and coaches, individually, hereby releases, waives and covenants not to sue, and further agrees to indemnify, defend and hold harmless the OATCCC, its members, event directors, the host organization and the facility, venue and property owners or operators upon which the Meet takes place and any other organizers, promoters, sponsors, advertisers, coaches and officials for this the Meet with respect to any liability, claim(s), demand(s), cause(s) of action, damage(s), loss or expense (including court costs and attorneys' fees) of any kind or nature (\"Liability\") which may arise out of, result from, or relate in any way to the school's participation in the Meet.";

export const FORM_ATTESTATION = "As the athletic director of the above named school submitting this Verification Agreement, I agree with and verify that the Indoor Track & Field team associated with our school is and shall be in complete compliance with all of the OATCCC State Meet regulations, deadlines, waivers and releases as stated above and verify that the information entered into this form is true and accurate.";

// Every string in reading order (used by the tests).
export function formTextParagraphs() {
  return [
    FORM_TITLE,
    FORM_DEADLINE,
    FORM_ATTENTION,
    ...FORM_INTRO,
    ...FORM_GROUPS.flatMap((group) => [group.lead, ...group.items]),
    FORM_WAIVER_HEADING,
    FORM_WAIVER,
    FORM_ATTESTATION
  ];
}

// Plain text to HTML. Words are never changed: the text is escaped, and
// the Chair's email address becomes a mailto link around the same words.
const CHAIR_EMAIL = "awhitman@oatccc.com";
function html(text) {
  return escapeHtml(text).replace(CHAIR_EMAIL, `<a href="mailto:${CHAIR_EMAIL}?subject=${encodeURIComponent("Indoor State Meet")}">${CHAIR_EMAIL}</a>`);
}

// The form text as HTML. `heading` is the level of the bold lead-ins (the
// page's section heading sits one above). `withTitle` adds the title and
// deadline lines (the athletic director form shows them; the Eligibility
// page has its own heading).
export function formTextHtml({ heading = 3, withTitle = false } = {}) {
  const h = `h${heading}`;
  const title = withTitle
    ? `<${h} class="ft-title">${html(FORM_TITLE)}</${h}>\n<p class="ft-deadline"><strong>${html(FORM_DEADLINE)}</strong></p>\n`
    : "";
  const groups = FORM_GROUPS.map((group) => `<${h} class="ft-lead">${html(group.lead)}</${h}>
<ol class="ft-terms">${group.items.map((item) => `<li>${html(item)}</li>`).join("")}</ol>`).join("\n");
  return `<div class="ft">
${title}<p class="ft-attn"><strong>${html(FORM_ATTENTION)}</strong></p>
${FORM_INTRO.map((p) => `<p>${html(p)}</p>`).join("\n")}
${groups}
<${h} class="ft-lead">${html(FORM_WAIVER_HEADING)}</${h}>
<p class="ft-waiver">${html(FORM_WAIVER)}</p>
<p class="ft-attest"><strong>${html(FORM_ATTESTATION)}</strong></p>
</div>`;
}
