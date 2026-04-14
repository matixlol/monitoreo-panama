const panamaCurrencyFormatters = {
  whole: new Intl.NumberFormat('es-PA', {
    style: 'currency',
    currency: 'PAB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }),
  cents: new Intl.NumberFormat('es-PA', {
    style: 'currency',
    currency: 'PAB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
} as const;

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
  const formatter = fractionDigits === 0 ? panamaCurrencyFormatters.whole : panamaCurrencyFormatters.cents;
  return normalizePanamaCurrencySpacing(formatter.format(value));
}

export function formatPanamaNumber(value: number, fractionDigits: 0 | 2 = 2) {
  const formatter = fractionDigits === 0 ? panamaNumberFormatters.whole : panamaNumberFormatters.cents;
  return formatter.format(value);
}
