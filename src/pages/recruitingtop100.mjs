import { layout, pageHero, emptyState } from "../lib/html.mjs";

const GENDERS = {
  boys: { label: "Boys", other: "girls", otherLabel: "Girls" },
  girls: { label: "Girls", other: "boys", otherLabel: "Boys" }
};

const styles = `
    .top100-shell { display:grid; gap:24px; }
    .top100-trust { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:20px; border-left:6px solid #00bf63; }
    .top100-trust h2, .top100-trust p { margin-bottom:0; }
    .top100-controls { display:flex; flex-wrap:wrap; align-items:end; justify-content:space-between; gap:16px; }
    .top100-controls label { display:grid; gap:7px; font-weight:850; }
    .top100-controls select { min-height:46px; padding:10px 14px; border:1px solid rgba(15,23,42,.22); border-radius:9px; background:#fff; font:inherit; font-size:1rem; }
    .top100-message { margin:0; padding:14px 16px; border-radius:10px; background:rgba(0,191,99,.12); font-weight:850; }
    .top100-message[data-tone="error"] { color:#991b1b; background:rgba(220,38,38,.12); }
    .top100-row { grid-template-columns:70px 1.6fr 1fr .9fr; }
    .top100-name { display:block; font-size:1.1rem; }
    .top100-position { display:inline-flex; margin-top:4px; padding:3px 8px; border-radius:999px; background:rgba(0,191,99,.14); font-size:.74rem; font-weight:900; text-transform:uppercase; }
    .top100-hometown { display:block; margin-top:8px; color:var(--muted); }
    .top100-hometown strong { color:var(--ink); }
    .top100-stats { display:grid; gap:8px; justify-items:start; }
    .top100-score { display:inline-grid; place-items:center; min-width:48px; min-height:48px; border-radius:50%; background:#111; color:#fff; font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif; font-size:1.35rem; }
    .top100-stars { display:flex; gap:2px; color:#e6a700; font-size:1.02rem; }
    .top100-stars span[data-empty="true"] { color:#d7dce3; }
    .top100-commit { display:grid; gap:4px; text-align:right; }
    .top100-commit strong { font-size:1rem; }
    .top100-commit span { color:var(--muted); font-size:.84rem; }
    .top100-commit[data-committed="false"] { color:var(--muted); }
    @media (max-width:700px) {
      .top100-row { grid-template-columns:56px 1fr; gap:12px; }
      .top100-stats, .top100-commit { grid-column:2; text-align:left; }
      .top100-controls { flex-direction:column; align-items:stretch; }
    }
`;

export function recruitingTop100Page(site, { gender }) {
  const info = GENDERS[gender];

  const content = `${pageHero({
    eyebrow: "Podium Watch Recruiting",
    title: `${info.label} Ohio Top 100.`,
    description: "The top ranked Ohio track and cross country recruits by class, evaluated with real sourced performance evidence -- no pay to play, no offers affecting the score."
  })}

  <style>${styles}</style>

  <section class="section section-paper">
    <div class="container top100-shell" data-top100>
      <section class="info-card top100-trust">
        <div>
          <p class="eyebrow">Independent editorial evaluation</p>
          <h2>Performance first. No pay to play.</h2>
          <p>Ratings require sourced performance evidence. Offers, school popularity, social following, and payment do not affect the score. <a href="/recruiting/methodology/">Read the full methodology</a>.</p>
        </div>
        <div class="gender-tabs">
          <a href="/recruiting/top-100/boys/"${gender === "boys" ? ' aria-current="page"' : ""}>Boys</a>
          <a href="/recruiting/top-100/girls/"${gender === "girls" ? ' aria-current="page"' : ""}>Girls</a>
        </div>
      </section>

      <div class="top100-controls">
        <label>Class
          <select data-top100-year>
            <option value="2027" selected>Class of 2027</option>
            <option value="2028">Class of 2028</option>
            <option value="2029">Class of 2029</option>
            <option value="2030">Class of 2030</option>
            <option value="2031">Class of 2031</option>
          </select>
        </label>
        <a class="button button-outline" href="/recruiting/">Search the full recruiting database</a>
        <a class="button button-outline" href="/recruiting/top-250/${gender}-cross-country/">${info.label} Cross Country Top 250</a>
        <a class="button button-outline" href="/recruiting/submit-activity/">Report an offer or commitment</a>
      </div>

      <p class="top100-message" data-top100-message role="status">Loading the Ohio Top 100.</p>

      <div class="ranking-list" data-top100-rows></div>

      <div data-top100-empty hidden>
        ${emptyState({
          title: `No ${info.label.toLowerCase()} evaluations published yet`,
          description: `The ${info.label} Ohio Top 100 is ready -- published Recruit Ratings for this class will appear here automatically, ranked by score.`,
          actionLabel: `View ${info.otherLabel} Top 100`,
          actionHref: `/recruiting/top-100/${info.other}/`
        })}
      </div>
    </div>
  </section>

  <script>window.PODIUM_TOP_100_GENDER = ${JSON.stringify(gender)};</script>
  <script src="/scripts/recruiting-top100.js" defer></script>`;

  return layout({
    site,
    title: `${info.label} Ohio Top 100 Recruits`,
    description: `The top ranked Ohio high school ${info.label.toLowerCase()} track and cross country recruits by graduating class, evaluated by Podium Watch with real sourced performance evidence.`,
    pathname: `/recruiting/top-100/${gender}/`,
    content
  });
}
