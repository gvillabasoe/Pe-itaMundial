import { getFlagEmoji as getSharedFlagEmoji, getFlagPath, normalizeCountryKey } from "@/lib/flags";

const ALIAS_TO_CANONICAL: Record<string, string> = {
  rd_del_congo: "RD Congo",
  rd_congo: "RD Congo",
  republica_democratica_del_congo: "RD Congo",
  paises_bajos: "Países Bajos",
  holanda: "Países Bajos",
  estados_unidos: "Estados Unidos",
  eeuu: "Estados Unidos",
  usa: "Estados Unidos",
  catar: "Catar",
  qatar: "Catar",
  corea: "Corea del Sur",
  corea_del_sur: "Corea del Sur",
  arabia_saudi: "Arabia Saudí",
  arabia_saudita: "Arabia Saudí",
  chequia: "Chequia",
  republica_checa: "Chequia",
  costa_marfil: "Costa de Marfil",
  costa_de_marfil: "Costa de Marfil",
  iraq: "Irak",
  irak: "Irak",
};

export function normalizeTeamKey(name: string): string {
  const key = normalizeCountryKey(name);
  return key == "rd_congo" ? "rd_del_congo" : key;
}

export function getFlagForTeam(name: string): string | null {
  return getFlagPath(name);
}

export function getFlagEmoji(name: string): string {
  return getSharedFlagEmoji(name);
}

export function getCanonicalTeamName(name: string): string {
  const key = normalizeTeamKey(name);
  return ALIAS_TO_CANONICAL[key] || name;
}
