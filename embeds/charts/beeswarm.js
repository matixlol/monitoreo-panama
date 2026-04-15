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

export const beeswarm = (rows, kind, { buildHashRoute, money, precomputedPositions, short }) => {
  if (!rows.length) return null;

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
