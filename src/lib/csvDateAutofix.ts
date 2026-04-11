import type { CsvExportDocument } from './csvExport';

/**
 * Port of the date-autofix logic previously used in the 2026-04-07 Codex CSV cleanup.
 *
 * Rules carried over from that workflow:
 * - only trust 2023/2024 years for this election-cycle dataset
 * - infer DMY vs MDY from nearby rows with the same document/candidate context
 * - recover common OCR year issues (2-digit, 3-digit, and outlier years)
 * - preserve rows, but blank unresolved `fecha` values
 * - emit normalized ISO dates (`YYYY-MM-DD`) when a date can be recovered confidently
 */

type CsvIngressRow = CsvExportDocument['ingress'][number];
type CsvEgressRow = CsvExportDocument['egress'][number];
type CsvRow = CsvIngressRow | CsvEgressRow;
type DateStyle = 'DMY' | 'MDY';
type DateParts = { year: number; month: number; day: number };
type RowRef<Row extends CsvRow> = {
  docIndex: number;
  rowIndex: number;
  doc: CsvExportDocument;
  row: Row;
};

type StyleCounter = {
  DMY: number;
  MDY: number;
};

const ALLOWED_YEARS = new Set([2023, 2024]);
const ISO_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const NUM_RE = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/;
const MON_SLASH_RE = /^(\d{1,2})[\/\-.]([A-Za-zÀ-ÿ.]+)(?:[\/\-.](\d{2,4}))?$/i;
const MON_TEXT_RE = /^(\d{1,2})\s*de\s*([A-Za-zÀ-ÿ.]+)(?:\s*(?:de|\/|-)?\s*(\d{2,4}))?$/i;
const MON_TEXT_RE2 = /^(\d{1,2})\s+([A-Za-zÀ-ÿ.]+)\s+(\d{2,4})$/i;
const MONTH_PATTERNS = [MON_SLASH_RE, MON_TEXT_RE, MON_TEXT_RE2];
const KEY_SEPARATOR = '\u241F';

const MONTHS = new Map<string, number>([
  ['ene', 1],
  ['enero', 1],
  ['feb', 2],
  ['febrero', 2],
  ['mar', 3],
  ['marzo', 3],
  ['marz', 3],
  ['abr', 4],
  ['abril', 4],
  ['may', 5],
  ['mayo', 5],
  ['jun', 6],
  ['junio', 6],
  ['jul', 7],
  ['julio', 7],
  ['ago', 8],
  ['agosto', 8],
  ['sep', 9],
  ['sept', 9],
  ['set', 9],
  ['septiembre', 9],
  ['setiembre', 9],
  ['oct', 10],
  ['octubre', 10],
  ['nov', 11],
  ['noviembre', 11],
  ['dic', 12],
  ['diciembre', 12],
]);

function cleanRaw(value: string | null | undefined): string {
  let cleaned = (value ?? '').trim().replace(/^"+|"+$/g, '').trim();
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  cleaned = cleaned.replace(/^[,.;:\s]+|[,.;:\s]+$/g, '');
  return cleaned.replace(/\s+/g, ' ');
}

