// Keeps personal email addresses out of the OATCCC page HTML (Zachary,
// 2026-11-18). Addresses are stored reversed, then base64 encoded, in a
// data-ox-e attribute; scripts/oatccc-email.js (src/oatccc/oatccc-email.js)
// decodes them and opens one email when the reader taps. Without JavaScript
// the link jumps to the Indoor State Meet Chair line in <noscript>.
import { LINKS } from "./config.mjs";

export const EMAIL_SCRIPT = "/scripts/oatccc-email.js";

export const EMAIL_FALLBACK = `<noscript><p class="ox-lead-contact" id="ox-lead-fallback">To reach a district rep or officer, email the Indoor State Meet Chair at <a href="mailto:${LINKS.chairEmail}">${LINKS.chairEmail}</a>.</p></noscript>`;

export const encodeEmail = (address) => Buffer.from([...address].reverse().join(""), "utf8").toString("base64");

const ADDRESS = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;
const link = (address, label) => `<a class="ox-email-link" href="#ox-lead-fallback" data-ox-e="${encodeEmail(address)}">${label}</a>`;

// Replaces every email address in a piece of page HTML (mailto links and
// addresses written out in text) with an encoded Email link. The Chair's
// address is left as is: it is the public contact and the fallback.
export function protectEmails(html, keep = [LINKS.chairEmail]) {
  const kept = new Set(keep.map((a) => a.toLowerCase()));
  let count = 0;
  let out = String(html).replace(new RegExp(`<a\\s+href="mailto:(${ADDRESS.source})"[^>]*>([\\s\\S]*?)<\\/a>`, "g"), (all, address, text) => {
    if (kept.has(address.toLowerCase())) return all;
    count++;
    return link(address, text.trim().toLowerCase() === address.toLowerCase() ? "Email" : text);
  });
  // Addresses in text, outside tags.
  out = out.replace(/(<[^>]*>)|([^<]+)/g, (all, tag, text) => tag ? tag : text.replace(new RegExp(ADDRESS.source, "g"), (address) => {
    if (kept.has(address.toLowerCase())) return address;
    count++;
    return link(address, "Email");
  }));
  return { html: out, count };
}
