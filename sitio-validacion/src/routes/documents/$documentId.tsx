import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useState, useCallback, useMemo, lazy, Suspense } from 'react';
import type { Id } from '../../../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

// Lazy load react-pdf components to avoid SSR issues
const PDFViewer = lazy(() =>
  import('react-pdf').then((mod) => {
    // Configure PDF.js worker
    mod.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${mod.pdfjs.version}/build/pdf.worker.min.mjs`;
    // Import styles
    import('react-pdf/dist/Page/AnnotationLayer.css');
    import('react-pdf/dist/Page/TextLayer.css');
    return {
      default: ({ fileUrl, currentPage, rotation }: { fileUrl: string; currentPage: number; rotation: number }) => (
        <mod.Document
          file={fileUrl}
          loading={<div className="flex items-center justify-center h-full text-slate-500">Cargando PDF...</div>}
          error={<div className="flex items-center justify-center h-full text-red-500">Error al cargar el PDF</div>}
        >
          <mod.Page
            pageNumber={currentPage}
            className="rounded-lg shadow-lg"
            renderTextLayer={true}
            renderAnnotationLayer={true}
            rotate={rotation}
            loading={<div className="flex items-center justify-center h-64 text-slate-500">Cargando página...</div>}
          />
        </mod.Document>
      ),
    };
  }),
);

export const Route = createFileRoute('/documents/$documentId')({
  component: DocumentValidationPage,
});

// Types
type IngressRow = {
  pageNumber: number;
  fecha?: string | null;
  reciboNumero: string;
  contribuyenteNombre?: string | null;
  representanteLegal?: string | null;
  cedulaRuc?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  correoElectronico?: string | null;
  donacionesPrivadasEfectivo?: number | null;
  donacionesPrivadasChequeAch?: number | null;
  donacionesPrivadasEspecie?: number | null;
  recursosPropiosEfectivoCheque?: number | null;
  recursosPropiosEspecie?: number | null;
  total?: number | null;
};

type EgressRow = {
  pageNumber: number;
  fecha?: string | null;
  numeroFacturaRecibo: string;
  cedulaRuc?: string | null;
  proveedorNombre?: string | null;
  detalleGasto?: string | null;
  pagoTipo?: 'Efectivo' | 'Especie' | 'Cheque' | null;
  movilizacion?: number | null;
  combustible?: number | null;
  hospedaje?: number | null;
  activistas?: number | null;
  caravanaConcentraciones?: number | null;
  comidaBrindis?: number | null;
  alquilerLocalServiciosBasicos?: number | null;
  cargosBancarios?: number | null;
  totalGastosCampania?: number | null;
  personalizacionArticulosPromocionales?: number | null;
  propagandaElectoral?: number | null;
  totalGastosPropaganda?: number | null;
  totalDeGastosDePropagandaYCampania?: number | null;
};

// Column definitions
const INGRESS_COLUMNS: { key: keyof IngressRow; label: string; type: 'string' | 'number' }[] = [
  { key: 'pageNumber', label: 'Pág', type: 'number' },
  { key: 'fecha', label: 'Fecha', type: 'string' },
  { key: 'reciboNumero', label: 'Recibo No.', type: 'string' },
  { key: 'contribuyenteNombre', label: 'Contribuyente', type: 'string' },
  { key: 'representanteLegal', label: 'Rep. Legal', type: 'string' },
  { key: 'cedulaRuc', label: 'Cédula/RUC', type: 'string' },
  { key: 'donacionesPrivadasEfectivo', label: 'Don. Efectivo', type: 'number' },
  { key: 'donacionesPrivadasChequeAch', label: 'Don. Cheque/ACH', type: 'number' },
  { key: 'donacionesPrivadasEspecie', label: 'Don. Especie', type: 'number' },
  { key: 'recursosPropiosEfectivoCheque', label: 'Rec. Propios Efec/Cheque', type: 'number' },
  { key: 'recursosPropiosEspecie', label: 'Rec. Propios Especie', type: 'number' },
  { key: 'total', label: 'Total', type: 'number' },
];

const EGRESS_COLUMNS: { key: keyof EgressRow; label: string; type: 'string' | 'number' }[] = [
  { key: 'pageNumber', label: 'Pág', type: 'number' },
  { key: 'fecha', label: 'Fecha', type: 'string' },
  { key: 'numeroFacturaRecibo', label: 'Factura/Recibo', type: 'string' },
  { key: 'cedulaRuc', label: 'Cédula/RUC', type: 'string' },
  { key: 'proveedorNombre', label: 'Proveedor', type: 'string' },
  { key: 'detalleGasto', label: 'Detalle', type: 'string' },
  { key: 'pagoTipo', label: 'Tipo Pago', type: 'string' },
  { key: 'movilizacion', label: 'Movilización', type: 'number' },
  { key: 'combustible', label: 'Combustible', type: 'number' },
  { key: 'totalGastosCampania', label: 'Total Campaña', type: 'number' },
  { key: 'totalDeGastosDePropagandaYCampania', label: 'Total General', type: 'number' },
];

function DocumentValidationPage() {
  const { documentId } = Route.useParams();
  const document = useQuery(api.documents.getDocument, {
    documentId: documentId as Id<'documents'>,
  });
  const extractions = useQuery(api.extractions.getExtractions, {
    documentId: documentId as Id<'documents'>,
  });
  const validatedData = useQuery(api.extractions.getValidatedData, {
    documentId: documentId as Id<'documents'>,
  });
  const saveValidatedData = useMutation(api.extractions.saveValidatedData);

  // Rotation mutation with optimistic update
  const setPageRotation = useMutation(api.documents.setPageRotation).withOptimisticUpdate((localStore, args) => {
    const currentDoc = localStore.getQuery(api.documents.getDocument, {
      documentId: documentId as Id<'documents'>,
    });
    if (currentDoc) {
      const pageRotations = { ...(currentDoc.pageRotations ?? {}) };
      const normalizedRotation = ((args.rotation % 360) + 360) % 360;

      if (normalizedRotation === 0) {
        delete pageRotations[String(args.pageNumber)];
      } else {
        pageRotations[String(args.pageNumber)] = normalizedRotation;
      }

      localStore.setQuery(
        api.documents.getDocument,
        { documentId: documentId as Id<'documents'> },
        { ...currentDoc, pageRotations },
      );
    }
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [editedIngress, setEditedIngress] = useState<IngressRow[] | null>(null);
  const [editedEgress, setEditedEgress] = useState<EgressRow[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Get extractions by model
  const extractionsByModel = useMemo(() => {
    if (!extractions) return {};
    const result: Record<string, { ingress: IngressRow[]; egress: EgressRow[] }> = {};
    for (const ext of extractions) {
      result[ext.model] = {
        ingress: ext.ingress as unknown as IngressRow[],
        egress: ext.egress as unknown as EgressRow[],
      };
    }
    return result;
  }, [extractions]);

  // Get model names
  const modelNames = Object.keys(extractionsByModel);

  // Merge rows from all models to get the union
  const mergeRowsFromAllModels = useCallback(
    (type: 'ingress' | 'egress', keyField: string): (IngressRow | EgressRow)[] => {
      const rowMap = new Map<string, IngressRow | EgressRow>();

      for (const modelName of modelNames) {
        const modelData = extractionsByModel[modelName];
        if (!modelData) continue;

        const rows = type === 'ingress' ? modelData.ingress : modelData.egress;
        for (const row of rows) {
          const key = String((row as Record<string, unknown>)[keyField]);
          if (!rowMap.has(key)) {
            // First time seeing this row - use it as base
            rowMap.set(key, row);
          }
        }
      }

      return Array.from(rowMap.values());
    },
    [modelNames, extractionsByModel],
  );

  // Get which models found each row
  const getModelsForRow = useCallback(
    (type: 'ingress' | 'egress', keyField: string, rowKey: string): string[] => {
      const modelsFound: string[] = [];

      for (const modelName of modelNames) {
        const modelData = extractionsByModel[modelName];
        if (!modelData) continue;

        const rows = type === 'ingress' ? modelData.ingress : modelData.egress;
        const found = rows.some((row) => String((row as Record<string, unknown>)[keyField]) === rowKey);
        if (found) {
          modelsFound.push(modelName);
        }
      }

      return modelsFound;
    },
    [modelNames, extractionsByModel],
  );

  // Compute diffs between models
  const computeDiffs = useCallback(
    (
      rows1: (IngressRow | EgressRow)[],
      rows2: (IngressRow | EgressRow)[],
      keyField: string,
    ): Map<string, Set<string>> => {
      const diffs = new Map<string, Set<string>>();

      // Create lookup by key field
      const lookup1 = new Map<string, IngressRow | EgressRow>();
      const lookup2 = new Map<string, IngressRow | EgressRow>();

      for (const row of rows1) {
        const key = String((row as Record<string, unknown>)[keyField]);
        lookup1.set(key, row);
      }
      for (const row of rows2) {
        const key = String((row as Record<string, unknown>)[keyField]);
        lookup2.set(key, row);
      }

      // Compare matching rows
      for (const [key, row1] of lookup1) {
        const row2 = lookup2.get(key);
        if (row2) {
          const diffFields = new Set<string>();
          for (const field of Object.keys(row1)) {
            const v1 = (row1 as Record<string, unknown>)[field];
            const v2 = (row2 as Record<string, unknown>)[field];
            // Normalize values before comparing
            const normalizedV1 = normalizeValueForComparison(field, v1);
            const normalizedV2 = normalizeValueForComparison(field, v2);
            if (normalizedV1 !== normalizedV2) {
              diffFields.add(field);
            }
          }
          if (diffFields.size > 0) {
            diffs.set(key, diffFields);
          }
        }
      }

      return diffs;
    },
    [],
  );

  // Get current data to display (edited, validated, or merged from all models)
  const currentIngress = useMemo(() => {
    if (editedIngress) return editedIngress;
    if (validatedData) return validatedData.ingress as unknown as IngressRow[];
    // Merge rows from all models to show the union
    return mergeRowsFromAllModels('ingress', 'reciboNumero') as IngressRow[];
  }, [editedIngress, validatedData, mergeRowsFromAllModels]);

  const currentEgress = useMemo(() => {
    if (editedEgress) return editedEgress;
    if (validatedData) return validatedData.egress as unknown as EgressRow[];
    // Merge rows from all models to show the union
    return mergeRowsFromAllModels('egress', 'numeroFacturaRecibo') as EgressRow[];
  }, [editedEgress, validatedData, mergeRowsFromAllModels]);

  // Compute diffs between models
  const ingressDiffs = useMemo(() => {
    if (modelNames.length < 2) return new Map<string, Set<string>>();
    const model1 = extractionsByModel[modelNames[0]!];
    const model2 = extractionsByModel[modelNames[1]!];
    if (!model1 || !model2) return new Map<string, Set<string>>();
    return computeDiffs(model1.ingress, model2.ingress, 'reciboNumero');
  }, [modelNames, extractionsByModel, computeDiffs]);

  const egressDiffs = useMemo(() => {
    if (modelNames.length < 2) return new Map<string, Set<string>>();
    const model1 = extractionsByModel[modelNames[0]!];
    const model2 = extractionsByModel[modelNames[1]!];
    if (!model1 || !model2) return new Map<string, Set<string>>();
    return computeDiffs(model1.egress, model2.egress, 'numeroFacturaRecibo');
  }, [modelNames, extractionsByModel, computeDiffs]);

  // Handlers
  const handleCellEdit = (
    type: 'ingress' | 'egress',
    rowIndex: number,
    field: string,
    value: string | number | null,
  ) => {
    if (type === 'ingress') {
      const rows = [...(editedIngress || currentIngress)];
      const row = { ...rows[rowIndex] };
      (row as Record<string, unknown>)[field] = value;
      rows[rowIndex] = row as IngressRow;
      setEditedIngress(rows);
    } else {
      const rows = [...(editedEgress || currentEgress)];
      const row = { ...rows[rowIndex] };
      (row as Record<string, unknown>)[field] = value;
      rows[rowIndex] = row as EgressRow;
      setEditedEgress(rows);
    }
  };

  const handleAddRow = (type: 'ingress' | 'egress') => {
    if (type === 'ingress') {
      const rows = editedIngress || [...currentIngress];
      const newRow: IngressRow = {
        pageNumber: currentPage,
        reciboNumero: '',
        fecha: null,
        contribuyenteNombre: null,
        representanteLegal: null,
        cedulaRuc: null,
        direccion: null,
        telefono: null,
        correoElectronico: null,
        donacionesPrivadasEfectivo: null,
        donacionesPrivadasChequeAch: null,
        donacionesPrivadasEspecie: null,
        recursosPropiosEfectivoCheque: null,
        recursosPropiosEspecie: null,
        total: null,
      };
      setEditedIngress([...rows, newRow]);
    } else {
      const rows = editedEgress || [...currentEgress];
      const newRow: EgressRow = {
        pageNumber: currentPage,
        numeroFacturaRecibo: '',
        fecha: null,
        cedulaRuc: null,
        proveedorNombre: null,
        detalleGasto: null,
        pagoTipo: null,
        movilizacion: null,
        combustible: null,
        hospedaje: null,
        activistas: null,
        caravanaConcentraciones: null,
        comidaBrindis: null,
        alquilerLocalServiciosBasicos: null,
        cargosBancarios: null,
        totalGastosCampania: null,
        personalizacionArticulosPromocionales: null,
        propagandaElectoral: null,
        totalGastosPropaganda: null,
        totalDeGastosDePropagandaYCampania: null,
      };
      setEditedEgress([...rows, newRow]);
    }
  };

  const handleDeleteRow = (type: 'ingress' | 'egress', rowIndex: number) => {
    if (type === 'ingress') {
      const rows = [...(editedIngress || currentIngress)];
      rows.splice(rowIndex, 1);
      setEditedIngress(rows);
    } else {
      const rows = [...(editedEgress || currentEgress)];
      rows.splice(rowIndex, 1);
      setEditedEgress(rows);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveValidatedData({
        documentId: documentId as Id<'documents'>,
        ingress: (editedIngress || currentIngress) as any,
        egress: (editedEgress || currentEgress) as any,
      });
      setEditedIngress(null);
      setEditedEgress(null);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const goToPage = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  // Get current page rotation
  const getCurrentRotation = useCallback(() => {
    return document?.pageRotations?.[String(currentPage)] ?? 0;
  }, [document?.pageRotations, currentPage]);

  // Handle rotate button click
  const handleRotate = useCallback(() => {
    const currentRotation = getCurrentRotation();
    const newRotation = (currentRotation + 90) % 360;
    setPageRotation({
      documentId: documentId as Id<'documents'>,
      pageNumber: currentPage,
      rotation: newRotation,
    });
  }, [currentPage, documentId, getCurrentRotation, setPageRotation]);

  // Find pages with diffs for quick navigation (check both ingress and egress)
  const pagesWithDiffs = useMemo(() => {
    const pageSet = new Set<number>();

    // Check ingress diffs
    for (const row of currentIngress) {
      const rowKey = String((row as Record<string, unknown>)['reciboNumero']);
      if (ingressDiffs.has(rowKey)) {
        pageSet.add(row.pageNumber);
      }
    }

    // Check egress diffs
    for (const row of currentEgress) {
      const rowKey = String((row as Record<string, unknown>)['numeroFacturaRecibo']);
      if (egressDiffs.has(rowKey)) {
        pageSet.add(row.pageNumber);
      }
    }

    return Array.from(pageSet).sort((a, b) => a - b);
  }, [ingressDiffs, egressDiffs, currentIngress, currentEgress]);

  // Get rows for current page (both ingress and egress)
  const currentPageIngressRows = useMemo(() => {
    return currentIngress.filter((row) => row.pageNumber === currentPage);
  }, [currentIngress, currentPage]);

  const currentPageEgressRows = useMemo(() => {
    return currentEgress.filter((row) => row.pageNumber === currentPage);
  }, [currentEgress, currentPage]);

  // Determine which type of data exists on this page
  const hasIngressOnPage = currentPageIngressRows.length > 0;
  const hasEgressOnPage = currentPageEgressRows.length > 0;

  if (!document) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500">Cargando documento...</div>
      </div>
    );
  }

  const hasEdits = editedIngress !== null || editedEgress !== null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/documents" className="text-slate-500 hover:text-slate-700 dark:text-slate-400">
              ← Volver
            </Link>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate max-w-md">
              {document.name}
            </h1>
            {validatedData && (
              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 rounded-full text-xs">
                Validado
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {pagesWithDiffs.length > 0 && (
              <span className="text-sm text-amber-600 dark:text-amber-400">
                ⚠ {pagesWithDiffs.length} páginas con diferencias
              </span>
            )}

            <Button onClick={handleSave} disabled={!hasEdits || isSaving} variant={hasEdits ? 'default' : 'outline'}>
              {isSaving ? 'Guardando...' : 'Guardar Validación'}
            </Button>
          </div>
        </div>
      </header>

      <ResizablePanelGroup orientation="horizontal" className="h-[calc(100vh-57px)]">
        {/* PDF Viewer Panel */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 flex flex-col">
            {/* PDF Controls */}
            <div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-center gap-4">
              <Button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                variant="outline"
                size="sm"
              >
                ←
              </Button>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Página {currentPage} de {document.pageCount}
              </span>
              <Button
                onClick={() => setCurrentPage((p) => Math.min(document.pageCount, p + 1))}
                disabled={currentPage >= document.pageCount}
                variant="outline"
                size="sm"
              >
                →
              </Button>
              <div className="w-px h-6 bg-slate-300 dark:bg-slate-600" />
              <Button onClick={handleRotate} variant="outline" size="sm" title="Rotar página 90°">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Rotar
              </Button>
            </div>

            {/* PDF Embed */}
            <div className="flex-1 overflow-auto p-4">
              <div className="min-w-fit flex justify-center">
                {document.fileUrl ? (
                  <Suspense
                    fallback={
                      <div className="flex items-center justify-center h-full text-slate-500">Cargando PDF...</div>
                    }
                  >
                    <PDFViewer fileUrl={document.fileUrl} currentPage={currentPage} rotation={getCurrentRotation()} />
                  </Suspense>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500">No se pudo cargar el PDF</div>
                )}
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Data Panel */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col bg-white dark:bg-slate-900">
            {/* Header */}
            <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Tabla de Datos
                {hasIngressOnPage && hasEgressOnPage && (
                  <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">(Ingresos y Gastos)</span>
                )}
                {hasIngressOnPage && !hasEgressOnPage && (
                  <span className="ml-2 text-xs text-slate-500">— Ingresos</span>
                )}
                {!hasIngressOnPage && hasEgressOnPage && <span className="ml-2 text-xs text-slate-500">— Gastos</span>}
              </h2>
            </div>

            {/* Diff Navigation */}
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

            {/* Tables */}
            <div className="flex-1 overflow-auto">
              {!hasIngressOnPage && !hasEgressOnPage ? (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                  No hay datos en esta página
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Ingress Table */}
                  {hasIngressOnPage && (
                    <div>
                      {hasEgressOnPage && (
                        <div className="px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800">
                          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Ingresos</span>
                        </div>
                      )}
                      <DataTable
                        columns={INGRESS_COLUMNS as { key: string; label: string; type: 'string' | 'number' }[]}
                        rows={currentPageIngressRows}
                        allRows={currentIngress}
                        diffs={ingressDiffs}
                        keyField="reciboNumero"
                        modelData={extractionsByModel}
                        modelNames={modelNames}
                        getModelsForRow={(rowKey) => getModelsForRow('ingress', 'reciboNumero', rowKey)}
                        onEdit={(rowIndex, field, value) => handleCellEdit('ingress', rowIndex, field, value)}
                        onDelete={(rowIndex) => handleDeleteRow('ingress', rowIndex)}
                      />
                    </div>
                  )}

                  {/* Egress Table */}
                  {hasEgressOnPage && (
                    <div>
                      {hasIngressOnPage && (
                        <div className="px-2 py-1 bg-rose-50 dark:bg-rose-900/20 border-b border-rose-200 dark:border-rose-800">
                          <span className="text-xs font-medium text-rose-700 dark:text-rose-400">Gastos</span>
                        </div>
                      )}
                      <DataTable
                        columns={EGRESS_COLUMNS as { key: string; label: string; type: 'string' | 'number' }[]}
                        rows={currentPageEgressRows}
                        allRows={currentEgress}
                        diffs={egressDiffs}
                        keyField="numeroFacturaRecibo"
                        modelData={extractionsByModel}
                        modelNames={modelNames}
                        getModelsForRow={(rowKey) => getModelsForRow('egress', 'numeroFacturaRecibo', rowKey)}
                        onEdit={(rowIndex, field, value) => handleCellEdit('egress', rowIndex, field, value)}
                        onDelete={(rowIndex) => handleDeleteRow('egress', rowIndex)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Add Row Button */}
            <div className="px-2 py-1 border-t border-slate-200 dark:border-slate-700 flex gap-2">
              {(hasIngressOnPage || (!hasIngressOnPage && !hasEgressOnPage)) && (
                <Button
                  onClick={() => handleAddRow('ingress')}
                  variant="outline"
                  size="sm"
                  className="flex-1 border-dashed"
                >
                  + Agregar ingreso
                </Button>
              )}
              {(hasEgressOnPage || (!hasIngressOnPage && !hasEgressOnPage)) && (
                <Button
                  onClick={() => handleAddRow('egress')}
                  variant="outline"
                  size="sm"
                  className="flex-1 border-dashed"
                >
                  + Agregar gasto
                </Button>
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

// DataTable Component
interface DataTableProps {
  columns: { key: string; label: string; type: 'string' | 'number' }[];
  rows: (IngressRow | EgressRow)[];
  allRows: (IngressRow | EgressRow)[];
  diffs: Map<string, Set<string>>;
  keyField: string;
  modelData: Record<string, { ingress: IngressRow[]; egress: EgressRow[] }>;
  modelNames: string[];
  getModelsForRow: (rowKey: string) => string[];
  onEdit: (rowIndex: number, field: string, value: string | number | null) => void;
  onDelete: (rowIndex: number) => void;
}

// Normalization functions for comparison and display
function normalizeCedulaRuc(value: string | null | undefined): string | null {
  if (value == null) return null;
  // Replace dashes with dots for cedulaRuc
  return value.replace(/-/g, '.');
}

function normalizeDate(value: string | null | undefined): string | null {
  if (value == null) return null;
  // Replace dots with dashes for dates
  return value.replace(/\./g, '-');
}

function normalizeValueForComparison(field: string, value: unknown): unknown {
  if (value == null) return value;
  if (typeof value !== 'string') return value;

  if (field === 'cedulaRuc') {
    return normalizeCedulaRuc(value);
  }
  if (field === 'fecha') {
    return normalizeDate(value);
  }
  return value;
}

function normalizeValueForDisplay(field: string, value: unknown): string {
  if (value == null) return '—';
  if (typeof value !== 'string') return String(value);

  if (field === 'cedulaRuc') {
    return normalizeCedulaRuc(value) ?? '—';
  }
  if (field === 'fecha') {
    return normalizeDate(value) ?? '—';
  }
  return value;
}

// Helper to get short model name
function getShortModelName(modelName: string): string {
  // Handle gemini-2.x and gemini-3.x specially
  if (modelName.startsWith('gemini-2')) return 'g2';
  if (modelName.startsWith('gemini-3')) return 'g3';
  // For other models, take the first part
  return modelName.split('-')[0] || modelName.substring(0, 3);
}

function DataTable({
  columns,
  rows,
  allRows,
  diffs,
  keyField,
  modelData,
  modelNames,
  getModelsForRow,
  onEdit,
  onDelete,
}: DataTableProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);

  const getAlternateValues = (rowKey: string, field: string): Record<string, unknown> => {
    const alternates: Record<string, unknown> = {};
    const isIngress = 'reciboNumero' in (rows[0] || {});

    for (const modelName of modelNames) {
      const model = modelData[modelName];
      if (!model) continue;

      const dataArray = isIngress ? model.ingress : model.egress;
      const row = dataArray.find(
        (r: IngressRow | EgressRow) => String((r as Record<string, unknown>)[keyField]) === rowKey,
      );

      if (row) {
        alternates[modelName] = (row as Record<string, unknown>)[field];
      }
    }

    return alternates;
  };

  // Get the actual index in allRows for each displayed row
  const getActualIndex = (row: IngressRow | EgressRow): number => {
    return allRows.indexOf(row);
  };

  return (
    <table className="w-full text-xs border-collapse table-fixed">
      <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
        <tr>
          {columns
            .filter((col) => col.key !== 'pageNumber')
            .map((col) => (
              <th
                key={col.key}
                className="px-1 py-1 text-left text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 wrap-break-word"
              >
                {col.label}
              </th>
            ))}
          <th className="px-1 py-1 w-6 border-b border-slate-200 dark:border-slate-700"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, displayIndex) => {
          const rowKey = String((row as Record<string, unknown>)[keyField]);
          const rowDiffs = diffs.get(rowKey);
          const actualIndex = getActualIndex(row);
          const modelsFound = getModelsForRow(rowKey);
          const isMissingFromSomeModels = modelsFound.length > 0 && modelsFound.length < modelNames.length;

          return (
            <tr
              key={displayIndex}
              className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 group border-b border-slate-100 dark:border-slate-800 ${
                isMissingFromSomeModels ? 'bg-orange-50 dark:bg-orange-900/20' : ''
              }`}
            >
              {columns
                .filter((col) => col.key !== 'pageNumber')
                .map((col, colIndex) => {
                  const value = (row as Record<string, unknown>)[col.key];
                  const hasDiff = rowDiffs?.has(col.key);
                  const altValues = hasDiff ? getAlternateValues(rowKey, col.key) : {};
                  const isEditing = editingCell?.row === displayIndex && editingCell?.col === col.key;

                  return (
                    <td
                      key={col.key}
                      className={`px-1 py-0.5 ${
                        hasDiff ? 'bg-amber-50 dark:bg-amber-900/30 border-l-2 border-amber-400' : ''
                      }`}
                    >
                      {/* Show model indicators on the first column */}
                      {colIndex === 0 && isMissingFromSomeModels && (
                        <div className="flex items-center gap-1 mb-0.5">
                          {modelNames.map((modelName) => {
                            const found = modelsFound.includes(modelName);
                            const shortName = getShortModelName(modelName);
                            return (
                              <span
                                key={modelName}
                                className={`text-[9px] px-1 py-0 rounded ${
                                  found
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 line-through'
                                }`}
                                title={`${modelName}: ${found ? 'Found' : 'Missing'}`}
                              >
                                {shortName}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {isEditing ? (
                        <input
                          type={col.type === 'number' ? 'number' : 'text'}
                          defaultValue={value === null ? '' : String(value)}
                          autoFocus
                          className="w-full px-1 py-0 text-xs border border-indigo-400 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800"
                          onBlur={(e) => {
                            const newValue =
                              col.type === 'number'
                                ? e.target.value
                                  ? Number(e.target.value)
                                  : null
                                : e.target.value || null;
                            onEdit(actualIndex, col.key, newValue);
                            setEditingCell(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            } else if (e.key === 'Escape') {
                              setEditingCell(null);
                            }
                          }}
                        />
                      ) : (
                        <div
                          onClick={() => setEditingCell({ row: displayIndex, col: col.key })}
                          className="cursor-text min-h-[16px]"
                        >
                          <span className={value === null ? 'text-slate-400 italic' : ''}>
                            {normalizeValueForDisplay(col.key, value)}
                          </span>
                          {hasDiff && Object.keys(altValues).length > 0 && (
                            <div className="text-[10px] space-y-1 mt-1">
                              {Object.entries(altValues).map(([modelName, modelValue]) => {
                                const shortName = getShortModelName(modelName);
                                // Compare normalized values to determine if selected
                                const normalizedCurrent = normalizeValueForComparison(col.key, value);
                                const normalizedModel = normalizeValueForComparison(col.key, modelValue);
                                const isSelected = normalizedModel === normalizedCurrent;
                                return (
                                  <button
                                    key={modelName}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEdit(actualIndex, col.key, modelValue as string | number | null);
                                    }}
                                    className={`block w-full text-left py-0.5 rounded border transition-colors cursor-pointer ${
                                      isSelected
                                        ? 'border-emerald-400 dark:border-emerald-500 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-400 dark:ring-emerald-500'
                                        : 'border-amber-300 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800 hover:border-amber-400 dark:hover:border-amber-500'
                                    }`}
                                    title={isSelected ? `Valor actual (de ${modelName})` : `Usar valor de ${modelName}`}
                                  >
                                    {isSelected && <span className="mr-1">✓</span>}
                                    <span className="font-medium">{shortName}:</span>{' '}
                                    {normalizeValueForDisplay(col.key, modelValue)}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              <td className="px-1 py-0.5">
                <Button
                  onClick={() => onDelete(actualIndex)}
                  variant="ghost"
                  size="icon-sm"
                  className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5"
                  title="Eliminar fila"
                >
                  ×
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
