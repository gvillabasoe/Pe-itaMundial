/**
 * Validation tests for World Cup 2026 schedule and helpers.
 * Run with: npx tsx lib/worldcup/__tests__/validate.test.ts
 * (Or integrate with your test runner of choice)
 */

import { validateSchedule } from "../validate";
import { WORLD_CUP_MATCHES, getMatchesByStage, getMatchesByTeam } from "../schedule";
import { normalizeTeamKey, getFlagForTeam, getFlagEmoji } from "../normalize-team";
import { REGION_BY_CITY, getZoneForCity } from "../zones";
import { PREDICTION_TEAMS, TEAM_ORDER } from "../../predictions/team-config";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function section(name: string) {
  console.log(`\n─── ${name} ───`);
}

// ═══ SCHEDULE VALIDATION ═══
section("Schedule Validation (104 matches)");

const result = validateSchedule();
assert(result.valid, "Schedule passes all validations");
if (!result.valid) {
  result.errors.forEach(e => console.error(`    ERROR: ${e}`));
}

assert(WORLD_CUP_MATCHES.length === 104, "Exactly 104 matches");

const groups = getMatchesByStage("group");
assert(groups.length === 72, "72 group stage matches");

const r32 = getMatchesByStage("round-of-32");
assert(r32.length === 16, "16 round-of-32 matches");

const r16 = getMatchesByStage("round-of-16");
assert(r16.length === 8, "8 round-of-16 matches");

const qf = getMatchesByStage("quarter-final");
assert(qf.length === 4, "4 quarter-final matches");

const sf = getMatchesByStage("semi-final");
assert(sf.length === 2, "2 semi-final matches");

const third = getMatchesByStage("third-place");
assert(third.length === 1, "1 third-place match");

const final = getMatchesByStage("final");
assert(final.length === 1, "1 final match");

// IDs 1-104 consecutive
const ids = WORLD_CUP_MATCHES.map(m => m.id).sort((a, b) => a - b);
assert(ids[0] === 1, "First ID is 1");
assert(ids[103] === 104, "Last ID is 104");
assert(new Set(ids).size === 104, "No duplicate IDs");

// ═══ CITY/REGION MAPPING ═══
section("City/Region Mapping");

const allCities = [...new Set(WORLD_CUP_MATCHES.map(m => m.hostCity))];
assert(allCities.length === 16, `16 unique cities (got ${allCities.length})`);

for (const city of allCities) {
  const zone = getZoneForCity(city);
  assert(zone !== null, `City "${city}" has a zone (${zone})`);
}

const zones = new Set(WORLD_CUP_MATCHES.map(m => m.zone));
assert(zones.size === 3, "Exactly 3 zones used");
assert(zones.has("west"), "Zone 'west' present");
assert(zones.has("central"), "Zone 'central' present");
assert(zones.has("east"), "Zone 'east' present");

// ═══ TEAM NAME NORMALIZATION ═══
section("Team Name Normalization");

assert(normalizeTeamKey("España") === "espana", "España → espana");
assert(normalizeTeamKey("Países Bajos") === "paises_bajos", "Países Bajos → paises_bajos");
assert(normalizeTeamKey("Corea del Sur") === "corea_del_sur", "Corea del Sur → corea_del_sur");
assert(normalizeTeamKey("Costa de Marfil") === "costa_de_marfil", "Costa de Marfil → costa_de_marfil");
assert(normalizeTeamKey("Bosnia y Herzegovina") === "bosnia_y_herzegovina", "Bosnia y Herzegovina → bosnia_y_herzegovina");
assert(normalizeTeamKey("Nueva Zelanda") === "nueva_zelanda", "Nueva Zelanda → nueva_zelanda");
assert(normalizeTeamKey("Estados Unidos") === "estados_unidos", "Estados Unidos → estados_unidos");
assert(normalizeTeamKey("Arabia Saudí") === "arabia_saudi", "Arabia Saudí → arabia_saudi");
assert(normalizeTeamKey("RD Congo") === "rd_del_congo", "RD Congo → rd_del_congo");

// ═══ FLAG RESOLUTION ═══
section("Flag Resolution");

const teamsWithFlags = [
  "España", "Argentina", "Francia", "Alemania", "Brasil",
  "México", "Uruguay", "Colombia", "Portugal", "Inglaterra",
];

for (const team of teamsWithFlags) {
  const flag = getFlagForTeam(team);
  assert(flag !== null, `Flag found for "${team}" → ${flag}`);
}

// Emoji fallback always works
for (const team of teamsWithFlags) {
  const emoji = getFlagEmoji(team);
  assert(emoji !== "🏳️", `Emoji found for "${team}" → ${emoji}`);
}

// ═══ PREDICTION TEAM ORDER ═══
section("Prediction Team Order");

assert(TEAM_ORDER[0] === "espana", "España is first in order");
assert(PREDICTION_TEAMS[0].isPrimaryFocus === true, "España is primary focus");
assert(PREDICTION_TEAMS.length === 7, "7 prediction teams");

const espanaConfig = PREDICTION_TEAMS.find(t => t.teamKey === "espana");
assert(espanaConfig?.color === "#C1121F", "España color is #C1121F");

// ═══ SPAIN MATCHES ═══
section("Spain Matches");

const spainMatches = getMatchesByTeam("España");
assert(spainMatches.length >= 3, `Spain has at least 3 matches (got ${spainMatches.length})`);
assert(spainMatches.some(m => m.hostCity === "Atlanta"), "Spain plays in Atlanta");

// ═══ SUMMARY ═══
console.log(`\n═══════════════════════════════`);
console.log(`Tests: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) {
  console.error("SOME TESTS FAILED");
  process.exit(1);
} else {
  console.log("ALL TESTS PASSED ✓");
}
