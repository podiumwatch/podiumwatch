import fs from "node:fs/promises";

const schoolDataUrl = new URL(
  "../public/data/ohio-school-foundation-2026-27.json",
  import.meta.url
);

const trackDataUrl = new URL(
  "../src/data/track-regional-sites-2026.json",
  import.meta.url
);

let schoolDatasetPromise = null;
let trackDatasetPromise = null;

export function cleanText(value, maxLength = 1000) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

export function normalizeLookup(value) {
  return cleanText(value, 500)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bsaint\b/g, "st")
    .replace(/\bhigh school\b/g, "")
    .replace(/\bsenior\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeSchoolKey(name, city) {
  return [
    normalizeLookup(name),
    normalizeLookup(city)
  ]
    .filter(Boolean)
    .join("|");
}

export function slugifySchool(name, city, schoolId = "") {
  const base = [name, city]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "ohio-school";

  return schoolId
    ? `${base}-${String(schoolId).replace(/[^0-9a-z]/gi, "")}`
    : base;
}

export function displaySchoolName(value) {
  const original = cleanText(value, 200);

  if (!original) {
    return "";
  }

  const smallWords = new Set([
    "and",
    "of",
    "the",
    "at"
  ]);

  return original
    .split(/\s+/)
    .map((word, index) => {
      if (/^Mc[A-Z]+$/.test(word)) {
        return "Mc" +
          word.slice(2, 3).toUpperCase() +
          word.slice(3).toLowerCase();
      }

      if (/^[A-Z0-9'&.-]+$/.test(word)) {
        const lowered = word.toLowerCase();

        if (index > 0 && smallWords.has(lowered)) {
          return lowered;
        }

        if (lowered === "st") {
          return "St.";
        }

        return lowered
          .split("-")
          .map((part) =>
            part
              ? part.charAt(0).toUpperCase() + part.slice(1)
              : part
          )
          .join("-");
      }

      return word;
    })
    .join(" ")
    .replace(/\bHs\b/g, "HS")
    .replace(/\bJr\b/g, "Jr.")
    .replace(/\bSr\b/g, "Sr.");
}

export function divisionNumber(value) {
  const match = cleanText(value, 40).match(/\b(?:Division\s*)?([1-5IVX]+)\b/i);

  if (!match) {
    return null;
  }

  const token = match[1].toUpperCase();
  const roman = {
    I: 1,
    II: 2,
    III: 3,
    IV: 4,
    V: 5
  };

  return Number(token) || roman[token] || null;
}

export function canonicalDivision(value) {
  const number = divisionNumber(value);
  const roman = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
    5: "V"
  };

  return number && roman[number]
    ? `Division ${roman[number]}`
    : cleanText(value, 40) || null;
}

export function isMissingFoundationError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();

  return (
    code === "42P01" ||
    code === "42703" ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

export async function loadBundledSchoolDataset() {
  if (!schoolDatasetPromise) {
    schoolDatasetPromise = fs
      .readFile(schoolDataUrl, "utf8")
      .then((text) => JSON.parse(text));
  }

  return schoolDatasetPromise;
}

export async function loadBundledTrackDataset() {
  if (!trackDatasetPromise) {
    trackDatasetPromise = fs
      .readFile(trackDataUrl, "utf8")
      .then((text) => JSON.parse(text));
  }

  return trackDatasetPromise;
}

export function chunkRows(rows, size = 100) {
  const chunks = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}

export function summarizeSchoolDataset(dataset) {
  const schools = Array.isArray(dataset?.schools)
    ? dataset.schools
    : [];
  const divisions = {};
  const districts = {};
  let changedDivisionCount = 0;

  schools.forEach((school) => {
    const division = canonicalDivision(
      school.division_2026_27_2027_28
    ) || "Unknown";
    const district = cleanText(
      school.athletic_district,
      40
    ) || "Unknown";

    divisions[division] =
      (divisions[division] || 0) + 1;
    districts[district] =
      (districts[district] || 0) + 1;

    if (
      canonicalDivision(
        school.division_2026_27_2027_28
      ) !==
      canonicalDivision(
        school.division_2025_26
      )
    ) {
      changedDivisionCount += 1;
    }
  });

  return {
    schoolCount: schools.length,
    changedDivisionCount,
    divisions,
    districts
  };
}
