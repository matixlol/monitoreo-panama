import * as d3 from 'd3';
import { easyBeeSwarm } from './easy-beeswarm.observable.js';
import { getBeeswarmLayoutOptions } from './beeswarm-layout-config.js';

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const amountOf = (d) => d.ingresoTotal ?? d.total ?? 0;
const candidateGroupOf = (d) => d.group || d.party || 'Sin partido';

const tooltipFor = (kind, d, money) => {
  const amount = money(amountOf(d));
  if (kind === 'candidato') {
    return [
      `<div style="margin-bottom:4px">Candidatura: ${esc(d.name)}</div>`,
      `<div style="margin-bottom:4px">Cargo: ${esc(d.position || 'Sin cargo')}</div>`,
      `<div style="margin-bottom:4px">Partido: ${esc(d.party || 'Sin partido')}</div>`,
      `<div>Fondos: ${amount}</div>`,
      `<div style="margin-top:6px;opacity:.7">Click para abrir ficha</div>`,
    ].join('');
  }
  return [
    `<div style="margin-bottom:4px">Aportante: ${esc(d.name)}</div>`,
    `<div style="margin-bottom:4px">Cargo: ${esc(d.position || 'Sin cargo')}</div>`,
    `<div style="margin-bottom:4px">Partido: ${esc(d.party || 'Sin partido')}</div>`,
    `<div>Fondos: ${amount}</div>`,
    `<div style="margin-top:6px;opacity:.7">Click para abrir ficha</div>`,
  ].join('');
};

const attachOpenFicha = (chart, kind, buildHashRoute) => {
  const svg = d3.select(chart).select('svg');
  const plotGroup = svg.select('g');
  const overlay = plotGroup.select('rect');
  const circles = plotGroup.selectAll('circle.bubble').style('cursor', 'pointer');
  const nodes = circles.data();

  if (!nodes.length || !overlay.node()) return;

  const radii = circles.nodes().map((node) => Number(node.getAttribute('r')) || 0);
  const maxDistance = (d3.max(radii) ?? 0) * 2;
  const delaunay = d3.Delaunay.from(
    nodes,
    (d) => d.x,
    (d) => d.y,
  );

  overlay.style('cursor', 'pointer').on(`click.open-ficha-${kind}`, (event) => {
    const [mx, my] = d3.pointer(event, plotGroup.node());
    const index = delaunay.find(mx, my);
    const datum = nodes[index];
    if (!datum) return;

    const distance = Math.hypot(mx - datum.x, my - datum.y);
    if (distance > maxDistance || !datum.id) return;

    window.location.hash = buildHashRoute(kind, datum.id);
  });
};

const mobileCandidateBeeswarm = (rows, kind, { buildHashRoute, money, short }) => {
  const width = 720;
  const margin = { top: 6, right: 8, bottom: 24, left: 8 };
  const innerWidth = width - margin.left - margin.right;
  const amounts = rows.map(amountOf);
  const amountMax = d3.max(amounts) ?? 0;
  const xScale = d3.scaleLinear().domain([0, amountMax || 1]).nice().range([0, innerWidth]);
  const rScale = d3
    .scaleSqrt()
    .domain([0, amountMax || 1])
    .range([4, amountMax > 500000 ? 18 : 22]);
  const groups = Array.from(
    d3.group(rows, candidateGroupOf),
    ([label, values]) => ({ label, values }),
  );
  const colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(groups.map((group) => group.label));

  const container = d3
    .create('div')
    .classed('beeswarm-mobile-candidates', true)
    .style('display', 'grid')
    .style('gap', '10px')
    .style('width', '100%')
    .style('min-width', '0');

  container.append('style').text(`
    .beeswarm-mobile-candidates__group {
      display: grid;
      gap: 8px;
      padding: 10px 10px 8px;
      border: 1px solid #d0d5dd;
      border-radius: 14px;
      background: #fff;
    }

    .beeswarm-mobile-candidates__label {
      font: 700 12px/1.2 inherit;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #344054;
    }

    .beeswarm-mobile-candidates__group .beeswarm {
      max-width: none !important;
    }
  `);

  groups.forEach(({ label, values }) => {
    const group = container.append('section').attr('class', 'beeswarm-mobile-candidates__group');
    group.append('div').attr('class', 'beeswarm-mobile-candidates__label').text(label);

    const chart = easyBeeSwarm(values, {
      width,
      height: 106,
      margin,
      x: amountOf,
      r: amountOf,
      y: () => 'row',
      color: () => label,
      xScale,
      rScale,
      colorScale,
      separateVertically: false,
      showYAxis: false,
      showXAxis: true,
      xAxisPosition: 'bottom',
      xTickCount: 4,
      xTickFormat: short,
      xTickSize: 8,
      xAxisColor: '#d0d5dd',
      xAxisWidth: 0.8,
      fontSize: 11,
      labels: false,
      circleStroke: 'rgba(255,255,255,0.85)',
      circleStrokeWidth: 1,
      tooltipHTML: (d) => tooltipFor(kind, d, money),
    });

    attachOpenFicha(chart, kind, buildHashRoute);
    group.node().append(chart);
  });

  return container.node();
};

export const beeswarm = (rows, kind, { buildHashRoute, money, precomputedPositions, short }) => {
  if (!rows.length) return null;

  if (kind === 'candidato' && typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches) {
    return mobileCandidateBeeswarm(rows, kind, { buildHashRoute, money, short });
  }

  const chart = easyBeeSwarm(
    rows,
    getBeeswarmLayoutOptions(kind, {
      precomputedPositions,
      precomputedKey: (d) => d.id,
      tooltipHTML: (d) => tooltipFor(kind, d, money),
      xTickFormat: short,
    }),
  );

  attachOpenFicha(chart, kind, buildHashRoute);
  return chart;
};
