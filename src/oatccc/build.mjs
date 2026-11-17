import { oatcccHubPage } from "./hub.mjs";
import { oatcccIndoorPages } from "./indoor.mjs";
import { oatcccVerificationPages } from "./verification_pages.mjs";
import { OATCCC_BASE } from "./config.mjs";
import { oatcccMorePages } from "./more/pages.mjs";
import { loadHofData, oatcccHofPages } from "./more/hof.mjs";

// What scripts/build.mjs writes for the OATCCC section. With OATCCC_LIVE
// off this returns nothing at all: no pages, no stylesheet, no logos, so
// every /oatccc/ address is the site's real 404.
export function oatcccOutputs(site, flags) {
  if (!flags.live) return { pages: [], assets: [] };
  const pages = [
    { pathname: OATCCC_BASE, html: oatcccHubPage(site, flags) },
    ...oatcccIndoorPages(site, flags),
    ...(flags.verification ? oatcccVerificationPages(site, flags) : []),
    // Full site move: each section only with OATCCC_MORE_LIVE and its switch.
    ...oatcccMorePages(site, flags)
  ];
  // [source under src/oatccc/, destination under dist/]
  const assets = [
    ["oatccc.css", "styles/oatccc.css"],
    ["oatccc.js", "scripts/oatccc.js"],
    ["images/oatccc-logo-96.png", "images/oatccc/oatccc-logo-96.png"],
    ["images/oatccc-logo-192.png", "images/oatccc/oatccc-logo-192.png"],
    ["images/oatccc-logo-384.png", "images/oatccc/oatccc-logo-384.png"],
    ...(flags.verification ? [["oatccc-verification.js", "scripts/oatccc-verification.js"]] : []),
    ...(flags.divisionList ? [["oatccc-divisions.js", "scripts/oatccc-divisions.js"]] : [])
  ];
  return { pages, assets };
}

// The full build, with the Hall of Fame (read from the database at build
// time, src/oatccc/more/hof.mjs). If the Hall of Fame switch is on but
// there is no data yet, the section is treated as off for this build, so
// no link points to a page that was not built.
export async function oatcccBuild(site, flags, env = process.env) {
  const hofData = await loadHofData(flags, env);
  const effective = flags.sections?.hof && !hofData ? { ...flags, sections: { ...flags.sections, hof: false } } : flags;
  const out = oatcccOutputs(site, effective);
  if (hofData) {
    out.pages.push(...oatcccHofPages(site, effective, hofData));
    out.assets.push(["oatccc-hof.js", "scripts/oatccc-hof.js"]);
  }
  return { ...out, flags: effective, hofCount: hofData ? hofData.inductees.length : 0 };
}
