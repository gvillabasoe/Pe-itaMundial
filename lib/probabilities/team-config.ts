export interface ProbabilityTeamConfig {
  teamKey: string;
  teamName: string;
  color: string;
  stroke?: string;
  isPrimary: boolean;
  aliases: string[];
}

export const FEATURED_TEAM_ORDER = [
  "España",
  "Francia",
  "Inglaterra",
  "Argentina",
  "Brasil",
  "Portugal",
  "Alemania",
  "Países Bajos",
  "Noruega",
  "Uruguay",
] as const;

export const FEATURED_TEAMS: ProbabilityTeamConfig[] = [
  { teamKey: "espana", teamName: "España", color: "#C1121F", isPrimary: true, aliases: ["spain", "espana", "españa"] },
  { teamKey: "francia", teamName: "Francia", color: "#1D4ED8", isPrimary: false, aliases: ["france", "francia"] },
  { teamKey: "inglaterra", teamName: "Inglaterra", color: "#7A8598", isPrimary: false, aliases: ["england", "inglaterra"] },
  { teamKey: "argentina", teamName: "Argentina", color: "#6EC6FF", isPrimary: false, aliases: ["argentina"] },
  { teamKey: "brasil", teamName: "Brasil", color: "#EAB308", isPrimary: false, aliases: ["brazil", "brasil"] },
  { teamKey: "portugal", teamName: "Portugal", color: "#16A34A", isPrimary: false, aliases: ["portugal"] },
  { teamKey: "alemania", teamName: "Alemania", color: "#94A3B8", stroke: "#1F2937", isPrimary: false, aliases: ["germany", "alemania", "deutschland"] },
  { teamKey: "paises-bajos", teamName: "Países Bajos", color: "#F48020", isPrimary: false, aliases: ["netherlands", "paises bajos", "países bajos", "holanda"] },
  { teamKey: "noruega", teamName: "Noruega", color: "#EF476F", isPrimary: false, aliases: ["norway", "noruega"] },
  { teamKey: "uruguay", teamName: "Uruguay", color: "#55BCBB", isPrimary: false, aliases: ["uruguay"] },
];

export const FEATURED_TEAM_BY_NAME = Object.fromEntries(FEATURED_TEAMS.map((team) => [team.teamName, team])) as Record<string, ProbabilityTeamConfig>;

export const FEATURED_TEAM_BY_KEY = Object.fromEntries(FEATURED_TEAMS.map((team) => [team.teamKey, team])) as Record<string, ProbabilityTeamConfig>;

const FEATURED_TEAM_COLORS = Object.fromEntries(FEATURED_TEAMS.map((team) => [team.teamName, team.color])) as Record<string, string>;

export const PROBABILITY_TEAM_COLORS: Record<string, string> = {
  ...FEATURED_TEAM_COLORS,
  "Arabia Saudí": "#006C35",
  "Argelia": "#006233",
  "Australia": "#00843D",
  "Austria": "#ED2939",
  "Bélgica": "#FAE042",
  "Bosnia y Herzegovina": "#002395",
  "Cabo Verde": "#003893",
  "Canadá": "#D80621",
  "Catar": "#8A1538",
  "Chequia": "#D7141A",
  "Colombia": "#FCD116",
  "Corea del Sur": "#C60C30",
  "Costa de Marfil": "#F77F00",
  "Croacia": "#171796",
  "Curazao": "#002B7F",
  "Ecuador": "#FFDD00",
  "Egipto": "#CE1126",
  "Escocia": "#005EB8",
  "Estados Unidos": "#3C3B6E",
  "Ghana": "#FCD116",
  "Haití": "#00209F",
  "Irak": "#CE1126",
  "Irán": "#239F40",
  "Japón": "#BC002D",
  "Jordania": "#007A3D",
  "Marruecos": "#C1272D",
  "México": "#006847",
  "Nueva Zelanda": "#111827",
  "Panamá": "#005293",
  "Paraguay": "#D52B1E",
  "RD Congo": "#007FFF",
  "Senegal": "#00853F",
  "Sudáfrica": "#007A4D",
  "Suecia": "#006AA7",
  "Suiza": "#D52B1E",
  "Túnez": "#E70013",
  "Turquía": "#E30A17",
  "Uzbekistán": "#0099B5",
};

const OPEN_MARKET_COLORS = [
  "#D4AF37",
  "#C1121F",
  "#1D4ED8",
  "#16A34A",
  "#F48020",
  "#F0417A",
  "#6EC6FF",
  "#98A3B8",
  "#8B5CF6",
  "#14B8A6",
] as const;

export function getProbabilityColorForName(name: string, index = 0): string {
  return PROBABILITY_TEAM_COLORS[name] || OPEN_MARKET_COLORS[index % OPEN_MARKET_COLORS.length] || "#D4AF37";
}
