import { WORLD_CUP_MATCHES } from "./schedule";
import { REGION_BY_CITY } from "./zones";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSchedule(): ValidationResult {
  const errors: string[] = [];
  const matches = WORLD_CUP_MATCHES;

  // Total count
  if (matches.length !== 104) errors.push(`Expected 104 matches, got ${matches.length}`);

  // IDs consecutive 1-104
  const ids = matches.map(m => m.id).sort((a, b) => a - b);
  for (let i = 0; i < 104; i++) {
    if (ids[i] !== i + 1) { errors.push(`Missing or duplicate ID: expected ${i + 1}`); break; }
  }

  // Stage counts
  const stageCounts: Record<string, number> = {};
  matches.forEach(m => { stageCounts[m.stage] = (stageCounts[m.stage] || 0) + 1; });
  const expected: Record<string, number> = {
    "group": 72, "round-of-32": 16, "round-of-16": 8,
    "quarter-final": 4, "semi-final": 2, "third-place": 1, "final": 1,
  };
  for (const [stage, count] of Object.entries(expected)) {
    if ((stageCounts[stage] || 0) !== count) {
      errors.push(`Stage "${stage}": expected ${count}, got ${stageCounts[stage] || 0}`);
    }
  }

  // All cities in region map
  for (const match of matches) {
    if (!REGION_BY_CITY[match.hostCity]) {
      errors.push(`Match ${match.id}: city "${match.hostCity}" not in region map`);
    }
  }

  // Zone validation
  const validZones = new Set(["west", "central", "east"]);
  for (const match of matches) {
    if (!validZones.has(match.zone)) {
      errors.push(`Match ${match.id}: invalid zone "${match.zone}"`);
    }
  }

  // Duplicate IDs
  const idSet = new Set<number>();
  for (const match of matches) {
    if (idSet.has(match.id)) errors.push(`Duplicate ID: ${match.id}`);
    idSet.add(match.id);
  }

  return { valid: errors.length === 0, errors };
}
