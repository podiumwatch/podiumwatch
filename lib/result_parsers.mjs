import crypto from "node:crypto";
import { load } from "cheerio";
import readXlsxFile from "read-excel-file/node";

const STATUS = /^(?:DQ|DNF|DNS|SCR|NM|NT)$/i;
const MARK = /^(?:(?:\d{1,2}:)?\d{1,2}\.\d{1,3}|\d{1,2}['\u2032]\s*\d{1,2}(?:\.\d+)?["\u2033]?|\d+(?:\.\d+)?(?:m|cm|ft|in)?)$/i;
const EVENT = /\b(5k(?:m)?|5000|3200|3000|1600|1500|800|400|300|200|100|60|hurdles?|relay|high jump|long jump|triple jump|pole vault|shot put|discus|hammer|javelin|cross country)\b/i;
const HEADER = /\b(place|pl|rank)\b.*\b(name|athlete|runner|team|school)\b.*\b(time|mark|result|performance)\b/i;

function clean(value, max = 12000) {
  return String(value ?? "").replace(/\u00a0/g, " ").replace(/[\t ]+/g, " ").trim().slice(0, max);
}
function normalized(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function digest(value) { return crypto.createHash("sha256").update(String(value)).digest("hex"); }
function number(value) { const match = String(value ?? "").match(/-?\d+(?:\.\d+)?/); return match ? Number(match[0]) : null; }
function grade(value) {
  const token = clean(value).toUpperCase();
  const labels = { FR: "9", SO: "10", JR: "11", SR: "12", FRESHMAN: "9", SOPHOMORE: "10", JUNIOR: "11", SENIOR: "12" };
  return labels[token] || (/^(?:[6-9]|1[0-2])$/.test(token) ? token : null);
}
function parseMark(value) {
  const text = clean(value);
  if (STATUS.test(text)) return { text, value: null, status: text.toUpperCase() };
  const clock = text.match(/^(?:(\d+):)?(\d{1,2})(?:\.(\d+))?$/);
  if (clock) return { text, value: Number(clock[1] || 0) * 60 + Number(clock[2]) + Number(`0.${clock[3] || 0}`), status: "official" };
  const imperial = text.match(/^(\d{1,3})(?:\s*[-'\u2032]\s*)(\d{1,2}(?:\.\d+)?)(?:["\u2033])?$/);
  if (imperial) return { text, value: (Number(imperial[1]) * 12 + Number(imperial[2])) * 0.0254, status: "official" };
  const metric = text.match(/^(-?\d+(?:\.\d+)?)\s*(m|cm|ft|in)?$/i);
  if (!metric) return { text, value: null, status: "official" };
  const amount = Number(metric[1]); const unit = String(metric[2] || "").toLowerCase();
  const normalizedValue = unit === "cm" ? amount / 100 : unit === "ft" ? amount * 0.3048 : unit === "in" ? amount * 0.0254 : amount;
  return { text, value: normalizedValue, status: "official" };
}
function inferGender(text, fallback) {
  if (/\b(girls?|women|female)\b/i.test(text)) return "girls";
  if (/\b(boys?|men|male)\b/i.test(text)) return "boys";
  return fallback || null;
}
function inferLevel(text, fallback) {
  if (/\bmiddle school|junior high|\bms\b|\bjh\b/i.test(text)) return "middle_school";
  if (/\bjunior varsity|\bjv\b/i.test(text)) return "junior_varsity";
  if (/\bhigh school|varsity|\bhs\b/i.test(text)) return "high_school";
  if (/\bopen\b/i.test(text)) return "open";
  return fallback || null;
}
function inferEvent(text, fallback) {
  const source = clean(text); const phrase = source.match(/\b(?:\d{2,4}\s*(?:meter|metre|m)?\s*hurdles?|(?:4\s*[xX]\s*)?\d{2,4}\s*(?:meter|metre|m)?\s*relay|high jump|long jump|triple jump|pole vault|shot put|discus|hammer|javelin|cross country|5k(?:m)?(?:\s+run)?)\b/i); const match = phrase || source.match(EVENT);
  if (!match) return fallback || null;
  return /^5km?(?:\s+run)?$/i.test(match[0]) ? "5K" : match[0];
}
function eventCode(value, sport) {
  const text = normalized(value);
  const isCrossCountry = sport === "cross_country" || /cross country|\bxc\b/.test(text);
  const aliases = [
    [/\b5k\b|\b5000\b/, isCrossCountry ? "xc_5k" : "track_5000"],
    [/\b2 mile\b/, isCrossCountry ? "xc_2_mile" : "track_2_mile"],
    [/\b3200\b/, isCrossCountry ? "xc_3200" : "track_3200"],
    [/\b3k\b|\b3000\b/, isCrossCountry ? "xc_3k" : "track_3000"],
    [/\b110\b.*hurd|hurd.*\b110\b/,"hurdles_110"],[/\b100\b.*hurd|hurd.*\b100\b/,"hurdles_100"],[/\b60\b.*hurd|hurd.*\b60\b/,"hurdles_60"],[/\b300\b.*hurd|hurd.*\b300\b/,"hurdles_300"],[/\b400\b.*hurd|hurd.*\b400\b/,"hurdles_400"],
    [/\b1600\b/,"track_1600"],[/\b1500\b/,"track_1500"],[/\b800\b/,"track_800"],[/\b600\b/,"track_600"],[/\b500\b/,"track_500"],[/\b400\b/,"track_400"],[/\b300\b/,"track_300"],[/\b200\b/,"track_200"],[/\b100\b/,"track_100"],[/\b60\b/,"track_60"],
    [/high jump/,"high_jump"],[/long jump/,"long_jump"],[/triple jump/,"triple_jump"],[/pole vault/,"pole_vault"],[/shot put/,"shot_put"],[/discus/,"discus"],[/hammer/,"hammer"],[/javelin/,"javelin"],[/relay/,"relay"]
  ];
  return aliases.find(([pattern]) => pattern.test(text))?.[1] || text.replace(/ /g, "_") || null;
}

function normalizeDate(value) {
  const text = clean(value);
  if (!text) return null;
  const iso = text.match(/^(20\d{2})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const us = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](20\d{2})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}
function rowContract(row, context, rowNumber) {
  row = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalized(key).replace(/ /g, "_"), value]));
  const athleteName = clean(row.athleteName || row.athlete_name || row.athlete || row.name || row.runner) || null;
  const relayTeam = clean(row.relayTeam || row.relay_team || row.relay) || null;
  const schoolName = clean(row.schoolName || row.school_name || row.school_team || row.school || row.team) || null;
  const eventName = clean(row.eventName || row.event_name || row.event || row.race || context.eventName) || null;
  const mark = parseMark(row.markText || row.mark_text || row.result_time || row.mark_result || row.mark || row.time || row.result || row.performance || row.status || "");
  const place = number(row.place ?? row.pl ?? row.rank);
  const rawText = clean(row.rawText || row.rawtext || row.raw_text || JSON.stringify(row), 50000);
  const warnings = [];
  if (!athleteName && !relayTeam) warnings.push("ATHLETE_OR_RELAY_MISSING");
  if (!schoolName && !relayTeam) warnings.push("SCHOOL_MISSING");
  if (!eventName) warnings.push("EVENT_MISSING");
  if (!mark.text) warnings.push("MARK_MISSING");
  const meetName = clean(row.meetName || row.meet_name || context.meetName) || null;
  const meetDate = normalizeDate(row.meetDate || row.meet_date || row.date || context.meetDate);
  const sport = clean(row.sport || context.sport) || null;
  const identity = [meetName, meetDate, eventName, athleteName || relayTeam, schoolName, mark.text, place].map(normalized).join("|");
  return {
    rowNumber, meetName, meetDate, meetLocation: clean(row.meetLocation || row.meet_location || row.location || context.meetLocation) || null,
    sport, seasonYear: number(row.seasonYear || row.season_year || row.year || context.seasonYear),
    competitionLevel: inferLevel(row.competitionLevel || row.level || rawText, context.competitionLevel), gender: inferGender(row.gender || row.sex || rawText, context.gender),
    division: clean(row.division || context.division) || null, eventName, eventCode: eventCode(eventName, sport), distanceMeters: number(row.distanceMeters || row.distance_meters),
    heat: clean(row.heat) || null, flight: clean(row.flight) || null, round: clean(row.round || row.section) || null,
    athleteName, athleteGrade: grade(row.athleteGrade || row.athlete_grade || row.grade), schoolName, relayTeam,
    relayMembers: Array.isArray(row.relayMembers) ? row.relayMembers : [], place, markText: mark.text || null, markValue: mark.value,
    points: number(row.points || row.pts), windText: clean(row.wind || row.wind_text) || null, resultStatus: mark.status,
    parserConfidence: Math.max(5, 98 - warnings.length * 24), matchConfidence: 0, warningCodes: warnings, rawRow: { ...row, rawText },
    sourceFingerprint: digest(rawText), resultFingerprint: digest(identity)
  };
}

function splitDelimitedLine(line, delimiter) {
  const cells = []; let value = "", quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { cells.push(clean(value)); value = ""; }
    else value += char;
  }
  cells.push(clean(value)); return cells;
}
function normalizedHeaders(values) { return values.map((value, index) => normalized(value).replace(/ /g, "_") || `column_${index + 1}`); }
function delimitedRows(text) {
  const lines = String(text).replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const counts = [[",", (lines[0].match(/,/g) || []).length],["\t", (lines[0].match(/\t/g) || []).length],[";", (lines[0].match(/;/g) || []).length]];
  const delimiter = counts.sort((a,b) => b[1] - a[1])[0][0]; const headers = normalizedHeaders(splitDelimitedLine(lines[0], delimiter));
  return lines.slice(1).map((line, index) => Object.fromEntries(headers.map((header, cell) => [header, splitDelimitedLine(line, delimiter)[cell] || ""]).concat([["_row_number", index + 2]])));
}
function tableRows(html) {
  const $ = load(String(html || "")); const output = [];
  $("table").each((tableIndex, table) => {
    const rows = $(table).find("tr").toArray().map((tr) => $(tr).find("th,td").toArray().map((cell) => clean($(cell).text()))).filter((cells) => cells.length >= 3);
    if (rows.length < 2) return;
    const headerIndex = rows.findIndex((cells) => HEADER.test(cells.join(" ")));
    if (headerIndex < 0) return;
    const headers = normalizedHeaders(rows[headerIndex]);
    const heading = clean($(table).prevAll("h1,h2,h3,h4,h5,h6,caption").first().text() || $(table).find("caption").first().text());
    const tableContext = { eventName: inferEvent(heading), gender: inferGender(heading), competitionLevel: inferLevel(heading) };
    rows.slice(headerIndex + 1).forEach((cells, offset) => {
      if (HEADER.test(cells.join(" ")) || cells.every((cell) => !cell)) return;
      output.push({ ...Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]).concat([["_row_number", `${tableIndex + 1}.${headerIndex + offset + 2}`]])), _context: tableContext });
    });
  });
  return output;
}
function textRows(text, initial = {}) {
  const lines = String(text).replace(/\r/g, "").split("\n").map((line) => line.replace(/\u00a0/g, " ").replace(/\s+$/, "")).filter((line) => line.trim());
  const output = []; let context = { ...initial }; let headers = null; let fixedColumns = null; let inTeamScores = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    // A Team Scores table (rank, team name, total, and each scoring
    // runner's place) follows a HY-TEK individual results table on the
    // same page or the next one. Its rows -- for example "1 Old Fort  21
    // 1 2 5 6 7" -- otherwise satisfy the generic place/name/mark row
    // pattern below and get staged as fake individual results (found
    // 2026-08-05 in a real Baumspage results PDF). A new Event heading
    // always starts the next race's own results, so it ends any team
    // scores section already in progress.
    if (EVENT.test(line) && line.length < 150) { inTeamScores = false; context = { ...context, eventName: inferEvent(line, context.eventName), gender: inferGender(line, context.gender), competitionLevel: inferLevel(line, context.competitionLevel) }; }
    if (/\bteam\s+scores\b/i.test(line)) { inTeamScores = true; headers = null; fixedColumns = null; continue; }
    if (inTeamScores) continue;
    if (/\bName\b.*\b(?:Year|Yr|Grade)\b.*\b(?:School|Team)\b.*\b(?:Finals?|Time|Mark)\b/i.test(line)) {
      const lower = line.toLowerCase();
      const locate = (pattern) => { const match = pattern.exec(lower); return match ? match.index : -1; };
      fixedColumns = { name: locate(/\bname\b/), grade: locate(/\b(?:year|yr|grade)\b/), school: locate(/\b(?:school|team)\b/), mark: locate(/\b(?:finals?|time|mark)\b/), points: locate(/\b(?:points?|pts)\b/) };
      headers = null;
      continue;
    }
    if (HEADER.test(line)) { headers = normalizedHeaders(line.split(/\s{2,}|\t+/)); continue; }
    if (fixedColumns) {
      const minimumWidth = Math.max(fixedColumns.name, fixedColumns.grade, fixedColumns.school, fixedColumns.mark) + 4;
      if (/^\s*\d{1,4}\s+/.test(line) && line.length >= minimumWidth) {
        let place = clean(line.slice(0, fixedColumns.name));
        let athlete = clean(line.slice(fixedColumns.name, fixedColumns.grade));
        if (!place) {
          const combined = athlete.match(/^(\d{1,4})[.)]?\s+(.+)$/);
          if (combined) { place = combined[1]; athlete = combined[2]; }
        }
        const resultTail = line.slice(fixedColumns.grade).match(/^\s*(?:(\d{1,2}|FR|SO|JR|SR)\s+)?(.+?)\s+((?:(?:\d{1,2}:)?\d{1,2}\.\d{1,3})|(?:\d{1,3}\s*[-'\u2032]\s*\d{1,2}(?:\.\d+)?)|(?:-?\d+(?:\.\d+)?(?:m|cm|ft|in)?)|DQ|DNF|DNS|SCR|NM|NT)(?:\s+(\d+(?:\.\d+)?))?\s*$/i);
        const athleteGrade = clean(resultTail?.[1]);
        const school = clean(resultTail?.[2]);
        const mark = clean(resultTail?.[3]);
        const points = clean(resultTail?.[4]);
        if (athlete && school && (MARK.test(mark) || STATUS.test(mark))) {
          output.push({ place, athlete_name: athlete, athlete_grade: athleteGrade, school_name: school, mark_text: mark, points, _row_number: index + 1, _context: { ...context }, rawText: line });
          continue;
        }
      }
      if (/^(?:=+|-+|\s*$)/.test(line)) continue;
    }
    if (headers) {
      const cells = line.split(/\s{2,}|\t+/).map((value) => clean(value));
      if (cells.length >= Math.min(3, headers.length)) { output.push({ ...Object.fromEntries(headers.map((header, cell) => [header, cells[cell] || ""])), _row_number: index + 1, _context: { ...context }, rawText: line }); continue; }
    }
    const match = line.match(/^\s*(\d{1,4})[.)]?\s+(.+?)\s{2,}(.+?)\s{2,}((?:(?:\d{1,2}:)?\d{1,2}\.\d{1,3})|DQ|DNF|DNS|SCR|NM|NT)(?:\s+([+\-]?\d+(?:\.\d+)?))?$/i);
    if (match) output.push({ place: match[1], athlete_name: match[2], school_name: match[3], mark_text: match[4], wind: match[5], _row_number: index + 1, _context: { ...context }, rawText: line });
  }
  return output;
}
function metadataFromHtml(html, fallback = {}) {
  const $ = load(String(html || "")); const title = clean($("h1").first().text() || $("title").text()); const body = clean($("body").text(), 100000);
  const date = body.match(/\b(20\d{2}[-\/]\d{1,2}[-\/]\d{1,2}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+20\d{2})\b/i)?.[1];
  return { ...fallback, meetName: fallback.meetName || title || null, meetDate: normalizeDate(fallback.meetDate || date), gender: inferGender(title, fallback.gender), competitionLevel: inferLevel(title, fallback.competitionLevel), eventName: inferEvent(title, fallback.eventName) };
}
// A page's typical single-character width, estimated from its own longer
// text runs (3+ characters, to avoid noise from single-glyph items like a
// lone space or place number) so pixel positions can be converted to a
// column number consistently for this specific PDF's font and size.
function estimateCharWidth(items) {
  const samples = items
    .filter((item) => item.str.trim().length >= 3 && item.width)
    .map((item) => item.width / item.str.length)
    .sort((a, b) => a - b);
  if (!samples.length) return 6;
  return samples[Math.floor(samples.length / 2)];
}

// Joins a page's positioned text items into lines, padding each item out to
// the character column its real pixel x-coordinate corresponds to (rather
// than just inserting one space per item boundary). This matters because
// the same physical column position always lands at the same character
// column across every line -- header and data alike -- which is exactly
// what the fixed-column result parser below depends on. Without this, two
// items that are simply two separate PDF text runs (for example a name
// split across a kerning-driven run boundary) get an arbitrary,
// content-length-dependent number of spaces inserted between them,
// corrupting name and school columns in real HY-TEK PDF exports (found
// importing a real Baumspage meet result PDF, 2026-08-05).
async function pdfText(bytes) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: new Uint8Array(bytes), useWorkerFetch: false, isEvalSupported: false }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber); const content = await page.getTextContent();
    const charWidth = Math.max(1, estimateCharWidth(content.items));
    let line = "", lastY = null, cursor = 0; const lines = [];
    for (const item of content.items) {
      const y = Math.round(item.transform?.[5] || 0);
      const x = item.transform?.[4] || 0;
      if (lastY !== null && Math.abs(y - lastY) > 2) { if (line.trim()) lines.push(line); line = ""; cursor = 0; }
      const targetColumn = Math.max(cursor, Math.round(x / charWidth));
      if (targetColumn > line.length) line += " ".repeat(targetColumn - line.length);
      line += item.str;
      cursor = line.length;
      lastY = y;
    }
    if (line.trim()) lines.push(line); pages.push(lines.join("\n"));
  }
  return pages.join("\n\n");
}

