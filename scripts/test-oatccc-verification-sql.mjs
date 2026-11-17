// Runs install/99_OATCCC_VERIFICATION.sql, install/101_OATCCC_ADMIN_ROLES.sql
// install/102_OATCCC_SCHOOL_DIVISIONS.sql and install/104_OATCCC_AD_DIRECTORY.sql
// in an in-memory Postgres (PGlite)
// with a stand-in for Supabase's auth schema, then checks every rule:
// one submission per school per season, the four statuses and who may move
// them, a comment to return, late flag, closed window, TEST vs real,
// row-level security between schools, permanent comments and audit trail,
// the public verified list, and the admin roles (who may work on indoor
// verification, who may manage admins, site_admin rules, the record of
// admin changes).
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
// PGlite has no pgcrypto; gen_random_uuid() is built into Postgres anyway.
const migration = fs.readFileSync(path.join(root, "install", "99_OATCCC_VERIFICATION.sql"), "utf8").replace(/^create extension if not exists pgcrypto;/m, "");
const roles = fs.readFileSync(path.join(root, "install", "101_OATCCC_ADMIN_ROLES.sql"), "utf8");
const db = new PGlite();
const U = { admin: "00000000-0000-0000-0000-00000000000a", ad1: "00000000-0000-0000-0000-0000000000a1", ad2: "00000000-0000-0000-0000-0000000000a2", adR: "00000000-0000-0000-0000-0000000000a3", pres: "00000000-0000-0000-0000-0000000000b1", site1: "00000000-0000-0000-0000-0000000000b2", ms: "00000000-0000-0000-0000-0000000000b3", newbie: "00000000-0000-0000-0000-0000000000b4", site2: "00000000-0000-0000-0000-0000000000b5" };
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth; create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
create table public.ohio_schools (id uuid primary key default gen_random_uuid());
grant usage on schema public to anon, authenticated;
`);
await db.exec(migration);
await db.exec(roles);
await db.exec(roles); // re-runnable
console.log("migrations 99 and 101 applied (101 twice)");
await db.exec(`insert into auth.users values ('${U.admin}','a@x'),('${U.ad1}','b@x'),('${U.ad2}','c@x'),('${U.adR}','d@x'),('${U.pres}','pres@x'),('${U.site1}','site1@x'),('${U.ms}','ms@x'),('${U.newbie}','New@X'),('${U.site2}','site2@x')`);
const SA = "10000000-0000-0000-0000-00000000000a", SB = "10000000-0000-0000-0000-00000000000b", SR = "10000000-0000-0000-0000-00000000000c";
const T = "20000000-0000-0000-0000-000000000001", TL = "20000000-0000-0000-0000-000000000002", TC = "20000000-0000-0000-0000-000000000003", R = "20000000-0000-0000-0000-000000000004";
await db.exec(`
insert into oatccc_seasons (id,name,meet_year,opens_at,due_at,late_closes_at,is_test) values
 ('${T}','TEST open',2091,now()-interval '1 day',now()+interval '1 day',now()+interval '2 days',true),
 ('${TL}','TEST late',2092,now()-interval '3 day',now()-interval '1 day',now()+interval '2 days',true),
 ('${TC}','TEST closed',2093,now()-interval '3 day',now()-interval '2 day',now()-interval '1 days',true),
 ('${R}','Real season',2094,now()-interval '1 day',now()+interval '1 day',now()+interval '2 days',false);
