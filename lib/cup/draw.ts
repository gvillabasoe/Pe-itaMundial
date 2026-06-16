// ════════════════════════════════════════════════════════════
// MODO COPA — sorteo de grupos
// ════════════════════════════════════════════════════════════
// Reparte el censo de porras en 14 grupos (A..N) de forma determinista a
// partir de una semilla. Con 55 porras salen 13 grupos de 4 y 1 de 3 (la N).

import { GROUP_LABELS } from "@/lib/cup/template";

// PRNG determinista (mulberry32).
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], seed: number): T[] {
  const rnd = mulberry32(seed);
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Reparte el censo a 14 grupos lo más iguales posible. El reparto por índice
// (i % 14) deja los grupos del final más pequeños: con 55 porras, la N queda
// con 3 (los demás con 4).
export function drawGroups(roster: string[], seed: number): Record<string, string[]> {
  const ordered = shuffle(roster, seed);
  const groups: Record<string, string[]> = {};
  GROUP_LABELS.forEach((g) => (groups[g] = []));
  ordered.forEach((id, i) => {
    const label = GROUP_LABELS[i % GROUP_LABELS.length];
    groups[label].push(id);
  });
  return groups;
}
