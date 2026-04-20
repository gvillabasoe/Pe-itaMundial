import { FEATURED_TEAMS, type ProbabilityTeamConfig } from "@/lib/probabilities/team-config";

export interface PredictionTeam {
  teamKey: string;
  displayName: string;
  color: string;
  stroke?: string;
  aliases: string[];
  isPrimaryFocus: boolean;
}

export const PREDICTION_TEAMS: PredictionTeam[] = FEATURED_TEAMS.map((team): PredictionTeam => ({
  teamKey: team.teamKey,
  displayName: team.teamName,
  color: team.color,
  stroke: team.stroke,
  aliases: team.aliases,
  isPrimaryFocus: team.isPrimary,
}));

export const TEAM_ORDER = PREDICTION_TEAMS.map((team) => team.teamKey);

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function getTeamByKey(teamKey: string): PredictionTeam | undefined {
  const normalized = normalizeKey(teamKey);
  return PREDICTION_TEAMS.find((team) => team.teamKey === normalized);
}

export function getTeamByDisplayName(displayName: string): PredictionTeam | undefined {
  const normalized = normalizeKey(displayName);
  return PREDICTION_TEAMS.find((team) => normalizeKey(team.displayName) === normalized || team.aliases.some((alias) => normalizeKey(alias) === normalized));
}

export function getTeamColor(teamKeyOrDisplayName: string): string | undefined {
  return getTeamByKey(teamKeyOrDisplayName)?.color || getTeamByDisplayName(teamKeyOrDisplayName)?.color;
}

export type { ProbabilityTeamConfig };
