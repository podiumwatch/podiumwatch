import { ImageResponse } from "@vercel/og";
import { loadTeamPage } from "../../lib/team_page_service.mjs";
import { cardFonts } from "../../lib/og/front_page_card.mjs";
import { site } from "../../src/config/site.mjs";
import fs from "node:fs";
import path from "node:path";

// The logo as a data URL: from disk when the file is there (local runs),
// otherwise from the site. Any problem leaves the logo off the card.
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

// Public: team share card PNG, 1080x1350 (WO-11, WO-17 renderer). School
// logo on the school color, name, and real 2026 facts only (state finish,
// qualifiers, All-Ohio). GET ?slug=<team slug>[&download=1]

const h = (type, style, ...children) => ({ type, props: { style: { display: "flex", ...style }, children: children.flat().filter((c) => c !== null && c !== undefined && c !== false && c !== "") } });

export default async function handler(request, response) {
  const slug = String(request.query?.slug || "").toLowerCase();
  if (!/^[a-z0-9-]{1,200}$/.test(slug)) return response.status(400).json({ error: "Missing team." });
  try {
    const data = await loadTeamPage(slug);
    if (!data || data.merged || data.private) return response.status(404).json({ error: "Team not found." });
    const on = data.accent_text;
    const facts = [];
    for (const g of ["boys", "girls"]) if (data.genders[g].state?.label) facts.push(data.genders[g].state.label);
    const q = data.genders.boys.state_qualifiers + data.genders.girls.state_qualifiers;
    if (q) facts.push(`${q} state qualifier${q === 1 ? "" : "s"}`);
    const ao = data.genders.boys.all_ohio + data.genders.girls.all_ohio;
    if (ao) facts.push(`${ao} All-Ohio`);
    const logoSrc = await logoDataUrl(data.logo?.base);
    const name = data.team.display_name;
    const element = h("div", { width: 1080, height: 1350, flexDirection: "column", backgroundColor: data.accent, color: on, padding: "90px 80px 70px" },
      h("div", { color: on, fontFamily: "Outfit", fontWeight: 800, fontSize: 30, letterSpacing: 4, opacity: 0.85 }, `PODIUM WATCH · ${data.season} OHIO CROSS COUNTRY`),
      h("div", { flexGrow: 1, alignItems: "center", justifyContent: "center" },
        logoSrc ? h("div", { width: 520, height: 520, borderRadius: 48, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", padding: 36 }, { type: "img", props: { src: logoSrc, width: 448, height: 448, style: { width: 448, height: 448, objectFit: "contain" } } }) : null),
      h("div", { fontFamily: "Big Shoulders", fontWeight: 900, fontSize: name.length > 18 ? 110 : 140, lineHeight: 0.95, textTransform: "uppercase" }, name),
      h("div", { flexDirection: "column", gap: 10, marginTop: 24 }, ...facts.slice(0, 4).map((fact) => h("div", { fontFamily: "Outfit", fontWeight: 800, fontSize: 38 }, fact))),
      h("div", { marginTop: 40, fontFamily: "Outfit", fontWeight: 800, fontSize: slug.length > 30 ? 24 : 30, opacity: 0.9 }, `podiumwatch.org/teams/${slug}`));
    const png = Buffer.from(await new ImageResponse(element, { width: 1080, height: 1350, fonts: cardFonts() }).arrayBuffer());
    response.setHeader("Content-Type", "image/png");
    response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    if (request.query?.download) response.setHeader("Content-Disposition", `attachment; filename="podium-watch-${slug}-1080x1350.png"`);
    return response.status(200).send(png);
  } catch (error) {
    console.error("Team card error:", error);
    return response.status(500).json({ error: "The card could not be made." });
  }
}
