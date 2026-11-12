// Split Watch's one shared request helper (Track build, Phase 1,
// 2026-11-12; docs/SPLIT_WATCH_TRACK_HANDOFF.md). Every Split Watch
// screen sends its requests through here so none of them can wait
// forever on bad stadium wifi or a stalled server:
//
//   - request(): fetch with a 15 s timeout (the 2026-08-31 fix, commit
//     86c6de08) that covers the whole round trip, including reading the
//     reply, and one error shape: SwRequestError with kind "timeout",
//     "offline", "network", "http" or "auth_unavailable".
//   - api(): the POST + JSON + optional coach token + 401 handling every
//     Split Watch page repeats.
//   - accessToken(): the coach's sign-in token, bounded too. Loading it
//     needs /api/team/config/ and the account library; if either stalls
//     or fails, the request goes on without a token (a race day code
//     helper only needs their cookie), and a 401 that follows is
//     reported as a retryable connection problem instead of sending a
//     signed-in coach to the code page.
//   - showRetry(): the standard failure panel with a Try again button.
//
// Exposed as window.PodiumSwRequest. Load it before the page's own
// script (both deferred, so order is kept).
window.PodiumSwRequest = (() => {
  const REQUEST_TIMEOUT_MS = 15000;
  const TOKEN_TIMEOUT_MS = 8000;
  const TIMEOUT_MESSAGE = "This is taking longer than expected -- check your connection and try again.";
  const NETWORK_MESSAGE = "Couldn't reach Podium Watch -- check your connection and try again.";
  const OFFLINE_MESSAGE = "This phone is offline -- check your connection and try again.";
  const AUTH_MESSAGE = "Couldn't confirm your account -- check your connection and try again.";

  class SwRequestError extends Error {
    constructor(kind, message, status = 0, data = null) {
      super(message);
      this.name = "SwRequestError";
      this.kind = kind;
      this.status = status;
      this.data = data;
    }
  }

  function isOffline() {
    return typeof navigator !== "undefined" && navigator.onLine === false;
  }

  // Any promise, bounded: rejects with a "timeout" SwRequestError after ms.
  function withTimeout(promise, ms = REQUEST_TIMEOUT_MS) {
    let timer = null;
    const limit = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new SwRequestError("timeout", TIMEOUT_MESSAGE)), ms);
    });
    return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
  }

  // One request, start to finish (headers AND body) inside timeoutMs.
  // Resolves { response, data } for any HTTP status; rejects only when
  // nothing usable came back.
  async function request(url, { method = "GET", headers = {}, body, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { method, headers, body, signal: controller.signal });
      const data = await response.json().catch((error) => {
        if (error && error.name === "AbortError") throw error;
        return {};
      });
      return { response, data: data && typeof data === "object" ? data : {} };
    } catch (error) {
      if (error instanceof SwRequestError) throw error;
      if (error && error.name === "AbortError") throw new SwRequestError("timeout", TIMEOUT_MESSAGE);
      if (isOffline()) throw new SwRequestError("offline", OFFLINE_MESSAGE);
      throw new SwRequestError("network", NETWORK_MESSAGE);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // { token, failed }: failed is true when the account library or its
  // config couldn't be loaded in time (not when the visitor simply isn't
  // signed in).
  async function accessToken(timeoutMs = TOKEN_TIMEOUT_MS) {
    const auth = window.PodiumTeamAuth;
    if (!auth || typeof auth.getAccessToken !== "function") return { token: "", failed: true };
    try {
      const token = await withTimeout(Promise.resolve().then(() => auth.getAccessToken()), timeoutMs);
      return { token: token || "", failed: false };
    } catch {
      return { token: "", failed: true };
    }
  }

  // POST JSON to a Split Watch endpoint. Returns the parsed reply, or
  // throws SwRequestError. onUnauthorized runs on a real 401 (the
  // existing "go enter the code" redirect); a 401 that followed a failed
  // token load is a connection problem, so it is retryable instead.
  // A page's FIRST load: give up 15 s after the page started loading (not
  // after its script got going), so a slow page load can't push the Try
  // again past ~16 s. Pass the result as deadlineAtMs on the first load
  // only; retries and later requests keep the full timeout.
  function loadDeadline(ms = REQUEST_TIMEOUT_MS) {
    const origin = typeof performance !== "undefined" && performance.timeOrigin ? performance.timeOrigin : Date.now();
    return origin + ms;
  }

  async function api(endpoint, payload, { fallback = "The request could not be completed.", onUnauthorized = null, timeoutMs: requestedTimeoutMs = REQUEST_TIMEOUT_MS, useToken = true, timing = null, deadlineAtMs = null } = {}) {
    const timeoutMs = deadlineAtMs ? Math.max(1000, Math.min(requestedTimeoutMs, deadlineAtMs - Date.now())) : requestedTimeoutMs;
    // One budget for the whole call: the token wait counts against
    // timeoutMs, so a fully stalled network gives up in about 15 s, not
    // token wait + 15 s.
    const startedMs = Date.now();
    const headers = { Accept: "application/json", "Content-Type": "application/json" };
    let tokenFailed = false;
    if (useToken) {
      const { token, failed } = await accessToken(Math.min(TOKEN_TIMEOUT_MS, timeoutMs));
      tokenFailed = failed;
      if (token) headers.Authorization = "Bearer " + token;
    }
    // timing (optional object): when the request left and the reply came
    // back, for the live page's clock offset (the token wait not counted).
    if (timing) timing.sentMs = Date.now();
    const { response, data } = await request(endpoint, { method: "POST", headers, body: JSON.stringify(typeof payload === "function" ? payload() : payload || {}), timeoutMs: Math.max(1000, timeoutMs - (Date.now() - startedMs)) });
    if (timing) timing.receivedMs = Date.now();
    if (response.status === 401) {
      if (tokenFailed) throw new SwRequestError("auth_unavailable", AUTH_MESSAGE, 401, data);
      if (typeof onUnauthorized === "function") onUnauthorized(data);
    }
    if (!response.ok) throw new SwRequestError("http", data.error || fallback, response.status, data);
    return data;
  }

  // True when the failure was the connection (worth retrying, and the
  // live page's cue to open from the copy saved on the phone).
  function isConnectionError(error) {
    return Boolean(error) && ["timeout", "offline", "network", "auth_unavailable"].includes(error.kind);
  }

  // The standard failure panel: a heading, the reason, a Try again button
  // and an optional way back. Built with textContent, so no message can
  // inject markup. Returns the Try again button.
  function showRetry(box, { title = "Couldn't verify -- retry", message = "", onRetry, backHref = "", backLabel = "Back to Split Watch", buttonClass = "button button-primary", backClass = "button button-outline" } = {}) {
    if (!box) return null;
    box.textContent = "";
    box.hidden = false;
    const heading = document.createElement("h2");
    heading.textContent = title;
    const text = document.createElement("p");
    text.textContent = message || TIMEOUT_MESSAGE;
    const actions = document.createElement("p");
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = buttonClass;
    retry.textContent = "Try again";
    retry.setAttribute("data-sw-retry", "");
    retry.addEventListener("click", () => {
      retry.disabled = true;
      retry.textContent = "Trying again...";
      if (typeof onRetry === "function") onRetry();
    });
    actions.append(retry);
    if (backHref) {
      const back = document.createElement("a");
      back.className = backClass;
      back.href = backHref;
      back.textContent = backLabel;
      actions.append(" ", back);
    }
    box.append(heading, text, actions);
    return retry;
  }

  return { REQUEST_TIMEOUT_MS, TOKEN_TIMEOUT_MS, TIMEOUT_MESSAGE, SwRequestError, request, api, accessToken, withTimeout, isConnectionError, showRetry, loadDeadline };
})();
