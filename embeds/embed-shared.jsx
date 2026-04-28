import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Tooltip as TooltipPrimitive } from 'radix-ui';
import { getPartyColor } from './charts/party-colors.js';

export const COLORS = ['#2f80ed', '#7db3f3', '#9ac7ff', '#b9d5fa', '#dceafd', '#9bc493', '#c8b0a3', '#e29196'];
export const POS = ['Presidente', 'Diputado(a)', 'Alcalde'];
export const ALL = 'Todas';

const embedCurrencyFormatters = {
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
};

const embedNumberFormatters = {
  whole: new Intl.NumberFormat('es-PA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }),
  cents: new Intl.NumberFormat('es-PA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
};

function normalizeCurrencySpacing(value) {
  return value.replace(/\u00A0/g, ' ');
}

function hasCents(value) {
  return Math.abs(value % 1) > 0.001;
}

export function formatEmbedCurrency(value, fractionDigits = 2) {
  const formatter = fractionDigits === 0 ? embedCurrencyFormatters.whole : embedCurrencyFormatters.cents;
  return normalizeCurrencySpacing(formatter.format(+value || 0));
}

export function formatEmbedCurrencyAuto(value) {
  return formatEmbedCurrency(value, hasCents(+value || 0) ? 2 : 0);
}

export function formatEmbedNumber(value, fractionDigits = 2) {
  const formatter = fractionDigits === 0 ? embedNumberFormatters.whole : embedNumberFormatters.cents;
  return formatter.format(+value || 0);
}

export const MONEY = (v) => formatEmbedCurrencyAuto(v);
export const INT = (v) => formatEmbedNumber(v, 0);
export const SHORT = (v) => {
  const n = +v || 0;
  return Math.abs(n) >= 1e6 ? `B/. ${d3.format('.2s')(n)}` : formatEmbedCurrency(n, 0);
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
export const candidateIdFromRow = (row) => {
  const name = TEXT(row?.candidateName);
  const position = TEXT(row?.candidatePosition);
  return slugify([name, position].filter(Boolean).join(' | ')) || slugify(name);
};
export const candidateDisplayName = (candidate) =>
  TEXT(candidate?.commonName || candidate?.displayName || candidate?.name || candidate?.candidateName) || 'Sin nombre';
export const candidateFullName = (candidate) =>
  TEXT(candidate?.fullName || candidate?.name || candidate?.candidateName) || 'Sin nombre';
export const candidateLabel = (candidate, { preferFullName = false } = {}) => {
  const singleValue = (value) => {
    const values = uniq((Array.isArray(value) ? value : [value]).map(TEXT).filter(Boolean));
    return values.length === 1 ? values[0] : '';
  };
  const name = preferFullName ? candidateFullName(candidate) : candidateDisplayName(candidate);
  const position = singleValue(candidate?.position || candidate?.candidatePosition || candidate?.positions);
  const province = singleValue(candidate?.province || candidate?.candidateProvince || candidate?.provinces);
  const district = singleValue(candidate?.district || candidate?.candidateDistrict || candidate?.districts);
  return [name, position, province, district].filter(Boolean).join(' · ');
};
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
const PANAMA_MONTH_INDEX = {
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dic: 11,
};
const shortDate = (d) => `${`${d.getDate()}`.padStart(2, '0')} ${monthNames[d.getMonth()]}`;
export const parseCsvText = (text) => d3.csvParse(text);
const TIMELINE_START = new Date(2023, 8, 1);
const TIMELINE_END_INCLUSIVE = new Date(2024, 5, 30);
const TIMELINE_END_EXCLUSIVE = new Date(2024, 6, 1);

export const TIMELINE_X_DOMAIN = [TIMELINE_START, TIMELINE_END_INCLUSIVE];
export const TIMELINE_FILTER_RANGE = [TIMELINE_START, TIMELINE_END_EXCLUSIVE];

function isInTimelineWindow(date) {
  const time = +date;
  return Number.isFinite(time) && time >= +TIMELINE_FILTER_RANGE[0] && time < +TIMELINE_FILTER_RANGE[1];
}

function clampTimelinePoints(points) {
  return points.filter((point) => isInTimelineWindow(point.date)).sort((a, b) => d3.ascending(a.date, b.date));
}

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

function isMissingDateValue(v) {
  const raw = TEXT(v);
  if (!raw) return true;

  const normalized = NORM(raw);
  if (!normalized) return true;

  if (['sin fecha', 's f', 'sf', 'n a', 'na', 'null', 'ninguna'].includes(normalized)) {
    return true;
  }

  return /^[^a-z0-9]+$/i.test(raw);
}

function parsePanamaDateParts(v) {
  const s = TEXT(v);
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return { year: +iso[1], month: +iso[2] - 1, day: +iso[3] };
  const slash = s.match(/^(\d{1,2})\/(\d{1,2}|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\/(\d{4})$/i);
  if (!slash) return null;
  return {
    year: +slash[3],
    month: /^\d+$/.test(slash[2]) ? +slash[2] - 1 : PANAMA_MONTH_INDEX[slash[2].toLowerCase()],
    day: +slash[1],
  };
}

function buildStrictPanamaDate(parts) {
  if (!parts || !Number.isInteger(parts.month) || parts.month < 0 || parts.month > 11) return null;
  const date = new Date(parts.year, parts.month, parts.day);
  if (Number.isNaN(+date)) return null;
  return date.getFullYear() === parts.year && date.getMonth() === parts.month && date.getDate() === parts.day
    ? date
    : null;
}

export function getPanamaDateIssue(v) {
  const raw = TEXT(v);
  if (isMissingDateValue(raw)) return { code: 'missing', raw: '' };
  const parts = parsePanamaDateParts(raw);
  if (!parts) return { code: 'format', raw };
  if (!buildStrictPanamaDate(parts)) return { code: 'invalid', raw };
  return null;
}

export function parsePanamaDate(v) {
  return buildStrictPanamaDate(parsePanamaDateParts(v));
}

function panamaDateIssueMessage(issue) {
  if (!issue) return '';
  if (issue.code === 'missing') return 'Este registro no tiene una fecha cargada en la fuente original.';
  if (issue.code === 'format') return 'Esta fecha no tiene un formato estandar en la fuente.';
  return `La fecha "${issue.raw}" no corresponde a una fecha calendario valida en la fuente.`;
}

export function InfoTooltipButton({ tooltip, classPrefix = 'mf' }) {
  return (
    <TooltipPrimitive.Provider delayDuration={0}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <button className={`${classPrefix}-date-warning`} type="button" aria-label={tooltip}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="10" r="8.25" fill="#FDE68A" stroke="#CA8A04" strokeWidth="1.5" />
              <path
                d="M10 8v4m0-6.25h.01"
                fill="none"
                stroke="#7C2D12"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className={`${classPrefix}-date-tooltip`}
            side="top"
            align="center"
            sideOffset={6}
            collisionPadding={8}
          >
            {tooltip}
            <TooltipPrimitive.Arrow className={`${classPrefix}-date-tooltip-arrow`} width={10} height={6} />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

export function DateCell({ value, fallback = '—', classPrefix = 'mf' }) {
  const text = TEXT(value);
  const issue = getPanamaDateIssue(text);
  if (!issue) return text || fallback;
  const tooltip = panamaDateIssueMessage(issue);
  return (
    <span className={`${classPrefix}-date-cell`}>
      <span>{text || fallback}</span>
      <InfoTooltipButton tooltip={tooltip} classPrefix={classPrefix} />
    </span>
  );
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
  return INCOME_TYPES.map((d, i) => ({ ...d, value: sum(rows, (r) => num(r[d.key])), color: COLORS[i] })).filter(
    (d) => d.value > 0,
  );
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

export function expenseTreemapBreakdown(rows) {
  const normalizedRows = rows.flatMap((row) => {
    const value = expenseAmount(row);
    if (!(value > 0)) return [];

    const category =
      TEXT(row.GastoCategoria) || TEXT(row.detalleGastoResumido) || TEXT(row.detalleGasto) || 'Sin categoría';
    const detail = TEXT(row.detalleGastoResumido) || TEXT(row.detalleGasto) || category;

    return [{ category, detail, value }];
  });

  const children = d3
    .rollups(
      normalizedRows,
      (values) => {
        const label = values[0]?.category || 'Sin categoría';
        const detailChildren = d3
          .rollups(
            values,
            (group) => ({
              label: group[0]?.detail || label,
              value: sum(group, (entry) => entry.value),
              count: group.length,
            }),
            (entry) => entry.detail || label,
          )
          .map(([detail, stats], detailIndex) => ({
            id: slugify(`${label}-${detail}`) || `d-${detailIndex}`,
            label: stats.label,
            value: stats.value,
            count: stats.count,
          }))
          .sort((a, b) => d3.descending(a.value, b.value));

        return {
          label,
          value: sum(values, (entry) => entry.value),
          count: values.length,
          children: detailChildren,
        };
      },
      (entry) => entry.category,
    )
    .map(([label, stats], index) => ({
      id: slugify(label) || `c-${index}`,
      label,
      value: stats.value,
      count: stats.count,
      color: COLORS[index % COLORS.length],
      children: stats.children,
    }))
    .sort((a, b) => d3.descending(a.value, b.value));

  return {
    id: 'gastos',
    label: 'Gastos de campaña',
    value: sum(children, (entry) => entry.value),
    count: sum(children, (entry) => entry.count || 0),
    children,
  };
}

export function expenseBreakdown(rows) {
  return expenseTreemapBreakdown(rows).children.map(({ id, label, value, color, count }) => ({
    id,
    label,
    value,
    color,
    count,
  }));
}

export function partyBreakdown(rows) {
  return d3
    .rollups(
      rows,
      (values) => sum(values, (r) => num(r.total)),
      (r) => TEXT(r.candidateParty) || 'Sin partido',
    )
    .map(([label, value], i) => ({ id: slugify(label) || `p-${i}`, label, value, color: getPartyColor(label) }))
    .sort((a, b) => d3.descending(a.value, b.value));
}

export function contributionLabel(row) {
  return (
    INCOME_TYPES.filter((d) => num(row[d.key]) > 0)
      .map((d) => d.label)
      .join(' · ') || 'Sin clasificar'
  );
}

export function incomeTimeline(rows, grain = 'día') {
  return clampTimelinePoints(
    d3
      .rollups(
        rows.flatMap((r) => {
          const d = parsePanamaDate(r.fecha);
          const value = num(r.total);
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
      })),
  );
}

export function expenseTimeline(rows, grain = 'día') {
  return clampTimelinePoints(
    d3
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
      })),
  );
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
    <div className="btn-group btn-group-sm mf-toggle" role="group" aria-label="Filtros del gráfico">
      {options.map((option) => (
        <button
          className={`btn ${option === value ? 'btn-primary on' : 'btn-outline-secondary'}`}
          type="button"
          key={option}
          onClick={() => onChange(option)}
        >
          {format(option)}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, note, controls, children, titleAs = 'h2' }) {
  const TitleTag = titleAs;
  return (
    <section className="card mf-card">
      <div className="mf-head">
        <div>
          <TitleTag>{title}</TitleTag>
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
        <div className="card mf-stat" key={item.label}>
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
        <div className="card mf-meta-item" key={item.label}>
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
    <div className="table-responsive mf-table-wrap">
      <table className="table table-sm mb-0 mf-table">
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
