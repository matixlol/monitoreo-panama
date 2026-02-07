import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EgressTable } from './EgressTable';
import { IngressTable } from './IngressTable';
import { AmountByPageChart } from './AmountByPageChart';
import { RowCountByPageChart } from './RowCountByPageChart';
import type { EgressRow, IngressRow } from './types';

type Props = {
  currentPage: number;
  hasIngressOnPage: boolean;
  hasEgressOnPage: boolean;
  pagesWithUnreadables: number[];
  goToPage: (pageNumber: number) => void;
  ingressRows: IngressRow[];
  egressRows: EgressRow[];
  allIngressRows: IngressRow[];
  allEgressRows: EgressRow[];
  pageExtractionProposals: any;
  onApplyPageProposal: (proposalKey: string) => void;
  isApplyingProposal?: boolean;
  onEditIngress: (rowIndex: number, field: string, value: string | number | null) => void;
  onEditEgress: (rowIndex: number, field: string, value: string | number | null) => void;
  onDeleteIngress: (rowIndex: number) => void;
  onDeleteEgress: (rowIndex: number) => void;
  onToggleUnreadableIngress: (rowIndex: number, field: string) => void;
  onToggleUnreadableEgress: (rowIndex: number, field: string) => void;
  onAddIngress: () => void;
  onAddEgress: () => void;
  onAutoCalculateEgressTotals: () => void;
  isReExtracting?: boolean;
};

