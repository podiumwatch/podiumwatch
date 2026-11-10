// Presence ("Live now" in the admin Engagement Center) is turned off
// (2026-11-10). Every open tab sent a Redis heartbeat once a minute, and
// Redis holds the award votes; the votes matter far more. Pages built
// after that date no longer load this file. It stays as an empty script
// so a page cached from before still loads without an error.