insert into oatccc_schools (id,name,city,is_test) values ('${SA}','TEST School A','Testville',true),('${SB}','TEST School B','Testville',true),('${SR}','Real Sample High','Sometown',false);
insert into oatccc_staff (user_id, display_name, role) values ('${U.admin}','TEST Indoor Chair','indoor_chair'),('${U.pres}','TEST President','president'),('${U.site1}','TEST Site Admin','site_admin'),('${U.ms}','TEST MS Chair','ms_indoor_chair');
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
// ---------- Admin roles (install/101) ----------
await ok("roles: middle school chair sees no submissions, comments or trail", async () => { for (const t of ["oatccc_submissions", "oatccc_submission_comments", "oatccc_submission_events"]) { const r = await as("ms", `select * from ${t}`); eq(r.length, 0, t); } });
await throws("roles: middle school chair cannot approve", () => as("ms", "select * from oatccc_approve_submission($1)", [realId]), /only an OATCCC admin|not found|not an allowed/);
await ok("roles: president and site_admin can work on verification", async () => { for (const who of ["pres", "site1"]) { const r = await as(who, "select id from oatccc_submissions"); if (!r.length) throw new Error(who + " sees nothing"); } });
await throws("roles: indoor chair cannot manage admins", () => as("admin", "select * from oatccc_set_admin($1,$2,$3)", ["new@x", "clinic_chair", "TEST New"]), /only the president or a site_admin/);
await throws("roles: an AD cannot manage admins", () => as("ad1", "select oatccc_remove_admin($1)", [U.ms]), /only the president or a site_admin/);
await ok("roles: president adds an admin by email (any case)", async () => { const [r] = await as("pres", "select * from oatccc_set_admin($1,$2,$3)", [" new@x ", "clinic_chair", "TEST New"]); eq([r.user_id, r.role], [U.newbie, "clinic_chair"], "row"); });
await ok("roles: president changes a role", async () => { const [r] = await as("pres", "select * from oatccc_set_admin($1,$2,$3)", ["new@x", "indoor_chair", "TEST New"]); eq(r.role, "indoor_chair", "role"); });
await throws("roles: unknown role refused", () => as("pres", "select * from oatccc_set_admin($1,$2,$3)", ["new@x", "admin", "TEST New"]), /unknown role/);
await throws("roles: no account for that email", () => as("pres", "select * from oatccc_set_admin($1,$2,$3)", ["nobody@x", "indoor_chair", "TEST Nobody"]), /no sign-in account/);
await throws("roles: president cannot make a site_admin", () => as("pres", "select * from oatccc_set_admin($1,$2,$3)", ["new@x", "site_admin", "TEST New"]), /only a site_admin can make/);
await throws("roles: president cannot remove a site_admin", () => as("pres", "select oatccc_remove_admin($1)", [U.site1]), /last site_admin|only a site_admin/);
await throws("roles: the last site_admin cannot remove themselves", () => as("site1", "select oatccc_remove_admin($1)", [U.site1]), /last site_admin/);
await throws("roles: the last site_admin cannot be demoted, even by the database owner", () => as(null, "update oatccc_staff set role='president' where user_id=$1", [U.site1]), /last site_admin/);
await throws("roles: signed-in users cannot write oatccc_staff directly", () => as("pres", "insert into oatccc_staff (user_id, display_name, role) values ($1,'x','indoor_chair')", [U.ad1]), /permission denied/);
await throws("roles: president cannot remove a site_admin even when there are two", async () => {
  await as("site1", "select * from oatccc_set_admin($1,$2,$3)", ["site2@x", "site_admin", "TEST Site Admin Two"]);
  await as("pres", "select oatccc_remove_admin($1)", [U.site2]);
}, /only a site_admin can remove/);
await ok("roles: a site_admin removes another site_admin when one is left", async () => {
  await as("site2", "select oatccc_remove_admin($1)", [U.site1]);
  const r = await as(null, "select user_id from oatccc_staff where role='site_admin'"); eq(r.map((x) => x.user_id), [U.site2], "site_admins");
});
await ok("roles: president removes a non-site_admin", async () => { await as("pres", "select oatccc_remove_admin($1)", [U.newbie]); const r = await as(null, "select 1 from oatccc_staff where user_id=$1", [U.newbie]); eq(r.length, 0, "removed"); });
await ok("roles: every admin change is recorded with who did it", async () => {
  const r = await as("pres", "select action, old_role, new_role from oatccc_staff_events where actor_id is not null order by id");
  eq(r.map((x) => `${x.action}:${x.old_role || ""}>${x.new_role || ""}`), ["added:>clinic_chair", "role_changed:clinic_chair>indoor_chair", "added:>site_admin", "removed:site_admin>", "removed:indoor_chair>"], "events");
});
await ok("roles: indoor chair cannot read the record of admin changes", async () => { const r = await as("admin", "select id from oatccc_staff_events"); eq(r.length, 0, "rows"); });
await throws("roles: the record of admin changes is permanent", () => as(null, "delete from oatccc_staff_events"), /cannot be edited or deleted/);
await ok("roles: admins see the admin list; ADs see none of it", async () => { const a = await as("ms", "select user_id from oatccc_staff"); if (a.length < 3) throw new Error("ms sees " + a.length); const d = await as("ad1", "select user_id from oatccc_staff"); eq(d.length, 0, "AD rows"); });

