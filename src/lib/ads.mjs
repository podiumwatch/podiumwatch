// Google AdSense config -- one place to hold the real publisher ID and any
// ad unit slot IDs once a real, approved AdSense account exists for this
// site, so turning ads on, changing a slot, or adding them to another page
// later is a one-line change here, not a hunt through every page file.
//
// Real AdSense account, created 2026-09-01 -- still pending Google's site
// review/approval as of the commit that set these. Real values render
// nothing (an empty ad slot, no error) until Google actually approves the
// site; nothing further needs to change here once that happens.
export const ADSENSE_CLIENT_ID = "ca-pub-2445887251976367";

// One ad unit ID per real placement. Keyed by a short, page-scoped name
// rather than the page's own slug, since the same physical ad unit (from
// the AdSense dashboard) can be reused across more than one page. This one
// ("Podium Watch Awards", responsive) is reused on both the Athlete of the
// Week and Team of the Week pages.
export const AD_SLOTS = {
  weeklyAwards: "8781648734"
};

// The one loader script AdSense requires in <head>. Wired sitewide into
// layout() (src/lib/html.mjs) for every real public content page
// (2026-09-01) -- Google's AdSense review expects the code present
// broadly, not just the 2 pages that show an ad slot, and Auto ads (if
// turned on later) need it sitewide to work at all. This alone does not
// put a visible ad anywhere -- an actual ad box only ever appears where
// a page explicitly calls adSlot() below (currently just
// weeklyawards.mjs).
//
// layout()'s own isPrivatePage check (its existing noindex/nofollow
// list -- admin, every login/dashboard page, /follow/) is reused to skip
// this on those pages, not just search engines. Real rejection received
// same day: Google flagged "Google-served ads on screens without
// publisher-content... used for alerts, navigation or other behavioral
// purposes" -- login screens and account dashboards are exactly that,
// and were getting this script (though never a rendered ad, since no
// adSlot() lives there) when this was first made sitewide with no
// exclusion. Auto ads (if ever enabled on the AdSense account) would
// have been free to actually place a real ad on those pages purely
// because the loader was present -- this exclusion closes that off at
// the source rather than relying on Auto ads placement settings alone.
export function adSenseLoaderScript() {
  return `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}" crossorigin="anonymous"></script>`;
}

// A single responsive display ad, wrapped in a small labeled container
// styled to match the site's existing .info-card/.eyebrow look rather than
// reading as a bolted-on foreign block. The "Advertisement" label is not
// just cosmetic -- clearly distinguishing ads from real content is an
// actual AdSense policy requirement, not only good practice.
export function adSlot(slot, { label = "Advertisement" } = {}) {
  return `<div class="ad-slot">
    <p class="ad-slot-label">${label}</p>
    <ins class="adsbygoogle" style="display:block" data-ad-client="${ADSENSE_CLIENT_ID}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
  </div>`;
}

// Infolinks (2026-09-29) -- an in-text contextual ad network: unlike
// AdSense's adSlot() above, there is no per-page placement to call --
// once this loader is present, Infolinks scans the page's own text and
// turns some existing words into ad links automatically. That makes
// where this script is allowed to load MORE important than AdSense's
// loader, not less: the exact "ads on screens without real
// publisher-content" problem that got the AdSense loader rejected from
// login/dashboard pages (see adSenseLoaderScript() above) would be
// worse here, since Infolinks would auto-insert ad links into dashboard
// labels/button text rather than just sitting present-but-inert. Gated
// through the same showAds check in layout() as AdSense, for that
// reason -- never added to a page on its own.
export const INFOLINKS_PID = 3448221;
export const INFOLINKS_WSID = 0;

export function infolinksLoaderScript() {
  return `<script>var infolinks_pid = ${INFOLINKS_PID}; var infolinks_wsid = ${INFOLINKS_WSID};</script>
<script src="https://resources.infolinks.com/js/infolinks_main.js"></script>`;
}
