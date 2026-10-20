// Cross-references the real 2026-10-20 OHSAA Northeast PDF entry lists
// (transcribed directly from ohsaa_source_pdfs/northeast/*.pdf) against
// our own roster's districtSiteKey assignments, to report any school in
// the PDF but missing from our data, or in our data but not in the PDF.
// "T" (team) entries only -- "I" (individual-only, no team score) and
// struck-through/withdrawn entries are excluded from the "team" compare
// since a team-less I entry never gets a districtSiteKey team row.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const candidate = JSON.parse(fs.readFileSync(path.join(pkgDir, "ohio_2026_xc_full_statewide_2026.json"), "utf8"));

// Transcribed PDF entries, T (team) status only, withdrawn/struck-through
// schools excluded (Buchtel, East (Akron), Brooklyn, Glenville [WD 9/11],
// Heartland Christian, Sebring McKinley [WD9/11], John Adams [struck]).
const PDF_TEAMS = {
  "boys|2|GO": ["Alliance","Archbishop Hoban","Austintown","Barberton","Boardman","Canfield","Cuyahoga Falls","Ellet","Firestone","Garfield (Akron)","Green","Hoover","Hudson","Lake","Louisville","North (Akron)","Norton","Perry (Massillon)","Salem","Tallmadge","Theodore Roosevelt","Wadsworth","Walsh Jesuit","Washington","Wooster"],
  "boys|2|LCCC": ["Avon Lake","Bay","Benedictine","Brecksville","Buckeye","Cloverleaf","Copley","CVCA","Firelands","Highland","John Hay","Lakewood","Midview","North Olmsted","Olmsted Falls","Padua","Revere","Rocky River","Steele","Westlake"],
  "boys|2|MAD": ["Aurora","Bedford","Brush","Chardon","Geneva","Glenville","Harvey","Hawken","Howland","Kenston","Lakeside","Madison","Max Hayes","Mayfield","Niles McKinley","Nordonia","North (Eastlake)","Orange","Rhodes","Riverside","Shaker Heights","South (Willoughby)","Twinsburg","University School","West Geauga"],
  "girls|2|GO": ["Alliance","Archbishop Hoban","Austintown","Barberton","Boardman","Canfield","Cuyahoga Falls","Ellet","Firestone","Garfield (Akron)","Green","Hoover","Hudson","Lake","Louisville","North (Akron)","Perry (Massillon)","Tallmadge","Theodore Roosevelt","Wadsworth","Walsh Jesuit","Washington","Wooster"],
  "girls|2|LCCC": ["Avon","Avon Lake","Bay","Brecksville","Cloverleaf","Copley","CVCA","Highland","Holy Name","Lakewood","Maple Hts","Midview","North Olmsted","North Ridgeville","North Royalton","Olmsted Falls","Padua","Revere","Rocky River","St. Joseph Academy","Steele","Westlake"],
  "girls|2|MAD": ["Aurora","Bedford","Brush","Chardon","Euclid","Harvey","Howland","John Marshall","Kenston","Lakeside","Madison","Mayfield","NDCL","Nordonia","North (Eastlake)","Rhodes","Riverside","Shaker Heights","South (Willoughby)","Twinsburg","Warren Harding","West Geauga"],
  "boys|3|GO": ["Acad. Urban Scholars","Canton Central Cath","Canton South","Cardinal Mooney","Chippewa","Coventry","Field","Girard","Hubbard","Manchester","Marlington","Northwest","Poland","Ravenna","St. Vincent St Mary","Southeast","Springfield (Akron)","Struthers","Tuslaw","West Branch"],
  "boys|3|LCCC": ["Beachwood","Brookside","Cle. Central Cath","Clearview","Crestview","East Tech","Elyria Catholic","Fairview","Holy Name","Keystone","Lutheran West","Norwayne","Orrville","Streetsboro","Triway","Waynedale","Woodridge"],
  "boys|3|MAD": ["Berkshire","Brookfield","Chagrin Falls","Champion","Conneaut","Crestwood","Edgewood","Garfield","Gilmour","Jefferson Area","John Adams","Kirtland","Lake Catholic","Lakeview","NDCL","Perry","Pymatuning Valley","Ursuline","VASJ","Warrensville","Wickliffe"],
  "girls|3|GO": ["Acad. Urban Scholars","Canton South","Chippewa","Coventry","East (Akron)","Field","Girard","Hubbard","Manchester","Marlington","Northwest","Norton","Poland","Ravenna","Salem","Southeast","South Range","Springfield (Akron)","St. Vincent St. Mary","Struthers","Tuslaw","West Branch"],
  "girls|3|LCCC": ["Bard","Beachwood","Brookside","Buckeye","Cle. Central Cath","East Tech","Elyria Catholic","Fairview","Firelands","Keystone","Laurel","Lutheran West","Norwayne","Orrville","Streetsboro","Triway","Woodridge"],
  "girls|3|MAD": ["Beaumont","Berkshire","Chagrin Falls","Champion","Conneaut","Crestwood","Edgewood","Garfield","Geneva","Gilmour","Glenville","Hathaway Brown","Hawken","Jefferson Area","Lake Catholic","Lakeview","Liberty","Max Hayes","Niles McKinley","Orange","Perry","Ursuline","VASJ"],
  "boys|4|GO": ["Columbiana","David Anderson","East Canton","East Palestine","Jackson Milton","Lake Center Christian","Lowellville","Mogadore","Rootstown","Sebring McKinley","South Range","Southern Local","Springfield New Middleton","United","Waterloo","Western Reserve"],
  "boys|4|LCCC": ["Bard","Black River","Central Christian","Cuyahoga Heights","Dalton","Hillsdale","Independence","Lake Ridge Academy","Loudonville","Mapleton","Medina Christian","Northwestern","Oberlin","Open Door Christian","Rittman","Smithville","St. Martin de Porres","Wellington"],
  "boys|4|MAD": ["Andrews Osborne","Badger","Bristol","Cardinal","Chalker","Fairport","Grand Valley","John F Kennedy (Warren)","LaBrae","Liberty","Maplewood","Mathews","McDonald","Mineral Ridge","Newton Falls","Richmond Hts","St. John","Valley Christian"],
  "girls|4|GO": ["Canton Central Catholic","Cardinal Mooney","Columbiana","David Anderson","East Canton","East Palestine","Heartland Christian","Jackson Milton","Lake Center Christian","Lowellville","Mogadore","Rootstown","Southern Local","Springfield","St. Thomas Aquinas","United","Waterloo","Western Reserve"],
  "girls|4|LCCC": ["Black River","Brooklyn","Central Christian","Clearview","Crestview","Cuyahoga Heights","Dalton","Hillsdale","Independence","Lake Ridge Academy","Loudonville","Mapleton","Medina Christian","Northwestern","Oberlin","Open Door Christian","Rittman","Smithville","Waynedale","Wellington"],
  "girls|4|MAD": ["Andrews Osborne","Badger","Bristol","Brookfield","Cardinal","Fairport","Grand Valley","John Adams","John F Kennedy (Warren)","Kirtland","LaBrae","Lordstown","Maplewood","Mathews","McDonald","Mineral Ridge","Newton Falls","Pymatuning Valley","Richmond Hts","St. John","Wickliffe","Valley Christian"]
};

