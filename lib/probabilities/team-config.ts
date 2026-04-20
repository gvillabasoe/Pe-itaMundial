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
