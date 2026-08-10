import { createHmac } from "node:crypto";
import { supabaseAdmin } from "./supabase-admin.mjs";

// Podium Watch's own unofficial fan poll -- a weekly, fan-voted top 16 per
// sport, gender, and division, modeled after the real OATCCC Coaches Poll
// but always labeled as unofficial and separate from it. Follows the
// shape already established by AOTW/TOTW (a *_weeks table with a voting
// window and a status field, an atomic RPC vote-cast function, and a
// hashed voter identifier), reverse-engineered from api/aotw/vote.js and
// api/aotw/current.js since aotw_weeks/totw_weeks predate this project's
// install/ migration convention. See install/09_FAN_POLL.sql and
// docs/DECISIONS.md, 2026-08-06, for the full design reasoning.
//
// This build only actually turns on cross country (divisions 1-4, boys
// and girls) -- the schema is sport-aware so track and field (5
// divisions, matching the rest of this site) can be turned on later with
// no schema changes, once real track division data exists.

const BALLOT_SIZE = 16;
const DIVISION_LABELS = ["I", "II", "III", "IV", "V"];
const SPORT_LABELS = {
  cross_country: "Cross Country",
  indoor_track: "Indoor Track",
  outdoor_track: "Track and Field"
};

function error(message, status = 400, code = "FAN_POLL_ERROR") {
  const value = new Error(message);
  value.status = status;
  value.code = code;
  return value;
}

function clean(value, max = 300) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function divisionLabel(divisionNumber) {
  return `Division ${DIVISION_LABELS[divisionNumber - 1] || divisionNumber}`;
}

export function sportLabel(sport) {
  return SPORT_LABELS[sport] || sport;
}

export function genderLabel(gender) {
  return gender === "girls" ? "Girls" : "Boys";
}

// Which team_pages column holds a team's division for a given
// sport/gender combination. Cross country and track are tracked as
// separate self-reported fields on team_pages -- see
// docs/DECISIONS.md, 2026-08-06.
export function divisionColumnFor(sport, gender) {
  const genderPart = gender === "girls" ? "girls" : "boys";

  if (sport === "cross_country") {
    return `cross_country_${genderPart}_division`;
  }

  return `track_${genderPart}_division`;
}

export function normalizeEmail(value) {
  return clean(value, 320).toLowerCase();
}

export function isValidEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function requireVoteHashSecret() {
  const secret = process.env.VOTE_HASH_SECRET;

  if (!secret || secret.length < 32) {
    throw error(
      "VOTE_HASH_SECRET is missing or is not long enough.",
      500,
      "VOTE_HASH_SECRET_MISSING"
    );
  }

  return secret;
}

// Same HMAC-SHA256 approach AOTW/TOTW already use for their voter
// tokens, keyed on a normalized email instead of an anonymous browser
// token. The raw email is never stored here or anywhere the ballot
// itself can be traced back through -- see fan_poll_email_subscribers
// for the one place a real address is ever written, and only on opt-in.
export function createVoterEmailHash(email) {
  return createHmac("sha256", requireVoteHashSecret())
    .update(`fanpoll-email:${normalizeEmail(email)}`)
    .digest("hex");
}

export function isValidSport(sport) {
  return ["cross_country", "indoor_track", "outdoor_track"].includes(sport);
}

export function isValidGender(gender) {
  return ["boys", "girls"].includes(gender);
}

export function isValidDivisionNumber(divisionNumber) {
  return Number.isInteger(divisionNumber) && divisionNumber >= 1 && divisionNumber <= 5;
}

// Real teams eligible for a ballot in this sport/gender/division --
// pulled directly from team_pages, never free text. Matches the same
// "active team" filter used elsewhere in this project (published, not
// suspended, not archived, not merged).
export async function getEligibleTeams({ sport, gender, divisionNumber }) {
  const column = divisionColumnFor(sport, gender);

  const { data, error: queryError } = await supabaseAdmin
    .from("team_pages")
    .select("id, school_name, slug, logo_url, primary_color")
    .eq(column, divisionLabel(divisionNumber))
    .eq("published", true)
    .eq("suspended", false)
    .is("archived_at", null)
    .is("merged_into_team_id", null)
    .order("school_name", { ascending: true });

  if (queryError) {
    throw queryError;
  }

  return data || [];
}

