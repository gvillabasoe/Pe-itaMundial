import { FIXTURES, type Fixture, type Team } from "@/lib/data";
import type { AdminResults } from "@/lib/admin-results";
import {
  CSV_TEMPLATE_HEADERS,
  GROUP_KEYS_AL,
  GROUP_MATCH_SCHEMA,
  type GroupMatchSchemaEntry,
} from "@/lib/csv-template";
import { normalizeCountryKey } from "@/lib/flags";
import { ROUND32_MATCH_DEFS } from "@/lib/porra-builder";

const CSV_SEPARATOR = ";";

type CsvCellValue = string | number | null | undefined;
type FixtureResolution = { fixture: Fixture; swapped: boolean };

function buildMatchKey(homeTeam: string, awayTeam: string) {
  return `${normalizeCountryKey(homeTeam)}|${normalizeCountryKey(awayTeam)}`;
}

function buildFixtureLookup() {
  const lookup = new Map<string, FixtureResolution>();

  FIXTURES.filter((fixture) => fixture.stage === "groups").forEach((fixture) => {
    lookup.set(buildMatchKey(fixture.homeTeam, fixture.awayTeam), { fixture, swapped: false });
    lookup.set(buildMatchKey(fixture.awayTeam, fixture.homeTeam), { fixture, swapped: true });
  });

  return lookup;
}

const FIXTURE_BY_OFFICIAL_PAIR = buildFixtureLookup();

function getMatchCode(match: GroupMatchSchemaEntry) {
  return `${match.homeAbbrev}-${match.awayAbbrev}`;
}

function getScoreValue(value: unknown): number | "" {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);

  if (typeof value === "string" && value.trim() !== "") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return Math.floor(numeric);
  }

  return "";
}

function resolveOfficialMatchPick(team: Team, match: GroupMatchSchemaEntry, officialMatchNumber: number) {
  const matchPicks = team.matchPicks || {};
  const resolution = FIXTURE_BY_OFFICIAL_PAIR.get(buildMatchKey(match.homeTeam, match.awayTeam));

  if (resolution) {
    const pick = matchPicks[resolution.fixture.id];
    if (pick) {
      return {
        home: getScoreValue(resolution.swapped ? pick.away : pick.home),
        away: getScoreValue(resolution.swapped ? pick.home : pick.away),
      };
    }
  }

  // Fallback defensivo por si algún dato viniera guardado por ID oficial del calendario.
  const officialPick = matchPicks[String(officialMatchNumber)] || matchPicks[`m${officialMatchNumber}`];
  if (officialPick) {
    return {
      home: getScoreValue(officialPick.home),
      away: getScoreValue(officialPick.away),
    };
  }

  return { home: "" as const, away: "" as const };
}

const DOUBLE_MATCH_CODE_BY_FIXTURE_ID = new Map<string, string>();
GROUP_MATCH_SCHEMA.forEach((match) => {
  const resolution = FIXTURE_BY_OFFICIAL_PAIR.get(buildMatchKey(match.homeTeam, match.awayTeam));
  if (resolution) {
    DOUBLE_MATCH_CODE_BY_FIXTURE_ID.set(resolution.fixture.id, getMatchCode(match));
  }
});

if (process.env.NODE_ENV !== "production" && typeof window === "undefined") {
  const missingMatches = GROUP_MATCH_SCHEMA.filter(
    (match) => !FIXTURE_BY_OFFICIAL_PAIR.has(buildMatchKey(match.homeTeam, match.awayTeam)),
  );

  if (missingMatches.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      "[export-team-csv] Partidos oficiales sin fixture interno:",
      missingMatches.map((match) => `${match.homeTeam} vs ${match.awayTeam}`),
    );
  }
}

function getStoredDoubleMatchId(team: Team, group: string) {
  const raw = (team.doubleMatches as Record<string, unknown> | undefined)?.[group];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return String(value ?? "").trim();
}

function getDoubleMatchValue(team: Team, group: string) {
  const stored = getStoredDoubleMatchId(team, group);
  if (!stored) return "";

  const fixtureCode = DOUBLE_MATCH_CODE_BY_FIXTURE_ID.get(stored);
  if (fixtureCode) return fixtureCode;

  const numericMatchNumber = Number(stored);
  if (Number.isInteger(numericMatchNumber) && numericMatchNumber >= 1 && numericMatchNumber <= GROUP_MATCH_SCHEMA.length) {
    return getMatchCode(GROUP_MATCH_SCHEMA[numericMatchNumber - 1]);
  }

  // Si ya viene como código tipo MEX-SUD, lo mantenemos.
  if (/^[A-Z]{2,3}-[A-Z]{2,3}$/.test(stored)) return stored;

  return stored;
}

