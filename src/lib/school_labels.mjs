import ambiguousNames from "../data/ambiguous-school-names.json" with { type: "json" };
import { schoolLabel } from "./display_names.mjs";

// School name as shown on the site (one style; the city added when more
// than one Ohio school shares the name). The shared-name list is written
// by scripts/fix-name-display.mjs from the schools table.
const AMBIGUOUS = new Set(ambiguousNames.names || []);

export const labelSchool = (name, city) => schoolLabel(name, city, AMBIGUOUS);
export const isSharedSchoolName = (key) => AMBIGUOUS.has(key);
