import { layout } from "../lib/html.mjs";
import data from "../data/mock-postseason-2026.json" with { type: "json" };
import schoolExpansions from "../data/mock-postseason-school-expansions-2026.json" with { type: "json" };
import nameOverrides from "../data/mock-postseason-name-overrides-2026.json" with { type: "json" };
import logoManifest from "../data/mock-postseason-logo-manifest-2026.json" with { type: "json" };

// 2026 Mock Postseason: Districts -> Regionals -> State, built from the
// full statewide Ohio 2026 XC roster package (ohio_2026_xc_Claude_Code),
// chained through dataimports/ohio_2026_xc_Claude_Code/build-postseason-
// chain.mjs. LOCAL-ONLY REVIEW BUILD: lives at /mock-postseason/... (not
// /mock-meets/...), not linked from any nav, not referenced by
// scripts/build.mjs's live page list. Nothing here replaces the live
// Mock Regionals/State feature until explicitly approved.
//
// Round 3 (2026-10-20): every team row opens to a roster dropdown
// (native <details>, no JS required to use it); individual-only rows
// (no team at this level) get the same tap-to-expand showing grade,
// season best and where they qualified from; regional cards show just
// the site name with gender/division in a small label; cross-links from
// a district/regional qualifier land on the next level with that exact
// card pre-opened and the team's row highlighted. Logos are still NOT
// wired in -- the user is sending real logo files + a logo_map.json;
// nothing usable existed at scale in this repo (see Round 2's reply).
// Neutral initials circles remain the fallback.

const GENDER_LABEL = { boys: "Boys", girls: "Girls" };
const DIVISION_LABEL = { 1: "Division I", 2: "Division II", 3: "Division III", 4: "Division IV" };
const GENDERS = ["boys", "girls"];
const DIVISIONS = [1, 2, 3, 4];

function divisionNum(division) {
  return typeof division === "string" ? Number(division.replace(/^D/i, "")) : division;
}
function divisionLabel(division) {
  return DIVISION_LABEL[divisionNum(division)] || `Division ${division}`;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatHumanDate(isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || "");
  if (!m) return isoDate;
  return `${MONTH_NAMES[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}
const AS_OF_LABEL = `Projected &middot; as of ${formatHumanDate(data.asOf)} &middot; not official`;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatPlace(value) {
  if (value == null) return "--";
  if (Number.isInteger(value)) return String(value);
  return `T-${Math.floor(value)}`;
}
function formatPoints(value) {
  if (value == null) return "--";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
// One time format everywhere: m:ss.s, built from timeCentiseconds so a
// computed value (a 1-5 split, an average) never drifts from the same
// format the source seasonBest strings already use.
function formatTimeFromCentiseconds(cs) {
  if (cs == null) return "--";
  const totalTenths = Math.round(cs / 10);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = (totalTenths % 600) / 10;
  return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
}

// Confirmed-only school-name expansion. Primary source:
// dataimports/district_meets_2026.json's entered_schools[].full_name --
// the real roster OHSAA/Athletic.net uses at each district. Division I
// schools never appear there (no district stage), so a secondary pass
// cross-references each D1 abbreviation's own `city` field the same way.
// Round 3 adds a hand-confirmed list of standard Ohio school names the
// user supplied directly. A name not in the map has no confirmed
// expansion anywhere and is shown exactly as collected.
function schoolDisplay(name) {
  return escapeHtml(schoolExpansions[name] || name);
}

// Display-only athlete name fixes (Section E, 2026-10-20) -- the source
// data (team_top_7.csv, ohio_2026_xc_full_statewide_2026.json) is never
// touched; this only changes what gets printed. Keyed by "name|school"
// (not name alone) since a name collision across two different schools
// should never silently apply the wrong override. Kept in its own file
// (mock-postseason-name-overrides-2026.json) so more can be added later
// without touching this module.
function runnerDisplay(name, school) {
  return escapeHtml(nameOverrides[`${name}|${school}`] || name);
}

// Neutral initials circle -- first letters of the first two words, or
// the first two letters of a single-word name. Never a real logo image;
// pending the user's logo files + logo_map.json (Round 3 item 4).
function initials(name) {
  const clean = String(name || "").replace(/\(.*?\)/g, "").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (clean.slice(0, 2) || "?").toUpperCase();
}
// Real school logos (Round 5, 2026-10-21): logoManifest maps a team/school
// name exactly as it appears in this data (schoolName -> { sourceFile, slug })
// to a pre-resized 96x96 PNG already copied into public/images/mock-
// postseason-logos/schools/ by _tmp_resize_logos.mjs (one-off script, not
// part of the build). Never pulled from the web, never guessed -- a name
// with no manifest entry always falls back to the neutral initials circle.
function logoHtml(name) {
  const entry = logoManifest[name];
  if (entry) {
    return `<img class="mp-logo mp-logo-img" src="/images/mock-postseason-logos/schools/${entry.slug}.png" alt="" aria-hidden="true" loading="lazy" width="28" height="28">`;
  }
  return `<span class="mp-logo" aria-hidden="true">${escapeHtml(initials(name))}</span>`;
}

// Bicarb ad units (Round 6, 2026-10-21, per BICARB_ADS_BRIEF.md): replaces
// the earlier simple bar/card/footer component entirely. Every unit is the
// same link + alt text + disclosure; only size/placement differ. Assets
// are pre-sized retina PNGs (2x, mobile ones 3x) copied once into
// public/images/sponsors/bicarb/ -- displayed at their CSS size via width/
// height attributes so the browser never has to guess or reflow. Halfpage
// 300x600 is deliberately not built: this site has no 2-column layout for
// a sticky sidebar to live in, and the user chose "skip, no layout
// restructure" over adding one.
const BICARB_URL = "https://bicarb.shop/?ref=podiumwatch";
const BICARB_ALT = "Bicarb race-day fuel. Use code PODIUMWATCH. Affiliate ad.";
const BICARB_IMG_BASE = "/images/sponsors/bicarb";
const BICARB_DISCLOSURE = `<span class="mp-sponsor-disclosure">AFFILIATE &middot; AD</span>`;
// unit/position feed data-bicarb-unit / data-bicarb-position for the
// shared click tracker (BICARB_SCRIPT) to read off the clicked link itself
// -- no per-call-site JS needed.
function bicarbLinkOpen(unit, position, extraClass, lazy) {
  return `<a class="mp-bicarb-link${extraClass ? ` ${extraClass}` : ""}" href="${BICARB_URL}" target="_blank" rel="sponsored noopener" data-bicarb-unit="${unit}" data-bicarb-position="${position}">`;
}
function bicarbBillboardHtml() {
  // Hub page only, >=1000px, under the sticky tab block.
  return `<div class="mp-bicarb-billboard">
    ${bicarbLinkOpen("billboard", "hub-header")}<img src="${BICARB_IMG_BASE}/bicarb-billboard-970x250.png" alt="${BICARB_ALT}" width="970" height="250"></a>
    ${BICARB_DISCLOSURE}
  </div>`;
}
// <picture> swaps the file by viewport width -- a phone never downloads
// the desktop leaderboard PNG and vice versa. Top of every district,
// regional and state page.
function bicarbLeaderboardHtml(position) {
  return `<div class="mp-bicarb-leaderboard">
    ${bicarbLinkOpen("leaderboard_or_mobile-banner", position)}<picture>
      <source media="(min-width: 760px)" srcset="${BICARB_IMG_BASE}/bicarb-leaderboard-728x90.png">
      <img src="${BICARB_IMG_BASE}/bicarb-mobile-banner-320x100.png" alt="${BICARB_ALT}" width="320" height="100">
    </picture></a>
    ${BICARB_DISCLOSURE}
  </div>`;
}
// Between races/sections. Never between a team list and its cut line --
// every call site places this after the full team table (and, on
// regionals/state, before the individual list), never mid-list.
function bicarbInfeedHtml(position) {
  return `<div class="mp-bicarb-infeed">
    ${bicarbLinkOpen("infeed", position)}<img src="${BICARB_IMG_BASE}/bicarb-infeed-640x200.png" alt="${BICARB_ALT}" width="640" height="200" loading="lazy"></a>
    ${BICARB_DISCLOSURE}
  </div>`;
}
// Bottom of each page. variant: "light" | "dark".
function bicarbRectangleHtml(position, variant) {
  const file = variant === "dark" ? "bicarb-rectangle-dark-300x250.png" : "bicarb-rectangle-300x250.png";
  return `<div class="mp-bicarb-rectangle">
    ${bicarbLinkOpen("rectangle", position)}<img src="${BICARB_IMG_BASE}/${file}" alt="${BICARB_ALT}" width="300" height="250" loading="lazy"></a>
    ${BICARB_DISCLOSURE}
  </div>`;
}
// Phone-only pinned bottom bar. Dismiss is sessionStorage-backed (stays
// closed for the rest of this browser session, per the brief) and adds
// bottom padding to <body> while visible so it never covers the cut line
// or a row's text -- removed the instant it's dismissed.
function bicarbMobileStickyHtml() {
  return `<div class="mp-bicarb-sticky" id="mp-bicarb-sticky">
    ${bicarbLinkOpen("mobile-sticky", "pinned-bottom")}<img src="${BICARB_IMG_BASE}/bicarb-mobile-sticky-320x50.png" alt="${BICARB_ALT}" width="320" height="50" loading="lazy"></a>
    <button type="button" class="mp-bicarb-sticky-close" aria-label="Close">&times;</button>
  </div>`;
}
// Appended once per page. Delegated click tracking for every unit
// (gtag event bicarb_click) plus the mobile-sticky show/dismiss logic.
const BICARB_SCRIPT = `<script>
(function(){
  document.querySelectorAll('.mp-bicarb-link').forEach(function(a){
    a.addEventListener('click', function(){
      if (window.gtag) gtag('event', 'bicarb_click', { page: location.pathname, unit: a.dataset.bicarbUnit, position: a.dataset.bicarbPosition });
    });
  });
  var sticky = document.getElementById('mp-bicarb-sticky');
  if (sticky) {
    var KEY = 'mp_bicarb_sticky_dismissed';
    var dismissed = false;
    try { dismissed = sessionStorage.getItem(KEY) === '1'; } catch (e) {}
    if (dismissed) {
      sticky.remove();
    } else {
      document.body.classList.add('mp-has-bicarb-sticky');
      sticky.querySelector('.mp-bicarb-sticky-close').addEventListener('click', function(){
        sticky.remove();
        document.body.classList.remove('mp-has-bicarb-sticky');
        try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
      });
    }
  }
})();
</script>`;

function genderAccentVar(gender) {
  return gender && gender.toLowerCase() === "girls" ? "var(--mp-pink)" : "var(--mp-green)";
}

// Cross-link anchors: a team row carries data-anchor="<gender>|D<n>|team|<team name>",
// an individual row carries data-anchor="<gender>|D<n>|runner|<name>|<school>"
// -- one unified attribute/param (not two separate systems) so the next
// level's page can find and pre-open that exact row (team or runner)
// and highlight it, arriving via a single ?anchor= query param.
function teamAnchorKey(gender, divNum, teamName) {
  return `${gender.toLowerCase()}|D${divNum}|team|${teamName}`;
}
function runnerAnchorKey(gender, divNum, name, school) {
  return `${gender.toLowerCase()}|D${divNum}|runner|${name}|${school}`;
}

// Real regional site name -> the 4-value region key mock-regionals-2026.json
// uses, mirrored from build-postseason-chain.mjs's own REGIONAL_SITE_TO_KEY
// (duplicated here rather than imported since this module only reads the
// already-built JSON, not the chain script).
const REGIONAL_SITE_TO_KEY = { Pickerington: "central", Boardman: "northeast", Tiffin: "northwest", Troy: "southwest" };

function crossLinkHref({ tab, gender, divNum, anchor, hash }) {
  const sp = new URLSearchParams({ tab, g: gender.toLowerCase(), d: String(divNum), anchor });
  return `/mock-postseason/?${sp.toString()}#${hash}`;
}

