import {
  REVIEW_BUCKET,
  REVIEW_HEADERS,
  REVIEW_OBJECT,
  REVIEW_PATH,
  WRONG_PASSWORD_MESSAGE,
  cookieValueIsValid,
  makeCookieValue,
  passwordFromBody,
  passwordMatches,
  readCookie,
  recordWrongAttempt,
  reviewConfig,
  setCookieHeader,
  signInPageHtml,
  tooManyWrongAttempts
} from "../../lib/oatccc_review.mjs";

// The OATCCC private review link (lib/oatccc_review.mjs). Reached only
// through the vercel.json rewrite from REVIEW_PATH. The draft HTML lives
// in a private Supabase Storage bucket and is sent only with a valid
// signed cookie.

const DRAFT_CACHE_MS = 60 * 1000;
let draftCache = null;

async function loadDraftFromStorage() {
  if (draftCache && Date.now() - draftCache.atMs < DRAFT_CACHE_MS) return draftCache.html;
  const { supabaseAdmin } = await import("../../lib/supabase-admin.mjs");
  const { data, error } = await supabaseAdmin.storage.from(REVIEW_BUCKET).download(REVIEW_OBJECT);
  if (error || !data) throw new Error(`Draft download failed: ${error?.message || "no data"}`);
  const html = await data.text();
  draftCache = { html, atMs: Date.now() };
  return html;
}

// Swappable for tests.
export const deps = {
  loadDraft: loadDraftFromStorage,
  wrongDelayMs: 1000,
  env: process.env
};

function clientIp(request) {
  const forwarded = request.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) return forwarded.split(",")[0].trim();
  return request.headers?.["x-real-ip"] || request.socket?.remoteAddress || "unknown";
}

async function readBody(request) {
  if (request.body !== undefined) return request.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 4096) return "";
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendHtml(response, status, html) {
  for (const [key, value] of Object.entries(REVIEW_HEADERS)) response.setHeader(key, value);
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  return response.status(status).send(html);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function handler(request, response) {
  const config = reviewConfig(deps.env);

  if (request.method === "POST") {
    const ip = clientIp(request);
    const attempt = passwordFromBody(await readBody(request));
    if (config && !tooManyWrongAttempts(ip) && passwordMatches(config, attempt)) {
      for (const [key, value] of Object.entries(REVIEW_HEADERS)) response.setHeader(key, value);
      response.setHeader("Set-Cookie", setCookieHeader(makeCookieValue(config)));
      response.setHeader("Location", REVIEW_PATH);
      return response.status(303).send("");
    }
    recordWrongAttempt(ip);
    if (deps.wrongDelayMs) await wait(deps.wrongDelayMs);
    return sendHtml(response, 401, signInPageHtml({ error: WRONG_PASSWORD_MESSAGE }));
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD, POST");
    return sendHtml(response, 405, signInPageHtml());
  }

  const cookie = readCookie(request.headers?.cookie);
  if (!config || !cookieValueIsValid(config, cookie)) {
    return sendHtml(response, 200, signInPageHtml());
  }

  let draft;
  try {
    draft = await deps.loadDraft();
  } catch (error) {
    console.error("OATCCC review: draft could not be loaded.", error?.message || error);
    return sendHtml(response, 503, signInPageHtml({ error: "The draft could not be loaded right now. Try again in a minute." }));
  }
  return sendHtml(response, 200, draft);
}
