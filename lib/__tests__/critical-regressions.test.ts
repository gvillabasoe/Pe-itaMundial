import assert from "node:assert/strict";
import { createDefaultAdminResults, KNOCKOUT_ADMIN_COUNTS, sanitizeAdminResults } from "@/lib/admin-results";
import { FIXTURES, GROUPS, SCORING, type MatchPick, type Team } from "@/lib/data";
import { buildStoredTeamFromDraft, createEmptyPorraDraft } from "@/lib/porra-builder";
import { scoreParticipants } from "@/lib/scoring";
import { assertUserTeamMutationAllowed, USER_TEAM_AUTH_ERROR, USER_TEAM_DEADLINE_ERROR } from "@/lib/server/user-team-permissions";
import { sanitizeUserTeam } from "@/lib/user-teams";
import { EDIT_DEADLINE, isPastEditDeadline } from "@/lib/edit-deadline";
import { normalizeCountryKey } from "@/lib/flags";
import { WORLD_CUP_MATCHES } from "@/lib/worldcup/schedule";

function test(name: string, fn: () => void) {
  fn();
  console.log(`ok - ${name}`);
}

function allTeams() {
  return Object.values(GROUPS).flat();
}

function createBaseTeam(id = "team-u1-test"): Team {
  const draft = createEmptyPorraDraft("u1", "alice");
  draft.id = id;
  draft.teamName = "Alice Test";
  return buildStoredTeamFromDraft(draft);
}

function asPendingPick(home: number | null, away: number | null): MatchPick {
  return { home, away, points: null, status: "pending" };
}

function key(home: string, away: string) {
  return `${normalizeCountryKey(home)}|${normalizeCountryKey(away)}`;
}

function findFixtureForOfficialMatch(matchId: number) {
  const match = WORLD_CUP_MATCHES.find((item) => item.id === matchId);
  assert.ok(match, `official match ${matchId} exists`);

  const directKey = key(match!.homeTeam, match!.awayTeam);
  const reverseKey = key(match!.awayTeam, match!.homeTeam);
  const fixture = FIXTURES.find((item) => key(item.homeTeam, item.awayTeam) === directKey || key(item.homeTeam, item.awayTeam) === reverseKey);
  assert.ok(fixture, `fixture for official match ${matchId} exists`);
  return { match: match!, fixture: fixture!, flipped: key(fixture!.homeTeam, fixture!.awayTeam) === reverseKey };
}

test("scoring recalculates when admin results contain data even if configured is false", () => {
  const { fixture, flipped } = findFixtureForOfficialMatch(1);
  const team = createBaseTeam();
  const admin = createDefaultAdminResults();
  admin.matchResults["1"] = { home: 1, away: 0, statusShort: "FT" };
  admin.configured = false;

  team.matchPicks[fixture.id] = flipped ? asPendingPick(0, 1) : asPendingPick(1, 0);

  const [scored] = scoreParticipants([team], admin);
  assert.equal(scored.matchPicks[fixture.id].points, SCORING.resultadoExactoTotal);
  assert.equal(scored.totalPoints, SCORING.resultadoExactoTotal);
});

test("inverted local group fixtures swap official home and away before scoring", () => {
  const reversed = WORLD_CUP_MATCHES
    .filter((match) => match.stage === "group")
    .map((match) => findFixtureForOfficialMatch(match.id))
    .find((item) => item.flipped);

  assert.ok(reversed, "at least one fixture is reversed versus the official schedule");

  const team = createBaseTeam("team-u1-reversed");
  const admin = createDefaultAdminResults();
  admin.matchResults[String(reversed!.match.id)] = { home: 1, away: 2, statusShort: "FT" };
  admin.configured = false;

  team.matchPicks[reversed!.fixture.id] = asPendingPick(2, 1);

  const [scored] = scoreParticipants([team], admin);
  assert.equal(scored.matchPicks[reversed!.fixture.id].points, SCORING.resultadoExactoTotal);
});

test("knockout scoring uses admin round counts consistently", () => {
  const teams = allTeams().slice(0, KNOCKOUT_ADMIN_COUNTS.octavos);
  const admin = createDefaultAdminResults();
  admin.knockoutRounds.octavos = teams;
  admin.configured = false;

  const team = createBaseTeam("team-u1-knockout");
  team.knockoutPicks.dieciseisavos = teams.map((country) => ({ country, points: null, status: "pending" }));

  const [scored] = scoreParticipants([team], sanitizeAdminResults(admin));
  assert.equal(scored.knockoutPicks.dieciseisavos.length, 16);
  assert.equal(scored.knockoutPicks.dieciseisavos[0].points, SCORING.eliminatorias.dieciseisavos);
  assert.equal(scored.knockoutPicks.dieciseisavos.every((pick) => pick.status !== "pending"), true);
});

test("incomplete saved drafts preserve null scores instead of writing 0-0", () => {
  const draft = createEmptyPorraDraft("u1", "alice");
  draft.teamName = "Incomplete";

  const stored = buildStoredTeamFromDraft(draft);
  const firstFixture = FIXTURES[0];
  assert.equal(stored.matchPicks[firstFixture.id].home, null);
  assert.equal(stored.matchPicks[firstFixture.id].away, null);

  const sanitized = sanitizeUserTeam(stored);
  assert.ok(sanitized);
  assert.equal(sanitized!.matchPicks[firstFixture.id].home, null);
  assert.equal(sanitized!.matchPicks[firstFixture.id].away, null);
});

test("deadline helper enforces the business cutoff exactly", () => {
  assert.equal(EDIT_DEADLINE.toISOString(), "2026-06-10T19:00:00.000Z");
  assert.equal(isPastEditDeadline(new Date("2026-06-10T18:59:59.999Z").getTime()), false);
  assert.equal(isPastEditDeadline(new Date("2026-06-10T19:00:00.000Z").getTime()), true);
  assert.equal(isPastEditDeadline(new Date("2026-06-10T19:00:00.001Z").getTime()), true);
});

test("create/update/delete authorization rejects client-supplied foreign userIds", () => {
  assert.throws(
    () => assertUserTeamMutationAllowed({ operation: "create", isAdmin: false, actorUserId: "u1", ownerUserId: "u2", isPastDeadline: false }),
    (error) => error instanceof Error && error.message === USER_TEAM_AUTH_ERROR
  );

  assert.doesNotThrow(() =>
    assertUserTeamMutationAllowed({ operation: "create", isAdmin: false, actorUserId: "u1", ownerUserId: "u1", isPastDeadline: false })
  );

  assert.throws(
    () => assertUserTeamMutationAllowed({ operation: "update", isAdmin: false, actorUserId: "u1", ownerUserId: "u1", existingOwnerUserId: "u2", isPastDeadline: false }),
    (error) => error instanceof Error && error.message === USER_TEAM_AUTH_ERROR
  );

  assert.throws(
    () => assertUserTeamMutationAllowed({ operation: "delete", isAdmin: false, actorUserId: "u1", existingOwnerUserId: "u2", isPastDeadline: false }),
    (error) => error instanceof Error && error.message === USER_TEAM_AUTH_ERROR
  );

  assert.throws(
    () => assertUserTeamMutationAllowed({ operation: "update", isAdmin: false, actorUserId: "u1", ownerUserId: "u1", isPastDeadline: true }),
    (error) => error instanceof Error && error.message === USER_TEAM_DEADLINE_ERROR
  );

  assert.doesNotThrow(() =>
    assertUserTeamMutationAllowed({ operation: "delete", isAdmin: true, actorUserId: null, existingOwnerUserId: "u2", isPastDeadline: true })
  );
});
