import * as Plot from '@observablehq/plot';

const plotBase = {
  style: { maxWidth: '100%', height: 'auto', overflow: 'visible' },
  marginBottom: 40,
  marginTop: 10,
  color: { legend: false },
};

export const line = (points, { int, money, short }, options = {}) =>
  points.length
    ? Plot.plot({
        ...plotBase,
        width: 1000,
        height: 320,
        marginLeft: 64,
        x: { label: null, domain: options.xDomain },
        y: { label: null, grid: true, tickFormat: short },
        marks: [
          Plot.ruleY([0], { stroke: '#cbd5e1' }),
          Plot.areaY(points, { x: 'date', y: 'value', curve: 'linear', fill: '#2f80ed', fillOpacity: 0.12 }),
          Plot.lineY(points, { x: 'date', y: 'value', curve: 'linear', stroke: '#111827', strokeWidth: 2.5 }),
          Plot.dot(points, {
            x: 'date',
            y: 'value',
            r: 3.5,
            fill: '#2f80ed',
            title: (d) => `${d.label}\n${money(d.value)}\n${int(d.count)} registros`,
          }),
        ],
      })
    : null;
