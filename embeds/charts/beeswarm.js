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
const candidateLegendGroups = (rows) => Array.from(new Set(rows.map(candidateGroupOf)));
const CANDIDATE_X_TICK_MIN = 6;
const CANDIDATE_X_TICK_MAX = 8;
const CANDIDATE_X_TICK_TARGET = 7;
const candidateTickNumber = new Intl.NumberFormat('es-PA', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const getCandidateTickValues = (xScale) => {
  for (let count = CANDIDATE_X_TICK_MAX; count >= CANDIDATE_X_TICK_MIN; count -= 1) {
    const tickValues = xScale.ticks(count);
    if (tickValues.length <= CANDIDATE_X_TICK_MAX) {
      return tickValues;
    }
  }

  return xScale.ticks(CANDIDATE_X_TICK_MIN).slice(0, CANDIDATE_X_TICK_MAX);
};

const formatCandidateAmountTick = (value, short) => {
  const amount = +value || 0;
  const absolute = Math.abs(amount);

  if (absolute >= 1e6) {
    const millions = absolute / 1e6;
    const label = candidateTickNumber.format(millions);
    const suffix = millions === 1 ? 'millón' : 'millones';
    return `B/. ${amount < 0 ? '-' : ''}${label} ${suffix}`;
  }

  return short(value);
};

const getCandidateXAxisOptions = (rows, width, margin, short, rRange) => {
  const innerWidth = width - margin.left - margin.right;
  const amountMax = d3.max(rows, amountOf) ?? 0;
  const rScale = d3
    .scaleSqrt()
    .domain([0, amountMax || 1])
    .range(rRange);
  const maxRadius = d3.max(rows, (row) => rScale(amountOf(row))) ?? rRange[0];
  const edgePadding = Math.min(maxRadius + 8, innerWidth * 0.18);
  const xScale = d3
    .scaleLinear()
    .domain([0, amountMax || 1])
    .nice(CANDIDATE_X_TICK_TARGET)
    .range([edgePadding, Math.max(edgePadding, innerWidth - edgePadding)]);
  const xTickValues = getCandidateTickValues(xScale);

  return {
    xScale,
    xTickCount: xTickValues.length,
    xTickValues,
    xTickFormat: (value) => formatCandidateAmountTick(value, short),
    xAxisColor: 'silver',
    xAxisWidth: 0.5,
  };
};

const renderLegend = (items) => {
  const legend = d3
    .create('div')
    .attr('class', 'beeswarm-candidates-legend')
    .style('display', 'flex')
    .style('flex-wrap', 'wrap')
    .style('justify-content', 'center')
    .style('gap', '10px 16px')
    .style('margin-top', '14px')
    .style('color', '#667085')
    .style('font-size', '12px')
    .style('line-height', '1.2');

  items.forEach(({ label, color }) => {
    const entry = legend
      .append('div')
      .style('display', 'inline-flex')
      .style('align-items', 'center')
      .style('gap', '8px');

    entry
      .append('span')
      .style('width', '12px')
      .style('height', '12px')
      .style('border-radius', '999px')
      .style('background', color)
      .style('flex', 'none');

    entry.append('span').text(label);
  });

  return legend.node();
};

const wrapWithLegend = (chart, items) => {
  const root = d3
    .create('div')
    .style('display', 'grid')
    .style('gap', '0')
    .style('width', '100%')
    .style('min-width', '0');

  root.node().append(chart);
  root.node().append(renderLegend(items));
  return root.node();
};

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
    `<div>Aportes para este cargo: ${amount}</div>`,
    `<div style="margin-top:6px;opacity:.7">Monto filtrado por cargo</div>`,
    `<div style="margin-top:6px;opacity:.7">Click para abrir ficha</div>`,
  ].join('');
};

const attachOpenFicha = (chart, kind, buildHashRoute) => {
  const svg = d3.select(chart).select('svg');
  const plotGroup = svg.select('g');
  const overlay = plotGroup.select('rect.hover-overlay');
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
  const sharedMargin = { top: 14, right: 8, bottom: 24, left: 32 };
  const amounts = rows.map(amountOf);
  const amountMax = d3.max(amounts) ?? 0;
  const mobileRadiusRange = [4, amountMax > 500000 ? 18 : 22];
  const xAxisOptions = getCandidateXAxisOptions(rows, width, sharedMargin, short, mobileRadiusRange);
  const rScale = d3
    .scaleSqrt()
    .domain([0, amountMax || 1])
    .range(mobileRadiusRange);
  const groups = Array.from(d3.group(rows, candidateGroupOf), ([label, values]) => ({ label, values }));
  const colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(groups.map((group) => group.label));

  const container = d3
    .create('div')
    .classed('beeswarm-mobile-candidates', true)
    .style('display', 'grid')
    .style('gap', '4px')
    .style('width', '100%')
    .style('min-width', '0');

  container.append('style').text(`
    .beeswarm-mobile-candidates__group {
      display: grid;
      gap: 4px;
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

  groups.forEach(({ label, values }, index) => {
    const isLast = index === groups.length - 1;
    const margin = isLast ? sharedMargin : { ...sharedMargin, bottom: 8 };
    const group = container.append('section').attr('class', 'beeswarm-mobile-candidates__group');
    group.append('div').attr('class', 'beeswarm-mobile-candidates__label').text(label);

    const chart = easyBeeSwarm(values, {
      width,
      height: isLast ? 118 : 86,
      margin,
      x: amountOf,
      r: amountOf,
      y: () => 'row',
      color: () => label,
      xScale: xAxisOptions.xScale,
      rScale,
      colorScale,
      separateVertically: false,
      showYAxis: false,
      showXAxis: isLast,
      xAxisPosition: 'bottom',
      xTickCount: xAxisOptions.xTickCount,
      xTickValues: xAxisOptions.xTickValues,
      xTickFormat: xAxisOptions.xTickFormat,
      xTickSize: isLast ? 8 : 0,
      xAxisColor: xAxisOptions.xAxisColor,
      xAxisWidth: xAxisOptions.xAxisWidth,
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

  const colorDomain = kind === 'candidato' ? candidateLegendGroups(rows) : null;
  const colorScale =
    kind === 'candidato' ? d3.scaleOrdinal(d3.schemeTableau10).domain(colorDomain) : undefined;
  const layoutOptions = getBeeswarmLayoutOptions(kind, {
    precomputedPositions,
    precomputedKey: (d) => d.id,
    tooltipHTML: (d) => tooltipFor(kind, d, money),
    xTickFormat: short,
    colorScale,
  });

  if (kind === 'candidato') {
    Object.assign(
      layoutOptions,
      getCandidateXAxisOptions(rows, layoutOptions.width, layoutOptions.margin, short, layoutOptions.rRange),
    );
  }

  const chart = easyBeeSwarm(rows, layoutOptions);

  attachOpenFicha(chart, kind, buildHashRoute);

  if (kind !== 'candidato') return chart;

  return wrapWithLegend(
    chart,
    colorDomain.map((label) => ({
      label,
      color: colorScale(label),
    })),
  );
};
