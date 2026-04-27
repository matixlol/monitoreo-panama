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
  centerYRatio: null,

  // Accesores (genéricos)
  x: (d) => d.x,
  r: (d) => d.r ?? 1,
  y: (d) => d.category,
  color: (d) => d.subcategory ?? d.category,

  // Escalas (override opcional)
  xScale: null,
  yScale: null,
  rScale: null,
  rDomain: null,
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
  xAxisYRatio: null,
  xGridFullHeight: false,
  yAxisPosition: 'right',
  xTickSize: null,
  yTickSize: null,
  xTickCount: 5,
  xTickValues: null,
  xTickFormat: ',.0f', // 1,000
  yPaddingTop: 0,
  yPaddingBottom: 0,

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
  labelMaxLines: 3,
  labelForceShow: false,

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
  interactionBoundsPadding: null,

  // Dimming por hover (CSS)
  dimOthersOnHover: true,
  dimOpacity: 0.2,
};

const buildConfig = (options = {}) => ({
  ...defaults,
  ...options,
  margin: { ...defaults.margin, ...options.margin },
});

const textMetricsCanvas = typeof document === 'undefined' ? null : document.createElement('canvas');
const textMetricsContext = textMetricsCanvas?.getContext('2d') ?? null;

const measureTextWidth = (text, fontSize) => {
  const value = `${text ?? ''}`;
  if (!value) return 0;
  if (!textMetricsContext) return value.length * fontSize * 0.6;

  textMetricsContext.font = `${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  return textMetricsContext.measureText(value).width;
};

const wrapTextToWidth = (text, maxWidth, maxLines, fontSize) => {
  const value = `${text ?? ''}`.trim();
  if (!value) return { lines: [''], truncated: false };

  const words = value.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  let index = 0;

  while (index < words.length && lines.length < maxLines) {
    const candidate = current ? `${current} ${words[index]}` : words[index];
    if (current && measureTextWidth(candidate, fontSize) > maxWidth) {
      lines.push(current);
      current = '';
      continue;
    }

    current = candidate;
    index += 1;
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (!lines.length) {
    lines.push(words[0]);
    index = Math.max(index, 1);
  }

  const truncated = index < words.length;
  if (!truncated) return { lines, truncated: false };

  const visibleLines = lines.slice(0, maxLines);
  let lastLine = visibleLines.at(-1) ?? '';
  while (lastLine && measureTextWidth(`${lastLine}…`, fontSize) > maxWidth) {
    lastLine = lastLine.replace(/\s?\S+$/, '').trim();
  }
  visibleLines[visibleLines.length - 1] = lastLine ? `${lastLine}…` : '…';

  return { lines: visibleLines, truncated: true };
};

const buildLayoutState = (data, options = {}) => {
  const config = buildConfig(options);
  const innerWidth = config.width - config.margin.left - config.margin.right;
  const innerHeight = config.height - config.margin.top - config.margin.bottom;

  const X = data.map(config.x);
  const R = data.map(config.r);
  const Y = config.separateVertically ? Array.from(new Set(data.map(config.y))) : [];
  const C = data.map(config.color);

  const x = config.xScale ?? d3.scaleLinear().domain(d3.extent(X)).nice().range([0, innerWidth]);
  const rDomain = config.rDomain ?? d3.extent(R);
  const r = config.rScale ?? d3.scaleSqrt().domain(rDomain).range(config.rRange);
  const y = config.separateVertically
    ? (
        config.yScale ??
        d3
          .scaleBand()
          .domain(Y)
          .range([config.yPaddingTop, innerHeight - config.yPaddingBottom])
          .paddingInner(0.2)
          .paddingOuter(0.1)
      )
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
    const centerY =
      config.centerYRatio != null
        ? innerHeight * config.centerYRatio
        : config.showXAxis
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
  const interactionBoundsPadding =
    config.interactionBoundsPadding == null ? hoverMaxDistancePx : config.interactionBoundsPadding;

  // ---- Contenedor (embed-safe) ----
  const container = d3
    .create('div')
    .style('position', 'relative')
    .style('width', '100%')
    .style('min-width', '0')
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
    .attr('viewBox', [0, 0, config.width, config.height])
    .attr('width', config.width)
    .attr('height', config.height)
    .style('display', 'block')
    .style('width', '100%')
    .style('height', 'auto')
    .style('max-width', '100%');

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
      : config.xAxisYRatio != null
        ? innerHeight * config.xAxisYRatio
        : config.xAxisPosition === 'bottom'
          ? innerHeight * 0.8
          : innerHeight * 0.2;

    let xAxisCall = config.xAxisPosition === 'bottom' ? d3.axisBottom(x) : d3.axisTop(x);

    // cantidad de ticks
    if (config.xTickCount) {
      xAxisCall = xAxisCall.ticks(config.xTickCount);
    }

    if (config.xTickValues?.length) {
      xAxisCall = xAxisCall.tickValues(config.xTickValues);
    }

    // formato de ticks
    if (config.xTickFormat) {
      xAxisCall = xAxisCall.tickFormat(
        typeof config.xTickFormat === 'string' ? d3.format(config.xTickFormat) : config.xTickFormat,
      );
    }

    const xTickSize = config.xTickSize ?? (config.separateVertically ? innerHeight - y.bandwidth() / 2 : innerHeight - xAxisYPosition);

    const xAxis = g
      .append('g')
      .attr('transform', `translate(0, ${xAxisYPosition})`)
      .call(xAxisCall.tickSize(xTickSize));

    xAxis.select('.domain').remove();

    const xAxisLines = xAxis.selectAll('line').attr('stroke', config.xAxisColor).attr('stroke-width', config.xAxisWidth);

    if (config.xGridFullHeight && !config.separateVertically) {
      xAxisLines.attr('y1', -xAxisYPosition).attr('y2', innerHeight - xAxisYPosition);
    }

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

  const delaunay = config.tooltip ? d3.Delaunay.from(
    nodes,
    (d) => d.x,
    (d) => d.y,
  ) : null;

  // ---- Labels internos ----
  if (config.labels) {
    const internalLineHeight = config.labelFontSize * config.labelLineHeight;
    g.selectAll('g.bubble-label')
      .data(
        nodes.flatMap((node) => {
          const radius = r(node.__rv);
          if (!config.labelForceShow && radius < config.labelMinR) return [];

          const maxWidth = Math.max(radius * 1.6, 36);
          const maxHeight = Math.max(radius * 1.5, internalLineHeight);
          const wrapped = wrapTextToWidth(
            config.labelAccessor(node),
            maxWidth,
            config.labelMaxLines,
            config.labelFontSize,
          );
          const fitsHeight = wrapped.lines.length * internalLineHeight <= maxHeight;
          const fitsWidth = wrapped.lines.every((line) => measureTextWidth(line, config.labelFontSize) <= maxWidth);

          if (!config.labelForceShow && (!fitsHeight || !fitsWidth || wrapped.truncated)) return [];

          return [{ node, lines: wrapped.lines }];
        }),
      )
      .join('g')
      .attr('class', 'bubble-label')
      .attr('pointer-events', 'none')
      .attr('transform', (d) => `translate(${d.node.x}, ${d.node.y})`)
      .each(function (layout) {
        const selection = d3.select(this);
        selection.selectAll('*').remove();

        const text = selection
          .append('text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('fill', config.labelColor)
          .attr('font-size', config.labelFontSize)
          .attr('pointer-events', 'none');

        layout.lines.forEach((line, i) => {
          text
            .append('tspan')
            .attr('x', 0)
            .attr('y', (-(layout.lines.length - 1) * internalLineHeight) / 2 + i * internalLineHeight)
            .text(line);
        });
      });
  }

  // ---- Tooltip + Delaunay (Voronoi trick) ----
  if (config.tooltip && delaunay) {
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

    const overlay = g
      .append('rect')
      .attr('class', 'hover-overlay')
      .attr('x', -interactionBoundsPadding)
      .attr('y', -interactionBoundsPadding)
      .attr('width', innerWidth + interactionBoundsPadding * 2)
      .attr('height', innerHeight + interactionBoundsPadding * 2)
      .style('fill', 'transparent')
      .style('pointer-events', 'all');

    const [dx, dy] = config.tooltipOffset;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const getTooltipFrame = () => {
      const bounds = svg.node().getBoundingClientRect();
      const scaleX = bounds.width ? bounds.width / config.width : 1;
      const scaleY = bounds.height ? bounds.height / config.height : 1;
      return {
        height: bounds.height || config.height,
        scaleX,
        scaleY,
        width: bounds.width || config.width,
      };
    };

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

      const frame = getTooltipFrame();

      // Posicionar tooltip: coords del plot + margin => coords del container
      let left = (config.margin.left + mx) * frame.scaleX + dx;
      let top = (config.margin.top + my) * frame.scaleY + dy;

      if (config.tooltipClamp) {
        const tw = tip.node().offsetWidth || 0;
        const th = tip.node().offsetHeight || 0;
        left = clamp(left, 0, frame.width - tw);
        top = clamp(top, 0, frame.height - th);
      }

      tip.style('left', `${left}px`).style('top', `${top}px`);
    });
  }

  return container.node();
};
