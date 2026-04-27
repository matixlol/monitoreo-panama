import * as d3 from 'd3';
import { easyBeeSwarm } from './easy-beeswarm.observable.js';
import { getBeeswarmLayoutOptions } from './beeswarm-layout-config.js';
import { getPartyColor } from './party-colors.js';

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const amountOf = (d) => d.ingresoTotal ?? d.total ?? 0;
const candidateGroupOf = (d) => d.group || d.party || 'Sin partido';
const PRESIDENT_POSITION = 'Presidente';
const OTHER_CANDIDATE_GROUP = 'Otros';
const CANDIDATE_X_TICK_MIN = 6;
const CANDIDATE_X_TICK_MAX = 8;
const CANDIDATE_X_TICK_TARGET = 7;
const candidateTickNumber = new Intl.NumberFormat('es-PA', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const isPresidentCandidateRows = (rows) => rows.length > 0 && rows.every((row) => row.position === PRESIDENT_POSITION);

const centerCandidateGroups = (groups) => {
  if (groups.length <= 2) return groups;

  const ordered = Array(groups.length);
  let left = Math.floor((groups.length - 1) / 2);
  let right = left + 1;

  groups.forEach((group, index) => {
    if (index === 0) {
      ordered[left] = group;
      left -= 1;
      return;
    }

    if (index % 2 === 1) {
      ordered[left] = group;
      left -= 1;
      return;
    }

    ordered[right] = group;
    right += 1;
  });

  return ordered.filter(Boolean);
};

const candidateLegendGroups = (rows) => {
  const groupCounts = d3
    .rollups(
      rows,
      (values) => values.length,
      candidateGroupOf,
    )
    .sort(
      (a, b) =>
        (a[0] === OTHER_CANDIDATE_GROUP) - (b[0] === OTHER_CANDIDATE_GROUP) ||
        d3.descending(a[1], b[1]) ||
        d3.ascending(a[0], b[0]),
    );

  const centeredGroups = centerCandidateGroups(
    groupCounts.filter(([group]) => group !== OTHER_CANDIDATE_GROUP).map(([group]) => group),
  );
  const otherGroups = groupCounts
    .filter(([group]) => group === OTHER_CANDIDATE_GROUP)
    .map(([group]) => group);

  return [...centeredGroups, ...otherGroups];
};

const sortCandidateRows = (rows) => {
  const groupOrder = candidateLegendGroups(rows);
  const groupOrderIndex = new Map(groupOrder.map((group, index) => [group, index]));

  return [...rows].sort(
    (a, b) =>
      (groupOrderIndex.get(candidateGroupOf(a)) ?? Number.MAX_SAFE_INTEGER) -
        (groupOrderIndex.get(candidateGroupOf(b)) ?? Number.MAX_SAFE_INTEGER) ||
      d3.descending(amountOf(a), amountOf(b)) ||
      d3.ascending(a.name || '', b.name || ''),
  );
};

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
  if (amount === 0) return '';
  const absolute = Math.abs(amount);

  if (absolute >= 1e6) {
    const millions = absolute / 1e6;
    const label = candidateTickNumber.format(millions);
    const suffix = millions === 1 ? 'millón' : 'millones';
    return `B/. ${amount < 0 ? '-' : ''}${label} ${suffix}`;
  }

  return short(value);
};

const formatBeeswarmAmountTick = (value, short) => {
  const amount = +value || 0;
  return amount === 0 ? '' : short(value);
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
    rDomain: [0, amountMax || 1],
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

export const beeswarm = (rows, kind, { buildHashRoute, money, precomputedPositions, short }) => {
  if (!rows.length) return null;

  const chartRows = kind === 'candidato' ? sortCandidateRows(rows) : rows;
  const isPresidentCandidates = kind === 'candidato' && isPresidentCandidateRows(chartRows);

  const colorDomain = kind === 'candidato' ? candidateLegendGroups(chartRows) : null;
  const colorScale = kind === 'candidato' || kind === 'aportante' ? getPartyColor : undefined;
  const layoutOptions = getBeeswarmLayoutOptions(kind, {
    precomputedPositions,
    precomputedKey: (d) => d.id,
    tooltipHTML: (d) => tooltipFor(kind, d, money),
    xTickFormat: (value) => formatBeeswarmAmountTick(value, short),
    colorScale,
  });

  if (kind === 'candidato') {
    Object.assign(
      layoutOptions,
      getCandidateXAxisOptions(chartRows, layoutOptions.width, layoutOptions.margin, short, layoutOptions.rRange),
    );

    if (isPresidentCandidates) {
      Object.assign(layoutOptions, {
        separateVertically: false,
        showYAxis: false,
        centerYRatio: 0.5,
        xAxisYRatio: 0.5,
        xGridFullHeight: true,
        labelForceShow: true,
        labelMaxLines: Infinity,
      });
    }
  }

  if (kind === 'aportante') {
    Object.assign(layoutOptions, {
      showYAxis: false,
      margin: {
        ...layoutOptions.margin,
        left: 24,
        right: 24,
      },
    });
  }

  const chart = easyBeeSwarm(chartRows, layoutOptions);

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
