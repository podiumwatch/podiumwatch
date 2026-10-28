import { layout, pageHero } from "../lib/html.mjs";

// Public, no-login application page for the paid Podium Watch State Meet
// Media Correspondent role covering the 2026 OHSAA State Cross Country
// Championships. Follows the same structure, tone, and safety pattern as
// src/pages/apply.mjs (the intern writer application): a plain-language
// explainer, a real on-site form (honeypot included), held for review --
// nothing here is an OHSAA media credential or a guarantee of selection.
// See lib/state_meet_correspondent_service.mjs for the submission logic
// and install/70_STATE_MEET_CORRESPONDENT_APPLICATIONS.sql for the table.
const styles = `
    .smc-shell { display:grid; gap:24px; }
    .smc-facts { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin:18px 0 0; }
    .smc-fact { padding:16px; border:1px solid var(--line); background:var(--white); text-align:center; }
    .smc-fact strong { display:block; font-size:1rem; }
    .smc-fact span { display:block; margin-top:4px; font-size:.82rem; color:var(--muted); font-weight:600; }
    .smc-list { display:grid; gap:10px; margin:18px 0 0; padding:0; list-style:none; }
    .smc-list li { display:flex; gap:10px; align-items:flex-start; padding:12px 14px; border:1px solid var(--line); background:var(--white); font-weight:600; }
    .smc-list li::before { content:"\\2713"; flex:0 0 auto; display:grid; place-items:center; width:22px; height:22px; border-radius:50%; background:var(--green); color:var(--black); font-size:.8rem; font-weight:900; }
    .smc-schedule-wrap { overflow-x:auto; margin-top:18px; border:1px solid var(--line); }
    .smc-schedule { width:100%; border-collapse:collapse; font-size:.92rem; min-width:420px; }
    .smc-schedule th, .smc-schedule td { padding:10px 14px; text-align:left; border-bottom:1px solid var(--line); }
    .smc-schedule th { background:var(--green); color:#fff; font-size:.78rem; letter-spacing:.04em; text-transform:uppercase; }
    .smc-schedule tr:last-child td { border-bottom:0; }
    .smc-note { margin-top:14px; padding:14px 16px; border:1px solid var(--line); background:rgba(var(--black-rgb),.03); font-size:.88rem; color:var(--muted); font-weight:600; }
    .smc-form { display:grid; gap:14px; }
    .smc-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:13px; }
    .smc-form label { display:grid; gap:7px; font-weight:850; }
    .smc-form input, .smc-form select, .smc-form textarea { width:100%; padding:10px 12px; border:1px solid rgba(var(--black-rgb),.22); border-radius:9px; background:var(--white); font:inherit; }
    .smc-form input:focus, .smc-form select:focus, .smc-form textarea:focus { outline:3px solid var(--green); outline-offset:1px; }
    .smc-form textarea { min-height:100px; resize:vertical; }
    .smc-wide { grid-column:1 / -1; }
    .smc-hint { font-weight:500; color:var(--muted); }
    .smc-radio-row { display:flex; gap:18px; align-items:center; }
    .smc-radio-row label { display:flex; align-items:center; gap:7px; font-weight:600; }
    .smc-radio-row input { width:auto; }
    .smc-error { display:block; margin-top:4px; font-size:.82rem; font-weight:700; color:#b3261e; }
    .smc-field-invalid input, .smc-field-invalid select, .smc-field-invalid textarea { border-color:#b3261e; }
    .smc-consent { grid-column:1 / -1; display:flex; gap:10px; align-items:flex-start; padding:12px 14px; border:1px solid rgba(var(--black-rgb),.14); border-radius:9px; background:rgba(var(--black-rgb),.03); }
    .smc-consent input { width:auto; margin-top:3px; }
    .smc-consent label { font-weight:500; }
    .smc-privacy { font-size:.82rem; color:var(--muted); font-weight:600; }
    .smc-honeypot { position:absolute !important; left:-10000px !important; width:1px !important; height:1px !important; overflow:hidden !important; }
    .smc-message { padding:14px 16px; border-radius:10px; font-weight:700; }
    .smc-message[data-tone="success"] { background:rgba(var(--green-rgb),.13); color:var(--green-ink); }
    .smc-message[data-tone="error"] { background:rgba(220,38,38,.12); color:#7a1414; }
    .smc-confirmation { text-align:center; padding:12px 0; }
    .smc-confirmation h2 { margin-bottom:10px; }
    .smc-confirmation p { max-width:560px; margin:0 auto 20px; color:var(--muted); font-weight:600; }
    @media (max-width:860px) {
      .smc-facts { grid-template-columns:repeat(2,minmax(0,1fr)); }
    }
    @media (max-width:700px) {
      .smc-fields, .smc-facts { grid-template-columns:1fr; }
      .smc-wide { grid-column:auto; }
      .smc-radio-row { flex-direction:column; align-items:flex-start; gap:8px; }
    }
`;

