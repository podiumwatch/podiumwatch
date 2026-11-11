import { escapeHtml } from "../lib/content.mjs";
import { layout, pageHero } from "../lib/html.mjs";
import { bicarbStyles, bicarbVotingAdHtml } from "../lib/bicarb_ads.mjs";
import { merchCardHtml, merchEnabled, merchScripts, merchStyles } from "../lib/merch_card.mjs";
import { supportCardHtml, supportEnabled, supportScripts, supportStyles } from "../lib/support_card.mjs";

// Podium Watch Shop card (src/lib/merch_card.mjs): on each ballot page
// above the finalists (with "Vote below") and again after the finalists,
// before the vote button (Zachary, 2026-11-11); the larger card in the vote
// confirmation; at the bottom of the hub. Data and script once per page.
import { YEARLY_AWARDS_SCHEDULE, categoryPool, formatEt } from "../../lib/yearly_awards_2026.mjs";

// 2026 Athlete, Team and Coach of the Year public pages: the hub at
// /awards/2026/ and one share page per category at /awards/2026/<slug>/
// (one link per Instagram Story sticker). Mobile first, since most visits
// come from the Instagram in-app browser. Status is worked out from the
// clock in public/scripts/awards-2026.js and refreshed from
// /api/awards-2026/status/. Boys pages use the site green, girls pages pink.
const styles = `
    .yoy-shell { display:grid; gap:18px; max-width:760px; margin:0 auto; }
    .yoy-shell[data-gender="boys"], .yoy-hub .yoy-boys { --yoy-accent:#0faf68; --yoy-ink:#063d28; }
    .yoy-shell[data-gender="girls"], .yoy-hub .yoy-girls { --yoy-accent:#ec4899; --yoy-ink:#500724; }
    .yoy-card { padding:18px; border:1px solid var(--line); border-top:4px solid var(--yoy-accent, var(--green)); background:var(--white); }
    .yoy-card h2 { margin:0 0 6px; font-size:1.25rem; }
    .yoy-kicker { margin:0 0 4px; color:var(--yoy-accent); font-size:.78rem; font-weight:900; letter-spacing:.08em; text-transform:uppercase; }
    .yoy-status { margin:0; font-size:1.5rem; font-weight:900; line-height:1.15; }
    .yoy-countdown { margin:6px 0 0; font-weight:800; font-variant-numeric:tabular-nums; }
    .yoy-when { margin:4px 0 0; color:var(--muted); font-weight:600; font-size:.92rem; }
    .yoy-steps { display:grid; gap:6px; margin:14px 0 0; padding:0; list-style:none; font-size:.9rem; }
    .yoy-steps li { display:flex; justify-content:space-between; gap:12px; padding:8px 10px; background:rgba(var(--black-rgb),.04); }
    .yoy-steps li b { flex:0 0 auto; white-space:nowrap; }
    .yoy-steps li span { color:var(--muted); font-weight:700; text-align:right; }
    .yoy-steps li[data-current] { outline:2px solid var(--yoy-accent); }
    .yoy-form { display:grid; gap:14px; }
    .yoy-form label { display:grid; gap:7px; font-weight:850; }
    .yoy-form input, .yoy-form textarea { width:100%; padding:12px; border:1px solid rgba(var(--black-rgb),.22); border-radius:9px; background:var(--white); font:inherit; font-size:16px; }
    .yoy-form textarea { min-height:96px; resize:vertical; }
    .yoy-form input:focus, .yoy-form textarea:focus { outline:3px solid var(--yoy-accent); outline-offset:1px; }
    .yoy-results { display:grid; gap:6px; margin:0; padding:0; list-style:none; max-height:340px; overflow-y:auto; }
    .yoy-results button, .yoy-pick { display:grid; gap:2px; width:100%; padding:10px 12px; border:1px solid var(--line); border-radius:9px; background:var(--white); color:inherit; font:inherit; text-align:left; cursor:pointer; }
    .yoy-results button:hover, .yoy-results button:focus { border-color:var(--yoy-accent); outline:none; }
    .yoy-results b, .yoy-pick b { font-size:1rem; }
    .yoy-results small, .yoy-pick small { color:var(--muted); font-weight:600; }
    .yoy-pick { border:2px solid var(--yoy-accent); cursor:default; }
    .yoy-pick-row { display:flex; justify-content:space-between; align-items:center; gap:10px; }
    .yoy-link-button { padding:0; border:0; background:none; color:var(--yoy-accent); font:inherit; font-weight:850; text-decoration:underline; cursor:pointer; }
    .yoy-hint, .yoy-count { margin:0; color:var(--muted); font-size:.86rem; font-weight:600; }
    .yoy-hp { position:absolute; left:-9999px; width:1px; height:1px; overflow:hidden; }
    .yoy-submit { justify-self:start; padding:13px 24px; border:0; border-radius:999px; background:var(--yoy-accent); color:#fff; font:inherit; font-weight:900; cursor:pointer; }
    .yoy-submit[disabled] { opacity:.6; cursor:wait; }
    .yoy-message { margin:0; font-weight:800; }
    .yoy-message.is-error { color:#b42318; }
    .yoy-share-row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:8px; }
    .yoy-share-row code { flex:1 1 220px; min-width:0; padding:10px; background:rgba(var(--black-rgb),.05); font-size:.85rem; overflow-wrap:anywhere; }
    .yoy-share-row button { padding:10px 16px; border:2px solid var(--yoy-accent); border-radius:999px; background:var(--white); font:inherit; font-weight:850; cursor:pointer; }
    .yoy-foot { margin:0; text-align:center; color:var(--muted); font-weight:700; }
    .yoy-foot a { color:inherit; }
    .yoy-hub { display:grid; gap:26px; }
    .yoy-hub h2 { margin:0 0 10px; }
    .yoy-group { display:grid; gap:10px; margin-bottom:14px; }
    .yoy-group h3 { margin:0; color:var(--yoy-accent); font-size:.85rem; letter-spacing:.08em; text-transform:uppercase; }
    .yoy-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
    .yoy-tile { display:grid; gap:6px; padding:14px; border:1px solid var(--line); border-left:5px solid var(--yoy-accent); background:var(--white); color:inherit; text-decoration:none; }
    .yoy-tile strong { font-size:1.05rem; }
    .yoy-chip { justify-self:start; padding:3px 8px; border-radius:999px; background:var(--yoy-ink); color:#fff; font-size:.72rem; font-weight:850; letter-spacing:.03em; }
    .yoy-intro { margin:0; font-weight:600; }
    .yoy-ballot-shop { margin:14px 0 4px; }
    .yoy-finalists { display:grid; gap:8px; margin:0; padding:0; list-style:none; }
    .yoy-finalist-row { display:flex; flex-wrap:wrap; gap:8px; align-items:stretch; }
    .yoy-page-link { flex:1 0 100%; margin-top:-2px; padding-left:4px; font-size:.86rem; font-weight:800; }
    .yoy-page-link:not([data-pw-linked]) { display:none; }
    .yoy-page-link a { color:inherit; text-decoration:underline; text-underline-offset:3px; }
    .yoy-finalist-row > .yoy-finalist { flex:1 1 0; min-width:0; }
    .yoy-share-finalist { flex:0 0 auto; min-width:76px; padding:0 12px; border:2px solid var(--line); border-radius:10px; background:var(--white); color:inherit; font:inherit; font-size:.88rem; font-weight:850; cursor:pointer; }
    .yoy-share-finalist:hover, .yoy-share-finalist:focus-visible { border-color:var(--yoy-accent); outline:none; }
    .yoy-finalist-row.is-focus > .yoy-finalist { border-color:var(--yoy-accent); }
    .yoy-finalist-row.is-focus > .yoy-finalist:not([aria-pressed="true"]) { box-shadow:0 0 0 3px var(--yoy-accent); }
    .yoy-finalist { display:grid; gap:3px; width:100%; padding:12px 14px; border:2px solid var(--line); border-radius:10px; background:var(--white); color:inherit; font:inherit; text-align:left; }
    button.yoy-finalist { cursor:pointer; }
    button.yoy-finalist:hover, button.yoy-finalist:focus { border-color:var(--yoy-accent); outline:none; }
    .yoy-finalist[aria-pressed="true"] { border-color:var(--yoy-accent); background:rgba(var(--black-rgb),.03); box-shadow:inset 6px 0 0 var(--yoy-accent); }
    .yoy-finalist b { font-size:1.05rem; }
    .yoy-finalist small { color:var(--muted); font-weight:650; }
    .yoy-finalist em { font-style:normal; font-size:.9rem; }
    .yoy-finalist.is-winner { border-color:var(--yoy-accent); box-shadow:inset 6px 0 0 var(--yoy-accent); }
    .yoy-winner-tag { justify-self:start; padding:3px 9px; border-radius:999px; background:var(--yoy-accent); color:#fff; font-size:.72rem; font-weight:900; letter-spacing:.06em; text-transform:uppercase; }
    .yoy-rules { margin:0 0 6px; font-weight:800; font-size:.9rem; }
    /* Store card sits above the vote card (Zachary, 2026-11-10); this line
       sends voters straight down to the finalists. */
    .yoy-vote-below { display:flex; justify-content:center; align-items:center; gap:10px; min-height:48px; margin:-4px 0 0; padding:10px 16px; border-radius:12px; background:var(--ink); color:#fff; font-weight:900; font-size:1.05rem; letter-spacing:.5px; text-decoration:none; }
    .yoy-vote-below:hover, .yoy-vote-below:focus-visible { background:var(--green-dark); }
    [data-yoy-vote] { scroll-margin-top:84px; }
    @media (prefers-reduced-motion: no-preference) { html:has(.yoy-vote-below) { scroll-behavior:smooth; } }
    .yoy-votes { display:block; margin-top:4px; font-weight:900; font-variant-numeric:tabular-nums; }
    .yoy-total { list-style:none; margin-top:6px; color:var(--muted); font-weight:800; font-variant-numeric:tabular-nums; }
    .yoy-voted { margin:0; padding:10px 12px; background:rgba(var(--black-rgb),.05); font-weight:850; }
    @media (max-width: 760px) { .yoy-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
`;

