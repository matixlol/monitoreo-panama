import { MONTH_NAMES } from './search';

const PANAMA_CURRENCY_PREFIX = 'B/. ';
const panamaCurrencyNumberFormatter = new Intl.NumberFormat('es-PA', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  sent: 'Presentado',
  sentUnsubstantiated: 'Presentado sin sustento',
  approved: 'Aprobado',
  approvedUnsubstantiated: 'Aprobado sin sustento',
  returned: 'Devuelto',
  extemporary: 'Extemporáneo',
  audited: 'Evaluado',
  inAudit: 'En evaluación',
};

export function fullName(candidate?: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  secondLastName?: string | null;
} | null) {
  return [
    candidate?.firstName,
    candidate?.middleName,
    candidate?.lastName,
    candidate?.secondLastName,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function eventLabel(affidavit: {
  Postulation?: {
    Event?: {
      EventCategory?: { name?: string | null } | null;
      Period?: { startYear?: number | null; endYear?: number | null } | null;
    } | null;
    Position?: { name?: string | null } | null;
  } | null;
  Party?: { name?: string | null } | null;
}) {
  const category = affidavit.Postulation?.Event?.EventCategory?.name;
  const position = affidavit.Postulation?.Position?.name;
  const party = affidavit.Party?.name;
  const period = affidavit.Postulation?.Event?.Period;
  const periodLabel =
    period?.startYear && period?.endYear ? `${period.startYear} - ${period.endYear}` : '';

  return {
    category: category ?? 'Sin categoría',
    position: position ?? 'Sin cargo',
    party: party ?? 'Sin partido',
    period: periodLabel,
  };
}

export function locationLabel(affidavit: {
  Postulation?: {
    Province?: { name?: string | null } | null;
    District?: { name?: string | null } | null;
    Township?: { name?: string | null } | null;
    Circuit?: { name?: string | null } | null;
  } | null;
}) {
  return [
    affidavit.Postulation?.Province?.name,
    affidavit.Postulation?.District?.name,
    affidavit.Postulation?.Township?.name,
    affidavit.Postulation?.Circuit?.name,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function monthLabel(month?: number | null, isSummary?: boolean | null) {
  if (!month) return isSummary ? 'Final' : 'Sin mes';
  const label = MONTH_NAMES[month] ?? `Mes ${month}`;
  return isSummary ? `${label} (Final)` : label;
}

export function currency(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'B/. 0.00';
  const sign = value < 0 ? '-' : '';
  return `${PANAMA_CURRENCY_PREFIX}${sign}${panamaCurrencyNumberFormatter.format(Math.abs(value)).replace(/\u00A0/g, ' ')}`;
}

export function formatScalar(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return new Intl.NumberFormat('es-PA').format(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function pickPdfName(url: string) {
  try {
    const pathname = new URL(url).pathname;
    return decodeURIComponent(pathname.split('/').pop() || 'documento.pdf');
  } catch {
    return 'documento.pdf';
  }
}
