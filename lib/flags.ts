const FLAG_ALIAS_TO_FILE_KEY: Record<string, string> = {
  alemania: "alemania",
  germany: "alemania",

  arabia_saudi: "arabia-saudi",
  arabia_saudita: "arabia-saudi",
  saudi_arabia: "arabia-saudi",

  argelia: "argelia",
  algeria: "argelia",

  argentina: "argentina",
  australia: "australia",
  austria: "austria",

  belgica: "belgica",
  belgium: "belgica",

  bolivia: "bolivia",

  bosnia_y_herzegovina: "bosnia-y-herzegovina",
  bosnia_and_herzegovina: "bosnia-y-herzegovina",
  bosnia_herzegovina: "bosnia-y-herzegovina",

  brasil: "brasil",
  brazil: "brasil",

  cabo_verde: "cabo-verde",
  cape_verde: "cabo-verde",

  canada: "canada",
  colombia: "colombia",

  corea: "corea",
  corea_del_sur: "corea",
  south_korea: "corea",
  korea_republic: "corea",
  republic_of_korea: "corea",

  costa_de_marfil: "costa-marfil",
  costa_marfil: "costa-marfil",
  ivory_coast: "costa-marfil",
  cote_divoire: "costa-marfil",

  croacia: "croacia",
  croatia: "croacia",

  curazao: "curazao",
  curacao: "curazao",

  dinamarca: "dinamarca",
  denmark: "dinamarca",

  ecuador: "ecuador",

  egipto: "egipto",
  egypt: "egipto",

  emiratos_arabes_unidos: "emiratos-arabes-unidos",
  united_arab_emirates: "emiratos-arabes-unidos",

  escocia: "escocia",
  scotland: "escocia",

  eslovaquia: "eslovaquia",
  slovakia: "eslovaquia",

  espana: "espana",
  spain: "espana",

  francia: "francia",
  france: "francia",

  gales: "gales",
  wales: "gales",

  ghana: "ghana",

  haiti: "haiti",

  holanda: "holanda",
  paises_bajos: "holanda",
  netherlands: "holanda",
  holland: "holanda",

  inglaterra: "inglaterra",
  england: "inglaterra",

  iran: "iran",
  ir_iran: "iran",

  iraq: "iraq",
  irak: "iraq",

  irlanda_del_norte: "irlanda-del-norte",
  northern_ireland: "irlanda-del-norte",

  irlanda: "irlanda",
  ireland: "irlanda",

  italia: "italia",
  italy: "italia",

  jamaica: "jamaica",

  japon: "japon",
  japan: "japon",

  jordania: "jordania",
  jordan: "jordania",

  kosovo: "kosovo",

  macedonia_del_norte: "macedonia-del-norte",
  north_macedonia: "macedonia-del-norte",

  marruecos: "marruecos",
  morocco: "marruecos",

  mexico: "mexico",

  noruega: "noruega",
  norway: "noruega",

  nueva_caledonia: "nueva-caledonia",
  new_caledonia: "nueva-caledonia",

  nueva_zelanda: "nueva-zelanda",
  new_zealand: "nueva-zelanda",

  panama: "panama",
  paraguay: "paraguay",

  polonia: "polonia",
  poland: "polonia",

  portugal: "portugal",

  qatar: "qatar",
  catar: "qatar",

  rd_congo: "rd-congo",
  rd_del_congo: "rd-congo",
  dr_congo: "rd-congo",
  congo_dr: "rd-congo",
  republica_democratica_del_congo: "rd-congo",
  democratic_republic_of_the_congo: "rd-congo",

  republica_checa: "republica-checa",
  chequia: "republica-checa",
  czechia: "republica-checa",
  czech_republic: "republica-checa",

  rumania: "rumania",
  romania: "rumania",

  senegal: "senegal",

  sudafrica: "sudafrica",
  south_africa: "sudafrica",

  suecia: "suecia",
  sweden: "suecia",

  suiza: "suiza",
  switzerland: "suiza",

  surinam: "surinam",
  suriname: "surinam",

  tunez: "tunez",
  tunisia: "tunez",

  turquia: "turquia",
  turkey: "turquia",
  turkiye: "turquia",

  ucrania: "ucrania",
  ukraine: "ucrania",

  uruguay: "uruguay",

  usa: "usa",
  eeuu: "usa",
  estados_unidos: "usa",
  united_states: "usa",
  usmnt: "usa",

  uzbekistan: "uzbekistan",
};

const FLAG_FILE_KEYS = new Set([
  "alemania",
  "arabia-saudi",
  "argelia",
  "argentina",
  "australia",
  "austria",
  "belgica",
  "bolivia",
  "bosnia-y-herzegovina",
  "brasil",
  "cabo-verde",
  "canada",
  "colombia",
  "corea",
  "corea-del-sur",
  "costa-marfil",
  "costa-de-marfil",
  "croacia",
  "curazao",
  "dinamarca",
  "ecuador",
  "egipto",
  "emiratos-arabes-unidos",
  "escocia",
  "eslovaquia",
  "espana",
  "francia",
  "gales",
  "ghana",
  "haiti",
  "holanda",
  "paises-bajos",
  "inglaterra",
  "iran",
  "iraq",
  "irak",
  "irlanda",
  "irlanda-del-norte",
  "italia",
  "jamaica",
  "japon",
  "jordania",
  "kosovo",
  "macedonia-del-norte",
  "marruecos",
  "mexico",
  "noruega",
  "nueva-caledonia",
  "nueva-zelanda",
  "panama",
  "paraguay",
  "polonia",
  "portugal",
  "qatar",
  "catar",
  "rd-congo",
  "rd-del-congo",
  "republica-checa",
  "chequia",
  "rumania",
  "senegal",
  "sudafrica",
  "suecia",
  "suiza",
  "surinam",
  "tunez",
  "turquia",
  "ucrania",
  "uruguay",
  "usa",
  "estados-unidos",
  "uzbekistan",
]);

export function normalizeCountryKey(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'´`,:;!?()[\]{}]/g, "")
    .replace(/[\s\-/\\]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function getFlagFileKey(country: string): string | null {
  const normalized = normalizeCountryKey(country);
  if (!normalized) return null;

  const fromAlias = FLAG_ALIAS_TO_FILE_KEY[normalized];
  if (fromAlias && FLAG_FILE_KEYS.has(fromAlias)) {
    return fromAlias;
  }

  const direct = normalized.replace(/_/g, "-");
  return FLAG_FILE_KEYS.has(direct) ? direct : null;
}

export function hasFlagAsset(country: string): boolean {
  return Boolean(getFlagFileKey(country));
}

export function getFlagPath(country: string): string | null {
  const fileKey = getFlagFileKey(country);
  return fileKey ? `/flags/${fileKey}.png` : null;
}

function getFallbackFlagLabel(country: string): string {
  const letters = String(country || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() || "")
    .join("");

  return letters || String(country || "").slice(0, 2).toUpperCase() || "--";
}

export function getFlagEmoji(country: string): string {
  return getFallbackFlagLabel(country);
}

export const KNOWN_FLAG_KEYS = Array.from(FLAG_FILE_KEYS.values());