const ROMAN = { 1: "I", 2: "II", 3: "III", 4: "IV" };
const awardName = (award) => ({ athlete: "Athlete of the Year", team: "Team of the Year", coach: "Coach of the Year" })[award];
const divisionLabel = (category) => `${category.gender === "boys" ? "Boys" : "Girls"} Division ${ROMAN[category.division]}`;

// Compact rows the page script searches: athletes are
// [id, name, school, grade, seasonBest, regionalPlace, regional];
// teams are [id, name, regionalPlace, regionalScore, regional];
// coach programs are [id, school, city].
function compactPool(category, list) {
  if (category.award === "coach") return list.map((item) => [item.id, item.name, item.city]);
  return category.award === "athlete"
    ? list.map((item) => [item.id, item.name, item.school, item.grade, item.seasonBest, item.regionalPlace, item.regional])
    : list.map((item) => [item.id, item.name, item.regionalPlace, item.regionalScore, item.regional]);
}

function jsonScript(id, value) {
  return `<script type="application/json" id="${id}">${JSON.stringify(value).replace(/</g, "\\u003c")}</script>`;
}

// Rendered on the server by api/pages/awards-2026.js (2026-11-10), so the
// share tags can follow the real finalists and switch to the winner on
// their own: share = { title, description, image, url, robots, focus }
// from lib/awards_share.mjs. focus is a finalist's link name; the page
// scrolls to that finalist.
export function yearlyAwardsCategoryPage(site, pool, category, { share = null, assetVersion = "" } = {}) {
  const list = categoryPool(pool, category.slug) || [];
  const pathname = `/awards/2026/${category.slug}/`;
  const closes = formatEt(YEARLY_AWARDS_SCHEDULE.nominations_close_at);
  const noun = category.award;
  const isCoach = noun === "coach";
  const votingCloses = formatEt(YEARLY_AWARDS_SCHEDULE.voting_close_at);
  // Voting is open (2026-11-10): the copy is about voting; the nominate
  // form stays in the page, hidden, for the page script.
  const intro = `Vote for the 2026 ${divisionLabel(category)} ${awardName(category.award)}. You can vote once an hour. Voting closes ${votingCloses}, and the winner is announced Saturday morning, Nov. 14.`;
  const hint = isCoach
    ? `Every Ohio school in ${escapeHtml(divisionLabel(category))} is listed, filed by the school's OHSAA cross country division. Can't find a school? It may be listed in another division; use the links at the bottom.`
    : `Only ${noun === "athlete" ? "athletes" : "teams"} who qualified for the 2026 ${escapeHtml(divisionLabel(category))} state meet are listed.`;
  const content = `<style>${styles}${bicarbStyles}${merchStyles}${supportStyles}</style>
  ${pageHero({
    eyebrow: "2026 Podium Watch Awards",
    title: category.label,
    description: intro
  })}
  <section class="section section-paper">
    <div class="container yoy-shell" data-yoy-category="${escapeHtml(category.slug)}" data-gender="${escapeHtml(category.gender)}"${share?.focus ? ` data-yoy-focus="${escapeHtml(share.focus)}"` : ""}>
      <section class="yoy-card">
        <p class="yoy-kicker">${escapeHtml(divisionLabel(category))} &middot; ${escapeHtml(awardName(category.award))}</p>
        <p class="yoy-status" data-yoy-status>Voting open</p>
        <p class="yoy-countdown" data-yoy-countdown></p>
        <p class="yoy-when" data-yoy-when>Voting closes ${escapeHtml(votingCloses)}.</p>
        <ol class="yoy-steps">
          <li data-step="voting"><b>Voting</b> <span>${escapeHtml(formatEt(YEARLY_AWARDS_SCHEDULE.voting_open_at))} to ${escapeHtml(formatEt(YEARLY_AWARDS_SCHEDULE.voting_close_at))}</span></li>
          <li data-step="winners"><b>Winners</b> <span>Saturday morning, Nov. 14</span></li>
        </ol>
      </section>

      <section class="yoy-card" data-yoy-nominate hidden>
        <h2>Nominate ${noun === "athlete" ? "an athlete" : isCoach ? "a coach" : "a team"}</h2>
        <form class="yoy-form" data-yoy-form novalidate>
          <label>Search ${noun === "athlete" ? "athletes or schools" : "schools"}
            <input type="search" data-yoy-search placeholder="${noun === "athlete" ? "Type a name or school" : "Type a school"}" autocomplete="off" enterkeyhint="search">
          </label>
          <p class="yoy-hint">${hint}</p>
          <ul class="yoy-results" data-yoy-results></ul>
          <div data-yoy-picked hidden></div>
          ${isCoach ? `<label>Coach's name <small class="yoy-count">Required</small>
            <input type="text" name="coach_name" maxlength="60" autocomplete="off" placeholder="First and last name">
          </label>` : ""}
          <label>Why? <small class="yoy-count" data-yoy-reason-count>Optional, 300 characters max</small>
            <textarea name="reason" maxlength="300" placeholder="${isCoach ? "What did this coach do for the program this season?" : "What made their season stand out?"}"></textarea>
          </label>
          <label>Your first name <small class="yoy-count">Optional</small>
            <input type="text" name="first_name" maxlength="40" autocomplete="given-name">
          </label>
          <label class="yoy-hp" aria-hidden="true">Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label>
          <button class="yoy-submit" type="submit">Submit nomination</button>
          <p class="yoy-message" data-yoy-message role="status" aria-live="polite"></p>
        </form>
      </section>

      ${merchCardHtml({ placement: "vote-page", from: pathname, audience: category.gender })}
      <a class="yoy-vote-below" href="#vote" data-yoy-vote-below hidden>Vote below <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><path d="M12 4v15M5 12l7 7 7-7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="square"/></svg></a>

      <section class="yoy-card" id="vote" data-yoy-vote hidden>
        <h2 data-yoy-vote-title>Vote</h2>
        <p class="yoy-rules">You can vote once an hour in each category. Votes that look automated are removed.</p>
        <p class="yoy-hint" data-yoy-vote-hint></p>
        <ol class="yoy-finalists" data-yoy-finalists></ol>
        <div class="yoy-ballot-shop" data-yoy-ballot-shop hidden>${merchCardHtml({ placement: "ballot", from: pathname, audience: category.gender })}</div>
        <div data-yoy-turnstile></div>
        <label class="yoy-hp" aria-hidden="true">Website <input type="text" data-yoy-vote-trap tabindex="-1" autocomplete="off"></label>
        <button class="yoy-submit" type="button" data-yoy-cast hidden>Cast my vote</button>
        <p class="yoy-voted" data-yoy-voted hidden></p>
        <p class="yoy-message" data-yoy-vote-message role="status" aria-live="polite"></p>
        ${merchEnabled() ? `<div data-pwm-after hidden>${merchCardHtml({ placement: "after-vote", from: pathname, large: true, audience: category.gender })}</div>` : ""}
        ${supportEnabled() ? `<div data-pws-after hidden>${supportCardHtml({ placement: "after-vote", from: pathname, large: true })}</div>` : ""}
      </section>

      <section class="yoy-card" data-yoy-closed hidden>
        <h2 data-yoy-closed-title>Nominations are closed</h2>
        <p class="yoy-hint" data-yoy-closed-text></p>
      </section>

      ${bicarbVotingAdHtml(`awards-${category.slug}`)}

      <section class="yoy-card">
        <h2>Share this category</h2>
        <p class="yoy-hint">Send this link so others can vote too. Each finalist also has a Share button with their own link.</p>
        <div class="yoy-share-row"><code data-yoy-share-url>${escapeHtml(`${site.siteUrl}${pathname}`)}</code><button type="button" data-yoy-copy>Copy link</button></div>
      </section>

      <p class="yoy-foot"><a href="/awards/2026/">See all 24 award categories</a> &middot; podiumwatch.org</p>
    </div>
  </section>
  ${jsonScript("yoy-data", { slug: category.slug, award: category.award, schedule: YEARLY_AWARDS_SCHEDULE, pool: compactPool(category, list) })}
  <script src="/scripts/awards-2026.js" defer></script>
  ${supportScripts()}
  ${merchScripts()}`;

  const html = layout({
    site,
    title: share?.title || `Vote: 2026 ${category.label}`,
    description: share?.description || `Vote for the 2026 ${divisionLabel(category)} ${awardName(category.award)} in Ohio cross country. Voting closes ${votingCloses}.`,
    pathname,
    content,
    ...(share?.image ? { image: share.image, imageWidth: 1200, imageHeight: 630 } : {}),
    ...(share?.url ? { canonicalUrl: share.url } : {}),
    ...(share?.robots ? { robots: share.robots } : {})
  });
  // Same cache-busting the static build does (scripts/build.mjs).
  return assetVersion ? html.replace(/(src="\/scripts\/[^"?]+\.js)(")/g, `$1?v=${assetVersion}$2`).replace(/(href="\/styles\/[^"?]+\.css)(")/g, `$1?v=${assetVersion}$2`) : html;
}

