import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/api';
import type { Id } from '@convex/dataModel';
import {
  createEgressRow,
  createIngressRow,
  EGRESS_KEY_FIELD,
  INGRESS_KEY_FIELD,
  type EgressRow,
  type IngressRow,
  type ModelExtractions,
} from './types';
import { computeDiffs, getModelsForStableRowKey, mergeRowsFromAllModels } from './utils';

type RowType = 'ingress' | 'egress';

type DocumentValidationState = {
  document: any;
  extractions: any;
  validatedData: any;
  isSaving: boolean;
  hasEdits: boolean;
  currentPage: number;
  currentPageIngressRows: IngressRow[];
  currentPageEgressRows: EgressRow[];
  currentIngress: IngressRow[];
  currentEgress: EgressRow[];
  ingressDiffs: Map<string, Set<string>>;
  egressDiffs: Map<string, Set<string>>;
  pagesWithDiffs: number[];
  pagesWithUnreadables: number[];
  hasIngressOnPage: boolean;
  hasEgressOnPage: boolean;
  modelNames: string[];
  extractionsByModel: ModelExtractions;
  getIngressModelsForRow: (rowKey: string) => string[];
  getEgressModelsForRow: (rowKey: string) => string[];
  handleCellEdit: (type: RowType, rowIndex: number, field: string, value: string | number | null) => void;
  handleAddRow: (type: RowType) => void;
  handleDeleteRow: (type: RowType, rowIndex: number) => void;
  handleToggleUnreadable: (type: RowType, rowIndex: number, field: string) => void;
  handleSave: () => Promise<void>;
  handleRerunExtraction: () => Promise<void>;
  goToPage: (pageNumber: number) => void;
  handleRotate: () => void;
  getCurrentRotation: () => number;
  setCurrentPage: (pageNumber: number) => void;
};

