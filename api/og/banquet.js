import { ImageResponse } from "@vercel/og";
import { loadBanquetPack } from "../../lib/banquet_service.mjs";
import { cardFonts } from "../../lib/og/front_page_card.mjs";
import { site } from "../../src/config/site.mjs";
import fs from "node:fs";
import path from "node:path";

// Public: Banquet Pack share image, 1080x1350 (WO-35). School color, logo,
// and real 2026 facts: state finishes, All-Ohio, meets, and each side's
// three fastest season bests. Hidden athletes never appear.
// GET ?slug=<team slug>[&download=1]

const SEASON = 2026;
const h = (type, style, ...children) => ({ type, props: { style: { display: "flex", ...style }, children: children.flat().filter((c) => c !== null && c !== undefined && c !== false && c !== "") } });

async function logoDataUrl(base) {
  if (!base) return null;
  try {
    const local = path.join(process.cwd(), "public", `${base}-256.png`);
    let bytes = fs.existsSync(local) ? fs.readFileSync(local) : null;
    if (!bytes) {
      const res = await fetch(`${site.siteUrl}${base}-256.png`, { signal: AbortSignal.timeout(6000) });
      if (!res.ok || !String(res.headers.get("content-type") || "").includes("image/png")) return null;
      bytes = Buffer.from(await res.arrayBuffer());
    }
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function handler(request, response) {
  const slug = String(request.query?.slug || "").toLowerCase();
  if (!/^[a-z0-9-]{1,200}$/.test(slug)) return response.status(400).json({ error: "Missing team." });
  try {
    const pack = await loadBanquetPack(slug, SEASON);
    if (!pack || pack.merged || pack.private) return response.status(404).json({ error: "Team not found." });
    if (!pack.eligible) return response.status(404).json({ error: "This team's Banquet Pack needs results from at least 3 meets." });
    const on = pack.accent_text;
    const facts = [];
    for (const g of ["boys", "girls"]) if (pack.genders[g].state?.label) facts.push(pack.genders[g].state.label);
    const allOhio = pack.genders.boys.all_ohio.length + pack.genders.girls.all_ohio.length;
    if (allOhio) facts.push(`${allOhio} All-Ohio`);
    const wins = pack.awards.filter((a) => a.result === "Winner").length;
    if (wins) facts.push(`${wins} Podium Watch award${wins === 1 ? "" : "s"}`);
    facts.push(`${pack.meet_count} meets on Podium Watch`);
    const sides = ["boys", "girls"].filter((g) => pack.genders[g].athletes.length).map((g) => ({ label: g === "boys" ? "BOYS" : "GIRLS", rows: pack.genders[g].athletes.slice(0, 3) }));
    const logoSrc = await logoDataUrl(pack.logo?.base);
    const name = pack.team.display_name;
    const element = h("div", { width: 1080, height: 1350, flexDirection: "column", backgroundColor: pack.accent, color: on, padding: "80px 80px 64px" },
      h("div", { fontFamily: "Outfit", fontWeight: 800, fontSize: 30, letterSpacing: 4, opacity: 0.85 }, `PODIUM WATCH · ${SEASON} BANQUET PACK`),
      h("div", { alignItems: "center", gap: 40, marginTop: 50 },
        logoSrc ? h("div", { width: 260, height: 260, borderRadius: 36, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", padding: 22 }, { type: "img", props: { src: logoSrc, width: 216, height: 216, style: { width: 216, height: 216, objectFit: "contain" } } }) : null,
        h("div", { flexDirection: "column", flexShrink: 1 },
          h("div", { fontFamily: "Big Shoulders", fontWeight: 900, fontSize: name.length > 16 ? 92 : 120, lineHeight: 0.95, textTransform: "uppercase" }, name),
          h("div", { fontFamily: "Outfit", fontWeight: 800, fontSize: 36, marginTop: 10, opacity: 0.9 }, `${SEASON} Cross Country`))),
      h("div", { flexDirection: "column", gap: 8, marginTop: 50 }, ...facts.slice(0, 4).map((fact) => h("div", { fontFamily: "Outfit", fontWeight: 800, fontSize: 40 }, fact))),
      h("div", { flexGrow: 1 }),
      sides.length ? h("div", { gap: 50 }, ...sides.map((side) => h("div", { flexDirection: "column", flexGrow: 1, flexBasis: 0, gap: 6 },
        h("div", { fontFamily: "Outfit", fontWeight: 800, fontSize: 26, letterSpacing: 4, opacity: 0.8, borderBottom: `4px solid ${on}`, paddingBottom: 8, marginBottom: 6 }, `${side.label} · SEASON BESTS`),
        ...side.rows.map((a) => h("div", { justifyContent: "space-between", fontFamily: "Outfit", fontWeight: 700, fontSize: 32, gap: 16 }, h("div", { flexShrink: 1, overflow: "hidden" }, a.name), h("div", { fontWeight: 800 }, a.best.mark)))))) : null,
      h("div", { marginTop: 44, fontFamily: "Outfit", fontWeight: 800, fontSize: 30, opacity: 0.9 }, "podiumwatch.org/banquet"));
    const png = Buffer.from(await new ImageResponse(element, { width: 1080, height: 1350, fonts: cardFonts() }).arrayBuffer());
    response.setHeader("Content-Type", "image/png");
    response.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
    if (request.query?.download) response.setHeader("Content-Disposition", `attachment; filename="podium-watch-${slug}-banquet-1080x1350.png"`);
    return response.status(200).send(png);
  } catch (error) {
    console.error("Banquet image error:", error);
    return response.status(500).json({ error: "The image could not be made." });
  }
}
