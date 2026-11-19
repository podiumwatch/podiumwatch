import { oatcccFlags } from "../../src/oatccc/config.mjs";
import { anonClient } from "../../lib/oatccc_verification.mjs";
import { selectAll } from "../../lib/supabase_paging.mjs";

// "Divisions by school" for the Divisions page (2027 Indoor State Meet).
// 404 unless OATCCC_LIVE=1 and OATCCC_DIVISION_LIST_LIVE=1 (off until
// Anjanette confirms the school-list data issues).
//
// GET -> { year, schools: [{ name, city, boys, girls }] }
//
// Reads the public view oatccc_division_list (install/102), loaded from the
// OATCCC's workbook by scripts/import-oatccc-school-divisions.mjs. Real
// schools only; no enrollment figures.
const YEAR = 2027;

export default async function handler(request, response) {
  if (!oatcccFlags().divisionList) {
    response.setHeader("Cache-Control", "no-store");
    return response.status(404).json({ error: "Not found." });
  }
  if (request.method !== "GET") return response.status(405).json({ error: "GET only." });
  try {
    const client = anonClient();
    // One row per tournament name per year, so that order is unique.
    const { data, error } = await selectAll(
      () => client.from("oatccc_division_list").select("tournament_name, city, boys_division, girls_division").eq("meet_year", YEAR).order("tournament_name"),
      { orderColumn: null, maxRows: 5000 }
    );
    if (error) throw error;
    response.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
    return response.status(200).json({
      year: YEAR,
      schools: (data || []).map((row) => ({ name: row.tournament_name, city: row.city || "", boys: row.boys_division || "", girls: row.girls_division || "" }))
    });
  } catch {
    response.setHeader("Cache-Control", "no-store");
    return response.status(500).json({ error: "The division list could not be loaded." });
  }
}
