// Zero-dependency .xlsx reader (zip + SpreadsheetML). Read-only.
import fs from "node:fs";
import zlib from "node:zlib";

export function readZip(file) {
  const buf = fs.readFileSync(file);
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd -= 1;
  if (eocd < 0) throw new Error("not a zip");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = {};
  for (let i = 0; i < count; i += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad central dir");
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nlen);
    const lnlen = buf.readUInt16LE(off + 26), lelen = buf.readUInt16LE(off + 28);
    const start = off + 30 + lnlen + lelen;
    const data = buf.subarray(start, start + csize);
    entries[name] = method === 8 ? zlib.inflateRawSync(data) : method === 0 ? data : (() => { throw new Error(`zip method ${method}`); })();
    p += 46 + nlen + elen + clen;
  }
  return entries;
}

function decodeXml(s) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&");
}
function colIndex(ref) {
  const letters = ref.replace(/\d+$/, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function readWorkbook(file) {
  const z = readZip(file);
  const wb = z["xl/workbook.xml"].toString("utf8");
  const rels = z["xl/_rels/workbook.xml.rels"].toString("utf8");
  const relMap = {};
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /Id="([^"]+)"/.exec(m[0])[1];
    const target = /Target="([^"]+)"/.exec(m[0])[1];
    relMap[id] = target.replace(/^\/?xl\//, "").replace(/^\//, "");
  }
  const shared = [];
  if (z["xl/sharedStrings.xml"]) {
    const ss = z["xl/sharedStrings.xml"].toString("utf8");
    for (const si of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      shared.push(decodeXml([...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
    }
  }
  const sheets = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = decodeXml(/name="([^"]+)"/.exec(m[0])[1]);
    const rid = /r:id="([^"]+)"/.exec(m[0])[1];
    const xml = z[`xl/${relMap[rid]}`].toString("utf8");
    const rows = [];
    for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = [];
      for (const c of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1];
        const ref = /r="([A-Z]+\d+)"/.exec(attrs)[1];
        const type = (/t="([^"]+)"/.exec(attrs) || [])[1];
        const inner = c[2] || "";
        let value = "";
        if (type === "s") value = shared[Number(/<v>([^<]*)<\/v>/.exec(inner)[1])];
        else if (type === "inlineStr") value = decodeXml([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""));
        else { const v = /<v>([^<]*)<\/v>/.exec(inner); value = v ? decodeXml(v[1]) : ""; }
        cells[colIndex(ref)] = value;
      }
      rows.push(cells);
    }
    sheets.push({ name, rows });
  }
  return { sheets };
}

export function sheetRecords(sheet) {
  const [header, ...body] = sheet.rows;
  const headers = (header || []).map((h) => String(h ?? "").trim());
  return body.filter((r) => r && r.some((v) => String(v ?? "").trim() !== "")).map((r) => {
    const rec = {};
    headers.forEach((h, i) => { if (h) rec[h] = r[i] ?? ""; });
    return rec;
  });
}

