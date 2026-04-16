import type { EgressRow, IngressRow } from './types';

type Row = IngressRow | EgressRow;
type DateParts = {
  year: number;
  month: number;
  day: number;
};

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

export function parseDocumentDate(value: string | null | undefined): DateParts | null {
  if (!value) return null;
  const normalized = value.trim().replace(/\./g, '/').replace(/-/g, '/');
  if (!normalized) return null;

  let parts: DateParts | null = null;

  const isoMatch = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (isoMatch) {
    parts = {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
    };
  }

  const dmyMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!parts && dmyMatch) {
    parts = {
      year: Number(dmyMatch[3]),
      month: Number(dmyMatch[2]),
      day: Number(dmyMatch[1]),
    };
  }

  if (!parts) return null;

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() !== parts.month - 1 ||
    date.getUTCDate() !== parts.day
  ) {
    return null;
  }

  return parts;
}

export function getDocumentDateSortKey(value: string | null | undefined): number {
  const parsed = parseDocumentDate(value);
  if (!parsed) return Number.NEGATIVE_INFINITY;
  return Date.UTC(parsed.year, parsed.month - 1, parsed.day);
}

export function sortRowsByDateDesc<T extends { fecha?: string | null }>(rows: T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        getDocumentDateSortKey(b.row.fecha) - getDocumentDateSortKey(a.row.fecha) || a.index - b.index,
    )
    .map(({ row }) => row);
}
