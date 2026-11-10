// Small school logo <img> (the processed 96 px file) for lists and tables
// (WO-11). base is a logo path without size/extension, e.g.
// "/images/teams/russia-russia"; returns "" when there is no logo.
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export function smallLogoHtml(base, size = 20) {
  if (!base || !/^\/images\/teams\/(pool\/)?[a-z0-9-]+$/.test(base)) return "";
  return `<img class="pw-team-logo" src="${esc(base)}-96.webp" alt="" aria-hidden="true" width="${size}" height="${size}" loading="lazy" decoding="async">`;
}

import manifest from "../data/team-logos.json" with { type: "json" };
// "/images/teams/russia-russia-256.png" -> "/images/teams/russia-russia"
export function logoBaseFromUrl(url) {
  const m = String(url || "").match(/^(\/images\/teams\/(?:pool\/)?[a-z0-9-]+?)-(?:512|256|96)\.(?:png|webp)$/);
  return m ? m[1] : null;
}
export function schoolLogoBaseFor(schoolId) {
  return manifest.schools?.[schoolId]?.base || null;
}