async function findWeek(query) {
  const { data, error: queryError } = await query.maybeSingle();

  if (queryError) {
    throw queryError;
  }

  return data || null;
}

const WEEK_COLUMNS = "id, week_slug, title, sport, gender, division_number, season_year, voting_opens, voting_closes, status, created_at, updated_at";

// The week voters should see right now: the currently open week if one
// exists, otherwise the most recently closed week (so a division still
// shows real, real results between voting windows instead of nothing),
// otherwise the next scheduled week.
export async function getCurrentWeek({ sport, gender, divisionNumber }) {
  const base = () =>
    supabaseAdmin
      .from("fan_poll_weeks")
      .select(WEEK_COLUMNS)
      .eq("sport", sport)
      .eq("gender", gender)
      .eq("division_number", divisionNumber);

  const open = await findWeek(
    base().eq("status", "voting_open").order("voting_opens", { ascending: false }).limit(1)
  );
  if (open) return open;

  const closed = await findWeek(
    base().eq("status", "voting_closed").order("voting_closes", { ascending: false }).limit(1)
  );
  if (closed) return closed;

  const scheduled = await findWeek(
    base().eq("status", "scheduled").order("voting_opens", { ascending: true }).limit(1)
  );
  return scheduled;
}

// The most recent OTHER week for the same sport/gender/division, used to
// compute point and rank movement. Looked up by voting_opens rather than
// status, so a week that never actually opened doesn't get skipped
// silently.
export async function getPreviousWeek({ sport, gender, divisionNumber, beforeVotingOpens }) {
  return findWeek(
    supabaseAdmin
      .from("fan_poll_weeks")
      .select(WEEK_COLUMNS)
      .eq("sport", sport)
      .eq("gender", gender)
      .eq("division_number", divisionNumber)
      .lt("voting_opens", beforeVotingOpens)
      .order("voting_opens", { ascending: false })
      .limit(1)
  );
}

async function getWeekResultRows(weekId) {
  if (!weekId) {
    return [];
  }

  const { data, error: queryError } = await supabaseAdmin
    .from("fan_poll_week_results")
    .select("team_id, total_points, ballot_count")
    .eq("week_id", weekId)
    .order("total_points", { ascending: false });

  if (queryError) {
    throw queryError;
  }

  return data || [];
}

