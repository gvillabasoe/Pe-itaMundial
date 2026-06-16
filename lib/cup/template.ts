// ════════════════════════════════════════════════════════════
// MODO COPA — plantilla fija del cuadro de 32
// ════════════════════════════════════════════════════════════
// 14 grupos (A..M de 4, N de 3). Clasifican 2 primeros (28) + 4 mejores
// terceros (de los grupos de 4) = 32. Esta plantilla está validada: ningún
// cruce de dieciseisavos es revancha de grupo y los equipos de un mismo grupo
// no pueden cruzarse antes de semifinales.

export const GROUP_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"] as const;
export type GroupLabel = (typeof GROUP_LABELS)[number];

// Los 14 grupos de 4 candidatos a tercero (todos menos N, que es de 3).
export const FOUR_TEAM_GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"] as const;

// Un slot de dieciseisavos. Las refs son "1A"/"2B" (1.º/2.º de grupo) o
// "T1".."T4" (huecos de mejor tercero).
export interface TemplateMatch {
  id: string; // D01..D16
  region: 1 | 2 | 3 | 4;
  home: string;
  away: string;
}

// Orden D01..D16 (top→bottom del bracket). Regiones 1-2 → Semifinal 1; 3-4 → Semifinal 2.
export const R32_TEMPLATE: TemplateMatch[] = [
  { id: "D01", region: 1, home: "1A", away: "T1" },
  { id: "D02", region: 1, home: "1E", away: "2B" },
  { id: "D03", region: 1, home: "1F", away: "2C" },
  { id: "D04", region: 1, home: "1G", away: "2D" },
  { id: "D05", region: 2, home: "1B", away: "T2" },
  { id: "D06", region: 2, home: "1H", away: "2A" },
  { id: "D07", region: 2, home: "1I", away: "2E" },
  { id: "D08", region: 2, home: "1J", away: "2F" },
  { id: "D09", region: 3, home: "1C", away: "T3" },
  { id: "D10", region: 3, home: "1K", away: "2G" },
  { id: "D11", region: 3, home: "1L", away: "2H" },
  { id: "D12", region: 3, home: "2M", away: "2N" },
  { id: "D13", region: 4, home: "1D", away: "T4" },
  { id: "D14", region: 4, home: "1M", away: "2I" },
  { id: "D15", region: 4, home: "1N", away: "2J" },
  { id: "D16", region: 4, home: "2K", away: "2L" },
];

// Cada hueco de tercero está en una región y es el rival del primero anfitrión.
// slot i (1..4) vive en la región i.
export const THIRD_SLOT_REGION: Record<number, 1 | 2 | 3 | 4> = { 1: 1, 2: 2, 3: 3, 4: 4 };
export const HOST_GROUP_BY_REGION: Record<number, GroupLabel> = { 1: "A", 2: "B", 3: "C", 4: "D" };

// Región del 1.º y del 2.º de cada grupo (derivado de la plantilla). Sirve
// para colocar al tercero fuera de las regiones de su propio grupo.
export const WINNER_REGION: Record<string, number> = {
  A: 1, E: 1, F: 1, G: 1, B: 2, H: 2, I: 2, J: 2, C: 3, K: 3, L: 3, D: 4, M: 4, N: 4,
};
export const SECOND_REGION: Record<string, number> = {
  B: 1, C: 1, D: 1, A: 2, E: 2, F: 2, G: 3, H: 3, M: 3, N: 3, I: 4, J: 4, K: 4, L: 4,
};

// Regiones permitidas para el tercero de un grupo.
// Preferente: fuera de las regiones donde está su 1.º y su 2.º.
// Dura: solo evita la región cuyo anfitrión es su propio grupo (no revancha).
export function allowedRegionsPref(group: string): number[] {
  const occupied = new Set([WINNER_REGION[group], SECOND_REGION[group]]);
  for (const r of [1, 2, 3, 4]) if (HOST_GROUP_BY_REGION[r] === group) occupied.add(r);
  return [1, 2, 3, 4].filter((r) => !occupied.has(r));
}
export function allowedRegionsHard(group: string): number[] {
  return [1, 2, 3, 4].filter((r) => HOST_GROUP_BY_REGION[r] !== group);
}

// Empareja los grupos de los terceros clasificados (ordenados por calidad) con
// las 4 regiones. Devuelve región -> grupo. Intenta la regla preferente; si no
// hay emparejamiento completo, cae a la dura (que siempre tiene solución).
export function assignThirds(rankedThirdGroups: string[]): Record<number, string> {
  const groups = rankedThirdGroups.slice(0, 4);

  function match(allowFn: (g: string) => number[]): Record<number, string> | null {
    const used = new Set<number>();
    const out: Record<number, string> = {};
    const bt = (i: number): boolean => {
      if (i === groups.length) return true;
      for (const r of allowFn(groups[i])) {
        if (used.has(r)) continue;
        used.add(r);
        out[r] = groups[i];
        if (bt(i + 1)) return true;
        used.delete(r);
        delete out[r];
      }
      return false;
    };
    return bt(0) ? out : null;
  }

  return match(allowedRegionsPref) ?? match(allowedRegionsHard) ?? {};
}
