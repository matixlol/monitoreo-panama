import * as d3 from 'd3';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function amountTick(value) {
  if (!Number.isFinite(value) || value <= 0) return '0k';
  return d3.format('~s')(value).replace('G', 'B');
}

function dateTick(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${MONTHS[date.getMonth()]} ${`${date.getFullYear()}`.slice(-2)}`;
}

function shortDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${`${date.getDate()}`.padStart(2, '0')} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function contributorHistogram(model, { int, money, short }) {
  if (!model?.series?.length) return null;

  const width = 1000;
  const marginTop = 10;
  const marginLeft = 58;
  const marginRight = 122;
  const marginBottom = 42;
  const panelHeight = 126;
  const panelGap = 24;
  const panelInsetTop = 8;
  const panelInsetBottom = 12;
  const plotWidth = width - marginLeft - marginRight;
  const height = marginTop + model.series.length * panelHeight + (model.series.length - 1) * panelGap + marginBottom;

  const svg = d3
    .create('svg')
    .attr('viewBox', [0, 0, width, height])
    .style('max-width', '100%')
    .style('height', 'auto')
    .style('display', 'block')
    .style('overflow', 'visible');

  const x =
    model.xType === 'date'
      ? d3.scaleTime().domain(model.xDomain).range([marginLeft, width - marginRight])
      : d3.scaleLinear().domain(model.xDomain).range([marginLeft, width - marginRight]);

  const yTickFormat = model.mode === 'sum' ? short : int;

  const panel = svg
    .selectAll('g.panel')
    .data(model.series)
    .join('g')
    .attr('class', 'panel')
    .attr('transform', (_, index) => `translate(0, ${marginTop + index * (panelHeight + panelGap)})`);

  panel
    .append('rect')
    .attr('x', marginLeft)
    .attr('y', 0)
    .attr('width', plotWidth)
    .attr('height', panelHeight)
    .attr('fill', '#f3f4f6');

  panel.each(function renderPanel(series) {
    const group = d3.select(this);
    const y = d3
      .scaleLinear()
      .domain([0, model.yMax || 1])
      .nice(5)
      .range([panelHeight - panelInsetBottom, panelInsetTop]);

    const axisY = d3.axisLeft(y).ticks(5).tickSize(8).tickSizeOuter(0).tickFormat((value) => yTickFormat(value));

    group
      .append('g')
      .attr('transform', `translate(${marginLeft},0)`)
      .call(axisY)
      .call((axis) => axis.select('.domain').attr('stroke', '#374151'))
      .call((axis) => axis.selectAll('.tick line').attr('stroke', '#374151'))
      .call((axis) =>
        axis
          .selectAll('.tick text')
          .attr('fill', '#374151')
          .attr('font-size', 11)
          .attr('dx', '-0.25em'),
      );

    const bars = series.bins.filter((bin) => bin.y > 0);

    group
      .append('g')
      .selectAll('rect.bar')
      .data(bars)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', (bin) => x(bin.x0) + 0.5)
      .attr('y', (bin) => y(bin.y))
      .attr('width', (bin) => Math.max(1, x(bin.x1) - x(bin.x0) - 1))
      .attr('height', (bin) => Math.max(0, panelHeight - panelInsetBottom - y(bin.y)))
      .attr('fill', '#1f2329')
      .append('title')
      .text((bin) => {
        if (model.mode === 'date') {
          const end = d3.timeDay.offset(bin.x1, -1);
          return [
            series.label,
            `${shortDate(bin.x0)} → ${shortDate(end)}`,
            `${int(bin.count)} aportes`,
            `${money(bin.sum)} acumulados`,
          ].join('\n');
        }

        const amountRange = `${money(bin.x0)} → ${money(bin.x1)}`;
        if (model.mode === 'sum') {
          return [
            series.label,
            amountRange,
            `${money(bin.sum)} en el rango`,
            `${int(bin.count)} aportantes`,
          ].join('\n');
        }

        return [
          series.label,
          amountRange,
          `${int(bin.count)} aportantes`,
          `${money(bin.sum)} acumulados`,
        ].join('\n');
      });

    group
      .append('text')
      .attr('x', width - marginRight + 18)
      .attr('y', panelHeight / 2)
      .attr('fill', '#1f2937')
      .attr('font-size', 13)
      .attr('font-weight', 500)
      .attr('dominant-baseline', 'middle')
      .text(series.label);
  });

  const xAxis =
    model.xType === 'date'
      ? d3.axisBottom(x).ticks(d3.timeMonth.every(1)).tickFormat((value) => dateTick(value))
      : d3
          .axisBottom(x)
          .tickValues(d3.range(model.xDomain[0], model.xDomain[1] + 1, model.tickStep || 20000))
          .tickFormat((value) => amountTick(value));

  svg
    .append('g')
    .attr('transform', `translate(0, ${height - marginBottom})`)
    .call(xAxis)
    .call((axis) => axis.select('.domain').attr('stroke', '#374151'))
    .call((axis) => axis.selectAll('.tick line').attr('stroke', '#374151'))
    .call((axis) => axis.selectAll('.tick text').attr('fill', '#374151').attr('font-size', 11));

  return svg.node();
}
