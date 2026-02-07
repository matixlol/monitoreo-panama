import type { CellId } from './cellSelection';
import { makeCellId, parseCellId } from './cellSelection';

type ShiftDirection = 'left' | 'right';

function isNonEmpty(value: unknown): boolean {
  return value != null && value !== '';
}

function toEditValue(value: unknown): string | number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' || typeof value === 'string') return value;
  // Fallback: preserve something rather than crashing; callers should target primitive fields.
  return String(value);
}

function dirToDelta(direction: ShiftDirection): -1 | 1 {
  return direction === 'left' ? -1 : 1;
}

export type ShiftResult = {
  edits: Array<{ rowIndex: number; field: string; value: string | number | null }>;
  nextSelection: Set<CellId>;
  skippedMoves: number;
};

/**
 * Shifts selected cells by one column within a fixed ordered list of columns.
 *
 * Behavior:
 * - When a row has 1 selected cell: swap with destination if occupied, otherwise move (dest <- src, src <- null).
 * - When a row has >1 selected cells: shift as a block using a snapshot of row values.
 *   - Never overwrite a non-selected destination cell that already has a value; those moves are skipped.
 */
export function shiftSelectedCells<Row extends Record<string, any>>({
  allRows,
  selectedCells,
  orderedFields,
  direction,
}: {
  allRows: Row[];
  selectedCells: Set<CellId>;
  orderedFields: string[];
  direction: ShiftDirection;
}): ShiftResult {
  const delta = dirToDelta(direction);

  const byRow = new Map<number, Set<string>>();
  for (const cellId of selectedCells) {
    const { rowIndex, field } = parseCellId(cellId);
    if (!byRow.has(rowIndex)) byRow.set(rowIndex, new Set());
    byRow.get(rowIndex)!.add(field);
  }

  const fieldToIndex = new Map<string, number>();
  orderedFields.forEach((f, idx) => fieldToIndex.set(f, idx));

  const edits: ShiftResult['edits'] = [];
  const nextSelection = new Set<CellId>();
  let skippedMoves = 0;

  for (const [rowIndex, fields] of byRow.entries()) {
    const row = allRows[rowIndex];
    if (!row) continue;

    const selectedInOrder = Array.from(fields)
      .map((f) => ({ field: f, idx: fieldToIndex.get(f) }))
      .filter((x): x is { field: string; idx: number } => typeof x.idx === 'number')
      .sort((a, b) => a.idx - b.idx);

    if (selectedInOrder.length === 0) continue;

    // Single-cell: swap if needed.
    if (selectedInOrder.length === 1) {
      const src = selectedInOrder[0]!;
      const destIdx = src.idx + delta;
      if (destIdx < 0 || destIdx >= orderedFields.length) {
        nextSelection.add(makeCellId(rowIndex, src.field));
        continue;
      }

      const destField = orderedFields[destIdx]!;
      const srcVal = row[src.field];
      const destVal = row[destField];

      if (!isNonEmpty(srcVal)) {
        nextSelection.add(makeCellId(rowIndex, src.field));
        continue;
      }

      // Swap if destination occupied, otherwise move.
      edits.push({ rowIndex, field: destField, value: toEditValue(srcVal) });
      edits.push({ rowIndex, field: src.field, value: toEditValue(destVal) });
      nextSelection.add(makeCellId(rowIndex, destField));
      continue;
    }

    // Multi-cell: compute a simultaneous shift based on the snapshot.
    const selectedIdxSet = new Set<number>(selectedInOrder.map((x) => x.idx));
    const destinations = new Map<string, any>();
    const outgoing = new Set<string>();

    for (const { field: srcField, idx: srcIdx } of selectedInOrder) {
      const destIdx = srcIdx + delta;
      if (destIdx < 0 || destIdx >= orderedFields.length) {
        // Can't move outside; keep selection at source.
        nextSelection.add(makeCellId(rowIndex, srcField));
        continue;
      }

      const destField = orderedFields[destIdx]!;
      const srcVal = row[srcField];
      if (!isNonEmpty(srcVal)) {
        nextSelection.add(makeCellId(rowIndex, srcField));
        continue;
      }

      const destIsSelected = selectedIdxSet.has(destIdx);
      const destVal = row[destField];
      const destOccupied = isNonEmpty(destVal);

      // Don't overwrite non-selected occupied destinations.
      if (!destIsSelected && destOccupied) {
        skippedMoves += 1;
        nextSelection.add(makeCellId(rowIndex, srcField));
        continue;
      }

      destinations.set(destField, srcVal);
      outgoing.add(srcField);
      nextSelection.add(makeCellId(rowIndex, destField));
    }

    // Apply incoming values.
    for (const [field, value] of destinations.entries()) {
      edits.push({ rowIndex, field, value: toEditValue(value) });
    }

    // Clear vacated sources that did not receive an incoming value.
    for (const srcField of outgoing) {
      if (!destinations.has(srcField)) {
        edits.push({ rowIndex, field: srcField, value: null });
      }
    }
  }

  return { edits, nextSelection, skippedMoves };
}
