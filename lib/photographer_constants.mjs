// Pure data, zero imports, on purpose -- src/pages/*.mjs (photographers.mjs,
// photographerdetail.mjs, adminphotographers.mjs) run at BUILD time via
// scripts/build.mjs, which has no Supabase env vars loaded (by design --
// the static build never touches the database). lib/photographer_service.mjs
// imports supabaseAdmin at module load time, so anything a build-time page
// needs from it must live here instead, not there, or the build crashes
// immediately on import. lib/photographer_service.mjs itself re-exports
// these two so API handlers can still get everything from one file.
export const SPORTS = [
  { value: "cross_country", label: "Cross Country" },
  { value: "track_and_field", label: "Track and Field" },
  { value: "football", label: "Football" },
  { value: "soccer", label: "Soccer" },
  { value: "basketball", label: "Basketball" },
  { value: "volleyball", label: "Volleyball" },
  { value: "wrestling", label: "Wrestling" },
  { value: "swimming", label: "Swimming" },
  { value: "baseball", label: "Baseball" },
  { value: "softball", label: "Softball" },
  { value: "lacrosse", label: "Lacrosse" },
  { value: "golf", label: "Golf" },
  { value: "tennis", label: "Tennis" },
  { value: "cheer", label: "Cheer" },
  { value: "gymnastics", label: "Gymnastics" },
  { value: "other", label: "Other" }
];

export const REGIONS = ["Central", "East", "Northeast", "Northwest", "Southeast", "Southwest"];