const SHARED_STYLE = `<style>
  :root { --mp-green: #0FAF68; --mp-pink: #EC4899; --mp-sticky-top: 59px; }
  .mp-compacthero { padding: 16px 0; border-bottom: 1px solid var(--line); }
  .mp-compacthero .mp-eyebrow { display: inline-block; margin-bottom: 4px; font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif; font-size: .68rem; letter-spacing: .08em; text-transform: uppercase; color: var(--green); }
  .mp-compacthero h1 { margin: 0 0 4px; font-size: 1.7rem; line-height: 1.1; }
  .mp-compacthero p { margin: 0; color: var(--muted); font-size: .88rem; }
  .mp-statuspill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; background: var(--paper); border: 1px solid var(--line); font-size: .74rem; color: var(--muted); font-weight: 600; margin-top: 6px; }

  .mp-stickyblock { position: sticky; top: var(--mp-sticky-top); z-index: 20; background: var(--white); border-bottom: 1px solid var(--line); }
  .mp-tabbar { display: flex; gap: 2px; padding: 6px 6px 4px; }
  .mp-tabbtn { flex: 1; border: none; background: transparent; padding: 8px 6px; min-height: 40px; font-weight: 800; font-size: .84rem; color: var(--muted); border-radius: 7px; cursor: pointer; }
  .mp-tabbtn.active { background: var(--black); color: var(--white); }
  .mp-filterrow { display: flex; gap: 6px; padding: 0 6px 8px; overflow-x: auto; -webkit-overflow-scrolling: touch; white-space: nowrap; }
  .mp-filterrow::-webkit-scrollbar { display: none; }
  .mp-filterbtn, .mp-racechip { flex: 0 0 auto; min-height: 36px; padding: 0 13px; border: 1px solid var(--line); background: var(--white); border-radius: 999px; font-weight: 700; font-size: .8rem; color: var(--ink); cursor: pointer; white-space: nowrap; }
  .mp-filterbtn.active[data-gender="boys"] { background: var(--mp-green); border-color: var(--mp-green); color: #063b25; }
  .mp-filterbtn.active[data-gender="girls"] { background: var(--mp-pink); border-color: var(--mp-pink); color: #4a0b2a; }
  .mp-filterbtn.active[data-division] { background: var(--ink); border-color: var(--ink); color: var(--white); }
  .mp-filterdivider { flex: 0 0 auto; width: 1px; background: var(--line); margin: 4px 2px; }
  .mp-racechip.active { background: var(--ink); color: var(--white); border-color: var(--ink); }

  .mp-breadcrumb { padding: 10px 16px; font-size: .8rem; color: var(--muted); border-bottom: 1px solid var(--line); }
  .mp-d1-regionals-btn { min-height: 44px; padding: 0 18px; border: none; border-radius: 6px; background: var(--ink); color: var(--white); font-weight: 700; font-size: .88rem; cursor: pointer; margin-top: 8px; }
  .mp-totop { position: fixed; right: 16px; bottom: 16px; z-index: 25; width: 46px; height: 46px; border-radius: 999px; background: var(--black); color: var(--white); border: none; font-size: 1.1rem; display: none; cursor: pointer; }
  .mp-totop.show { display: block; }

  /* .section's own base padding (86px top/bottom, main.css) left an
     ~80px empty gap between the sticky chip/filter block and the first
     race heading -- these pages never needed that top padding since the
     sticky block already separates them visually. */
  .mp-pagesection.section { padding-top: 0; }
  .mp-banner { margin: 16px 0; padding: 12px 16px; border-left: 6px solid #b45309; background: #fff7ed; color: #7c2d12; font-weight: 600; font-size: .88rem; }
  .mp-section { padding: 18px 0; scroll-margin-top: calc(var(--mp-sticky-top) + 104px); }
  .mp-section h2 { margin: 0 0 4px; font-size: 1.2rem; }
  .mp-meta { color: var(--muted); font-size: .86rem; margin: 0 0 10px; }
  .mp-h3 { font-size: .95rem; font-weight: 800; margin: 14px 0 4px; }

  .mp-rowlist { border-top: 1px solid var(--line); }
  .mp-row { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 6px 4px 6px 10px; border-bottom: 1px solid var(--line); border-left: 4px solid transparent; }
  .mp-row.mp-qualifies { border-left-color: var(--row-accent, var(--mp-green)); }
  .mp-row.mp-dimmed { opacity: .55; }
  .mp-row.mp-incomplete { opacity: .6; font-style: italic; }
  .mp-rownum { flex: 0 0 auto; width: 22px; text-align: right; font-variant-numeric: tabular-nums; font-size: .82rem; color: var(--muted); }
  .mp-logo { flex: 0 0 auto; width: 28px; height: 28px; border-radius: 999px; background: var(--paper); border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; font-size: .62rem; font-weight: 800; color: var(--muted); }
  .mp-logo-img { object-fit: contain; padding: 3px; box-sizing: border-box; }
  .mp-rowmain { flex: 1 1 auto; min-width: 0; }
  .mp-rowname { font-size: .92rem; font-weight: 700; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mp-rowsub { font-size: .76rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mp-rowtime { flex: 0 0 auto; font-variant-numeric: tabular-nums; font-size: .82rem; color: var(--ink); }
  .mp-tag { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 18px; padding: 0 6px; border-radius: 999px; font-size: .6rem; font-weight: 800; letter-spacing: .03em; text-transform: uppercase; }
  .mp-tag-ind { background: #111; color: #fff; }
  .mp-tag-prov { background: #b45309; color: #fff; }
  .mp-cutline { padding: 7px 10px; background: var(--row-accent, var(--mp-green)); font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif; font-size: .74rem; letter-spacing: .05em; text-transform: uppercase; color: #06230f; }
  .mp-allohioline { padding: 7px 10px; background: var(--paper); font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif; font-size: .74rem; letter-spacing: .05em; text-transform: uppercase; color: var(--ink); }
  .mp-showall { width: 100%; text-align: left; }
  .mp-showall summary { min-height: 44px; display: flex; align-items: center; padding: 8px 10px; font-weight: 700; font-size: .84rem; color: var(--ink); cursor: pointer; background: var(--paper); }
  .mp-footnote { margin: 10px 0 0; padding: 12px 16px; border: 1px solid var(--line); background: var(--paper); font-size: .83rem; color: var(--muted); }
  .mp-footnote summary { cursor: pointer; font-weight: 700; color: var(--ink); min-height: 44px; display: flex; align-items: center; }
  .mp-under-review { margin-top: 32px; padding: 16px; border: 2px dashed #b45309; background: #fff7ed; }

  /* A team row is itself a <details> -- summary is the flat row, body is
     the roster. Chevron rotates on open; roster rows are 44px, indented
     12px, with the gender-color bar continued down so the open roster
     reads as one block with its row. */
  .mp-teamrow { border-bottom: 1px solid var(--line); border-left: 4px solid transparent; }
  .mp-teamrow.mp-qualifies, .mp-teamrow[open] { border-left-color: var(--row-accent, var(--mp-green)); }
  .mp-teamrow.mp-dimmed summary { opacity: .55; }
  .mp-teamrow.mp-incomplete summary { opacity: .6; font-style: italic; }
  .mp-teamrow summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 6px 4px 6px 10px; }
  .mp-teamrow summary::-webkit-details-marker { display: none; }
  .mp-teamrow summary::marker { display: none; content: ""; }
  /* A static down-pointing chevron that flips to up on [open] -- the
     native <summary> marker (Chromium's ::marker, Firefox/Safari's
     -webkit-details-marker) points right by default and was still
     showing through next to this one since only one of the two was
     hidden. */
  .mp-chevron { flex: 0 0 auto; display: inline-block; transition: transform .15s; color: var(--muted); font-size: .7rem; }
  .mp-teamrow[open] .mp-chevron { transform: rotate(180deg); }
  .mp-roster { padding: 0 0 10px 12px; border-left: 4px solid var(--row-accent, var(--mp-green)); margin-left: 10px; }
  .mp-rosterrow { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 4px 8px; }
  /* Fixed widths on every roster column so a long name (and a longer
     role word like DISPLACER) never shifts the time/points/role columns
     left on 6th/7th rows -- the name gets whatever's left via flex:1 and
     ellipsizes instead. */
  .mp-rosterrow .mp-rowtime { width: 54px; text-align: right; }
  .mp-rosterplace { flex: 0 0 auto; width: 22px; text-align: right; font-variant-numeric: tabular-nums; font-size: .82rem; color: var(--muted); }
  .mp-rosterrole { flex: 0 0 auto; width: 56px; text-align: right; white-space: nowrap; font-size: .62rem; font-weight: 800; letter-spacing: .02em; text-transform: uppercase; color: var(--muted); }
  .mp-rosterfooter { padding: 8px 8px 2px; font-size: .78rem; color: var(--muted); }
  .mp-qualifiedfrom { padding: 2px 8px 2px; font-size: .78rem; color: var(--muted); }
  .mp-rosterlink { display: inline-block; padding: 8px; min-height: 32px; font-size: .8rem; font-weight: 700; color: var(--row-accent, var(--mp-green)); }
  .mp-highlight { animation: mp-flash 1.6s ease-out 1; }
  @keyframes mp-flash { from { background: color-mix(in srgb, var(--row-accent, var(--mp-green)) 30%, var(--white)); } to { background: transparent; } }

  /* Individual-only rows (no team at this level) get the same expand
     pattern, showing grade/time/qualified-from -- summary IS the row. */
  .mp-indrow { border-bottom: 1px solid var(--line); border-left: 4px solid transparent; }
  .mp-indrow.mp-qualifies { border-left-color: var(--row-accent, var(--mp-green)); }
  .mp-indrow summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 6px 4px 6px 10px; }
  .mp-indrow summary::-webkit-details-marker { display: none; }
  .mp-indrow summary::marker { display: none; content: ""; }
  .mp-indrow[open] .mp-chevron { transform: rotate(180deg); }
  .mp-indrow-body { padding: 4px 8px 10px 42px; font-size: .78rem; color: var(--muted); }

  /* Regional collapsed summary cards: title is just the site name, with
     gender+division as a small label (the filter already narrowed it). */
  .mp-regionalcard { border: 1px solid var(--line); border-left: 4px solid var(--row-accent, var(--mp-green)); margin-bottom: 10px; background: var(--white); }
  .mp-regionalcard summary { list-style: none; cursor: pointer; padding: 12px 14px; min-height: 44px; }
  .mp-regionalcard summary::-webkit-details-marker { display: none; }
  .mp-regionalcard summary::marker { display: none; content: ""; }
  .mp-regionalcard[open] .mp-chevron { transform: rotate(180deg); }
  .mp-regionalcard .mp-rc-label { display: block; font-size: .66rem; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); margin-bottom: 2px; }
  .mp-regionalcard summary h3 { margin: 0 0 4px; font-size: 1.1rem; }
  .mp-regionalcard .mp-rc-line { font-size: .82rem; color: var(--muted); margin: 2px 0; }
  .mp-regionalcard .mp-rc-line strong { color: var(--ink); }
  .mp-regionalcard[open] summary { border-bottom: 1px solid var(--line); }
  .mp-regionalcard-body { padding: 4px 14px 14px; }

  /* Bicarb ad units -- each wrapper centers its image at the image's own
     intrinsic size (max-width:100% lets it shrink on narrow screens) and
     carries the AFFILIATE · AD disclosure directly beneath it. */
  .mp-bicarb-billboard, .mp-bicarb-leaderboard, .mp-bicarb-infeed, .mp-bicarb-rectangle { text-align: center; margin: 14px 0; }
  .mp-bicarb-link { display: inline-block; line-height: 0; }
  .mp-bicarb-link img { max-width: 100%; height: auto; }
  .mp-bicarb-billboard { display: none; }
  @media (min-width: 1000px) { .mp-bicarb-billboard { display: block; } }
  .mp-bicarb-leaderboard img { max-width: 480px; }
  @media (min-width: 760px) { .mp-bicarb-leaderboard img { max-width: 100%; } }
  .mp-bicarb-infeed img, .mp-bicarb-rectangle img { max-width: 100%; }
  .mp-sponsor-disclosure { display: block; margin-top: 4px; font-size: .62rem; letter-spacing: .04em; color: var(--muted); font-weight: 700; }
  /* Mobile sticky bar: pinned bottom, phone only, closable, never covers
     the bottom tab bar or a row's text -- mp-has-bicarb-sticky adds body
     padding exactly while it's visible. */
  .mp-bicarb-sticky { display: none; }
  @media (max-width: 759px) {
    /* The site's own .mobile-dock (bottom tab bar: Home/Results/Meets/...)
       is fixed at bottom:0 with z-index:120 and ~64px tall -- stack this
       bar ABOVE it (bottom: 64px + safe-area, not bottom:0) so neither
       covers the other and the dock's own links stay clickable. */
    .mp-bicarb-sticky { position: fixed; left: 0; right: 0; bottom: calc(64px + env(safe-area-inset-bottom)); z-index: 30; display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 50px; background: var(--paper); border-top: 1px solid var(--line); padding: 0 8px; }
    .mp-bicarb-sticky .mp-bicarb-link { flex: 1 1 auto; max-width: 320px; }
    .mp-bicarb-sticky img { width: 100%; height: auto; display: block; }
    .mp-bicarb-sticky-close { flex: 0 0 auto; width: 32px; height: 32px; min-width: 32px; border: none; background: transparent; font-size: 1.2rem; line-height: 1; cursor: pointer; color: var(--muted); }
    body.mp-has-bicarb-sticky { padding-bottom: calc(50px + 64px + env(safe-area-inset-bottom)); }
  }
</style>`;

