import { layout, pageHero } from "../lib/html.mjs";
import { adSlot, AD_SLOTS } from "../lib/ads.mjs";

function field(label, name, type = "text", options = {}) {
  const required = options.required === false ? "" : " required";
  const max = options.maxlength ? ` maxlength="${options.maxlength}"` : "";
  const placeholder = options.placeholder ? ` placeholder="${options.placeholder}"` : "";
  const accept = options.accept ? ` accept="${options.accept}"` : "";
  return `<label class="form-field"><span>${label}${required ? " *" : ""}</span><input type="${type}" name="${name}"${required}${max}${placeholder}${accept}></label>`;
}

function selectField(label, name, values) {
  return `<label class="form-field"><span>${label} *</span><select name="${name}" required><option value="">Choose one</option>${values.map(([value, text]) => `<option value="${value}">${text}</option>`).join("")}</select></label>`;
}

function textArea(label, name, maxlength = 2000) {
  return `<label class="form-field form-field-full"><span>${label} *</span><textarea name="${name}" rows="5" maxlength="${maxlength}" required></textarea></label>`;
}

export function athleteOfTheWeekPage(site) {
  const nominationForm = `<form class="award-form" data-award-nomination="athlete" hidden>
    <div class="form-grid">
      ${field("Athlete name", "athlete_name", "text", { maxlength: 120 })}
      ${field("School", "school", "text", { maxlength: 120 })}
      ${field("Grade", "grade", "text", { maxlength: 30, placeholder: "Freshman, Sophomore, Junior, or Senior" })}
      ${selectField("Category", "gender", [["Boys", "Boys"], ["Girls", "Girls"]])}
      ${field("Event or race", "event_name", "text", { maxlength: 120 })}
      ${field("Performance", "performance", "text", { maxlength: 120, placeholder: "Time, mark, finish, or record" })}
      ${field("Meet name", "meet_name", "text", { maxlength: 160 })}
      ${field("Performance date", "performance_date", "date")}
      ${field("Official result link", "result_url", "url", { required: false, maxlength: 500 })}
      ${field("Photo link", "photo_url", "url", { required: false, maxlength: 500 })}
      ${textArea("Why should this athlete be selected?", "reason")}
      ${field("Your name", "nominator_name", "text", { maxlength: 120 })}
      ${field("Your email", "nominator_email", "email", { maxlength: 254 })}
      <label class="honeypot" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
    </div>
    <button class="button button-primary" type="submit">Submit nomination</button>
    <p class="form-message" data-nomination-message aria-live="polite"></p>
  </form>`;

  const content = `${pageHero({
    eyebrow: "Podium Watch weekly awards",
    title: "Athlete of the Week",
    description: "Nominate an Ohio athlete, meet the finalists, vote during the open period, and celebrate past winners."
  })}
  <section class="section section-paper"><div class="container award-shell" data-weekly-award data-award-type="athlete">
    <div class="info-card award-status" data-award-status><h2>Loading the current week</h2><p>Please wait while Podium Watch checks the current award period.</p></div>
    <section data-award-current hidden>
      <div class="section-heading"><div><p class="eyebrow">Current week</p><h2 data-award-title>Athlete of the Week</h2><p data-award-deadline></p></div></div>
      <div class="award-finalists" data-award-finalists></div>
      <div class="pp-panel" data-podium-play data-other-contest-href="/team-of-the-week/" data-other-contest-label="Team of the Week"></div>
    </section>
    <section class="info-card" data-nomination-section hidden>
      <p class="eyebrow">Nominate an athlete</p><h2>Tell Podium Watch who deserves recognition</h2><p>Use verified meet information. Nominations are reviewed before finalists are published.</p>
      ${nominationForm}
    </section>
    ${adSlot(AD_SLOTS.weeklyAwards)}
    <section class="award-archive" aria-labelledby="athlete-winners-title"><div class="section-heading"><div><p class="eyebrow">Past winners</p><h2 id="athlete-winners-title">Athlete of the Week archive</h2></div></div><div class="award-winners" data-award-archive><p>Loading past winners.</p></div></section>
  </div></section>
  <script src="/scripts/weekly-awards.js" defer></script>
  <script src="/scripts/team-auth-client.js" defer></script>
  <script src="/scripts/podium-play.js" defer></script>`;

  return layout({ site, title: "Athlete of the Week", description: "Nominate, vote for, and celebrate Podium Watch Athlete of the Week finalists and winners.", pathname: "/athlete-of-the-week/", content });
}

