// ════════════════════════════════════════════════════════════
// MODO COPA — tipos de dominio
// ════════════════════════════════════════════════════════════
// Capa nueva y aislada: solo LEE el scoring existente. El "Mundial entre
// porras" usa los puntos de cada porra por ventana (J1..FINAL) como los
// goles de cada enfrentamiento.

import type { Ventana } from "@/lib/scoring";

export type { Ventana };

// Goles de una porra en cada ventana (lo que puntuó en ese periodo).
export interface GoalsByWindow {
  teamId: string;
  goals: Record<Ventana, number>;
}

// Documento de configuración de la Copa (lo único que se persiste; el resto
// se deriva de los resultados ya guardados). Censo congelado en el sorteo.
export interface CupConfig {
  locked: boolean;
  seed: number;
  roster: string[]; // ids de porra congelados en el sorteo
  groups: Record<string, string[]>; // "A".."N" -> ids de porra (4, salvo "N" = 3)
}

// Una fila de la tabla de un grupo (como una liga: 3/1/0, GF/GA = goles).
export interface GroupRow {
  teamId: string;
  pj: number; // partidos jugados
  g: number; // ganados
  e: number; // empatados
  p: number; // perdidos
  gf: number; // goles a favor (= puntos de la porra en esas jornadas)
  gc: number; // goles en contra (= puntos del rival)
  dg: number; // diferencia de goles
  pts: number; // puntos de liga
}

// Un cruce de una jornada: marcador = goles (puntos) de cada porra esa ventana.
export interface CupFixture {
  ventana: Ventana;
  homeId: string;
  awayId: string;
  homeGoals: number | null; // null = ventana aún no resuelta
  awayGoals: number | null;
}

export type CupRound = "R32" | "R16" | "QF" | "SF" | "FINAL" | "3P";

// Un cruce del cuadro. homeRef/awayRef son referencias de plantilla ("1A",
// "2B", "3º(1)") hasta que se resuelven a un id concreto.
export interface BracketMatch {
  id: string;
  ronda: CupRound;
  homeRef: string;
  awayRef: string;
  homeId?: string;
  awayId?: string;
  winnerId?: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
}