function compactHero({ eyebrow, title, description }) {
  return `<div class="mp-compacthero"><div class="container">
    <span class="mp-eyebrow">${escapeHtml(eyebrow)}</span>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    <div class="mp-statuspill">${AS_OF_LABEL}</div>
  </div></div>`;
}

function provisionalTag(provisional) {
  return provisional ? ' <span class="mp-tag mp-tag-prov">Prov.</span>' : "";
}

// Role label for a roster row: top 5 by team-only place SCORED (gender
// color), 6th/7th DISPLACER (muted), 8th+ blank. teamPlacePoints (from
// A1's team-only scoring pass in build-postseason-chain.mjs) is what
// tells us whether this runner actually belongs to the scoring 5 --
// teamPosition alone (pure finish order within the roster) is enough to
// know 1-5 vs 6-7 vs 8+, since a team's own runners are always listed
// in finish order already.
// Shortened so DISPLACER (the longest word) never pushes the time/points
// columns left on 6th/7th rows -- "6TH"/"7TH" is also more specific than
// a generic "DISPLACER" anyway. A fixed-width .mp-rosterrole (see CSS)
// handles the rest: every row reserves the same column widths whether
// or not this cell has content.
function roleLabel(teamPosition, accent) {
  if (teamPosition == null) return `<span class="mp-rosterrole"></span>`;
  if (teamPosition <= 5) return `<span class="mp-rosterrole" style="color:${accent}">SCORED</span>`;
  if (teamPosition === 6) return `<span class="mp-rosterrole">6TH</span>`;
  if (teamPosition === 7) return `<span class="mp-rosterrole">7TH</span>`;
  return `<span class="mp-rosterrole"></span>`;
}

