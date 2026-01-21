import { Button } from '@/components/ui/button';
import { EgressTable } from './EgressTable';
import { IngressTable } from './IngressTable';
import type { EgressRow, IngressRow, ModelExtractions } from './types';

type Props = {
  currentPage: number;
  hasIngressOnPage: boolean;
  hasEgressOnPage: boolean;
  pagesWithDiffs: number[];
  pagesWithUnreadables: number[];
  goToPage: (pageNumber: number) => void;
  ingressRows: IngressRow[];
  egressRows: EgressRow[];
  allIngressRows: IngressRow[];
  allEgressRows: EgressRow[];
  ingressDiffs: Map<string, Set<string>>;
  egressDiffs: Map<string, Set<string>>;
  modelData: ModelExtractions;
  modelNames: string[];
  getIngressModelsForRow: (rowKey: string) => string[];
  getEgressModelsForRow: (rowKey: string) => string[];
  onEditIngress: (rowIndex: number, field: string, value: string | number | null) => void;
  onEditEgress: (rowIndex: number, field: string, value: string | number | null) => void;
  onDeleteIngress: (rowIndex: number) => void;
  onDeleteEgress: (rowIndex: number) => void;
  onToggleUnreadableIngress: (rowIndex: number, field: string) => void;
  onToggleUnreadableEgress: (rowIndex: number, field: string) => void;
  onAddIngress: () => void;
  onAddEgress: () => void;
};

export function DataPanel({
  currentPage,
  hasIngressOnPage,
  hasEgressOnPage,
  pagesWithDiffs,
  pagesWithUnreadables,
  goToPage,
  ingressRows,
  egressRows,
  allIngressRows,
  allEgressRows,
  ingressDiffs,
  egressDiffs,
  modelData,
  modelNames,
  getIngressModelsForRow,
  getEgressModelsForRow,
  onEditIngress,
  onEditEgress,
  onDeleteIngress,
  onDeleteEgress,
  onToggleUnreadableIngress,
  onToggleUnreadableEgress,
  onAddIngress,
  onAddEgress,
}: Props) {
  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Tabla de Datos
          {hasIngressOnPage && hasEgressOnPage && (
            <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">(Ingresos y Gastos)</span>
          )}
          {hasIngressOnPage && !hasEgressOnPage && <span className="ml-2 text-xs text-slate-500">— Ingresos</span>}
          {!hasIngressOnPage && hasEgressOnPage && <span className="ml-2 text-xs text-slate-500">— Gastos</span>}
        </h2>
      </div>

      {pagesWithDiffs.length > 0 && (
        <div className="px-2 py-1 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-center gap-1 overflow-x-auto">
          <span className="text-xs text-amber-700 dark:text-amber-400 whitespace-nowrap">Ir a diferencia:</span>
          {pagesWithDiffs.slice(0, 15).map((pageNum) => (
            <Button
              key={pageNum}
              onClick={() => goToPage(pageNum)}
              variant={pageNum === currentPage ? 'default' : 'outline'}
              size="sm"
              className={`text-xs h-6 px-2 ${
                pageNum === currentPage
                  ? 'bg-amber-400 dark:bg-amber-600 text-amber-900 dark:text-amber-100 hover:bg-amber-500'
                  : 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-300'
              }`}
            >
              {pageNum}
            </Button>
          ))}
          {pagesWithDiffs.length > 15 && (
            <span className="text-xs text-amber-600">+{pagesWithDiffs.length - 15} más</span>
          )}
        </div>
      )}

      {pagesWithUnreadables.length > 0 && (
        <div className="px-2 py-1 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800 flex items-center gap-1 overflow-x-auto">
          <span className="text-xs text-orange-700 dark:text-orange-400 whitespace-nowrap">IA detectó ilegible:</span>
          {pagesWithUnreadables.slice(0, 15).map((pageNum) => (
            <Button
              key={pageNum}
              onClick={() => goToPage(pageNum)}
              variant={pageNum === currentPage ? 'default' : 'outline'}
              size="sm"
              className={`text-xs h-6 px-2 ${
                pageNum === currentPage
                  ? 'bg-orange-400 dark:bg-orange-600 text-orange-900 dark:text-orange-100 hover:bg-orange-500'
                  : 'bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 hover:bg-orange-300'
              }`}
            >
              {pageNum}
            </Button>
          ))}
          {pagesWithUnreadables.length > 15 && (
            <span className="text-xs text-orange-600">+{pagesWithUnreadables.length - 15} más</span>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {ingressRows.length === 0 && egressRows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            No hay datos extraídos en esta página
          </div>
        ) : (
          <div className="space-y-4">
            {ingressRows.length > 0 && (
              <div>
                {egressRows.length > 0 && (
                  <div className="px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800">
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Ingresos</span>
                  </div>
                )}
                <IngressTable
                  rows={ingressRows}
                  allRows={allIngressRows}
                  diffs={ingressDiffs}
                  modelData={modelData}
                  modelNames={modelNames}
                  getModelsForRow={getIngressModelsForRow}
                  onEdit={onEditIngress}
                  onDelete={onDeleteIngress}
                  onToggleUnreadable={onToggleUnreadableIngress}
                />
              </div>
            )}

            {egressRows.length > 0 && (
              <div>
                {ingressRows.length > 0 && (
                  <div className="px-2 py-1 bg-rose-50 dark:bg-rose-900/20 border-b border-rose-200 dark:border-rose-800">
                    <span className="text-xs font-medium text-rose-700 dark:text-rose-400">Gastos</span>
                  </div>
                )}
                <EgressTable
                  rows={egressRows}
                  allRows={allEgressRows}
                  diffs={egressDiffs}
                  modelData={modelData}
                  modelNames={modelNames}
                  getModelsForRow={getEgressModelsForRow}
                  onEdit={onEditEgress}
                  onDelete={onDeleteEgress}
                  onToggleUnreadable={onToggleUnreadableEgress}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-2 py-1 border-t border-slate-200 dark:border-slate-700 flex gap-2">
        {(hasIngressOnPage || (!hasIngressOnPage && !hasEgressOnPage)) && (
          <Button onClick={onAddIngress} variant="outline" size="sm" className="flex-1 border-dashed">
            + Agregar ingreso
          </Button>
        )}
        {(hasEgressOnPage || (!hasIngressOnPage && !hasEgressOnPage)) && (
          <Button onClick={onAddEgress} variant="outline" size="sm" className="flex-1 border-dashed">
            + Agregar gasto
          </Button>
        )}
      </div>
    </div>
  );
}
