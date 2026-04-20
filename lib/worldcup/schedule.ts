/**
 * FIFA World Cup 2026 — Complete 104-match schedule.
 * Single source of truth. City only, no stadium, no country.
 */

import type { Zone } from "./zones";
import { REGION_BY_CITY } from "./zones";

export type MatchStage =
  | "group"
  | "round-of-32"
  | "round-of-16"
  | "quarter-final"
  | "semi-final"
  | "third-place"
  | "final";

export interface WorldCupMatch {
  id: number;
  stage: MatchStage;
  homeTeam: string;
  awayTeam: string;
  hostCity: string;
  zone: Zone;
  isKnockout: boolean;
  sortOrder: number;
  roundLabel: string;
}

function m(id: number, stage: MatchStage, home: string, away: string, city: string, roundLabel: string): WorldCupMatch {
  const zone = REGION_BY_CITY[city];
  if (!zone) throw new Error(`[schedule] Unknown city: "${city}" for match ${id}`);
  return { id, stage, homeTeam: home, awayTeam: away, hostCity: city, zone, isKnockout: stage !== "group", sortOrder: id, roundLabel };
}

export const WORLD_CUP_MATCHES: WorldCupMatch[] = [
  // ═══ FASE DE GRUPOS (1-72) ═══
  m(1, "group", "México", "Sudáfrica", "Ciudad de México", "Fase de Grupos"),
  m(2, "group", "Corea del Sur", "Chequia", "Guadalajara", "Fase de Grupos"),
  m(3, "group", "Canadá", "Bosnia y Herzegovina", "Toronto", "Fase de Grupos"),
  m(4, "group", "Estados Unidos", "Paraguay", "Los Ángeles", "Fase de Grupos"),
  m(5, "group", "Haití", "Escocia", "Boston", "Fase de Grupos"),
  m(6, "group", "Australia", "Turquía", "Vancouver", "Fase de Grupos"),
  m(7, "group", "Brasil", "Marruecos", "Nueva York/Nueva Jersey", "Fase de Grupos"),
  m(8, "group", "Catar", "Suiza", "San Francisco", "Fase de Grupos"),
  m(9, "group", "Costa de Marfil", "Ecuador", "Filadelfia", "Fase de Grupos"),
  m(10, "group", "Alemania", "Curazao", "Houston", "Fase de Grupos"),
  m(11, "group", "Países Bajos", "Japón", "Dallas", "Fase de Grupos"),
  m(12, "group", "Suecia", "Túnez", "Monterrey", "Fase de Grupos"),
  m(13, "group", "Arabia Saudí", "Uruguay", "Miami", "Fase de Grupos"),
  m(14, "group", "España", "Cabo Verde", "Atlanta", "Fase de Grupos"),
  m(15, "group", "Irán", "Nueva Zelanda", "Los Ángeles", "Fase de Grupos"),
  m(16, "group", "Bélgica", "Egipto", "Seattle", "Fase de Grupos"),
  m(17, "group", "Francia", "Senegal", "Nueva York/Nueva Jersey", "Fase de Grupos"),
  m(18, "group", "Irak", "Noruega", "Boston", "Fase de Grupos"),
  m(19, "group", "Argentina", "Argelia", "Kansas City", "Fase de Grupos"),
  m(20, "group", "Austria", "Jordania", "San Francisco", "Fase de Grupos"),
  m(21, "group", "Ghana", "Panamá", "Toronto", "Fase de Grupos"),
  m(22, "group", "Inglaterra", "Croacia", "Dallas", "Fase de Grupos"),
  m(23, "group", "Portugal", "RD Congo", "Houston", "Fase de Grupos"),
  m(24, "group", "Uzbekistán", "Colombia", "Ciudad de México", "Fase de Grupos"),
  m(25, "group", "Chequia", "Sudáfrica", "Atlanta", "Fase de Grupos"),
  m(26, "group", "Suiza", "Bosnia y Herzegovina", "Los Ángeles", "Fase de Grupos"),
  m(27, "group", "Canadá", "Catar", "Vancouver", "Fase de Grupos"),
  m(28, "group", "México", "Corea del Sur", "Guadalajara", "Fase de Grupos"),
  m(29, "group", "Brasil", "Haití", "Filadelfia", "Fase de Grupos"),
  m(30, "group", "Escocia", "Marruecos", "Boston", "Fase de Grupos"),
  m(31, "group", "Turquía", "Paraguay", "San Francisco", "Fase de Grupos"),
  m(32, "group", "Estados Unidos", "Australia", "Seattle", "Fase de Grupos"),
  m(33, "group", "Alemania", "Costa de Marfil", "Toronto", "Fase de Grupos"),
  m(34, "group", "Ecuador", "Curazao", "Kansas City", "Fase de Grupos"),
  m(35, "group", "Países Bajos", "Suecia", "Houston", "Fase de Grupos"),
  m(36, "group", "Túnez", "Japón", "Monterrey", "Fase de Grupos"),
  m(37, "group", "Uruguay", "Cabo Verde", "Miami", "Fase de Grupos"),
  m(38, "group", "España", "Arabia Saudí", "Atlanta", "Fase de Grupos"),
  m(39, "group", "Bélgica", "Irán", "Los Ángeles", "Fase de Grupos"),
  m(40, "group", "Nueva Zelanda", "Egipto", "Vancouver", "Fase de Grupos"),
  m(41, "group", "Francia", "Irak", "Filadelfia", "Fase de Grupos"),
  m(42, "group", "Noruega", "Senegal", "Nueva York/Nueva Jersey", "Fase de Grupos"),
  m(43, "group", "Argentina", "Austria", "Dallas", "Fase de Grupos"),
  m(44, "group", "Jordania", "Argelia", "San Francisco", "Fase de Grupos"),
  m(45, "group", "Inglaterra", "Ghana", "Boston", "Fase de Grupos"),
  m(46, "group", "Panamá", "Croacia", "Toronto", "Fase de Grupos"),
  m(47, "group", "Portugal", "Uzbekistán", "Houston", "Fase de Grupos"),
  m(48, "group", "Colombia", "RD Congo", "Guadalajara", "Fase de Grupos"),
  m(49, "group", "Escocia", "Brasil", "Miami", "Fase de Grupos"),
  m(50, "group", "Marruecos", "Haití", "Atlanta", "Fase de Grupos"),
  m(51, "group", "Suiza", "Canadá", "Vancouver", "Fase de Grupos"),
  m(52, "group", "Bosnia y Herzegovina", "Catar", "Seattle", "Fase de Grupos"),
  m(53, "group", "Chequia", "México", "Ciudad de México", "Fase de Grupos"),
  m(54, "group", "Sudáfrica", "Corea del Sur", "Monterrey", "Fase de Grupos"),
  m(55, "group", "Curazao", "Costa de Marfil", "Filadelfia", "Fase de Grupos"),
  m(56, "group", "Ecuador", "Alemania", "Nueva York/Nueva Jersey", "Fase de Grupos"),
  m(57, "group", "Japón", "Suecia", "Dallas", "Fase de Grupos"),
  m(58, "group", "Túnez", "Países Bajos", "Kansas City", "Fase de Grupos"),
  m(59, "group", "Turquía", "Estados Unidos", "Los Ángeles", "Fase de Grupos"),
  m(60, "group", "Paraguay", "Australia", "San Francisco", "Fase de Grupos"),
  m(61, "group", "Noruega", "Francia", "Boston", "Fase de Grupos"),
  m(62, "group", "Senegal", "Irak", "Toronto", "Fase de Grupos"),
  m(63, "group", "Egipto", "Irán", "Seattle", "Fase de Grupos"),
  m(64, "group", "Nueva Zelanda", "Bélgica", "Vancouver", "Fase de Grupos"),
  m(65, "group", "Cabo Verde", "Arabia Saudí", "Houston", "Fase de Grupos"),
  m(66, "group", "Uruguay", "España", "Guadalajara", "Fase de Grupos"),
  m(67, "group", "Panamá", "Inglaterra", "Nueva York/Nueva Jersey", "Fase de Grupos"),
  m(68, "group", "Croacia", "Ghana", "Filadelfia", "Fase de Grupos"),
  m(69, "group", "Jordania", "Argentina", "Dallas", "Fase de Grupos"),
  m(70, "group", "Argelia", "Austria", "Kansas City", "Fase de Grupos"),
  m(71, "group", "Colombia", "Portugal", "Miami", "Fase de Grupos"),
  m(72, "group", "RD Congo", "Uzbekistán", "Atlanta", "Fase de Grupos"),

  // ═══ RONDA DE 32 (73-88) ═══
  m(73, "round-of-32", "2.º Grupo A", "2.º Grupo B", "Los Ángeles", "Ronda de 32"),
  m(74, "round-of-32", "1.º Grupo E", "Mejor 3.º A/B/C/D/F", "Boston", "Ronda de 32"),
  m(75, "round-of-32", "1.º Grupo F", "2.º Grupo C", "Monterrey", "Ronda de 32"),
  m(76, "round-of-32", "1.º Grupo C", "2.º Grupo F", "Houston", "Ronda de 32"),
  m(77, "round-of-32", "1.º Grupo I", "Mejor 3.º C/D/F/G/H", "Nueva York/Nueva Jersey", "Ronda de 32"),
  m(78, "round-of-32", "2.º Grupo E", "2.º Grupo I", "Dallas", "Ronda de 32"),
  m(79, "round-of-32", "1.º Grupo A", "Mejor 3.º C/E/F/H/I", "Ciudad de México", "Ronda de 32"),
  m(80, "round-of-32", "1.º Grupo L", "Mejor 3.º E/H/I/J/K", "Atlanta", "Ronda de 32"),
  m(81, "round-of-32", "1.º Grupo D", "Mejor 3.º B/E/F/I/J", "San Francisco", "Ronda de 32"),
  m(82, "round-of-32", "1.º Grupo G", "Mejor 3.º A/E/H/I/J", "Seattle", "Ronda de 32"),
  m(83, "round-of-32", "2.º Grupo K", "2.º Grupo L", "Toronto", "Ronda de 32"),
  m(84, "round-of-32", "1.º Grupo H", "2.º Grupo J", "Los Ángeles", "Ronda de 32"),
  m(85, "round-of-32", "1.º Grupo B", "Mejor 3.º E/F/G/I/J", "Vancouver", "Ronda de 32"),
  m(86, "round-of-32", "1.º Grupo J", "2.º Grupo H", "Miami", "Ronda de 32"),
  m(87, "round-of-32", "1.º Grupo K", "Mejor 3.º D/E/I/J/L", "Kansas City", "Ronda de 32"),
  m(88, "round-of-32", "2.º Grupo D", "2.º Grupo G", "Dallas", "Ronda de 32"),

  // ═══ OCTAVOS DE FINAL (89-96) ═══
  m(89, "round-of-16", "Ganador 74", "Ganador 77", "Filadelfia", "Octavos de Final"),
  m(90, "round-of-16", "Ganador 73", "Ganador 75", "Houston", "Octavos de Final"),
  m(91, "round-of-16", "Ganador 76", "Ganador 78", "Nueva York/Nueva Jersey", "Octavos de Final"),
  m(92, "round-of-16", "Ganador 79", "Ganador 80", "Ciudad de México", "Octavos de Final"),
  m(93, "round-of-16", "Ganador 83", "Ganador 84", "Dallas", "Octavos de Final"),
  m(94, "round-of-16", "Ganador 81", "Ganador 82", "Seattle", "Octavos de Final"),
  m(95, "round-of-16", "Ganador 86", "Ganador 88", "Atlanta", "Octavos de Final"),
  m(96, "round-of-16", "Ganador 85", "Ganador 87", "Vancouver", "Octavos de Final"),

  // ═══ CUARTOS DE FINAL (97-100) ═══
  m(97, "quarter-final", "Ganador 89", "Ganador 90", "Boston", "Cuartos de Final"),
  m(98, "quarter-final", "Ganador 93", "Ganador 94", "Los Ángeles", "Cuartos de Final"),
  m(99, "quarter-final", "Ganador 91", "Ganador 92", "Miami", "Cuartos de Final"),
  m(100, "quarter-final", "Ganador 95", "Ganador 96", "Kansas City", "Cuartos de Final"),

  // ═══ SEMIFINALES (101-102) ═══
  m(101, "semi-final", "Ganador 97", "Ganador 98", "Dallas", "Semifinales"),
  m(102, "semi-final", "Ganador 99", "Ganador 100", "Atlanta", "Semifinales"),

  // ═══ TERCER PUESTO (103) ═══
  m(103, "third-place", "Perdedor 101", "Perdedor 102", "Miami", "Tercer Puesto"),

  // ═══ FINAL (104) ═══
  m(104, "final", "Ganador 101", "Ganador 102", "Nueva York/Nueva Jersey", "Final"),
];

