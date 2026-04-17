import { useEffect, useMemo, useState } from 'react';
import { INT, MONEY, NORM, TEXT, buildHashRoute } from './embed-shared.jsx';

const SECTION_RESULT_LIMIT = 20;
const EMPTY_FILTERED_SECTIONS = [
  { key: 'candidaturas', title: 'Candidaturas', rows: [], totalMatches: 0 },
  { key: 'donantes', title: 'Donantes', rows: [], totalMatches: 0 },
  { key: 'proveedores', title: 'Proveedores', rows: [], totalMatches: 0 },
];

function attr(element, name, fallback = '') {
  const value = element?.getAttribute(name);
  return value == null ? fallback : value;
}

function joinValues(values, fallback = '—') {
  return values.filter(Boolean).join(' · ') || fallback;
}

function normalizedTextMap(text) {
  const source = TEXT(text);
  const chars = [];
  const positions = [];

  for (let index = 0; index < source.length; index += 1) {
    const piece = source[index]
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[ÃÂ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ');

    for (const char of piece) {
      chars.push(char);
      positions.push(index);
    }
  }

  return { source, normalized: chars.join(''), positions };
}

function mergeRanges(ranges) {
  if (!ranges.length) return [];
  const sorted = ranges.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [sorted[0]];

  for (const current of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (current[0] <= last[1]) last[1] = Math.max(last[1], current[1]);
    else merged.push(current);
  }

  return merged;
}

function getHighlightRanges(text, query) {
  const tokens = NORM(query)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);

  if (!tokens.length) return [];

  const { source, normalized, positions } = normalizedTextMap(text);
  const ranges = [];

  for (const token of tokens) {
    let fromIndex = 0;
    while (fromIndex < normalized.length) {
      const matchIndex = normalized.indexOf(token, fromIndex);
      if (matchIndex === -1) break;
      const start = positions[matchIndex];
      const end = positions[matchIndex + token.length - 1] + 1;
      if (start != null && end != null) ranges.push([start, end]);
      fromIndex = matchIndex + token.length;
    }
  }

  return mergeRanges(ranges).filter(([start, end]) => start < end && start < source.length);
}