export function yearlyAwardsHubPage(site, pool) {
  const section = (award) => `<section class="yoy-group-wrap">
      <h2>${escapeHtml(awardName(award))}</h2>
      ${["boys", "girls"].map((gender) => `<div class="yoy-group yoy-${gender}">
        <h3>${gender === "boys" ? "Boys" : "Girls"}</h3>
        <div class="yoy-grid">
          ${pool.categories.filter((item) => item.award === award && item.gender === gender).sort((a, b) => a.division - b.division).map((item) => `<a class="yoy-tile" href="/awards/2026/${escapeHtml(item.slug)}/"><strong>Division ${ROMAN[item.division]}</strong><span class="yoy-chip" data-yoy-chip="${escapeHtml(item.slug)}">Voting open</span></a>`).join("")}
        </div>
      </div>`).join("")}
    </section>`;

  const content = `<style>${styles}${bicarbStyles}${merchStyles}${supportStyles}</style>
  ${pageHero({
    eyebrow: "2026 Podium Watch Awards",
    title: "Athlete, Team and Coach of the Year",
    description: `Vote for the best of the 2026 Ohio cross country season in all 24 categories. Voting closes ${formatEt(YEARLY_AWARDS_SCHEDULE.voting_close_at)}, and winners are announced Saturday morning, Nov. 14.`
  })}
  <section class="section section-paper">
    <div class="container yoy-hub" data-yoy-hub>
      <p class="yoy-intro">Pick a category to vote. You can vote once an hour in each category. Athlete and Team of the Year finalists are 2026 state qualifiers.</p>
      ${bicarbVotingAdHtml("awards-hub")}
      ${section("athlete")}
      ${section("team")}
      ${section("coach")}
      <div data-pw-alt="merch">${merchCardHtml({ placement: "vote-page", from: "/awards/2026/" })}</div>
      ${supportEnabled() ? `<div data-pw-alt="support" hidden>${supportCardHtml({ placement: "awards-hub", from: "/awards/2026/" })}</div>` : ""}
      <p class="yoy-foot">podiumwatch.org</p>
    </div>
  </section>
  ${jsonScript("yoy-data", { hub: true, schedule: YEARLY_AWARDS_SCHEDULE })}
  <script src="/scripts/awards-2026.js" defer></script>
  ${supportScripts()}
  ${merchScripts()}`;

  return layout({
    site,
    title: "Vote: 2026 Athlete, Team and Coach of the Year",
    description: `Vote for the 2026 Ohio cross country Athletes, Teams and Coaches of the Year, boys and girls, Divisions I to IV. Voting closes ${formatEt(YEARLY_AWARDS_SCHEDULE.voting_close_at)}.`,
    pathname: "/awards/2026/",
    content
  });
}
