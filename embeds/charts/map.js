import * as d3 from 'd3';

export const mapChart = ({ rows, valueKey, domain, colorScale, valueFormat, tooltip, mapMarkup, provinces }) => {
  const data = new Map(rows.filter((d) => d?.provincia).map((d) => [d.provincia, d]));
  const vals = rows.map((d) => d?.[valueKey]).filter(Number.isFinite);
  const [min, rawMax] = domain || [0, d3.max(vals) || 0];
  const max = rawMax > min ? rawMax : min + 1;
  const scale =
    colorScale || d3.scaleLinear().domain([min, max]).range(['#eff6ff', '#1d4ed8']).interpolate(d3.interpolateRgb);
  const svg = d3
    .create('svg')
    .attr('viewBox', [0, 0, 960, 560])
    .style('max-width', '100%')
    .style('height', 'auto')
    .style('display', 'block');
  svg.html(`<g transform="translate(0,54) scale(.28)">${mapMarkup}</g>`);
  const g = svg.select('g');
  for (const [id, provincia] of provinces) {
    const shape = g.select(`#${id}`);
    if (shape.empty()) continue;
    const row = data.get(provincia);
    const value = row?.[valueKey];
    shape
      .attr('fill', Number.isFinite(value) ? scale(value) : '#e5e7eb')
      .attr('stroke', 'white')
      .attr('stroke-width', 8)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round');
    shape.selectAll('title').remove();
    shape.append('title').text(Number.isFinite(value) ? tooltip(row, value) : `${provincia}\nSin datos`);
  }
  const wrap = document.createElement('div');
  wrap.className = 'mf-map';
  wrap.append(svg.node());
  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.innerHTML = `<span class="mf-grad"></span><span>${valueFormat(min)}</span><span>${valueFormat(max)}</span><span>gris = sin datos</span>`;
  wrap.append(legend);
  return wrap;
};
