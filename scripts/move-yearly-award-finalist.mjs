// Move one Coach/Team/Athlete of the Year finalist, with their nominations
// and votes, to another category of the same award and gender (used once,
// 2026-11-10: Mike Hoehn, Dublin Scioto girls, Division II -> Division I,
// because Dublin Scioto girls ran Division I in 2026).
//
//   node --env-file=.env.local scripts/move-yearly-award-finalist.mjs <from-slug> <to-slug> <nominee-key> [--backup file.json] [--apply]
//
// Without --apply it only reports what would move. With --apply:
//   database: the finalist row and every nomination for that nominee move
//     to the new category (finalist placed last in the list);
//   Redis (yoty2026:*): each counted ballot for the nominee moves with its
//     network record and hourly tally; voided ballots move too, so the
//     record stays whole; live counts drop in the old category and rise in
//     the new one by the counted ballots; one-hour cooldowns in the old
//     category that point at this nominee are cleared, so those voters can
//     vote again there.
// --backup writes every Redis entry it reads before changing anything.
import fs from "node:fs";
import { supabaseAdmin as db } from "../lib/supabase-admin.mjs";
import { redisAdmin as redis } from "../lib/redis-admin.mjs";

const [fromSlug, toSlug, nomineeKey] = process.argv.slice(2);
const APPLY = process.argv.includes("--apply");
const backupAt = process.argv.indexOf("--backup");
if (!fromSlug || !toSlug || !nomineeKey) throw new Error("Usage: <from-slug> <to-slug> <nominee-key> [--backup file] [--apply]");

const keys = (slug) => ({ ballots: `yoty2026:ballots:${slug}`, ballotIp: `yoty2026:ballotip:${slug}`, ip: `yoty2026:ip:${slug}`, void: `yoty2026:void:${slug}`, hourly: `yoty2026:hourly:${slug}`, ipHourly: `yoty2026:iphourly:${slug}`, count: `yoty2026:count:${slug}` });
const TTL = 60 * 60 * 24 * 120;

const { data: cats, error: catError } = await db.from("yearly_award_categories").select("id, slug, award, gender, label, results_published_at").in("slug", [fromSlug, toSlug]);
if (catError) throw catError;
const from = cats.find((c) => c.slug === fromSlug);
const to = cats.find((c) => c.slug === toSlug);
if (!from || !to) throw new Error("Category not found.");
if (from.award !== to.award || from.gender !== to.gender) throw new Error("Both categories must be the same award and gender.");
if (from.results_published_at || to.results_published_at) throw new Error("Results are already published in one of these categories.");

const [{ data: finalist }, { data: toFinalists }, { data: nominations }] = await Promise.all([
  db.from("yearly_award_finalists").select("id, display_name, school, nominee_key, sort_order").eq("category_id", from.id).eq("nominee_key", nomineeKey).maybeSingle(),
  db.from("yearly_award_finalists").select("id, nominee_key, sort_order").eq("category_id", to.id),
  db.from("yearly_award_nominations").select("id").eq("category_id", from.id).eq("nominee_key", nomineeKey)
]);
if (toFinalists.some((f) => f.nominee_key === nomineeKey)) throw new Error("Already a finalist in the new category.");

const f = keys(fromSlug), t = keys(toSlug);
const [ballots, ballotIp, hourly, ipHourly, voided, counts] = await Promise.all([f.ballots, f.ballotIp, f.hourly, f.ipHourly, f.void, f.count].map((key) => redis.hgetall(key).then((v) => v || {})));
const mine = Object.entries(ballots).filter(([, value]) => String(value) === nomineeKey).map(([ballot]) => ballot);
const myVoided = Object.entries(voided).filter(([, value]) => { try { return (typeof value === "string" ? JSON.parse(value) : value).finalist === nomineeKey; } catch { return false; } }).map(([ballot]) => ballot);
const myHourly = Object.entries(hourly).filter(([field]) => field.endsWith(`|${nomineeKey}`));
// Cooldowns in the old category pointing at this nominee.
const cool = [];
let cursor = "0";
do {
  const [next, found] = await redis.scan(cursor, { match: `yoty2026:cool:${fromSlug}:*`, count: 500 });
  cursor = String(next);
  for (const key of found) if (String(await redis.get(key)) === nomineeKey) cool.push(key);
} while (cursor !== "0");