const RESPONSIBILITIES = [
  "Conduct short video interviews after races",
  "Interview individual athletes, teams, and coaches",
  "Gather immediate post race reactions and quotes",
  "Identify interesting stories developing throughout the meet",
  "Communicate with Podium Watch during the day",
  "Represent Podium Watch professionally while working in credentialed media areas",
  "Follow all OHSAA media rules and instructions"
];

const CANDIDATE_TRAITS = [
  "College student interested in sports journalism, sports broadcasting, communications, journalism, media production, or a related field",
  "Comfortable approaching and interviewing athletes and coaches",
  "Comfortable appearing on camera if needed, but primarily comfortable conducting interviews",
  "Able to record clear vertical video using a phone or camera",
  "Knowledge of cross country or track and field is preferred but not required",
  "Dependable and available for the full state meet",
  "Professional around high school athletes, coaches, families, and OHSAA staff",
  "Able to work independently in a busy sports environment"
];

const WHY_PODIUM_WATCH = [
  "Real published sports media experience",
  "Opportunity to cover an OHSAA state championship",
  "Interview experience with athletes and coaches",
  "Published work through Podium Watch",
  "Portfolio material for sports journalism or broadcasting",
  "Experience covering a live championship event",
  "Paid assignment"
];

const SCHEDULE = [
  ["10:00 AM", "Division I Girls"],
  ["10:40 AM", "Division I Boys"],
  ["11:10 AM", "Division I Awards"],
  ["11:50 AM", "Division II Girls"],
  ["12:30 PM", "Division II Boys"],
  ["1:00 PM", "Division II Awards"],
  ["1:40 PM", "Division III Girls"],
  ["2:20 PM", "Division III Boys"],
  ["2:50 PM", "Division III Awards"],
  ["3:30 PM", "Division IV Girls"],
  ["4:10 PM", "Division IV Boys"],
  ["4:40 PM", "Division IV Awards"]
];

// Media-credibility audit (2026-10-28): role filled -- form replaced
// with a plain notice, per the request. The route, the submission
// service (lib/state_meet_correspondent_service.mjs), and the
// install/70 table are all untouched; nothing here was deleted, so
// reopening applications later is just restoring this function's old
// body, not rebuilding anything.
export function applyStateMeetCorrespondentPage(site) {
  const content = `${pageHero({
    eyebrow: "Podium Watch Opportunity",
    title: "State Meet Media Correspondent",
    description: "This position has been filled."
  })}
  <section class="section section-paper">
    <div class="container">
      <section class="info-card" style="text-align:center;">
        <p>Thank you to everyone who applied. Follow Podium Watch's state meet coverage at <a href="https://www.podiumwatch.org">podiumwatch.org</a> and <a href="https://instagram.com/podiumwatch" target="_blank" rel="noopener noreferrer">@podiumwatch</a>.</p>
      </section>
    </div>
  </section>

  <script src="/scripts/page-view.js" defer></script>`;

  return layout({
    site,
    title: "State Meet Media Correspondent Application",
    description: "This position has been filled. Follow Podium Watch's coverage of the 2026 OHSAA State Cross Country Championships at podiumwatch.org and @podiumwatch.",
    pathname: "/apply/state-meet-correspondent/",
    content
  });
}
