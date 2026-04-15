import * as d3 from 'd3';

// Pulled from Observable notebook @rusosnith/beeswarm-reutilizable
// Source: https://observablehq.com/@rusosnith/beeswarm-reutilizable
// Snapshot imported on 2026-04-10 via https://api.observablehq.com/@rusosnith/beeswarm-reutilizable.js?v=4

const defaults = {
  // Layout
  width: 800,
  height: 600,
  margin: { top: 20, right: 40, bottom: 40, left: 60 },

  // Modo
  separateVertically: true,

  // Accesores (genéricos)
  x: (d) => d.x,
  r: (d) => d.r ?? 1,
  y: (d) => d.category,
  color: (d) => d.subcategory ?? d.category,

  // Escalas (override opcional)
  xScale: null,
  yScale: null,
  rScale: null,
  colorScale: null,

  // Atajos de escala
  rRange: [2, 20],

  // Simulación (calidad/performance)
  xForceStrength: 1,
  yForceStrength: 1,
  collisionPadding: 1,
  alphaMin: 0.02, // cortar antes (más rápido) [web:32]
  alphaDecay: null, // null = default d3 (~300 iters) [web:32]
  velocityDecay: null, // null = default d3 (0.4) [web:121]
  collideIterations: 1, // más = menos overlap, más lento

  // Precompute
  precomputedPositions: null,
  precomputedKey: (d) => d.id,

  // Ejes
  showXAxis: true,
  showYAxis: true,
  xAxisPosition: 'bottom',
  yAxisPosition: 'right',
  xTickSize: null,
  yTickSize: null,
  xTickCount: 5,
  xTickFormat: ',.0f', // 1,000

  // Estilos
  xAxisColor: '#ccc',
  yAxisColor: '#eee',
  xAxisWidth: 0.1,
  yAxisWidth: 1,
  fontSize: 14,
  yAxisTickPadding: 50,

  // Círculos
  circleOpacity: 1, // opacidad “normal” cuando no hay hover
  circleStroke: 'none',
  circleStrokeWidth: 0,

  // Nuevos defaults a agregar en el objeto defaults:
  labels: false, // activar/desactivar
  labelMinR: 15, // radio mínimo en px para mostrar label
  labelAccessor: (d) => d.__cv, // qué texto mostrar
  labelColor: 'white',
  labelFontSize: 11,
  labelLineHeight: 1.2,

  // Tooltip + Delaunay
  tooltip: true,
  tooltipHTML: (d) => {
    const xv = d.__xv ?? d.x;
    const rv = d.__rv ?? d.r;
    const yv = d.__yv ?? d.category;
    const cv = d.__cv ?? d.subcategory ?? d.category;
    return `<div style="font-weight:600;margin-bottom:4px">${cv ?? ''}</div>
            <div><span style="opacity:.7">x:</span> ${xv}</div>
            <div><span style="opacity:.7">r:</span> ${rv}</div>
            ${yv != null ? `<div><span style="opacity:.7">y:</span> ${yv}</div>` : ''}`;
  },
  tooltipOffset: [12, 12],
  tooltipMaxWidth: 280,
  tooltipClamp: true,

  // Distancia máxima para activar tooltip:
  // null => auto = (maxRadiusPx * 2)
  hoverMaxDistance: null,

  // Dimming por hover (CSS)
  dimOthersOnHover: true,
  dimOpacity: 0.2,
};

const buildConfig = (options = {}) => ({
  ...defaults,
  ...options,
  margin: { ...defaults.margin, ...options.margin },
});

const buildLayoutState = (data, options = {}) => {
  const config = buildConfig(options);
  const innerWidth = config.width - config.margin.left - config.margin.right;
  const innerHeight = config.height - config.margin.top - config.margin.bottom;

  const X = data.map(config.x);
  const R = data.map(config.r);
  const Y = config.separateVertically ? Array.from(new Set(data.map(config.y))) : [];
  const C = data.map(config.color);

  const x = config.xScale ?? d3.scaleLinear().domain(d3.extent(X)).nice().range([0, innerWidth]);
  const r = config.rScale ?? d3.scaleSqrt().domain(d3.extent(R)).range(config.rRange);
  const y = config.separateVertically
    ? (config.yScale ?? d3.scaleBand().domain(Y).range([0, innerHeight]).paddingInner(0.2).paddingOuter(0.1))
    : null;
  const z = config.colorScale ?? d3.scaleOrdinal(d3.schemeTableau10).domain(Array.from(new Set(C)));

  const nodes = data.map((d) => ({
    ...d,
    __xv: config.x(d),
    __rv: config.r(d),
    __yv: config.separateVertically ? config.y(d) : null,
    __cv: config.color(d),
  }));

  return { config, innerWidth, innerHeight, x, r, y, z, nodes };
};

