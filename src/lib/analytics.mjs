// Google Analytics (GA4) config -- one place to hold the real Measurement
// ID, matching src/lib/ads.mjs's own "one place to hold the real ID"
// pattern, so changing or rotating it later is a one-line change here
// rather than a hunt through every page file.
//
// Real GA4 property, created 2026-09-01 specifically to satisfy Mediavine
// Journey's application requirement (GA4 must be running on the site
// before an application can be processed).
export const GA_MEASUREMENT_ID = "G-V1GHJ96BSP";

// Unlike AdSense's ad units (opt-in per page, see ads.mjs), GA4 needs to
// run on every page to measure real, sitewide traffic -- so this is
// wired directly into layout()'s always-rendered <head> (src/lib/html.mjs)
// rather than requiring each page to include it itself.
export function gtagScript() {
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA_MEASUREMENT_ID}');
</script>`;
}
