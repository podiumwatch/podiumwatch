import { furthestRound, ordinal } from "../../src/lib/wrapped.mjs";

// Podium Watch Wrapped share images (WO-36), drawn with @vercel/og:
//   story 1080x1920: every fact sits at least 250 px from the top and the
//     bottom, leaving that space open for Instagram stickers (no fake
//     sticker boxes).
//   post 1080x1350.
// Boys green, girls pink, podiumwatch.org/wrapped on both. Real facts only.

const BLACK = "#090909";
const CREAM = "#F6F4EE";
const DIM = "#9A9C97";
const CARD = "#16191A";
const THEMES = { boys: { accent: "#0FAF68", ink: "#063D28" }, girls: { accent: "#EC4899", ink: "#500724" } };

const h = (type, style, ...children) => ({ type, props: { style: { display: "flex", ...style }, children: children.flat().filter((c) => c !== null && c !== undefined && c !== false && c !== "") } });
const meetShort = (name) => String(name || "").replace(/^OHSAA Cross Country /, "OHSAA ").replace(/\s*\(HS\)\s*$/, "");
const nameSize = (name, base) => (name.length > 22 ? Math.round(base * 0.72) : name.length > 16 ? Math.round(base * 0.86) : base);

function tile(theme, label, value, sub, { big = 64 } = {}) {
  return h("div", { flexDirection: "column", flexGrow: 1, flexBasis: 0, backgroundColor: CARD, borderRadius: 22, padding: "24px 26px", gap: 6, minWidth: 0 },
    h("div", { color: DIM, fontFamily: "Outfit", fontWeight: 800, fontSize: 24, letterSpacing: 2 }, label.toUpperCase()),
    h("div", { color: CREAM, fontFamily: "Big Shoulders", fontWeight: 900, fontSize: big, lineHeight: 1 }, value),
    sub ? h("div", { color: DIM, fontFamily: "Outfit", fontWeight: 400, fontSize: 23, lineHeight: 1.2 }, sub) : null);
}

// The facts shown, in order. Each is [label, value, sub]; empty ones drop.
export function wrappedTiles(w) {
  const tiles = [["Races run", String(w.races), "2026 cross country"]];
  if (w.best_place) tiles.push(["Best place", w.best_place.place_text, meetShort(w.best_place.meet)]);
  const round = (w.postseason || []).at(-1);
  if (round) tiles.push([round.stage === "state" ? "State meet" : `${round.label}`, round.place ? ordinal(round.place) : "Ran", round.division || "Postseason"]);
  if (w.rank_division) tiles.push(["Division rank", `#${w.rank_division.rank}`, `of ${w.rank_division.of.toLocaleString("en-US")} in ${w.rank_division.division}`]);
  if (w.rank_grade) tiles.push(["Class rank", `#${w.rank_grade.rank}`, w.rank_grade.text.replace(/^\S+ /, "")]);
  return tiles.slice(0, 4);
}

export function wrappedCard(w, { size = "post" } = {}) {
  const story = size === "story";
  const theme = THEMES[w.gender] || THEMES.boys;
  const width = 1080;
  const height = story ? 1920 : 1350;
  const pad = story ? "250px 72px 250px" : "70px 64px 60px";
  const tiles = wrappedTiles(w);
  const rows = [tiles.slice(0, 2), tiles.slice(2, 4)].filter((r) => r.length);
  const change = w.drop_text
    ? `First race on Podium Watch ${w.first.mark}, season best ${w.best.mark} (${w.drop_text} faster, different courses)`
    : w.first_is_best ? "Season best came in the first race on Podium Watch" : null;
  const element = h("div", { width, height, flexDirection: "column", backgroundColor: BLACK, color: CREAM, padding: pad, backgroundImage: `radial-gradient(circle at 92% 6%, ${theme.accent}55, ${BLACK} 46%)` },
    h("div", { alignItems: "center", gap: 16 },
      h("div", { backgroundColor: theme.accent, color: theme.ink, fontFamily: "Outfit", fontWeight: 800, fontSize: 28, letterSpacing: 3, padding: "10px 22px", borderRadius: 999 }, `PODIUM WATCH WRAPPED · ${w.season}`)),
    h("div", { marginTop: story ? 40 : 30, fontFamily: "Big Shoulders", fontWeight: 900, fontSize: nameSize(w.name, story ? 132 : 116), lineHeight: 0.95, textTransform: "uppercase" }, w.name),
    h("div", { marginTop: 12, color: DIM, fontFamily: "Outfit", fontWeight: 800, fontSize: 32 }, [w.school, furthestRound(w)].filter(Boolean).join(" · ")),
    h("div", { marginTop: story ? 46 : 30, flexDirection: "column" },
      h("div", { color: DIM, fontFamily: "Outfit", fontWeight: 800, fontSize: 26, letterSpacing: 2 }, "SEASON BEST"),
      h("div", { color: theme.accent, fontFamily: "Big Shoulders", fontWeight: 900, fontSize: story ? 230 : 190, lineHeight: 0.9 }, w.best?.mark || ""),
      h("div", { color: CREAM, fontFamily: "Outfit", fontWeight: 400, fontSize: 28 }, w.best ? meetShort(w.best.meet) : "")),
    w.all_ohio ? h("div", { marginTop: 22, alignSelf: "flex-start", border: `3px solid ${theme.accent}`, color: theme.accent, fontFamily: "Outfit", fontWeight: 800, fontSize: 30, letterSpacing: 1, padding: "8px 20px", borderRadius: 999 }, w.all_ohio) : null,
    h("div", { flexDirection: "column", gap: 16, marginTop: story ? 44 : 28 }, ...rows.map((row) => h("div", { gap: 16 }, ...row.map(([label, value, sub]) => tile(theme, label, value, sub, { big: story ? 70 : 60 }))))),
    change ? h("div", { marginTop: 22, color: DIM, fontFamily: "Outfit", fontWeight: 400, fontSize: 25, lineHeight: 1.3 }, change) : null,
    h("div", { flexGrow: 1 }),
    h("div", { justifyContent: "space-between", alignItems: "flex-end" },
      h("div", { color: CREAM, fontFamily: "Outfit", fontWeight: 800, fontSize: 32 }, "podiumwatch.org/wrapped"),
      h("div", { color: DIM, fontFamily: "Outfit", fontWeight: 400, fontSize: 22 }, "From official results")));
  return { element, width, height };
}
