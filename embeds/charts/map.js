import * as d3 from 'd3';
import { createPanamaMapSvg, PANAMA_PROVINCE_NAMES } from './panama-map.js';

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
    maxWidth: '420px',
  });

  const topRow = document.createElement('div');
  Object.assign(topRow.style, {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    width: '100%',
  });

  const scaleColumn = document.createElement('div');
  Object.assign(scaleColumn.style, {
    display: 'grid',
    gap: '6px',
    flex: '1 1 auto',
    minWidth: '0',
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

  const note = document.createElement('div');
  note.className = 'mf-legend-note';
  Object.assign(note.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: '0 0 auto',
    whiteSpace: 'nowrap',
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

  scaleColumn.append(bar, ticks);
  topRow.append(scaleColumn, note);
  scaleWrap.append(topRow);
  legend.append(scaleWrap);

  return legend;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tooltipHtml(text) {
  const lines = String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return '';

  return [
    `<div style="font-weight:700;margin-bottom:4px">${escapeHtml(lines[0])}</div>`,
    ...lines.slice(1).map((line) => `<div style="font-size:12px;line-height:1.35">${escapeHtml(line)}</div>`),
  ].join('');
}

function attachTooltip({ wrap, stage, svg, htmlByProvince }) {
  const tooltip = document.createElement('div');
  Object.assign(tooltip.style, {
    position: 'absolute',
    zIndex: '3',
    minWidth: '180px',
    maxWidth: '280px',
    padding: '10px 12px',
    borderRadius: '10px',
    background: 'rgba(15,23,42,.96)',
    color: '#fff',
    boxShadow: '0 10px 30px rgba(15,23,42,.22)',
    pointerEvents: 'none',
    opacity: '0',
    transform: 'translateY(4px)',
    transition: 'opacity 120ms ease, transform 120ms ease',
  });
  stage.append(tooltip);

  const hideTooltip = () => {
    tooltip.style.opacity = '0';
    tooltip.style.transform = 'translateY(4px)';
  };

  const showTooltip = (event, provinceName) => {
    const html = htmlByProvince(provinceName);
    if (!html) return hideTooltip();

    tooltip.innerHTML = html;
    tooltip.style.opacity = '1';
    tooltip.style.transform = 'translateY(0)';

    const stageBounds = stage.getBoundingClientRect();
    const tooltipBounds = tooltip.getBoundingClientRect();
    const offset = 14;
    const left = Math.min(
      Math.max(offset, event.clientX - stageBounds.left + offset),
      Math.max(offset, stageBounds.width - tooltipBounds.width - offset),
    );
    const top = Math.min(
      Math.max(offset, event.clientY - stageBounds.top + offset),
      Math.max(offset, stageBounds.height - tooltipBounds.height - offset),
    );
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };

  for (const [id, provinceName] of PANAMA_PROVINCE_NAMES) {
    const node = svg.querySelector(`#${id}`);
    if (!node) continue;

    node.style.cursor = 'default';
    node.addEventListener('pointerenter', (event) => showTooltip(event, provinceName));
    node.addEventListener('pointermove', (event) => showTooltip(event, provinceName));
    node.addEventListener('pointerleave', hideTooltip);
  }

  wrap.addEventListener('pointerleave', hideTooltip);
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

  const stage = document.createElement('div');
  Object.assign(stage.style, {
    position: 'relative',
    width: '100%',
    maxWidth: '960px',
    margin: '0 auto',
  });
  stage.append(svg);

  attachTooltip({
    wrap,
    stage,
    svg,
    htmlByProvince: (provincia) => {
      const row = data.get(provincia);
      const value = row?.[valueKey];
      return tooltipHtml(Number.isFinite(value) ? tooltip(row, value) : `${provincia}\nSin datos`);
    },
  });

  wrap.append(stage, buildLegend({ scale, valueFormat, explicitScale, min, rawMax }));
  return wrap;
};
