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

// The one loader script AdSense requires on any page that will show an ad
// -- goes in <head>, once per page, even if that page has multiple ad
// slots. Deliberately NOT added to the site's shared layout() by default,
// so ads only ever appear on pages that explicitly opt in (see
// weeklyawards.mjs) rather than silently spreading anywhere new.
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
