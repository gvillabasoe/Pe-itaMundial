import type { HomeTab, PickStateTone, StageKey } from '@/types/domain';

export const MADRID_TIMEZONE = 'Europe/Madrid' as const;
export const WORLD_CUP_START_UTC = '2026-06-11T19:00:00.000Z';
export const DEFAULT_HOME_TAB: HomeTab = 'clasificacion';
export const HOME_TABS: Array<{ key: HomeTab; label: string }> = [
  { key: 'clasificacion', label: 'Clasificación general' },
  { key: 'resultados', label: 'Resultados' },
  { key: 'estadisticas', label: 'Estadísticas' },
];

export const STAGE_LABELS: Record<StageKey, string> = {
  group: 'Fase de grupos',
  round32: 'Dieciseisavos',
  round16: 'Octavos',
  quarterfinal: 'Cuartos',
  semifinal: 'Semifinales',
  thirdPlace: 'Tercer puesto',
  final: 'Final',
};

export const PICK_STATE_META: Record<
  PickStateTone,
  { label: string; shortLabel: string; className: string }
> = {
  green: {
    label: 'resultado acertado',
    shortLabel: 'R',
    className: 'tone-green',
  },
  yellow: {
    label: 'signo acertado',
    shortLabel: '1X2',
    className: 'tone-yellow',
  },
  gold: {
    label: 'x2 resultado acertado',
    shortLabel: 'x2 R',
    className: 'tone-gold',
  },
  silver: {
    label: 'x2 signo acertado',
    shortLabel: 'x2 1X2',
    className: 'tone-silver',
  },
  red: {
    label: 'fallo',
    shortLabel: '0',
    className: 'tone-red',
  },
  pending: {
    label: 'pendiente',
    shortLabel: '?',
    className: 'tone-pending',
  },
};
