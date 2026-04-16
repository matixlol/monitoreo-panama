import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { formatPanamaCurrency } from '@/lib/currency';
import type { EgressRow, IngressRow } from './types';

type Props = {
  ingressRows: IngressRow[];
  egressRows: EgressRow[];
};

type WeekData = {
  key: string;
  label: string;
  amount: number;
  type: 'ingress' | 'egress' | 'mixed';
  sortKey: number;
};

type ParsedDate = {
  year: number;
  month: number;
  day: number;
};

const monthFormatter = new Intl.DateTimeFormat('es-PA', {
  month: 'short',
  timeZone: 'UTC',
});

function formatCurrencyFull(value: number): string {
  return formatPanamaCurrency(value, 0);
}

function parseDocumentDate(value: string | null | undefined): ParsedDate | null {
  if (!value) return null;
  const normalized = value.trim().replace(/\./g, '/').replace(/-/g, '/');
  if (!normalized) return null;

  let parts: ParsedDate | null = null;

  const isoMatch = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (isoMatch) {
    parts = {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
    };
  }

  const dmyMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!parts && dmyMatch) {
    parts = {
      year: Number(dmyMatch[3]),
      month: Number(dmyMatch[2]),
      day: Number(dmyMatch[1]),
    };
  }

  if (!parts) return null;

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() !== parts.month - 1 ||
    date.getUTCDate() !== parts.day
  ) {
    return null;
  }

  return parts;
}

function weekOfMonth(day: number): number {
  return Math.floor((day - 1) / 7) + 1;
}

export function AmountByWeekChart({ ingressRows, egressRows }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const weekData = useMemo(() => {
    const weekAmounts = new Map<string, { ingress: number; egress: number; sortKey: number; label: string }>();

    for (const row of ingressRows) {
      const parsed = parseDocumentDate(row.fecha);
      if (!parsed) continue;
      const week = weekOfMonth(parsed.day);
      const key = `${parsed.year}-${String(parsed.month).padStart(2, '0')}-W${week}`;
      const sortKey = parsed.year * 1000 + parsed.month * 10 + week;
      const monthLabel = monthFormatter.format(new Date(Date.UTC(parsed.year, parsed.month - 1, 1)));
      const existing = weekAmounts.get(key) ?? {
        ingress: 0,
        egress: 0,
        sortKey,
        label: `${monthLabel}/${week}`,
      };
      existing.ingress += row.total ?? 0;
      weekAmounts.set(key, existing);
    }

    for (const row of egressRows) {
      const parsed = parseDocumentDate(row.fecha);
      if (!parsed) continue;
      const week = weekOfMonth(parsed.day);
      const key = `${parsed.year}-${String(parsed.month).padStart(2, '0')}-W${week}`;
      const sortKey = parsed.year * 1000 + parsed.month * 10 + week;
      const monthLabel = monthFormatter.format(new Date(Date.UTC(parsed.year, parsed.month - 1, 1)));
      const existing = weekAmounts.get(key) ?? {
        ingress: 0,
        egress: 0,
        sortKey,
        label: `${monthLabel}/${week}`,
      };
      existing.egress += row.totalDeGastosDePropagandaYCampania ?? 0;
      weekAmounts.set(key, existing);
    }

    return [...weekAmounts.entries()]
      .map(([key, amounts]) => {
        const hasIngress = amounts.ingress > 0;
        const hasEgress = amounts.egress > 0;
        let type: WeekData['type'] = 'mixed';
        if (hasIngress && !hasEgress) type = 'ingress';
        else if (!hasIngress && hasEgress) type = 'egress';

        return {
          key,
          label: amounts.label,
          amount: amounts.ingress + amounts.egress,
          type,
          sortKey: amounts.sortKey,
        } satisfies WeekData;
      })
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [egressRows, ingressRows]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || weekData.length === 0) return;

    const container = containerRef.current;
    const svg = d3.select(svgRef.current);

    const margin = { top: 20, right: 20, bottom: 90, left: 80 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom;

    svg.selectAll('*').remove();
    svg.attr('width', container.clientWidth).attr('height', container.clientHeight);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand<string>()
      .domain(weekData.map((d) => d.key))
      .range([0, width])
      .padding(0.2);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(weekData, (d) => d.amount) || 0])
      .nice()
      .range([height, 0]);

    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat((key) => weekData.find((d) => d.key === key)?.label ?? ''));

    xAxis
      .selectAll('text')
      .attr('class', 'text-xs fill-slate-500 dark:fill-slate-400')
      .attr('transform', 'rotate(-45)')
      .attr('text-anchor', 'end')
      .attr('dx', '-0.5em')
      .attr('dy', '0.15em');

    g.append('g')
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((d) => formatCurrencyFull(Number(d)))
      )
      .selectAll('text')
      .attr('class', 'text-xs fill-slate-500 dark:fill-slate-400');

    const colorScale = (type: WeekData['type']) => {
      if (type === 'ingress') return '#6ee7b7';
      if (type === 'egress') return '#fca5a5';
      return '#93c5fd';
    };

    g.selectAll('.bar')
      .data(weekData)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', (d) => x(d.key) ?? 0)
      .attr('y', (d) => y(d.amount))
      .attr('width', x.bandwidth())
      .attr('height', (d) => height - y(d.amount))
      .attr('fill', (d) => colorScale(d.type))
      .attr('rx', 2);

    g.selectAll('.label')
      .data(weekData)
      .join('text')
      .attr('class', 'text-[10px] fill-slate-600 dark:fill-slate-300 pointer-events-none')
      .attr('x', (d) => (x(d.key) ?? 0) + x.bandwidth() / 2)
      .attr('y', (d) => y(d.amount) - 4)
      .attr('text-anchor', 'middle')
      .text((d) => formatCurrencyFull(d.amount));
  }, [weekData]);

  if (weekData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-sm">
        No hay fechas válidas para graficar por semana
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full p-4 h-80">
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
