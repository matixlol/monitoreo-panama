import * as Plot from '@observablehq/plot';

const plotBase = {
  style: { maxWidth: '100%', height: 'auto', overflow: 'visible' },
  marginBottom: 44,
  marginTop: 10,
  color: { legend: false },
};

const DAY_MONTH_FORMAT = new Intl.DateTimeFormat('es-PA', { day: '2-digit', month: 'short' });
const MONTH_FORMAT = new Intl.DateTimeFormat('es-PA', { month: 'short' });
const MONTH_YEAR_FORMAT = new Intl.DateTimeFormat('es-PA', { month: 'short', year: 'numeric' });
const DAY_MS = 1000 * 60 * 60 * 24;

function normalizeTickLabel(value) {
  return `${value}`.replace(/\./g, '');
}

function formatDateTick(value, spanDays) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(+date)) return value;
  if (spanDays <= 45) return normalizeTickLabel(DAY_MONTH_FORMAT.format(date));
  if (spanDays <= 400) return normalizeTickLabel(MONTH_FORMAT.format(date));
  return normalizeTickLabel(MONTH_YEAR_FORMAT.format(date));
}

export const line = (points, { int, money, short }, { xDomain } = {}) => {
  if (!points.length) return null;

  const [domainStart, domainEnd] = xDomain || [points[0]?.date, points[points.length - 1]?.date];
  const spanDays = Math.abs((domainEnd - domainStart) / DAY_MS) || 0;

  return Plot.plot({
        ...plotBase,
        width: 1000,
        height: 320,
        marginLeft: 64,
        x: {
          label: null,
          tickFormat: (value) => formatDateTick(value, spanDays),
          ...(xDomain ? { domain: xDomain } : {}),
        },
        y: { label: null, grid: true, tickFormat: short, insetBottom: 8 },
        marks: [
          Plot.ruleY([0], { stroke: '#cbd5e1' }),
          Plot.areaY(points, {
            x: 'date',
            y: 'value',
            curve: 'linear',
            fill: '#2f80ed',
            fillOpacity: 0.12,
            ...(xDomain ? { clip: true } : {}),
          }),
          Plot.lineY(points, {
            x: 'date',
            y: 'value',
            curve: 'linear',
            stroke: '#111827',
            strokeWidth: 2.5,
            ...(xDomain ? { clip: true } : {}),
          }),
          Plot.dot(points, {
            x: 'date',
            y: 'value',
            r: 3.5,
            fill: '#2f80ed',
          }),
          Plot.tip(
            points,
            Plot.pointer({
              x: 'date',
              y: 'value',
              title: (d) => `${d.label}\n${money(d.value)}\n${int(d.count)} registros`,
            }),
          ),
        ],
      });
};