function rosterRunnerRow(runner, index, individualKeys, teamName, accent) {
  const isInd = individualKeys.has(`${runner.name}|${teamName}`);
  return `<div class="mp-rosterrow">
    <span class="mp-rosterplace">${index + 1}</span>
    <div class="mp-rowmain">
      <div class="mp-rowname">${runnerDisplay(runner.name, teamName)}</div>
      <div class="mp-rowsub">${runner.grade ? `Gr ${escapeHtml(runner.grade)}` : ""}</div>
    </div>
    <span class="mp-rowtime">${escapeHtml(runner.seasonBest)}</span>
    <span class="mp-rosterplace">${formatPlace(runner.teamPlacePoints)}</span>
    ${roleLabel(index + 1, accent)}
    ${isInd ? '<span class="mp-tag mp-tag-ind">IND</span>' : ""}
  </div>`;
}

function ordinalWord(n) {
  if (n == null) return null;
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

// "Qualified from: Cedarville district, 1st" (regional team rows) or
// "Qualified from: Troy regional, 1st" (state team rows) -- same wording
// pattern individual rows already use, now on teams too (Round 4).
function qualifiedFromLineHtml(team) {
  if (team.qualifiedFromDistrict != null) {
    return `<div class="mp-qualifiedfrom">Qualified from: ${schoolDisplay(team.qualifiedFromDistrict)} district, ${ordinalWord(team.qualifiedFromDistrictOrdinal)}</div>`;
  }
  if (team.qualifiedFromRegional != null) {
    return `<div class="mp-qualifiedfrom">Qualified from: ${schoolDisplay(team.qualifiedFromRegional)} regional, ${ordinalWord(team.qualifiedFromRegionalOrdinal)}</div>`;
  }
  return "";
}

function rosterFooterHtml(team, crossLink) {
  const scorers = team.runners.slice(0, 5).filter((r) => r.timeCentiseconds != null);
  const parts = [`Team score ${formatPoints(team.score)}`];
  if (scorers.length === 5) {
    const times = scorers.map((r) => r.timeCentiseconds);
    const split = Math.max(...times) - Math.min(...times);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    parts.push(`1-5 split ${formatTimeFromCentiseconds(split)}`, `avg ${formatTimeFromCentiseconds(avg)}`);
  }
  const line = `<div class="mp-rosterfooter">${parts.join(" &middot; ")}</div>` + qualifiedFromLineHtml(team);
  return crossLink ? `${line}<a class="mp-rosterlink" href="${escapeHtml(crossLink.url)}">Advances to ${escapeHtml(crossLink.label)} &rarr;</a>` : line;
}

// A team row IS its own roster dropdown -- the whole row is the tap
// target (native <details>/<summary>, works with no JS, keyboard- and
// screen-reader-friendly). `state` picks qualifies/dimmed/incomplete
// styling; individualKeys flags a roster runner who is ALSO an
// individual qualifier from this non-qualifying team.
function teamRosterRow(team, rank, state, individualKeys, accent, anchorValue, crossLink) {
  const stateClass = state === "qualifies" ? " mp-qualifies" : state === "dimmed" ? " mp-dimmed" : state === "incomplete" ? " mp-incomplete" : "";
  const subtitle = team.complete
    ? `${formatPoints(team.score)} pts${team.sixthPlace != null ? ` &middot; 6th ${formatPoints(team.sixthPlace)}` : ""}`
    : "fewer than 5 runners";
  const roster = team.runners.map((r, i) => rosterRunnerRow(r, i, individualKeys, team.name, accent)).join("");
  return `<details class="mp-teamrow${stateClass}" style="--row-accent:${accent}" ${anchorValue ? `data-anchor="${escapeHtml(anchorValue)}"` : ""}>
    <summary>
      <span class="mp-rownum">${rank != null ? rank : "--"}</span>
      ${logoHtml(team.name)}
      <div class="mp-rowmain">
        <div class="mp-rowname">${schoolDisplay(team.name)}${provisionalTag(team.provisional)}</div>
        <div class="mp-rowsub">${subtitle}</div>
      </div>
      <span class="mp-chevron">&#9660;</span>
    </summary>
    <div class="mp-roster">${roster}${rosterFooterHtml(team, state === "qualifies" ? crossLink : null)}</div>
  </details>`;
}

// crossLinkFor(team) -> { url, label } | null -- only ever attached to a
// QUALIFYING team's roster, since a non-qualifying team has nothing
// waiting for it at the next level.
function teamRowsHtml(scoredTeams, teamsAdvance, individuals, accent, gender, divNum, crossLinkFor) {
  const complete = scoredTeams.filter((t) => t.complete);
  const incomplete = scoredTeams.filter((t) => !t.complete);
  if (!complete.length && !incomplete.length) return "<p class=\"mp-meta\">No field data yet.</p>";
  const individualKeys = new Set((individuals || []).map((q) => `${q.name}|${q.originalTeam}`));
  const anchorFor = (team) => (gender && divNum ? teamAnchorKey(gender, divNum, team.name) : null);

  const shownCount = teamsAdvance != null ? Math.min(complete.length, teamsAdvance + 2) : complete.length;
  const rows = [];
  for (let i = 0; i < shownCount; i++) {
    const rank = i + 1;
    const team = complete[i];
    if (teamsAdvance != null && rank === teamsAdvance + 1) {
      rows.push(`<div class="mp-cutline">Cut line &middot; top ${teamsAdvance} advance</div>`);
    }
    const state = teamsAdvance == null ? null : rank <= teamsAdvance ? "qualifies" : "dimmed";
    rows.push(teamRosterRow(team, rank, state, individualKeys, accent, anchorFor(team), crossLinkFor ? crossLinkFor(team) : null));
  }
  const rest = complete.slice(shownCount);
  const restHtml = rest.length
    ? `<details class="mp-showall"><summary>Show all ${complete.length} teams</summary>${rest.map((team, i) => teamRosterRow(team, shownCount + i + 1, "dimmed", individualKeys, accent, anchorFor(team))).join("")}</details>`
    : "";
  const incompleteHtml = incomplete.map((team) => teamRosterRow(team, null, "incomplete", individualKeys, accent, anchorFor(team))).join("");

  return `<div class="mp-rowlist">${rows.join("")}${restHtml}${incompleteHtml}</div>`;
}

// Builds the one real combined finish list a regional/district page
// shows: every team runner (tagged as a qualifier when their school is
// among the qualifying teams) PLUS every pooled individual qualifier
// (tagged IND), all sharing the SAME real overall placePoints from the
// combined-field scoreField() pass in build-postseason-chain.mjs.
// selectIndividualQualifiers() draws its pool from non-qualifying
// teams' own rosters -- an individual qualifier is STILL one of that
// team's own listed runners, so team rows exclude anyone who also
// appears in `individuals` to avoid listing that same person twice.
// realAdvancingKeys (Set of "name|school", optional): at the district
// level `individuals` is already the exact, final selected list
// (selectIndividualQualifiers already applied upstream), so every pooled
// individual shown here genuinely advances -- omit this param there. At
// the regional level `individuals` is the FULL pooled district-origin
// list (for real-finish-place display), which is NOT the same as who
// actually advances to state from this region -- found 2026-10-22 (user
// report): every pooled individual was being tagged/linked as advancing
// regardless of the region's real individualQualifiers cutoff, while a
// runner on a non-qualifying TEAM who personally ran fast enough for an
// individual berth got no tag/link at all. Pass the region's real
// built.stateQualifyingIndividualKeys here so both kinds of row reflect
// actual advancement instead of just "pooled" / "team qualifies".
function combinedFinishOrder(scoredTeams, qualifyingTeamNames, individuals, realAdvancingKeys) {
  const individualKeys = new Set((individuals || []).map((q) => `${q.name}|${q.originalTeam}`));
  const teamRows = scoredTeams.flatMap((team) =>
    team.runners
      .filter((r) => !individualKeys.has(`${r.name}|${team.name}`))
      .map((r) => {
        const teamQualifies = qualifyingTeamNames.has(team.name);
        const key = `${r.name}|${team.name}`;
        const personallyAdvances = !teamQualifies && realAdvancingKeys && realAdvancingKeys.has(key);
        return {
          name: r.name, grade: r.grade, school: team.name, seasonBest: r.seasonBest, placePoints: r.placePoints,
          tag: teamQualifies ? "TEAM" : (personallyAdvances ? "IND" : null),
          advancing: teamQualifies || personallyAdvances
        };
      })
  );
  const individualRows = (individuals || []).map((q) => {
    const key = `${q.name}|${q.originalTeam}`;
    return {
      name: q.name, grade: q.grade, school: q.originalTeam, seasonBest: q.seasonBest, placePoints: q.placePoints, tag: "IND",
      advancing: realAdvancingKeys ? realAdvancingKeys.has(key) : true,
      qualifiedFrom: q.qualifiedFromDistrict ? `${q.qualifiedFromDistrict} district (IND)` : (q.qualifiedFromRegional ? `${q.qualifiedFromRegional} regional, ${q.qualifiedFromRegionalOrdinal}` : null)
    };
  });
  return [...teamRows, ...individualRows].sort((a, b) => a.placePoints - b.placePoints);
}

// IND rows (no team at this level) get the same tap-to-expand pattern as
// a team row -- summary is the flat row, body shows grade/time/where
// they qualified from. TEAM-tagged and untagged rows stay plain (their
// own team's roster, shown elsewhere, already covers this).
// crossLinkFor(runner) -> { url, label } | null -- same "Advances to X"
// link pattern team rows get, now also on individual qualifier rows
// (IND tag only; TEAM-tagged/untagged rows have their own roster
// elsewhere, which already carries this link). gender/divNum (when
// given) set a stable data-anchor on every IND row regardless of
// whether it has a further "advances to" link -- state's own
// individual list has no next level to advance to, but its rows are
// still valid landing targets for an incoming regional-to-state link.
function runnerRowsHtml(rows, limit, allOhioAfter, crossLinkFor, gender, divNum) {
  const shown = limit ? rows.slice(0, limit) : rows;
  const body = shown.map((r, i) => {
    const advancing = r.advancing != null ? r.advancing : Boolean(r.tag);
    const qualifyClass = advancing ? " mp-qualifies" : "";
    let row;
    if (r.tag === "IND") {
      const crossLink = advancing && crossLinkFor ? crossLinkFor(r) : null;
      const advancesLink = crossLink ? `<a class="mp-rosterlink" href="${escapeHtml(crossLink.url)}">Advances to ${escapeHtml(crossLink.label)} &rarr;</a>` : "";
      const anchorValue = gender && divNum ? runnerAnchorKey(gender, divNum, r.name, r.school) : null;
      row = `<details class="mp-indrow${qualifyClass}" ${anchorValue ? `data-anchor="${escapeHtml(anchorValue)}"` : ""}>
        <summary>
          <span class="mp-rownum">${formatPlace(r.placePoints)}</span>
          ${logoHtml(r.school)}
          <div class="mp-rowmain">
            <div class="mp-rowname">${runnerDisplay(r.name, r.school)}</div>
            <div class="mp-rowsub">${schoolDisplay(r.school)}</div>
          </div>
          <span class="mp-rowtime">${escapeHtml(r.seasonBest)}</span>
          <span class="mp-tag mp-tag-ind">IND</span>
          <span class="mp-chevron">&#9660;</span>
        </summary>
        <div class="mp-indrow-body">${[r.grade ? `Gr ${escapeHtml(r.grade)}` : null, escapeHtml(r.seasonBest), r.qualifiedFrom ? `Qualified from: ${escapeHtml(r.qualifiedFrom)}` : null].filter(Boolean).join(" &middot; ")}${advancesLink}</div>
      </details>`;
    } else {
      row = `<div class="mp-row${qualifyClass}">
        <span class="mp-rownum">${formatPlace(r.placePoints)}</span>
        ${logoHtml(r.school)}
        <div class="mp-rowmain">
          <div class="mp-rowname">${runnerDisplay(r.name, r.school)}</div>
          <div class="mp-rowsub">${schoolDisplay(r.school)}${r.grade ? ` &middot; ${escapeHtml(r.grade)}` : ""}</div>
        </div>
        <span class="mp-rowtime">${escapeHtml(r.seasonBest)}</span>
        ${r.tag === "TEAM" ? '<span class="mp-tag" style="background:var(--row-accent,var(--mp-green));color:#06230f;">Q</span>' : ""}
      </div>`;
    }
    const divider = allOhioAfter && i === allOhioAfter - 1 ? `<div class="mp-allohioline">All-Ohio line &middot; top ${allOhioAfter}</div>` : "";
    return row + divider;
  }).join("");
  return `<div class="mp-rowlist">${body}</div>`;
}

function enteredNoDataHtml(schools) {
  if (!schools || !schools.length) return "";
  const items = schools.map((s) => `<li>${schoolDisplay(s)}</li>`).join("");
  return `<details class="mp-footnote"><summary>${schools.length} school${schools.length === 1 ? "" : "s"} entered, no projection data</summary><ul>${items}</ul></details>`;
}

// Reads ?tab=&g=&d=&anchor= from the URL, applies tab/filter, and if an
// `anchor` param matches a rendered data-anchor (team OR runner row),
// opens every <details> ancestor (regional card, team roster) and
// scrolls to + highlights that row for 2 seconds -- this is how a
// district/regional qualifier link lands on the next level already
// expanded at the right row. Also keeps a breadcrumb in sync with the
// current tab/filter/open-card state.
const TAB_LABEL = { districts: "Districts", regionals: "Regionals", state: "State" };
const HUB_SCRIPT = `<script>
(function(){
  var params = new URLSearchParams(location.search);
  var tab = params.get('tab') || 'districts';
  var g = params.get('g') || 'boys';
  var d = params.get('d') || '1';
  var anchor = params.get('anchor');
  var tabLabels = ${JSON.stringify(TAB_LABEL)};

  function renderBreadcrumb(){
    var bc = document.getElementById('mp-breadcrumb');
    if (!bc) return;
    var parts = [tabLabels[tab] || tab];
    if (tab === 'regionals') {
      var openCard = document.querySelector('.mp-tabpanel[data-tab="regionals"] .mp-regionalcard[open]:not([hidden])');
      if (openCard) {
        var h3 = openCard.querySelector('h3');
        if (h3) parts.push(h3.textContent);
      }
    }
    if (tab !== 'districts') {
      parts.push((g === 'boys' ? 'Boys' : 'Girls') + ' D' + d);
    }
    bc.textContent = parts.join(' › ');
  }

  function applyTab(t){
    document.querySelectorAll('.mp-tabpanel').forEach(function(p){ p.hidden = p.dataset.tab !== t; });
    document.querySelectorAll('.mp-tabbtn').forEach(function(b){ b.classList.toggle('active', b.dataset.tab === t); });
    renderBreadcrumb();
  }
  function applyFilter(gg,dd){
    document.querySelectorAll('[data-filter-gender][data-filter-division]').forEach(function(el){
      el.hidden = !(el.dataset.filterGender === gg && el.dataset.filterDivision === dd);
    });
    document.querySelectorAll('.mp-filterbtn[data-gender]').forEach(function(b){ b.classList.toggle('active', b.dataset.gender===gg); });
    document.querySelectorAll('.mp-filterbtn[data-division]').forEach(function(b){ b.classList.toggle('active', b.dataset.division===dd); });
    // D1 has no district stage at all -- the Districts tab shows a
    // short note + a button to D1 Regionals instead of the normal site
    // list, which is only ever true/false by division (gender doesn't
    // matter here, both genders skip districts the same way).
    var d1Note = document.querySelector('[data-districts-d1-note]');
    var districtsList = document.querySelector('[data-districts-list]');
    if (d1Note) d1Note.hidden = dd !== '1';
    if (districtsList) districtsList.hidden = dd === '1';
    renderBreadcrumb();
  }
  function updateUrl(){
    var sp = new URLSearchParams(); sp.set('tab',tab); sp.set('g',g); sp.set('d',d);
    history.replaceState(null,'','?'+sp.toString()+location.hash);
  }
  document.querySelectorAll('.mp-tabbtn').forEach(function(b){ b.addEventListener('click', function(){ tab=b.dataset.tab; applyTab(tab); updateUrl(); }); });
  document.querySelectorAll('.mp-filterbtn[data-gender]').forEach(function(b){ b.addEventListener('click', function(){ g=b.dataset.gender; applyFilter(g,d); updateUrl(); }); });
  document.querySelectorAll('.mp-filterbtn[data-division]').forEach(function(b){ b.addEventListener('click', function(){ d=b.dataset.division; applyFilter(g,d); updateUrl(); }); });
  // toggle doesn't bubble in all browsers -- listen in the capture phase
  // at the document so opening/closing ANY regional card updates the
  // breadcrumb's site-name segment.
  document.addEventListener('toggle', renderBreadcrumb, true);
  applyTab(tab); applyFilter(g,d);

  if (anchor) {
    // Scoped to the TARGET tab's panel, not a blind global match -- the
    // same team/runner can have a row (and therefore the same anchor) in
    // both the Regionals and State tabs at once, and a global
    // querySelector would silently grab whichever one comes first in the
    // DOM (always Regionals, since it's rendered before State), opening
    // the wrong panel for a regional-to-state cross-link.
    var scopeEl = document.querySelector('.mp-tabpanel[data-tab="' + tab + '"]') || document;
    var target = scopeEl.querySelector('[data-anchor="' + anchor.replace(/"/g, '\\\\"') + '"]');
    if (target) {
      var el = target;
      while (el) { if (el.tagName === 'DETAILS') el.open = true; el = el.parentElement; }
      renderBreadcrumb();
      setTimeout(function(){
        target.scrollIntoView({ block: 'center' });
        target.classList.add('mp-highlight');
        setTimeout(function(){ target.classList.remove('mp-highlight'); }, 2000);
      }, 50);
    }
  }

  var totop = document.querySelector('.mp-totop');
  if (totop) {
    window.addEventListener('scroll', function(){ totop.classList.toggle('show', window.scrollY > 600); });
    totop.addEventListener('click', function(){ window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }
})();
</script>`;

function raceSectionHtml(race, idx) {
  const accent = genderAccentVar(race.gender);
  const genderLower = race.gender.toLowerCase();
  const divNum = divisionNum(race.division);
  const title = `${GENDER_LABEL[genderLower] || race.gender} ${divisionLabel(race.division)}${race.raceLabel && race.raceLabel !== "Race assignments combined" ? ` (${race.raceLabel})` : ""}`;

  let body;
  if (race.status === "race_assignments_pending") {
    body = `<div class="mp-banner">Race assignments pending -- Hilliard Darby splits this division/gender into two races and we can't yet tell which race each school is in. Shown below as one combined field with no cut line.</div>
      ${teamRowsHtml(race.scoredTeams, null, [], accent, genderLower, divNum)}
      ${enteredNoDataHtml(race.enteredNoProjectionData)}`;
  } else if (race.status === "qualifier_numbers_pending") {
    body = `<div class="mp-banner">Qualifier numbers pending -- OHSAA has not yet posted this Northeast site's team/individual advancement counts. Projected order shown, no cut line.</div>
      ${teamRowsHtml(race.scoredTeams, null, [], accent, genderLower, divNum)}
      ${enteredNoDataHtml(race.enteredNoProjectionData)}`;
  } else {
    const qualifyingTeamNames = new Set(race.qualifyingTeams.map((t) => t.name));
    const finishOrder = combinedFinishOrder(race.scoredTeams, qualifyingTeamNames, race.qualifiers);
    const regionKey = REGIONAL_SITE_TO_KEY[data.districtsBySite[race.site]?.regional];
    const regionalSiteName = data.districtsBySite[race.site]?.regional;
    const crossLinkFor = regionKey
      ? (team) => ({ url: crossLinkHref({ tab: "regionals", gender: genderLower, divNum, anchor: teamAnchorKey(genderLower, divNum, team.name), hash: `${genderLower}_D${divNum}_${regionKey}` }), label: regionalSiteName || "Regionals" })
      : null;
    const indCrossLinkFor = regionKey
      ? (r) => ({ url: crossLinkHref({ tab: "regionals", gender: genderLower, divNum, anchor: runnerAnchorKey(genderLower, divNum, r.name, r.school), hash: `${genderLower}_D${divNum}_${regionKey}` }), label: regionalSiteName || "Regionals" })
      : null;
    body = `${teamRowsHtml(race.scoredTeams, race.teamsAdvance, race.qualifiers, accent, genderLower, divNum, crossLinkFor)}
      <p class="mp-h3">Top 32 (combined, includes individual qualifiers)</p>
      ${runnerRowsHtml(finishOrder, 32, null, indCrossLinkFor, genderLower, divNum)}
      ${enteredNoDataHtml(race.enteredNoProjectionData)}`;
  }
  // In-feed unit after every 2nd race (races 2, 4, 6, 8, 10 -- idx is
  // 0-based, so odd idx). Only one race panel is ever visible at a time
  // here (chip-toggled, not a scrolling list), so the unit lives inside
  // that race's own panel -- it shows up "between races" exactly when the
  // reader is on an even-numbered one. Always after the full results
  // (Top 32 / enteredNoData), never between a team list and its cut line.
  const infeed = idx % 2 === 1 ? bicarbInfeedHtml(`district-race-${idx + 1}`) : "";
  return `<div class="mp-section mp-racepanel" data-race-idx="${idx}" style="--row-accent:${accent}" ${idx > 0 ? "hidden" : ""}>
    <h2 style="color:${accent}">${title}</h2>
    <p class="mp-meta">${escapeHtml((race.startTime || "").replace(/\s*(AM|PM)$/i, ""))}${race.teamsAdvance != null ? ` &middot; top ${race.teamsAdvance} teams + ${race.individualsAdvance} individuals advance` : ""}</p>
    ${body}
    ${infeed}
  </div>`;
}

export function mockPostseasonDistrictSitePage(site, siteKey) {
  const siteData = data.districtsBySite[siteKey];
  if (!siteData) return null;
  // Rectangle alternates light/dark by this site's position in the
  // district list (section 2 of the Bicarb ads brief).
  const siteIndex = Object.keys(data.districtsBySite).indexOf(siteKey);
  const rectangleVariant = siteIndex % 2 === 0 ? "light" : "dark";
  const pathname = `/mock-postseason/districts/${siteKey.toLowerCase()}/`;
  const title = `${siteData.name} (review build)`;
  const chips = siteData.races.map((r, i) => {
    const chipLabel = `${(r.startTime || "").replace(/\s*(AM|PM)$/i, "")} &middot; ${GENDER_LABEL[r.gender.toLowerCase()]} ${divisionLabel(r.division).replace("Division ", "D")}`;
    return `<button type="button" class="mp-racechip${i === 0 ? " active" : ""}" data-chip-idx="${i}" data-chip-gender="${r.gender.toLowerCase()}" data-chip-division="${divisionNum(r.division)}">${chipLabel}</button>`;
  }).join("");
  const firstRace = siteData.races[0];
  const initialBreadcrumb = firstRace ? `Districts &rsaquo; ${escapeHtml(siteData.name)} &rsaquo; ${GENDER_LABEL[firstRace.gender.toLowerCase()]} D${divisionNum(firstRace.division)}` : `Districts &rsaquo; ${escapeHtml(siteData.name)}`;
  const content = `${compactHero({ eyebrow: "Local review build -- not live", title: siteData.name, description: `Feeds the ${siteData.regional} regional.` })}
  ${SHARED_STYLE}
  <div class="mp-stickyblock">
    <div class="mp-tabbar">
      <button type="button" class="mp-tabbtn active" data-nav-tab="districts">Districts</button>
      <button type="button" class="mp-tabbtn" data-nav-tab="regionals">Regionals</button>
      <button type="button" class="mp-tabbtn" data-nav-tab="state">State</button>
    </div>
    <div class="mp-filterrow">${chips}</div>
  </div>
  <nav class="mp-breadcrumb" id="mp-breadcrumb" aria-label="Breadcrumb">${initialBreadcrumb}</nav>
  <section class="section section-paper mp-pagesection"><div class="container">
    ${bicarbLeaderboardHtml("district-top")}
    ${siteData.races.map(raceSectionHtml).join("")}
    ${bicarbRectangleHtml("district-bottom", rectangleVariant)}
  </div></section>
  ${bicarbMobileStickyHtml()}
  ${BICARB_SCRIPT}
  <script>
  var siteName = ${JSON.stringify(siteData.name)};
  document.querySelectorAll('.mp-racechip').forEach(function(chip){
    chip.addEventListener('click', function(){
      var idx = chip.dataset.chipIdx;
      document.querySelectorAll('.mp-racechip').forEach(function(c){ c.classList.toggle('active', c===chip); });
      document.querySelectorAll('.mp-racepanel').forEach(function(p){ p.hidden = p.dataset.raceIdx !== idx; });
      var bc = document.getElementById('mp-breadcrumb');
      if (bc) {
        var genderLabel = chip.dataset.chipGender === 'boys' ? 'Boys' : 'Girls';
        bc.textContent = 'Districts › ' + siteName + ' › ' + genderLabel + ' D' + chip.dataset.chipDivision;
      }
    });
  });
  // "Same sticky Districts | Regionals | State control at the top of
  // every page" -- clicking Regionals/State here navigates back to the
  // hub with that tab active and this district's currently-shown race's
  // gender/division carried over, matching the uniform cross-level
  // navigation pattern every other page uses.
  document.querySelectorAll('[data-nav-tab]').forEach(function(b){
    b.addEventListener('click', function(){
      var tab = b.dataset.navTab;
      if (tab === 'districts') { location.href = '/mock-postseason/?tab=districts'; return; }
      var active = document.querySelector('.mp-racechip.active');
      var g = active ? active.dataset.chipGender : 'boys';
      var d = active ? active.dataset.chipDivision : '1';
      location.href = '/mock-postseason/?tab=' + tab + '&g=' + g + '&d=' + d;
    });
  });
  </script>`;
  return layout({ site, title, description: `Projected district results for ${siteData.name}.`, pathname, content });
}

function districtsHubTabHtml() {
  const sites = Object.values(data.districtsBySite);
  const byRegion = new Map();
  for (const s of sites) { if (!byRegion.has(s.region)) byRegion.set(s.region, []); byRegion.get(s.region).push(s); }
  return [...byRegion.entries()].map(([region, siteList]) => {
    const rows = siteList.map((s) => `<a class="mp-row" href="/mock-postseason/districts/${s.key.toLowerCase()}/">
      <div class="mp-rowmain"><div class="mp-rowname">${escapeHtml(s.name)}</div><div class="mp-rowsub">${s.races.length} races &middot; feeds ${escapeHtml(s.regional)}</div></div>
    </a>`).join("");
    return `<div class="mp-section"><h2>${escapeHtml(region)}</h2><div class="mp-rowlist">${rows}</div></div>`;
  }).join("");
}

// Collapsed regional summary: just the site name as the title (gender +
// division already narrowed by the filter, shown as a small label
// instead of being baked into the heading text), winner+score, last
// team in, first team out with the point gap, and the real
// teams+individuals-to-state count. A region still missing data (HD or
// Northeast pending) shows the incomplete banner ABOVE this same
// projected summary, not instead of it -- Pickerington and Boardman
// still have a real, if partial, field worth seeing.
function regionalSummaryCard(key, r) {
  const accent = genderAccentVar(r.gender);
  const genderLower = r.gender.toLowerCase();
  const divNum = divisionNum(r.division);
  const siteTitle = r.siteName ? r.siteName.replace(/\s*\([^)]*\)\s*$/, "").trim() || r.siteName : (r.regionKey.charAt(0).toUpperCase() + r.regionKey.slice(1));
  const smallLabel = `${GENDER_LABEL[genderLower]} ${divisionLabel(r.division)}`;
  const complete = r.teams.filter((t) => t.complete);
  const qualifyingNames = new Set(complete.slice(0, r.stateQualifiers || 0).map((t) => t.name));
  const realAdvancingKeys = new Set(r.stateQualifyingIndividualKeys || []);
  const finishOrder = combinedFinishOrder(r.teams, qualifyingNames, r.individuals, realAdvancingKeys);

  const incompleteBanner = r.incomplete
    ? `<div class="mp-banner">Incomplete: ${escapeHtml(r.incompleteReason)}</div>`
    : (r.pendingSites && r.pendingSites.length
      ? `<div class="mp-banner">Waiting on qualifier numbers: ${r.pendingSites.map((p) => escapeHtml(data.districtsBySite[p.site]?.name || p.site)).join(", ")}.</div>`
      : "");

  const winner = complete[0];
  const lastIn = r.stateQualifiers ? complete[r.stateQualifiers - 1] : null;
  const firstOut = r.stateQualifiers ? complete[r.stateQualifiers] : null;
  const gap = lastIn && firstOut ? formatPoints(firstOut.score - lastIn.score) : null;
  // Every pooled district individual qualifier already carries a real
  // "Advances to [Regional]" link from its district page (section 2's
  // uniform cross-level nav) -- that link must always land on a rendered
  // data-anchor here, even when the individual's real overall finish
  // place falls outside a plain top-32 cutoff (found in QA: a district
  // qualifier placing 102nd combined had no anchor to land on). Extend
  // the limit just enough to cover the lowest-placed IND row, never
  // shrinking the normal top-32 view.
  const lastIndPosition = finishOrder.reduce((max, row, i) => (row.tag === "IND" ? i : max), -1);
  const showAllLimit = Math.max(32, lastIndPosition + 1);

  return `<details class="mp-regionalcard" id="${key}" data-filter-gender="${genderLower}" data-filter-division="${divNum}" style="--row-accent:${accent}">
    <summary>
      <span class="mp-rc-label">${smallLabel} <span class="mp-chevron">&#9660;</span></span>
      <h3 style="color:${accent}">${escapeHtml(siteTitle)}</h3>
      ${incompleteBanner}
      ${winner ? `<p class="mp-rc-line"><strong>${schoolDisplay(winner.name)}</strong> wins, ${formatPoints(winner.score)} pts</p>` : "<p class=\"mp-rc-line\">No field data yet.</p>"}
      ${lastIn ? `<p class="mp-rc-line">Last in: <strong>${schoolDisplay(lastIn.name)}</strong> (${formatPoints(lastIn.score)} pts)${firstOut ? ` &middot; First out: <strong>${schoolDisplay(firstOut.name)}</strong> (+${gap} pt${gap === "1" ? "" : "s"})` : ""}</p>` : ""}
      ${r.stateQualifiers != null ? `<p class="mp-rc-line">${r.stateQualifiers} teams + ${r.individualQualifiers} individuals to State</p>` : ""}
    </summary>
    <div class="mp-regionalcard-body">
      <p class="mp-h3">State qualifiers</p>
      ${teamRowsHtml(r.teams, r.stateQualifiers, r.individuals, accent, genderLower, divNum, (team) => ({ url: crossLinkHref({ tab: "state", gender: genderLower, divNum, anchor: teamAnchorKey(genderLower, divNum, team.name), hash: `state-${genderLower}_D${divNum}` }), label: "State" }))}
      ${bicarbInfeedHtml(`regional-${key}`)}
      <details class="mp-showall"><summary>Top 32 (combined, includes pooled district individuals)</summary>${runnerRowsHtml(finishOrder, showAllLimit, null, (rr) => ({ url: crossLinkHref({ tab: "state", gender: genderLower, divNum, anchor: runnerAnchorKey(genderLower, divNum, rr.name, rr.school), hash: `state-${genderLower}_D${divNum}` }), label: "State" }), genderLower, divNum)}</details>
      ${enteredNoDataHtml(r.enteredNoProjectionData)}
    </div>
  </details>`;
}

