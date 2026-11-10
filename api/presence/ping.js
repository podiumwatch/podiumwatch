// Presence is turned off (2026-11-10): heartbeats cost Redis commands and
// Redis holds the award votes. Tabs opened before the change may still
// ping until they reload; this answers them without touching Redis.
export default function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  return response.status(204).end();
}
