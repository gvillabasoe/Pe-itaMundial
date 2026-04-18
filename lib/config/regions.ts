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

export const REGION_BY_CITY: Record<string, Zone> = {
  Vancouver: "west",
  Seattle: "west",
  "San Francisco": "west",
  "Los Ángeles": "west",
  "Ciudad de México": "central",
  Monterrey: "central",
  Guadalajara: "central",
  Houston: "central",
  Dallas: "central",
  "Kansas City": "central",
  Toronto: "east",
  Boston: "east",
  Filadelfia: "east",
  Miami: "east",
  "Nueva York/Nueva Jersey": "east",
  Atlanta: "east",
};

const CITY_NORMALIZATION: Record<string, string> = {
  Vancouver: "Vancouver",
  Seattle: "Seattle",
  "San Francisco": "San Francisco",
  "Santa Clara": "San Francisco",
  "Los Angeles": "Los Ángeles",
  "Los Ángeles": "Los Ángeles",
  Inglewood: "Los Ángeles",
  "Mexico City": "Ciudad de México",
  "Ciudad de México": "Ciudad de México",
  Monterrey: "Monterrey",
  Guadalajara: "Guadalajara",
  Houston: "Houston",
  Dallas: "Dallas",
  Arlington: "Dallas",
  "Kansas City": "Kansas City",
  Toronto: "Toronto",
  Boston: "Boston",
  Foxborough: "Boston",
  Philadelphia: "Filadelfia",
  Filadelfia: "Filadelfia",
  Miami: "Miami",
  "Miami Gardens": "Miami",
  "New York": "Nueva York/Nueva Jersey",
  "New Jersey": "Nueva York/Nueva Jersey",
  "East Rutherford": "Nueva York/Nueva Jersey",
  "Nueva York/Nueva Jersey": "Nueva York/Nueva Jersey",
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
