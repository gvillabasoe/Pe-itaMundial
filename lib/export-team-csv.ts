import { FIXTURES, GROUPS, SCORING, type Team } from "@/lib/data";
import { hasConfiguredAdminResults, type AdminResults } from "@/lib/admin-results";
import { CSV_TEMPLATE_HEADERS } from "@/lib/csv-template";

const TEMPLATE_TEAM_NAMES: Record<string, string> = {
  "México": "Mexico",
  "Sudáfrica": "Sudafrica",
  "Corea del Sur": "Corea",
  "Chequia": "Chequia",
  "Canadá": "Canada",
  "Bosnia y Herzegovina": "Bosnia y Herzegovina",
  "Catar": "Qatar",
  "Suiza": "Suiza",
  "Brasil": "Brasil",
  "Marruecos": "Marruecos",
  "Haití": "Haiti",
  "Escocia": "Escocia",
  "Estados Unidos": "USA",
  "Paraguay": "Paraguay",
  "Australia": "Australia",
  "Turquía": "Turquia",
  "Alemania": "Alemania",
  "Curazao": "Curazao",
  "Costa de Marfil": "CostaMarfil",
  "Ecuador": "Ecuador",
  "Países Bajos": "Holanda",
  "Japón": "Japon",
  "Suecia": "Suecia",
  "Túnez": "Tunez",
  "Bélgica": "Belgica",
  "Egipto": "Egipto",
  "Irán": "Iran",
  "Nueva Zelanda": "NuevaZelanda",
  "España": "Espana",
  "Cabo Verde": "CaboVerde",
  "Arabia Saudí": "ArabiaSaudi",
  "Uruguay": "Uruguay",
  "Francia": "Francia",
  "Senegal": "Senegal",
  "Irak": "Iraq",
  "Noruega": "Noruega",
  "Argentina": "Argentina",
  "Argelia": "Argelia",
  "Austria": "Austria",
  "Jordania": "Jordania",
  "Portugal": "Portugal",
  "RD Congo": "RD Congo",
  "Uzbekistán": "Uzbekistan",
  "Colombia": "Colombia",
  "Inglaterra": "Inglaterra",
  "Croacia": "Croacia",
  "Ghana": "Ghana",
  "Panamá": "Panama",
};

function tokenForTeam(team: string) {
  return TEMPLATE_TEAM_NAMES[team] || team;
}

function matchBase(homeTeam: string, awayTeam: string) {
  return `${tokenForTeam(homeTeam)}${tokenForTeam(awayTeam)}`;
}

function resultSign(home: number | null, away: number | null) {
  if (typeof home !== "number" || typeof away !== "number") return "";
  if (home === away) return "X";
  return home > away ? "1" : "2";
}

function getGroupPositionPoint(team: Team, group: string, country: string, adminResults?: AdminResults) {
  if (!adminResults || !hasConfiguredAdminResults(adminResults)) return "";
  const picks = team.groupOrderPicks[group] || [];
  const predictedPosition = picks.findIndex((item) => item === country);
  if (predictedPosition < 0) return 0;
  return adminResults.groupPositions[country] === predictedPosition + 1 ? SCORING.posicionGrupo : 0;
}

function getExactPoints(matches: boolean, points: number, adminResults?: AdminResults) {
  if (!adminResults || !hasConfiguredAdminResults(adminResults)) return "";
  return matches ? points : 0;
}

function hasConfiguredText(value: unknown) {
  return String(value ?? "").trim() !== "";
}

function hasConfiguredNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function escapeCsvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  if (text.includes('"') || text.includes(",") || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildTeamCsv(team: Team, adminResults?: AdminResults) {
  const row = Object.fromEntries(CSV_TEMPLATE_HEADERS.map((header) => [header, ""])) as Record<string, string | number>;

  row.NombreApellidos = team.username;
  row["@usuario"] = `@${team.username}`;
  row.nombreEquipo = team.name;

  FIXTURES.forEach((fixture) => {
    const pick = team.matchPicks[fixture.id];
    if (!pick) return;

    const base = matchBase(fixture.homeTeam, fixture.awayTeam);
    const hasScore = typeof pick.home === "number" && typeof pick.away === "number";
    row[`${base}_RTO`] = hasScore ? `${pick.home}-${pick.away}` : "";
    row[`${base}_1X2`] = resultSign(pick.home, pick.away);
    row[`${base}_DOB`] = team.doubleMatches[fixture.group || ""] === fixture.id ? "TRUE" : "FALSE";
    row[`${base}_PTOS`] = typeof pick.points === "number" ? pick.points : "";
  });

  row.TOTAL_PUNTOS = team.totalPoints;
  row.PUNTOS_FASE_DE_GRUPOS = team.groupPoints;
  row.PUNTOS_FASE_FINAL = team.finalPhasePoints;
  row.PUNTOS_ESPECIALES = team.specialPoints;

  Object.entries(GROUPS).forEach(([group, teams]) => {
    teams.forEach((country, index) => {
      const headerBase = `g${group}_${tokenForTeam(country)}`;
      const predictedPosition = (team.groupOrderPicks[group] || []).findIndex((item) => item === country);
      row[`${headerBase}_POS`] = predictedPosition >= 0 ? predictedPosition + 1 : "";
      row[`${headerBase}_PTOS`] = getGroupPositionPoint(team, group, country, adminResults);
    });
  });

  (team.roundOf32Teams || []).slice(0, 32).forEach((country, index) => {
    row[`EquipoR32_${index + 1}`] = country;
  });

  (team.knockoutPicks.dieciseisavos || []).slice(0, 16).forEach((pick, index) => {
    row[`EquipoOctavos_${index + 1}`] = pick.country;
    row[`EquipoOctavos_${index + 1}_PTOS`] = typeof pick.points === "number" ? pick.points : "";
  });

  (team.knockoutPicks.octavos || []).slice(0, 8).forEach((pick, index) => {
    row[`EquipoCuartos_${index + 1}`] = pick.country;
    row[`EquipoCuartos_${index + 1}_PTOS`] = typeof pick.points === "number" ? pick.points : "";
  });

  (team.knockoutPicks.cuartos || []).slice(0, 4).forEach((pick, index) => {
    row[`EquipoSemis_${index + 1}`] = pick.country;
    row[`EquipoSemis_${index + 1}_PTOS`] = typeof pick.points === "number" ? pick.points : "";
  });

  const finalPicks = (team.knockoutPicks.final || team.knockoutPicks.semis || []).slice(0, 2);
  finalPicks.forEach((pick, index) => {
    row[`EquipoFinal_${index + 1}`] = pick.country;
    row[`EquipoFinal_${index + 1}_PTOS`] = typeof pick.points === "number" ? pick.points : "";
  });

  row.TercerPuesto = team.thirdPlacePick;
  row.TercerPuesto_PTOS = getExactPoints(hasConfiguredText(adminResults?.podium.tercero) && team.thirdPlacePick === adminResults?.podium.tercero, SCORING.posicionesFinales.tercero, adminResults);
  row.Subcampeon = team.runnerUpPick;
  row.Subcampeon_PTOS = getExactPoints(hasConfiguredText(adminResults?.podium.subcampeon) && team.runnerUpPick === adminResults?.podium.subcampeon, SCORING.posicionesFinales.subcampeon, adminResults);
  row.Campeon = team.championPick;
  row.Campeon_PTOS = getExactPoints(hasConfiguredText(adminResults?.podium.campeon) && team.championPick === adminResults?.podium.campeon, SCORING.posicionesFinales.campeon, adminResults);

  row.MejorJugador = team.specials.mejorJugador;
  row.MejorJugador_PTOS = getExactPoints(hasConfiguredText(adminResults?.specialResults.mejorJugador) && team.specials.mejorJugador === adminResults?.specialResults.mejorJugador, SCORING.especiales.mejorJugador, adminResults);
  row.MejorJugadorJoven = team.specials.mejorJoven;
  row.MejorJugadorJoven_PTOS = getExactPoints(hasConfiguredText(adminResults?.specialResults.mejorJoven) && team.specials.mejorJoven === adminResults?.specialResults.mejorJoven, SCORING.especiales.mejorJoven, adminResults);
  row.MejorPortero = team.specials.mejorPortero;
  row.MejorPortero_PTOS = getExactPoints(hasConfiguredText(adminResults?.specialResults.mejorPortero) && team.specials.mejorPortero === adminResults?.specialResults.mejorPortero, SCORING.especiales.mejorPortero, adminResults);
  row.MaximoGoleador = team.specials.maxGoleador;
  row.MaximoGoleador_PTOS = getExactPoints(hasConfiguredText(adminResults?.specialResults.maxGoleador) && team.specials.maxGoleador === adminResults?.specialResults.maxGoleador, SCORING.especiales.maxGoleador, adminResults);
  row.MaximoAsistente = team.specials.maxAsistente;
  row.MaximoAsistente_PTOS = getExactPoints(hasConfiguredText(adminResults?.specialResults.maxAsistente) && team.specials.maxAsistente === adminResults?.specialResults.maxAsistente, SCORING.especiales.maxAsistente, adminResults);
  row.MaximoGoleadorESP = team.specials.maxGoleadorEsp;
  row.MaximoGoleadorESP_PTOS = getExactPoints(hasConfiguredText(adminResults?.specialResults.maxGoleadorEsp) && team.specials.maxGoleadorEsp === adminResults?.specialResults.maxGoleadorEsp, SCORING.especiales.maxGoleadorEsp, adminResults);
  row.SeleccionRevelacion = team.specials.revelacion;
  row.SeleccionRevelacion_PTOS = getExactPoints(hasConfiguredText(adminResults?.specialResults.revelacion) && team.specials.revelacion === adminResults?.specialResults.revelacion, SCORING.especiales.revelacion, adminResults);
  row.SeleccionDecepcion = team.specials.decepcion;
  row.SeleccionDecepcion_PTOS = getExactPoints(hasConfiguredText(adminResults?.specialResults.decepcion) && team.specials.decepcion === adminResults?.specialResults.decepcion, SCORING.especiales.decepcion, adminResults);
  row.MinutoPrimerGol = team.specials.minutoPrimerGol;
  row.MinutoPrimerGol_PTOS = getExactPoints(hasConfiguredNumber(adminResults?.specialResults.minutoPrimerGol) && team.specials.minutoPrimerGol === adminResults?.specialResults.minutoPrimerGol, SCORING.especiales.minutoPrimerGol, adminResults);
  row.PrimerGolESP = team.specials.primerGolEsp;
  row.PrimerGolESP_PTOS = getExactPoints(hasConfiguredText(adminResults?.specialResults.primerGolEsp) && team.specials.primerGolEsp === adminResults?.specialResults.primerGolEsp, SCORING.especiales.primerGolEsp, adminResults);

  const headerLine = CSV_TEMPLATE_HEADERS.join(",");
  const valueLine = CSV_TEMPLATE_HEADERS.map((header) => escapeCsvCell(row[header])).join(",");
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
