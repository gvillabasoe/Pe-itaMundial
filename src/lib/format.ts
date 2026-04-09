import { MADRID_TIMEZONE } from '@/lib/constants';

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-ES').format(value);
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export function formatMadridDateTime(isoUtc: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: MADRID_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(isoUtc));
}

export function formatMadridDateLong(isoUtc: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: MADRID_TIMEZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(isoUtc));
}

export function formatPublishedAt(isoUtc: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: MADRID_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(isoUtc));
}
