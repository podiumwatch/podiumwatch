// Runs install/99_OATCCC_VERIFICATION.sql in an in-memory Postgres (PGlite)
// with a stand-in for Supabase's auth schema, then checks every rule:
// one submission per school per season, the four statuses and who may move
// them, a comment to return, late flag, closed window, TEST vs real,
// row-level security between schools, permanent comments and audit trail,
// and the public verified list.
//
// PGlite is not a project dependency. To run:
//   npm.cmd install --no-save @electric-sql/pglite@0.2.17
//   node scripts/test-oatccc-verification-sql.mjs
// Without it this script says so and exits 0.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let PGlite;
try {
  ({ PGlite } = await import("@electric-sql/pglite"));
} catch {
  console.log("Skipped: @electric-sql/pglite is not installed (see the top of this file).");
  process.exit(0);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.argv[2] = path.join(root, "install", "99_OATCCC_VERIFICATION.sql");
process.argv[3] = undefined;
const migration = fs.readFileSync(process.argv[2], "utf8").replace(/^create extension if not exists pgcrypto;/m, "");
const seed = null;
const db = new PGlite();
const U = { admin: "00000000-0000-0000-0000-00000000000a", ad1: "00000000-0000-0000-0000-0000000000a1", ad2: "00000000-0000-0000-0000-0000000000a2", adR: "00000000-0000-0000-0000-0000000000a3" };
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth; create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
create table public.ohio_schools (id uuid primary key default gen_random_uuid());
grant usage on schema public to anon, authenticated;
`);
await db.exec(migration);
console.log("migration applied");
if (seed) {
  await db.exec(seed);
  const rows = (await db.query("select (select count(*)::int from oatccc_schools) schools, (select count(*)::int from oatccc_seasons) seasons, (select count(*)::int from oatccc_schools where not is_test) real_schools")).rows[0];
  console.log("seed applied", JSON.stringify(rows));
  await db.exec(seed);
  const again = (await db.query("select count(*)::int n from oatccc_schools")).rows[0];
  console.log("seed re-run safe:", again.n === rows.schools);
  process.exit(0);
}
await db.exec(`insert into auth.users values ('${U.admin}','a@x'),('${U.ad1}','b@x'),('${U.ad2}','c@x'),('${U.adR}','d@x')`);
const SA = "10000000-0000-0000-0000-00000000000a", SB = "10000000-0000-0000-0000-00000000000b", SR = "10000000-0000-0000-0000-00000000000c";
const T = "20000000-0000-0000-0000-000000000001", TL = "20000000-0000-0000-0000-000000000002", TC = "20000000-0000-0000-0000-000000000003", R = "20000000-0000-0000-0000-000000000004";
await db.exec(`
insert into oatccc_seasons (id,name,meet_year,opens_at,due_at,late_closes_at,is_test) values
 ('${T}','TEST open',2091,now()-interval '1 day',now()+interval '1 day',now()+interval '2 days',true),
 ('${TL}','TEST late',2092,now()-interval '3 day',now()-interval '1 day',now()+interval '2 days',true),
 ('${TC}','TEST closed',2093,now()-interval '3 day',now()-interval '2 day',now()-interval '1 days',true),
 ('${R}','Real season',2094,now()-interval '1 day',now()+interval '1 day',now()+interval '2 days',false);
insert into oatccc_schools (id,name,city,is_test) values ('${SA}','TEST School A','Testville',true),('${SB}','TEST School B','Testville',true),('${SR}','Real Sample High','Sometown',false);
insert into oatccc_staff values ('${U.admin}','Admin');
insert into oatccc_school_contacts (school_id,user_id) values ('${SA}','${U.ad1}'),('${SB}','${U.ad2}'),('${SR}','${U.adR}');
`);
let pass = 0, fail = 0;
async function as(user, sql, params = []) {
  return db.transaction(async (tx) => {
    if (user === "anon") { await tx.query("set local role anon"); await tx.query("select set_config('request.jwt.claim.sub','',true)"); }
    else if (user) { await tx.query("set local role authenticated"); await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [U[user]]); }
    return (await tx.query(sql, params)).rows;
  });
}
async function ok(name, fn) { try { await fn(); pass++; console.log("PASS", name); } catch (e) { fail++; console.log("FAIL", name, "->", e.message); } }
async function throws(name, fn, re) { try { await fn(); fail++; console.log("FAIL", name, "-> did not throw"); } catch (e) { if (re && !re.test(e.message)) { fail++; console.log("FAIL", name, "-> wrong error:", e.message); } else { pass++; console.log("PASS", name, "(" + e.message.slice(0, 70) + ")"); } } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };

let subId;
await ok("AD submits for own school", async () => { const [r] = await as("ad1", "select * from oatccc_submit($1,$2,$3)", [T, SA, { q1: "yes" }]); subId = r.id; eq(r.status, "submitted", "status"); eq(r.is_late, false, "late"); });
await ok("second submit opens the existing one", async () => { const [r] = await as("ad1", "select * from oatccc_submit($1,$2,$3)", [T, SA, { q1: "changed" }]); eq(r.id, subId, "id"); eq(r.answers, { q1: "yes" }, "answers unchanged"); const [c] = await as(null, "select count(*)::int n from oatccc_submissions where school_id=$1", [SA]); eq(c.n, 1, "count"); });
await throws("AD cannot submit for another school", () => as("ad1", "select * from oatccc_submit($1,$2,$3)", [T, SB, {}]), /only this school/);
await throws("AD cannot insert directly for another school", () => as("ad1", "insert into oatccc_submissions (season_id,school_id) values ($1,$2)", [T, SB]), /only this school|row-level security/);
await ok("other AD cannot see it", async () => { const r = await as("ad2", "select id from oatccc_submissions"); eq(r.length, 0, "rows"); const e = await as("ad2", "select id from oatccc_submission_events"); eq(e.length, 0, "events"); });
await ok("anon sees nothing", async () => { try { const r = await as("anon", "select id from oatccc_submissions"); eq(r.length, 0, "rows"); } catch (e) { if (!/permission denied/.test(e.message)) throw e; } });
await ok("AD cannot approve own (update affects nothing or errors)", async () => { try { const r = await as("ad1", "update oatccc_submissions set status='approved' where id=$1 returning id", [subId]); eq(r.length, 0, "updated rows"); } catch (e) { if (!/admin|row-level|permission/.test(e.message)) throw e; } });
await throws("admin cannot return without a comment", () => as("admin", "update oatccc_submissions set status='returned' where id=$1", [subId]), /needs a comment/);
await throws("return RPC refuses a blank comment", () => as("admin", "select * from oatccc_return_submission($1,$2)", [subId, "  "]), /what needs fixing/);
await throws("admin cannot change answers", () => as("admin", "update oatccc_submissions set status='approved', answers='{}' where id=$1", [subId]), /cannot change/);
await ok("admin returns with a comment", async () => { const [r] = await as("admin", "select * from oatccc_return_submission($1,$2)", [subId, "Please add your second coach."]); eq(r.status, "returned", "status"); eq(r.decided_by, U.admin, "decided_by"); });
await ok("AD reads the comment", async () => { const r = await as("ad1", "select body, author_role from oatccc_submission_comments where submission_id=$1", [subId]); eq(r, [{ body: "Please add your second coach.", author_role: "admin" }], "comments"); });
await throws("AD cannot edit the comment", () => as("ad1", "update oatccc_submission_comments set body='x' where submission_id=$1", [subId]), /permission denied|permanent/);
await ok("AD delete of comment does nothing", async () => { try { await as("ad1", "delete from oatccc_submission_comments where submission_id=$1", [subId]); } catch (e) { if (!/permission denied/.test(e.message)) throw e; } const [c] = await as(null, "select count(*)::int n from oatccc_submission_comments"); eq(c.n, 1, "still there"); });
await throws("even the database owner cannot edit a comment", () => as(null, "update oatccc_submission_comments set body='x'"), /permanent/);
await ok("AD resubmits with fixed answers", async () => { const [r] = await as("ad1", "select * from oatccc_submit($1,$2,$3)", [T, SA, { q1: "fixed" }]); eq(r.id, subId, "same id"); eq(r.status, "resubmitted", "status"); eq(r.answers, { q1: "fixed" }, "answers"); });
await throws("AD cannot jump resubmitted -> approved", () => as("ad1", "update oatccc_submissions set status='approved' where id=$1 returning id", [subId]).then((r) => { if (!r.length) throw new Error("row-level security: no rows"); }), /admin|row-level/);
await ok("admin approves", async () => { const [r] = await as("admin", "select * from oatccc_approve_submission($1,$2)", [subId, "Looks good."]); eq(r.status, "approved", "status"); });
await throws("approved is final", () => as("admin", "update oatccc_submissions set status='returned' where id=$1", [subId]), /not an allowed|needs a comment/);
await ok("audit trail has every step with actor", async () => { const r = await as("admin", "select event, actor_role, actor_id from oatccc_submission_events where submission_id=$1 order by id", [subId]); eq(r.map((x) => x.event), ["submitted", "commented", "returned", "resubmitted", "commented", "approved"], "events"); if (r.some((x) => !x.actor_id)) throw new Error("missing actor"); });
await ok("TEST approvals stay off the public list", async () => { const r = await as("anon", "select * from oatccc_verified_teams"); eq(r.length, 0, "rows"); });
await ok("late submission is flagged", async () => { const [r] = await as("ad2", "select * from oatccc_submit($1,$2,$3)", [TL, SB, {}]); eq(r.is_late, true, "late"); });
await throws("closed window refuses new forms", () => as("ad2", "select * from oatccc_submit($1,$2,$3)", [TC, SB, {}]), /late window has closed/);
await throws("TEST school cannot use a real season", () => as("ad1", "select * from oatccc_submit($1,$2,$3)", [R, SA, {}]), /TEST schools/);
let realId;
await ok("real school flow reaches the public list", async () => { const [r] = await as("adR", "select * from oatccc_submit($1,$2,$3)", [R, SR, {}]); realId = r.id; await as("admin", "select * from oatccc_approve_submission($1)", [realId]); const v = await as("anon", "select * from oatccc_verified_teams"); eq(v, [{ meet_year: 2094, school_name: "Real Sample High", city: "Sometown" }], "view"); });
await ok("anon cannot read tables", async () => { for (const t of ["oatccc_submissions", "oatccc_schools", "oatccc_submission_comments", "oatccc_staff"]) { try { const r = await as("anon", `select * from ${t}`); if (r.length) throw new Error(t + " leaked"); } catch (e) { if (!/permission denied/.test(e.message)) throw e; } } });
await throws("real submission cannot be deleted, even by the owner", () => as(null, "delete from oatccc_submissions where id=$1", [realId]), /cannot be deleted/);
await ok("TEST submission can be deleted with its trail", async () => { await as(null, "delete from oatccc_submissions where id=$1", [subId]); const [c] = await as(null, "select count(*)::int n from oatccc_submission_events where submission_id=$1", [subId]); eq(c.n, 0, "events gone"); });
await throws("no signed-in user, no change", () => as(null, "insert into oatccc_submissions (season_id,school_id) values ($1,$2)", [T, SA]), /signed-in user/);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