export function useDocumentValidationData(documentId: string): DocumentValidationState {
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

  const storageKey = `document-page-${documentId}`;
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? parseInt(saved, 10) : 1;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, String(currentPage));
  }, [storageKey, currentPage]);

  const [editedIngress, setEditedIngress] = useState<IngressRow[] | null>(null);
  const [editedEgress, setEditedEgress] = useState<EgressRow[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const extractionsByModel = useMemo((): ModelExtractions => {
    if (!extractions) return {};
    const result: ModelExtractions = {};
    for (const ext of extractions) {
      result[ext.model] = {
        ingress: ext.ingress as unknown as IngressRow[],
        egress: ext.egress as unknown as EgressRow[],
      };
    }
    return result;
  }, [extractions]);

  const modelNames = useMemo(() => Object.keys(extractionsByModel), [extractionsByModel]);

  const computedIngress = useMemo(() => {
    if (validatedData) return validatedData.ingress as unknown as IngressRow[];
    return mergeRowsFromAllModels('ingress', INGRESS_KEY_FIELD, modelNames, extractionsByModel) as IngressRow[];
  }, [validatedData, modelNames, extractionsByModel]);

  const computedEgress = useMemo(() => {
    if (validatedData) return validatedData.egress as unknown as EgressRow[];
    return mergeRowsFromAllModels('egress', EGRESS_KEY_FIELD, modelNames, extractionsByModel) as EgressRow[];
  }, [validatedData, modelNames, extractionsByModel]);

  const currentIngress = editedIngress ?? computedIngress;
  const currentEgress = editedEgress ?? computedEgress;

  const ingressDiffs = useMemo(() => {
    if (modelNames.length < 2) return new Map<string, Set<string>>();
    const model1 = extractionsByModel[modelNames[0]!];
    const model2 = extractionsByModel[modelNames[1]!];
    if (!model1 || !model2) return new Map<string, Set<string>>();
    return computeDiffs(model1.ingress, model2.ingress, INGRESS_KEY_FIELD);
  }, [modelNames, extractionsByModel]);

  const egressDiffs = useMemo(() => {
    if (modelNames.length < 2) return new Map<string, Set<string>>();
    const model1 = extractionsByModel[modelNames[0]!];
    const model2 = extractionsByModel[modelNames[1]!];
    if (!model1 || !model2) return new Map<string, Set<string>>();
    return computeDiffs(model1.egress, model2.egress, EGRESS_KEY_FIELD);
  }, [modelNames, extractionsByModel]);

  const handleCellEdit = useCallback(
    (type: RowType, rowIndex: number, field: string, value: string | number | null) => {
      if (type === 'ingress') {
        const rows = [...(editedIngress || computedIngress)];
        const row = { ...rows[rowIndex] } as IngressRow;
        (row as Record<string, unknown>)[field] = value;
        rows[rowIndex] = row;
        setEditedIngress(rows);
      } else {
        const rows = [...(editedEgress || computedEgress)];
        const row = { ...rows[rowIndex] } as EgressRow;
        (row as Record<string, unknown>)[field] = value;
        rows[rowIndex] = row;
        setEditedEgress(rows);
      }
    },
    [computedEgress, computedIngress, editedEgress, editedIngress],
  );

  const handleAddRow = useCallback(
    (type: RowType) => {
      if (type === 'ingress') {
        const rows = editedIngress || [...computedIngress];
        setEditedIngress([...rows, createIngressRow(currentPage)]);
      } else {
        const rows = editedEgress || [...computedEgress];
        setEditedEgress([...rows, createEgressRow(currentPage)]);
      }
    },
    [computedEgress, computedIngress, currentPage, editedEgress, editedIngress],
  );

  const handleDeleteRow = useCallback(
    (type: RowType, rowIndex: number) => {
      if (type === 'ingress') {
        const rows = [...(editedIngress || computedIngress)];
        rows.splice(rowIndex, 1);
        setEditedIngress(rows);
      } else {
        const rows = [...(editedEgress || computedEgress)];
        rows.splice(rowIndex, 1);
        setEditedEgress(rows);
      }
    },
    [computedEgress, computedIngress, editedEgress, editedIngress],
  );

  const handleToggleUnreadable = useCallback(
    (type: RowType, rowIndex: number, field: string) => {
      if (type === 'ingress') {
        const rows = [...(editedIngress || computedIngress)];
        const row = { ...rows[rowIndex] } as IngressRow;
        const unreadableFields = row.humanUnreadableFields ? [...row.humanUnreadableFields] : [];
        const fieldIndex = unreadableFields.indexOf(field);
        if (fieldIndex === -1) unreadableFields.push(field);
        else unreadableFields.splice(fieldIndex, 1);
        row.humanUnreadableFields = unreadableFields;
        rows[rowIndex] = row;
        setEditedIngress(rows);
      } else {
        const rows = [...(editedEgress || computedEgress)];
        const row = { ...rows[rowIndex] } as EgressRow;
        const unreadableFields = row.humanUnreadableFields ? [...row.humanUnreadableFields] : [];
        const fieldIndex = unreadableFields.indexOf(field);
        if (fieldIndex === -1) unreadableFields.push(field);
        else unreadableFields.splice(fieldIndex, 1);
        row.humanUnreadableFields = unreadableFields;
        rows[rowIndex] = row;
        setEditedEgress(rows);
      }
    },
    [computedEgress, computedIngress, editedEgress, editedIngress],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const stripUnreadableFields = <T extends Record<string, unknown>>(rows: T[]): T[] =>
        rows.map(({ unreadableFields, __rowKey, __stableRowKey, __sourceModel, ...rest }) => rest as T);

      await saveValidatedData({
        documentId: documentId as Id<'documents'>,
        ingress: stripUnreadableFields(editedIngress || computedIngress) as any,
        egress: stripUnreadableFields(editedEgress || computedEgress) as any,
      });
      setEditedIngress(null);
      setEditedEgress(null);
    } catch (error) {
      console.error('Save failed:', error);
      alert(`Error al guardar: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsSaving(false);
    }
  }, [computedEgress, computedIngress, documentId, editedEgress, editedIngress, saveValidatedData]);

  const handleRerunExtraction = useCallback(async () => {
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
  }, [documentId, retryExtraction]);

  const goToPage = useCallback((pageNumber: number) => {
    setCurrentPage(pageNumber);
  }, []);

  const getCurrentRotation = useCallback(() => {
    return document?.pageRotations?.[String(currentPage)] ?? 0;
  }, [document?.pageRotations, currentPage]);

  const handleRotate = useCallback(() => {
    const currentRotation = getCurrentRotation();
    const newRotation = (currentRotation + 90) % 360;
    setPageRotation({
      documentId: documentId as Id<'documents'>,
      pageNumber: currentPage,
      rotation: newRotation,
    });
  }, [currentPage, documentId, getCurrentRotation, setPageRotation]);

  const pagesWithDiffs = useMemo(() => {
    const pageSet = new Set<number>();

    for (const row of currentIngress) {
      const stableKey = row.__stableRowKey;
      if (stableKey && ingressDiffs.has(stableKey)) pageSet.add(row.pageNumber);
    }

    for (const row of currentEgress) {
      const stableKey = row.__stableRowKey;
      if (stableKey && egressDiffs.has(stableKey)) pageSet.add(row.pageNumber);
    }

    return Array.from(pageSet).sort((a, b) => a - b);
  }, [ingressDiffs, egressDiffs, currentIngress, currentEgress]);

  const pagesWithUnreadables = useMemo(() => {
    const pageSet = new Set<number>();

    for (const row of currentIngress) {
      if (row.unreadableFields && row.unreadableFields.length > 0) pageSet.add(row.pageNumber);
    }

    for (const row of currentEgress) {
      if (row.unreadableFields && row.unreadableFields.length > 0) pageSet.add(row.pageNumber);
    }

    return Array.from(pageSet).sort((a, b) => a - b);
  }, [currentIngress, currentEgress]);

  const currentPageIngressRows = useMemo(() => {
    return currentIngress.filter((row) => row.pageNumber === currentPage);
  }, [currentIngress, currentPage]);

  const currentPageEgressRows = useMemo(() => {
    return currentEgress.filter((row) => row.pageNumber === currentPage);
  }, [currentEgress, currentPage]);

  const hasIngressOnPage = currentPageIngressRows.length > 0;
  const hasEgressOnPage = currentPageEgressRows.length > 0;

  const hasEdits = editedIngress !== null || editedEgress !== null;

  const getIngressModelsForRow = useCallback(
    (stableRowKey: string) =>
      getModelsForStableRowKey('ingress', INGRESS_KEY_FIELD, stableRowKey, modelNames, extractionsByModel),
    [modelNames, extractionsByModel],
  );

  const getEgressModelsForRow = useCallback(
    (stableRowKey: string) =>
      getModelsForStableRowKey('egress', EGRESS_KEY_FIELD, stableRowKey, modelNames, extractionsByModel),
    [modelNames, extractionsByModel],
  );

  return {
    document,
    extractions,
    validatedData,
    isSaving,
    hasEdits,
    currentPage,
    currentPageIngressRows,
    currentPageEgressRows,
    currentIngress,
    currentEgress,
    ingressDiffs,
    egressDiffs,
    pagesWithDiffs,
    pagesWithUnreadables,
    hasIngressOnPage,
    hasEgressOnPage,
    modelNames,
    extractionsByModel,
    getIngressModelsForRow,
    getEgressModelsForRow,
    handleCellEdit,
    handleAddRow,
    handleDeleteRow,
    handleToggleUnreadable,
    handleSave,
    handleRerunExtraction,
    goToPage,
    handleRotate,
    getCurrentRotation,
    setCurrentPage,
  };
}