const applyPrecomputedPositions = ({ config, nodes }) => {
  const positions = config.precomputedPositions;
  if (!positions) return false;

  for (const node of nodes) {
    const key = config.precomputedKey(node);
    const position = positions instanceof Map ? positions.get(key) : positions[key];
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      return false;
    }
    node.x = position.x;
    node.y = position.y;
  }

  return true;
};

const runForceLayout = ({ config, innerHeight, x, r, y, nodes }) => {
  const simulation = d3.forceSimulation(nodes);

  simulation.alphaMin(config.alphaMin); // el timer corta cuando alpha < alphaMin [web:32]
  if (config.alphaDecay != null) simulation.alphaDecay(config.alphaDecay); // [web:32]
  if (config.velocityDecay != null) simulation.velocityDecay(config.velocityDecay); // [web:121]

  simulation.force('x', d3.forceX((d) => x(d.__xv)).strength(config.xForceStrength));

  if (config.separateVertically) {
    simulation.force('y', d3.forceY((d) => y(d.__yv) + y.bandwidth() / 2).strength(config.yForceStrength));
  } else {
    const centerY = config.showXAxis
      ? config.xAxisPosition === 'bottom'
        ? innerHeight * 0.4
        : innerHeight * 0.6
      : innerHeight / 2;

    simulation.force('y', d3.forceY(centerY).strength(config.yForceStrength));
  }

  simulation.force(
    'collide',
    d3.forceCollide((d) => config.collisionPadding + r(d.__rv)).iterations(config.collideIterations),
  );

  simulation.stop();
  while (simulation.alpha() > simulation.alphaMin()) simulation.tick(); // [web:32]
};

export const computeBeeSwarmLayout = (data, options = {}) => {
  const state = buildLayoutState(data, options);
  runForceLayout(state);
  return state;
};

