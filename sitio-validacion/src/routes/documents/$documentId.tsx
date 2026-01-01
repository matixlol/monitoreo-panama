import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useState, useCallback, useMemo } from 'react';
import type { Id } from '../../../convex/_generated/dataModel';
import type { OptimisticLocalStore } from 'convex/react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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
  { key: 'total', label: 'Total', type: 'number' },
];

const EGRESS_COLUMNS: { key: keyof EgressRow; label: string; type: 'string' | 'number' }[] = [
  { key: 'pageNumber', label: 'Pág', type: 'number' },
  { key: 'fecha', label: 'Fecha', type: 'string' },
  { key: 'numeroFacturaRecibo', label: 'Factura/Recibo', type: 'string' },
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
  const setPageRotation = useMutation(api.documents.setPageRotation).withOptimisticUpdate(
    (localStore: OptimisticLocalStore, args) => {
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
    },
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'ingress' | 'egress'>('ingress');
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
            if (v1 !== v2) {
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

  // Get current data to display (edited or from first model)
  const currentIngress = useMemo(() => {
    if (editedIngress) return editedIngress;
    if (validatedData) return validatedData.ingress as unknown as IngressRow[];
    const firstModel = modelNames[0];
    return firstModel ? extractionsByModel[firstModel]?.ingress || [] : [];
  }, [editedIngress, validatedData, modelNames, extractionsByModel]);

  const currentEgress = useMemo(() => {
    if (editedEgress) return editedEgress;
    if (validatedData) return validatedData.egress as unknown as EgressRow[];
    const firstModel = modelNames[0];
    return firstModel ? extractionsByModel[firstModel]?.egress || [] : [];
  }, [editedEgress, validatedData, modelNames, extractionsByModel]);

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
      const rows = editedIngress || [...currentIngress];
      const row = { ...rows[rowIndex] };
      (row as Record<string, unknown>)[field] = value;
      rows[rowIndex] = row as IngressRow;
      setEditedIngress(rows);
    } else {
      const rows = editedEgress || [...currentEgress];
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
      const rows = editedIngress || [...currentIngress];
      rows.splice(rowIndex, 1);
      setEditedIngress([...rows]);
    } else {
      const rows = editedEgress || [...currentEgress];
      rows.splice(rowIndex, 1);
      setEditedEgress([...rows]);
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

  // Find rows with diffs for quick navigation
  const rowsWithDiffs = useMemo(() => {
    const diffs = activeTab === 'ingress' ? ingressDiffs : egressDiffs;
    const rows = activeTab === 'ingress' ? currentIngress : currentEgress;
    const keyField = activeTab === 'ingress' ? 'reciboNumero' : 'numeroFacturaRecibo';

    return rows
      .map((row, index) => ({
        index,
        row,
        hasDiff: diffs.has(String((row as Record<string, unknown>)[keyField])),
      }))
      .filter((r) => r.hasDiff);
  }, [activeTab, ingressDiffs, egressDiffs, currentIngress, currentEgress]);

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
            {rowsWithDiffs.length > 0 && (
              <span className="text-sm text-amber-600 dark:text-amber-400">
                ⚠ {rowsWithDiffs.length} diferencias entre modelos
              </span>
            )}

            <button
              onClick={handleSave}
              disabled={!hasEdits || isSaving}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                hasEdits && !isSaving
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isSaving ? 'Guardando...' : 'Guardar Validación'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-57px)]">
        {/* PDF Viewer Panel */}
        <div className="w-1/2 border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 flex flex-col">
          {/* PDF Controls */}
          <div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-center gap-4">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1 bg-slate-200 dark:bg-slate-700 rounded disabled:opacity-50"
            >
              ←
            </button>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Página {currentPage} de {document.pageCount}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(document.pageCount, p + 1))}
              disabled={currentPage >= document.pageCount}
              className="px-3 py-1 bg-slate-200 dark:bg-slate-700 rounded disabled:opacity-50"
            >
              →
            </button>
            <div className="w-px h-6 bg-slate-300 dark:bg-slate-600" />
            <button
              onClick={handleRotate}
              className="px-3 py-1 bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-1"
              title="Rotar página 90°"
            >
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
              <span className="text-sm">Rotar</span>
            </button>
          </div>

          {/* PDF Embed */}
          <div className="flex-1 overflow-auto p-4">
            <div className="min-w-fit flex justify-center">
              {document.fileUrl ? (
                <Document
                  file={document.fileUrl}
                  loading={
                    <div className="flex items-center justify-center h-full text-slate-500">Cargando PDF...</div>
                  }
                  error={
                    <div className="flex items-center justify-center h-full text-red-500">Error al cargar el PDF</div>
                  }
                >
                  <Page
                    pageNumber={currentPage}
                    className="rounded-lg shadow-lg"
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    rotate={getCurrentRotation()}
                    loading={
                      <div className="flex items-center justify-center h-64 text-slate-500">Cargando página...</div>
                    }
                  />
                </Document>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">No se pudo cargar el PDF</div>
              )}
            </div>
          </div>
        </div>

        {/* Data Panel */}
        <div className="w-1/2 flex flex-col bg-white dark:bg-slate-900">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('ingress')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'ingress'
                  ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Ingresos ({currentIngress.length})
            </button>
            <button
              onClick={() => setActiveTab('egress')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'egress'
                  ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Gastos ({currentEgress.length})
            </button>
          </div>

          {/* Diff Navigation */}
          {rowsWithDiffs.length > 0 && (
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-center gap-2 overflow-x-auto">
              <span className="text-xs text-amber-700 dark:text-amber-400 whitespace-nowrap">Ir a diferencia:</span>
              {rowsWithDiffs.slice(0, 10).map(({ index, row }) => (
                <button
                  key={index}
                  onClick={() => goToPage(row.pageNumber)}
                  className="px-2 py-1 text-xs bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded hover:bg-amber-300"
                >
                  Pág {row.pageNumber}
                </button>
              ))}
              {rowsWithDiffs.length > 10 && (
                <span className="text-xs text-amber-600">+{rowsWithDiffs.length - 10} más</span>
              )}
            </div>
          )}

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {activeTab === 'ingress' ? (
              <DataTable
                columns={INGRESS_COLUMNS as { key: string; label: string; type: 'string' | 'number' }[]}
                rows={currentIngress}
                diffs={ingressDiffs}
                keyField="reciboNumero"
                modelData={extractionsByModel}
                onEdit={(rowIndex, field, value) => handleCellEdit('ingress', rowIndex, field, value)}
                onDelete={(rowIndex) => handleDeleteRow('ingress', rowIndex)}
                onGoToPage={goToPage}
              />
            ) : (
              <DataTable
                columns={EGRESS_COLUMNS as { key: string; label: string; type: 'string' | 'number' }[]}
                rows={currentEgress}
                diffs={egressDiffs}
                keyField="numeroFacturaRecibo"
                modelData={extractionsByModel}
                onEdit={(rowIndex, field, value) => handleCellEdit('egress', rowIndex, field, value)}
                onDelete={(rowIndex) => handleDeleteRow('egress', rowIndex)}
                onGoToPage={goToPage}
              />
            )}
          </div>

          {/* Add Row Button */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => handleAddRow(activeTab)}
              className="w-full px-4 py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
            >
              + Agregar fila
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// DataTable Component
interface DataTableProps {
  columns: { key: string; label: string; type: 'string' | 'number' }[];
  rows: (IngressRow | EgressRow)[];
  diffs: Map<string, Set<string>>;
  keyField: string;
  modelData: Record<string, { ingress: IngressRow[]; egress: EgressRow[] }>;
  onEdit: (rowIndex: number, field: string, value: string | number | null) => void;
  onDelete: (rowIndex: number) => void;
  onGoToPage: (page: number) => void;
}

function DataTable({ columns, rows, diffs, keyField, modelData, onEdit, onDelete, onGoToPage }: DataTableProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);

  const modelNames = Object.keys(modelData);

  const getAlternateValue = (rowKey: string, field: string) => {
    if (modelNames.length < 2) return null;
    const model2 = modelData[modelNames[1]!];
    if (!model2) return null;

    const dataArray = 'reciboNumero' in (rows[0] || {}) ? model2.ingress : model2.egress;
    const row = dataArray.find(
      (r: IngressRow | EgressRow) => String((r as Record<string, unknown>)[keyField]) === rowKey,
    );
    return row ? (row as Record<string, unknown>)[field] : null;
  };

  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap"
            >
              {col.label}
            </th>
          ))}
          <th className="px-3 py-2 w-10"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((row, rowIndex) => {
          const rowKey = String((row as Record<string, unknown>)[keyField]);
          const rowDiffs = diffs.get(rowKey);

          return (
            <tr key={rowIndex} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              {columns.map((col) => {
                const value = (row as Record<string, unknown>)[col.key];
                const hasDiff = rowDiffs?.has(col.key);
                const altValue = hasDiff ? getAlternateValue(rowKey, col.key) : null;
                const isEditing = editingCell?.row === rowIndex && editingCell?.col === col.key;

                return (
                  <td
                    key={col.key}
                    className={`px-3 py-2 ${
                      hasDiff ? 'bg-amber-50 dark:bg-amber-900/30 border-l-2 border-amber-400' : ''
                    }`}
                  >
                    {col.key === 'pageNumber' ? (
                      <button
                        onClick={() => onGoToPage(row.pageNumber)}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                      >
                        {value as number}
                      </button>
                    ) : isEditing ? (
                      <input
                        type={col.type === 'number' ? 'number' : 'text'}
                        defaultValue={value === null ? '' : String(value)}
                        autoFocus
                        className="w-full px-2 py-1 border border-indigo-400 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800"
                        onBlur={(e) => {
                          const newValue =
                            col.type === 'number'
                              ? e.target.value
                                ? Number(e.target.value)
                                : null
                              : e.target.value || null;
                          onEdit(rowIndex, col.key, newValue);
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
                        onClick={() => setEditingCell({ row: rowIndex, col: col.key })}
                        className="cursor-text min-h-[24px] group"
                      >
                        <span className={value === null ? 'text-slate-400 italic' : ''}>
                          {value === null ? '—' : String(value)}
                        </span>
                        {hasDiff && altValue !== undefined && (
                          <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            Alt: {altValue === null ? '—' : String(altValue)}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
              <td className="px-2 py-2">
                <button
                  onClick={() => onDelete(rowIndex)}
                  className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Eliminar fila"
                >
                  ×
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
