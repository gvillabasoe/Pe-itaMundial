export type Zone = "west" | "central" | "east";

export interface RegionPalette {
  primary: string;
  secondary: string;
  tertiary?: string;
}

export const REGION_PALETTES: Record<Zone, RegionPalette> = {
  west: { primary: "#58BBB4", secondary: "#B4DDD0" },
  central: { primary: "#6DBF75", secondary: "#B6D554", tertiary: "#998729" },
  east: { primary: "#F58020", secondary: "#F58472", tertiary: "#F8AA9D" },
};

export const REGION_LABELS: Record<Zone, string> = {
  west: "Oeste",
  central: "Centro",
  east: "Este",
};

// ════════════════════════════════════════════════════════════
// Mapping de sede (display name) → región
//
// Cambios respecto a la versión anterior:
//   - "Ciudad de México"        → "CDMX"
//   - "Nueva York/Nueva Jersey" → "NY/NJ"
//
// Los aliases largos siguen aceptándose en CITY_NORMALIZATION para
// compatibilidad: la API-Football y otros datos antiguos pueden
// llegar con los nombres largos, los normalizamos al short.
// ════════════════════════════════════════════════════════════

export const REGION_BY_CITY: Record<string, Zone> = {
  Vancouver: "west",
  Seattle: "west",
  "San Francisco": "west",
  "Los Ángeles": "west",
  CDMX: "central",
  Monterrey: "central",
  Guadalajara: "central",
  Houston: "central",
  Dallas: "central",
  "Kansas City": "central",
  Toronto: "east",
  Boston: "east",
  Filadelfia: "east",
  Miami: "east",
  "NY/NJ": "east",
  Atlanta: "east",
};

const CITY_NORMALIZATION: Record<string, string> = {
  // Oeste
  Vancouver: "Vancouver",
  Seattle: "Seattle",
  "San Francisco": "San Francisco",
  "Santa Clara": "San Francisco",
  "Los Angeles": "Los Ángeles",
  "Los Ángeles": "Los Ángeles",
  Inglewood: "Los Ángeles",

  // Centro — alias de Ciudad de México mapean a "CDMX"
  "Mexico City": "CDMX",
  "Ciudad de México": "CDMX",
  CDMX: "CDMX",
  Monterrey: "Monterrey",
  Guadalajara: "Guadalajara",
  Houston: "Houston",
  Dallas: "Dallas",
  Arlington: "Dallas",
  "Kansas City": "Kansas City",

  // Este — alias de Nueva York / Nueva Jersey mapean a "NY/NJ"
  Toronto: "Toronto",
  Boston: "Boston",
  Foxborough: "Boston",
  Philadelphia: "Filadelfia",
  Filadelfia: "Filadelfia",
  Miami: "Miami",
  "Miami Gardens": "Miami",
  "New York": "NY/NJ",
  "New Jersey": "NY/NJ",
  "East Rutherford": "NY/NJ",
  "Nueva York/Nueva Jersey": "NY/NJ",
  "NY/NJ": "NY/NJ",
  Atlanta: "Atlanta",
};

export const ALL_HOST_CITIES = Object.keys(REGION_BY_CITY);

export function normalizeCity(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return CITY_NORMALIZATION[raw.trim()] || null;
}

export function getZoneForCity(city: string | null | undefined): Zone | null {
  if (!city) return null;
  return REGION_BY_CITY[city] || null;
}

export function getPaletteForCity(city: string | null | undefined): RegionPalette | null {
  const zone = getZoneForCity(city);
  return zone ? REGION_PALETTES[zone] : null;
}

export function getCityColor(city: string | null | undefined): string {
  return getPaletteForCity(city)?.primary || "#98A3B8";
}

export function getCityBgColor(city: string | null | undefined): string {
  const palette = getPaletteForCity(city);
  return palette ? `${palette.primary}18` : "rgba(152,163,184,0.08)";
}