function regionalsTabHtml() {
  const sections = Object.entries(data.regionalResults).map(([key, r]) => regionalSummaryCard(key, r)).join("");
  const underReviewHtml = Object.entries(data.underReviewByCategory || {}).map(([cat, schools]) => {
    const [genderLower, div] = cat.split("_");
    return `<p><strong>${GENDER_LABEL[genderLower]} ${div}:</strong> ${schools.map((s) => schoolDisplay(s)).join(", ")}</p>`;
  }).join("");
  const underReview = Object.keys(data.underReviewByCategory || {}).length
    ? `<div class="mp-under-review"><h2>Under review: region not confirmed</h2><p class="mp-meta">These schools have no confirmed regional assignment and are not scored or counted against any cut line.</p>${underReviewHtml}</div>`
    : "";
  return `${bicarbLeaderboardHtml("regionals-top")}${sections}${underReview}${bicarbRectangleHtml("regionals-bottom", "light")}`;
}

function stateSectionHtml(key, s) {
  const [genderLower, div] = key.split("_");
  const accent = genderAccentVar(genderLower);
  const divNum = divisionNum(div);
  if (s.incomplete || (s.missing && s.missing.length)) {
    const reason = s.incomplete ? s.incompleteReason : `Waiting on region(s): ${s.missing.join(", ")}`;
    return `<div class="mp-section" id="state-${key}" data-filter-gender="${genderLower}" data-filter-division="${divNum}" style="--row-accent:${accent}"><h2 style="color:${accent}">${GENDER_LABEL[genderLower]} ${divisionLabel(divNum)}</h2><div class="mp-banner">Incomplete: ${escapeHtml(reason)}</div></div>`;
  }
  const complete = s.teams.filter((t) => t.complete);
  // Every entry in s.individuals is a real state qualifier that an
  // incoming "Advances to State" link from some regional can point at --
  // found 2026-10-22 (same class of bug as the regional Top-32 cutoff
  // fixed earlier): slicing this list to the top 40 for display dropped
  // the data-anchor for anyone ranked 41+ statewide, so that link landed
  // with nothing to highlight. Keep the visible "top 40" summary, but
  // render everyone past it too (collapsed, same mp-showall pattern used
  // at the regional level) so every real qualifier always has an anchor.
  const individualAll = (s.individuals || []).map((q) => ({
    name: q.name, grade: q.grade, school: q.originalTeam, seasonBest: q.seasonBest, placePoints: q.placePoints, tag: "IND",
    qualifiedFrom: q.qualifiedFromRegional ? `${q.qualifiedFromRegional} regional, ${q.qualifiedFromRegionalOrdinal}` : null
  }));
  const visibleCount = Math.min(40, individualAll.length);
  const overflowCount = individualAll.length - visibleCount;
  return `<div class="mp-section" id="state-${key}" data-filter-gender="${genderLower}" data-filter-division="${divNum}" style="--row-accent:${accent}">
    <h2 style="color:${accent}">${GENDER_LABEL[genderLower]} ${divisionLabel(divNum)}</h2>
    <p class="mp-meta">Pooled from: ${(s.poolLog || []).map((p) => `${p.region} (${p.teamCount}/${p.teamQualifiers} teams, ${p.individualCount}/${p.individualQualifiers} individuals)`).join(" &middot; ")}</p>
    ${teamRowsHtml(complete, null, s.individuals, accent, genderLower, divNum)}
    ${bicarbInfeedHtml(`state-${key}`)}
    ${individualAll.length ? `<p class="mp-h3">Projected individual top ${visibleCount}</p>${runnerRowsHtml(individualAll.slice(0, visibleCount), null, Math.min(25, visibleCount), null, genderLower, divNum)}${overflowCount ? `<details class="mp-showall"><summary>Show all ${individualAll.length} individuals</summary>${runnerRowsHtml(individualAll.slice(visibleCount), null, null, null, genderLower, divNum)}</details>` : ""}` : ""}
  </div>`;
}

