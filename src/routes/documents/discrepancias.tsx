import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatPanamaCurrency } from '@/lib/currency';
import { findCandidateByFilename } from '../../lib/csvExportSupport';

function DiscrepancyWarning({ note }: { note: string | null }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0 cursor-help">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5 text-amber-500"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="w-64 bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100">
        <div className="font-semibold mb-1">⚠ Discrepancia marcada manualmente</div>
        {note ? <div className="whitespace-pre-wrap">{note}</div> : <div className="italic text-amber-600 dark:text-amber-400">Sin nota adicional</div>}
      </TooltipContent>
    </Tooltip>
  );
}

export const Route = createFileRoute('/documents/discrepancias')({
  component: DiscrepanciasPage,
});

function DiscrepanciasPage() {
  const discrepancies = useQuery(api.documents.getDocumentsWithDiscrepancies);

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return '—';
    return formatPanamaCurrency(value);
  };

  const formatDiscrepancy = (value: number | null | undefined) => {
    if (value == null) return '—';
    const formatted = formatCurrency(Math.abs(value));
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted}`;
    return formatted;
  };

  const getDiscrepancyColor = (value: number | null | undefined) => {
    const absValue = Math.abs(value ?? 0);
    if (absValue < 10) return 'text-green-600 dark:text-green-400';
    if (value == null || value === 0) return 'text-slate-500';
    if (absValue > 1000) return 'text-red-600 dark:text-red-400 font-semibold';
    if (absValue > 100) return 'text-amber-600 dark:text-amber-400';
    return 'text-slate-600 dark:text-slate-400';
  };

  const total = discrepancies?.length ?? 0;
  const withLargeDiscrepancy =
    discrepancies?.filter(
      (d) => Math.abs(d.ingressDiscrepancyByCategory ?? 0) > 1000 || Math.abs(d.egressDiscrepancyByCategory ?? 0) > 1000,
    ).length ?? 0;
  const flagged =
    discrepancies?.filter(
      (d) =>
        d.structuredNotes?.flags?.largeTotalsDiscrepancy &&
        (Math.abs(d.ingressDiscrepancyByCategory ?? 0) > 1000 ||
          Math.abs(d.egressDiscrepancyByCategory ?? 0) > 1000),
    ).length ?? 0;
  const unflagged = withLargeDiscrepancy - flagged;

  if (discrepancies === undefined) {
    return <div className="p-8 text-center text-slate-500">Cargando discrepancias...</div>;
  }

  if (discrepancies.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-8 text-center text-slate-500">
        No hay documentos con datos de resumen para comparar.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Discrepancias entre Resumen y Filas
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Comparación entre los totales del resumen y la suma de filas individuales. Ordenado por mayor discrepancia.
        </p>
        <div className="mt-2 flex items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-red-100 dark:bg-red-900/40 px-2.5 py-1 font-medium text-red-700 dark:text-red-300">
            {withLargeDiscrepancy} con discrepancia {'>'} {formatPanamaCurrency(1000, 0)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 font-medium text-amber-700 dark:text-amber-300">
            {unflagged} sin marcar
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 dark:bg-slate-700 px-2.5 py-1 font-medium text-slate-600 dark:text-slate-300">
            {total} documentos total
          </span>
        </div>
      </div>

      <div className="overflow-auto max-h-[calc(100vh-12rem)]">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Documento</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Fuente</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Resumen Ingresos (− saldo ant.)</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Σ Totales</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Δ Totales</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Σ Categorías</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Δ Categorías</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Resumen Gastos</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Σ Totales</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Δ Totales</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Σ Categorías</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Δ Categorías</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {discrepancies.map((doc) => {
              const candidate = findCandidateByFilename(doc.name);
              return (
                <tr key={doc._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link
                        to="/documents/$documentId"
                        params={{ documentId: doc._id }}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                      >
                        {candidate?.candidateName || doc.name}
                      </Link>
                      {doc.structuredNotes?.flags?.largeTotalsDiscrepancy && (
                        <DiscrepancyWarning note={doc.structuredNotes.note ?? null} />
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {doc.ingressRowCount} ingresos, {doc.egressRowCount} egresos
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        doc.dataSource === 'validated'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      }`}
                    >
                      {doc.dataSource === 'validated' ? 'Validado' : 'Gemini 3'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                    {formatCurrency(doc.summaryTotalIngresos)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                    {formatCurrency(doc.summedIngresos)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${getDiscrepancyColor(doc.ingressDiscrepancy)}`}>
                    {formatDiscrepancy(doc.ingressDiscrepancy)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                    {formatCurrency(doc.summedIngresosByCategory)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${getDiscrepancyColor(doc.ingressDiscrepancyByCategory)}`}
                  >
                    {formatDiscrepancy(doc.ingressDiscrepancyByCategory)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                    {formatCurrency(doc.summaryTotalGastos)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                    {formatCurrency(doc.summedGastos)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${getDiscrepancyColor(doc.egressDiscrepancy)}`}>
                    {formatDiscrepancy(doc.egressDiscrepancy)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                    {formatCurrency(doc.summedGastosByCategory)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${getDiscrepancyColor(doc.egressDiscrepancyByCategory)}`}
                  >
                    {formatDiscrepancy(doc.egressDiscrepancyByCategory)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
