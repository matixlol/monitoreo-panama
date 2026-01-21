import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/api';
import { useState, useCallback, useMemo, lazy, Suspense, useEffect } from 'react';
import type { Id } from '@convex/dataModel';
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

export const Route = createFileRoute('/documents_/$documentId')({
  component: DocumentValidationPage,
});

// Types
type IngressRow = {
  pageNumber: number;
  fecha?: string | null;
  reciboNumero?: string | null;
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
  // AI-detected unreadable fields (from extractions)
  unreadableFields?: string[];
  // Human-marked unreadable fields (for validations)
  humanUnreadableFields?: string[];
};

type EgressRow = {
  pageNumber: number;
  fecha?: string | null;
  numeroFacturaRecibo?: string | null;
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
  // AI-detected unreadable fields (from extractions)
  unreadableFields?: string[];
  // Human-marked unreadable fields (for validations)
  humanUnreadableFields?: string[];
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

// Basic info columns for egress (non-monetary)
const EGRESS_INFO_COLUMNS: { key: keyof EgressRow; label: string; type: 'string' | 'number' }[] = [
  { key: 'pageNumber', label: 'Pág', type: 'number' },
  { key: 'fecha', label: 'Fecha', type: 'string' },
  { key: 'numeroFacturaRecibo', label: 'Factura/Recibo', type: 'string' },
  { key: 'cedulaRuc', label: 'Cédula/RUC', type: 'string' },
  { key: 'proveedorNombre', label: 'Proveedor', type: 'string' },
  { key: 'detalleGasto', label: 'Detalle', type: 'string' },
  { key: 'pagoTipo', label: 'Tipo Pago', type: 'string' },
];

// All spend columns for egress (monetary) - organized in 2 rows of 6
const EGRESS_SPEND_COLUMNS: { key: keyof EgressRow; label: string }[] = [
  // Row 1: Campaign expenses
  { key: 'movilizacion', label: 'Movilización' },
  { key: 'combustible', label: 'Combustible' },
  { key: 'hospedaje', label: 'Hospedaje' },
  { key: 'activistas', label: 'Activistas' },
  { key: 'caravanaConcentraciones', label: 'Caravana/Conc.' },
  { key: 'comidaBrindis', label: 'Comida/Brindis' },
  // Row 2: More expenses + totals
  { key: 'alquilerLocalServiciosBasicos', label: 'Alquiler/Serv.' },
  { key: 'cargosBancarios', label: 'Carg. Bancarios' },
  { key: 'personalizacionArticulosPromocionales', label: 'Art. Promocionales' },
  { key: 'propagandaElectoral', label: 'Propaganda' },
  { key: 'totalGastosCampania', label: 'Tot. Campaña' },
  { key: 'totalGastosPropaganda', label: 'Tot. Propaganda' },
];

// The grand total column
const EGRESS_TOTAL_COLUMN: { key: keyof EgressRow; label: string } = {
  key: 'totalDeGastosDePropagandaYCampania',
  label: 'TOTAL GENERAL',
};

// Combined for compatibility with existing code
const EGRESS_COLUMNS: { key: keyof EgressRow; label: string; type: 'string' | 'number' }[] = [
  ...EGRESS_INFO_COLUMNS,
  ...EGRESS_SPEND_COLUMNS.map((c) => ({ ...c, type: 'number' as const })),
  { ...EGRESS_TOTAL_COLUMN, type: 'number' as const },
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
  const retryExtraction = useMutation(api.documents.retryExtraction);

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

  // Initialize page from localStorage, keyed by documentId
  const storageKey = `document-page-${documentId}`;
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? parseInt(saved, 10) : 1;
  });

  // Persist page to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(storageKey, String(currentPage));
  }, [storageKey, currentPage]);

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

  // Merge rows from all models to get the union (prioritize gemini-3)
  const mergeRowsFromAllModels = useCallback(
    (type: 'ingress' | 'egress', keyField: string): (IngressRow | EgressRow)[] => {
      const rowMap = new Map<string, IngressRow | EgressRow>();

      // Sort model names so gemini-3 comes first
      const sortedModelNames = [...modelNames].sort((a, b) => {
        const aIsGemini3 = a.startsWith('gemini-3');
        const bIsGemini3 = b.startsWith('gemini-3');
        if (aIsGemini3 && !bIsGemini3) return -1;
        if (!aIsGemini3 && bIsGemini3) return 1;
        return 0;
      });

      for (const modelName of sortedModelNames) {
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
          // Get union of all fields from both rows to catch fields that exist in one but not the other
          const allFields = new Set([...Object.keys(row1), ...Object.keys(row2)]);
          for (const field of allFields) {
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

  const handleToggleUnreadable = (type: 'ingress' | 'egress', rowIndex: number, field: string) => {
    if (type === 'ingress') {
      const rows = [...(editedIngress || currentIngress)];
      const row = { ...rows[rowIndex] };
      const unreadableFields = row.humanUnreadableFields ? [...row.humanUnreadableFields] : [];
      const fieldIndex = unreadableFields.indexOf(field);
      if (fieldIndex === -1) {
        unreadableFields.push(field);
      } else {
        unreadableFields.splice(fieldIndex, 1);
      }
      row.humanUnreadableFields = unreadableFields;
      rows[rowIndex] = row;
      setEditedIngress(rows);
    } else {
      const rows = [...(editedEgress || currentEgress)];
      const row = { ...rows[rowIndex] };
      const unreadableFields = row.humanUnreadableFields ? [...row.humanUnreadableFields] : [];
      const fieldIndex = unreadableFields.indexOf(field);
      if (fieldIndex === -1) {
        unreadableFields.push(field);
      } else {
        unreadableFields.splice(fieldIndex, 1);
      }
      row.humanUnreadableFields = unreadableFields;
      rows[rowIndex] = row;
      setEditedEgress(rows);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Strip unreadableFields (AI-detected) before sending - only humanUnreadableFields is accepted
      const stripUnreadableFields = <T extends Record<string, unknown>>(rows: T[]): T[] =>
        rows.map(({ unreadableFields, ...rest }) => rest as T);

      await saveValidatedData({
        documentId: documentId as Id<'documents'>,
        ingress: stripUnreadableFields(editedIngress || currentIngress) as any,
        egress: stripUnreadableFields(editedEgress || currentEgress) as any,
      });
      setEditedIngress(null);
      setEditedEgress(null);
    } catch (error) {
      console.error('Save failed:', error);
      alert(`Error al guardar: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRerunExtraction = async () => {
    if (
      !confirm(
        '¿Estás seguro de que quieres volver a ejecutar la extracción? Esto eliminará las extracciones anteriores.',
      )
    ) {
      return;
    }
    try {
      await retryExtraction({
        documentId: documentId as Id<'documents'>,
      });
    } catch (error) {
      console.error('Rerun failed:', error);
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

  // Find pages with AI-detected unreadable fields for quick navigation
  const pagesWithUnreadables = useMemo(() => {
    const pageSet = new Set<number>();

    // Check ingress rows for unreadable fields
    for (const row of currentIngress) {
      if (row.unreadableFields && row.unreadableFields.length > 0) {
        pageSet.add(row.pageNumber);
      }
    }

    // Check egress rows for unreadable fields
    for (const row of currentEgress) {
      if (row.unreadableFields && row.unreadableFields.length > 0) {
        pageSet.add(row.pageNumber);
      }
    }

    return Array.from(pageSet).sort((a, b) => a - b);
  }, [currentIngress, currentEgress]);

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
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 z-20">
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
            {(document.status === 'processing' || document.status === 'pending') && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-full text-xs animate-pulse">
                {document.status === 'pending' ? 'Pendiente...' : 'Procesando...'}
              </span>
            )}
            {document.status === 'failed' && (
              <span className="px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded-full text-xs">
                Error
              </span>
            )}
            {pagesWithDiffs.length > 0 && (
              <span className="text-sm text-amber-600 dark:text-amber-400">
                ⚠ {pagesWithDiffs.length} páginas con diferencias
              </span>
            )}
            {pagesWithUnreadables.length > 0 && (
              <span className="text-sm text-orange-600 dark:text-orange-400">
                ? {pagesWithUnreadables.length} páginas con campos ilegibles
              </span>
            )}

            <Button
              onClick={handleRerunExtraction}
              disabled={document.status === 'processing' || document.status === 'pending'}
              variant="outline"
              className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-900/20"
            >
              {document.status === 'processing' || document.status === 'pending' ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Extrayendo...
                </>
              ) : (
                <>
                  <svg
                    className="mr-2 h-4 w-4"
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
                  Re-extraer
                </>
              )}
            </Button>

            <Button onClick={handleSave} disabled={!hasEdits || isSaving} variant={hasEdits ? 'default' : 'outline'}>
              {isSaving ? 'Guardando...' : 'Guardar Validación'}
            </Button>
          </div>
        </div>
      </header>

      <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
        {/* PDF Viewer Panel */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 flex flex-col overflow-hidden">
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

            {/* PDF Embed - sticky container that stays at top */}
            <div className="flex-1 overflow-auto p-4">
              <div className="sticky top-0 min-w-fit flex justify-center">
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

            {/* AI Unreadable Fields Navigation */}
            {pagesWithUnreadables.length > 0 && (
              <div className="px-2 py-1 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800 flex items-center gap-1 overflow-x-auto">
                <span className="text-xs text-orange-700 dark:text-orange-400 whitespace-nowrap">
                  IA detectó ilegible:
                </span>
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
                        onToggleUnreadable={(rowIndex, field) => handleToggleUnreadable('ingress', rowIndex, field)}
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
                      <EgressDataTable
                        rows={currentPageEgressRows}
                        allRows={currentEgress}
                        diffs={egressDiffs}
                        modelData={extractionsByModel}
                        modelNames={modelNames}
                        getModelsForRow={(rowKey) => getModelsForRow('egress', 'numeroFacturaRecibo', rowKey)}
                        onEdit={(rowIndex, field, value) => handleCellEdit('egress', rowIndex, field, value)}
                        onDelete={(rowIndex) => handleDeleteRow('egress', rowIndex)}
                        onToggleUnreadable={(rowIndex, field) => handleToggleUnreadable('egress', rowIndex, field)}
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
  onToggleUnreadable: (rowIndex: number, field: string) => void;
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

// EgressDataTable - specialized table for egress with compact spend grid
interface EgressDataTableProps {
  rows: EgressRow[];
  allRows: EgressRow[];
  diffs: Map<string, Set<string>>;
  modelData: Record<string, { ingress: IngressRow[]; egress: EgressRow[] }>;
  modelNames: string[];
  getModelsForRow: (rowKey: string) => string[];
  onEdit: (rowIndex: number, field: string, value: string | number | null) => void;
  onDelete: (rowIndex: number) => void;
  onToggleUnreadable: (rowIndex: number, field: string) => void;
}

function EgressDataTable({
  rows,
  allRows,
  diffs,
  modelData,
  modelNames,
  getModelsForRow,
  onEdit,
  onDelete,
  onToggleUnreadable,
}: EgressDataTableProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);

  const getAlternateValues = (rowKey: string, field: string): Record<string, unknown> => {
    const alternates: Record<string, unknown> = {};

    for (const modelName of modelNames) {
      const model = modelData[modelName];
      if (!model) continue;

      const row = model.egress.find((r) => String(r.numeroFacturaRecibo) === rowKey);
      if (row) {
        alternates[modelName] = (row as Record<string, unknown>)[field];
      }
    }

    return alternates;
  };

  const getActualIndex = (row: EgressRow): number => {
    return allRows.indexOf(row);
  };

  const renderEditableCell = (
    row: EgressRow,
    field: string,
    value: unknown,
    displayIndex: number,
    actualIndex: number,
    hasDiff: boolean,
    altValues: Record<string, unknown>,
    type: 'string' | 'number' = 'string',
    compact = false,
  ) => {
    const isEditing = editingCell?.row === displayIndex && editingCell?.col === field;
    const isHumanUnreadable = row.humanUnreadableFields?.includes(field) ?? false;
    const isAiUnreadable = row.unreadableFields?.includes(field) ?? false;

    return (
      <div className={`relative ${compact ? 'text-[10px]' : ''}`}>
        {/* Unreadable toggle button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleUnreadable(actualIndex, field);
          }}
          className={`absolute -top-0.5 -right-0.5 text-[10px] leading-none w-4 h-4 flex items-center justify-center rounded-full transition-colors z-10 ${
            isHumanUnreadable
              ? 'bg-red-400 dark:bg-red-700 text-white font-bold shadow-sm'
              : isAiUnreadable
                ? 'bg-orange-400 dark:bg-orange-600 text-white font-bold shadow-sm'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100'
          }`}
          title={
            isHumanUnreadable
              ? 'Marcar como legible'
              : isAiUnreadable
                ? 'IA detectó ilegible - Click para confirmar'
                : 'Marcar como ilegible'
          }
        >
          ?
        </button>

        {isEditing ? (
          <div
            contentEditable
            suppressContentEditableWarning
            ref={(el) => {
              if (el) {
                el.textContent = value == null ? '' : String(value);
                el.focus();
                const range = document.createRange();
                range.selectNodeContents(el);
                range.collapse(false);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
              }
            }}
            className={`w-full px-1 py-0 border border-indigo-400 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800 min-h-[16px] whitespace-pre-wrap ${compact ? 'text-[10px]' : 'text-xs'}`}
            onBlur={(e) => {
              const text = e.currentTarget.textContent || '';
              const newValue = type === 'number' ? (text ? Number(text) : null) : text || null;
              onEdit(actualIndex, field, newValue);
              setEditingCell(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                setEditingCell(null);
              }
            }}
          />
        ) : (
          <div
            onClick={() => setEditingCell({ row: displayIndex, col: field })}
            className={`cursor-text min-h-[14px] pr-4 ${isHumanUnreadable ? 'bg-red-100/50 dark:bg-red-900/30' : ''} ${isAiUnreadable && !isHumanUnreadable ? 'bg-orange-100/50 dark:bg-orange-900/30' : ''}`}
          >
            <span className={value === null || value === undefined ? 'text-slate-400 italic' : ''}>
              {type === 'number' && value != null
                ? Number(value).toLocaleString('es-PA', { minimumFractionDigits: 2 })
                : normalizeValueForDisplay(field, value)}
            </span>
            {Object.keys(altValues).length > 0 && (
              <div className="text-[9px] space-y-0.5 mt-0.5">
                {Object.entries(altValues).map(([modelName, modelValue]) => {
                  const shortName = getShortModelName(modelName);
                  const normalizedCurrent = normalizeValueForComparison(field, value);
                  const normalizedModel = normalizeValueForComparison(field, modelValue);
                  const isSelected = normalizedModel === normalizedCurrent;
                  return (
                    <button
                      key={modelName}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(actualIndex, field, modelValue as string | number | null);
                      }}
                      className={`block w-full text-left py-0 px-0.5 rounded border transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-emerald-400 dark:border-emerald-500 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                          : hasDiff
                            ? 'border-amber-300 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200'
                            : 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected && <span className="mr-0.5">✓</span>}
                      <span className="font-medium">{shortName}:</span>{' '}
                      {type === 'number' && modelValue != null
                        ? Number(modelValue).toLocaleString('es-PA', { minimumFractionDigits: 2 })
                        : normalizeValueForDisplay(field, modelValue)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full text-xs">
      {rows.map((row, displayIndex) => {
        const rowKey = String(row.numeroFacturaRecibo);
        const rowDiffs = diffs.get(rowKey);
        const actualIndex = getActualIndex(row);
        const modelsFound = getModelsForRow(rowKey);
        const isMissingFromSomeModels = modelsFound.length > 0 && modelsFound.length < modelNames.length;

        return (
          <div
            key={displayIndex}
            className={`group border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
              isMissingFromSomeModels ? 'bg-orange-50 dark:bg-orange-900/20' : ''
            }`}
          >
            {/* Model indicators if missing from some models */}
            {isMissingFromSomeModels && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30">
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

            {/* Info row: basic fields */}
            <div className="grid grid-cols-[auto_1fr_1fr_1fr_2fr_auto_auto] gap-1 px-2 py-1 items-start">
              {/* Fecha */}
              <div
                className={`${rowDiffs?.has('fecha') ? 'bg-amber-50 dark:bg-amber-900/30 border-l-2 border-amber-400 pl-1' : ''}`}
              >
                <div className="text-[9px] text-slate-400 uppercase">Fecha</div>
                {renderEditableCell(
                  row,
                  'fecha',
                  row.fecha,
                  displayIndex,
                  actualIndex,
                  rowDiffs?.has('fecha') ?? false,
                  getAlternateValues(rowKey, 'fecha'),
                  'string',
                )}
              </div>

              {/* Factura/Recibo */}
              <div
                className={`${rowDiffs?.has('numeroFacturaRecibo') ? 'bg-amber-50 dark:bg-amber-900/30 border-l-2 border-amber-400 pl-1' : ''}`}
              >
                <div className="text-[9px] text-slate-400 uppercase">Factura/Recibo</div>
                {renderEditableCell(
                  row,
                  'numeroFacturaRecibo',
                  row.numeroFacturaRecibo,
                  displayIndex,
                  actualIndex,
                  rowDiffs?.has('numeroFacturaRecibo') ?? false,
                  getAlternateValues(rowKey, 'numeroFacturaRecibo'),
                  'string',
                )}
              </div>

              {/* Cédula/RUC */}
              <div
                className={`${rowDiffs?.has('cedulaRuc') ? 'bg-amber-50 dark:bg-amber-900/30 border-l-2 border-amber-400 pl-1' : ''}`}
              >
                <div className="text-[9px] text-slate-400 uppercase">Cédula/RUC</div>
                {renderEditableCell(
                  row,
                  'cedulaRuc',
                  row.cedulaRuc,
                  displayIndex,
                  actualIndex,
                  rowDiffs?.has('cedulaRuc') ?? false,
                  getAlternateValues(rowKey, 'cedulaRuc'),
                  'string',
                )}
              </div>

              {/* Proveedor */}
              <div
                className={`${rowDiffs?.has('proveedorNombre') ? 'bg-amber-50 dark:bg-amber-900/30 border-l-2 border-amber-400 pl-1' : ''}`}
              >
                <div className="text-[9px] text-slate-400 uppercase">Proveedor</div>
                {renderEditableCell(
                  row,
                  'proveedorNombre',
                  row.proveedorNombre,
                  displayIndex,
                  actualIndex,
                  rowDiffs?.has('proveedorNombre') ?? false,
                  getAlternateValues(rowKey, 'proveedorNombre'),
                  'string',
                )}
              </div>

              {/* Detalle */}
              <div
                className={`${rowDiffs?.has('detalleGasto') ? 'bg-amber-50 dark:bg-amber-900/30 border-l-2 border-amber-400 pl-1' : ''}`}
              >
                <div className="text-[9px] text-slate-400 uppercase">Detalle</div>
                {renderEditableCell(
                  row,
                  'detalleGasto',
                  row.detalleGasto,
                  displayIndex,
                  actualIndex,
                  rowDiffs?.has('detalleGasto') ?? false,
                  getAlternateValues(rowKey, 'detalleGasto'),
                  'string',
                )}
              </div>

              {/* Tipo Pago */}
              <div
                className={`${rowDiffs?.has('pagoTipo') ? 'bg-amber-50 dark:bg-amber-900/30 border-l-2 border-amber-400 pl-1' : ''}`}
              >
                <div className="text-[9px] text-slate-400 uppercase">Tipo</div>
                {renderEditableCell(
                  row,
                  'pagoTipo',
                  row.pagoTipo,
                  displayIndex,
                  actualIndex,
                  rowDiffs?.has('pagoTipo') ?? false,
                  getAlternateValues(rowKey, 'pagoTipo'),
                  'string',
                )}
              </div>

              {/* Delete button */}
              <div className="flex items-center">
                <Button
                  onClick={() => onDelete(actualIndex)}
                  variant="ghost"
                  size="icon-sm"
                  className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5"
                  title="Eliminar fila"
                >
                  ×
                </Button>
              </div>
            </div>

            {/* Spend grid: 2 rows x 6 columns */}
            <div className="px-2 pb-2">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-md p-1.5 border border-slate-200 dark:border-slate-700">
                {/* Row 1: Campaign expenses */}
                <div className="grid grid-cols-6 gap-1 mb-1">
                  {EGRESS_SPEND_COLUMNS.slice(0, 6).map((col) => {
                    const hasDiff = rowDiffs?.has(col.key);
                    const value = row[col.key];
                    return (
                      <div
                        key={col.key}
                        className={`rounded px-1 py-0.5 ${hasDiff ? 'bg-amber-100 dark:bg-amber-900/40 border border-amber-300' : 'bg-white dark:bg-slate-700/50'}`}
                      >
                        <div className="text-[8px] text-slate-400 dark:text-slate-500 truncate" title={col.label}>
                          {col.label}
                        </div>
                        {renderEditableCell(
                          row,
                          col.key,
                          value,
                          displayIndex,
                          actualIndex,
                          hasDiff ?? false,
                          getAlternateValues(rowKey, col.key),
                          'number',
                          true,
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Row 2: More expenses + totals */}
                <div className="grid grid-cols-6 gap-1">
                  {EGRESS_SPEND_COLUMNS.slice(6).map((col) => {
                    const hasDiff = rowDiffs?.has(col.key);
                    const value = row[col.key];
                    const isTotal = col.key.startsWith('total');
                    return (
                      <div
                        key={col.key}
                        className={`rounded px-1 py-0.5 ${hasDiff ? 'bg-amber-100 dark:bg-amber-900/40 border border-amber-300' : isTotal ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-white dark:bg-slate-700/50'}`}
                      >
                        <div
                          className={`text-[8px] truncate ${isTotal ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}
                          title={col.label}
                        >
                          {col.label}
                        </div>
                        {renderEditableCell(
                          row,
                          col.key,
                          value,
                          displayIndex,
                          actualIndex,
                          hasDiff ?? false,
                          getAlternateValues(rowKey, col.key),
                          'number',
                          true,
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Grand total */}
                <div className="mt-1 pt-1 border-t border-slate-200 dark:border-slate-600">
                  <div className="flex justify-end">
                    <div
                      className={`rounded px-2 py-1 ${rowDiffs?.has(EGRESS_TOTAL_COLUMN.key) ? 'bg-amber-100 dark:bg-amber-900/40 border border-amber-300' : 'bg-indigo-50 dark:bg-indigo-900/30'}`}
                    >
                      <div className="text-[8px] text-indigo-600 dark:text-indigo-400 font-semibold">
                        {EGRESS_TOTAL_COLUMN.label}
                      </div>
                      <div className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                        {renderEditableCell(
                          row,
                          EGRESS_TOTAL_COLUMN.key,
                          row[EGRESS_TOTAL_COLUMN.key],
                          displayIndex,
                          actualIndex,
                          rowDiffs?.has(EGRESS_TOTAL_COLUMN.key) ?? false,
                          getAlternateValues(rowKey, EGRESS_TOTAL_COLUMN.key),
                          'number',
                          false,
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
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
  onToggleUnreadable,
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
                  const altValues = getAlternateValues(rowKey, col.key);
                  const isEditing = editingCell?.row === displayIndex && editingCell?.col === col.key;

                  const isHumanUnreadable = row.humanUnreadableFields?.includes(col.key) ?? false;
                  const isAiUnreadable = row.unreadableFields?.includes(col.key) ?? false;

                  return (
                    <td
                      key={col.key}
                      className={`px-1 py-0.5 relative ${
                        hasDiff ? 'bg-amber-50 dark:bg-amber-900/30 border-l-2 border-amber-400' : ''
                      } ${isHumanUnreadable ? 'bg-red-50 dark:bg-red-900/20' : ''} ${isAiUnreadable && !isHumanUnreadable ? 'bg-orange-50 dark:bg-orange-900/20' : ''}`}
                    >
                      {/* Unreadable toggle button - superscript in top-right */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleUnreadable(actualIndex, col.key);
                        }}
                        className={`absolute -top-0.5 -right-0.5 text-sm leading-none w-5 h-5 flex items-center justify-center rounded-full transition-colors ${
                          isHumanUnreadable
                            ? 'bg-red-400 dark:bg-red-700 text-white font-bold shadow-sm'
                            : isAiUnreadable
                              ? 'bg-orange-400 dark:bg-orange-600 text-white font-bold shadow-sm'
                              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                        title={
                          isHumanUnreadable
                            ? 'Marcar como legible'
                            : isAiUnreadable
                              ? 'IA detectó ilegible - Click para confirmar'
                              : 'Marcar como ilegible'
                        }
                      >
                        ?
                      </button>

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
                        <div
                          contentEditable
                          suppressContentEditableWarning
                          ref={(el) => {
                            if (el) {
                              el.textContent = value == null ? '' : String(value);
                              el.focus();
                              // Move cursor to end
                              const range = document.createRange();
                              range.selectNodeContents(el);
                              range.collapse(false);
                              const sel = window.getSelection();
                              sel?.removeAllRanges();
                              sel?.addRange(range);
                            }
                          }}
                          className="w-full px-1 py-0 text-xs border border-indigo-400 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800 min-h-[16px] whitespace-pre-wrap"
                          onBlur={(e) => {
                            const text = e.currentTarget.textContent || '';
                            const newValue = col.type === 'number' ? (text ? Number(text) : null) : text || null;
                            onEdit(actualIndex, col.key, newValue);
                            setEditingCell(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              e.currentTarget.blur();
                            } else if (e.key === 'Escape') {
                              setEditingCell(null);
                            }
                          }}
                        />
                      ) : (
                        <div
                          onClick={() => setEditingCell({ row: displayIndex, col: col.key })}
                          className="cursor-text min-h-[16px] pr-5"
                        >
                          <span className={value === null ? 'text-slate-400 italic' : ''}>
                            {normalizeValueForDisplay(col.key, value)}
                          </span>
                          {Object.keys(altValues).length > 0 && (
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
                                        : hasDiff
                                          ? 'border-amber-300 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800 hover:border-amber-400 dark:hover:border-amber-500'
                                          : 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
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
