import { useMemo, useRef } from 'react';
import { flexRender, getCoreRowModel, getFilteredRowModel, useReactTable } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  INT,
  MONEY,
  NORM,
  TEXT,
  buildHashRoute,
  candidateDisplayName,
  candidateFullName,
  candidateIdFromRow,
  candidateLabel,
  contributionLabel,
  expenseAmount,
  num,
  parsePanamaDate,
  slugify,
  sortPos,
  uniq,
} from './embed-shared.jsx';

const TABLES_CSS = `
  :host{
    display:block;
    color:#111827;
    font:14px/1.45 inherit;
  }
  *{box-sizing:border-box}
  .pt-shell{
    border:1px solid #d0d7de;
    border-radius:12px;
    background:#ffffff;
    overflow:hidden;
  }
  .pt-toolbar{
    display:grid;
    gap:14px;
    padding:16px;
    border-bottom:1px solid #e5e7eb;
    background:#f6f8fa;
  }
  .pt-toolbar--transactions,
  .pt-toolbar--candidates{
    grid-template-columns:minmax(260px,1.5fr) repeat(3,minmax(170px,1fr));
  }
  .pt-field{
    display:grid;
    gap:6px;
    min-width:0;
  }
  .pt-label{
    font-size:13px;
    font-weight:600;
    color:#111827;
  }
  .pt-search-wrap{
    position:relative;
  }
  .pt-search-icon{
    position:absolute;
    left:12px;
    top:50%;
    width:16px;
    height:16px;
    color:#6b7280;
    transform:translateY(-50%);
    pointer-events:none;
  }
  .pt-input,
  .pt-select,
  .pt-button{
    height:42px;
    border:1px solid #c9d1d9;
    border-radius:10px;
    background:#ffffff;
    color:#111827;
    font:inherit;
  }
  .pt-input,
  .pt-select{
    width:100%;
    padding:0 12px;
  }
  .pt-search-wrap .pt-input{
    padding-left:38px;
  }
  .pt-input:focus,
  .pt-select:focus,
  .pt-button:focus{
    outline:2px solid transparent;
    border-color:#98a2b3;
    box-shadow:0 0 0 3px rgba(17,24,39,.08);
  }
  .pt-results{
    min-height:240px;
    background:#ffffff;
  }
  .pt-table-wrap{
    overflow:auto;
    max-height:70vh;
  }
  .pt-table{
    width:100%;
    min-width:880px;
    border-collapse:separate;
    border-spacing:0;
  }
  .pt-table th,
  .pt-table td,
  .pt-virtual-header-cell,
  .pt-virtual-cell{
    padding:12px 14px;
    border-bottom:1px solid #e5e7eb;
    vertical-align:top;
    text-align:left;
  }
  .pt-table th,
  .pt-virtual-header-cell{
    position:sticky;
    top:0;
    z-index:1;
    background:#eef2f7;
    color:#111827;
    font-size:13px;
    font-weight:700;
    white-space:nowrap;
  }
  .pt-table tbody tr:hover,
  .pt-virtual-row:hover{
    background:#fafbfc;
  }
  .pt-table tbody tr:last-child td{
    border-bottom:none;
  }
  .pt-virtual-table{
    width:100%;
    min-width:100%;
  }
  .pt-virtual-head{
    position:sticky;
    top:0;
    z-index:3;
    background:#eef2f7;
  }
  .pt-virtual-header-row,
  .pt-virtual-row{
    display:grid;
  }
  .pt-virtual-body{
    position:relative;
  }
  .pt-virtual-row{
    position:absolute;
    left:0;
    width:100%;
    background:#ffffff;
  }
  .pt-virtual-cell{
    display:block;
    min-width:0;
    background:#ffffff;
  }
  .pt-virtual-row:last-child .pt-virtual-cell{
    border-bottom:none;
  }
  .pt-align-right{
    text-align:right !important;
  }
  .pt-link{
    color:inherit;
    text-decoration:none;
    font-weight:600;
  }
  .pt-link:hover{
    text-decoration:underline;
  }
  .pt-subline{
    margin-top:4px;
    color:#6b7280;
    font-size:12px;
    line-height:1.35;
  }
  .pt-kind{
    display:inline-flex;
    align-items:center;
    height:24px;
    padding:0 8px;
    border:1px solid #d0d7de;
    border-radius:999px;
    background:#ffffff;
    color:#374151;
    font-size:12px;
    font-weight:600;
    white-space:nowrap;
  }
  .pt-amount{
    text-align:right;
    white-space:nowrap;
    font-weight:600;
    font-variant-numeric:tabular-nums;
  }
  .pt-footer{
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:12px;
    padding:14px 16px;
    border-top:1px solid #e5e7eb;
    background:#ffffff;
  }
  .pt-footer-text{
    color:#4b5563;
    font-size:13px;
  }
  .pt-actions{
    display:flex;
    flex-wrap:wrap;
    align-items:center;
    gap:8px;
    margin-left:auto;
  }
  .pt-button{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    padding:0 12px;
    cursor:pointer;
  }
  .pt-button:disabled{
    cursor:default;
    opacity:.45;
  }
  .pt-button--ghost{
    background:#ffffff;
  }
  .pt-empty,
  .pt-loading,
  .pt-error{
    display:grid;
    place-items:center;
    min-height:240px;
    padding:24px;
    text-align:center;
    color:#6b7280;
  }
  .pt-error{
    color:#b42318;
  }
  .pt-loading{
    color:#344054;
  }
  @media (max-width:960px){
    .pt-toolbar--transactions,
    .pt-toolbar--candidates{
      grid-template-columns:1fr 1fr;
    }
  }
  @media (max-width:640px){
    .pt-toolbar--transactions,
    .pt-toolbar--candidates,
    .pt-footer{
      grid-template-columns:1fr;
      display:grid;
    }
    .pt-actions{
      margin-left:0;
    }
  }
`;

