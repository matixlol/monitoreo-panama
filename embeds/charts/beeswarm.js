import * as d3 from 'd3';
import { easyBeeSwarm } from './easy-beeswarm.observable.js';

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const amountOf = (d) => d.ingresoTotal ?? d.total ?? 0;
const candidateGroupOf = (d) => d.group || d.position || 'Sin grupo';
const donorGroupOf = (d) => d.position || 'Sin cargo';

const tooltipFor = (kind, d, money) => {
  const amount = money(amountOf(d));
  if (kind === 'candidato') {
    return [
      `<div style="margin-bottom:4px">Candidato: ${esc(d.name)}</div>`,
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

export const beeswarm = (rows, kind, { buildHashRoute, money, short }) => {
  if (!rows.length) return null;

  const isCandidate = kind === 'candidato';
  const chart = easyBeeSwarm(rows, {
    width: 1000,
    height: isCandidate ? 400 : 600,
    margin: isCandidate
      ? { left: 350, bottom: 50, top: 50, right: 100 }
      : { left: 250, bottom: 50, top: 20, right: 40 },
    x: amountOf,
    r: amountOf,
    y: isCandidate ? candidateGroupOf : donorGroupOf,
    color: (d) => (isCandidate ? candidateGroupOf(d) : d.party || 'Sin partido'),
    tooltipHTML: (d) => tooltipFor(kind, d, money),
    yAxisTickPadding: isCandidate ? 20 : 100,
    alphaMin: isCandidate ? 0.004 : 0.0001,
    rRange: isCandidate ? [1, 50] : [1, 10],
    xTickCount: 5,
    xTickFormat: short,
    labels: isCandidate,
    labelMinR: 20,
    labelAccessor: (d) => d.name,
    labelColor: 'white',
    labelFontSize: 11,
  });

  attachOpenFicha(chart, kind, buildHashRoute);
  return chart;
};