function getCountryFromKnockoutRound(team: Team, roundKey: string, index: number) {
  return team.knockoutPicks?.[roundKey]?.[index]?.country || "";
}

function getGroupTeamAtPosition(team: Team, group: string, position: 1 | 2 | 3 | 4) {
  return team.groupOrderPicks?.[group]?.[position - 1] || "";
}

function getRoundOf32Teams(team: Team) {
  const stored = Array.isArray(team.roundOf32Teams) ? team.roundOf32Teams : [];
  if (stored.some((country) => String(country ?? "").trim() !== "")) return stored;

  return ROUND32_MATCH_DEFS.flatMap((match) => {
    const resolveSlot = (slot: (typeof match)["home"] | (typeof match)["away"]) => {
      if (slot.kind === "group-position") {
        return getGroupTeamAtPosition(team, slot.group, slot.position);
      }

      return team.bestThirdAssignments?.[match.matchId] || "";
    };

    return [resolveSlot(match.home), resolveSlot(match.away)];
  });
}

function escapeCsvCell(value: CsvCellValue) {
  const text = value === null || value === undefined ? "" : String(value);

  if (
    text.includes('"') ||
    text.includes(CSV_SEPARATOR) ||
    text.includes("\n") ||
    text.includes("\r")
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function buildTeamCsv(team: Team, _adminResults?: AdminResults) {
  const row = Object.fromEntries(CSV_TEMPLATE_HEADERS.map((header) => [header, ""])) as Record<string, CsvCellValue>;

  row.username = team.username || "";
  row.nombreporra = team.name || "";

  GROUP_MATCH_SCHEMA.forEach((match, index) => {
    const prefix = getMatchCode(match);
    const pick = resolveOfficialMatchPick(team, match, index + 1);

    row[`${prefix}_${match.homeAbbrev}`] = pick.home;
    row[`${prefix}_${match.awayAbbrev}`] = pick.away;
  });

  GROUP_KEYS_AL.forEach((group) => {
    [1, 2, 3, 4].forEach((position) => {
      row[`Grupo${group}_${position}`] = getGroupTeamAtPosition(team, group, position as 1 | 2 | 3 | 4);
    });

    row[`DOBLE_Grupo${group}`] = getDoubleMatchValue(team, group);
  });

  const roundOf32Teams = getRoundOf32Teams(team);
  Array.from({ length: 32 }, (_, index) => {
    row[`EquipoEnDieciseisavos_${index + 1}`] = roundOf32Teams[index] || "";
  });

  Array.from({ length: 16 }, (_, index) => {
    row[`EquipoEnOctavos_${index + 1}`] = getCountryFromKnockoutRound(team, "dieciseisavos", index);
  });

  Array.from({ length: 8 }, (_, index) => {
    row[`EquipoEnCuartos_${index + 1}`] = getCountryFromKnockoutRound(team, "octavos", index);
  });

  Array.from({ length: 4 }, (_, index) => {
    row[`EquipoEnSemifinales_${index + 1}`] = getCountryFromKnockoutRound(team, "cuartos", index);
  });

  const finalPicks = team.knockoutPicks?.final?.some((pick) => pick.country)
    ? team.knockoutPicks.final
    : team.knockoutPicks?.semis || [];
  Array.from({ length: 2 }, (_, index) => {
    row[`EquipoEnFinal_${index + 1}`] = finalPicks[index]?.country || "";
  });

  row.Campeon = team.championPick || "";
  row.Subcampeon = team.runnerUpPick || "";
  row.TercerPuesto = team.thirdPlacePick || "";

  row.MejorJugador = team.specials?.mejorJugador || "";
  row.MejorJugadorJoven = team.specials?.mejorJoven || "";
  row.MejorPortero = team.specials?.mejorPortero || "";
  row.MaximoGoleador = team.specials?.maxGoleador || "";
  row.MaximoAsistente = team.specials?.maxAsistente || "";
  row.MaxGoleadorESP = team.specials?.maxGoleadorEsp || "";
  row.PrimerGoleadorESP = team.specials?.primerGolEsp || "";
  row.SeleccionRevelacion = team.specials?.revelacion || "";
  row.SeleccionDecepcion = team.specials?.decepcion || "";
  row.MinutoPrimerGol = team.specials?.minutoPrimerGol ?? "";

  const headerLine = CSV_TEMPLATE_HEADERS.join(CSV_SEPARATOR);
  const valueLine = CSV_TEMPLATE_HEADERS.map((header) => escapeCsvCell(row[header])).join(CSV_SEPARATOR);

  return `${headerLine}\n${valueLine}`;
}

export function buildTeamCsvFilename(team: Team) {
  const safe = team.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return `porra-${safe || "equipo"}.csv`;
}
