import crypto from "node:crypto";

const COOKIE_NAME = "podium_admin_session";
const SESSION_SECONDS = 60 * 60 * 8;

function requireEnvironmentVariable(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is missing.`);
  }

  return value;
}

function safeEqual(firstValue, secondValue) {
  const first = Buffer.from(String(firstValue));
  const second = Buffer.from(String(secondValue));

  if (first.length !== second.length) {
    return false;
  }

  return crypto.timingSafeEqual(first, second);
}

function signPayload(payload) {
  const secret = requireEnvironmentVariable(
    "PODIUM_ADMIN_SESSION_SECRET"
  );

  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
}

function parseCookies(cookieHeader = "") {
  return String(cookieHeader)
    .split(";")
    .reduce((cookies, item) => {
      const separator = item.indexOf("=");

      if (separator === -1) {
        return cookies;
      }

      const name = item.slice(0, separator).trim();
      const value = item.slice(separator + 1).trim();

      if (name) {
        cookies[name] = value;
      }

      return cookies;
    }, {});
}

function requestIsSecure(request) {
  const forwardedProtocol =
    request.headers["x-forwarded-proto"];

  const protocol = Array.isArray(forwardedProtocol)
    ? forwardedProtocol[0]
    : forwardedProtocol;

  return (
    protocol === "https" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview"
  );
}

export function verifyAdminPassword(password) {
  const expectedPassword = requireEnvironmentVariable(
    "PODIUM_ADMIN_PASSWORD"
  );

  return safeEqual(password, expectedPassword);
}

export function createAdminSessionCookie(request) {
  const expiresAt =
    Math.floor(Date.now() / 1000) + SESSION_SECONDS;

  const payload = Buffer.from(
    JSON.stringify({
      expiresAt,
      nonce: crypto.randomBytes(24).toString("base64url")
    })
  ).toString("base64url");

  const signature = signPayload(payload);
  const token = `${payload}.${signature}`;

  const cookieParts = [
    `${COOKIE_NAME}=${token}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Strict",
    `Max-Age=${SESSION_SECONDS}`
  ];

  if (requestIsSecure(request)) {
    cookieParts.push("Secure");
  }

  return cookieParts.join("; ");
}

export function clearAdminSessionCookie(request) {
  const cookieParts = [
    `${COOKIE_NAME}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Strict",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT"
  ];

  if (requestIsSecure(request)) {
    cookieParts.push("Secure");
  }

  return cookieParts.join("; ");
}

export function isAdminRequest(request) {
  try {
    const cookies = parseCookies(
      request.headers.cookie || ""
    );

    const token = cookies[COOKIE_NAME];

    if (!token) {
      return false;
    }

    const [payload, providedSignature] =
      token.split(".");

    if (!payload || !providedSignature) {
      return false;
    }

    const expectedSignature = signPayload(payload);

    if (
      !safeEqual(
        providedSignature,
        expectedSignature
      )
    ) {
      return false;
    }

    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );

    return (
      Number.isFinite(Number(session.expiresAt)) &&
      Number(session.expiresAt) >
        Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}