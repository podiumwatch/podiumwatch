import { layout, pageHero } from "../lib/html.mjs";

// A standalone home for Podium Play, independent of any current vote.
// Real user report (2026-09-02): on the Athlete/Team of the Week pages,
// the whole Podium Play panel lives inside a section that
// weekly-awards.js hides completely whenever there's no active award
// period (see renderCurrent()'s own `if (!week) { currentSection.hidden
// = true; ... }`) -- meaning the games became entirely unreachable
// between voting periods. This page renders the exact same panel
// (public/scripts/podium-play.js's initPanel(), same points/records/
// levels/leaderboard/world-records, same server-authoritative scoring)
// with nothing that can ever hide it -- games stay playable whether or
// not either weekly award currently has an open vote.
//
// data-podium-play-standalone (not data-weekly-award) is what
// podium-play.js's own init listener looks for to wire this up -- see
// that file's own comment at the DOMContentLoaded listener.
export function podiumPlayPage(site) {
  const pathname = "/podium-play/";

  const content = `${pageHero({
    eyebrow: "Podium Watch",
    title: "Podium Play.",
    description: "Running-themed mini games, real Podium Points, and a 15-level climb from Rookie Runner to Podium Legend. Always here to play -- whether or not a vote is currently open."
  })}

  <section class="section section-paper">
    <div class="container" data-podium-play-standalone data-award-type="standalone">
      <div class="pp-panel" data-podium-play></div>
    </div>
  </section>

  <section class="section">
    <div class="container content-grid">
      <div>
        <p class="eyebrow">Keep voting too</p>
        <h2>Podium Points never touch a vote</h2>
      </div>
      <div class="prose">
        <p>Playing here never adds a vote, unlocks extra votes, or changes anyone's standing -- Podium Points are only for your own game profile and progress. If you're also here to vote, head to <a href="/athlete-of-the-week/">Athlete of the Week</a> or <a href="/team-of-the-week/">Team of the Week</a> to see this week's finalists.</p>
      </div>
    </div>
  </section>

  <script src="/scripts/team-auth-client.js" defer></script>
  <script src="/scripts/podium-play.js" defer></script>`;

  return layout({
    site,
    title: "Podium Play",
    description: "Play Podium Watch's running-themed mini games anytime -- earn real Podium Points and climb all 15 player levels, whether or not a vote is currently open.",
    pathname,
    content
  });
}