function localeAsc(a, b) {
  return TEXT(a).localeCompare(TEXT(b), 'es', { sensitivity: 'base' });
}

function attr(element, name, fallback = '') {
  const value = element?.getAttribute(name);
  return value == null ? fallback : value;
}

function joinValues(values, fallback = '—') {
  return values.filter(Boolean).join(' · ') || fallback;
}

function candidateFilterLabel(candidate) {
  return candidateLabel(candidate) || TEXT(candidate?.name) || 'Sin nombre';
}

function hasFilters(values) {
  return Object.values(values).some(Boolean);
}

function normalizedTextFilter(row, columnId, filterValue) {
  const value = row.getValue(columnId);
  const needle = NORM(filterValue);
  return !needle || String(value || '').includes(needle);
}

function includesValueFilter(row, columnId, filterValue) {
  if (!filterValue) return true;
  const value = row.getValue(columnId);
  return Array.isArray(value) ? value.includes(filterValue) : value === filterValue;
}

function SearchField({ label, placeholder, value, onChange }) {
  return (
    <label className="pt-field">
      <span className="pt-label">{label}</span>
      <div className="pt-search-wrap">
        <svg className="pt-search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M13.75 13.75L17.5 17.5M15.833 9.167a6.667 6.667 0 1 1-13.333 0 6.667 6.667 0 0 1 13.333 0Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <input className="pt-input" type="search" placeholder={placeholder} value={value} onInput={onChange} />
      </div>
    </label>
  );
}