function rankRows(rows) {
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

// Pure movement math, pulled out of getPollResults so it can be unit
// tested without a live database. hasPreviousWeek distinguishes "this is
// the first week this division has ever run" (no movement context at
// all, null) from "there was a previous week but this team wasn't
// ranked in it" ("new").
export function computeMovement({ previousRank, currentRank, hasPreviousWeek }) {
  if (!hasPreviousWeek) {
    return null;
  }

  if (previousRank === null || previousRank === undefined) {
    return "new";
  }

  return previousRank - currentRank;
}

// Builds the public results view for one sport/gender/division: this
// week's top 16 with points and ballot counts, each team's movement from
// the previous week (a signed number of spots, "new" if it wasn't
// ranked last week at all, or null if there is no previous week yet),
// and team display info (name, slug, logo) joined in from team_pages.
export async function getPollResults({ sport, gender, divisionNumber }) {
  const week = await getCurrentWeek({ sport, gender, divisionNumber });

  if (!week) {
    return { week: null, previousWeek: null, results: [] };
  }

  const [currentRows, previousWeek] = await Promise.all([
    getWeekResultRows(week.id),
    getPreviousWeek({ sport, gender, divisionNumber, beforeVotingOpens: week.voting_opens })
  ]);

  const previousRows = previousWeek ? rankRows(await getWeekResultRows(previousWeek.id)) : [];
  const previousRankByTeam = new Map(previousRows.map((row) => [row.team_id, row.rank]));

  const top16 = rankRows(currentRows).slice(0, BALLOT_SIZE);
  const teamIds = top16.map((row) => row.team_id);

  const { data: teams, error: teamsError } = teamIds.length
    ? await supabaseAdmin
        .from("team_pages")
        .select("id, school_name, slug, logo_url, primary_color")
        .in("id", teamIds)
    : { data: [], error: null };

  if (teamsError) {
    throw teamsError;
  }

  const teamById = new Map((teams || []).map((team) => [team.id, team]));

  const results = top16.map((row) => {
    const previousRank = previousRankByTeam.get(row.team_id) ?? null;
    const movement = computeMovement({
      previousRank,
      currentRank: row.rank,
      hasPreviousWeek: Boolean(previousWeek)
    });

    return {
      team: teamById.get(row.team_id) || null,
      rank: row.rank,
      points: row.total_points,
      ballot_count: row.ballot_count,
      previous_rank: previousRank,
      movement
    };
  });

  return { week, previousWeek, results };
}

function validateBallotShape(entries) {
  if (!Array.isArray(entries) || entries.length !== BALLOT_SIZE) {
    throw error(`A ballot must rank exactly ${BALLOT_SIZE} teams.`, 400, "INVALID_BALLOT_SIZE");
  }

  const ranks = new Set();
  const teamIds = new Set();

  for (const entry of entries) {
    const rank = Number(entry?.rank_position);
    const teamId = clean(entry?.team_id, 100);

    if (!Number.isInteger(rank) || rank < 1 || rank > BALLOT_SIZE) {
      throw error("Every ranked team needs a valid position from 1 to 16.", 400, "INVALID_RANK");
    }

    if (!teamId) {
      throw error("Every ranked position needs a real team.", 400, "MISSING_TEAM");
    }

    if (ranks.has(rank)) {
      throw error("Two teams can't share the same rank on one ballot.", 400, "DUPLICATE_RANK");
    }

    if (teamIds.has(teamId)) {
      throw error("The same team can't appear twice on one ballot.", 400, "DUPLICATE_TEAM");
    }

    ranks.add(rank);
    teamIds.add(teamId);
  }

  return [...teamIds];
}

const BALLOT_REJECTION_MESSAGES = {
  week_not_found: "That poll could not be found.",
  voting_closed: "Voting for this week's fan poll is currently closed.",
  invalid_ballot_size: "A ballot must rank exactly 16 teams.",
  duplicate_teams: "The same team can't appear twice on one ballot.",
  already_voted: "This email address has already submitted a ballot for this week's poll.",
  invalid_team: "One of the selected teams could not be found.",
  invalid_ballot: "This ballot could not be accepted."
};

// Validates a ballot end to end and casts it: shape (16 distinct teams,
// ranks 1-16, no duplicates), that every team is actually eligible for
// this week's sport/gender/division (never free text, never a team from
// the wrong division), then the atomic RPC enforces the one-ballot-per-
// email database constraint. If wantsResultsEmail is set, a real,
// sendable email is written to fan_poll_email_subscribers as a fully
// separate step -- never to the ballot itself, and never if the box
// wasn't checked, but a rejected ballot (already voted, voting closed,
// and so on) never reaches this step either.
export async function submitBallot({
  weekId,
  email,
  entries,
  wantsResultsEmail,
  voterIpHash
}) {
  const cleanWeekId = clean(weekId, 100);

  if (!cleanWeekId) {
    throw error("Choose a poll to vote in.", 400, "MISSING_WEEK");
  }

  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !isValidEmailFormat(normalizedEmail)) {
    throw error("Enter a valid email address to vote.", 400, "INVALID_EMAIL");
  }

  const teamIds = validateBallotShape(entries);

  const { data: week, error: weekError } = await supabaseAdmin
    .from("fan_poll_weeks")
    .select(WEEK_COLUMNS)
    .eq("id", cleanWeekId)
    .maybeSingle();

  if (weekError) {
    throw weekError;
  }

  if (!week) {
    throw error(BALLOT_REJECTION_MESSAGES.week_not_found, 404, "WEEK_NOT_FOUND");
  }

  const eligibleTeams = await getEligibleTeams({
    sport: week.sport,
    gender: week.gender,
    divisionNumber: week.division_number
  });

  const eligibleTeamIds = new Set(eligibleTeams.map((team) => team.id));
  const ineligible = teamIds.filter((teamId) => !eligibleTeamIds.has(teamId));

  if (ineligible.length) {
    throw error(
      `${ineligible.length === teamIds.length ? "None" : "Some"} of the selected teams aren't in ${sportLabel(week.sport)} ${genderLabel(week.gender)} ${divisionLabel(week.division_number)} this week.`,
      400,
      "TEAM_NOT_ELIGIBLE"
    );
  }

  const voterEmailHash = createVoterEmailHash(normalizedEmail);

  const { data: rpcResults, error: rpcError } = await supabaseAdmin.rpc(
    "cast_fan_poll_ballot_v1",
    {
      p_week_id: week.id,
      p_voter_email_hash: voterEmailHash,
      p_voter_ip_hash: clean(voterIpHash, 200) || null,
      p_entries: entries.map((entry) => ({
        team_id: clean(entry.team_id, 100),
        rank_position: Number(entry.rank_position)
      }))
    }
  );

  if (rpcError) {
    throw rpcError;
  }

  const result = Array.isArray(rpcResults) ? rpcResults[0] : rpcResults;

  if (!result) {
    throw error("The fan poll voting function returned no result.", 500, "FAN_POLL_RPC_EMPTY");
  }

  if (!result.accepted) {
    const message = BALLOT_REJECTION_MESSAGES[result.reason] || "Your ballot could not be accepted.";
    const status = result.reason === "already_voted" ? 409 : 400;
    throw error(message, status, String(result.reason || "BALLOT_REJECTED").toUpperCase());
  }

  if (wantsResultsEmail === true) {
    const { error: subscribeError } = await supabaseAdmin
      .from("fan_poll_email_subscribers")
      .insert({
        week_id: week.id,
        email: normalizedEmail
      });

    if (subscribeError) {
      // The ballot itself already succeeded -- a subscription failure
      // (extremely unlikely; the only realistic cause is a transient
      // database error) should never look like the vote failed.
      console.error("Fan poll results-email opt-in could not be saved:", subscribeError);
    }
  }

  return {
    ballotId: result.ballot_id,
    week
  };
}

