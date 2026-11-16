import { oatcccHubPage } from "./hub.mjs";
import { oatcccIndoorPages } from "./indoor.mjs";
import { oatcccVerificationPages } from "./verification_pages.mjs";
import { OATCCC_BASE } from "./config.mjs";

// What scripts/build.mjs writes for the OATCCC section. With OATCCC_LIVE
// off this returns nothing at all: no pages, no stylesheet, no logos, so
// every /oatccc/ address is the site's real 404.
export function oatcccOutputs(site, flags) {
  if (!flags.live) return { pages: [], assets: [] };
  const pages = [
    { pathname: OATCCC_BASE, html: oatcccHubPage(site, flags) },
    ...oatcccIndoorPages(site, flags),
    ...(flags.verification ? oatcccVerificationPages(site, flags) : [])
  ];
  // [source under src/oatccc/, destination under dist/]
  const assets = [
    ["oatccc.css", "styles/oatccc.css"],
    ["oatccc.js", "scripts/oatccc.js"],
    ["images/oatccc-logo-96.png", "images/oatccc/oatccc-logo-96.png"],
    ["images/oatccc-logo-192.png", "images/oatccc/oatccc-logo-192.png"],
    ["images/oatccc-logo-384.png", "images/oatccc/oatccc-logo-384.png"],
    ...(flags.verification ? [["oatccc-verification.js", "scripts/oatccc-verification.js"]] : [])
  ];
  return { pages, assets };
}
