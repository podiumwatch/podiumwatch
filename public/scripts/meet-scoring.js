// Reusable cross country dual/invitational team-scoring math, shared by
// the meet scoring calculator (src/pages/scoringcalculator.mjs). Exposed
// as window.PodiumMeetScoring, matching the same namespacing pattern
// public/scripts/team-auth-client.js and public/scripts/pace-splits.js
// already use. No DOM access here -- this file is pure calculation,
// which is also what lets scripts/test-scoring-calculator.mjs exercise
// it directly from Node with only a minimal window stub.
(() => {
  // Standard NFHS cross country scoring: each team's score is the sum of
  // the overall finish places of its first 5 finishers -- lower score
  // wins. A team needs at least 5 finishers to score at all. The 6th and
  // 7th finishers ("displacers") never count toward the score, but they
  // still occupy a real place, which can push back opposing teams'
  // scorers. Unattached/no-team finishers work the same way: they
  // occupy a place (so they can displace) but never score for anyone.
  const MIN_SCORING_FINISHERS = 5;
  const DISPLACER_COUNT = 2;

  // finishOrder: an array in finish order (index 0 = 1st place) of
  // either { teamId, teamName } or a null/no-team entry. Every element
  // -- scoring or not -- occupies a place number (index + 1), which is
  // what makes displacement automatic: no separate "push back" logic is
  // needed because every function here works from real overall place
  // numbers, never from a within-team count.
  function computeTeamScores(finishOrder) {
    const teams = new Map();

    finishOrder.forEach((entry, index) => {
      if (!entry || !entry.teamId) return;
      const place = index + 1;
      if (!teams.has(entry.teamId)) {
        teams.set(entry.teamId, { teamId: entry.teamId, teamName: entry.teamName || entry.teamId, places: [] });
      }
      teams.get(entry.teamId).places.push(place);
    });

    return Array.from(teams.values()).map((team) => {
      const places = team.places.slice().sort((a, b) => a - b);
      const finisherCount = places.length;
      const complete = finisherCount >= MIN_SCORING_FINISHERS;
      const scoringPlaces = complete ? places.slice(0, MIN_SCORING_FINISHERS) : [];
      const displacerPlaces = complete ? places.slice(MIN_SCORING_FINISHERS, MIN_SCORING_FINISHERS + DISPLACER_COUNT) : [];
      const score = complete ? scoringPlaces.reduce((sum, p) => sum + p, 0) : null;

      return {
        teamId: team.teamId,
        teamName: team.teamName,
        finisherCount,
        allPlaces: places,
        scoringPlaces,
        displacerPlaces,
        score,
        complete
      };
    });
  }

  // Ranks the complete (>=5 finisher) teams by ascending score. Ties in
  // total score are broken by the standard NFHS rule: compare the tied
  // teams' worst (5th, last-counted) scorer first -- whichever is the
  // lower/earlier place wins -- then the 4th, 3rd, and so on if still
  // tied. Since every place number in a race belongs to exactly one
  // runner from exactly one team, two different teams can never have an
  // identical scoringPlaces array, so this loop is always guaranteed to
  // find a deciding difference -- there is no such thing as a true,
  // unresolvable tie in this sport's scoring rules. `scoreTied` is kept
  // as an informational flag only (so the UI can note when the raw
  // totals matched before the tie-break decided it); it never affects
  // the actual computed rank order.
  function rankTeams(teamScores) {
    const unscored = teamScores.filter((t) => !t.complete);

    const sorted = teamScores.filter((t) => t.complete).sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      for (let i = MIN_SCORING_FINISHERS - 1; i >= 0; i -= 1) {
        const diff = a.scoringPlaces[i] - b.scoringPlaces[i];
        if (diff !== 0) return diff;
      }
      return 0;
    });

    const ranked = sorted.map((team, index) => ({
      ...team,
      rank: index + 1,
      scoreTied: (index > 0 && sorted[index - 1].score === team.score)
        || (index < sorted.length - 1 && sorted[index + 1].score === team.score)
    }));

    return { ranked, unscored };
  }

  window.PodiumMeetScoring = {
    MIN_SCORING_FINISHERS,
    DISPLACER_COUNT,
    computeTeamScores,
    rankTeams
  };
})();
