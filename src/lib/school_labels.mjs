import ambiguousNames from "../data/ambiguous-school-names.json" with { type: "json" };
import regionLabels from "../data/school-region-labels.json" with { type: "json" };
import { schoolLabel } from "./display_names.mjs";

// School name as shown on the site (one style; the city added when more
// than one Ohio school shares the name). The shared-name list is written
// by scripts/fix-name-display.mjs from the schools table.
const AMBIGUOUS = new Set(ambiguousNames.names || []);

// When the city is the school's own name, the region is shown instead
// (src/data/school-region-labels.json): "Lakewood (Northeast)".
const REGIONS = regionLabels.regions || {};

export const labelSchool = (name, city) => schoolLabel(name, city, AMBIGUOUS, REGIONS);
export const isSharedSchoolName = (key) => AMBIGUOUS.has(key);
