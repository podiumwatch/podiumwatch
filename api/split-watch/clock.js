// Split Watch clock sync (track build Phase 1, race clock accuracy,
// 2026-11-12). Answers only "what time is it on the server": the moment
// the request arrived and the moment the reply left, in milliseconds. No
// sign-in, no database, nothing private -- so it answers as fast as the
// server can, and the phone can measure its clock correction NTP-style
// (public/scripts/race-clock-sync.js), with the server's own processing
// time taken out of the measurement.
export default function handler(request, response) {
  const receivedMs = Date.now();
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET" && request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed." });
  }
  return response.status(200).json({ server_received_ms: receivedMs, server_sent_ms: Date.now() });
}
