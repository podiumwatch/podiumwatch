// Homepage (site redesign step 7, 2026-11-13; HOMEPAGE_REDESIGN_HANDOFF
// and SITE_REDESIGN_MASTER_HANDOFF). Layout only: every module reads the
// same data it always did, passed in by scripts/build.mjs.
//
// Top to bottom: team bar (find your team, search athletes, one dated call
// to action), then a two-column block (lead story with click-through and
// the recaps list on the left, the "Right now" panel on the right; on a
// phone and tablet: lead, panel, recaps), more from the newsroom, the two
// rankings panels, tools, the slim shop strip.
// Empty modules don't render: latest results and upcoming meets stay
// hidden until the meet calendar returns something (public/scripts/
// homepage.js), and the champions table only shows while there is a
// current championship to show.

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const AP_MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
// "2026-11-07" -> "Nov. 7, 2026" (AP style). "" for anything unreadable.
export function apDate(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const month = AP_MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${Number(m[3])}, ${m[1]}` : "";
}

const ROMAN = { I: 1, II: 2, III: 3, IV: 4 };
// A story's division label for the recaps list ("Division III"), or "".
export function divisionLabel(story) {
  const d = String(story?.divisions || "").trim();
  return ROMAN[d] ? `Division ${d}` : "";
}

// The recaps list: the newest story that belongs to a series brings its
// whole series (state recaps today), Division I to IV in order, with any
// overview first. No series: the next stories after the lead set.
export function recapGroup(stories = [], leadSlugs = []) {
  const newestInSeries = stories.find((story) => story.series);
  if (newestInSeries) {
    const members = stories.filter((story) => story.series === newestInSeries.series);
    if (members.length >= 2) {
      const order = (story) => ROMAN[String(story.divisions || "").trim()] ?? 0;
      const items = [...members].sort((a, b) => order(a) - order(b) || (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0)).slice(0, 6);
      const title = newestInSeries.seriesLabel || String(newestInSeries.series).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return { title, items };
    }
  }
  const lead = new Set(leadSlugs);
  return { title: "Latest stories", items: stories.filter((story) => !lead.has(story.slug)).slice(0, 4) };
}

function teamBar(datedCtas = []) {
  const ctas = datedCtas.map((cta) => `<a class="pw-teambar-cta" href="${esc(cta.href)}" data-starts="${esc(cta.startsAt || "")}" data-expires="${esc(cta.expiresAt || "")}"${cta.showWhen ? ` data-show-when="${esc(cta.showWhen)}"` : ""}${cta.live ? "" : " hidden"}><span><b>${esc(cta.bar?.title || cta.title)}</b><small>${esc(cta.bar?.detail || cta.detail)}</small></span><i>${esc(cta.bar?.button || "Open")}</i></a>`).join("");
  return `<div class="pw-teambar"><div class="container pw-teambar-wrap">
    <form class="pw-find" action="/teams/" method="get" role="search" aria-label="Find your team">
      <label class="visually-hidden" for="find-team-input">Find your team or city</label>
      <input id="find-team-input" type="search" name="search" placeholder="Find your team or city" autocomplete="off" maxlength="100" required>
      <button type="submit">Search</button>
    </form>
    <a class="pw-teambar-alt" href="/athletes/">Search athletes</a>
    ${ctas}
  </div></div>`;
}

function championsBlock(champions) {
  if (!champions?.races?.length) return "";
  const year = champions.year;
  const meet = champions.meet || {};
  const context = ["Ohio Cross Country", apDate(meet.date), meet.venue].filter(Boolean).join(" &middot; ");
  const rows = champions.races.map((race) => {
    const gender = race.gender === "girls" ? "Girls" : "Boys";
    const href = `/state/${year}/${race.anchor}/`;
    const ind = race.individual ? `<b>${esc(race.individual.name)}</b><span>${esc(race.individual.school)}</span>` : "";
    const team = race.team ? `<b>${esc(race.team.school)}</b><span>${esc(String(race.team.score))} points</span>` : "";
    return `<tr class="${race.gender === "girls" ? "pw-g" : "pw-b"}"><th scope="row"><a href="${esc(href)}" aria-label="${esc(`${gender} D${race.division} state results`)}">${gender} D${esc(String(race.division))}</a></th><td>${ind}</td><td class="pw-hchamp-time">${esc(race.individual?.time || "")}</td><td>${team}</td></tr>`;
  }).join("");
  return `<div class="pw-rail-h"><h2 id="right-now-title">${esc(String(year))} State Champions</h2><p>${context}</p></div>
    <table class="pw-hchamps">
      <thead><tr><th scope="col">Div.</th><th scope="col">Individual</th><th scope="col">Time</th><th scope="col">Team</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="pw-rail-links"><a class="pw-hbtn" href="/state/${esc(String(year))}/">Full state results</a><a class="pw-hbtn pw-hbtn-line" href="/regionals/${esc(String(year))}/">Regionals</a><a class="pw-hbtn pw-hbtn-line" href="/districts/${esc(String(year))}/">Districts</a></div>`;
}

function rail(champions) {
  const champs = championsBlock(champions);
  // Latest results and upcoming meets come from the meet calendar in the
  // browser; each stays hidden until it has at least one meet.
  return `<aside class="pw-rail" aria-labelledby="${champs ? "right-now-title" : "latest-results-title"}"${champs ? "" : " data-rail-empty"}>
    ${champs}
    <section class="pw-rail-sec" data-latest-results-panel hidden aria-labelledby="latest-results-title">
      <h2 id="latest-results-title">Latest results</h2>
      <ul class="pw-meets" data-latest-results-list></ul>
      <a class="pw-more-link" href="/meets/?view=results">All results and the meet calendar</a>
    </section>
    <section class="pw-rail-sec" data-upcoming-meets-panel hidden aria-labelledby="upcoming-meets-title">
      <h2 id="upcoming-meets-title">Upcoming meets</h2>
      <ul class="pw-meets" data-upcoming-meets-list></ul>
      <a class="pw-more-link" href="/meets/?view=upcoming">Full meet calendar</a>
    </section>
  </aside>`;
}

function recapsBlock(group) {
  if (!group?.items?.length) return "";
  return `<section class="pw-recaps" aria-labelledby="recaps-title">
    <div class="pw-sec-h"><h2 id="recaps-title">${esc(group.title)}</h2><a href="/stories/">All stories</a></div>
    <ol>${group.items.map((story) => `<li>${divisionLabel(story) || story.category ? `<small>${esc(divisionLabel(story) || story.category)}</small>` : ""}<a href="/stories/${esc(story.slug)}/">${esc(story.title)}</a></li>`).join("")}</ol>
  </section>`;
}

// Up to 8 cards are built; the first four not in the lead set show (the
// admin can change the lead set in the browser, front-lead-client.mjs).
function newsroom(cards = []) {
  if (!cards.length) return "";
  return `<section class="pw-hsec" aria-labelledby="newsroom-title">
    <div class="pw-hsec-h"><h2 id="newsroom-title">More from the newsroom</h2><a href="/stories/">All stories</a></div>
    <div class="pw-cards" data-home-cards>${cards.map((card, i) => `<article class="pw-card" data-story-slug="${esc(card.slug)}"${i < 4 ? "" : " hidden"}>
      <a class="pw-card-img" href="/stories/${esc(card.slug)}/" tabindex="-1" aria-hidden="true"><img src="${esc(card.image)}" alt="${esc(card.imageAlt || "")}" width="640" height="360" loading="lazy" decoding="async"${card.imagePosition ? ` style="object-position:${esc(card.imagePosition)}"` : ""}></a>
      <div><p class="pw-card-meta"><b>${esc(card.category || "Story")}</b> &middot; ${esc(card.dateLabel)}${card.minutes ? ` &middot; ${esc(String(card.minutes))} min read` : ""}</p><h3><a href="/stories/${esc(card.slug)}/">${esc(card.title)}</a></h3></div>
    </article>`).join("")}</div>
  </section>`;
}

function pollPanel(poll) {
  if (!poll) return "";
  const first = poll.data.boys?.[1] || [];
  const rows = (list) => list.map(([team, points], i) => `<li><span class="pw-poll-n">${i + 1}</span><b>${esc(team)}</b><span>${esc(points)}</span></li>`).join("");
  return `<div class="pw-panel pw-poll-panel" data-home-poll>
    <div class="pw-panel-h"><h3>OATCCC Coaches Poll</h3><p>${esc(poll.label)} &middot; Updated ${esc(poll.date)}</p></div>
    <div class="pw-seg">
      <div role="group" aria-label="Gender"><button type="button" data-poll-gender="boys" aria-pressed="true">Boys</button><button type="button" data-poll-gender="girls" aria-pressed="false">Girls</button></div>
      <div role="group" aria-label="Division">${[1, 2, 3, 4].map((d) => `<button type="button" data-poll-division="${d}" aria-pressed="${d === 1}">D${d}</button>`).join("")}</div>
    </div>
    <ol class="pw-poll" data-poll-list aria-live="polite">${rows(first)}</ol>
    <a class="pw-more-link" href="/rankings/oatccc/">See the full poll</a>
    <script type="application/json" data-poll-data>${JSON.stringify(poll.data).replaceAll("<", "\\u003c")}</script>
  </div>`;
}

function rankingsPanel({ spikeTownHref }) {
  const credit = spikeTownHref
    ? `Presented by <a href="${esc(spikeTownHref)}" rel="sponsored noopener" target="_blank">Spike Town at Runners Plus</a>`
    : "Presented by Spike Town at Runners Plus";
  const links = [
    ["/rankings/cross-country/", "Cross Country", "Boys and girls, Divisions I to IV"],
    ["/rankings/track-and-field/", "Track and Field", "Boys and girls, by division"],
    ["/rankings/top-10/", "Top 10", "Sponsored by Raising Cane's"],
    ["/rankings/leaders/", "State Leaders", "The best marks in Ohio"]
  ];
  return `<div class="pw-panel">
    <div class="pw-panel-h"><h3>Podium Watch rankings</h3><p class="pw-credit">${credit}</p></div>
    <ul class="pw-links">${links.map(([href, label, sub]) => `<li><a href="${href}"><b>${label}</b><span>${sub}</span><i aria-hidden="true">Open</i></a></li>`).join("")}</ul>
  </div>`;
}

const TOOLS = [
  ["/pace-calculator/", "Pace Calculator", "Pace, time, distance"],
  ["/splits-calculator/", "Splits Calculator", "Plan a race"],
  ["/scoring-calculator/", "Meet Scoring", "Score a meet"],
  ["/mock-postseason/real/", "Mock Meets", "Districts to state"],
  ["/fan-poll/", "Fan Poll", "Build your ballot"],
  ["/my-podium/", "My Podium", "Follow your team"]
];

export function homeContent({ leadHtml = "", candidatesJson = "[]", recaps = null, cards = [], champions = null, poll = null, datedCtas = [], spikeTownHref = "", shopHtml = "" } = {}) {
  return `${teamBar(datedCtas)}
<div class="container pw-home">
  <div class="pw-home-main">
    ${leadHtml ? `<section class="pw-home-lead" data-front-page aria-label="Top stories">
      <div data-front-lead>${leadHtml}</div>
      <script type="application/json" data-front-candidates>${candidatesJson}</script>
    </section>` : ""}
    ${rail(champions)}
    ${recapsBlock(recaps)}
  </div>
  ${newsroom(cards)}
  <section class="pw-hsec" aria-labelledby="home-rankings-title">
    <div class="pw-hsec-h"><h2 id="home-rankings-title">Rankings</h2><a href="/rankings/">All rankings</a></div>
    <div class="pw-rank">${pollPanel(poll)}${rankingsPanel({ spikeTownHref })}</div>
  </section>
  <section class="pw-hsec" aria-labelledby="tools-title">
    <div class="pw-hsec-h"><h2 id="tools-title">Tools</h2></div>
    <div class="pw-tools">${TOOLS.map(([href, label, sub]) => `<a href="${href}">${label}<span>${sub}</span></a>`).join("")}</div>
  </section>
  ${shopHtml}
</div>
${leadHtml ? `<script type="module" src="/scripts/front-lead-client.mjs"></script>` : ""}
<script src="/scripts/homepage.js" defer></script>`;
}
