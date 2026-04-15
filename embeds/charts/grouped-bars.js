import * as d3 from 'd3';
import * as Plot from '@observablehq/plot';

const plotBase = {
  style: { maxWidth: '100%', height: 'auto', overflow: 'visible' },
  marginTop: 8,
  marginBottom: 48,
  color: { legend: false },
};

const GROUP_STEP = 2.35;
const BAR_WIDTH = 0.5;
const SERIES_OFFSET = 0.3;

function htmlNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function compactTick(value) {
  return d3.format('~s')(value).replace('G', 'B');
}

export const groupedBarsChartCss = `.mf-grouped-bars{display:grid;gap:18px;min-width:0}.mf-grouped-bars__legend{display:flex;flex-wrap:wrap;justify-content:center;gap:24px;color:#344054}.mf-grouped-bars__legend-item{display:inline-flex;align-items:center;gap:10px;font-size:15px;font-weight:600;line-height:1.2}.mf-grouped-bars__legend-dot{width:14px;height:14px;border-radius:999px;flex:none}.mf-grouped-bars__figure{min-width:0}.mf-grouped-bars__figure svg{display:block;width:100%;height:auto;overflow:visible}.mf-grouped-bars [aria-label='y-grid'] line{stroke:#dbe4ef;stroke-dasharray:6 8}.mf-grouped-bars [aria-label='x-axis'] text,.mf-grouped-bars [aria-label='y-axis'] text{fill:#344054;font-size:14px}.mf-grouped-bars [aria-label='x-axis'] path,.mf-grouped-bars [aria-label='y-axis'] path,.mf-grouped-bars [aria-label='y-axis'] line{stroke:#d0d7de}.mf-grouped-bars [aria-label='x-axis'] line{stroke:transparent}`;

export function groupedBarsChart(items, { int } = {}) {
  if (!items.length) return null;

  const groups = [...new Map(items.map((item) => [item.group, item.groupLabel])).entries()];
  const groupIndex = new Map(groups.map(([group], index) => [group, index]));
  const tickValues = groups.map((_, index) => index * GROUP_STEP + 0.5);
  const tickLabels = new Map(groups.map(([group, label], index) => [tickValues[index], label]));
  const bars = items.map((item) => {
    const index = groupIndex.get(item.group) ?? 0;
    const groupCenter = index * GROUP_STEP + 0.5;
    const offset = item.seriesIndex === 0 ? -SERIES_OFFSET : SERIES_OFFSET;
    return {
      ...item,
      x1: groupCenter + offset - BAR_WIDTH / 2,
      x2: groupCenter + offset + BAR_WIDTH / 2,
    };
  });

  const maxValue = d3.max(bars, (item) => item.value) || 0;
  const xMax = Math.max(1, (groups.length - 1) * GROUP_STEP + 1.2);

  const root = htmlNode('div', 'mf-grouped-bars');
  const legend = htmlNode('div', 'mf-grouped-bars__legend');
  const figure = htmlNode('div', 'mf-grouped-bars__figure');
  const series = [...new Map(items.map((item) => [item.series, item])).values()];

  series.forEach((item) => {
    const entry = htmlNode('div', 'mf-grouped-bars__legend-item');
    const dot = htmlNode('span', 'mf-grouped-bars__legend-dot');
    dot.style.background = item.color;
    entry.append(dot, htmlNode('span', null, item.seriesLabel));
    legend.append(entry);
  });

  const plot = Plot.plot({
    ...plotBase,
    width: 210,
    height: 260,
    marginLeft: 46,
    marginRight: 12,
    x: {
      label: null,
      domain: [-0.8, xMax],
      ticks: tickValues,
      tickFormat: (value) => tickLabels.get(value) || '',
      nice: false,
    },
    y: {
      label: null,
      domain: [0, maxValue || 1],
      nice: true,
      grid: true,
      tickFormat: compactTick,
    },
    marks: [
      Plot.ruleY([0], { stroke: '#d0d7de' }),
      Plot.rectY(bars, {
        x1: 'x1',
        x2: 'x2',
        y1: 0,
        y2: 'value',
        fill: (item) => item.color,
        insetTop: 0,
        insetBottom: 0,
        title: (item) => `${item.groupLabel}\n${item.seriesLabel}: ${int ? int(item.value) : item.value}`,
      }),
    ],
  });

  figure.append(plot);
  root.append(legend, figure);
  return root;
}
