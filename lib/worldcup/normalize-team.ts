const ALIAS_TO_CANONICAL: Record<string, string> = {
  rd_del_congo: "RD Congo",
  rd_congo: "RD Congo",
  republica_democratica_del_congo: "RD Congo",
  paises_bajos: "Países Bajos",
  holanda: "Países Bajos",
  estados_unidos: "Estados Unidos",
  usa: "Estados Unidos",
  eeuu: "Estados Unidos",
  catar: "Catar",
  corea: "Corea del Sur",
  corea_del_sur: "Corea del Sur",
  arabia_saudi: "Arabia Saudí",
  arabia_saudita: "Arabia Saudí",
  chequia: "Chequia",
  republica_checa: "Chequia",
};

const FLAG_EMOJI: Record<string, string> = {
  mexico: "🇲🇽",
  sudafrica: "🇿🇦",
  corea_del_sur: "🇰🇷",
  chequia: "🇨🇿",
  canada: "🇨🇦",
  bosnia_y_herzegovina: "🇧🇦",
  catar: "🇶🇦",
  suiza: "🇨🇭",
  brasil: "🇧🇷",
  marruecos: "🇲🇦",
  haiti: "🇭🇹",
  escocia: "🏴",
  estados_unidos: "🇺🇸",
  paraguay: "🇵🇾",
  australia: "🇦🇺",
  turquia: "🇹🇷",
  alemania: "🇩🇪",
  curazao: "🇨🇼",
  costa_de_marfil: "🇨🇮",
  ecuador: "🇪🇨",
  paises_bajos: "🇳🇱",
  japon: "🇯🇵",
  suecia: "🇸🇪",
  tunez: "🇹🇳",
  belgica: "🇧🇪",
  egipto: "🇪🇬",
  iran: "🇮🇷",
  nueva_zelanda: "🇳🇿",
  espana: "🇪🇸",
  cabo_verde: "🇨🇻",
  arabia_saudi: "🇸🇦",
  uruguay: "🇺🇾",
  francia: "🇫🇷",
  senegal: "🇸🇳",
  irak: "🇮🇶",
  noruega: "🇳🇴",
  argentina: "🇦🇷",
  argelia: "🇩🇿",
  austria: "🇦🇹",
  jordania: "🇯🇴",
  portugal: "🇵🇹",
  rd_congo: "🇨🇩",
  uzbekistan: "🇺🇿",
  colombia: "🇨🇴",
  inglaterra: "🏴",
  croacia: "🇭🇷",
  ghana: "🇬🇭",
  panama: "🇵🇦",
};

export function normalizeTeamKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''´`".,:;!?()[\]{}]/g, "")
    .replace(/[\s\-/\\]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function getFlagForTeam(name: string): string | null {
  const key = normalizeTeamKey(name);
  return key === "inglaterra" ? "/flags/Inglaterra.png" : null;
}

export function getFlagEmoji(name: string): string {
  const key = normalizeTeamKey(name);
  return FLAG_EMOJI[key] || "🏳️";
}

export function getCanonicalTeamName(name: string): string {
  const key = normalizeTeamKey(name);
  return ALIAS_TO_CANONICAL[key] || name;
}
