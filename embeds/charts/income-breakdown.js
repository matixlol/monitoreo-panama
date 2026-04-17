import { formatEmbedCurrency } from '../embed-shared.jsx';

const SVG_NS = 'http://www.w3.org/2000/svg';

const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 68;
const STROKE_WIDTH = 24;

function svgNode(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, `${value}`));
  return node;
}

function htmlNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function wholeMoney(value) {
  return formatEmbedCurrency(+value || 0, 0);
}

export const incomeBreakdownChartCss = `.mf-income-breakdown{display:grid;grid-template-columns:minmax(190px,232px) minmax(0,1fr);gap:24px;align-items:center;width:fit-content;max-width:100%;margin:0 auto}.mf-income-breakdown__visual{display:flex;justify-content:center}.mf-income-breakdown__donut{position:relative;width:min(100%,220px);aspect-ratio:1}.mf-income-breakdown__svg{display:block;width:100%;height:auto}.mf-income-breakdown__center{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;text-align:center;padding:24%}.mf-income-breakdown__total{font-size:1.15rem;font-weight:700;line-height:1.05;letter-spacing:-.03em;color:#344054}.mf-income-breakdown__share{margin-top:8px;font-size:clamp(.88rem,1.35vw,1.02rem);font-weight:600;line-height:1;color:#667085}.mf-income-breakdown__list{display:grid;gap:16px;min-width:0;width:min(100%,400px)}.mf-income-breakdown__item{display:grid;gap:4px;min-width:0}.mf-income-breakdown__row{display:flex;align-items:baseline;justify-content:space-between;gap:14px}.mf-income-breakdown__label,.mf-income-breakdown__value{font-size:1.02rem;line-height:1.2;color:#344054;letter-spacing: -0.6px;}.mf-income-breakdown__label{font-weight:650}.mf-income-breakdown__value{font-variant-numeric:tabular-nums}.mf-income-breakdown__track{height:10px;border-radius:999px;background:#edf2f8;overflow:hidden}.mf-income-breakdown__fill{height:100%;border-radius:999px}.mf-income-breakdown__ring-track{stroke:#edf2f8}.mf-income-breakdown__segment{fill:none;stroke-linecap:butt}@media (max-width:720px){.mf-income-breakdown{grid-template-columns:1fr;gap:16px}.mf-income-breakdown__visual{justify-content:center}.mf-income-breakdown__donut{width:min(100%,192px)}.mf-income-breakdown__list{gap:14px;width:min(100%,400px)}.mf-income-breakdown__track{height:9px}}`;

export function incomeBreakdownChart(items) {
  const rows = items.filter((item) => (+item?.value || 0) > 0);
  const total = rows.reduce((acc, item) => acc + (+item.value || 0), 0);
  if (!(total > 0)) return null;

  const root = htmlNode('div', 'mf-income-breakdown');
  const visual = htmlNode('div', 'mf-income-breakdown__visual');
  const donut = htmlNode('div', 'mf-income-breakdown__donut');
  const list = htmlNode('div', 'mf-income-breakdown__list');

  const svg = svgNode('svg', {
    'viewBox': `0 0 ${SIZE} ${SIZE}`,
    'class': 'mf-income-breakdown__svg',
    'role': 'img',
    'aria-label': `Distribución de ingresos. Total ${wholeMoney(total)}.`,
  });
  const circleTrack = svgNode('circle', {
    'cx': CENTER,
    'cy': CENTER,
    'r': RADIUS,
    'fill': 'none',
    'stroke': '#edf2f8',
    'stroke-width': STROKE_WIDTH,
    'class': 'mf-income-breakdown__ring-track',
  });
  const segments = svgNode('g', { transform: `rotate(-90 ${CENTER} ${CENTER})` });
  const circumference = 2 * Math.PI * RADIUS;
  const gap = rows.length > 1 ? 5 : 0;
  let offset = 0;

  rows.forEach((item) => {
    const value = +item.value || 0;
    const ratio = value / total;
    const segment = ratio * circumference;
    const visible = Math.max(0, segment - gap);
    if (visible > 0) {
      segments.append(
        svgNode('circle', {
          'cx': CENTER,
          'cy': CENTER,
          'r': RADIUS,
          'fill': 'none',
          'stroke': item.color,
          'stroke-width': STROKE_WIDTH,
          'stroke-dasharray': `${visible} ${circumference - visible}`,
          'stroke-dashoffset': `${-offset}`,
          'class': 'mf-income-breakdown__segment',
        }),
      );
    }
    offset += segment;
  });

  svg.append(circleTrack, segments);

  const center = htmlNode('div', 'mf-income-breakdown__center');
  center.append(
    htmlNode('div', 'mf-income-breakdown__total', wholeMoney(total)),
    htmlNode('div', 'mf-income-breakdown__share', '100%'),
  );

  donut.append(svg, center);
  visual.append(donut);

  rows.forEach((item) => {
    const ratio = (+item.value || 0) / total;
    const entry = htmlNode('div', 'mf-income-breakdown__item');
    const row = htmlNode('div', 'mf-income-breakdown__row');
    row.append(
      htmlNode('div', 'mf-income-breakdown__label', item.label),
      htmlNode('div', 'mf-income-breakdown__value', wholeMoney(item.value)),
    );

    const track = htmlNode('div', 'mf-income-breakdown__track');
    const fill = htmlNode('div', 'mf-income-breakdown__fill');
    fill.style.width = `${ratio * 100}%`;
    fill.style.background = item.color;
    if (ratio > 0) fill.style.minWidth = '6px';
    track.append(fill);

    entry.append(row, track);
    list.append(entry);
  });

  root.append(visual, list);
  return root;
}
