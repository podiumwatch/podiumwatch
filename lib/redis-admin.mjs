import { Redis } from "@upstash/redis";

// Vote-tallying Redis pilot (2026-09-15): Team of the Week only, to stop
// vote-spam from writing one Postgres row per vote (the root cause of
// the real Supabase Disk IO Budget outage, 2026-08-31 -- see
// docs/DECISIONS.md and totw_vote_redis.mjs's own header). Athlete of
// the Week is unaffected and stays on Supabase for now.
//
// These are the Vercel Marketplace "Upstash for Redis" integration's own
// variable names (the KV_ prefix is what that integration actually
// creates, confirmed live against the real project -- NOT the plain
// UPSTASH_REDIS_REST_URL/TOKEN names the @upstash/redis docs show for a
// standalone Upstash setup). Using @upstash/redis directly with an
// explicit url/token, not @vercel/kv (retired) and not Redis.fromEnv()
// (which looks for the plain names, not these).
const redisUrl = process.env.KV_REST_API_URL;
const redisToken = process.env.KV_REST_API_TOKEN;

if (!redisUrl || !redisToken) {
  throw new Error("Redis (KV_REST_API_URL / KV_REST_API_TOKEN) environment variables are missing.");
}

export const redisAdmin = new Redis({ url: redisUrl, token: redisToken });
