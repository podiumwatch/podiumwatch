// Copies the oatccc.com files and images the crawl found into the Supabase
// Storage bucket "oatccc-public" (Zachary approved, 2026-11-17, as long as
// the total is under 1 GB). Each file keeps its oatccc.com path as its
// Storage key (Media/Longevity-Form.pdf), so links can be rewritten
// without a lookup (src/oatccc/more/links.mjs, OATCCC_FILES_HOSTED).
//
//   node --env-file=<path to .env.local> scripts/oatccc-upload-files.mjs [--dry-run]
//
// Uses the server secret key on this machine only. Creates the bucket
// (public read) if it does not exist. Never overwrites a file already in
// the bucket; safe to run again (it skips what is there). Writes
// _private/oatccc-crawl/upload-manifest.json: old URL, Storage key, public
// URL, bytes, status (git ignores it).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CRAWL = path.join(ROOT, "_private", "oatccc-crawl");
const BUCKET = "oatccc-public";
const LIMIT_BYTES = 1024 * 1024 * 1024;
const UA = "Mozilla/5.0 (compatible; site-move-crawler/1.0)";
const dryRun = process.argv.includes("--dry-run");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const files = JSON.parse(fs.readFileSync(path.join(CRAWL, "files.json"), "utf8"));
// Not copied: sponsor logos (sponsors are text links only) and oatccc.com's
// page-banner backgrounds (our layout has its own).
const skip = (f) => /^\/Portal\/Admin\/Sponsors\//i.test(f.path) || f.type === "background";
const usable = files.filter((f) => f.status >= 200 && f.status < 300 && !skip(f));
console.log(`Skipped (sponsor logos, page banners): ${files.filter(skip).length}.`);
const total = usable.reduce((sum, f) => sum + (f.bytes || 0), 0);
console.log(`Files: ${files.length}; readable: ${usable.length}; total ${(total / 1048576).toFixed(1)} MB.`);
if (total >= LIMIT_BYTES) {
  console.log("Over 1 GB: not copying (Zachary's rule). See the report.");
  process.exit(0);
}
if (dryRun) process.exit(0);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) { console.error("SUPABASE_URL and SUPABASE_SECRET_KEY are needed (use --env-file)."); process.exit(1); }
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: buckets, error: listError } = await supabase.storage.listBuckets();
if (listError) { console.error(`Could not list buckets: ${listError.message}`); process.exit(1); }
if (!buckets.some((b) => b.name === BUCKET)) {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error) { console.error(`Could not create bucket ${BUCKET}: ${error.message}`); process.exit(1); }
  console.log(`Created public bucket ${BUCKET}.`);
}

const manifestFile = path.join(CRAWL, "upload-manifest.json");
const previous = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : { files: [] };
const done = new Map(previous.files.filter((f) => f.status === "uploaded" || f.status === "already there").map((f) => [f.oldUrl, f]));
const out = [];
let uploaded = 0;
let failed = 0;
for (const [i, f] of usable.entries()) {
  const storageKey = decodeURI(f.path).replace(/^\/+/, "");
  const publicUrl = `${url.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET}/${encodeURI(storageKey)}`;
  if (done.has(f.url)) { out.push(done.get(f.url)); continue; }
  try {
    const res = await fetch(f.url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`download ${res.status}`);
    const body = Buffer.from(await res.arrayBuffer());
    const contentType = (res.headers.get("content-type") || f.contentType || "application/octet-stream").split(";")[0];
    const { error } = await supabase.storage.from(BUCKET).upload(storageKey, body, { contentType, upsert: false, cacheControl: "31536000" });
    if (error && !/exists|Duplicate/i.test(error.message)) throw new Error(error.message);
    out.push({ oldUrl: f.url, key: storageKey, publicUrl, bytes: body.length, contentType, status: error ? "already there" : "uploaded" });
    uploaded++;
  } catch (error) {
    out.push({ oldUrl: f.url, key: storageKey, publicUrl: null, bytes: f.bytes, status: "failed", error: String(error?.message || error) });
    failed++;
  }
  if ((i + 1) % 50 === 0) { console.log(`${i + 1}/${usable.length}`); fs.writeFileSync(manifestFile, JSON.stringify({ bucket: BUCKET, updatedAt: new Date().toISOString(), files: out }, null, 1)); }
  await sleep(250);
}
fs.writeFileSync(manifestFile, JSON.stringify({ bucket: BUCKET, updatedAt: new Date().toISOString(), files: out }, null, 1));
console.log(`Uploaded or already there: ${out.filter((f) => f.status !== "failed").length}. Failed: ${failed}. New this run: ${uploaded}.`);
