import * as d3 from 'd3';

const WIDTH = 1000;
const HEIGHT = 420;
const PADDING = 3;

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function normalizeNode(node, colors, depth = 0, index = 0) {
  const children = Array.isArray(node?.children)
    ? node.children.map((child, childIndex) => normalizeNode(child, colors, depth + 1, childIndex))
    : [];
  const value = Number.isFinite(+node?.value) ? +node.value : d3.sum(children, (child) => child.value || 0);
  const count = Number.isFinite(+node?.count) ? +node.count : d3.sum(children, (child) => child.count || 0);

  return {
    ...node,
    id: node?.id || `node-${depth}-${index}`,
    label: node?.label || 'Sin categoría',
    value,
    count,
    color: node?.color || (depth === 1 ? colors[index % colors.length] : undefined),
    children,
  };
}

function normalizeTree(input, colors) {
  if (Array.isArray(input)) {
    return normalizeNode({ id: 'gastos', label: 'Gastos de campaña', children: input }, colors);
  }
  return normalizeNode(input || { id: 'gastos', label: 'Gastos de campaña', children: [] }, colors);
}

function nodeByPath(root, path) {
  return path.reduce((current, id) => current?.children?.find((child) => child.id === id) || current, root);
}

function colorForNode(node, currentNode, colors, siblings) {
  if (node.color) return node.color;
  const base = currentNode.color || colors[0] || '#2f80ed';
  if (!siblings?.length) return base;
  const index = Math.max(0, siblings.findIndex((item) => item.id === node.id));
  const t = siblings.length === 1 ? 0.72 : 0.35 + (index / Math.max(1, siblings.length - 1)) * 0.55;
  return d3.interpolateRgb('#f8fafc', base)(t);
}

function textColorFor(fill) {
  return d3.lab(fill).l < 58 ? '#ffffff' : '#111827';
}

