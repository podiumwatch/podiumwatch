// Usage: node --env-file=<.env.local> scripts/oatccc-site-preview/upload.mjs <repo> <copy folder> <manifest out>
// Uploads the site preview folder to the private bucket oatccc-review under
// site-preview/. New objects only (no overwrite). The bucket accepts only
// text/html uploads; the review handler sets the real type from the file
// extension, so every object is stored as text/html with its bytes as is.
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const [, , REPO, DIR, MANIFEST] = process.argv;
const { createClient } = createRequire(path.join(REPO, "package.json"))("@supabase/supabase-js");
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const files = []; const walk = (d, rel = "") => { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name), rel + e.name + "/") : files.push(rel + e.name); };
walk(DIR);
const done = [], failed = [];
for (let i = 0; i < files.length; i += 8) {
  await Promise.all(files.slice(i, i + 8).map(async (f) => {
    const object = "site-preview/" + f;
    const { error } = await db.storage.from("oatccc-review").upload(object, fs.readFileSync(path.join(DIR, f)), { contentType: "text/html", upsert: false, cacheControl: "0" });
    if (error) failed.push(f + ": " + error.message); else done.push(object);
  }));
}
fs.writeFileSync(MANIFEST, done.sort().join("\n") + "\n");
console.log(JSON.stringify({ files: files.length, uploaded: done.length, failed: failed.slice(0, 10), failedCount: failed.length }));
