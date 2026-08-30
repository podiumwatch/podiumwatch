import test from "node:test";
import assert from "node:assert/strict";
import { buildFinalistFromNomination, buildNominationInsert } from "../lib/awards_service.mjs";

function aotwNomination(overrides = {}) {
  return {
    id: "nom-aotw-1",
    week_id: "week-1",
    athlete_name: "Jane Doe",
    school: "Example High School",
    grade: "Junior",
    gender: "girls",
    event_name: "2 Mile",
    performance: "10:45.2",
    meet_name: "Example Invitational",
    performance_date: "2026-08-20",
    reason: "Ran a huge personal best and led her team to a win.",
    result_url: "https://example.com/results",
    photo_url: "https://example.com/photo.jpg",
    nominator_name: "A Coach",
    nominator_email: "coach@example.com",
    reviewed: false,
    selected: false,
    promoted_finalist_id: null,
    ...overrides
  };
}

function totwNomination(overrides = {}) {
  return {
    id: "nom-totw-1",
    week_id: "week-2",
    category: "boys",
    team_name: "Example Wildcats",
    school: "Example High School",
    sport: "Cross Country",
    division: "II",
    achievement: "Won the conference championship.",
    meet_name: "Conference Meet",
    performance_date: "2026-08-22",
    reason: "Dominated every scoring position.",
    result_url: null,
    photo_url: "https://example.com/team.jpg",
    nominator_name: "A Fan",
    nominator_email: "fan@example.com",
    reviewed: false,
    selected: false,
    promoted_finalist_id: null,
    ...overrides
  };
}

test("an invalid award type is rejected", () => {
  assert.throws(() => buildFinalistFromNomination({ type: "not_real", nomination: aotwNomination() }), /athlete or team/i);
});

test("AOTW: identity fields map straight across from the nomination", () => {
  const finalist = buildFinalistFromNomination({ type: "aotw", nomination: aotwNomination() });
  assert.equal(finalist.athlete_name, "Jane Doe");
  assert.equal(finalist.school, "Example High School");
  assert.equal(finalist.grade, "Junior");
  assert.equal(finalist.week_id, "week-1");
  assert.equal(finalist.source_nomination_id, "nom-aotw-1");
  assert.equal(finalist.winner, false);
});

test("AOTW: default achievement is composed from performance/event/meet, description from reason", () => {
  const finalist = buildFinalistFromNomination({ type: "aotw", nomination: aotwNomination() });
  assert.equal(finalist.achievement, "10:45.2 in the 2 Mile at Example Invitational");
  assert.equal(finalist.description, "Ran a huge personal best and led her team to a win.");
  assert.equal(finalist.image_url, "https://example.com/photo.jpg");
});

test("AOTW: an admin override replaces every default, not just the ones they touched", () => {
  const finalist = buildFinalistFromNomination({
    type: "aotw",
    nomination: aotwNomination(),
    overrides: { achievement: "Custom headline", description: "Custom body copy.", image_url: "https://example.com/other.jpg", sort_order: 3 }
  });
  assert.equal(finalist.achievement, "Custom headline");
  assert.equal(finalist.description, "Custom body copy.");
  assert.equal(finalist.image_url, "https://example.com/other.jpg");
  assert.equal(finalist.sort_order, 3);
});

test("AOTW: an unsafe photo URL override is dropped rather than saved", () => {
  const finalist = buildFinalistFromNomination({
    type: "aotw",
    nomination: aotwNomination(),
    overrides: { image_url: "javascript:alert(1)" }
  });
  assert.equal(finalist.image_url, null);
});

test("TOTW: category and sport/division map straight across, achievement copies directly (no composition needed)", () => {
  const finalist = buildFinalistFromNomination({ type: "totw", nomination: totwNomination() });
  assert.equal(finalist.team_name, "Example Wildcats");
  assert.equal(finalist.category, "boys");
  assert.equal(finalist.sport, "Cross Country");
  assert.equal(finalist.division, "II");
  assert.equal(finalist.achievement, "Won the conference championship.");
  assert.equal(finalist.description, "Dominated every scoring position.");
  assert.equal(finalist.source_nomination_id, "nom-totw-1");
});

