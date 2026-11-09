import fs from "node:fs";
import path from "node:path";

// "ON THE FRONT PAGE" share cards (WO-43), rendered with @vercel/og (the
// WO-17 image renderer). Two sizes:
//   post  1080x1350
//   story 1080x1920: every essential element sits 250 px or more from the
//         top and bottom, and the lower area is left open for stickers
//         (no fake sticker boxes).
// Brand: black ground, Podium Watch green, cream type, Big Shoulders
// Display for the headline, Outfit for labels.

const BLACK = "#090909";
const CREAM = "#F6F4EE";
const GREEN = "#0FAF68";
const GREEN_INK = "#063D28";
const DIM = "#9A9C97";

const fontFile = (pkg, file) => fs.readFileSync(path.join(process.cwd(), "node_modules", "@fontsource", pkg, "files", file));
let fonts = null;
export function cardFonts() {
  if (!fonts) {
    fonts = [
      { name: "Big Shoulders", data: fontFile("big-shoulders-display", "big-shoulders-display-latin-900-normal.woff"), weight: 900, style: "normal" },
      { name: "Outfit", data: fontFile("outfit", "outfit-latin-400-normal.woff"), weight: 400, style: "normal" },
      { name: "Outfit", data: fontFile("outfit", "outfit-latin-800-normal.woff"), weight: 800, style: "normal" }
    ];
  }
  return fonts;
}

const h = (type, style, ...children) => ({ type, props: { style: { display: "flex", ...style }, children: children.flat().filter((c) => c !== null && c !== undefined && c !== false) } });
const img = (src, style) => ({ type: "img", props: { src, style } });

// Headline size by length so long headlines still fit their box.
export function headlineSize(title, { size }) {
  const n = String(title || "").length;
  const base = size === "story" ? 118 : 104;
  if (n <= 40) return base;
  if (n <= 60) return Math.round(base * 0.86);
  if (n <= 85) return Math.round(base * 0.74);
  return Math.round(base * 0.62);
}

export function frontPageCard({ lead, dateLabel, size = "post", siteUrl, logoUrl }) {
  const story = size === "story";
  const width = 1080;
  const height = story ? 1920 : 1350;
  const pad = 64;
  const top = story ? 250 : 60; // Story: safe zone
  const photoUrl = lead.image_url ? (lead.image_url.startsWith("http") ? lead.image_url : `${siteUrl}${lead.image_url}`) : null;
  const titleSize = headlineSize(lead.title, { size });

  const header = h("div", { justifyContent: "space-between", alignItems: "center", padding: `0 ${pad}px` },
    h("div", { flexDirection: "column", gap: 10 },
      h("div", { backgroundColor: GREEN, color: GREEN_INK, fontFamily: "Outfit", fontWeight: 800, fontSize: 30, letterSpacing: 3, padding: "12px 24px", borderRadius: 999 }, "ON THE FRONT PAGE"),
      h("div", { color: CREAM, fontFamily: "Outfit", fontWeight: 800, fontSize: 30, letterSpacing: 2, paddingLeft: 4 }, String(dateLabel || "").toUpperCase())),
    logoUrl ? img(logoUrl, { width: 96, height: 96 }) : null);

  const photoHeight = story ? 700 : 600;
  const photo = photoUrl
    ? h("div", { flexDirection: "column", gap: 10 },
        img(photoUrl, { width, height: photoHeight, objectFit: "cover" }),
        lead.image_credit ? h("div", { color: DIM, fontFamily: "Outfit", fontWeight: 400, fontSize: 24, padding: `0 ${pad}px` }, `Photo: ${lead.image_credit}`) : null)
    : null;

  const kicker = lead.kicker ? h("div", { color: GREEN, fontFamily: "Outfit", fontWeight: 800, fontSize: 30, letterSpacing: 3 }, lead.kicker.toUpperCase()) : null;
  // No photo: a large type-only headline fills the space instead.
  const headline = h("div", { color: CREAM, fontFamily: "Big Shoulders", fontWeight: 900, fontSize: photoUrl ? titleSize : Math.round(titleSize * 1.45), lineHeight: 0.98, textTransform: "uppercase" }, lead.title);
  const body = h("div", { flexDirection: "column", gap: 16, padding: `0 ${pad}px` }, kicker, headline);

  const footer = h("div", { justifyContent: "space-between", alignItems: "center", padding: `0 ${pad}px` },
    h("div", { color: CREAM, fontFamily: "Outfit", fontWeight: 800, fontSize: 34 }, `${siteUrl.replace(/^https?:\/\/(www\.)?/, "")}/front`),
    h("div", { color: DIM, fontFamily: "Outfit", fontWeight: 400, fontSize: 24 }, "Podium Watch"));

  // No photo: the headline sits low, above the footer, filling the card.
  const children = !photoUrl
    ? [h("div", { height: top }), header, h("div", { flexGrow: 1 }), body, h("div", { height: 64 }), footer, h("div", { height: story ? 250 : 56 })]
    : story
    // Story: content starts at 250 and the footer ends 250 from the
    // bottom; the open space between the headline and the footer is
    // left for stickers.
    ? [h("div", { height: top }), header, h("div", { height: 40 }), photo, h("div", { height: 40 }), body, h("div", { flexGrow: 1 }), footer, h("div", { height: 250 })]
    : [h("div", { height: top }), header, h("div", { height: 36 }), photo, h("div", { height: 36 }), body, h("div", { flexGrow: 1 }), footer, h("div", { height: 56 })];

  return { element: h("div", { width, height, flexDirection: "column", backgroundColor: BLACK, backgroundImage: `radial-gradient(circle at 92% 6%, rgba(15,175,104,.28), rgba(9,9,9,0) 55%)` }, ...children), width, height };
}
