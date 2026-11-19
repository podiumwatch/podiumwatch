import { layout } from "../lib/html.mjs";
import { escapeHtml } from "../lib/content.mjs";
import { OATCCC_BASE, SPONSORS, oatcccTabs } from "./config.mjs";

// Shared chrome for every /oatccc/ page: the site's own header, then the
// "Podium Watch, powered by the OATCCC" lockup, the OATCCC tab bar, the
// page, the sponsor footer, then the site's own footer.

export const LOGO = {
  small: "/images/oatccc/oatccc-logo-96.png",
  medium: "/images/oatccc/oatccc-logo-192.png",
  large: "/images/oatccc/oatccc-logo-384.png"
};

const external = (href) => /^https?:\/\//.test(href);
export function linkAttrs(href) {
  return external(href) ? ` href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"` : ` href="${escapeHtml(href)}"`;
}

function lockup(site) {
  return `<div class="ox-lockup"><div class="ox-wrap">
  <a href="${OATCCC_BASE}" aria-label="Podium Watch, powered by the OATCCC">
    <img class="pw" src="${escapeHtml(site.logoMark)}" width="30" height="30" alt="">
    <span class="t"><b>Podium</b> <b class="g">Watch</b>, powered by the</span>
    <img class="oat" src="${LOGO.small}" width="38" height="38" alt="">
    <span class="t"><b>OATCCC</b></span>
  </a>
</div></div>`;
}

function tabBar(current, flags) {
  const tabs = oatcccTabs(flags).map((tab) => {
    const isCurrent = tab.key === current ? ' aria-current="page"' : "";
    return `<a${linkAttrs(tab.href)}${isCurrent}>${escapeHtml(tab.label)}</a>`;
  }).join("");
  // On phones the tab bar scrolls sideways; bring the current page's tab
  // into view (Zachary, 2026-11-19: "District Representatives" sat
  // off-screen to the right on its own page).
  const reveal = `<script>(()=>{const b=document.currentScript.previousElementSibling.firstElementChild,c=b&&b.querySelector("[aria-current]");if(c&&b.scrollWidth>b.clientWidth){const r=c.getBoundingClientRect(),q=b.getBoundingClientRect();b.scrollLeft+=r.left-q.left-(q.width-r.width)/2;}})();</script>`;
  return `<nav class="ox-tabs" aria-label="OATCCC"><div class="ox-wrap">${tabs}</div></nav>${reveal}`;
}

function sectionFooter() {
  const sponsors = SPONSORS.map((sponsor) => `<li><a${linkAttrs(sponsor.href)}>${escapeHtml(sponsor.name)}</a></li>`).join("");
  return `<footer class="ox-foot" aria-label="OATCCC sponsors">
  <section class="ox-spons ox-wrap" aria-labelledby="ox-sp-h">
    <h2 id="ox-sp-h">Thank you to the OATCCC&rsquo;s corporate sponsors</h2>
    <ul>${sponsors}</ul>
  </section>
  <div class="ox-footline ox-wrap">
    <span>Ohio Association of Track &amp; Cross Country Coaches. <a href="https://www.oatccc.com" target="_blank" rel="noopener noreferrer">oatccc.com</a></span>
    <span>Podium Watch, powered by the OATCCC</span>
  </div>
</footer>`;
}

export function oatcccLayout({ site, flags, pathname, title, description, tab, mast = "", content, scripts = [], headScripts = [], robots }) {
  // Deferred scripts run in order: libraries (headScripts) first.
  const scriptTags = [...headScripts, ...scripts].map((src) => `\n<script src="${escapeHtml(src)}" defer></script>`).join("");
  return layout({
    site,
    title,
    description,
    pathname,
    // noindex everywhere except the real production launch (config.mjs);
    // private pages pass their own "noindex, nofollow".
    robots: robots || (flags.indexable ? undefined : "noindex, nofollow"),
    extraHead: `\n<link rel="stylesheet" href="/styles/oatccc.css">${scriptTags}`,
    content: `<div class="ox">${lockup(site)}${tabBar(tab, flags)}${mast}${content}${sectionFooter()}</div>`
  });
}