function norm(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}
const STOPWORDS = new Set(["high", "school", "academy", "the", "st", "saint", "hs", "jr", "sr"]);
function wordSet(s) {
  return new Set(s.toLowerCase().replace(/[().]/g, " ").split(/[\s-]+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w)));
}
// Fuzzy match: true if either normalized string contains the other, or
// they share at least one real (non-stopword, 3+ letter) word -- enough
// to catch "Perry (Massillon)" vs "Mass. Perry" / "North (Akron)" vs
// "Ak. North" / "Austintown" vs "Austintown-Fitch" as the same school,
// without hiding a genuinely different school.
function fuzzyMatch(a, b) {
  const na = norm(a), nb = norm(b);
  if (na.includes(nb) || nb.includes(na)) return true;
  const wa = wordSet(a), wb = wordSet(b);
  for (const w of wa) if (wb.has(w)) return true;
  return false;
}

// Build our own roster's districtSiteKey entries per site/gender/division.
const ourTeams = new Map(); // key -> Set of normalized names
for (const cat of Object.values(candidate.categories)) {
  if (cat.division === "D1") continue;
  const divNum = Number(cat.division.replace("D", ""));
  const genderLower = cat.gender.toLowerCase();
  for (const team of cat.teams) {
    if (!team.districtSiteKey || !["GO", "LCCC", "MAD"].includes(team.districtSiteKey)) continue;
    const key = `${genderLower}|${divNum}|${team.districtSiteKey}`;
    if (!ourTeams.has(key)) ourTeams.set(key, new Map());
    ourTeams.get(key).set(norm(team.name), team.name);
  }
}

const missingFromOurData = [];
const notInPdf = [];
for (const [key, pdfNames] of Object.entries(PDF_TEAMS)) {
  const ourMap = ourTeams.get(key) || new Map();
  const ourNames = [...ourMap.values()];
  for (const name of pdfNames) {
    if (!ourNames.some((ourName) => fuzzyMatch(name, ourName))) missingFromOurData.push(`${key}: "${name}" (in PDF, not in our roster)`);
  }
  for (const ourName of ourNames) {
    if (!pdfNames.some((name) => fuzzyMatch(name, ourName))) notInPdf.push(`${key}: "${ourName}" (in our roster, not in PDF team list)`);
  }
}

console.log(`=== In PDF but missing from our roster (${missingFromOurData.length}) ===`);
console.log(missingFromOurData.join("\n"));
console.log(`\n=== In our roster but not in PDF team list (${notInPdf.length}) ===`);
console.log(notInPdf.join("\n"));
