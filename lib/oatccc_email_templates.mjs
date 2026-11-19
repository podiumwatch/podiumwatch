// OATCCC verification emails: "submitted", "returned" and "approved".
// Plain-text templates only. NOTHING SENDS THEM YET: email sending (Resend)
// is not set up, and how athletic directors sign in is still open. When it
// is, api/oatccc/verification.js calls these after each action and passes
// the result to the sender.
//
// No em dashes, signed "Podium Watch, powered by the OATCCC".

const SIGNATURE = "Podium Watch, powered by the OATCCC";

function line(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function required(fields, names) {
  for (const name of names) {
    if (!line(fields[name])) throw new Error(`OATCCC email template: ${name} is required.`);
  }
}

// To the athletic director, after they submit or resubmit.
export function submittedEmail({ schoolName, seasonName, link, isLate = false, resubmitted = false }) {
  required({ schoolName, seasonName, link }, ["schoolName", "seasonName", "link"]);
  const what = resubmitted ? "resubmitted" : "submitted";
  const late = isLate
    ? "\nThis form arrived after the February 5 deadline, so it is marked late. Late forms are subject to the $100 fine in the Verification Agreement.\n"
    : "";
  return {
    subject: `${line(schoolName)}: verification form ${what}`,
    text: `Hello,

The ${line(seasonName)} verification form for ${line(schoolName)} has been ${what}. The Indoor State Meet Chair will review it. You will get another email when it is approved or if anything needs to change.
${late}
See its status here:
${line(link)}

${SIGNATURE}
`
  };
}

// To the athletic director, when the admin sends the form back.
export function returnedEmail({ schoolName, seasonName, comment, link }) {
  required({ schoolName, seasonName, comment, link }, ["schoolName", "seasonName", "comment", "link"]);
  return {
    subject: `${line(schoolName)}: your verification form needs a change`,
    text: `Hello,

The Indoor State Meet Chair returned the ${line(seasonName)} verification form for ${line(schoolName)} with this note:

${String(comment).trim()}

Please open the form, make the change and resubmit it:
${line(link)}

${SIGNATURE}
`
  };
}

// To the athletic director, when the admin approves.
export function approvedEmail({ schoolName, seasonName, link, comment = "" }) {
  required({ schoolName, seasonName, link }, ["schoolName", "seasonName", "link"]);
  const note = String(comment || "").trim() ? `\nNote from the Indoor State Meet Chair:\n\n${String(comment).trim()}\n` : "";
  return {
    subject: `${line(schoolName)} is verified for the ${line(seasonName)}`,
    text: `Hello,

The ${line(seasonName)} verification form for ${line(schoolName)} is approved. Your team is verified.
${note}
See it here:
${line(link)}

${SIGNATURE}
`
  };
}