// ---------- School list, AD school choice, signatures (install/102) ----------
// Applied after the install/99 and 101 checks above, which use the
// unsigned oatccc_submit that 102 retires for clients.
const schoolList = fs.readFileSync(path.join(root, "install", "102_OATCCC_SCHOOL_DIVISIONS.sql"), "utf8");
await db.exec(schoolList);
await db.exec(schoolList); // re-runnable
console.log("migration 102 applied (twice)");
Object.assign(U, { pickA: "00000000-0000-0000-0000-0000000000c1", pickB: "00000000-0000-0000-0000-0000000000c2" });
const L1 = "30000000-0000-0000-0000-000000000001", L2 = "30000000-0000-0000-0000-000000000002";
await db.exec(`
insert into auth.users values ('${U.pickA}','pa@x'),('${U.pickB}','pb@x');
insert into oatccc_schools (id,name,city,tournament_name,ohsaa_id,hytek_code,on_verification_list) values
 ('${L1}','LISTED ONE','Sometown','LISTED ONE',101,'LONE',true),('${L2}','LISTED TWO','Sometown','LISTED TWO',102,'LTWO',true);
`);
const PNG = "data:image/png;base64,iVBORw0KGgo=";
const SHA = "a".repeat(64);
const ANS = { has_boys: true, has_girls: false, ad: { first: "TEST", last: "AD" } };
const signed = (who, season, school, answers = ANS, name = "TEST AD", png = PNG) =>
  as(who, "select * from oatccc_submit_signed($1,$2,$3,$4,$5,$6)", [season, school, answers, name, png, SHA]);
