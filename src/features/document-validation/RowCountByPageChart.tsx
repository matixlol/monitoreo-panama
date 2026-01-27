import { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import type { IngressRow, EgressRow } from './types';

type Props = {
  ingressRows: IngressRow[];
  egressRows: EgressRow[];
  onPageClick: (pageNumber: number) => void;
  currentPage: number;
};

type PageData = {
  page: number;
  count: number;
  type: 'ingress' | 'egress' | 'mixed';
};

export function RowCountByPageChart({ ingressRows, egressRows, onPageClick, currentPage }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const pageData = useMemo(() => {
    const pageCounts = new Map<number, { ingress: number; egress: number }>();

    for (const row of ingressRows) {
      const page = row.pageNumber;
      const existing = pageCounts.get(page) || { ingress: 0, egress: 0 };
      existing.ingress += 1;
      pageCounts.set(page, existing);
    }

    for (const row of egressRows) {
      const page = row.pageNumber;
      const existing = pageCounts.get(page) || { ingress: 0, egress: 0 };
      existing.egress += 1;
      pageCounts.set(page, existing);
    }

    const data: PageData[] = [];
    for (const [page, counts] of pageCounts) {
      const hasIngress = counts.ingress > 0;
      const hasEgress = counts.egress > 0;
      let type: PageData['type'] = 'mixed';
      if (hasIngress && !hasEgress) type = 'ingress';
      else if (!hasIngress && hasEgress) type = 'egress';

      data.push({
        page,
        count: counts.ingress + counts.egress,
        type,
      });
    }

    return data.sort((a, b) => a.page - b.page);
  }, [ingressRows, egressRows]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || pageData.length === 0) return;

    const container = containerRef.current;
    const svg = d3.select(svgRef.current);

    const margin = { top: 20, right: 20, bottom: 60, left: 60 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom;

    svg.selectAll('*').remove();

    svg.attr('width', container.clientWidth).attr('height', container.clientHeight);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand<number>()
      .domain(pageData.map((d) => d.page))
      .range([0, width])
      .padding(0.2);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(pageData, (d) => d.count) || 0])
      .nice()
      .range([height, 0]);

    const xAxis = g.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x).tickFormat((d) => `P${d}`));

    xAxis
      .selectAll('text')
      .attr('class', 'text-xs fill-slate-500 dark:fill-slate-400 cursor-pointer hover:fill-blue-600')
      .attr('transform', 'rotate(-45)')
      .attr('text-anchor', 'end')
      .attr('dx', '-0.5em')
      .attr('dy', '0.15em')
      .style('cursor', 'pointer')
      .on('click', (_, d) => onPageClick(d as number));

    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat((d) => d3.format('d')(d)))
      .selectAll('text')
      .attr('class', 'text-xs fill-slate-500 dark:fill-slate-400');

    const colorScale = (type: PageData['type'], isActive: boolean) => {
      if (isActive) {
        return type === 'ingress' ? '#059669' : type === 'egress' ? '#dc2626' : '#2563eb';
      }
      return type === 'ingress' ? '#6ee7b7' : type === 'egress' ? '#fca5a5' : '#93c5fd';
    };

    g.selectAll('.bar')
      .data(pageData)
      .join('rect')
      .attr('class', 'bar cursor-pointer transition-all hover:opacity-80')
      .attr('x', (d) => x(d.page) ?? 0)
      .attr('y', (d) => y(d.count))
      .attr('width', x.bandwidth())
      .attr('height', (d) => height - y(d.count))
      .attr('fill', (d) => colorScale(d.type, d.page === currentPage))
      .attr('stroke', (d) => (d.page === currentPage ? '#1e40af' : 'transparent'))
      .attr('stroke-width', (d) => (d.page === currentPage ? 2 : 0))
      .attr('rx', 2)
      .on('click', (_, d) => onPageClick(d.page));

    g.selectAll('.label')
      .data(pageData)
      .join('text')
      .attr('class', 'text-[10px] fill-slate-600 dark:fill-slate-300 pointer-events-none')
      .attr('x', (d) => (x(d.page) ?? 0) + x.bandwidth() / 2)
      .attr('y', (d) => y(d.count) - 4)
      .attr('text-anchor', 'middle')
      .text((d) => d.count);
  }, [pageData, currentPage, onPageClick]);

  if (pageData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-sm">
        No hay datos para graficar
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full p-4 h-72">
      <svg ref={svgRef} className="w-full h-full" />
      <div className="flex justify-center gap-4 mt-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-emerald-300" />
          <span className="text-slate-600 dark:text-slate-400">Ingresos</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-300" />
          <span className="text-slate-600 dark:text-slate-400">Gastos</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-300" />
          <span className="text-slate-600 dark:text-slate-400">Ambos</span>
        </div>
      </div>
    </div>
  );
}