function truncateLabel(label, maxChars) {
  if (label.length <= maxChars) return label;
  return `${label.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function tooltipHtml(node, money, int, currentNode) {
  const parentLabel = currentNode?.id !== 'gastos' ? currentNode?.label : null;
  const lines = [
    `<div class="tm-tooltip-title">${esc(node.label)}</div>`,
    parentLabel ? `<div class="tm-tooltip-row">Categoría: ${esc(parentLabel)}</div>` : '',
    `<div class="tm-tooltip-row">Monto: ${esc(money(node.value || 0))}</div>`,
    node.count ? `<div class="tm-tooltip-row">Registros: ${esc(int(node.count))}</div>` : '',
    node.children?.length
      ? '<div class="tm-tooltip-hint">Click para ver el detalle</div>'
      : '<div class="tm-tooltip-hint">Detalle final</div>',
  ];
  return lines.filter(Boolean).join('');
}

function labelLines(node, width, height, money) {
  if (width < 84 || height < 42) return [];
  const maxChars = Math.max(10, Math.floor(width / 8));
  const lines = [truncateLabel(node.label, Math.min(32, maxChars))];
  if (height >= 62) lines.push(money(node.value || 0));
  return lines;
}

const STYLE = `
.tm-root{display:grid;gap:10px;color:#111827;font:14px/1.45 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.tm-bar{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:start}
.tm-heading{display:grid;gap:2px;min-width:0}
.tm-breadcrumb{font-size:12px;color:#667085}
.tm-summary{font-size:14px;color:#111827}
.tm-summary strong{font-weight:600}
.tm-actions{display:flex;align-items:center;gap:8px}
.tm-back{appearance:none;border:1px solid #d0d7de;border-radius:8px;background:#fff;color:#111827;padding:6px 10px;font:600 13px/1.2 inherit;cursor:pointer}
.tm-back:hover{background:#f8fafc}
.tm-note{font-size:12px;color:#667085}
.tm-stage{position:relative;border:1px solid #e4e7ec;border-radius:12px;background:#fff;overflow:hidden}
.tm-canvas{position:relative;width:100%;aspect-ratio:1000 / 420;overflow:hidden}
.tm-canvas svg{position:absolute;inset:0;display:block;width:100%;height:100%;max-width:none}
.tm-zoom-overlay{position:absolute;z-index:2;border-radius:8px;border:1px solid rgba(255,255,255,.95);box-shadow:0 10px 24px rgba(15,23,42,.08);pointer-events:none;transform-origin:center center}
.tm-node{cursor:default}
.tm-node.is-zoomable{cursor:pointer}
.tm-tooltip{position:absolute;z-index:3;min-width:180px;max-width:280px;padding:10px 12px;border-radius:10px;background:rgba(15,23,42,.96);color:#fff;box-shadow:0 10px 30px rgba(15,23,42,.22);pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity 120ms ease,transform 120ms ease}
.tm-tooltip.is-visible{opacity:1;transform:translateY(0)}
.tm-tooltip-title{font-weight:700;margin-bottom:4px}
.tm-tooltip-row{font-size:12px;line-height:1.35}
.tm-tooltip-hint{margin-top:6px;font-size:12px;opacity:.75}
`;

export const treemap = (data, { colors = [], money, int }) => {
  const tree = normalizeTree(data, colors);
  if (!tree.children.length) return null;

  const wrap = document.createElement('div');
  wrap.className = 'tm-root';

  const style = document.createElement('style');
  style.textContent = STYLE;
  wrap.append(style);

  const bar = document.createElement('div');
  bar.className = 'tm-bar';

  const heading = document.createElement('div');
  heading.className = 'tm-heading';

  const breadcrumb = document.createElement('div');
  breadcrumb.className = 'tm-breadcrumb';

  const summary = document.createElement('div');
  summary.className = 'tm-summary';

  const actions = document.createElement('div');
  actions.className = 'tm-actions';

  const note = document.createElement('div');
  note.className = 'tm-note';

  const stage = document.createElement('div');
  stage.className = 'tm-stage';

  const canvas = document.createElement('div');
  canvas.className = 'tm-canvas';

  const tooltip = document.createElement('div');
  tooltip.className = 'tm-tooltip';
  stage.append(canvas, tooltip);

  heading.append(breadcrumb, summary, note);
  bar.append(heading, actions);
  wrap.append(bar, stage);

  let path = [];

  const hideTooltip = () => {
    tooltip.classList.remove('is-visible');
  };

  const showTooltip = (event, node, currentNode) => {
    tooltip.innerHTML = tooltipHtml(node, money, int, currentNode);
    tooltip.classList.add('is-visible');
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

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const animateSwap = (nextSvg, direction = 'none', transition = null) => {
    const previousSvg = canvas.querySelector('svg');
    canvas.querySelector('.tm-zoom-overlay')?.remove();
    canvas.append(nextSvg);

    if (!previousSvg || direction === 'none' || prefersReducedMotion() || !previousSvg.animate || !nextSvg.animate) {
      previousSvg?.remove();
      nextSvg.style.opacity = '';
      nextSvg.style.transform = '';
      return;
    }

    previousSvg.style.zIndex = '0';
    nextSvg.style.zIndex = '1';

    if (direction === 'in' && transition) {
      const overlay = document.createElement('div');
      overlay.className = 'tm-zoom-overlay';
      overlay.style.background = transition.fill;
      overlay.style.left = `${transition.left}px`;
      overlay.style.top = `${transition.top}px`;
      overlay.style.width = `${transition.width}px`;
      overlay.style.height = `${transition.height}px`;
      canvas.append(overlay);

      nextSvg.style.opacity = '0';
      nextSvg.style.transform = 'scale(1.01)';

      const canvasWidth = canvas.clientWidth;
      const canvasHeight = canvas.clientHeight;
      const duration = 240;
      const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';

      previousSvg.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing, fill: 'forwards' });

      const overlayExpand = overlay.animate(
        [
          {
            left: `${transition.left}px`,
            top: `${transition.top}px`,
            width: `${transition.width}px`,
            height: `${transition.height}px`,
            opacity: 0.96,
            borderRadius: '8px',
          },
          {
            left: '0px',
            top: '0px',
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
            opacity: 1,
            borderRadius: '12px',
          },
        ],
        { duration, easing, fill: 'forwards' },
      );

      overlayExpand.addEventListener('finish', () => {
        const reveal = nextSvg.animate(
          [
            { opacity: 0, transform: 'scale(1.01)' },
            { opacity: 1, transform: 'scale(1)' },
          ],
          { duration: 140, easing: 'ease-out', fill: 'forwards' },
        );

        overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-out', fill: 'forwards' });

        reveal.addEventListener('finish', () => {
          overlay.remove();
          previousSvg.remove();
          nextSvg.style.zIndex = '';
          nextSvg.style.opacity = '';
          nextSvg.style.transform = '';
        });
      });

      return;
    }

    if (direction === 'out' && transition?.targetId) {
      const targetRect = nextSvg.querySelector(`[data-node-id="${transition.targetId}"] rect`);
      if (targetRect) {
        const targetBounds = targetRect.getBoundingClientRect();
        const canvasBounds = canvas.getBoundingClientRect();
        const overlay = document.createElement('div');
        overlay.className = 'tm-zoom-overlay';
        overlay.style.background = targetRect.getAttribute('fill') || transition.fill || '#dbeafe';
        overlay.style.left = '0px';
        overlay.style.top = '0px';
        overlay.style.width = `${canvas.clientWidth}px`;
        overlay.style.height = `${canvas.clientHeight}px`;
        canvas.append(overlay);

        nextSvg.style.opacity = '0';
        previousSvg.style.zIndex = '0';
        nextSvg.style.zIndex = '1';

        const duration = 240;
        const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
        const left = targetBounds.left - canvasBounds.left;
        const top = targetBounds.top - canvasBounds.top;
        const width = targetBounds.width;
        const height = targetBounds.height;

        previousSvg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'ease-out', fill: 'forwards' });

        const reveal = nextSvg.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 140,
          delay: 90,
          easing: 'ease-out',
          fill: 'forwards',
        });

        const overlayShrink = overlay.animate(
          [
            {
              left: '0px',
              top: '0px',
              width: `${canvas.clientWidth}px`,
              height: `${canvas.clientHeight}px`,
              opacity: 1,
              borderRadius: '12px',
            },
            {
              left: `${left}px`,
              top: `${top}px`,
              width: `${width}px`,
              height: `${height}px`,
              opacity: 0.96,
              borderRadius: '8px',
            },
          ],
          { duration, easing, fill: 'forwards' },
        );

        overlayShrink.addEventListener('finish', () => {
          overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 110, easing: 'ease-out', fill: 'forwards' });
          void reveal.finished.then(() => {
            overlay.remove();
            previousSvg.remove();
            nextSvg.style.zIndex = '';
            nextSvg.style.opacity = '';
            nextSvg.style.transform = '';
          });
        });

        return;
      }
    }

    const enterFrom = -24;
    const exitTo = 24;
    const duration = 180;
    const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';

    previousSvg.animate(
      [
        { opacity: 1, transform: 'translateX(0px) scale(1)' },
        { opacity: 0, transform: `translateX(${exitTo}px) scale(0.985)` },
      ],
      { duration, easing, fill: 'forwards' },
    );

    const enterAnimation = nextSvg.animate(
      [
        { opacity: 0, transform: `translateX(${enterFrom}px) scale(0.985)` },
        { opacity: 1, transform: 'translateX(0px) scale(1)' },
      ],
      { duration, easing, fill: 'forwards' },
    );

    enterAnimation.addEventListener('finish', () => {
      previousSvg.remove();
      nextSvg.style.zIndex = '';
      nextSvg.style.opacity = '';
      nextSvg.style.transform = '';
    });
  };

  const render = (direction = 'none', transition = null) => {
    hideTooltip();
    const currentNode = nodeByPath(tree, path);
    const nodes = (currentNode.children || []).filter((node) => (node.value || 0) > 0);

    actions.replaceChildren();
    const trail = ['Resumen'];
    let trailNode = tree;
    path.forEach((id) => {
      trailNode = trailNode?.children?.find((child) => child.id === id) || trailNode;
      if (trailNode?.label) trail.push(trailNode.label);
    });
    breadcrumb.textContent = trail.join(' / ');
    summary.innerHTML = `<strong>${esc(currentNode.label)}</strong> · ${esc(money(currentNode.value || 0))}`;
    note.textContent =
      path.length === 0
        ? 'Haz click en una categoría para ver su desglose.'
        : `Detalle dentro de ${currentNode.label}.`;

    if (path.length) {
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'tm-back';
      back.textContent = path.length === 1 ? 'Volver al resumen' : 'Volver';
      back.addEventListener('click', () => {
        const parentPath = path.slice(0, -1);
        const parentNode = nodeByPath(tree, parentPath);
        const parentChildren = (parentNode?.children || []).filter((node) => (node.value || 0) > 0);
        const transition = {
          targetId: currentNode.id,
          fill: colorForNode(currentNode, parentNode, colors, parentChildren),
        };
        path = parentPath;
        render('out', transition);
      });
      actions.append(back);
    }

    if (!nodes.length) {
      canvas.replaceChildren();
      return;
    }

    const hierarchyRoot = d3
      .hierarchy({ children: nodes })
      .sum((node) => node.value || 0)
      .sort((a, b) => d3.descending(a.value, b.value));

    d3.treemap().size([WIDTH, HEIGHT]).paddingInner(PADDING).paddingOuter(PADDING)(hierarchyRoot);

    const svg = d3
      .create('svg')
      .attr('viewBox', [0, 0, WIDTH, HEIGHT])
      .attr('aria-label', currentNode.label)
      .style('display', 'block');

    const groups = svg
      .selectAll('g')
      .data(hierarchyRoot.children || [])
      .join('g')
      .attr('data-node-id', (leaf) => leaf.data.id)
      .attr('class', (leaf) => `tm-node${leaf.data.children?.length ? ' is-zoomable' : ''}`)
      .attr('transform', (leaf) => `translate(${leaf.x0},${leaf.y0})`);

    groups
      .append('rect')
      .attr('width', (leaf) => Math.max(0, leaf.x1 - leaf.x0))
      .attr('height', (leaf) => Math.max(0, leaf.y1 - leaf.y0))
      .attr('fill', (leaf) => colorForNode(leaf.data, currentNode, colors, nodes))
      .attr('rx', 8)
      .attr('ry', 8)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1);

    groups.append('title').text((leaf) => {
      const prefix = path.length ? `${currentNode.label} / ` : '';
      return `${prefix}${leaf.data.label}\n${money(leaf.data.value || 0)}${leaf.data.count ? `\n${int(leaf.data.count)} registros` : ''}`;
    });

    groups.each(function (leaf) {
      const group = d3.select(this);
      const width = Math.max(0, leaf.x1 - leaf.x0);
      const height = Math.max(0, leaf.y1 - leaf.y0);
      const fill = colorForNode(leaf.data, currentNode, colors, nodes);
      const labelColor = textColorFor(fill);
      const lines = labelLines(leaf.data, width, height, money);
      if (!lines.length) return;

      const text = group
        .append('text')
        .attr('x', 10)
        .attr('y', 18)
        .attr('fill', labelColor)
        .attr('font-size', 13)
        .attr('font-weight', 600)
        .attr('pointer-events', 'none');

      text
        .selectAll('tspan')
        .data(lines)
        .join('tspan')
        .attr('x', 10)
        .attr('dy', (_, lineIndex) => (lineIndex === 0 ? 0 : 17))
        .attr('font-weight', (_, lineIndex) => (lineIndex === 0 ? 600 : 500))
        .text((line) => line);
    });

    groups
      .on('mouseenter', function (event, leaf) {
        showTooltip(event, leaf.data, currentNode);
      })
      .on('mousemove', function (event, leaf) {
        showTooltip(event, leaf.data, currentNode);
      })
      .on('mouseleave', hideTooltip)
      .on('click', function (_, leaf) {
        if (!leaf.data.children?.length) return;
        const rect = this.querySelector('rect');
        const canvasBounds = canvas.getBoundingClientRect();
        const rectBounds = rect?.getBoundingClientRect();
        const transition = rectBounds
          ? {
              left: rectBounds.left - canvasBounds.left,
              top: rectBounds.top - canvasBounds.top,
              width: rectBounds.width,
              height: rectBounds.height,
              fill: colorForNode(leaf.data, currentNode, colors, nodes),
            }
          : null;
        path = [...path, leaf.data.id];
        render('in', transition);
      });

    animateSwap(svg.node(), direction, transition);
  };

  render();
  return wrap;
};
