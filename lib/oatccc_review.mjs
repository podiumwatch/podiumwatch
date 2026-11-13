import crypto from "node:crypto";

// OATCCC private review link (2026-11-12). One password-protected address
// that serves the OATCCC indoor redesign draft to OATCCC administrators.
//
// The repo is public, so the draft HTML is NOT in git: it lives in the
// private Supabase Storage bucket below and is read on the server with the
// service role key. The address is committed (Zachary's OK); the password
// is what protects the draft.
//
// Fails closed: if OATCCC_REVIEW_PASSWORD or OATCCC_REVIEW_COOKIE_SECRET is
// missing or blank (or the secret is shorter than 32 characters), every
// sign-in is refused and the draft is never served.
//
// To take it down: delete api/review/oatccc-indoor.js, this file, the
// vercel.json rewrite and header block, the bucket's file, and both
// environment variables.

export const REVIEW_TOKEN = "nqn1HonMrnWA8gu1i54AUGqRa0XZFfFg";
export const REVIEW_PATH = `/review/oatccc-indoor-${REVIEW_TOKEN}/`;
export const REVIEW_BUCKET = "oatccc-review";
export const REVIEW_OBJECT = "OATCCC-Indoor-DRAFT-preview.html";
export const COOKIE_NAME = "oatccc_review";
export const COOKIE_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;
export const WRONG_PASSWORD_MESSAGE = "That password did not work. Try again.";

export const REVIEW_HEADERS = {
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer"
};

// Both values present, non-blank, and the secret long enough; else null.
export function reviewConfig(env = process.env) {
  const password = typeof env.OATCCC_REVIEW_PASSWORD === "string" ? env.OATCCC_REVIEW_PASSWORD : "";
  const secret = typeof env.OATCCC_REVIEW_COOKIE_SECRET === "string" ? env.OATCCC_REVIEW_COOKIE_SECRET : "";
  if (!password.trim() || secret.trim().length < 32) return null;
  return { password, secret };
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest();
}

// Constant-time: both sides are hashed to 32 bytes first, so lengths match.
export function passwordMatches(config, attempt) {
  if (!config) return false;
  if (typeof attempt !== "string" || attempt.length === 0 || attempt.length > 512) return false;
  return crypto.timingSafeEqual(sha256(attempt), sha256(config.password));
}

function signature(config, expiresMs) {
  const passwordHash = sha256(config.password).toString("hex");
  return crypto
    .createHmac("sha256", config.secret)
    .update(`v1|${expiresMs}|${passwordHash}`)
    .digest("base64url");
}

// Signed value: v1.<expiry ms>.<hmac over expiry + a hash of the current
// password>. Changing the password changes every signature, which signs
// everyone out.
export function makeCookieValue(config, nowMs = Date.now()) {
  const expiresMs = nowMs + COOKIE_MAX_AGE_SECONDS * 1000;
  return `v1.${expiresMs}.${signature(config, expiresMs)}`;
}

export function cookieValueIsValid(config, value, nowMs = Date.now()) {
  if (!config || typeof value !== "string") return false;
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "v1" || !/^\d{1,16}$/.test(parts[1])) return false;
  const expiresMs = Number(parts[1]);
  if (!(expiresMs > nowMs)) return false;
  const expected = Buffer.from(signature(config, expiresMs));
  const given = Buffer.from(parts[2]);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

export function setCookieHeader(value) {
  return `${COOKIE_NAME}=${value}; Path=${REVIEW_PATH}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function readCookie(header) {
  if (typeof header !== "string") return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === COOKIE_NAME) return part.slice(index + 1).trim();
  }
  return null;
}

// Only the POST body counts. A password in the address is never read.
export function passwordFromBody(body) {
  if (body == null) return "";
  if (Buffer.isBuffer(body)) body = body.toString("utf8");
  if (typeof body === "string") {
    if (body.length > 4096) return "";
    return new URLSearchParams(body).get("password") || "";
  }
  if (typeof body === "object" && typeof body.password === "string") return body.password;
  return "";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Standalone sign-in page: no site navigation, no analytics, no outside
// requests.
export function signInPageHtml({ error = "" } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="referrer" content="no-referrer">
<title>OATCCC draft review</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; background: #f4f5f7; color: #1d2150; font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { width: 100%; max-width: 380px; background: #fff; border: 1px solid #d9dce5; border-radius: 12px; padding: 28px 24px; }
  h1 { margin: 0 0 18px; font-size: 1.4rem; }
  label { display: block; font-weight: 600; margin-bottom: 6px; }
  input { width: 100%; font: inherit; padding: 12px; border: 1px solid #b8bccb; border-radius: 8px; }
  input:focus { outline: 3px solid #9aa3e6; outline-offset: 1px; }
  button { width: 100%; margin-top: 14px; font: inherit; font-weight: 700; padding: 12px; border: 0; border-radius: 8px; background: #1d2150; color: #fff; cursor: pointer; }
  .error { margin: 0 0 14px; padding: 10px 12px; border-radius: 8px; background: #fde8e8; color: #8a1c1c; }
</style>
</head>
<body>
<main>
  <h1>OATCCC draft review</h1>
  ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}
  <form method="post" action="${REVIEW_PATH}">
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
    <button type="submit">View the draft</button>
  </form>
</main>
</body>
</html>`;
}

// Small per-IP limit on wrong attempts, plus a delay on every wrong one.
// In-memory per server instance (enough to slow down guessing; the
// password is the real gate).
const WRONG_WINDOW_MS = 15 * 60 * 1000;
const WRONG_LIMIT = 10;
const wrongAttempts = new Map();

export function tooManyWrongAttempts(ip, nowMs = Date.now()) {
  const entry = wrongAttempts.get(ip);
  if (!entry || nowMs - entry.firstMs > WRONG_WINDOW_MS) return false;
  return entry.count >= WRONG_LIMIT;
}

export function recordWrongAttempt(ip, nowMs = Date.now()) {
  const entry = wrongAttempts.get(ip);
  if (!entry || nowMs - entry.firstMs > WRONG_WINDOW_MS) wrongAttempts.set(ip, { firstMs: nowMs, count: 1 });
  else entry.count += 1;
  if (wrongAttempts.size > 5000) wrongAttempts.clear();
}

export function resetWrongAttemptsForTests() {
  wrongAttempts.clear();
}