export function teamOfTheWeekPage(site) {
  const nominationForm = `<form class="award-form" data-award-nomination="team" hidden>
    <div class="form-grid">
      ${field("Team name", "team_name", "text", { maxlength: 150, placeholder: "Varsity boys, 4x800 relay, or full program" })}
      ${field("School", "school", "text", { maxlength: 150 })}
      ${selectField("Sport", "sport", [["Cross Country", "Cross Country"], ["Indoor Track and Field", "Indoor Track and Field"], ["Outdoor Track and Field", "Outdoor Track and Field"]])}
      ${field("Division", "division", "text", { required: false, maxlength: 50 })}
      ${field("Meet name", "meet_name", "text", { required: false, maxlength: 200 })}
      ${field("Performance date", "performance_date", "date", { required: false })}
      ${field("Official result link", "result_url", "url", { required: false, maxlength: 1000 })}
      ${field("Photo link", "photo_url", "url", { required: false, maxlength: 1000 })}
      ${textArea("Team achievement", "achievement", 500)}
      ${textArea("Why should this team be selected?", "reason", 2500)}
      ${field("Your name", "nominator_name", "text", { maxlength: 150 })}
      ${field("Your email", "nominator_email", "email", { maxlength: 254 })}
      <label class="form-field form-field-full consent-field"><input type="checkbox" name="permission" value="true" required><span>I confirm that Podium Watch may review and publish this information.</span></label>
      <label class="honeypot" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
    </div>
    <button class="button button-primary" type="submit">Submit nomination</button>
    <p class="form-message" data-nomination-message aria-live="polite"></p>
  </form>`;

  const content = `${pageHero({
    eyebrow: "Podium Watch weekly awards",
    title: "Team of the Week",
    description: "Nominate an Ohio team, vote for your favorite, and celebrate the programs delivering memorable performances."
  })}
  <section class="section section-paper"><div class="container award-shell" data-weekly-award data-award-type="team">
    <div class="info-card award-status" data-award-status><h2>Loading the current week</h2><p>Please wait while Podium Watch checks the current award period.</p></div>
    <section data-award-current hidden>
      <div class="section-heading"><div><p class="eyebrow">Current week</p><h2 data-award-title>Team of the Week</h2><p data-award-deadline></p></div></div>
      <div class="award-finalists" data-award-finalists></div>
      <div class="pp-panel" data-podium-play data-other-contest-href="/athlete-of-the-week/" data-other-contest-label="Athlete of the Week"></div>
    </section>
    <section class="info-card" data-nomination-section hidden>
      <p class="eyebrow">Nominate a team</p><h2>Share a performance worth celebrating</h2><p>Use verified meet information and explain what made the team achievement stand out.</p>
      ${nominationForm}
    </section>
    ${adSlot(AD_SLOTS.weeklyAwards)}
    <section class="award-archive" aria-labelledby="team-winners-title"><div class="section-heading"><div><p class="eyebrow">Past winners</p><h2 id="team-winners-title">Team of the Week archive</h2></div></div><div class="award-winners" data-award-archive><p>Loading past winners.</p></div></section>
  </div></section>
  <script src="/scripts/weekly-awards.js" defer></script>
  <script src="/scripts/team-auth-client.js" defer></script>
  <script src="/scripts/podium-play.js" defer></script>`;

  return layout({ site, title: "Team of the Week", description: "Nominate, vote for, and celebrate Podium Watch Team of the Week finalists and winners.", pathname: "/team-of-the-week/", content });
}
