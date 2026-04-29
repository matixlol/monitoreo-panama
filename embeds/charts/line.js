import * as d3 from 'd3';
import * as Plot from '@observablehq/plot';

const PLOT_WIDTH = 1000;
const PLOT_HEIGHT = 320;
const PLOT_MARGIN_LEFT = 64;
const PLOT_MARGIN_RIGHT = 24;
const PLOT_MARGIN_TOP = 48;
const SERIES_COLOR = '#111827';
const SERIES_ACCENT_COLOR = '#2f80ed';
const MILESTONE_COLOR = '#9aa7c9';
const MILESTONE_FLAG = '⚑';
const MILESTONE_FLAG_DY = -14;

const plotBase = {
  style: { width: '100%', maxWidth: '100%', height: 'auto', overflow: 'visible' },
  marginBottom: 56,
  marginTop: PLOT_MARGIN_TOP,
  marginRight: PLOT_MARGIN_RIGHT,
  color: { legend: false },
};

const DAY_MONTH_FORMAT = new Intl.DateTimeFormat('es-PA', { day: '2-digit', month: 'short' });
const MONTH_FORMAT = new Intl.DateTimeFormat('es-PA', { month: 'short' });
const MONTH_YEAR_FORMAT = new Intl.DateTimeFormat('es-PA', { month: 'short', year: 'numeric' });
const YEAR_FORMAT = new Intl.DateTimeFormat('es-PA', { year: 'numeric' });
const DAY_MS = 1000 * 60 * 60 * 24;

function normalizeTickLabel(value) {
  return `${value}`.replace(/\./g, '');
}

function formatDateTick(value, spanDays) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(+date)) return value;
  if (spanDays <= 45) return normalizeTickLabel(DAY_MONTH_FORMAT.format(date));
  if (spanDays <= 400) {
    const monthLabel = normalizeTickLabel(MONTH_FORMAT.format(date));
    return date.getMonth() === 0 ? `${monthLabel}\n${YEAR_FORMAT.format(date)}` : monthLabel;
  }
  return normalizeTickLabel(MONTH_YEAR_FORMAT.format(date));
}

function resolveDateTicks(spanDays) {
  return spanDays > 45 ? d3.timeMonth.every(1) : undefined;
}

function toValidDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(+date) ? null : date;
}

function normalizeMilestoneGroups(milestones, [domainStart, domainEnd]) {
  const startTime = +domainStart;
  const endTime = +domainEnd;
  const groups = new Map();

  for (const milestone of milestones) {
    const date = toValidDate(milestone?.date);
    const label = `${milestone?.label || ''}`.trim();
    if (!date || !label) continue;
    if (+date < startTime || +date > endTime) continue;

    const key = date.toISOString().slice(0, 10);
    const group = groups.get(key) || { date, labels: [] };
    group.labels.push(label);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      date: group.date,
      labels: [...new Set(group.labels)],
    }))
    .sort((a, b) => d3.ascending(a.date, b.date));
}

function createMilestoneMarks(milestoneGroups, milestoneY) {
  return milestoneGroups.map((milestone) => ({
    ...milestone,
    value: milestoneY,
    flag: MILESTONE_FLAG,
    tooltip: milestone.labels.join('\n\n'),
  }));
}

function resolveYLayout(points) {
  const minValue = d3.min(points, (point) => point.value) ?? 0;
  const maxValue = d3.max(points, (point) => point.value) ?? 0;
  const span = maxValue - minValue;
  const topPadding = (span || Math.abs(maxValue) || 1) * 0.3;
  const topValue = maxValue + topPadding;

  return {
    domain: [Math.min(0, minValue), topValue],
    milestoneY: topValue,
  };
}

export const line = (points, { int, money, short }, { xDomain, milestones = [] } = {}) => {
  if (!points.length) return null;

  const [domainStart, domainEnd] = xDomain || [points[0]?.date, points[points.length - 1]?.date];
  const spanDays = Math.abs((domainEnd - domainStart) / DAY_MS) || 0;
  const dateTicks = resolveDateTicks(spanDays);
  const { domain: yDomain, milestoneY } = resolveYLayout(points);
  const milestoneGroups = normalizeMilestoneGroups(milestones, [domainStart, domainEnd]);
  const milestoneMarks = createMilestoneMarks(milestoneGroups, milestoneY);

  return Plot.plot({
        ...plotBase,
        width: PLOT_WIDTH,
        height: PLOT_HEIGHT,
        marginLeft: PLOT_MARGIN_LEFT,
        x: {
          label: null,
          tickFormat: (value) => formatDateTick(value, spanDays),
          ...(dateTicks ? { ticks: dateTicks } : {}),
          ...(xDomain ? { domain: xDomain } : {}),
        },
        y: { label: null, grid: true, tickFormat: short, tickSize: 0, domain: yDomain, insetBottom: 8 },
        marks: [
          Plot.ruleY([0], { stroke: '#cbd5e1' }),
          ...(milestoneMarks.length
            ? [
                Plot.ruleX(milestoneMarks, {
                  x: 'date',
                  stroke: MILESTONE_COLOR,
                  strokeDasharray: '1,3',
                  strokeLinecap: 'round',
                  strokeWidth: 1,
                  ...(xDomain ? { clip: true } : {}),
                }),
                Plot.text(milestoneMarks, {
                  x: 'date',
                  y: 'value',
                  text: 'flag',
                  fill: MILESTONE_COLOR,
                  stroke: '#fff7ed',
                  strokeWidth: 0.75,
                  fontSize: 20,
                  fontWeight: 700,
                  lineAnchor: 'bottom',
                  dy: MILESTONE_FLAG_DY,
                }),
              ]
            : []),
          Plot.areaY(points, {
            x: 'date',
            y: 'value',
            curve: 'linear',
            fill: SERIES_ACCENT_COLOR,
            fillOpacity: 0.12,
            ...(xDomain ? { clip: true } : {}),
          }),
          Plot.lineY(points, {
            x: 'date',
            y: 'value',
            curve: 'linear',
            stroke: SERIES_COLOR,
            strokeWidth: 2.5,
            ...(xDomain ? { clip: true } : {}),
          }),
          Plot.dot(points, {
            x: 'date',
            y: 'value',
            r: 3.5,
            fill: SERIES_ACCENT_COLOR,
          }),
          ...(milestoneMarks.length
            ? [
                Plot.tip(
                  milestoneMarks,
                  Plot.pointerX({
                    x: 'date',
                    y: 'value',
                    dy: MILESTONE_FLAG_DY,
                    title: (d) => d.tooltip,
                    fill: MILESTONE_COLOR,
                    stroke: '#fff7ed',
                    lineWidth: 24,
                  }),
                ),
              ]
            : []),
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
