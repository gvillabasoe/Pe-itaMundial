const FILE_KEY_OVERRIDES: Record<string, string> = {
  estados_unidos: "usa",
  eeuu: "usa",
  usa: "usa",
  paises_bajos: "holanda",
  holanda: "holanda",
  corea_del_sur: "corea",
  corea: "corea",
  costa_de_marfil: "costa-marfil",
  costa_marfil: "costa-marfil",
  catar: "qatar",
  qatar: "qatar",
  irak: "iraq",
  iraq: "iraq",
  chequia: "republica-checa",
  republica_checa: "republica-checa",
  rd_congo: "rd-congo",
  rd_del_congo: "rd-congo",
  arabia_saudi: "arabia-saudi",
  arabia_saudita: "arabia-saudi",
  bosnia_y_herzegovina: "bosnia-y-herzegovina",
  nueva_zelanda: "nueva-zelanda",
  cabo_verde: "cabo-verde",
  irlanda_del_norte: "irlanda-del-norte",
  macedonia_del_norte: "macedonia-del-norte",
  emiratos_arabes_unidos: "emiratos-arabes-unidos",
};

const KNOWN_FLAG_FILE_KEYS = new Set([
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
  "costa-marfil",
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
  "inglaterra",
  "iran",
  "iraq",
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
  "rd-congo",
  "republica-checa",
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
  "uzbekistan",
]);

export function normalizeCountryKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'´`,:;!?()[\]{}]/g, "")
    .replace(/[\s\-/\\]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function fileKeyForCountry(country: string): string | null {
  const normalized = normalizeCountryKey(country);
  const fileKey = FILE_KEY_OVERRIDES[normalized] || normalized.replace(/_/g, "-");
  return KNOWN_FLAG_FILE_KEYS.has(fileKey) ? fileKey : null;
}

export function getFlagPath(country: string): string | null {
  const fileKey = fileKeyForCountry(country);
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

export const KNOWN_FLAG_KEYS = Array.from(KNOWN_FLAG_FILE_KEYS.values());
