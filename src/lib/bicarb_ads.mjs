// Bicarb affiliate unit for the 2026 Year awards voting pages (Zachary,
// 2026-11-10). Same affiliate link, code, images and "Affiliate · Ad"
// label as the mock postseason units (src/pages/mockpostseason.mjs,
// BICARB_ADS_BRIEF.md): the 640x200 in-feed image on wide screens (the 728x90 leaderboard says "district week") and the
// 320x100 mobile banner on phones, with the code also written out as text.
// Clicks are reported to analytics as "bicarb_click".

export const BICARB_URL = "https://bicarb.shop/?ref=podiumwatch";
export const BICARB_CODE = "PODIUMWATCH";
const ALT = `Bicarb race-day fuel. Use code ${BICARB_CODE}. Affiliate ad.`;
const IMG = "/images/sponsors/bicarb";

export const bicarbStyles = `
  .pw-bicarb { display:grid; justify-items:center; gap:4px; margin:4px 0; text-align:center; }
  .pw-bicarb img { display:block; width:100%; max-width:480px; height:auto; }
  @media (min-width:760px) { .pw-bicarb img { max-width:640px; } }
  .pw-bicarb-code { margin:0; font-weight:850; font-size:.88rem; }
  .pw-bicarb-code a { color:inherit; }
  .pw-bicarb-disclosure { font-size:.62rem; letter-spacing:.04em; color:var(--muted); font-weight:700; text-transform:uppercase; }
`;

export function bicarbVotingAdHtml(position) {
  return `<aside class="pw-bicarb" aria-label="Affiliate ad">
    <a href="${BICARB_URL}" target="_blank" rel="sponsored noopener" data-bicarb-unit="leaderboard_or_mobile-banner" data-bicarb-position="${position}"><picture>
      <source media="(min-width: 760px)" srcset="${IMG}/bicarb-infeed-640x200.png">
      <img src="${IMG}/bicarb-mobile-banner-320x100.png" alt="${ALT}" width="320" height="100" loading="lazy">
    </picture></a>
    <p class="pw-bicarb-code"><a href="${BICARB_URL}" target="_blank" rel="sponsored noopener" data-bicarb-unit="code-text" data-bicarb-position="${position}">Bicarb race-day fuel: use code ${BICARB_CODE}</a></p>
    <span class="pw-bicarb-disclosure">Affiliate &middot; Ad</span>
  </aside>
  <script>(function(){document.querySelectorAll('[data-bicarb-unit]').forEach(function(a){if(a.dataset.bicarbBound)return;a.dataset.bicarbBound='1';a.addEventListener('click',function(){if(window.gtag)gtag('event','bicarb_click',{page:location.pathname,unit:a.dataset.bicarbUnit,position:a.dataset.bicarbPosition});});});})();</script>`;
}