function stripAccents(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeMonthToken(token: string): number | undefined {
  return MONTHS.get(stripAccents(token).toLowerCase().replace(/[.\s]+/g, ''));
}

function formatDate({ year, month, day }: DateParts): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function tryDate(year: number, month: number, day: number): DateParts | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function year2To4(rawYear: string): number {
  const value = Number.parseInt(rawYear, 10);
  return value >= 0 && value <= 49 ? 2000 + value : 1900 + value;
}

function oneMissingDigit(rawYear: string, targetYear: number): boolean {
  const target = String(targetYear);
  if (rawYear.length !== target.length - 1) return false;
  for (let index = 0; index < target.length; index += 1) {
    if (`${target.slice(0, index)}${target.slice(index + 1)}` === rawYear) return true;
  }
  return false;
}

function dominantStyle(counter?: StyleCounter): DateStyle | null {
  if (!counter) return null;
  const dmy = counter.DMY;
  const mdy = counter.MDY;
  if (dmy > 0 && mdy === 0) return 'DMY';
  if (mdy > 0 && dmy === 0) return 'MDY';
  if (dmy >= 5 && dmy >= mdy * 5) return 'DMY';
  if (mdy >= 5 && mdy >= dmy * 5) return 'MDY';
  return null;
}

function dominantYear(counter?: Map<number, number>): number | null {
  if (!counter || counter.size === 0) return null;
  const sorted = [...counter.entries()].sort((a, b) => b[1] - a[1]);
  const [topYear, topCount] = sorted[0];
  const secondCount = sorted[1]?.[1] ?? 0;
  if (counter.size === 1) return topYear;
  if (topCount >= 3 && topCount >= secondCount * 3) return topYear;
  return null;
}

function parseWithStyle(year: number, first: number, second: number, style: DateStyle): DateParts | null {
  if (style === 'DMY') return tryDate(year, second, first);
  return tryDate(year, first, second);
}

function inferNumericStyle(cleaned: string, yearOverride?: number): { dmy: DateParts | null; mdy: DateParts | null } | null {
  const match = cleaned.match(NUM_RE);
  if (!match) return null;
  const [, firstToken, secondToken, rawYear] = match;
  const first = Number.parseInt(firstToken, 10);
  const second = Number.parseInt(secondToken, 10);
  const year = yearOverride ?? (rawYear.length === 2 ? year2To4(rawYear) : Number.parseInt(rawYear, 10));
  return {
    dmy: tryDate(year, second, first),
    mdy: tryDate(year, first, second),
  };
}

function createStyleCounter(): StyleCounter {
  return { DMY: 0, MDY: 0 };
}

function incrementStyleCounter(map: Map<string, StyleCounter>, key: string, style: DateStyle): void {
  const counter = map.get(key) ?? createStyleCounter();
  counter[style] += 1;
  map.set(key, counter);
}

function incrementYearCounter(map: Map<string, Map<number, number>>, key: string, year: number): void {
  const counter = map.get(key) ?? new Map<number, number>();
  counter.set(year, (counter.get(year) ?? 0) + 1);
  map.set(key, counter);
}

function countStyles<Row extends CsvRow>(
  refs: RowRef<Row>[],
  getKey: (ref: RowRef<Row>) => string,
): {
  styleCounts: Map<string, StyleCounter>;
  yearCounts: Map<string, Map<number, number>>;
} {
  const styleCounts = new Map<string, StyleCounter>();
  const yearCounts = new Map<string, Map<number, number>>();

  for (const ref of refs) {
    const cleaned = cleanRaw(ref.row.fecha);
    if (!cleaned) continue;

    const key = getKey(ref);
    const isoMatch = cleaned.match(ISO_RE);
    if (isoMatch) {
      const year = Number.parseInt(isoMatch[1], 10);
      const month = Number.parseInt(isoMatch[2], 10);
      const day = Number.parseInt(isoMatch[3], 10);
      if (ALLOWED_YEARS.has(year) && tryDate(year, month, day)) {
        incrementYearCounter(yearCounts, key, year);
      }
      continue;
    }

    const numericMatch = cleaned.match(NUM_RE);
    if (numericMatch) {
      const [, , , rawYear] = numericMatch;
      const year = rawYear.length === 2 ? year2To4(rawYear) : Number.parseInt(rawYear, 10);
      if (ALLOWED_YEARS.has(year)) {
        incrementYearCounter(yearCounts, key, year);
      }

      const inferred = inferNumericStyle(cleaned);
      if (inferred?.dmy && !inferred.mdy) incrementStyleCounter(styleCounts, key, 'DMY');
      if (inferred?.mdy && !inferred.dmy) incrementStyleCounter(styleCounts, key, 'MDY');
      continue;
    }

    for (const pattern of MONTH_PATTERNS) {
      const monthMatch = cleaned.match(pattern);
      if (!monthMatch) continue;
      const [, dayToken, monthToken, rawYear] = monthMatch;
      const month = normalizeMonthToken(monthToken);
      if (!month || !rawYear) break;
      const year = rawYear.length === 2 ? year2To4(rawYear) : Number.parseInt(rawYear, 10);
      const day = Number.parseInt(dayToken, 10);
      if (ALLOWED_YEARS.has(year) && tryDate(year, month, day)) {
        incrementYearCounter(yearCounts, key, year);
      }
      break;
    }
  }

  return { styleCounts, yearCounts };
}

function normalizeDateValue(
  rawFecha: string | null | undefined,
  broadStyle: DateStyle | null,
  broadYear: number | null,
  localStyle: DateStyle | null,
  localYear: number | null,
): string | null {
  const cleaned = cleanRaw(rawFecha);
  if (!cleaned) return null;

  const preferredStyle = broadStyle ?? localStyle;
  const preferredYear = broadYear ?? localYear;

  const isoMatch = cleaned.match(ISO_RE);
  if (isoMatch) {
    const year = Number.parseInt(isoMatch[1], 10);
    const month = Number.parseInt(isoMatch[2], 10);
    const day = Number.parseInt(isoMatch[3], 10);

    if (ALLOWED_YEARS.has(year)) {
      const parsed = tryDate(year, month, day);
      return parsed ? formatDate(parsed) : null;
    }

    if (preferredYear && ALLOWED_YEARS.has(preferredYear)) {
      const parsed = tryDate(preferredYear, month, day);
      return parsed ? formatDate(parsed) : null;
    }

    return null;
  }

  const numericMatch = cleaned.match(NUM_RE);
  if (numericMatch) {
    const [, firstToken, secondToken, rawYear] = numericMatch;
    const first = Number.parseInt(firstToken, 10);
    const second = Number.parseInt(secondToken, 10);

    if (rawYear.length === 4) {
      const year = Number.parseInt(rawYear, 10);
      if (ALLOWED_YEARS.has(year)) {
        const inferred = inferNumericStyle(cleaned);
        if (inferred?.dmy && !inferred.mdy) return formatDate(inferred.dmy);
        if (inferred?.mdy && !inferred.dmy) return formatDate(inferred.mdy);
        if (preferredStyle) {
          const parsed = parseWithStyle(year, first, second, preferredStyle);
          return parsed ? formatDate(parsed) : null;
        }
        return null;
      }

      if (preferredYear && ALLOWED_YEARS.has(preferredYear)) {
        const inferred = inferNumericStyle(cleaned, preferredYear);
        if (inferred?.dmy && !inferred.mdy) return formatDate(inferred.dmy);
        if (inferred?.mdy && !inferred.dmy) return formatDate(inferred.mdy);
        if (preferredStyle) {
          const parsed = parseWithStyle(preferredYear, first, second, preferredStyle);
          return parsed ? formatDate(parsed) : null;
        }
      }

      return null;
    }

    if (rawYear.length === 3) {
      if (preferredYear && ALLOWED_YEARS.has(preferredYear) && oneMissingDigit(rawYear, preferredYear)) {
        const inferred = inferNumericStyle(cleaned, preferredYear);
        if (inferred?.dmy && !inferred.mdy) return formatDate(inferred.dmy);
        if (inferred?.mdy && !inferred.dmy) return formatDate(inferred.mdy);
        if (preferredStyle) {
          const parsed = parseWithStyle(preferredYear, first, second, preferredStyle);
          return parsed ? formatDate(parsed) : null;
        }
      }
      return null;
    }

    const year = year2To4(rawYear);
    if (ALLOWED_YEARS.has(year)) {
      const inferred = inferNumericStyle(cleaned);
      if (inferred?.dmy && !inferred.mdy) return formatDate(inferred.dmy);
      if (inferred?.mdy && !inferred.dmy) return formatDate(inferred.mdy);
      if (preferredStyle) {
        const parsed = parseWithStyle(year, first, second, preferredStyle);
        return parsed ? formatDate(parsed) : null;
      }
      return null;
    }

    if (preferredYear && ALLOWED_YEARS.has(preferredYear)) {
      const inferred = inferNumericStyle(cleaned, preferredYear);
      if (inferred?.dmy && !inferred.mdy) return formatDate(inferred.dmy);
      if (inferred?.mdy && !inferred.dmy) return formatDate(inferred.mdy);
      if (preferredStyle) {
        const parsed = parseWithStyle(preferredYear, first, second, preferredStyle);
        return parsed ? formatDate(parsed) : null;
      }
    }

    return null;
  }

  for (const pattern of MONTH_PATTERNS) {
    const monthMatch = cleaned.match(pattern);
    if (!monthMatch) continue;

    const [, dayToken, monthToken, rawYear] = monthMatch;
    const month = normalizeMonthToken(monthToken);
    if (!month) return null;

    const day = Number.parseInt(dayToken, 10);

    if (!rawYear) {
      if (preferredYear && ALLOWED_YEARS.has(preferredYear)) {
        const parsed = tryDate(preferredYear, month, day);
        return parsed ? formatDate(parsed) : null;
      }
      return null;
    }

    if (rawYear.length === 4) {
      const year = Number.parseInt(rawYear, 10);
      if (ALLOWED_YEARS.has(year)) {
        const parsed = tryDate(year, month, day);
        return parsed ? formatDate(parsed) : null;
      }
      if (preferredYear && ALLOWED_YEARS.has(preferredYear)) {
        const parsed = tryDate(preferredYear, month, day);
        return parsed ? formatDate(parsed) : null;
      }
      return null;
    }

    if (rawYear.length === 3) {
      if (preferredYear && ALLOWED_YEARS.has(preferredYear) && oneMissingDigit(rawYear, preferredYear)) {
        const parsed = tryDate(preferredYear, month, day);
        return parsed ? formatDate(parsed) : null;
      }
      return null;
    }

    const year = year2To4(rawYear);
    if (ALLOWED_YEARS.has(year)) {
      const parsed = tryDate(year, month, day);
      return parsed ? formatDate(parsed) : null;
    }
    if (preferredYear && ALLOWED_YEARS.has(preferredYear)) {
      const parsed = tryDate(preferredYear, month, day);
      return parsed ? formatDate(parsed) : null;
    }
    return null;
  }

  return null;
}

function normalizeRows<Row extends CsvRow>(
  refs: RowRef<Row>[],
  getBroadKey: (ref: RowRef<Row>) => string,
  getLocalKey?: (ref: RowRef<Row>) => string,
): Array<string | null> {
  const { styleCounts: broadStyles, yearCounts: broadYears } = countStyles(refs, getBroadKey);
  const localAnalysis = getLocalKey
    ? countStyles(refs, getLocalKey)
    : { styleCounts: new Map<string, StyleCounter>(), yearCounts: new Map<string, Map<number, number>>() };

  return refs.map((ref) => {
    const broadKey = getBroadKey(ref);
    const localKey = getLocalKey?.(ref);
    return normalizeDateValue(
      ref.row.fecha,
      dominantStyle(broadStyles.get(broadKey)),
      dominantYear(broadYears.get(broadKey)),
      localKey ? dominantStyle(localAnalysis.styleCounts.get(localKey)) : null,
      localKey ? dominantYear(localAnalysis.yearCounts.get(localKey)) : null,
    );
  });
}

function buildEgressBroadKey(doc: CsvExportDocument): string {
  const parts = [
    doc.candidateName ?? '',
    doc.candidatePosition ?? '',
    doc.candidateParty ?? '',
    doc.candidateProvince ?? '',
    doc.candidateDistrict ?? '',
  ];

  if (parts.some((part) => part.length > 0)) {
    return parts.join(KEY_SEPARATOR);
  }

  return `${doc._id}${KEY_SEPARATOR}${doc.name}`;
}

export function autofixCsvExportDates(exportData: CsvExportDocument[]): CsvExportDocument[] {
  const normalizedDocs = exportData.map((doc) => ({
    ...doc,
    ingress: doc.ingress.map((row) => ({ ...row })),
    egress: doc.egress.map((row) => ({ ...row })),
  }));

  const ingressRefs: RowRef<CsvIngressRow>[] = normalizedDocs.flatMap((doc, docIndex) =>
    doc.ingress.map((row, rowIndex) => ({ doc, docIndex, row, rowIndex })),
  );
  const egressRefs: RowRef<CsvEgressRow>[] = normalizedDocs.flatMap((doc, docIndex) =>
    doc.egress.map((row, rowIndex) => ({ doc, docIndex, row, rowIndex })),
  );

  const normalizedIngressDates = normalizeRows(
    ingressRefs,
    (ref) => ref.doc._id,
    (ref) => `${ref.doc._id}${KEY_SEPARATOR}${ref.row.pageNumber}`,
  );
  const normalizedEgressDates = normalizeRows(
    egressRefs,
    (ref) => buildEgressBroadKey(ref.doc),
    (ref) => `${ref.doc._id}${KEY_SEPARATOR}${ref.row.pageNumber}`,
  );

  normalizedIngressDates.forEach((fecha, index) => {
    const ref = ingressRefs[index];
    normalizedDocs[ref.docIndex].ingress[ref.rowIndex].fecha = fecha;
  });

  normalizedEgressDates.forEach((fecha, index) => {
    const ref = egressRefs[index];
    normalizedDocs[ref.docIndex].egress[ref.rowIndex].fecha = fecha;
  });

  return normalizedDocs;
}
