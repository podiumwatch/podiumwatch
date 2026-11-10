// 2026 Athlete, Team and Coach of the Year share images, 1200x630 (the
// link-card size Facebook, Instagram and texts use). Two cards:
//   awardsCategoryCard: the category, every announced finalist with their
//     school logo, the closing time and podiumwatch.org. "VOTE NOW", then
//     "VOTING CLOSED", then "WINNER" once results are published.
//   awardsFinalistCard: one finalist on their school color with the logo.
// Built from lib/awards_share.mjs's shareState() (real finalist rows
// only). Rendered by api/og/awards-2026.js with @vercel/og.

import { AWARD_KIND, AWARD_NAMES, closesLabel, divisionLabel, shortTitle } from "../awards_share.mjs";

export const CARD = { width: 1200, height: 630 };
const INK = "#090909";
const CREAM = "#f6f4ee";
const MUTE = "#b0b0aa";
const ACCENT = { boys: { fill: "#0FAF68", ink: "#063d28" }, girls: { fill: "#EC4899", ink: "#500724" } };

const h = (type, style, ...children) => ({ type, props: { style: { display: "flex", ...style }, children: children.flat().filter((c) => c !== null && c !== undefined && c !== false && c !== "") } });
const img = (src, size) => ({ type: "img", props: { src, width: size, height: size, style: { width: size, height: size, objectFit: "contain" } } });

const initials = (name) => String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

