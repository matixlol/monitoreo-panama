import type { EgressRow, IngressRow } from './types';

type Row = IngressRow | EgressRow;

function isMeaningfulKeyValue(value: unknown): value is string | number {
  if (value == null) return false;
  const str = String(value).trim();
  if (str === '') return false;
  if (str === 'null') return false;
  if (str === 'undefined') return false;
  return true;
}

export function stableRowKeyForRow(row: Row, keyField: string): string | null {
  const keyValue = (row as Record<string, unknown>)[keyField];
  if (!isMeaningfulKeyValue(keyValue)) return null;
  const page = (row as Record<string, unknown>)['pageNumber'];
  return `${String(page)}::${String(keyValue)}`;
}

export function normalizeCedulaRuc(value: string | null | undefined): string | null {
  if (value == null) return null;
  return value.replace(/-/g, '.');
}

export function normalizeDate(value: string | null | undefined): string | null {
  if (value == null) return null;
  return value.replace(/\./g, '-');
}

export function normalizeValueForComparison(field: string, value: unknown): unknown {
  if (value == null) return value;
  if (typeof value !== 'string') return value;

  if (field === 'cedulaRuc') return normalizeCedulaRuc(value);
  if (field === 'fecha') return normalizeDate(value);
  return value;
}

export function normalizeValueForDisplay(field: string, value: unknown): string {
  if (value == null) return '—';
  if (typeof value !== 'string') return String(value);

  if (field === 'cedulaRuc') return normalizeCedulaRuc(value) ?? '—';
  if (field === 'fecha') return normalizeDate(value) ?? '—';
  return value;
}