test("a missing photo URL on the nomination leaves image_url null, not an empty string", () => {
  const finalist = buildFinalistFromNomination({ type: "aotw", nomination: aotwNomination({ photo_url: "" }) });
  assert.equal(finalist.image_url, null);
});

test("sort_order defaults to 0 when not provided or not an integer", () => {
  const finalist = buildFinalistFromNomination({ type: "aotw", nomination: aotwNomination() });
  assert.equal(finalist.sort_order, 0);
  const withBadOverride = buildFinalistFromNomination({ type: "aotw", nomination: aotwNomination(), overrides: { sort_order: "not-a-number" } });
  assert.equal(withBadOverride.sort_order, 0);
});

function aotwFields(overrides = {}) {
  return {
    athlete_name: "Jane Doe",
    school: "Example High School",
    grade: "Junior",
    gender: "girls",
    event_name: "2 Mile",
    performance: "10:45.2",
    reason: "Ran a huge personal best.",
    nominator_email: "podiumwatchohio@gmail.com",
    ...overrides
  };
}

function totwFields(overrides = {}) {
  return {
    category: "boys",
    team_name: "Example Wildcats",
    school: "Example High School",
    sport: "Cross Country",
    achievement: "Won the conference championship.",
    reason: "Dominated every scoring position.",
    nominator_email: "podiumwatchohio@gmail.com",
    ...overrides
  };
}

test("an admin-added AOTW nomination builds a valid row with the expected defaults", () => {
  const row = buildNominationInsert({ type: "aotw", weekId: "week-1", fields: aotwFields() });
  assert.equal(row.week_id, "week-1");
  assert.equal(row.athlete_name, "Jane Doe");
  assert.equal(row.nominator_name, "Podium Watch Admin");
  assert.equal(row.reviewed, true);
  assert.equal(row.selected, false);
});

test("an admin-added TOTW nomination builds a valid row", () => {
  const row = buildNominationInsert({ type: "totw", weekId: "week-2", fields: totwFields() });
  assert.equal(row.category, "boys");
  assert.equal(row.team_name, "Example Wildcats");
  assert.equal(row.achievement, "Won the conference championship.");
});

test("a missing week id is rejected", () => {
  assert.throws(() => buildNominationInsert({ type: "aotw", weekId: "", fields: aotwFields() }), /choose a week/i);
});

test("an invalid nominator email is rejected", () => {
  assert.throws(() => buildNominationInsert({ type: "aotw", weekId: "week-1", fields: aotwFields({ nominator_email: "not-an-email" }) }), /valid nominator email/i);
});

test("a missing required field is rejected with a specific message per type", () => {
  assert.throws(() => buildNominationInsert({ type: "aotw", weekId: "week-1", fields: aotwFields({ athlete_name: "" }) }), /athlete's name/i);
  assert.throws(() => buildNominationInsert({ type: "totw", weekId: "week-2", fields: totwFields({ team_name: "" }) }), /team name/i);
});

test("an invalid TOTW category is rejected", () => {
  assert.throws(() => buildNominationInsert({ type: "totw", weekId: "week-2", fields: totwFields({ category: "coed" }) }), /boys or girls/i);
});

test("a blank nominator name falls back to Podium Watch Admin", () => {
  const row = buildNominationInsert({ type: "aotw", weekId: "week-1", fields: aotwFields({ nominator_name: "" }) });
  assert.equal(row.nominator_name, "Podium Watch Admin");
});

test("an invalid performance date is rejected rather than silently dropped", () => {
  assert.throws(() => buildNominationInsert({ type: "aotw", weekId: "week-1", fields: aotwFields({ performance_date: "not-a-date" }) }), /valid performance date/i);
});
