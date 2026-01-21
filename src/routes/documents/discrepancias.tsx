import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import documentsIndex from '../../data/documents-index.json';

type CandidateMetadata = {
  id: string;
  candidateName: string;
  documentId: string;
  position: string;
  party: string;
  province: string | null;
  district: string | null;
  township: string | null;
  status: string;
  isProclaimed: boolean;
  dateSent: string | null;
  totalIngress: number;
  totalEgress: number;
  pdfUrl: string | null;
};

function normalizeForComparison(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ÃÂ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function findCandidateByFilename(filename: string): CandidateMetadata | null {
  const normalizedFilename = normalizeForComparison(filename);

  for (const candidate of documentsIndex as CandidateMetadata[]) {
    if (!candidate.pdfUrl) continue;

    let pdfFilename = candidate.pdfUrl.split('/').pop() || '';
    try {
      pdfFilename = decodeURIComponent(decodeURIComponent(pdfFilename));
    } catch {
      try {
        pdfFilename = decodeURIComponent(pdfFilename);
      } catch {
        // Use as-is if decoding fails
      }
    }

    if (normalizeForComparison(pdfFilename) === normalizedFilename) {
      return candidate;
    }
  }
  return null;
}

export const Route = createFileRoute('/documents/discrepancias')({
  component: DiscrepanciasPage,
});

function DiscrepanciasPage() {
  const discrepancies = useQuery(api.documents.getDocumentsWithDiscrepancies);

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return '—';
    return `$${value.toLocaleString('es-PA', { minimumFractionDigits: 2 })}`;
  };

  const formatDiscrepancy = (value: number | null | undefined) => {
    if (value == null) return '—';
    const formatted = formatCurrency(Math.abs(value));
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted.slice(1)}`;
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
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Discrepancias entre Resumen y Filas
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Comparación entre los totales del resumen y la suma de filas individuales. Ordenado por mayor discrepancia.
        </p>
      </div>

      <div className="overflow-auto max-h-[calc(100vh-12rem)]">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Documento</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Fuente</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Resumen Ingresos</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">− Saldo Ant.</th>
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
                    <Link
                      to="/documents/$documentId"
                      params={{ documentId: doc._id }}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                    >
                      {candidate?.candidateName || doc.name}
                    </Link>
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
                  <td className="px-4 py-3 text-right font-mono text-slate-500 dark:text-slate-400">
                    {doc.saldoAnterior ? `−${formatCurrency(doc.saldoAnterior).slice(1)}` : '—'}
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