await throws("102: the unsigned submit is retired for signed-in users", () => as("adR", "select * from oatccc_submit($1,$2,$3)", [R, SR, {}]), /permission denied/);
await ok("102: a signed-in AD sees the listed schools to pick; anon sees none", async () => {
  const r = await as("pickA", "select tournament_name from oatccc_schools where on_verification_list order by 1"); eq(r.map((x) => x.tournament_name), ["LISTED ONE", "LISTED TWO"], "dropdown");
  try { const a = await as("anon", "select id from oatccc_schools"); eq(a.length, 0, "anon"); } catch (e) { if (!/permission denied/.test(e.message)) throw e; }
});
await ok("102: non-testers do not see TEST schools; a TEST AD does", async () => {
  const b = await as("pickB", "select id from oatccc_schools where is_test"); eq(b.length, 0, "pickB");
  const a = await as("ad1", "select id from oatccc_schools where is_test"); if (a.length < 2) throw new Error("ad1 sees " + a.length);
});
let pickId;
await ok("102: an AD picks a school, submits and signs", async () => {
  const [r] = await signed("pickA", R, L1); pickId = r.id; eq(r.status, "submitted", "status");
  const c = await as(null, "select linked_by from oatccc_school_contacts where school_id=$1", [L1]); eq(c, [{ linked_by: "picked" }], "contact");
  const sg = await as("pickA", "select typed_name, signature_png, form_text_sha256, school_id, signer_id from oatccc_signatures where submission_id=$1", [pickId]);
  eq(sg, [{ typed_name: "TEST AD", signature_png: PNG, form_text_sha256: SHA, school_id: L1, signer_id: U.pickA }], "signature");
});
await throws("102: a second person cannot submit for the same school", () => signed("pickB", R, L1), /already been started/);
await ok("102: and cannot see its submission or signature", async () => { eq((await as("pickB", "select id from oatccc_submissions")).length, 0, "subs"); eq((await as("pickB", "select id from oatccc_signatures")).length, 0, "sigs"); });
await throws("102: a school not on the list cannot be picked", () => signed("pickB", R, SR), /only this school/);
await throws("102: a non-tester cannot pick a TEST school", () => signed("pickB", T, SB), /pick your school/);
await throws("102: no signature, no submission", () => signed("pickB", R, L2, ANS, "TEST AD", ""), /signature box/);
await throws("102: no typed name, no submission", () => signed("pickB", R, L2, ANS, " "), /type your name/);
await ok("102: nothing was claimed by the refused tries", async () => { const c = await as(null, "select count(*)::int n from oatccc_school_contacts where school_id=$1", [L2]); eq(c[0].n, 0, "contacts"); });
await throws("102: signed-in users cannot write signatures directly", () => as("pickA", "insert into oatccc_signatures (submission_id,season_id,school_id,typed_name,signature_png,form_text_sha256) values ($1,$2,$3,'x y',$4,$5)", [pickId, R, L1, PNG, SHA]), /permission denied/);
await throws("102: signatures are permanent, even for the database owner", () => as(null, "update oatccc_signatures set typed_name='Someone Else'"), /permanent/);
await throws("102: a real signature cannot be deleted", () => as(null, "delete from oatccc_signatures where submission_id=$1", [pickId]), /permanent/);
await ok("102: 'linked' mode turns picking off with one line", async () => {
  await as(null, "update oatccc_config set value='linked' where key='ad_school_choice'");
  eq((await as("pickB", "select id from oatccc_schools where on_verification_list")).length, 0, "dropdown empty");
  let refused = false; try { await signed("pickB", R, L2); } catch (e) { refused = /only this school/.test(e.message); }
  if (!refused) throw new Error("pickB could still submit");
  await as(null, "update oatccc_config set value='pick' where key='ad_school_choice'");
});
await throws("102: only 'pick' or 'linked'", () => as(null, "update oatccc_config set value='open' where key='ad_school_choice'"), /oatccc_config_values/);
await ok("102: return and resubmit records a second signature", async () => {
  await as("admin", "select * from oatccc_return_submission($1,$2)", [pickId, "Please add the girls coach."]);
  const [r] = await signed("pickA", R, L1, { ...ANS, has_girls: true }, "TEST AD Again"); eq(r.status, "resubmitted", "status");
  const sg = await as("admin", "select typed_name from oatccc_signatures where submission_id=$1", [pickId]); eq(sg.length, 2, "signatures");
});
await ok("102: opening an existing submission adds no signature", async () => {
  await signed("pickA", R, L1); const sg = await as("admin", "select id from oatccc_signatures where submission_id=$1", [pickId]); eq(sg.length, 2, "still two");
});
await ok("102: public division list shows real rows; the table stays closed", async () => {
  await as(null, "insert into oatccc_school_divisions (meet_year,gender,tournament_name,ohsaa_id,city,enrollment,division,hytek_code) values (2094,'boys','LISTED ONE',101,'Sometown',300,'D-2','LONE'),(2094,'girls','LISTED ONE',101,'Sometown,',150,'D-3','LONE')");
  const v = await as("anon", "select tournament_name, boys_division, girls_division from oatccc_division_list where meet_year=2094"); eq(v, [{ tournament_name: "LISTED ONE", boys_division: "D-2", girls_division: "D-3" }], "view");
  try { const t = await as("anon", "select * from oatccc_school_divisions"); eq(t.length, 0, "anon table"); } catch (e) { if (!/permission denied/.test(e.message)) throw e; }
  eq((await as("pickA", "select * from oatccc_school_divisions")).length, 0, "AD table");
});
await throws("102: division values are only D-1 to D-4", () => as(null, "insert into oatccc_school_divisions (meet_year,gender,tournament_name,division) values (2094,'boys','LISTED TWO','D-5')"), /check/);
await throws("102: one row per year, gender and tournament name", () => as(null, "insert into oatccc_school_divisions (meet_year,gender,tournament_name,division) values (2094,'boys','LISTED ONE','D-1')"), /duplicate|unique/);
await ok("102: MileSplit export lists verified schools with HyTek code and divisions", async () => {
  await as("admin", "select * from oatccc_approve_submission($1)", [pickId]);
  const v = await as("anon", "select tournament_name, hytek_code, boys_division, girls_division, has_boys_team, has_girls_team from oatccc_milesplit_export where tournament_name is not null");
  eq(v, [{ tournament_name: "LISTED ONE", hytek_code: "LONE", boys_division: "D-2", girls_division: "D-3", has_boys_team: true, has_girls_team: true }], "export");
});
await throws("102: TEST schools never get a tournament name", () => as(null, "insert into oatccc_schools (name,is_test,tournament_name) values ('TEST X',true,'TEST X')"), /oatccc_schools_test_not_listed/);
await throws("102: tournament names are unique", () => as(null, "insert into oatccc_schools (name,tournament_name,on_verification_list) values ('LISTED ONE','LISTED ONE',true)"), /duplicate|unique/);
await ok("102: the real 2027 season is in place", async () => { const r = await as(null, "select opens_at < due_at and due_at < late_closes_at ok from oatccc_seasons where meet_year=2027 and not is_test"); eq(r, [{ ok: true }], "season"); });