function renderHighlightedText(text, query) {
  const source = TEXT(text);
  const ranges = getHighlightRanges(source, query);
  if (!ranges.length) return source;

  const parts = [];
  let cursor = 0;

  ranges.forEach(([start, end], index) => {
    if (cursor < start) parts.push(source.slice(cursor, start));
    parts.push(
      <mark key={`${start}-${end}-${index}`} className="px-0">
        {source.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });

  if (cursor < source.length) parts.push(source.slice(cursor));
  return parts;
}

function buildCandidateSearchRow(candidate) {
  return {
    id: candidate.id,
    href: buildHashRoute('candidato', candidate.id),
    name: TEXT(candidate.name) || 'Sin nombre',
    meta: [
      joinValues(candidate.positions.filter(Boolean)),
      joinValues(candidate.parties.filter(Boolean)),
      joinValues(candidate.provinces.filter(Boolean)),
      joinValues(candidate.districts.filter(Boolean)),
    ]
      .filter(Boolean)
      .join(' · '),
    summary: `${MONEY(candidate.ingresoTotal)} ingresos · ${MONEY(candidate.egresoTotal)} gastos`,
  };
}

function buildDonorSearchRow(donor) {
  return {
    id: donor.id,
    href: buildHashRoute('aportante', donor.id),
    name: TEXT(donor.name) || 'Sin nombre',
    meta: [joinValues(donor.positions.filter(Boolean)), joinValues(donor.parties.filter(Boolean))]
      .filter(Boolean)
      .join(' · '),
    summary: `${MONEY(donor.total)} aportados · ${INT(donor.candidateCount)} candidaturas`,
  };
}

function buildProviderSearchRow(provider) {
  return {
    id: provider.id,
    href: buildHashRoute('proveedor', provider.id),
    name: TEXT(provider.name) || 'Sin nombre',
    meta: [joinValues(provider.positions.filter(Boolean)), joinValues(provider.parties.filter(Boolean))]
      .filter(Boolean)
      .join(' · '),
    summary: `${MONEY(provider.total)} facturados · ${INT(provider.candidateCount)} candidaturas`,
  };
}

function filterSearchRows(rows, buildRow, tokens) {
  const matches = [];
  let totalMatches = 0;

  for (const item of rows) {
    const row = buildRow(item);
    const searchName = NORM(row.name);
    const searchMeta = NORM(row.meta);
    const searchAll = searchMeta ? `${searchName} ${searchMeta}` : searchName;

    if (!tokens.every((token) => searchAll.includes(token))) continue;

    totalMatches += 1;
    if (matches.length < SECTION_RESULT_LIMIT) matches.push(row);
  }

  return { rows: matches, totalMatches };
}

function filterGeneralSearchSections(store, query) {
  const normalizedQuery = NORM(query);
  const tokens = normalizedQuery
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);

  if (!tokens.length) return EMPTY_FILTERED_SECTIONS;

  return [
    {
      key: 'candidaturas',
      title: 'Candidaturas',
      ...filterSearchRows(store.candidates, buildCandidateSearchRow, tokens),
    },
    {
      key: 'donantes',
      title: 'Donantes',
      ...filterSearchRows(store.donors, buildDonorSearchRow, tokens),
    },
    {
      key: 'proveedores',
      title: 'Proveedores',
      ...filterSearchRows(store.providers, buildProviderSearchRow, tokens),
    },
  ];
}

function SearchResultSection({ title, rows, totalMatches, emptyText, query }) {
  return (
    <section className="card mb-2">
      <div className="card-header d-flex justify-content-between align-items-center py-2 px-3">
        <span className="small font-weight-bold">{title}</span>
        <span className="badge badge-secondary">{INT(totalMatches)}</span>
      </div>
      {rows.length ? (
        <>
          {totalMatches > rows.length ? (
            <div className="card-body border-bottom py-2 px-3 small text-muted">
              Mostrando {INT(rows.length)} primeros resultados de {INT(totalMatches)}.
            </div>
          ) : null}
          <div className="list-group list-group-flush">
            {rows.map((row) => (
              <a className="list-group-item list-group-item-action py-2 px-3" href={row.href} key={row.id}>
                <div className="d-flex w-100 justify-content-between align-items-start">
                  <div className="pr-2">
                    <div className="font-weight-bold mb-1" style={{ lineHeight: 1.2 }}>
                      {renderHighlightedText(row.name, query)}
                    </div>
                    <div className="small text-muted mb-0" style={{ lineHeight: 1.2 }}>
                      {renderHighlightedText(row.meta, query)}
                    </div>
                  </div>
                  <div className="small text-muted text-right pl-2" style={{ lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                    {row.summary}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </>
      ) : (
        <div className="card-body small text-muted">{emptyText}</div>
      )}
    </section>
  );
}

function GeneralSearch({ element, store }) {
  const query = attr(element, 'search', '');
  const [draftQuery, setDraftQuery] = useState(query);
  const trimmedQuery = query.trim();
  const filteredSections = useMemo(
    () => (trimmedQuery ? filterGeneralSearchSections(store, trimmedQuery) : EMPTY_FILTERED_SECTIONS),
    [store, trimmedQuery],
  );
  const isMobile = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 720px)').matches;
  const totalResults = filteredSections.reduce((count, section) => count + section.rows.length, 0);

  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  function handleSubmit(event) {
    event.preventDefault();
    element.applyAttrs({ search: draftQuery });
  }

  return (
    <>
      <form className="form-group mb-3" onSubmit={handleSubmit}>
        <label className="font-weight-bold d-block mb-2">
          Buscar
          <div className="input-group mt-2">
            <input
              className="form-control"
              type="search"
              placeholder="Buscar candidaturas, donantes o proveedores"
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.currentTarget.value)}
            />
            <div className="input-group-append">
              <button className="btn btn-outline-secondary" type="submit">
                Buscar
              </button>
            </div>
          </div>
        </label>
        <small className="form-text text-muted">
          {draftQuery.trim() !== query.trim()
            ? 'Presioná Enter o hacé clic en Buscar para actualizar los resultados.'
            : query.trim()
              ? `${INT(totalResults)} resultados visibles para “${query.trim()}”.`
              : 'Escribí una palabra y te muestro coincidencias en candidaturas, donantes y proveedores.'}
        </small>
      </form>

      {query.trim() ? (
        <div
          style={{
            maxHeight: isMobile ? '60vh' : '40vh',
            overflowY: 'auto',
            padding: '0.5rem',
            background: '#f6f8fa',
            border: '1px solid #dee2e6',
          }}
        >
          {filteredSections.map((section) => (
            <SearchResultSection
              title={section.title}
              rows={section.rows}
              totalMatches={section.totalMatches}
              query={query}
              emptyText={`No encontré ${section.key} para esa búsqueda.`}
              key={section.key}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

export function GeneralSearchElementApp({ element, store, loading = false, error = null }) {
  if (loading) return <div className="alert alert-light mb-0">Cargando…</div>;
  if (error) return <div className="alert alert-danger mb-0">{error}</div>;
  return store ? <GeneralSearch element={element} store={store} /> : null;
}
