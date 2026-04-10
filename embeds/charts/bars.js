import * as Plot from 'https://esm.sh/@observablehq/plot@0.6.17?bundle';

const plotBase = {
  style: { maxWidth: '100%', height: 'auto', overflow: 'visible' },
  marginBottom: 40,
  marginTop: 10,
  color: { legend: false },
};

export const bars = (items, { colors, money, short }) =>
  items.length
    ? Plot.plot({
        ...plotBase,
        width: 1000,
        height: Math.max(160, items.length * 36 + 30),
        marginLeft: 220,
        x: { label: null, grid: true, tickFormat: short },
        y: { label: null },
        marks: [
          Plot.barX(items, {
            x: 'value',
            y: 'label',
            fill: (d) => d.color || colors[0],
            sort: { y: 'x', reverse: true },
            title: (d) => `${d.label}\n${money(d.value)}`,
          }),
          Plot.ruleX([0]),
        ],
      })
    : null;
