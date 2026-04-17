export const MONTH_NAMES = [
  '',
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

export type BrowserSearch = {
  page: number;
  limit: number;
  q: string;
  status: string;
  eventId: string;
  positionId: string;
  provinceId: string;
  districtId: string;
  townshipId: string;
  circuitId: string;
  partyId: string;
  month: string;
  isProclaimed: string;
};

export const DEFAULT_SEARCH: BrowserSearch = {
  page: 1,
  limit: 10,
  q: '',
  status: '',
  eventId: '',
  positionId: '',
  provinceId: '',
  districtId: '',
  townshipId: '',
  circuitId: '',
  partyId: '',
  month: '',
  isProclaimed: '',
};

function getString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export function parseSearch(input: Record<string, unknown>): BrowserSearch {
  const page = Number(input.page);
  const limit = Number(input.limit);

  return {
    page: Number.isFinite(page) && page > 0 ? page : DEFAULT_SEARCH.page,
    limit: Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_SEARCH.limit,
    q: getString(input.q),
    status: getString(input.status),
    eventId: getString(input.eventId),
    positionId: getString(input.positionId),
    provinceId: getString(input.provinceId),
    districtId: getString(input.districtId),
    townshipId: getString(input.townshipId),
    circuitId: getString(input.circuitId),
    partyId: getString(input.partyId),
    month: getString(input.month),
    isProclaimed: getString(input.isProclaimed),
  };
}

export function cleanSearch(search: BrowserSearch) {
  return Object.fromEntries(
    Object.entries(search).filter(([key, value]) => {
      if (key === 'page') return value !== DEFAULT_SEARCH.page;
      if (key === 'limit') return value !== DEFAULT_SEARCH.limit;
      return value !== '';
    }),
  );
}

export function serializeSearch(search: BrowserSearch) {
  return cleanSearch(search) as unknown as BrowserSearch;
}

export function hasActiveFilters(search: BrowserSearch) {
  return Object.entries(search).some(([key, value]) => {
    if (key === 'page' || key === 'limit' || key === 'q') return false;
    return value !== '';
  });
}
