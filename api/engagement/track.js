import { analyticsRow, writeAnalyticsBatch } from "../../lib/engagement_service.mjs";
import { createAnalyticsBuffer, waitUntil } from "../../lib/analytics_buffer.mjs";

// Analytics intake (2026-11-11). Always answers 204 at once and never
// touches the database while the visitor waits: the event is checked in
// memory, queued, and written in a batch after the response (see
// lib/analytics_buffer.mjs). Bad or oversized events are dropped quietly.
// Browsers send with navigator.sendBeacon and never read the answer.

let dropped = 0;
const buffer = createAnalyticsBuffer({
  write: writeAnalyticsBatch,
  onDrop(count, error) {
    dropped += count;
    // One short line per drop, no stack: a slow database during a traffic
    // spike should not flood the logs.
    console.warn(`Analytics batch dropped (${count} rows, ${dropped} this instance): ${error?.message || error}`);
  }
});

function parseBody(request) {
  const body = request.body;
  if (typeof body === "string") {
    if (body.length > 30000) return null;
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  if (Buffer.isBuffer(body)) {
    if (body.length > 30000) return null;
    try {
      return JSON.parse(body.toString("utf8"));
    } catch {
      return null;
    }
  }
  return body && typeof body === "object" ? body : null;
}

export default function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).end();
  }

  let row = null;
  try {
    row = analyticsRow(parseBody(request));
  } catch {
    row = null;
  }

  response.status(204).end();
  if (row) waitUntil(buffer.add(row));
}
