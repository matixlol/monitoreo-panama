import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export const COLORS = ['#2f80ed', '#7db3f3', '#9ac7ff', '#b9d5fa', '#dceafd', '#9bc493', '#c8b0a3', '#e29196'];
export const POS = ['Presidente', 'Diputado(a)', 'Alcalde'];
export const ALL = 'Todas';
export const MONEY = (v) =>
  `B/.${new Intl.NumberFormat('de-DE', { maximumFractionDigits: Math.abs((+v || 0) % 1) > 0.001 ? 2 : 0, minimumFractionDigits: Math.abs((+v || 0) % 1) > 0.001 ? 2 : 0 }).format(+v || 0)}`;
export const INT = (v) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(+v || 0);
export const SHORT = (v) => {
  const n = +v || 0;
  return `B/.${Math.abs(n) >= 1e6 ? d3.format('.2s')(n) : d3.format(',.0f')(n)}`;
};
export const TEXT = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : `${v}`.trim());
export const NORM = (v) =>
  TEXT(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ÃÂ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
export const slugify = (v) => NORM(v).replace(/ /g, '-').slice(0, 120);
export const num = (v) => {
  const n = Number(TEXT(v).replace(/\s+/g, '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};
export const uniq = (xs) => [...new Map(xs.map((x) => [NORM(x), TEXT(x)]).filter(([k]) => k)).values()];
export const sortPos = (a, b) => (POS.indexOf(a) + 1 || 99) - (POS.indexOf(b) + 1 || 99) || d3.ascending(a, b);
export const byPos = (rows, pos) =>
  pos === 'total' || pos === ALL ? rows : rows.filter((d) => TEXT(d.candidatePosition) === pos);
export const posOptions = (rows, first = 'total') => [
  first,
  ...uniq(rows.map((d) => d.candidatePosition)).sort(sortPos),
];
export const sum = (rows, f) => d3.sum(rows, f);
export const plural = (n, one, many) => ((+n || 0) === 1 ? one : many);
const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const shortDate = (d) => `${`${d.getDate()}`.padStart(2, '0')} ${monthNames[d.getMonth()]}`;
export const parseCsvText = (text) => d3.csvParse(text);

export const INCOME_TYPES = [
  ['donacionesPrivadasEfectivo', 'Donación privada · efectivo'],
  ['donacionesPrivadasChequeAch', 'Donación privada · cheque / ACH'],
  ['donacionesPrivadasEspecie', 'Donación privada · especie'],
  ['recursosPropiosEfectivoCheque', 'Recurso propio · efectivo / cheque'],
  ['recursosPropiosEspecie', 'Recurso propio · especie'],
].map(([key, label], i) => ({ key, label, color: COLORS[i] }));

export function buildHashRoute(kind, id) {
  return `#/ficha/${kind}/${encodeURIComponent(id)}`;
}

export const chartOpts = { buildHashRoute, colors: COLORS, int: INT, money: MONEY, short: SHORT };

export function parsePanamaDate(v) {
  const s = TEXT(v);
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(+iso[1], +iso[2] - 1, +iso[3]);
    return Number.isNaN(+d) ? null : d;
  }
  const m = s.match(/^(\d{1,2})\/(\d{1,2}|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\/(\d{4})$/i);
  if (!m) return null;
  const mm = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11 };
  const month = /^\d+$/.test(m[2]) ? +m[2] - 1 : mm[m[2].toLowerCase()];
  const d = new Date(+m[3], month, +m[1]);
  return Number.isNaN(+d) ? null : d;
}

function startOfWeek(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

function bucketDate(d, grain) {
  if (grain === 'día') return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (grain === 'semana') return startOfWeek(d);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function bucketLabel(d, grain) {
  if (grain === 'día') return shortDate(d);
  if (grain === 'semana')
    return `${shortDate(d)} → ${shortDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6))}`;
  return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

export function incomeBreakdown(rows) {
  return INCOME_TYPES.map((d, i) => ({ ...d, value: sum(rows, (r) => num(r[d.key])), color: COLORS[i] }))
    .filter((d) => d.value > 0)
    .sort((a, b) => d3.descending(a.value, b.value));
}

export function expenseAmount(row) {
  const explicitTotal = TEXT(row.totalDeGastosDePropagandaYCampania);
  if (explicitTotal) return num(explicitTotal);

  const hasCategoryTotals = TEXT(row.totalGastosCampania) || TEXT(row.totalGastosPropaganda);
  if (hasCategoryTotals) return num(row.totalGastosCampania) + num(row.totalGastosPropaganda);

  return (
    num(row.movilizacion) +
    num(row.combustible) +
    num(row.hospedaje) +
    num(row.activistas) +
    num(row.caravanaConcentraciones) +
    num(row.comidaBrindis) +
    num(row.alquilerLocalServiciosBasicos) +
    num(row.cargosBancarios) +
    num(row.personalizacionArticulosPromocionales) +
    num(row.propagandaElectoral)
  );
}

export function expenseBreakdown(rows) {
  return d3
    .rollups(
      rows,
      (values) => sum(values, (r) => expenseAmount(r)),
      (r) => TEXT(r.GastoCategoria) || TEXT(r.detalleGastoResumido) || 'Sin categoría',
    )
    .map(([label, value], i) => ({ id: slugify(label) || `c-${i}`, label, value, color: COLORS[i % COLORS.length] }))
    .sort((a, b) => d3.descending(a.value, b.value));
}

export function partyBreakdown(rows) {
  return d3
    .rollups(
      rows,
      (values) => sum(values, (r) => num(r.total)),
      (r) => TEXT(r.candidateParty) || 'Sin partido',
    )
    .map(([label, value], i) => ({ id: slugify(label) || `p-${i}`, label, value, color: COLORS[i % COLORS.length] }))
    .sort((a, b) => d3.descending(a.value, b.value));
}

export function contributionLabel(row) {
  return (
    INCOME_TYPES.filter((d) => num(row[d.key]) > 0)
      .map((d) => d.label)
      .join(' · ') || 'Sin clasificar'
  );
}

export function expenseTimeline(rows, grain = 'día') {
  return d3
    .rollups(
      rows.flatMap((r) => {
        const d = parsePanamaDate(r.fecha);
        const value = expenseAmount(r);
        return d && value ? [{ date: bucketDate(d, grain), value }] : [];
      }),
      (values) => ({ value: sum(values, (d) => d.value), count: values.length }),
      (d) => +d.date,
    )
    .map(([time, stats]) => ({
      date: new Date(time),
      value: stats.value,
      count: stats.count,
      label: bucketLabel(new Date(time), grain),
    }))
    .sort((a, b) => d3.ascending(a.date, b.date));
}

export function parseHashRoute(hash) {
  const parts = TEXT(hash).replace(/^#/, '').split('/').filter(Boolean);
  if (!parts.length || parts[0] === '') return { kind: 'none' };
  if (parts[0] === 'ficha' && ['candidato', 'aportante', 'proveedor'].includes(parts[1]) && parts[2]) {
    return { kind: parts[1], id: decodeURIComponent(parts.slice(2).join('/')) };
  }
  if (['candidato', 'aportante', 'proveedor'].includes(parts[0]) && parts[1]) {
    return { kind: parts[0], id: decodeURIComponent(parts.slice(1).join('/')) };
  }
  return { kind: 'unknown', raw: hash };
}

export function entityFor(store, route) {
  if (route.kind === 'candidato') return store.candidateById.get(route.id);
  if (route.kind === 'aportante') return store.donorById.get(route.id);
  if (route.kind === 'proveedor') return store.providerById.get(route.id);
  return null;
}

export function PlotFigure({ renderNode, deps = [] }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = renderNode();
    if (node) ref.current?.replaceChildren(node);
    else ref.current?.replaceChildren();
    return () => node?.remove?.();
  }, deps);
  return <div className="mf-figure" ref={ref} />;
}

export function Toggle({ value, options, onChange, format = (d) => d }) {
  return (
    <div className="mf-toggle">
      {options.map((option) => (
        <button className={option === value ? 'on' : ''} type="button" key={option} onClick={() => onChange(option)}>
          {format(option)}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, note, controls, children }) {
  return (
    <section className="mf-card">
      <div className="mf-head">
        <div>
          <h2>{title}</h2>
          {note ? <p className="mf-note">{note}</p> : null}
        </div>
        {controls ? <div className="mf-controls">{controls}</div> : null}
      </div>
      <div className="mf-section-body">
        <div className="mf-section-main">{children}</div>
      </div>
    </section>
  );
}

export function Stats({ items }) {
  return (
    <div className="mf-stats">
      {items.map((item) => (
        <div className="mf-stat" key={item.label}>
          <b>{item.value}</b>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Meta({ items }) {
  return (
    <div className="mf-meta">
      {items.map((item) => (
        <div key={item.label}>
          <strong>{item.label}</strong>
          <p>{item.values?.filter(Boolean).join(' · ') || '—'}</p>
        </div>
      ))}
    </div>
  );
}

export function Empty({ text }) {
  return <div className="mf-empty">{text}</div>;
}

export function Table({ columns, rows, emptyText }) {
  if (!rows.length) return <Empty text={emptyText} />;
  return (
    <div className="mf-table-wrap">
      <table className="mf-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => (
                <td className={column.strong ? 'mf-strong' : ''} key={column.key}>
                  {row[column.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