function SelectField({ label, value, allLabel, options, onChange }) {
  return (
    <label className="pt-field">
      <span className="pt-label">{label}</span>
      <select className="pt-select" value={value} onChange={onChange}>
        <option value="">{allLabel}</option>
        {options.map((option) => {
          const item = typeof option === 'string' ? { value: option, label: option } : option;
          return (
            <option value={item.value} key={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function EmptyState({ text }) {
  return <div className="pt-empty">{text}</div>;
}

function Frame({ loading, error, children }) {
  return (
    <>
      <style>{TABLES_CSS}</style>
      {loading ? (
        <div className="pt-loading">Cargando…</div>
      ) : error ? (
        <div className="pt-error">{error}</div>
      ) : (
        children
      )}
    </>
  );
}

function TableView({ table, emptyText }) {
  const rows = table.getRowModel().rows;
  if (!rows.length) return <EmptyState text={emptyText} />;

  return (
    <div className="pt-table-wrap">
      <table className="pt-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta || {};
                return (
                  <th className={meta.headerClassName || ''} key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => {
                const meta = cell.column.columnDef.meta || {};
                return (
                  <td className={meta.cellClassName || ''} key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VirtualizedRowsView({ table, emptyText, gridTemplateColumns, minWidth = '980px' }) {
  const rows = table.getRowModel().rows;
  const parentRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
    measureElement: (element) => element?.getBoundingClientRect().height ?? 64,
  });

  if (!rows.length) return <EmptyState text={emptyText} />;

  return (
    <div className="pt-table-wrap" ref={parentRef}>
      <div className="pt-virtual-table" style={{ minWidth, width: '100%' }}>
        <div className="pt-virtual-head">
          {table.getHeaderGroups().map((headerGroup) => (
            <div className="pt-virtual-header-row" key={headerGroup.id} style={{ gridTemplateColumns }}>
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta || {};
                return (
                  <div className={`pt-virtual-header-cell ${meta.headerClassName || ''}`.trim()} key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="pt-virtual-body" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <div
                className="pt-virtual-row"
                data-index={virtualRow.index}
                key={row.id}
                ref={(node) => rowVirtualizer.measureElement(node)}
                style={{ transform: `translateY(${virtualRow.start}px)`, gridTemplateColumns }}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta || {};
                  return (
                    <div className={`pt-virtual-cell ${meta.cellClassName || ''}`.trim()} key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function buildCandidateRows(store) {
  return store.candidates
    .map((candidate) => {
      const name = candidateDisplayName(candidate);
      const fullName = candidateFullName(candidate);
      return {
        id: candidate.id,
        name,
        fullName,
        parties: candidate.parties.filter(Boolean),
        partiesLabel: joinValues(candidate.parties.filter(Boolean)),
        positions: candidate.positions.filter(Boolean),
        positionsLabel: joinValues(candidate.positions.filter(Boolean)),
        provinces: candidate.provinces.filter(Boolean),
        provincesLabel: joinValues(candidate.provinces.filter(Boolean)),
        districts: candidate.districts.filter(Boolean),
        districtsLabel: joinValues(candidate.districts.filter(Boolean)),
        ingresoTotal: candidate.ingresoTotal,
        egresoTotal: candidate.egresoTotal,
        searchText: NORM(
          [
            name,
            fullName,
            ...candidate.parties,
            ...candidate.positions,
            ...candidate.provinces,
            ...candidate.districts,
          ].join(' '),
        ),
      };
    })
    .sort((a, b) => localeAsc(a.name, b.name));
}

function buildTransactionRows(store) {
  const ingresos = store.ingresos.map((row, index) => {
    const candidateName = TEXT(row.candidateName) || 'Sin nombre';
    const candidateId = candidateIdFromRow(row);
    const candidate = store.candidateById.get(candidateId);
    const candidateDisplay = candidateDisplayName(candidate || { candidateName });
    const candidateFull = candidateFullName(candidate || { candidateName });
    const amount = num(row.total);
    const parsedDate = parsePanamaDate(row.fecha);
    const counterparty = TEXT(row.contribuyenteNombre) || 'Sin nombre';
    const detail = contributionLabel(row);
    return {
      id: `ingreso-${index}`,
      kind: 'ingreso',
      kindLabel: 'Ingreso',
      candidateId,
      candidateName,
      candidateDisplayName: candidateDisplay,
      candidateFullName: candidateFull,
      position: TEXT(row.candidatePosition),
      party: TEXT(row.candidateParty),
      province: TEXT(row.candidateProvince),
      district: TEXT(row.candidateDistrict),
      date: TEXT(row.fecha) || '—',
      dateValue: parsedDate ? +parsedDate : -Infinity,
      counterparty,
      counterpartyDoc: TEXT(row.cedulaRuc),
      detail,
      category: 'Ingreso',
      amount,
      amountText: `+${MONEY(amount)}`,
      searchText: NORM(
        [
          candidateDisplay,
          candidateFull,
          candidateName,
          row.candidatePosition,
          row.candidateParty,
          row.candidateProvince,
          row.candidateDistrict,
          counterparty,
          row.cedulaRuc,
          detail,
          row.fecha,
        ].join(' '),
      ),
    };
  });

  const egresos = store.egresos.map((row, index) => {
    const candidateName = TEXT(row.candidateName) || 'Sin nombre';
    const candidateId = candidateIdFromRow(row);
    const candidate = store.candidateById.get(candidateId);
    const candidateDisplay = candidateDisplayName(candidate || { candidateName });
    const candidateFull = candidateFullName(candidate || { candidateName });
    const amount = expenseAmount(row);
    const parsedDate = parsePanamaDate(row.fecha);
    const counterparty = TEXT(row.proveedorNombre) || 'Sin nombre';
    const detail = TEXT(row.detalleGastoResumido) || TEXT(row.detalleGasto) || 'Sin detalle';
    const category = TEXT(row.GastoCategoria) || 'Sin categoría';
    return {
      id: `egreso-${index}`,
      kind: 'egreso',
      kindLabel: 'Egreso',
      candidateId,
      candidateName,
      candidateDisplayName: candidateDisplay,
      candidateFullName: candidateFull,
      position: TEXT(row.candidatePosition),
      party: TEXT(row.candidateParty),
      province: TEXT(row.candidateProvince),
      district: TEXT(row.candidateDistrict),
      date: TEXT(row.fecha) || '—',
      dateValue: parsedDate ? +parsedDate : -Infinity,
      counterparty,
      counterpartyDoc: TEXT(row.cedulaRuc),
      detail,
      category,
      amount,
      amountText: `−${MONEY(amount)}`,
      searchText: NORM(
        [
          candidateDisplay,
          candidateFull,
          candidateName,
          row.candidatePosition,
          row.candidateParty,
          row.candidateProvince,
          row.candidateDistrict,
          counterparty,
          row.cedulaRuc,
          detail,
          category,
          row.fecha,
        ].join(' '),
      ),
    };
  });

  return [...ingresos, ...egresos].sort(
    (a, b) => b.dateValue - a.dateValue || b.amount - a.amount || localeAsc(a.candidateName, b.candidateName),
  );
}

function resolveCandidateId(store, element) {
  const rawId = attr(element, 'candidate-id', '').trim();
  if (rawId && store.candidateById.has(rawId)) return rawId;
  const rawName = attr(element, 'candidate', '').trim();
  if (!rawName) return '';
  const bySlug = slugify(rawName);
  if (bySlug && store.candidateById.has(bySlug)) return bySlug;
  const byLabel = store.candidates.find((candidate) => NORM(candidateFilterLabel(candidate)) === NORM(rawName));
  if (byLabel) return byLabel.id;
  const byDisplayName = store.candidates.filter((candidate) => NORM(candidateDisplayName(candidate)) === NORM(rawName));
  if (byDisplayName.length === 1) return byDisplayName[0].id;
  const byName = store.candidates.filter((candidate) => NORM(candidate.name) === NORM(rawName));
  return byName.length === 1 ? byName[0].id : byName[0]?.id || '';
}

function CandidatesTable({ element, store }) {
  const data = useMemo(() => buildCandidateRows(store), [store]);
  const search = attr(element, 'search', '');
  const party = attr(element, 'party', '');
  const province = attr(element, 'province', '');
  const position = attr(element, 'position', '');

  const partyOptions = useMemo(
    () => uniq(store.candidates.flatMap((candidate) => candidate.parties)).sort(localeAsc),
    [store],
  );
  const provinceOptions = useMemo(
    () => uniq(store.candidates.flatMap((candidate) => candidate.provinces)).sort(localeAsc),
    [store],
  );
  const positionOptions = useMemo(
    () => uniq(store.candidates.flatMap((candidate) => candidate.positions)).sort(sortPos),
    [store],
  );

  const columns = useMemo(
    () => [
      {
        id: 'searchText',
        accessorKey: 'searchText',
        header: 'Buscar',
        cell: () => null,
        filterFn: normalizedTextFilter,
      },
      {
        id: 'parties',
        accessorKey: 'parties',
        header: 'Partido filtro',
        cell: () => null,
        filterFn: includesValueFilter,
      },
      {
        id: 'provinces',
        accessorKey: 'provinces',
        header: 'Provincia filtro',
        cell: () => null,
        filterFn: includesValueFilter,
      },
      {
        id: 'positions',
        accessorKey: 'positions',
        header: 'Cargo filtro',
        cell: () => null,
        filterFn: includesValueFilter,
      },
      {
        id: 'candidate',
        accessorKey: 'name',
        header: 'Candidatura',
        cell: ({ row }) => (
          <>
            <a className="pt-link" href={buildHashRoute('candidato', row.original.id)}>
              {row.original.name}
            </a>
            {row.original.fullName !== row.original.name ? <div className="pt-subline">{row.original.fullName}</div> : null}
            <div className="pt-subline">
              {MONEY(row.original.ingresoTotal)} ingresos · {MONEY(row.original.egresoTotal)} gastos
            </div>
          </>
        ),
      },
      {
        id: 'positionsLabel',
        accessorKey: 'positionsLabel',
        header: 'Cargo',
      },
      {
        id: 'partiesLabel',
        accessorKey: 'partiesLabel',
        header: 'Partido / libre postulación',
      },
      {
        id: 'provincesLabel',
        accessorKey: 'provincesLabel',
        header: 'Provincia',
      },
      {
        id: 'districtsLabel',
        accessorKey: 'districtsLabel',
        header: 'Distrito',
      },
    ],
    [],
  );

  const columnFilters = useMemo(
    () =>
      [
        search ? { id: 'searchText', value: search } : null,
        party ? { id: 'parties', value: party } : null,
        province ? { id: 'provinces', value: province } : null,
        position ? { id: 'positions', value: position } : null,
      ].filter(Boolean),
    [search, party, province, position],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      columnFilters,
      columnVisibility: {
        searchText: false,
        parties: false,
        provinces: false,
        positions: false,
      },
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const filteredCount = table.getRowModel().rows.length;
  const anyFilters = hasFilters({ search, party, province, position });

  return (
    <div className="pt-shell">
      <div className="pt-toolbar pt-toolbar--candidates">
        <SearchField
          label="Buscar"
          placeholder="Buscar candidatura, partido, provincia o distrito"
          value={search}
          onChange={(event) => element.applyAttrs({ search: event.currentTarget.value })}
        />
        <SelectField
          label="Partido"
          allLabel="Todos los partidos"
          value={party}
          options={partyOptions}
          onChange={(event) => element.applyAttrs({ party: event.currentTarget.value })}
        />
        <SelectField
          label="Provincia"
          allLabel="Todas las provincias"
          value={province}
          options={provinceOptions}
          onChange={(event) => element.applyAttrs({ province: event.currentTarget.value })}
        />
        <SelectField
          label="Cargo"
          allLabel="Todos los cargos"
          value={position}
          options={positionOptions}
          onChange={(event) => element.applyAttrs({ position: event.currentTarget.value })}
        />
      </div>

      <div className="pt-results">
        <TableView table={table} emptyText="No encontré candidaturas para esos filtros." />
      </div>

      <div className="pt-footer">
        <div className="pt-footer-text">
          {filteredCount
            ? `${INT(filteredCount)} de ${INT(data.length)} candidaturas`
            : `0 de ${INT(data.length)} candidaturas`}
        </div>
        <div className="pt-actions">
          {anyFilters ? (
            <button
              className="pt-button pt-button--ghost"
              type="button"
              onClick={() => element.applyAttrs({ search: null, party: null, province: null, position: null })}
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TransactionsTable({ element, store }) {
  const data = useMemo(() => buildTransactionRows(store), [store]);
  const search = attr(element, 'search', '');
  const kindRaw = attr(element, 'kind', 'all');
  const kind = ['all', 'ingreso', 'egreso'].includes(kindRaw) ? kindRaw : 'all';
  const position = attr(element, 'position', '');
  const candidateId = resolveCandidateId(store, element);
  const selectedCandidate = candidateId ? store.candidateById.get(candidateId) : null;

  const candidateOptions = useMemo(
    () =>
      store.candidates
        .map((candidate) => ({ value: candidate.id, label: candidateFilterLabel(candidate) }))
        .sort((a, b) => localeAsc(a.label, b.label)),
    [store],
  );
  const positionOptions = useMemo(() => uniq(data.map((row) => row.position)).sort(sortPos), [data]);

  const columns = useMemo(() => {
    const base = [
      {
        id: 'searchText',
        accessorKey: 'searchText',
        header: 'Buscar',
        cell: () => null,
        filterFn: normalizedTextFilter,
      },
      {
        id: 'candidateIdFilter',
        accessorKey: 'candidateId',
        header: 'Candidatura filtro',
        cell: () => null,
        filterFn: includesValueFilter,
      },
      {
        id: 'kindFilter',
        accessorKey: 'kind',
        header: 'Movimiento filtro',
        cell: () => null,
        filterFn: includesValueFilter,
      },
      {
        id: 'positionFilter',
        accessorKey: 'position',
        header: 'Cargo filtro',
        cell: () => null,
        filterFn: includesValueFilter,
      },
      {
        id: 'date',
        accessorKey: 'date',
        header: 'Fecha',
      },
    ];

    const candidateColumn = selectedCandidate
      ? []
      : [
          {
            id: 'candidateName',
            accessorKey: 'candidateDisplayName',
            header: 'Candidatura',
            cell: ({ row }) => (
              <>
                <a className="pt-link" href={buildHashRoute('candidato', row.original.candidateId)}>
                  {row.original.candidateDisplayName}
                </a>
                {row.original.candidateFullName !== row.original.candidateDisplayName ? (
                  <div className="pt-subline">{row.original.candidateFullName}</div>
                ) : null}
                <div className="pt-subline">
                  {[row.original.party, row.original.position].filter(Boolean).join(' · ') || '—'}
                </div>
              </>
            ),
          },
        ];

    return [
      ...base,
      ...candidateColumn,
      {
        id: 'kindLabel',
        accessorKey: 'kindLabel',
        header: 'Movimiento',
        cell: ({ row }) => <span className="pt-kind">{row.original.kindLabel}</span>,
      },
      {
        id: 'counterparty',
        accessorKey: 'counterparty',
        header: 'Aportante / proveedor',
        cell: ({ row }) => (
          <>
            <div>{row.original.counterparty}</div>
            <div className="pt-subline">{row.original.counterpartyDoc || 'Sin cédula / RUC'}</div>
          </>
        ),
      },
      {
        id: 'detail',
        accessorKey: 'detail',
        header: 'Detalle',
        cell: ({ row }) => (
          <>
            <div>{row.original.detail}</div>
            <div className="pt-subline">{row.original.category}</div>
          </>
        ),
      },
      {
        id: 'amountText',
        accessorKey: 'amountText',
        header: 'Monto',
        cell: ({ row }) => <span className="pt-amount">{row.original.amountText}</span>,
        meta: { headerClassName: 'pt-align-right', cellClassName: 'pt-align-right' },
      },
    ];
  }, [selectedCandidate]);

  const columnFilters = useMemo(
    () =>
      [
        search ? { id: 'searchText', value: search } : null,
        candidateId ? { id: 'candidateIdFilter', value: candidateId } : null,
        kind !== 'all' ? { id: 'kindFilter', value: kind } : null,
        position ? { id: 'positionFilter', value: position } : null,
      ].filter(Boolean),
    [search, candidateId, kind, position],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      columnFilters,
      columnVisibility: {
        searchText: false,
        candidateIdFilter: false,
        kindFilter: false,
        positionFilter: false,
      },
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const filteredCount = table.getRowModel().rows.length;
  const anyFilters = hasFilters({ search, candidateId, kind: kind !== 'all' ? kind : '', position });
  const gridTemplateColumns = selectedCandidate
    ? '120px 120px minmax(240px,1.2fr) minmax(280px,1.8fr) 140px'
    : '120px minmax(220px,1.4fr) 120px minmax(240px,1.2fr) minmax(280px,1.8fr) 140px';

  return (
    <div className="pt-shell">
      <div className="pt-toolbar pt-toolbar--transactions">
        <SearchField
          label="Buscar"
          placeholder="Buscar candidatura, aportante, proveedor o detalle"
          value={search}
          onChange={(event) => element.applyAttrs({ search: event.currentTarget.value })}
        />
        <SelectField
          label="Candidatura"
          allLabel="Todas las candidaturas"
          value={candidateId}
          options={candidateOptions}
          onChange={(event) =>
            element.applyAttrs({ 'candidate-id': event.currentTarget.value || null, 'candidate': null })
          }
        />
        <SelectField
          label="Movimiento"
          allLabel="Ingresos y egresos"
          value={kind === 'all' ? '' : kind}
          options={[
            { value: 'ingreso', label: 'Solo ingresos' },
            { value: 'egreso', label: 'Solo egresos' },
          ]}
          onChange={(event) => element.applyAttrs({ kind: event.currentTarget.value || null })}
        />
        <SelectField
          label="Cargo"
          allLabel="Todos los cargos"
          value={position}
          options={positionOptions}
          onChange={(event) => element.applyAttrs({ position: event.currentTarget.value })}
        />
      </div>

      <div className="pt-results">
        <VirtualizedRowsView
          table={table}
          gridTemplateColumns={gridTemplateColumns}
          minWidth={selectedCandidate ? '900px' : '1120px'}
          emptyText={
            selectedCandidate
              ? `No encontré movimientos para ${candidateFilterLabel(selectedCandidate)} con esos filtros.`
              : 'No encontré movimientos para esos filtros.'
          }
        />
      </div>

      <div className="pt-footer">
        <div className="pt-footer-text">
          {filteredCount
            ? `${INT(filteredCount)} de ${INT(data.length)} movimientos`
            : `0 de ${INT(data.length)} movimientos`}
          {selectedCandidate ? ` · ${candidateFilterLabel(selectedCandidate)}` : ''}
        </div>
        <div className="pt-actions">
          {anyFilters ? (
            <button
              className="pt-button pt-button--ghost"
              type="button"
              onClick={() =>
                element.applyAttrs({
                  'search': null,
                  'candidate-id': null,
                  'candidate': null,
                  'kind': null,
                  'position': null,
                })
              }
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CandidatesTableElementApp({ element, store, loading = false, error = null }) {
  return (
    <Frame loading={loading} error={error}>
      {store ? <CandidatesTable element={element} store={store} /> : null}
    </Frame>
  );
}

export function TransactionsTableElementApp({ element, store, loading = false, error = null }) {
  return (
    <Frame loading={loading} error={error}>
      {store ? <TransactionsTable element={element} store={store} /> : null}
    </Frame>
  );
}
