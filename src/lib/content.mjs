import fs from "node:fs/promises";
import path from "node:path";

export const REQUIRED_STORY_FIELDS = ["title", "date", "description", "category", "author"];

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function slugify(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^[0-9]{8}[_-]?/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function parseScalar(raw) {
  const value = raw.trim();
  if (value === "") return "";
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).replaceAll('\\"', '"').replaceAll("\\'", "'");
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (value.startsWith("[") && value.endsWith("]")) {
    return value.slice(1, -1).split(",").map((part) => parseScalar(part)).filter((part) => part !== "");
  }
  return value;
}

export function parseFrontMatter(source, filePath) {
  if (!source.startsWith("---")) {
    throw new Error(`Missing front matter in ${filePath}. The file must begin with three hyphen characters on the first line.`);
  }
  const end = source.indexOf("\n---", 3);
  if (end === -1) {
    throw new Error(`Front matter is not closed in ${filePath}. Add a second line containing three hyphen characters.`);
  }
  const rawMatter = source.slice(3, end).trim();
  const body = source.slice(end + 4).replace(/^\r?\n/, "");
  const data = {};
  let arrayKey = null;

  for (const originalLine of rawMatter.split(/\r?\n/)) {
    const line = originalLine.trimEnd();
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const listMatch = line.match(/^\s*-\s+(.+)$/);
    if (listMatch && arrayKey) {
      data[arrayKey].push(parseScalar(listMatch[1]));
      continue;
    }
    const match = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!match) {
      throw new Error(`Could not understand this front matter line in ${filePath}: ${line}`);
    }
    const [, key, rawValue] = match;
    if (rawValue.trim() === "") {
      data[key] = [];
      arrayKey = key;
    } else {
      data[key] = parseScalar(rawValue);
      arrayKey = null;
    }
  }
  return { data, body };
}

export function validateStory(data, filePath) {
  const missing = REQUIRED_STORY_FIELDS.filter((field) => data[field] === undefined || data[field] === null || String(data[field]).trim() === "");
  if (missing.length) {
    throw new Error(`Story validation failed for ${filePath}. Missing required field${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`);
  }
  const date = new Date(`${data.date}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Story validation failed for ${filePath}. The date field must use YYYY-MM-DD.`);
  }
  if (data.updatedDate) {
    const updated = new Date(`${data.updatedDate}T12:00:00`);
    if (Number.isNaN(updated.getTime())) {
      throw new Error(`Story validation failed for ${filePath}. The updatedDate field must use YYYY-MM-DD.`);
    }
  }
}

export async function listFiles(directory, extension) {
  const results = [];
  async function walk(current) {
    let entries = [];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      if (entry.isFile() && entry.name.toLowerCase().endsWith(extension)) results.push(full);
    }
  }
  await walk(directory);
  return results.sort();
}

export function countWords(markdown = "") {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[#>*_`|~-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function readingTime(markdown) {
  return Math.max(1, Math.ceil(countWords(markdown) / 220));
}

export function formatDate(dateString) {
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" })
    .format(new Date(`${dateString}T12:00:00`));
}

export function parseCsv(text, filePath) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows.shift().map((header) => header.trim());
  const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicates.length) throw new Error(`Duplicate CSV column in ${filePath}: ${duplicates[0]}`);
  return rows.map((cells, rowIndex) => {
    const record = {};
    headers.forEach((header, index) => { record[header] = (cells[index] ?? "").trim(); });
    record.__row = rowIndex + 2;
    return record;
  });
}

export async function copyDirectory(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) await copyDirectory(from, to);
    else await fs.copyFile(from, to);
  }
}
