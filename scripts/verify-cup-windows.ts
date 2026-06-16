// ════════════════════════════════════════════════════════════
// Test de cuadre del Modo Copa.
// Ejecutar:  npx tsx scripts/verify-cup-windows.ts
//
// Monta un escenario sintético con resultados (posiciones de grupo,
// dieciseisavos, podio y un especial) y comprueba que la suma de las 8
// ventanas de la porra coincide con su total. También verifica el reparto:
// la posición de grupo cae en J3 y el podio + especiales en FINAL.
// ════════════════════════════════════════════════════════════

import { GROUPS, type Team } from "@/lib/data";
import { ALL_TEAMS, createDefaultAdminResults } from "@/lib/admin-results";
import { scoreParticipants, scoreTeamWindows, sumWindows } from "@/lib/scoring";

const groupKeys = Object.keys(GROUPS);
const gA = groupKeys[0];
const [a1, a2, a3, a4] = GROUPS[gA];

const admin = createDefaultAdminResults();
admin.configured = true;
admin.groupPositions[a1] = 1;
admin.groupPositions[a2] = 2;
admin.groupPositions[a3] = 3;
admin.groupPositions[a4] = 4;
admin.knockoutRounds.dieciseisavos = ALL_TEAMS.slice(0, 32); // incluye a1, a2
admin.podium = { campeon: a1, subcampeon: a2, tercero: a3 };
admin.specialResults.mejorJugador = "Jugador X";
admin.specialResults.minutoPrimerGol = 23; // especial de J1
admin.specialResults.primerGolEsp = "Jugador Y"; // especial de J2

const team = {
  id: "t-test",
  name: "Test FC",
  userId: "u1",
  username: "test",
  championPick: a1,
  runnerUpPick: a2,
  thirdPlacePick: a3,
  totalPoints: 0,
  groupPoints: 0,
  finalPhasePoints: 0,
  specialPoints: 0,
  currentRank: 0,
  matchPicks: {},
  doubleMatches: {},
  knockoutPicks: { dieciseisavos: [], octavos: [], cuartos: [], semis: [], final: [] },
  groupOrderPicks: { [gA]: [a1, a2, a3, a4] },
  specials: {
    mejorJugador: "Jugador X",
    mejorJoven: "",
    maxGoleador: "",
    maxAsistente: "",
    mejorPortero: "",
    maxGoleadorEsp: "",
    primerGolEsp: "Jugador Y",
    revelacion: "",
    decepcion: "",
    minutoPrimerGol: 23,
  },
} as unknown as Team;

const scored = scoreParticipants([team], admin)[0];
const w = scoreTeamWindows(team, admin);
const suma = sumWindows(w);

console.log("Ventanas:", w);
console.log("Suma de ventanas:", suma, "· Total de la porra:", scored.totalPoints);

const checks: Array<[string, boolean]> = [
  ["suma == total", suma === scored.totalPoints],
  ["J1 incluye minuto primer gol (>0)", w.J1 > 0],
  ["J2 incluye primer goleador español (>0)", w.J2 > 0],
  ["J3 incluye posición de grupo (>0)", w.J3 > 0],
  ["R32 puntúa dieciseisavos (>0)", w.R32 > 0],
  ["FINAL incluye podio (>0)", w.FINAL > 0],
];

let ok = true;
for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS ✅" : "FAIL ❌"}  ${label}`);
  if (!pass) ok = false;
}

if (!ok) {
  console.error("\nEl cuadre ha fallado.");
  process.exit(1);
}
console.log("\nCuadre correcto.");
