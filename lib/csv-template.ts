// ════════════════════════════════════════════════════════════════════════════
// Nuevo esquema CSV (269 columnas, una sola fila de header + una fila de datos).
//
// Estructura:
//   2  identificación  : username, nombreporra
//  144 marcadores      : 72 partidos × 2 columnas (goles local oficial,
//                        goles visitante oficial)
//   48 posiciones      : 12 grupos × 4 posiciones
//   32 dieciseisavos   : EquipoEnDieciseisavos_1..32
//   16 octavos         : EquipoEnOctavos_1..16
//    8 cuartos         : EquipoEnCuartos_1..8
//    4 semifinales     : EquipoEnSemifinales_1..4
//    2 final           : EquipoEnFinal_1..2
//    3 podio           : Campeon, Subcampeon, TercerPuesto
//   10 especiales      : MejorJugador, MejorJugadorJoven, MejorPortero,
//                        MaximoGoleador, MaximoAsistente, MaxGoleadorESP,
//                        PrimerGoleadorESP, SeleccionRevelacion,
//                        SeleccionDecepcion, MinutoPrimerGol
//   ──────
//   269 total
//
// El orden de los 72 partidos de fase de grupos coincide con
// WORLD_CUP_MATCHES.filter(m => m.stage === "group").sort(byOrden).
// El array GROUP_MATCH_SCHEMA se exporta para que export-team-csv.ts pueda
// iterar exactamente esos partidos en el mismo orden.
// ════════════════════════════════════════════════════════════════════════════

export interface GroupMatchSchemaEntry {
  /** Abreviatura del equipo local oficial (ej. "MEX") */
  readonly homeAbbrev: string;
  /** Abreviatura del equipo visitante oficial (ej. "SUD") */
  readonly awayAbbrev: string;
  /** Nombre completo del local oficial, igual que en WORLD_CUP_MATCHES y FIXTURES */
  readonly homeTeam: string;
  /** Nombre completo del visitante oficial */
  readonly awayTeam: string;
}