// --- Admin: scheduling and opening/closing voting windows -----------------
// There is no existing AOTW/TOTW admin action to model this on --
// api/admin/operations.js only ever reads aotw_weeks/totw_weeks for its
// status dashboard, it never opens or closes them (that's evidently done
// by hand in Supabase today). This section is a new, original design,
// built consistent with how other admin actions in this project are
// shaped (api/admin/team-instagram.js, api/admin/teams.js): a small,
// explicit action per operation, each one auditable. See
// docs/DECISIONS.md, 2026-08-06.

export function maxDivisionForSport(sport) {
  return sport === "cross_country" ? 4 : 5;
}

// Pure reducer pulled out of getBallotCountsByWeek so it can be unit
// tested without a live database, matching the computeMovement pattern
// above. Counts total ballots per week -- not the same thing as
// fan_poll_week_results.ballot_count, which counts (per team) how many
// ballots included that specific team, not the total number of voters
// who voted in that week/division at all.
export function countBallotsByWeekId(ballotRows) {
  const counts = new Map();

  for (const row of ballotRows || []) {
    const weekId = row?.week_id;
    if (!weekId) continue;
    counts.set(weekId, (counts.get(weekId) || 0) + 1);
  }

  return counts;
}

// Total ballots submitted per week, i.e. per sport/gender/division since
// a week is already scoped to exactly one of those -- what the admin
// dashboard needs to show "how many ballots per division," which is a
// different number than fan_poll_week_results' per-team ballot_count.
// One flat query for just the week_id column (not full ballot rows),
// reduced client-side, rather than a per-week query in a loop.
export async function getBallotCountsByWeek(weekIds) {
  const cleanWeekIds = [...new Set((weekIds || []).filter(Boolean))];
  if (!cleanWeekIds.length) {
    return new Map();
  }

  const { data, error: queryError } = await supabaseAdmin
    .from("fan_poll_ballots")
    .select("week_id")
    .in("week_id", cleanWeekIds);

  if (queryError) {
    throw queryError;
  }

  return countBallotsByWeekId(data);
}

