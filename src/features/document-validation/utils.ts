import type { EgressRow, IngressRow, ModelExtractions } from './types';

type RowType = 'ingress' | 'egress';

type Row = IngressRow | EgressRow;

function isMeaningfulKeyValue(value: unknown): value is string | number {
  if (value == null) return false;
  const str = String(value).trim();
  if (str === '') return false;
  if (str === 'null') return false;
  if (str === 'undefined') return false;
  return true;
}

export function stableRowKeyForRow(row: Row, keyField: string): string | null {
  const keyValue = (row as Record<string, unknown>)[keyField];
  if (!isMeaningfulKeyValue(keyValue)) return null;
  const page = (row as Record<string, unknown>)['pageNumber'];
  return `${String(page)}::${String(keyValue)}`;
}

export function normalizeCedulaRuc(value: string | null | undefined): string | null {
  if (value == null) return null;
  return value.replace(/-/g, '.');
}

export function normalizeDate(value: string | null | undefined): string | null {
  if (value == null) return null;
  return value.replace(/\./g, '-');
}

export function normalizeValueForComparison(field: string, value: unknown): unknown {
  if (value == null) return value;
  if (typeof value !== 'string') return value;

  if (field === 'cedulaRuc') return normalizeCedulaRuc(value);
  if (field === 'fecha') return normalizeDate(value);
  return value;
}

export function normalizeValueForDisplay(field: string, value: unknown): string {
  if (value == null) return '—';
  if (typeof value !== 'string') return String(value);

  if (field === 'cedulaRuc') return normalizeCedulaRuc(value) ?? '—';
  if (field === 'fecha') return normalizeDate(value) ?? '—';
  return value;
}

export function getShortModelName(modelName: string): string {
  if (modelName.startsWith('gemini-2')) return 'g2';
  if (modelName.startsWith('gemini-3')) return 'g3';
  return modelName.split('-')[0] || modelName.substring(0, 3);
}

export function prioritizeGemini3(modelNames: string[]): string[] {
  return [...modelNames].sort((a, b) => {
    const aIsGemini3 = a.startsWith('gemini-3');
    const bIsGemini3 = b.startsWith('gemini-3');
    if (aIsGemini3 && !bIsGemini3) return -1;
    if (!aIsGemini3 && bIsGemini3) return 1;
    return 0;
  });
}

export function mergeRowsFromAllModels(
  type: RowType,
  keyField: string,
  modelNames: string[],
  extractionsByModel: ModelExtractions,
): Row[] {
  const rowMap = new Map<string, Row>();
  const sortedModelNames = prioritizeGemini3(modelNames);

  for (const modelName of sortedModelNames) {
    const modelData = extractionsByModel[modelName];
    if (!modelData) continue;

    const rows = type === 'ingress' ? modelData.ingress : modelData.egress;
    rows.forEach((row, index) => {
      const stableKey = stableRowKeyForRow(row, keyField);
      const rowKey = stableKey ?? `${String((row as Record<string, unknown>)['pageNumber'])}::__${modelName}__${index}`;
      if (!rowMap.has(rowKey)) {
        rowMap.set(rowKey, { ...row, __rowKey: rowKey, __stableRowKey: stableKey ?? undefined, __sourceModel: modelName });
      }
    });
  }

  return Array.from(rowMap.values());
}

export function getModelsForStableRowKey(
  type: RowType,
  keyField: string,
  stableRowKey: string,
  modelNames: string[],
  extractionsByModel: ModelExtractions,
): string[] {
  const modelsFound: string[] = [];

  for (const modelName of modelNames) {
    const modelData = extractionsByModel[modelName];
    if (!modelData) continue;

    const rows = type === 'ingress' ? modelData.ingress : modelData.egress;
    const found = rows.some((row) => stableRowKeyForRow(row, keyField) === stableRowKey);
    if (found) modelsFound.push(modelName);
  }

  return modelsFound;
}

export function computeDiffs(rows1: Row[], rows2: Row[], keyField: string): Map<string, Set<string>> {
  const diffs = new Map<string, Set<string>>();
  const lookup1 = new Map<string, Row>();
  const lookup2 = new Map<string, Row>();

  for (const row of rows1) {
    const stableKey = stableRowKeyForRow(row, keyField);
    if (!stableKey) continue;
    lookup1.set(stableKey, row);
  }
  for (const row of rows2) {
    const stableKey = stableRowKeyForRow(row, keyField);
    if (!stableKey) continue;
    lookup2.set(stableKey, row);
  }

  for (const [key, row1] of lookup1) {
    const row2 = lookup2.get(key);
    if (!row2) continue;

    const diffFields = new Set<string>();
    const allFields = new Set([...Object.keys(row1), ...Object.keys(row2)]);
    for (const field of allFields) {
      const v1 = (row1 as Record<string, unknown>)[field];
      const v2 = (row2 as Record<string, unknown>)[field];
      const normalizedV1 = normalizeValueForComparison(field, v1);
      const normalizedV2 = normalizeValueForComparison(field, v2);
      if (normalizedV1 !== normalizedV2) diffFields.add(field);
    }

    if (diffFields.size > 0) diffs.set(key, diffFields);
  }

  return diffs;
}

export function getAlternateValues(
  type: RowType,
  rowKey: string,
  keyField: string,
  field: string,
  modelNames: string[],
  modelData: ModelExtractions,
): Record<string, unknown> {
  const alternates: Record<string, unknown> = {};

  for (const modelName of modelNames) {
    const model = modelData[modelName];
    if (!model) continue;

    const rows = type === 'ingress' ? model.ingress : model.egress;
    const row = rows.find((r) => stableRowKeyForRow(r as Row, keyField) === rowKey);
    if (row) {
      alternates[modelName] = (row as Record<string, unknown>)[field];
    }
  }

  return alternates;
}