// ═══ HELPERS ═══

export function getMatchesByStage(stage: MatchStage): WorldCupMatch[] {
  return WORLD_CUP_MATCHES.filter(m => m.stage === stage);
}

export function getMatchesByCity(city: string): WorldCupMatch[] {
  return WORLD_CUP_MATCHES.filter(m => m.hostCity === city);
}

export function getMatchesByZone(zone: Zone): WorldCupMatch[] {
  return WORLD_CUP_MATCHES.filter(m => m.zone === zone);
}

export function getMatchesByTeam(teamName: string): WorldCupMatch[] {
  return WORLD_CUP_MATCHES.filter(m => m.homeTeam === teamName || m.awayTeam === teamName);
}

export function getGroupMatches(): WorldCupMatch[] {
  return WORLD_CUP_MATCHES.filter(m => m.stage === "group");
}

export function getKnockoutMatches(): WorldCupMatch[] {
  return WORLD_CUP_MATCHES.filter(m => m.isKnockout);
}

export const STAGE_LABELS: Record<MatchStage, string> = {
  "group": "Fase de Grupos",
  "round-of-32": "Ronda de 32",
  "round-of-16": "Octavos de Final",
  "quarter-final": "Cuartos de Final",
  "semi-final": "Semifinales",
  "third-place": "Tercer Puesto",
  "final": "Final",
};

export const STAGE_ORDER: MatchStage[] = [
  "group", "round-of-32", "round-of-16", "quarter-final", "semi-final", "third-place", "final",
];