export async function listWeeks({ sport, gender, divisionNumber, limit = 20 } = {}) {
  let query = supabaseAdmin
    .from("fan_poll_weeks")
    .select(WEEK_COLUMNS)
    .order("voting_opens", { ascending: false })
    .limit(limit);

  if (sport) query = query.eq("sport", sport);
  if (gender) query = query.eq("gender", gender);
  if (Number.isInteger(divisionNumber)) query = query.eq("division_number", divisionNumber);

  const { data, error: queryError } = await query;

  if (queryError) {
    throw queryError;
  }

  const weeks = data || [];
  const ballotCounts = await getBallotCountsByWeek(weeks.map((week) => week.id));

  return weeks.map((week) => ({
    ...week,
    ballot_count: ballotCounts.get(week.id) || 0
  }));
}

function buildWeekSlug({ sport, gender, divisionNumber, votingOpens }) {
  const datePart = new Date(votingOpens).toISOString().slice(0, 10);
  return `${sport.replace(/_/g, "-")}-${gender}-division-${divisionNumber}-${datePart}`;
}

export async function createWeek({
  sport,
  gender,
  divisionNumber,
  seasonYear,
  votingOpens,
  votingCloses,
  actor
}) {
  if (!isValidSport(sport)) {
    throw error("Choose a real sport.", 400, "INVALID_SPORT");
  }

  if (!isValidGender(gender)) {
    throw error("Choose boys or girls.", 400, "INVALID_GENDER");
  }

  if (!isValidDivisionNumber(divisionNumber) || divisionNumber > maxDivisionForSport(sport)) {
    throw error(
      `${sportLabel(sport)} only has divisions 1 through ${maxDivisionForSport(sport)}.`,
      400,
      "INVALID_DIVISION"
    );
  }

  const year = Number(seasonYear);

  if (!Number.isInteger(year) || year < 2000 || year > 2200) {
    throw error("Choose a real season year.", 400, "INVALID_SEASON_YEAR");
  }

  const opens = new Date(votingOpens);
  const closes = new Date(votingCloses);

  if (Number.isNaN(opens.getTime()) || Number.isNaN(closes.getTime()) || closes <= opens) {
    throw error("Voting must open before it closes.", 400, "INVALID_VOTING_WINDOW");
  }

  const title = `${sportLabel(sport)} ${genderLabel(gender)} ${divisionLabel(divisionNumber)} Fan Poll`;
  const weekSlug = buildWeekSlug({ sport, gender, divisionNumber, votingOpens: opens.toISOString() });

  const { data, error: insertError } = await supabaseAdmin
    .from("fan_poll_weeks")
    .insert({
      week_slug: weekSlug,
      title,
      sport,
      gender,
      division_number: divisionNumber,
      season_year: year,
      voting_opens: opens.toISOString(),
      voting_closes: closes.toISOString(),
      status: "scheduled",
      created_by: actor,
      updated_by: actor
    })
    .select(WEEK_COLUMNS)
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      throw error("A poll week with that slug already exists.", 409, "WEEK_SLUG_TAKEN");
    }

    throw insertError;
  }

  return data;
}

async function setWeekStatus({ weekId, fromStatuses, toStatus, actor }) {
  const cleanWeekId = clean(weekId, 100);

  if (!cleanWeekId) {
    throw error("Choose a poll week.", 400, "MISSING_WEEK");
  }

  const { data: week, error: fetchError } = await supabaseAdmin
    .from("fan_poll_weeks")
    .select(WEEK_COLUMNS)
    .eq("id", cleanWeekId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (!week) {
    throw error("That poll week could not be found.", 404, "WEEK_NOT_FOUND");
  }

  if (!fromStatuses.includes(week.status)) {
    throw error(
      `This poll week is currently "${week.status}" and can't move to "${toStatus}" from there.`,
      409,
      "INVALID_STATUS_TRANSITION"
    );
  }

  const { data, error: updateError } = await supabaseAdmin
    .from("fan_poll_weeks")
    .update({ status: toStatus, updated_by: actor })
    .eq("id", cleanWeekId)
    .select(WEEK_COLUMNS)
    .single();

  if (updateError) {
    throw updateError;
  }

  return data;
}

export async function openVoting({ weekId, actor }) {
  return setWeekStatus({
    weekId,
    fromStatuses: ["scheduled"],
    toStatus: "voting_open",
    actor
  });
}

export async function closeVoting({ weekId, actor }) {
  return setWeekStatus({
    weekId,
    fromStatuses: ["voting_open"],
    toStatus: "voting_closed",
    actor
  });
}
