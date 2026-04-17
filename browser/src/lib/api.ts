import { MONTH_NAMES, type BrowserSearch } from './search';

const API_BASE = 'https://ingresosygastos.te.gob.pa/api/public';

export type ApiDocument = {
  id: string;
  mimeType: string;
  key: string;
  url: string;
};

export type AffidavitListItem = {
  id: string;
  status: string;
  isProclaimed: boolean;
  isSummary?: boolean;
  month?: number | null;
  Candidate?: {
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    secondLastName?: string | null;
    documentId?: string | null;
  } | null;
  Party?: {
    id: string;
    name: string;
  } | null;
  Postulation?: {
    Position?: { id: string; name: string } | null;
    Province?: { id: string; name: string } | null;
    District?: { id: string; name: string } | null;
    Township?: { id: string; name: string } | null;
    Circuit?: { id: string; name: string } | null;
    Event?: {
      id: string;
      Party?: { id: string; name: string } | null;
      Period?: { startYear: number; endYear: number } | null;
      EventCategory?: { name: string } | null;
    } | null;
  } | null;
  AffidavitDocument?: ApiDocument[] | null;
};

export type AffidavitDetail = AffidavitListItem & {
  createdAt: string;
  updatedAt: string;
  totalIngress: number;
  totalEgress: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  count: number;
  page: number;
  limit: number;
};

export type SelectOption = {
  label: string;
  value: string;
};

export type FilterCatalog = {
  events: SelectOption[];
  positions: SelectOption[];
  provinces: SelectOption[];
  districts: SelectOption[];
  townships: SelectOption[];
  circuits: SelectOption[];
  parties: SelectOption[];
  months: SelectOption[];
};

async function fetchJson<T>(path: string, params?: URLSearchParams) {
  const url = params ? `${API_BASE}${path}?${params.toString()}` : `${API_BASE}${path}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`No se pudo cargar ${path}: ${response.status}`);
  }

  return (await response.json()) as T;
}

function buildSearchParams(search: BrowserSearch) {
  const params = new URLSearchParams();
  params.set('page', String(search.page));
  params.set('limit', String(search.limit));
  params.set('sortKey', 'updatedAt');
  params.set('sortOrder', 'desc');

  for (const key of [
    'q',
    'status',
    'eventId',
    'positionId',
    'provinceId',
    'districtId',
    'townshipId',
    'circuitId',
    'partyId',
    'month',
    'isProclaimed',
  ] as const) {
    const value = search[key];
    if (value) params.set(key, value);
  }

  return params;
}

export function searchAffidavits(search: BrowserSearch) {
  return fetchJson<PaginatedResponse<AffidavitListItem>>('/affidavit', buildSearchParams(search));
}

function candidateName(candidate?: AffidavitListItem['Candidate']) {
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

export async function searchCandidateSuggestions(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return [] as SelectOption[];

  const data = await fetchJson<PaginatedResponse<AffidavitListItem>>(
    '/affidavit',
    new URLSearchParams({
      page: '1',
      limit: '8',
      q: trimmed,
      sortKey: 'updatedAt',
      sortOrder: 'desc',
    }),
  );

  const suggestions = new Map<string, SelectOption>();

  for (const item of data.data) {
    const name = candidateName(item.Candidate);
    const documentId = item.Candidate?.documentId?.trim();
    const label = [name || 'Sin nombre', documentId].filter(Boolean).join(' · ');
    const value = documentId || name;
    if (!value || suggestions.has(value)) continue;
    suggestions.set(value, { label, value });
  }

  return [...suggestions.values()];
}

export function getAffidavitDetail(affidavitId: string) {
  return fetchJson<AffidavitDetail>(`/affidavit/${affidavitId}`);
}

export async function getAffidavitRows(affidavitId: string, type: 'ingress' | 'egress') {
  const rows: Record<string, unknown>[] = [];
  const limit = 500;
  let page = 1;
  let count = Number.POSITIVE_INFINITY;

  while (rows.length < count) {
    const params = new URLSearchParams({
      affidavitId,
      type,
      page: String(page),
      limit: String(limit),
      sortKey: 'date',
      sortOrder: 'asc',
    });
    const data = await fetchJson<PaginatedResponse<Record<string, unknown>>>(
      `/affidavit/${affidavitId}/${type}`,
      params,
    );
    rows.push(...data.data);
    count = data.count;
    page += 1;
    if (data.data.length === 0) break;
  }

  return rows;
}

function createEmptyCatalog(): FilterCatalog {
  return {
    events: [],
    positions: [],
    provinces: [],
    districts: [],
    townships: [],
    circuits: [],
    parties: [],
    months: MONTH_NAMES.slice(1).map((label, index) => ({
      label,
      value: String(index + 1),
    })),
  };
}

function sortOptions(options: Map<string, SelectOption>) {
  return [...options.values()].sort((left, right) => left.label.localeCompare(right.label, 'es'));
}

export function buildFilterCatalog(items: AffidavitListItem[]) {
  const catalog = createEmptyCatalog();
  const events = new Map<string, SelectOption>();
  const positions = new Map<string, SelectOption>();
  const provinces = new Map<string, SelectOption>();
  const districts = new Map<string, SelectOption>();
  const townships = new Map<string, SelectOption>();
  const circuits = new Map<string, SelectOption>();
  const parties = new Map<string, SelectOption>();

  for (const item of items) {
    const event = item.Postulation?.Event;
    if (event?.id) {
      const label = [
        event.EventCategory?.name,
        event.Party?.name,
        event.Period ? `${event.Period.startYear}-${event.Period.endYear}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      events.set(event.id, { label, value: event.id });
    }

    const position = item.Postulation?.Position;
    if (position?.id) positions.set(position.id, { label: position.name, value: position.id });

    const province = item.Postulation?.Province;
    if (province?.id) provinces.set(province.id, { label: province.name, value: province.id });

    const district = item.Postulation?.District;
    if (district?.id) districts.set(district.id, { label: district.name, value: district.id });

    const township = item.Postulation?.Township;
    if (township?.id) townships.set(township.id, { label: township.name, value: township.id });

    const circuit = item.Postulation?.Circuit;
    if (circuit?.id) circuits.set(circuit.id, { label: circuit.name, value: circuit.id });

    const party = item.Party ?? event?.Party;
    if (party?.id) parties.set(party.id, { label: party.name, value: party.id });
  }

  catalog.events = sortOptions(events);
  catalog.positions = sortOptions(positions);
  catalog.provinces = sortOptions(provinces);
  catalog.districts = sortOptions(districts);
  catalog.townships = sortOptions(townships);
  catalog.circuits = sortOptions(circuits);
  catalog.parties = sortOptions(parties);

  return catalog;
}

export async function downloadPdf(url: string, fileName: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`No se pudo descargar el PDF: ${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