function stateTabHtml() {
  const sections = Object.entries(data.stateResults).map(([key, s]) => stateSectionHtml(key, s)).join("");
  return `${bicarbLeaderboardHtml("state-top")}${sections}${bicarbRectangleHtml("state-bottom", "dark")}`;
}

export function mockPostseasonHubPage(site) {
  const pathname = "/mock-postseason/";
  const filterChips = [
    ...GENDERS.map((g) => `<button type="button" class="mp-filterbtn${g === "boys" ? " active" : ""}" data-gender="${g}">${GENDER_LABEL[g]}</button>`),
    `<span class="mp-filterdivider"></span>`,
    ...DIVISIONS.map((d) => `<button type="button" class="mp-filterbtn${d === 1 ? " active" : ""}" data-division="${d}">D${d}</button>`)
  ].join("");

  const content = `${compactHero({ eyebrow: "Local review build -- not live", title: "Mock Postseason", description: "Districts, Regionals, and State in one place." })}
  ${SHARED_STYLE}
  <div class="mp-stickyblock">
    <div class="mp-tabbar">
      <button type="button" class="mp-tabbtn active" data-tab="districts">Districts</button>
      <button type="button" class="mp-tabbtn" data-tab="regionals">Regionals</button>
      <button type="button" class="mp-tabbtn" data-tab="state">State</button>
    </div>
    <div class="mp-filterrow">${filterChips}</div>
  </div>
  ${bicarbBillboardHtml()}
  <nav class="mp-breadcrumb" id="mp-breadcrumb" aria-label="Breadcrumb">Districts</nav>
  <section class="section section-paper mp-pagesection"><div class="container">
    <div class="mp-tabpanel" id="districts-panel" data-tab="districts">
      <div data-districts-d1-note hidden>
        <p class="mp-meta">D1 teams enter at regionals.</p>
        <button type="button" class="mp-d1-regionals-btn">Go to D1 Regionals &rarr;</button>
      </div>
      <div data-districts-list>${districtsHubTabHtml()}</div>
    </div>
    <div class="mp-tabpanel" id="regionals-panel" data-tab="regionals" hidden>${regionalsTabHtml()}</div>
    <div class="mp-tabpanel" id="state-panel" data-tab="state" hidden>${stateTabHtml()}</div>
  </div></section>
  ${bicarbMobileStickyHtml()}
  <button type="button" class="mp-totop" aria-label="Back to top">&uarr;</button>
  ${HUB_SCRIPT}
  ${BICARB_SCRIPT}
  <script>
  (function(){
    var btn = document.querySelector('.mp-d1-regionals-btn');
    if (btn) btn.addEventListener('click', function(){
      var params = new URLSearchParams(location.search);
      var g = params.get('g') || 'boys';
      location.href = '/mock-postseason/?tab=regionals&g=' + g + '&d=1';
    });
  })();
  </script>`;
  return layout({ site, title: "2026 Mock Postseason (review build)", description: "Local review build of the 2026 Mock Postseason (Districts, Regionals, State).", pathname, content });
}

export function mockPostseasonAllPages(site) {
  const pages = [
    { pathname: "/mock-postseason/", html: mockPostseasonHubPage(site) }
  ];
  for (const key of Object.keys(data.districtsBySite)) {
    const html = mockPostseasonDistrictSitePage(site, key);
    if (html) pages.push({ pathname: `/mock-postseason/districts/${key.toLowerCase()}/`, html });
  }
  return pages;
}