/** Los 72 partidos de fase de grupos en su orden canónico. */
export const GROUP_MATCH_SCHEMA: ReadonlyArray<GroupMatchSchemaEntry> = [
  // ── Jornada 1 ── (24 partidos)
  { homeAbbrev: "MEX", awayAbbrev: "SUD", homeTeam: "México", awayTeam: "Sudáfrica" },
  { homeAbbrev: "COR", awayAbbrev: "CHE", homeTeam: "Corea del Sur", awayTeam: "Chequia" },
  { homeAbbrev: "CAN", awayAbbrev: "BOS", homeTeam: "Canadá", awayTeam: "Bosnia y Herzegovina" },
  { homeAbbrev: "USA", awayAbbrev: "PAR", homeTeam: "Estados Unidos", awayTeam: "Paraguay" },
  { homeAbbrev: "HAI", awayAbbrev: "ESC", homeTeam: "Haití", awayTeam: "Escocia" },
  { homeAbbrev: "AUS", awayAbbrev: "TUR", homeTeam: "Australia", awayTeam: "Turquía" },
  { homeAbbrev: "BRA", awayAbbrev: "MAR", homeTeam: "Brasil", awayTeam: "Marruecos" },
  { homeAbbrev: "CAT", awayAbbrev: "SUI", homeTeam: "Catar", awayTeam: "Suiza" },
  { homeAbbrev: "CMF", awayAbbrev: "ECU", homeTeam: "Costa de Marfil", awayTeam: "Ecuador" },
  { homeAbbrev: "ALE", awayAbbrev: "CUR", homeTeam: "Alemania", awayTeam: "Curazao" },
  { homeAbbrev: "PBA", awayAbbrev: "JAP", homeTeam: "Países Bajos", awayTeam: "Japón" },
  { homeAbbrev: "SUE", awayAbbrev: "TUN", homeTeam: "Suecia", awayTeam: "Túnez" },
  { homeAbbrev: "ASA", awayAbbrev: "URU", homeTeam: "Arabia Saudí", awayTeam: "Uruguay" },
  { homeAbbrev: "ESP", awayAbbrev: "CAV", homeTeam: "España", awayTeam: "Cabo Verde" },
  { homeAbbrev: "IRN", awayAbbrev: "NZL", homeTeam: "Irán", awayTeam: "Nueva Zelanda" },
  { homeAbbrev: "BEL", awayAbbrev: "EGI", homeTeam: "Bélgica", awayTeam: "Egipto" },
  { homeAbbrev: "FRA", awayAbbrev: "SEN", homeTeam: "Francia", awayTeam: "Senegal" },
  { homeAbbrev: "IRQ", awayAbbrev: "NOR", homeTeam: "Irak", awayTeam: "Noruega" },
  { homeAbbrev: "ARG", awayAbbrev: "ALG", homeTeam: "Argentina", awayTeam: "Argelia" },
  { homeAbbrev: "AUT", awayAbbrev: "JOR", homeTeam: "Austria", awayTeam: "Jordania" },
  { homeAbbrev: "GHA", awayAbbrev: "PAN", homeTeam: "Ghana", awayTeam: "Panamá" },
  { homeAbbrev: "ING", awayAbbrev: "CRO", homeTeam: "Inglaterra", awayTeam: "Croacia" },
  { homeAbbrev: "POR", awayAbbrev: "RDC", homeTeam: "Portugal", awayTeam: "RD Congo" },
  { homeAbbrev: "UZB", awayAbbrev: "COL", homeTeam: "Uzbekistán", awayTeam: "Colombia" },
  // ── Jornada 2 ── (24 partidos)
  { homeAbbrev: "CHE", awayAbbrev: "SUD", homeTeam: "Chequia", awayTeam: "Sudáfrica" },
  { homeAbbrev: "SUI", awayAbbrev: "BOS", homeTeam: "Suiza", awayTeam: "Bosnia y Herzegovina" },
  { homeAbbrev: "CAN", awayAbbrev: "CAT", homeTeam: "Canadá", awayTeam: "Catar" },
  { homeAbbrev: "MEX", awayAbbrev: "COR", homeTeam: "México", awayTeam: "Corea del Sur" },
  { homeAbbrev: "BRA", awayAbbrev: "HAI", homeTeam: "Brasil", awayTeam: "Haití" },
  { homeAbbrev: "ESC", awayAbbrev: "MAR", homeTeam: "Escocia", awayTeam: "Marruecos" },
  { homeAbbrev: "TUR", awayAbbrev: "PAR", homeTeam: "Turquía", awayTeam: "Paraguay" },
  { homeAbbrev: "USA", awayAbbrev: "AUS", homeTeam: "Estados Unidos", awayTeam: "Australia" },
  { homeAbbrev: "ALE", awayAbbrev: "CMF", homeTeam: "Alemania", awayTeam: "Costa de Marfil" },
  { homeAbbrev: "ECU", awayAbbrev: "CUR", homeTeam: "Ecuador", awayTeam: "Curazao" },
  { homeAbbrev: "PBA", awayAbbrev: "SUE", homeTeam: "Países Bajos", awayTeam: "Suecia" },
  { homeAbbrev: "TUN", awayAbbrev: "JAP", homeTeam: "Túnez", awayTeam: "Japón" },
  { homeAbbrev: "URU", awayAbbrev: "CAV", homeTeam: "Uruguay", awayTeam: "Cabo Verde" },
  { homeAbbrev: "ESP", awayAbbrev: "ASA", homeTeam: "España", awayTeam: "Arabia Saudí" },
  { homeAbbrev: "BEL", awayAbbrev: "IRN", homeTeam: "Bélgica", awayTeam: "Irán" },
  { homeAbbrev: "NZL", awayAbbrev: "EGI", homeTeam: "Nueva Zelanda", awayTeam: "Egipto" },
  { homeAbbrev: "FRA", awayAbbrev: "IRQ", homeTeam: "Francia", awayTeam: "Irak" },
  { homeAbbrev: "NOR", awayAbbrev: "SEN", homeTeam: "Noruega", awayTeam: "Senegal" },
  { homeAbbrev: "ARG", awayAbbrev: "AUT", homeTeam: "Argentina", awayTeam: "Austria" },
  { homeAbbrev: "JOR", awayAbbrev: "ALG", homeTeam: "Jordania", awayTeam: "Argelia" },
  { homeAbbrev: "ING", awayAbbrev: "GHA", homeTeam: "Inglaterra", awayTeam: "Ghana" },
  { homeAbbrev: "PAN", awayAbbrev: "CRO", homeTeam: "Panamá", awayTeam: "Croacia" },
  { homeAbbrev: "POR", awayAbbrev: "UZB", homeTeam: "Portugal", awayTeam: "Uzbekistán" },
  { homeAbbrev: "COL", awayAbbrev: "RDC", homeTeam: "Colombia", awayTeam: "RD Congo" },
  // ── Jornada 3 ── (24 partidos)
  { homeAbbrev: "ESC", awayAbbrev: "BRA", homeTeam: "Escocia", awayTeam: "Brasil" },
  { homeAbbrev: "MAR", awayAbbrev: "HAI", homeTeam: "Marruecos", awayTeam: "Haití" },
  { homeAbbrev: "SUI", awayAbbrev: "CAN", homeTeam: "Suiza", awayTeam: "Canadá" },
  { homeAbbrev: "BOS", awayAbbrev: "CAT", homeTeam: "Bosnia y Herzegovina", awayTeam: "Catar" },
  { homeAbbrev: "CHE", awayAbbrev: "MEX", homeTeam: "Chequia", awayTeam: "México" },
  { homeAbbrev: "SUD", awayAbbrev: "COR", homeTeam: "Sudáfrica", awayTeam: "Corea del Sur" },
  { homeAbbrev: "CUR", awayAbbrev: "CMF", homeTeam: "Curazao", awayTeam: "Costa de Marfil" },
  { homeAbbrev: "ECU", awayAbbrev: "ALE", homeTeam: "Ecuador", awayTeam: "Alemania" },
  { homeAbbrev: "JAP", awayAbbrev: "SUE", homeTeam: "Japón", awayTeam: "Suecia" },
  { homeAbbrev: "TUN", awayAbbrev: "PBA", homeTeam: "Túnez", awayTeam: "Países Bajos" },
  { homeAbbrev: "TUR", awayAbbrev: "USA", homeTeam: "Turquía", awayTeam: "Estados Unidos" },
  { homeAbbrev: "PAR", awayAbbrev: "AUS", homeTeam: "Paraguay", awayTeam: "Australia" },
  { homeAbbrev: "NOR", awayAbbrev: "FRA", homeTeam: "Noruega", awayTeam: "Francia" },
  { homeAbbrev: "SEN", awayAbbrev: "IRQ", homeTeam: "Senegal", awayTeam: "Irak" },
  { homeAbbrev: "EGI", awayAbbrev: "IRN", homeTeam: "Egipto", awayTeam: "Irán" },
  { homeAbbrev: "NZL", awayAbbrev: "BEL", homeTeam: "Nueva Zelanda", awayTeam: "Bélgica" },
  { homeAbbrev: "CAV", awayAbbrev: "ASA", homeTeam: "Cabo Verde", awayTeam: "Arabia Saudí" },
  { homeAbbrev: "URU", awayAbbrev: "ESP", homeTeam: "Uruguay", awayTeam: "España" },
  { homeAbbrev: "PAN", awayAbbrev: "ING", homeTeam: "Panamá", awayTeam: "Inglaterra" },
  { homeAbbrev: "CRO", awayAbbrev: "GHA", homeTeam: "Croacia", awayTeam: "Ghana" },
  { homeAbbrev: "JOR", awayAbbrev: "ARG", homeTeam: "Jordania", awayTeam: "Argentina" },
  { homeAbbrev: "ALG", awayAbbrev: "AUT", homeTeam: "Argelia", awayTeam: "Austria" },
  { homeAbbrev: "COL", awayAbbrev: "POR", homeTeam: "Colombia", awayTeam: "Portugal" },
  { homeAbbrev: "RDC", awayAbbrev: "UZB", homeTeam: "RD Congo", awayTeam: "Uzbekistán" },
];

