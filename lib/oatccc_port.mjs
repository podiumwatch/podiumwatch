// Shared by scripts/oatccc-port-pages.mjs and scripts/import-oatccc-hall-of-fame.mjs:
// turns a crawled oatccc.com page (scripts/oatccc-crawl.mjs) into clean
// HTML with the OATCCC words unchanged. See the port script for the rules.
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const KEEP = new Set(["h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "li", "a", "strong", "em", "b", "i", "u", "br", "hr", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "img", "blockquote", "sup", "sub", "dl", "dt", "dd", "caption", "figure", "figcaption", "iframe"]);
const DROP = ["script", "style", "noscript", "form", "input", "button", "select", "textarea", "svg", "nav"];
const BLOCK = /\s*(<\/?(?:h[2-6]|p|ul|ol|li|table|thead|tbody|tfoot|tr|hr|blockquote|dl|dt|dd|figure|iframe)\b[^>]*>)\s*/g;
const PHONE = /(?:\+?1[\s.-]?)?\(?\b[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]\d{4}\b(?:\s*(?:x|ext\.?)\s*\d+)?/g;
const PHONE_LABEL = /\s*\b(?:Phone|Cell|Ph\.?|Tel\.?|Fax|Office|Home|Mobile|Work)\s*:?\s*$/i;

export const slugFor = (p) => p.replace(/^\/+|\/+$/g, "").replace(/[^A-Za-z0-9._-]+/g, "__") || "_home";

export function loadPage(oldPath, crawlDir) {
  const file = path.join(crawlDir, "pages", `${slugFor(oldPath)}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

export function cleanMain(page, phones = [], { extraRemove = "" } = {}) {
  const $ = cheerio.load(`<div id="root">${page.mainHtml}</div>`, null, false);
  const root = $("#root");
  const base = page.finalUrl || page.url;
  const abs = (v) => { try { return new URL(v, base).href; } catch { return v; } };
  // The page banner (title and breadcrumb trail); our page head replaces it.
  root.find("section.breadcrumb-classic, .breadcrumb-classic, ol.breadcrumb, ul.breadcrumb").remove();
  root.find(DROP.join(",")).remove();
  if (extraRemove) root.find(extraRemove).remove();
  // Links that only run oatccc.com scripts (scroll, pop-ups). A standalone
  // button goes; a link inside a sentence ("Or you can SEARCH and contact")
  // keeps its words, just not the link.
  root.find("a").filter((_, a) => /^javascript:/i.test($(a).attr("href") || "") || $(a).attr("data-toggle") !== undefined || $(a).attr("onclick") !== undefined).each((_, a) => {
    const $a = $(a);
    const parent = $a.parent();
    const around = parent.text().replace($a.text(), "").replace(/\s+/g, " ").trim();
    const inSentence = parent.is("p, li, td, h2, h3, h4, h5, h6, span, strong, em") && /[a-z]{2,}/i.test(around);
    if (inSentence) $a.replaceWith($a.contents()); else $a.remove();
  });
  // Text shown with white-space:pre-wrap keeps its line breaks as <br>.
  root.find("[style*='pre']").each((_, el) => {
    $(el).contents().each((__, node) => {
      if (node.type !== "text" || !node.data.includes("\n")) return;
      const lines = node.data.replace(/^\n+|\n+$/g, "").split("\n");
      $(node).replaceWith(lines.map((line) => $("<i>").text(line).html()).join("<br>"));
    });
  });
  root.find("h1").each((_, el) => { el.tagName = "h2"; });
  // oatccc.com sometimes marks a whole paragraph as a heading; show it as
  // a paragraph (same words) so it is not set in huge display type.
  root.find("h2, h3, h4, h5, h6").each((_, el) => { if ($(el).text().replace(/\s+/g, " ").trim().length > 100) el.tagName = "p"; });
  // Unwrap anything not on the keep list (div, span, section, font...).
  for (let changed = true; changed;) {
    changed = false;
    root.find("*").each((_, el) => { if (!KEEP.has(el.tagName)) { $(el).replaceWith($(el).contents()); changed = true; } });
  }
  // Attributes: only what each tag needs; links and images absolute.
  root.find("*").each((_, el) => {
    const attrs = { ...el.attribs };
    for (const name of Object.keys(attrs)) $(el).removeAttr(name);
    if (el.tagName === "a" && attrs.href) $(el).attr("href", /^(mailto|tel):/i.test(attrs.href) ? attrs.href.trim() : abs(attrs.href.trim()));
    if (el.tagName === "img" && attrs.src) { $(el).attr("src", abs(attrs.src.trim())); $(el).attr("alt", attrs.alt || ""); $(el).attr("loading", "lazy"); }
    if (el.tagName === "iframe" && attrs.src) $(el).attr("src", abs(attrs.src.trim()));
    if ((el.tagName === "td" || el.tagName === "th") && attrs.colspan) $(el).attr("colspan", attrs.colspan);
    if ((el.tagName === "td" || el.tagName === "th") && attrs.rowspan) $(el).attr("rowspan", attrs.rowspan);
  });
  // tel: links: the number is left off, so the link goes too.
  root.find("a").filter((_, a) => /^tel:/i.test($(a).attr("href") || "")).each((_, a) => {
    phones.push({ page: page.url, phone: $(a).text().trim() || $(a).attr("href"), context: $(a).parent().text().replace(/\s+/g, " ").trim().slice(0, 160), how: "tel: link" });
    $(a).remove();
  });
  // Phone numbers in the text.
  const walk = (node) => {
    for (const child of [...(node.children || [])]) {
      if (child.type === "text") {
        const found = child.data.match(PHONE);
        if (found) {
          for (const phone of found) phones.push({ page: page.url, phone: phone.trim(), context: child.data.replace(/\s+/g, " ").trim().slice(0, 160), how: "text" });
          child.data = child.data.split(PHONE).map((part, i, all) => (i < all.length - 1 ? part.replace(PHONE_LABEL, "") : part)).join("");
        }
      } else if (child.children) walk(child);
    }
  };
  walk(root.get(0));
  // Collapse whitespace in text (the browser shows it the same way).
  const squash = (node) => { for (const child of node.children || []) { if (child.type === "text") child.data = child.data.replace(/\s+/g, " "); else squash(child); } };
  squash(root.get(0));
  // Drop elements left empty.
  for (let i = 0; i < 3; i++) {
    root.find("p, li, h2, h3, h4, h5, h6, strong, b, em, i, u, a, ul, ol").each((_, el) => {
      const $el = $(el);
      if (!$el.text().replace(/ /g, " ").trim() && !$el.find("img, iframe").length) $el.remove();
    });
  }
  return (root.html() || "")
    .replace(/(?:<br>\s*){3,}/g, "<br><br>")
    .replace(BLOCK, "\n$1")
    .replace(/\n(<\/(?:p|li|h[2-6]|dt|dd)>)/g, "$1")
    .replace(/(<(?:p|li|h[2-6]|td|th)>)\s*(?:<br>\s*)+/g, "$1")
    .replace(/(?:\s*<br>)+\s*(<\/(?:p|li|h[2-6]|td|th)>)/g, "$1")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