export async function extractDocument({ bytes, text, documentType, metadata = {} }) {
  let body = text == null ? "" : String(text); let records = []; let warnings = [];
  if (documentType === "spreadsheet") {
    const sheets = await readXlsxFile(bytes);
    for (const sheet of sheets) {
      const values = sheet.data;
      const headerIndex = values.findIndex((row) => HEADER.test(row.map((cell) => clean(cell)).join(" ")) || row.filter((cell) => clean(cell)).length >= 3);
      if (headerIndex < 0) continue;
      const headers = normalizedHeaders(values[headerIndex]);
      for (let index = headerIndex + 1; index < values.length; index += 1) {
        const cells = values[index].map((cell) => clean(cell));
        if (!cells.some(Boolean) || HEADER.test(cells.join(" "))) continue;
        records.push({ ...Object.fromEntries(headers.map((header, cell) => [header, cells[cell] || ""])), _sheet: sheet.sheet, _row_number: index + 1 });
      }
    }
  } else if (documentType === "pdf") {
    body = await pdfText(bytes);
    if (body.replace(/\s/g, "").length < 80) warnings.push("SCANNED_PDF_OCR_REQUIRED");
    records = textRows(body, metadata);
  } else if (documentType === "html") {
    const context = metadataFromHtml(body, metadata); records = tableRows(body);
    const $ = load(body); $("pre").each((_, node) => { const heading = clean($(node).prevAll("h1,h2,h3,h4,h5,h6").first().text()); records.push(...textRows($(node).text(), { ...context, eventName: inferEvent(heading, context.eventName), gender: inferGender(heading, context.gender), competitionLevel: inferLevel(heading, context.competitionLevel) })); });
    if (!records.length) records = textRows($.text(), context);
    metadata = context;
  } else if (documentType === "csv") records = delimitedRows(body);
  else records = textRows(body, metadata);
  const parsedRows = records.map((record, index) => rowContract(record, { ...metadata, ...(record._context || {}) }, record._row_number || index + 1));
  const uniqueParsed = [...new Map(parsedRows.map((row) => [row.resultFingerprint, row])).values()];
  const rows = uniqueParsed.filter(isCompleteResultRow);
  const rejectedRows = uniqueParsed.filter((row) => !isCompleteResultRow(row));
  if (!rows.length) warnings.push("NO_RESULT_ROWS_PARSED");
  if (rejectedRows.length) warnings.push("INCOMPLETE_ROWS_REJECTED");
  if (!rows.length && rejectedRows.length) warnings.push("NO_COMPLETE_RESULT_ROWS");
  return { text: body, rows, rejectedRows, warnings: [...new Set(warnings)], metadata };
}

export function isCompleteResultRow(row) {
  if (!row || (!row.athleteName && !row.relayTeam)) return false;
  if (!row.schoolName && !row.relayTeam) return false;
  if (!row.eventName || !row.eventCode || !row.markText) return false;
  if (row.warningCodes?.some((code) => ["ATHLETE_OR_RELAY_MISSING", "SCHOOL_MISSING", "EVENT_MISSING", "MARK_MISSING"].includes(code))) return false;
  return STATUS.test(row.markText) || row.markValue !== null;
}

export function parsePastedOrDelimitedText(text, metadata = {}) {
  const likelyDelimited = /,/.test(String(text).split(/\r?\n/)[0] || "") && HEADER.test(String(text).split(/\r?\n/)[0] || "");
  const records = likelyDelimited ? delimitedRows(text) : textRows(text, metadata);
  return records.map((row, index) => rowContract(row, { ...metadata, ...(row._context || {}) }, row._row_number || index + 1)).filter(isCompleteResultRow);
}

export const parserInternals = { clean, normalized, eventCode, parseMark, normalizeDate, delimitedRows, tableRows, textRows, metadataFromHtml };
