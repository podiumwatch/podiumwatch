// Checks the real vote Lua script (lib/yearly_awards_2026_votes.mjs's
// VOTE_SCRIPT) against the real Redis, on throwaway "yoty2026test:" keys
// that are deleted at the end. Touches no real vote. About 50 commands.
//
//   node --env-file=.env.local scripts/test-yearly-vote-script.mjs
import assert from "node:assert/strict";
import { VOTE_SCRIPT, voteScriptCall } from "../lib/yearly_awards_2026_votes.mjs";
import { redisAdmin as redis } from "../lib/redis-admin.mjs";

const run = Date.now().toString(36);
const toTest = (key) => key.replace(/^yoty2026:/, `yoty2026test:${run}:`);
const cast = async (input) => {
  const call = voteScriptCall({ slug: "coach-boys-d4", ipHash: "test0000ip000000", ...input });
  return redis.eval(VOTE_SCRIPT, call.keys.map(toTest), call.args);
};
const used = new Set();
const track = (input) => voteScriptCall({ slug: "coach-boys-d4", ipHash: "test0000ip000000", ...input }).keys.map(toTest).forEach((key) => used.add(key));

try {
  const now = new Date();
  const a = { finalistKey: "a", tokenHash: "tok1000000000000", now };
  track(a);
  assert.deepEqual(await cast(a), ["ok"], "first vote accepted");
  assert.deepEqual(await cast(a), ["ok"], "identical retry answers ok");
  const k = voteScriptCall({ slug: "coach-boys-d4", ipHash: "test0000ip000000", ...a }).keys.map(toTest);
  assert.equal(Number(await redis.hlen(k[4])), 1, "retry did not add a second ballot");
  assert.equal(Number(await redis.hget(k[9], "a")), 1, "count is 1");
  const second = { finalistKey: "b", tokenHash: "tok1000000000000", now: new Date(now.getTime() + 5000) };
  track(second);
  const refused = await cast(second);
  assert.equal(refused[0], "cool");
  assert.equal(String(refused[1]).split("|")[0], "a", "cooldown names the first vote");
  assert.ok(Number(await redis.ttl(k[3])) > 3500, "cooldown has its hour");
  assert.ok(Number(await redis.ttl(k[4])) > 60 * 60 * 24 * 100, "hashes got their expiry on the first vote of the hour");
  // Voided browser.
  await redis.hset(k[0], { tok2000000000000: 1 });
  const voided = { finalistKey: "a", tokenHash: "tok2000000000000", now };
  track(voided);
  assert.deepEqual(await cast(voided), ["voided"]);
  // Spacing (2026-11-13): a second vote from the same network in the same
  // category within 30 seconds is refused and leaves no cooldown.
  const firstSpaced = { finalistKey: "a", tokenHash: "space00000000000", ipHash: "spacingip0000000", now };
  const secondSpaced = { finalistKey: "a", tokenHash: "space10000000000", ipHash: "spacingip0000000", now };
  track(firstSpaced); track(secondSpaced);
  assert.deepEqual(await cast(firstSpaced), ["ok"]);
  assert.deepEqual(await cast(secondSpaced), ["spacing"]);
  const spacedKeys = voteScriptCall({ slug: "coach-boys-d4", ...secondSpaced }).keys.map(toTest);
  assert.equal(await redis.get(spacedKeys[3]), null, "a spaced-out vote leaves no cooldown");
  assert.ok(Number(await redis.ttl(spacedKeys[10])) > 0 && Number(await redis.ttl(spacedKeys[10])) <= 30, "the spacing key lasts 30 seconds");
  assert.equal(Number(await redis.hget(k[9], "a")), 2, "1 vote + 1 from the spaced network");
  // Hourly backstop (2026-11-12): a network already at the hour's limit in a category is refused.
  const capped = { finalistKey: "a", tokenHash: "cap0000000000000", ipHash: "hourcapip0000000", now };
  track(capped);
  const capCall = voteScriptCall({ slug: "coach-boys-d4", ...capped });
  const capKeys = capCall.keys.map(toTest);
  await redis.hset(capKeys[8], { [capCall.args[5]]: Number(capCall.args[11]) - 1 });
  assert.deepEqual(await cast(capped), ["ok"], "the limit's last vote counts");
  const over = { finalistKey: "a", tokenHash: "cap1000000000000", ipHash: "hourcapip0000000", now };
  track(over);
  assert.deepEqual(await cast(over), ["hourcap"], "the next one in that hour is refused");
  const overKeys = voteScriptCall({ slug: "coach-boys-d4", ...over }).keys.map(toTest);
  assert.equal(await redis.get(overKeys[3]), null, "a refused vote leaves no cooldown");
  assert.equal(Number(await redis.hget(capKeys[8], capCall.args[5])), Number(capCall.args[11]), "refused vote not counted");
  console.log("Vote script OK against real Redis.");
} finally {
  if (used.size) await redis.del(...used);
  console.log(`Removed ${used.size} test keys.`);
}