console.log(`${finalist ? `Finalist: ${finalist.display_name} (${finalist.school})` : "No finalist row"} | ${from.label} -> ${to.label}`);
console.log(`Nominations: ${nominations.length} | counted ballots: ${mine.length} (live count shows ${counts[nomineeKey] ?? 0}) | voided ballots: ${myVoided.length} | hourly fields: ${myHourly.length} | cooldowns to clear: ${cool.length}`);

if (backupAt > 0) {
  fs.writeFileSync(process.argv[backupAt + 1], JSON.stringify({ at: new Date().toISOString(), fromSlug, toSlug, nomineeKey, finalist, nominations, ballots: Object.fromEntries(mine.map((b) => [b, ballots[b]])), ballotIp: Object.fromEntries(mine.map((b) => [b, ballotIp[b] ?? null])), voided: Object.fromEntries(myVoided.map((b) => [b, voided[b]])), hourly: Object.fromEntries(myHourly), count: counts[nomineeKey] ?? null, cool }, null, 2));
  console.log(`Backup written: ${process.argv[backupAt + 1]}`);
}
if (!APPLY) { console.log("Dry run. Add --apply to move."); process.exit(0); }
if (!finalist) throw new Error("No finalist row to move.");

// Database first; if Redis fails after this, rerunning moves the votes.
const sortOrder = toFinalists.length ? Math.max(...toFinalists.map((x) => x.sort_order)) + 1 : 0;
const { error: fe } = await db.from("yearly_award_finalists").update({ category_id: to.id, sort_order: sortOrder }).eq("id", finalist.id);
if (fe) throw fe;
if (nominations.length) {
  const { error: ne } = await db.from("yearly_award_nominations").update({ category_id: to.id }).in("id", nominations.map((n) => n.id));
  if (ne) throw ne;
}

const p = redis.pipeline();
const hourOfBallot = (ballot) => new Date(Number(ballot.split(":")[1])).toISOString().slice(0, 13);
for (const ballot of mine) {
  const ip = ballotIp[ballot];
  p.hset(t.ballots, { [ballot]: nomineeKey });
  p.hdel(f.ballots, ballot);
  if (ip) {
    p.hset(t.ballotIp, { [ballot]: ip });
    p.hdel(f.ballotIp, ballot);
    p.hincrby(f.ip, ip, -1);
    p.hincrby(t.ip, ip, 1);
    p.hincrby(f.ipHourly, `${hourOfBallot(ballot)}|${ip}`, -1);
    p.hincrby(t.ipHourly, `${hourOfBallot(ballot)}|${ip}`, 1);
  }
}
for (const ballot of myVoided) {
  p.hset(t.void, { [ballot]: typeof voided[ballot] === "string" ? voided[ballot] : JSON.stringify(voided[ballot]) });
  p.hdel(f.void, ballot);
}
for (const [field, value] of myHourly) {
  p.hincrby(t.hourly, field, Number(value) || 0);
  p.hdel(f.hourly, field);
}
if (mine.length) p.hincrby(t.count, nomineeKey, mine.length);
p.hdel(f.count, nomineeKey);
for (const key of cool) p.del(key);
for (const key of [...Object.values(f), ...Object.values(t)]) p.expire(key, TTL);
await p.exec();
console.log(`Moved: finalist, ${nominations.length} nominations, ${mine.length} votes, ${myVoided.length} voided ballots; cleared ${cool.length} cooldowns.`);