// A logo on a white tile, or the school's initials when there's no file.
function logoTile(logo, size, { name, radius = Math.round(size * 0.18) } = {}) {
  const pad = Math.round(size * 0.1);
  return h("div", { width: size, height: size, flexShrink: 0, borderRadius: radius, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
    logo?.src ? img(logo.src, size - pad * 2) : h("div", { fontFamily: "Big Shoulders", fontWeight: 900, fontSize: Math.round(size * 0.42), color: INK }, initials(name)));
}

const pill = (text, { fill, ink, size = 26 }) => h("div", { backgroundColor: fill, color: ink, fontFamily: "Outfit", fontWeight: 800, fontSize: size, letterSpacing: 3, padding: `${Math.round(size * 0.35)}px ${Math.round(size * 0.8)}px`, borderRadius: 999 }, text);
const outlinePill = (text, { color, size = 22 }) => h("div", { border: `3px solid ${color}`, color, fontFamily: "Outfit", fontWeight: 800, fontSize: size, letterSpacing: 3, padding: `${Math.round(size * 0.25)}px ${Math.round(size * 0.7)}px`, borderRadius: 999 }, text);

const banner = (state) => ({ vote: "VOTE NOW", closed: "VOTING CLOSED", winner: "WINNER" })[state];
const footerLine = (category, state) => (state === "vote" ? `Voting closes ${closesLabel(category)} ET` : state === "closed" ? "Winners announced Saturday morning, Nov. 14" : "Congratulations to every finalist");

function frame(category, children) {
  const accent = ACCENT[category.gender] || ACCENT.boys;
  return h("div", { width: CARD.width, height: CARD.height, flexDirection: "column", backgroundColor: INK, color: CREAM, padding: "40px 56px 34px", position: "relative" },
    h("div", { position: "absolute", left: 0, top: 0, bottom: 0, width: 14, backgroundColor: accent.fill }),
    ...children);
}

function footer(category, state, accent) {
  return h("div", { marginTop: "auto", alignItems: "center", justifyContent: "space-between", fontFamily: "Outfit", fontWeight: 800, fontSize: 26 },
    h("div", { color: state === "vote" ? accent.fill : CREAM }, footerLine(category, state)),
    h("div", { color: CREAM }, "podiumwatch.org"));
}

function header(category, state, accent) {
  return [
    h("div", { alignItems: "center", gap: 16 }, pill(banner(state), accent), outlinePill(AWARD_KIND[category.award], { color: accent.fill })),
    h("div", { marginTop: 18, fontFamily: "Outfit", fontWeight: 800, fontSize: 30, color: MUTE, letterSpacing: 1 }, `2026 ${divisionLabel(category)}`),
    h("div", { fontFamily: "Big Shoulders", fontWeight: 900, fontSize: 76, lineHeight: 1, textTransform: "uppercase" }, AWARD_NAMES[category.award])
  ];
}

// Finalist rows: name, plus the school when it isn't the name (teams are
// their school).
function finalistGrid(category, finalists, logos, accent) {
  const n = finalists.length;
  const cols = n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const gap = 12;
  const area = 300;
  const rowH = Math.min(84, Math.floor((area - gap * (rows - 1)) / Math.max(rows, 1)));
  const colW = Math.floor((CARD.width - 56 * 2 - gap * (cols - 1)) / cols);
  const logoSize = rowH - 14;
  const showSchool = category.award !== "team";
  const nameSize = (name) => { const base = rowH >= 70 ? 30 : rowH >= 58 ? 26 : 22; const room = (colW - logoSize - 44) / (base * 0.58); return name.length > room ? Math.max(17, Math.floor(base * (room / name.length))) : base; };
  return h("div", { marginTop: 22, flexWrap: "wrap", gap, width: CARD.width - 112 },
    ...finalists.map((item) => h("div", { width: colW, height: rowH, alignItems: "center", gap: 12, padding: "7px 12px 7px 7px", backgroundColor: "#161b19", borderRadius: 14, borderLeft: `5px solid ${accent.fill}` },
      logoTile(logos.get(item.key), logoSize, { name: item.school || item.name, radius: 10 }),
      h("div", { flexDirection: "column", justifyContent: "center", minWidth: 0 },
        h("div", { fontFamily: "Outfit", fontWeight: 800, fontSize: nameSize(item.name), lineHeight: 1.08, color: CREAM }, item.name),
        showSchool && item.school && rowH >= 58 ? h("div", { fontFamily: "Outfit", fontWeight: 400, fontSize: rowH >= 70 ? 20 : 17, color: MUTE, lineHeight: 1.1 }, item.school) : null))));
}

function winnerBlock(category, winners, logos, accent) {
  const big = winners.length === 1;
  return h("div", { marginTop: 28, gap: 28, alignItems: "center" },
    ...winners.slice(0, 2).map((item) => h("div", { alignItems: "center", gap: 26 },
      logoTile(logos.get(item.key), big ? 200 : 150, { name: item.school || item.name }),
      h("div", { flexDirection: "column", maxWidth: big ? 800 : 330 },
        h("div", { fontFamily: "Big Shoulders", fontWeight: 900, fontSize: big ? (item.name.length > 18 ? 84 : 104) : 64, lineHeight: 0.95, textTransform: "uppercase", color: accent.fill }, item.name),
        category.award !== "team" && item.school ? h("div", { marginTop: 8, fontFamily: "Outfit", fontWeight: 800, fontSize: big ? 36 : 28, color: CREAM }, item.school) : null))));
}

export function awardsCategoryCard(category, share, logos = new Map()) {
  const accent = ACCENT[category.gender] || ACCENT.boys;
  const winners = share.state === "winner" ? share.winners : [];
  const body = winners.length ? winnerBlock(category, winners, logos, accent)
    : share.finalists.length ? finalistGrid(category, share.finalists, logos, accent)
      : h("div", { marginTop: 40, fontFamily: "Outfit", fontWeight: 800, fontSize: 34, color: MUTE }, "Finalists coming soon");
  return { width: CARD.width, height: CARD.height, element: frame(category, [...header(category, share.state, accent), body, footer(category, share.state, accent)]) };
}

// Readable text on a background color (WCAG relative luminance), as in
// lib/team_logo_service.mjs.
function textOn(hex) {
  const c = String(hex || "#000000").replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (1.05 / (lum + 0.05)) >= ((lum + 0.05) / 0.05) ? "#ffffff" : "#0b0b0b";
}

export function awardsFinalistCard(category, share, finalist, logo = null) {
  const accent = ACCENT[category.gender] || ACCENT.boys;
  const bg = /^#[0-9a-f]{6}$/i.test(logo?.color || "") ? logo.color : INK;
  const on = textOn(bg);
  const role = share.state === "winner" ? (finalist.winner ? "winner" : "finalist") : "finalist";
  const top = share.state === "vote" ? "VOTE FOR" : share.state === "winner" && finalist.winner ? "WINNER" : "FINALIST";
  const nameSize = finalist.name.length > 22 ? 76 : finalist.name.length > 15 ? 92 : 112;
  const line = `${shortTitle(category)} ${role}`;
  return {
    width: CARD.width,
    height: CARD.height,
    element: h("div", { width: CARD.width, height: CARD.height, backgroundColor: bg, color: on, padding: "48px 56px 40px", alignItems: "center", gap: 48, position: "relative" },
      h("div", { position: "absolute", left: 0, right: 0, bottom: 0, height: 14, backgroundColor: accent.fill }),
      logoTile(logo, 380, { name: finalist.school || finalist.name }),
      h("div", { flexDirection: "column", flexGrow: 1, height: "100%", minWidth: 0 },
        h("div", { alignItems: "center", gap: 14 }, pill(top, accent), outlinePill(AWARD_KIND[category.award], { color: on, size: 20 })),
        h("div", { marginTop: 24, fontFamily: "Big Shoulders", fontWeight: 900, fontSize: nameSize, lineHeight: 0.94, textTransform: "uppercase" }, finalist.name),
        category.award !== "team" && finalist.school ? h("div", { marginTop: 12, fontFamily: "Outfit", fontWeight: 800, fontSize: 36 }, finalist.school) : null,
        h("div", { marginTop: 18, fontFamily: "Outfit", fontWeight: 800, fontSize: 30, opacity: 0.92 }, line),
        h("div", { marginTop: "auto", flexDirection: "column", gap: 6, fontFamily: "Outfit", fontWeight: 800, fontSize: 26 },
          h("div", {}, footerLine(category, share.state)),
          h("div", { opacity: 0.9 }, "podiumwatch.org"))))
  };
}