export const easyBeeSwarm = (data, options = {}) => {
  const state = buildLayoutState(data, options);
  const { config, innerWidth, innerHeight, x, r, y, z, nodes } = state;

  if (!applyPrecomputedPositions(state)) {
    runForceLayout(state);
  }

  // ---- Umbral auto: maxRadiusPx * 2 ----
  const maxRadiusPx = d3.max(nodes, (d) => r(d.__rv)) ?? 0;
  const hoverMaxDistancePx = config.hoverMaxDistance == null ? maxRadiusPx * 2 : config.hoverMaxDistance;

  // ---- Contenedor (embed-safe) ----
  const container = d3
    .create('div')
    .style('position', 'relative')
    .style('width', `${config.width}px`)
    .classed('beeswarm', true);

  // CSS local (no ensucia el notebook y sirve en embed)
  if (config.dimOthersOnHover) {
    container.append('style').text(`
      .beeswarm.has-hover circle.bubble { opacity: ${config.dimOpacity}; transition: opacity 120ms linear; }
      .beeswarm.has-hover circle.bubble.is-active { opacity: ${config.circleOpacity}; }
    `);
  }

  const svg = container
    .append('svg')
    .attr('width', config.width)
    .attr('height', config.height)
    .style('display', 'block');

  const g = svg.append('g').attr('transform', `translate(${config.margin.left}, ${config.margin.top})`);

  // ---- Ejes ----
  if (config.showYAxis && config.separateVertically) {
    const yAxisTransform = config.yAxisPosition === 'left' ? `translate(0,0)` : `translate(${innerWidth},0)`;

    const yTickSize = config.yTickSize ?? innerWidth;

    const yAxis = g
      .append('g')
      .attr('transform', yAxisTransform)
      .call(d3.axisLeft(y).tickPadding(config.yAxisTickPadding).tickSize(yTickSize));

    yAxis.select('.domain').remove();
    yAxis.selectAll('line').attr('stroke', config.yAxisColor).attr('stroke-width', config.yAxisWidth);
    yAxis.selectAll('text').attr('font-size', config.fontSize);
  }

  if (config.showXAxis) {
    const xAxisYPosition = config.separateVertically
      ? y.bandwidth() / 2
      : config.xAxisPosition === 'bottom'
        ? innerHeight * 0.8
        : innerHeight * 0.2;

    let xAxisCall = config.xAxisPosition === 'bottom' ? d3.axisBottom(x) : d3.axisTop(x);

    // cantidad de ticks
    if (config.xTickCount) {
      xAxisCall = xAxisCall.ticks(config.xTickCount);
    }

    // formato de ticks
    if (config.xTickFormat) {
      xAxisCall = xAxisCall.tickFormat(
        typeof config.xTickFormat === 'string' ? d3.format(config.xTickFormat) : config.xTickFormat,
      );
    }

    const xTickSize =
      config.xTickSize ?? (config.separateVertically ? innerHeight - y.bandwidth() / 2 : innerHeight * 0.6);

    const xAxis = g
      .append('g')
      .attr('transform', `translate(0, ${xAxisYPosition})`)
      .call(xAxisCall.tickSize(xTickSize));

    xAxis.select('.domain').remove();

    xAxis.selectAll('line').attr('stroke', config.xAxisColor).attr('stroke-width', config.xAxisWidth);

    xAxis.selectAll('text').attr('fill', '#888').attr('font-size', config.fontSize);
  }

  // ---- Círculos ----
  const circles = g
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('class', 'bubble')
    .attr('cx', (d) => d.x)
    .attr('cy', (d) => d.y)
    .attr('r', (d) => r(d.__rv))
    .attr('fill', (d) => z(d.__cv))
    .attr('opacity', config.circleOpacity)
    .attr('stroke', config.circleStroke)
    .attr('stroke-width', config.circleStrokeWidth);

  // ---- Labels internos (word wrap con foreignObject) ----
  if (config.labels) {
    const wrapText = (text, maxLines = 3) => {
      if (!text) return [''];
      const words = text.split(/\s+/);
      const lines = [];
      let current = '';

      for (const word of words) {
        if (current && word.length > 3) {
          lines.push(current);
          current = word;
        } else {
          current = current ? `${current} ${word}` : word;
        }
        if (lines.length === maxLines) break;
      }
      if (current && lines.length < maxLines) lines.push(current);

      if (lines.join(' ') !== text && !lines.at(-1).endsWith(text.split(/\s+/).at(-1))) {
        lines[lines.length - 1] = lines.at(-1).replace(/\s?\S+$/, '…');
      }

      return lines;
    };

    const lineHeight = config.labelFontSize * config.labelLineHeight;

    g.selectAll('g.bubble-label')
      .data(nodes.filter((d) => r(d.__rv) >= config.labelMinR))
      .join('g')
      .attr('class', 'bubble-label')
      .attr('pointer-events', 'none')
      .attr('transform', (d) => `translate(${d.x}, ${d.y})`)
      .selectAll('text')
      .data((d) =>
        wrapText(config.labelAccessor(d)).map((line, i, arr) => ({
          line,
          i,
          total: arr.length,
          d,
        })),
      )
      .join('text')
      .attr('text-anchor', 'middle')
      .attr('y', ({ i, total }) => (-(total - 1) * lineHeight) / 2 + i * lineHeight)
      .attr('dominant-baseline', 'middle')
      .attr('fill', config.labelColor)
      .attr('font-size', config.labelFontSize)
      .attr('pointer-events', 'none')
      .text(({ line }) => line);
  }

  // ---- Tooltip + Delaunay (Voronoi trick) ----
  if (config.tooltip) {
    const tip = container
      .append('div')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('pointer-events', 'none')
      .style('max-width', `${config.tooltipMaxWidth}px`)
      .style('background', 'rgba(20,20,20,0.92)')
      .style('color', 'white')
      .style('padding', '8px 10px')
      .style('border-radius', '6px')
      .style('font', '12px/1.3 system-ui, -apple-system, Segoe UI, Roboto, sans-serif')
      .style('z-index', 10);

    const delaunay = d3.Delaunay.from(
      nodes,
      (d) => d.x,
      (d) => d.y,
    ); // nearest-neighbor [web:91]
    const overlay = g
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .style('fill', 'transparent')
      .style('pointer-events', 'all');

    const [dx, dy] = config.tooltipOffset;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    let lastIndex = 0;
    let activeEl = null;

    const hide = () => {
      tip.style('visibility', 'hidden');
      if (config.dimOthersOnHover) container.classed('has-hover', false);
      if (activeEl) activeEl.classList.remove('is-active');
      activeEl = null;
    };

    overlay.on('pointerleave', hide).on('pointermove', (event) => {
      const [mx, my] = d3.pointer(event, g.node()); // coords relativas al plot [web:59]
      const i = delaunay.find(mx, my, lastIndex); // nearest index [web:91][web:85]
      lastIndex = i;

      const d = nodes[i];
      const dist = Math.hypot(mx - d.x, my - d.y);

      if (dist > hoverMaxDistancePx) {
        hide();
        return;
      }

      tip.html(config.tooltipHTML(d)).style('visibility', 'visible');

      // Dim others (CSS) + marcar activo
      if (config.dimOthersOnHover) container.classed('has-hover', true);

      const el = circles.nodes()[i];
      if (activeEl !== el) {
        if (activeEl) activeEl.classList.remove('is-active');
        el.classList.add('is-active');
        activeEl = el;
      }

      // Posicionar tooltip: coords del plot + margin => coords del container
      let left = config.margin.left + mx + dx;
      let top = config.margin.top + my + dy;

      if (config.tooltipClamp) {
        const tw = tip.node().offsetWidth || 0;
        const th = tip.node().offsetHeight || 0;
        left = clamp(left, 0, config.width - tw);
        top = clamp(top, 0, config.height - th);
      }

      tip.style('left', `${left}px`).style('top', `${top}px`);
    });
  }

  return container.node();
};
