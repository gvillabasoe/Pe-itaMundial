/**
 * Test del mapeo fixtureId → matchId en lib/scoring.ts
 * Garantiza que TODOS los fixtures de grupo del mock se mapean
 * correctamente al schedule oficial, independientemente del orden
 * home/away. Si este test falla, los puntos por marcador exacto
 * dejarán de calcularse para algunos partidos.
 *
 * Run con: npx tsx lib/__tests__/scoring-mapping.test.ts
 */

import { FIXTURES } from "../data";
import { WORLD_CUP_MATCHES } from "../worldcup/schedule";
import { normalizeCountryKey } from "../flags";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    // eslint-disable-next-line no-console
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    // eslint-disable-next-line no-console
    console.error(`  ✗ ${label}`);
  }
}

const pairMap = new Map<string, string>();
const buildKey = (h: string, a: string) => `${normalizeCountryKey(h)}|${normalizeCountryKey(a)}`;

WORLD_CUP_MATCHES.filter((m) => m.stage === "group").forEach((m) => {
  pairMap.set(buildKey(m.homeTeam, m.awayTeam), String(m.id));
  pairMap.set(buildKey(m.awayTeam, m.homeTeam), String(m.id));
});

// eslint-disable-next-line no-console
console.log("\n─── Test: mapeo fixtureId → matchId ───");

const groupFixtures = FIXTURES.filter((f) => f.stage === "groups");

assert(groupFixtures.length === 72, "72 fixtures de grupo esperados");

const unmapped: string[] = [];
groupFixtures.forEach((fixture) => {
  const matchId = pairMap.get(buildKey(fixture.homeTeam, fixture.awayTeam));
  if (!matchId) unmapped.push(`${fixture.id}: ${fixture.homeTeam} vs ${fixture.awayTeam}`);
});

assert(
  unmapped.length === 0,
  `Todos los 72 fixtures se mapean al schedule oficial${unmapped.length ? ` — fallan: ${unmapped.join(", ")}` : ""}`
);

const officialGroupIds = new Set(WORLD_CUP_MATCHES.filter((m) => m.stage === "group").map((m) => String(m.id)));
const reachedIds = new Set(
  groupFixtures.map((f) => pairMap.get(buildKey(f.homeTeam, f.awayTeam))).filter((id): id is string => Boolean(id))
);

assert(reachedIds.size === officialGroupIds.size, `Cada matchId oficial es alcanzado por algún fixture (${reachedIds.size}/${officialGroupIds.size})`);

const m25 = WORLD_CUP_MATCHES.find((m) => m.id === 25);
if (m25) {
  const direct = pairMap.get(buildKey(m25.homeTeam, m25.awayTeam));
  const reversed = pairMap.get(buildKey(m25.awayTeam, m25.homeTeam));
  assert(direct === "25" && reversed === "25", "Match #25 resuelve en ambos sentidos");
}

// eslint-disable-next-line no-console
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
