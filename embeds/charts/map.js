import * as d3 from 'd3';
import { createPanamaMapSvg } from './panama-map.js';

const NO_DATA_COLOR = '#f2f2f2';

function uniqueNumbers(values) {
  return values.filter((value, index) => values.findIndex((other) => Math.abs(other - value) < 1e-9) === index);
}

function legendValues({ scale, explicitScale, min, rawMax }) {
  if (explicitScale) {
    const values = uniqueNumbers((scale.domain?.() || []).filter(Number.isFinite));
    return values.length ? values : [min];
  }
  return rawMax > min ? [min, rawMax] : [min];
}

function legendBackground(scale, values) {
  if (!values.length) return NO_DATA_COLOR;
  if (values.length === 1 || values[0] === values[values.length - 1]) return scale(values[0]);

  const start = values[0];
  const end = values[values.length - 1];
  const stops = d3.range(0, 25).map((index) => {
    const t = index / 24;
    const value = start + (end - start) * t;
    return `${scale(value)} ${t * 100}%`;
  });

  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

function buildLegend({ scale, valueFormat, explicitScale, min, rawMax }) {
  const values = legendValues({ scale, explicitScale, min, rawMax });
  const start = values[0] ?? min;
  const end = values[values.length - 1] ?? min;
  const span = end - start || 1;

  const legend = document.createElement('div');
  legend.className = 'legend';
  Object.assign(legend.style, {
    display: 'grid',
    gap: '8px',
    marginTop: '12px',
    color: '#667085',
    fontSize: '12px',
  });

  const scaleWrap = document.createElement('div');
  scaleWrap.className = 'mf-legend-scale';
  Object.assign(scaleWrap.style, {
    display: 'grid',
    gap: '6px',
    width: '100%',
    maxWidth: '320px',
  });

  const bar = document.createElement('div');
  bar.className = 'mf-legend-bar';
  Object.assign(bar.style, {
    width: '100%',
    height: '12px',
    border: '1px solid #e4e7ec',
    borderRadius: '999px',
    background: legendBackground(scale, values),
  });
  scaleWrap.append(bar);

  const ticks = document.createElement('div');
  ticks.className = 'mf-legend-ticks';
  Object.assign(ticks.style, {
    position: 'relative',
    width: '100%',
    minHeight: values.length === 1 ? 'auto' : '16px',
  });

  values.forEach((value, index) => {
    const tick = document.createElement('span');
    tick.className = 'mf-legend-tick';
    tick.textContent = valueFormat(value);

    if (values.length === 1) {
      Object.assign(tick.style, {
        position: 'static',
        display: 'inline-block',
      });
    } else {
      let transform = 'translateX(-50%)';
      if (index === 0) transform = 'none';
      else if (index === values.length - 1) transform = 'translateX(-100%)';

      Object.assign(tick.style, {
        position: 'absolute',
        top: '0',
        left: `${((value - start) / span) * 100}%`,
        transform,
        whiteSpace: 'nowrap',
      });
    }

    ticks.append(tick);
  });

  scaleWrap.append(ticks);
  legend.append(scaleWrap);

  const note = document.createElement('div');
  note.className = 'mf-legend-note';
  Object.assign(note.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  });

  const swatch = document.createElement('span');
  swatch.className = 'mf-legend-swatch';
  Object.assign(swatch.style, {
    width: '12px',
    height: '12px',
    border: '1px solid #a6a6a6',
    borderRadius: '999px',
    background: NO_DATA_COLOR,
    flex: 'none',
  });

  const text = document.createElement('span');
  text.textContent = 'Sin datos';
  note.append(swatch, text);
  legend.append(note);

  return legend;
}

export const mapChart = ({ rows, valueKey, domain, colorScale, valueFormat, tooltip }) => {
  const data = new Map(rows.filter((d) => d?.provincia).map((d) => [d.provincia, d]));
  const vals = rows.map((d) => d?.[valueKey]).filter(Number.isFinite);
  const [min, rawMax] = domain || [0, d3.max(vals) || 0];
  const max = rawMax > min ? rawMax : min + 1;
  const explicitScale = Boolean(domain || colorScale);
  const scale =
    colorScale || d3.scaleLinear().domain([min, max]).range(['#eff6ff', '#1d4ed8']).interpolate(d3.interpolateRgb);

  const svg = createPanamaMapSvg({
    fillByProvince: (provincia) => {
      const value = data.get(provincia)?.[valueKey];
      return Number.isFinite(value) ? scale(value) : NO_DATA_COLOR;
    },
    titleByProvince: (provincia) => {
      const row = data.get(provincia);
      const value = row?.[valueKey];
      return Number.isFinite(value) ? tooltip(row, value) : `${provincia}\nSin datos`;
    },
  });

  const wrap = document.createElement('div');
  wrap.className = 'mf-map';
  wrap.append(svg, buildLegend({ scale, valueFormat, explicitScale, min, rawMax }));
  return wrap;
};