export function DataPanel({
  currentPage,
  hasIngressOnPage,
  hasEgressOnPage,
  pagesWithUnreadables,
  goToPage,
  ingressRows,
  egressRows,
  allIngressRows,
  allEgressRows,
  pageExtractionProposals,
  onApplyPageProposal,
  isApplyingProposal,
  onEditIngress,
  onEditEgress,
  onDeleteIngress,
  onDeleteEgress,
  onToggleUnreadableIngress,
  onToggleUnreadableEgress,
  onAddIngress,
  onAddEgress,
  onAutoCalculateEgressTotals,
  isReExtracting,
}: Props) {
  const [activeTab, setActiveTab] = useState('data');
  const [activeProposalTab, setActiveProposalTab] = useState<string>('');
  const [isProposalPanelOpen, setIsProposalPanelOpen] = useState(false);
  const prevIsReExtractingRef = useRef(false);

  const proposals = useMemo(
    () =>
      (pageExtractionProposals?.proposals ?? []) as Array<{
        key: string;
        model: string;
        run: number;
        ingress: IngressRow[];
        egress: EgressRow[];
        completedAt: number;
        errorMessage?: string;
      }>,
    [pageExtractionProposals],
  );

  const sortedProposals = useMemo(() => {
    const weight = (p: { model: string; run: number }) => {
      const modelWeight = p.model.includes('flash') ? 0 : 1;
      return modelWeight * 10 + p.run;
    };
    return [...proposals].sort((a, b) => weight(a) - weight(b));
  }, [proposals]);

  const hasProposals = sortedProposals.length > 0;
  const shouldShowProposalPanel = Boolean(isReExtracting) || hasProposals;

  const activeProposal = useMemo(() => {
    if (!hasProposals) return null;
    return sortedProposals.find((p) => p.key === activeProposalTab) ?? sortedProposals[0] ?? null;
  }, [activeProposalTab, hasProposals, sortedProposals]);

  const proposalTabsValue = activeProposal?.key ?? '';

  useEffect(() => {
    if (!hasProposals) {
      setActiveProposalTab('');
      return;
    }

    setActiveProposalTab((prev) => {
      if (!prev) return sortedProposals[0]!.key;
      if (sortedProposals.some((p) => p.key === prev)) return prev;
      return sortedProposals[0]!.key;
    });
  }, [hasProposals, sortedProposals]);

  useEffect(() => {
    if (isReExtracting) setIsProposalPanelOpen(true);
  }, [isReExtracting]);

  useEffect(() => {
    const prev = prevIsReExtractingRef.current;
    prevIsReExtractingRef.current = Boolean(isReExtracting);

    // Auto-open once a re-extraction run finishes and proposals exist.
    if (prev && !isReExtracting && hasProposals) setIsProposalPanelOpen(true);
  }, [hasProposals, isReExtracting]);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full bg-white dark:bg-slate-900">
      <TabsList>
        <TabsTrigger value="data">Datos</TabsTrigger>
        <TabsTrigger value="chart">Gráficos</TabsTrigger>
      </TabsList>

      <TabsContent value="data" className="flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Tabla de Datos
            {hasIngressOnPage && hasEgressOnPage && (
              <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">(Ingresos y Gastos)</span>
            )}
            {hasIngressOnPage && !hasEgressOnPage && <span className="ml-2 text-xs text-slate-500">— Ingresos</span>}
            {!hasIngressOnPage && hasEgressOnPage && <span className="ml-2 text-xs text-slate-500">— Gastos</span>}
            <Button
              onClick={onAutoCalculateEgressTotals}
              size="sm"
              className="h-5 text-[10px] ml-4"
              title="Calcular Total General = Tot. Campaña + Tot. Propaganda para filas sin total"
            >
              Σ Totales
            </Button>
          </h2>
        </div>

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
          {shouldShowProposalPanel && (
            <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <button
                type="button"
                className="w-full px-3 py-2 flex items-center justify-between text-left"
                onClick={() => setIsProposalPanelOpen((v) => !v)}
                title={isProposalPanelOpen ? 'Ocultar propuestas' : 'Mostrar propuestas'}
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 text-slate-500 transition-transform ${isProposalPanelOpen ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    Re-extracción {hasProposals ? `(${sortedProposals.length})` : ''}
                  </div>
                  {isReExtracting && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Generando...
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Página {currentPage}</div>
              </button>

              {isProposalPanelOpen && (
                <div className="px-3 pb-3">
                  {!hasProposals ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400">Aún no hay propuestas.</div>
                  ) : (
                    <Tabs value={proposalTabsValue} onValueChange={setActiveProposalTab} className="h-auto">
                      <TabsList className="px-0 w-full overflow-x-auto justify-start">
                        {sortedProposals.map((p) => {
                          const labelBase = p.model.includes('flash') ? 'Flash' : 'Pro';
                          const hasError = Boolean(p.errorMessage);
                          return (
                            <TabsTrigger key={p.key} value={p.key} className="px-3 py-2 text-xs">
                              {labelBase} {p.run}
                              {hasError && (
                                <span className="ml-2 text-[10px] text-red-600 dark:text-red-400">(Error)</span>
                              )}
                            </TabsTrigger>
                          );
                        })}
                      </TabsList>

                      <TabsContent value={proposalTabsValue} className="pt-2">
                        {activeProposal && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs text-slate-600 dark:text-slate-400">
                                {activeProposal.errorMessage ? (
                                  <span className="text-red-600 dark:text-red-400">{activeProposal.errorMessage}</span>
                                ) : (
                                  <>
                                    {activeProposal.ingress.length} ingresos, {activeProposal.egress.length} gastos
                                  </>
                                )}
                              </div>
                              <Button
                                onClick={() => onApplyPageProposal(activeProposal.key)}
                                disabled={
                                  Boolean(isReExtracting) || Boolean(activeProposal.errorMessage) || isApplyingProposal
                                }
                                size="sm"
                                variant="outline"
                                className="h-7"
                                title="Aplicar esta propuesta a los datos del documento (solo esta página)"
                              >
                                {isApplyingProposal ? 'Aplicando...' : 'Aplicar'}
                              </Button>
                            </div>

                            {!activeProposal.errorMessage &&
                              activeProposal.ingress.length === 0 &&
                              activeProposal.egress.length === 0 && (
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  Esta propuesta no contiene datos extraídos.
                                </div>
                              )}

                            {!activeProposal.errorMessage && (activeProposal.ingress.length > 0 || activeProposal.egress.length > 0) && (
                              <div className="max-h-[420px] overflow-auto rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                                {activeProposal.ingress.length > 0 && (
                                  <div className="border-b border-slate-200 dark:border-slate-700">
                                    <div className="px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800">
                                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                        Ingresos
                                      </span>
                                    </div>
                                    <IngressTable
                                      rows={activeProposal.ingress}
                                      allRows={activeProposal.ingress}
                                      onEdit={() => {}}
                                      onDelete={() => {}}
                                      onToggleUnreadable={() => {}}
                                      readOnly
                                    />
                                  </div>
                                )}

                                {activeProposal.egress.length > 0 && (
                                  <div>
                                    <div className="px-2 py-1 bg-rose-50 dark:bg-rose-900/20 border-b border-rose-200 dark:border-rose-800">
                                      <span className="text-xs font-medium text-rose-700 dark:text-rose-400">
                                        Gastos
                                      </span>
                                    </div>
                                    <EgressTable
                                      rows={activeProposal.egress}
                                      allRows={activeProposal.egress}
                                      onEdit={() => {}}
                                      onDelete={() => {}}
                                      onToggleUnreadable={() => {}}
                                      readOnly
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  )}
                </div>
              )}
            </div>
          )}

          {isReExtracting ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-sm text-slate-500">Re-extrayendo página...</span>
            </div>
          ) : ingressRows.length === 0 && egressRows.length === 0 ? (
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
                    onEdit={onEditIngress}
                    onDelete={onDeleteIngress}
                    onToggleUnreadable={onToggleUnreadableIngress}
                  />
                </div>
              )}

              {egressRows.length > 0 && (
                <div>
                  {ingressRows.length > 0 && (
                    <div className="px-2 py-1 bg-rose-50 dark:bg-rose-900/20 border-b border-rose-200 dark:border-rose-800 flex items-center justify-between">
                      <span className="text-xs font-medium text-rose-700 dark:text-rose-400">Gastos</span>
                    </div>
                  )}
                  <EgressTable
                    rows={egressRows}
                    allRows={allEgressRows}
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
      </TabsContent>

      <TabsContent value="chart" className="overflow-auto">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 px-4 pt-2">$ por Página</h3>
            <AmountByPageChart
              ingressRows={allIngressRows}
              egressRows={allEgressRows}
              onPageClick={goToPage}
              currentPage={currentPage}
            />
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 px-4"># Filas por Página</h3>
            <RowCountByPageChart
              ingressRows={allIngressRows}
              egressRows={allEgressRows}
              onPageClick={goToPage}
              currentPage={currentPage}
            />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