// ── Construcción programática de los 269 headers ──────────────────────────

const matchHeaders: string[] = GROUP_MATCH_SCHEMA.flatMap(({ homeAbbrev, awayAbbrev }) => {
  const prefix = `${homeAbbrev}-${awayAbbrev}`;
  return [`${prefix}_${homeAbbrev}`, `${prefix}_${awayAbbrev}`];
});

export const GROUP_KEYS_AL = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;

const groupPositionHeaders: string[] = GROUP_KEYS_AL.flatMap((g) =>
  [1, 2, 3, 4].map((p) => `Grupo${g}_${p}`),
);

const round32Headers: string[] = Array.from({ length: 32 }, (_, i) => `EquipoEnDieciseisavos_${i + 1}`);
const round16Headers: string[] = Array.from({ length: 16 }, (_, i) => `EquipoEnOctavos_${i + 1}`);
const quarterHeaders: string[] = Array.from({ length: 8 }, (_, i) => `EquipoEnCuartos_${i + 1}`);
const semiHeaders: string[] = Array.from({ length: 4 }, (_, i) => `EquipoEnSemifinales_${i + 1}`);
const finalHeaders: string[] = Array.from({ length: 2 }, (_, i) => `EquipoEnFinal_${i + 1}`);

const podiumHeaders: string[] = ["Campeon", "Subcampeon", "TercerPuesto"];

const specialHeaders: string[] = [
  "MejorJugador",
  "MejorJugadorJoven",
  "MejorPortero",
  "MaximoGoleador",
  "MaximoAsistente",
  "MaxGoleadorESP",
  "PrimerGoleadorESP",
  "SeleccionRevelacion",
  "SeleccionDecepcion",
  "MinutoPrimerGol",
];

export const CSV_TEMPLATE_HEADERS: readonly string[] = [
  "username",
  "nombreporra",
  ...matchHeaders,
  ...groupPositionHeaders,
  ...round32Headers,
  ...round16Headers,
  ...quarterHeaders,
  ...semiHeaders,
  ...finalHeaders,
  ...podiumHeaders,
  ...specialHeaders,
] as const;

// ── Comprobaciones de sanity en dev (no rompen build) ──
if (process.env.NODE_ENV !== "production" && typeof window === "undefined") {
  if (CSV_TEMPLATE_HEADERS.length !== 269) {
    // eslint-disable-next-line no-console
    console.warn(
      `[csv-template] Se esperaban 269 headers, se obtuvieron ${CSV_TEMPLATE_HEADERS.length}`,
    );
  }
  const dupes = CSV_TEMPLATE_HEADERS.filter(
    (h, i) => CSV_TEMPLATE_HEADERS.indexOf(h) !== i,
  );
  if (dupes.length > 0) {
    // eslint-disable-next-line no-console
    console.warn("[csv-template] Headers duplicados detectados:", dupes);
  }
}
