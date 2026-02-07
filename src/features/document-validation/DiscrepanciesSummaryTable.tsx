import type { EgressRow, IngressRow } from './types';

type Props = {
  summaryExtraction: any;
  rowDataSource: string | null;
  ingressRows: IngressRow[];
  egressRows: EgressRow[];
};

function formatCurrency(value: number | null | undefined) {
  if (value == null) return '—';
  return `$${value.toLocaleString('es-PA', { minimumFractionDigits: 2 })}`;
}

function formatDiscrepancy(value: number | null | undefined) {
  if (value == null) return '—';
  const formatted = formatCurrency(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted.slice(1)}`;
  return formatted;
}

function getDiscrepancyColor(value: number | null | undefined) {
  const absValue = Math.abs(value ?? 0);
  if (absValue < 10) return 'text-green-600 dark:text-green-400';
  if (value == null || value === 0) return 'text-slate-500 dark:text-slate-400';
  if (absValue > 1000) return 'text-red-600 dark:text-red-400 font-semibold';
  if (absValue > 100) return 'text-amber-600 dark:text-amber-400';
  return 'text-slate-600 dark:text-slate-300';
}

function sumIngressTotals(rows: IngressRow[]) {
  return rows.reduce((sum, row) => sum + (row.total ?? 0), 0);
}

function sumEgressTotals(rows: EgressRow[]) {
  return rows.reduce((sum, row) => sum + (row.totalDeGastosDePropagandaYCampania ?? 0), 0);
}

function sumIngressByCategory(rows: IngressRow[]) {
  return rows.reduce((sum, row) => {
    const rowCategorySum =
      (row.donacionesPrivadasEfectivo ?? 0) +
      (row.donacionesPrivadasChequeAch ?? 0) +
      (row.donacionesPrivadasEspecie ?? 0) +
      (row.recursosPropiosEfectivoCheque ?? 0) +
      (row.recursosPropiosEspecie ?? 0);
    return sum + rowCategorySum;
  }, 0);
}

function sumEgressByCategory(rows: EgressRow[]) {
  return rows.reduce((sum, row) => {
    let rowCategorySum =
      (row.movilizacion ?? 0) +
      (row.combustible ?? 0) +
      (row.hospedaje ?? 0) +
      (row.activistas ?? 0) +
      (row.caravanaConcentraciones ?? 0) +
      (row.comidaBrindis ?? 0) +
      (row.alquilerLocalServiciosBasicos ?? 0) +
      (row.cargosBancarios ?? 0) +
      (row.personalizacionArticulosPromocionales ?? 0) +
      (row.propagandaElectoral ?? 0);

    // Some templates only carry totals for Campania/Propaganda.
    if (rowCategorySum === 0) rowCategorySum = (row.totalGastosCampania ?? 0) + (row.totalGastosPropaganda ?? 0);

    return sum + rowCategorySum;
  }, 0);
}

export function DiscrepanciesSummaryTable({ summaryExtraction, rowDataSource, ingressRows, egressRows }: Props) {
  if (summaryExtraction === undefined) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Cargando resumen...</div>;
  }

  if (summaryExtraction === null) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400">
        No hay datos de resumen para comparar (aún).
      </div>
    );
  }

  const summary = summaryExtraction?.summary ?? null;

  const summaryTotalIngresos: number | null = summary?.totalIngresos ?? null;
  const summaryTotalGastos: number | null = summary?.totalGastos ?? null;
  const saldoAnterior: number = summary?.saldoPrimariasRecoleccionFirmas ?? 0;
  const adjustedSummaryIngresos: number | null =
    summaryTotalIngresos != null ? summaryTotalIngresos - saldoAnterior : null;

  const summedIngresos = sumIngressTotals(ingressRows);
  const summedGastos = sumEgressTotals(egressRows);
  const summedIngresosByCategory = sumIngressByCategory(ingressRows);
  const summedGastosByCategory = sumEgressByCategory(egressRows);

  const ingressDiscrepancy: number | null = adjustedSummaryIngresos != null ? adjustedSummaryIngresos - summedIngresos : null;
  const egressDiscrepancy: number | null = summaryTotalGastos != null ? summaryTotalGastos - summedGastos : null;
  const ingressDiscrepancyByCategory: number | null =
    adjustedSummaryIngresos != null ? adjustedSummaryIngresos - summedIngresosByCategory : null;
  const egressDiscrepancyByCategory: number | null =
    summaryTotalGastos != null ? summaryTotalGastos - summedGastosByCategory : null;

  const sourceLabel =
    rowDataSource === 'validated' ? 'Validado' : rowDataSource?.startsWith('gemini-3') ? 'Gemini 3' : '—';

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-slate-800 dark:text-slate-200">Discrepancias</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-3">
          <span>
            Fuente filas: <span className="font-medium text-slate-700 dark:text-slate-300">{sourceLabel}</span>
          </span>
          <span>
            {ingressRows.length} ingresos, {egressRows.length} egresos
          </span>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Métrica</th>
              <th className="px-4 py-2 text-right font-medium text-slate-600 dark:text-slate-300">Ingresos</th>
              <th className="px-4 py-2 text-right font-medium text-slate-600 dark:text-slate-300">Gastos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            <tr>
              <td className="px-4 py-2 text-slate-700 dark:text-slate-300">Resumen</td>
              <td className="px-4 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                {formatCurrency(summaryTotalIngresos)}
              </td>
              <td className="px-4 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                {formatCurrency(summaryTotalGastos)}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-slate-700 dark:text-slate-300">Saldo anterior (primarias/firmas)</td>
              <td className="px-4 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                {formatCurrency(saldoAnterior)}
              </td>
              <td className="px-4 py-2 text-right font-mono text-slate-400 dark:text-slate-500">—</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-slate-700 dark:text-slate-300">Resumen ingresos (ajustado)</td>
              <td className="px-4 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                {formatCurrency(adjustedSummaryIngresos)}
              </td>
              <td className="px-4 py-2 text-right font-mono text-slate-400 dark:text-slate-500">—</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-slate-700 dark:text-slate-300">Σ Totales (filas)</td>
              <td className="px-4 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                {formatCurrency(summedIngresos)}
              </td>
              <td className="px-4 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                {formatCurrency(summedGastos)}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-slate-700 dark:text-slate-300">Δ Totales</td>
              <td className={`px-4 py-2 text-right font-mono ${getDiscrepancyColor(ingressDiscrepancy)}`}>
                {formatDiscrepancy(ingressDiscrepancy)}
              </td>
              <td className={`px-4 py-2 text-right font-mono ${getDiscrepancyColor(egressDiscrepancy)}`}>
                {formatDiscrepancy(egressDiscrepancy)}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-slate-700 dark:text-slate-300">Σ Categorías</td>
              <td className="px-4 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                {formatCurrency(summedIngresosByCategory)}
              </td>
              <td className="px-4 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                {formatCurrency(summedGastosByCategory)}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-slate-700 dark:text-slate-300">Δ Categorías</td>
              <td className={`px-4 py-2 text-right font-mono ${getDiscrepancyColor(ingressDiscrepancyByCategory)}`}>
                {formatDiscrepancy(ingressDiscrepancyByCategory)}
              </td>
              <td className={`px-4 py-2 text-right font-mono ${getDiscrepancyColor(egressDiscrepancyByCategory)}`}>
                {formatDiscrepancy(egressDiscrepancyByCategory)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

