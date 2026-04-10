import * as Plot from 'https://esm.sh/@observablehq/plot@0.6.17?bundle';

const plotBase = {
  style: { maxWidth: '100%', height: 'auto', overflow: 'visible' },
  marginBottom: 40,
  marginTop: 10,
  color: { legend: false },
};

const measureLabelWidth = (() => {
  let ctx;
  return (label) => {
    if (typeof document === 'undefined') return `${label}`.length * 6.5;
    ctx ||= document.createElement('canvas').getContext('2d');
    ctx.font = '12px Inter, system-ui, sans-serif';
    return ctx.measureText(String(label)).width;
  };
})();

export const beeswarm = (rows, kind, { buildHashRoute, money, short }) => {
  if (!rows.length) return null;
  const width = 1000;
  const labels = [...new Set(rows.map((d) => d.group || d.position || 'Sin grupo'))];
  const longest = Math.max(0, ...labels.map(measureLabelWidth));
  const marginLeft = Math.max(96, Math.min(width * 0.22, longest + 22));
  return Plot.plot({
    ...plotBase,
    width,
    height: Math.max(280, labels.length * 110),
    marginLeft,
    x: { label: null, grid: true, tickFormat: short },
    fy: { label: null },
    r: { range: [4, kind === 'candidato' ? 28 : 16] },
    marks: [
      Plot.dot(
        rows,
        Plot.dodgeY('middle', {
          x: 'ingresoTotal',
          fy: (d) => d.group || d.position || 'Sin grupo',
          r: 'ingresoTotal',
          fill: (d) => d.group || d.party || d.position,
          href: (d) => buildHashRoute(kind, d.id),
          title: (d) => `${d.name}\n${d.party || ''}\n${money(d.ingresoTotal || d.total)}`,
        }),
      ),
    ],
  });
};
