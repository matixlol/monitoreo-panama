import * as d3 from 'd3';

export const treemap = (items, { colors, money }) => {
  if (!items.length) return null;
  const root = d3
    .hierarchy({ children: items })
    .sum((d) => d.value)
    .sort((a, b) => d3.descending(a.value, b.value));
  d3.treemap().size([1000, 420]).padding(3)(root);
  const svg = d3
    .create('svg')
    .attr('viewBox', [0, 0, 1000, 420])
    .style('max-width', '100%')
    .style('height', 'auto')
    .style('display', 'block');
  const leaf = svg
    .selectAll('g')
    .data(root.leaves())
    .join('g')
    .attr('transform', (d) => `translate(${d.x0},${d.y0})`);
  leaf
    .append('rect')
    .attr('rx', 10)
    .attr('width', (d) => Math.max(0, d.x1 - d.x0))
    .attr('height', (d) => Math.max(0, d.y1 - d.y0))
    .attr('fill', (_, i) => colors[i % colors.length]);
  leaf.append('title').text((d) => `${d.data.label}\n${money(d.data.value)}`);
  leaf
    .append('text')
    .attr('x', 10)
    .attr('y', 22)
    .attr('fill', '#111827')
    .attr('font-size', 14)
    .attr('font-weight', 700)
    .selectAll('tspan')
    .data((d) => [d.data.label.slice(0, 34), money(d.data.value)])
    .join('tspan')
    .attr('x', 10)
    .attr('dy', (_, i) => (i ? 18 : 0))
    .text((d) => d);
  return svg.node();
};
