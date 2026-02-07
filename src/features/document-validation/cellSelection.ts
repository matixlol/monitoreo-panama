export type CellId = `${number}:${string}`;

export function makeCellId(rowIndex: number, field: string): CellId {
  return `${rowIndex}:${field}`;
}

export function parseCellId(cellId: CellId): { rowIndex: number; field: string } {
  const [rowIndexRaw, ...fieldParts] = cellId.split(':');
  return { rowIndex: Number(rowIndexRaw), field: fieldParts.join(':') };
}

export function getCellRowIndex(cellId: CellId): number {
  const idx = cellId.indexOf(':');
  return Number(idx === -1 ? cellId : cellId.slice(0, idx));
}

export function isAdditiveMultiSelectEvent(e: Pick<MouseEvent, 'metaKey' | 'ctrlKey'>): boolean {
  return e.metaKey || e.ctrlKey;
}
