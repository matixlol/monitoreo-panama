import * as d3 from 'd3';
import * as Plot from '@observablehq/plot';

const plotBase = {
  style: { maxWidth: '100%', height: 'auto', overflow: 'visible' },
  marginTop: 10,
  marginBottom: 34,
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

function roundedTopBarPath(x, y, width, height, radius) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  const right = x + width;
  const bottom = y + height;

  return [
    `M ${x} ${bottom}`,
    `L ${x} ${y + safeRadius}`,
    `Q ${x} ${y} ${x + safeRadius} ${y}`,
    `L ${right - safeRadius} ${y}`,
    `Q ${right} ${y} ${right} ${y + safeRadius}`,
    `L ${right} ${bottom}`,
    'Z',
  ].join(' ');
}

function roundBarTops(plot, maxRadius = 8) {
  const rects = plot.querySelectorAll("[aria-label='rect'] rect");
  for (const rect of rects) {
    const x = Number(rect.getAttribute('x'));
    const y = Number(rect.getAttribute('y'));
    const width = Number(rect.getAttribute('width'));
    const height = Number(rect.getAttribute('height'));

    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) continue;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', roundedTopBarPath(x, y, width, height, maxRadius));

    for (const attributeName of rect.getAttributeNames()) {
      if (attributeName === 'x' || attributeName === 'y' || attributeName === 'width' || attributeName === 'height') {
        continue;
      }
      path.setAttribute(attributeName, rect.getAttribute(attributeName) ?? '');
    }

    const title = rect.querySelector('title');
    if (title) path.append(title.cloneNode(true));
    rect.replaceWith(path);
  }
}

export const groupedBarsChartCss = `.mf-grouped-bars{display:grid;gap:8px;min-width:0}.mf-grouped-bars__legend{display:flex;flex-wrap:nowrap;justify-content:center;align-items:center;gap:16px;color:#667085}.mf-grouped-bars__legend-item{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:400;line-height:1.1}.mf-grouped-bars__legend-dot{width:12px;height:12px;border-radius:999px;flex:none}.mf-grouped-bars__figure{min-width:0}.mf-grouped-bars__figure svg{display:block;width:100%;height:auto;overflow:visible}.mf-grouped-bars [aria-label='x-axis'] text{fill:#344054;font-size:14px}.mf-grouped-bars [aria-label='x-axis'] path{stroke:transparent}.mf-grouped-bars [aria-label='x-axis'] line{stroke:transparent}`;

export function groupedBarsChart(items, { int, compact = false } = {}) {
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
      x: groupCenter + offset,
      x1: groupCenter + offset - BAR_WIDTH / 2,
      x2: groupCenter + offset + BAR_WIDTH / 2,
    };
  });

  const maxValue = d3.max(bars, (item) => item.value) || 0;
  const yMax = Math.max(1, maxValue * 1.08);
  const minBarEdge = d3.min(bars, (item) => item.x1) ?? 0;
  const maxBarEdge = d3.max(bars, (item) => item.x2) ?? 1;
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
    width: compact ? 212 : 210,
    height: compact ? 182 : 280,
    marginLeft: compact ? 10 : 12,
    marginRight: 12,
    x: {
      label: null,
      domain: [-0.8, xMax],
      ticks: tickValues,
      tickSize: 0,
      tickPadding: 5,
      tickFormat: (value) => tickLabels.get(value) || '',
      nice: false,
    },
    y: {
      axis: null,
      label: null,
      domain: [0, yMax],
      nice: false,
    },
    marks: [
      Plot.ruleY(
        [
          {
            value: 0,
            x1: minBarEdge - 0.08,
            x2: maxBarEdge + 0.08,
          },
        ],
        {
          y: 'value',
          x1: 'x1',
          x2: 'x2',
          stroke: '#d0d7de',
          strokeWidth: 1,
        },
      ),
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
      Plot.text(bars, {
        x: 'x',
        y: 'value',
        text: (item) => (int ? int(item.value) : item.value),
        dy: -4,
        fill: (item) => item.color,
        fontSize: compact ? 10 : 11,
        fontWeight: 400,
        lineAnchor: 'bottom',
      }),
    ],
  });

  roundBarTops(plot);

  figure.append(plot);
  root.append(figure, legend);
  return root;
}