// ---------- Private AD directory (install/104) ----------
const directory = fs.readFileSync(path.join(root, "install", "104_OATCCC_AD_DIRECTORY.sql"), "utf8");
await db.exec(directory);
await db.exec(directory); // re-runnable
console.log("migration 104 applied (twice)");
Object.assign(U, { pickC: "00000000-0000-0000-0000-0000000000c3" });
const L3 = "30000000-0000-0000-0000-000000000003";
await db.exec(`
insert into auth.users values ('${U.pickC}','pc@x');
insert into oatccc_schools (id,name,city,tournament_name,ohsaa_id,hytek_code,on_verification_list) values ('${L3}','LISTED THREE','Sometown','LISTED THREE',103,'LTHR',true);
insert into oatccc_directory_schools (ohsaa_id, school_name, ad_name, ad_emails, boys_xc_coach, boys_xc_emails, directory_date, oatccc_school_id) values
 (102, 'LISTED TWO', 'TEST AD Two', '{pb@x,other@x}', 'TEST Coach', '{coach@x}', '2026-11-17', '${L2}'),
 (103, 'LISTED THREE', 'TEST AD Three', '{someone-else@x}', null, '{}', '2026-11-17', '${L3}');
`);
await ok("104: OATCCC staff read the directory; ADs and anon cannot", async () => {
  eq((await as("admin", "select ohsaa_id from oatccc_directory_schools order by 1")).map((r) => r.ohsaa_id), [102, 103], "staff");
  eq((await as("pickB", "select ohsaa_id from oatccc_directory_schools")).length, 0, "AD");
  try { const r = await as("anon", "select * from oatccc_directory_schools"); eq(r.length, 0, "anon"); } catch (e) { if (!/permission denied/.test(e.message)) throw e; }
});
await throws("104: signed-in users cannot write the directory", () => as("admin", "update oatccc_directory_schools set ad_name='x'"), /permission denied/);
await ok("104: my directory schools: matched by email (any case), ids and names only", async () => {
  await as(null, "update auth.users set email='PB@X' where id=$1", [U.pickB]);
  const r = await as("pickB", "select * from oatccc_my_directory_schools()");
  eq(r, [{ school_id: L2, name: "LISTED TWO" }], "pickB");
  eq((await as("pickC", "select * from oatccc_my_directory_schools()")).length, 0, "pickC");
});
await throws("104: the helper that reads emails is not callable by clients", () => as("pickB", "select oatccc_my_email()"), /permission denied/);
await throws("104: an AD listed in the directory cannot claim another school", () => signed("pickB", R, L3), /athletic director of another school/);
await ok("104: the listed AD submits for their own school, flagged as in the directory", async () => {
  const [r] = await signed("pickB", R, L2);
  const [row] = await as("admin", "select ad_email_in_directory from oatccc_submissions where id=$1", [r.id]);
  eq(row.ad_email_in_directory, true, "flag");
});
await ok("104: an AD not in the directory picks a school and is flagged for the Chair", async () => {
  const [r] = await signed("pickC", R, L3);
  const [row] = await as("admin", "select ad_email_in_directory from oatccc_submissions where id=$1", [r.id]);
  eq(row.ad_email_in_directory, false, "flag");
});
await ok("104: TEST schools are never flagged", async () => {
  const [row] = await as(null, "select ad_email_in_directory from oatccc_submissions s join oatccc_schools sc on sc.id=s.school_id where sc.is_test limit 1");
  if (row) eq(row.ad_email_in_directory, null, "TEST flag");
});
await throws("104: directory emails must be lower case", () => as(null, "insert into oatccc_directory_schools (ohsaa_id, school_name, ad_emails, directory_date) values (999,'X','{Upper@X}','2026-11-17')"), /oatccc_directory_emails_lower/);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
