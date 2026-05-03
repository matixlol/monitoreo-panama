const PANAMA_CURRENCY_PREFIX = 'B/. ';

const panamaNumberFormatters = {
  whole: new Intl.NumberFormat('es-PA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }),
  cents: new Intl.NumberFormat('es-PA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
} as const;

function normalizePanamaCurrencySpacing(value: string) {
  return value.replace(/\u00A0/g, ' ');
}

export function formatPanamaCurrency(value: number, fractionDigits: 0 | 2 = 2) {
  const formatter = fractionDigits === 0 ? panamaNumberFormatters.whole : panamaNumberFormatters.cents;
  const sign = value < 0 ? '-' : '';
  return `${PANAMA_CURRENCY_PREFIX}${sign}${normalizePanamaCurrencySpacing(formatter.format(Math.abs(value)))}`;
}

export function formatPanamaNumber(value: number, fractionDigits: 0 | 2 = 2) {
  const formatter = fractionDigits === 0 ? panamaNumberFormatters.whole : panamaNumberFormatters.cents;
  return formatter.format(value);
}
