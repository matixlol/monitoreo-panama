import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { EditableCell } from './EditableCell';
import { getCellRowIndex, isAdditiveMultiSelectEvent, makeCellId, parseCellId, type CellId } from './cellSelection';
import { shiftSelectedCells } from './shiftSelectedCells';
import { INGRESS_COLUMNS, type IngressRow } from './types';
import { normalizeValueForDisplay } from './utils';

type Props = {
  rows: IngressRow[];
  allRows: IngressRow[];
  onEdit: (rowIndex: number, field: string, value: string | number | null) => void;
  onDelete: (rowIndex: number) => void;
  onToggleUnreadable: (rowIndex: number, field: string) => void;
  readOnly?: boolean;
};

const columnHelper = createColumnHelper<IngressRow>();

export function IngressTable({ rows, allRows, onEdit, onDelete, onToggleUnreadable, readOnly = false }: Props) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<CellId>>(() => new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<CellId | null>(null);
  const [shiftNote, setShiftNote] = useState<string | null>(null);
  const theadRef = useRef<HTMLTableSectionElement | null>(null);
  // Reasonable default so the toolbar doesn't overlap the header before measurement runs.
  const [theadHeight, setTheadHeight] = useState<number>(28);
  const [dragSelect, setDragSelect] = useState<{
    field: string;
    startRowIndex: number;
    base: Set<CellId>;
  } | null>(null);

  const moneyFieldOrder = useMemo(
    () => INGRESS_COLUMNS.filter((c) => c.key !== 'pageNumber' && c.type === 'number').map((c) => String(c.key)),
    [],
  );
  const moneyFieldSet = useMemo(() => new Set(moneyFieldOrder), [moneyFieldOrder]);
  const visibleRowIndices = useMemo(
    () => rows.map((r) => allRows.indexOf(r)).filter((idx) => idx >= 0),
    [rows, allRows],
  );

  useEffect(() => {
    const visible = new Set(visibleRowIndices);
    setSelectedCells((prev) => {
      const next = new Set<CellId>();
      for (const id of prev) {
        if (visible.has(getCellRowIndex(id))) next.add(id);
      }
      return next.size === prev.size ? prev : next;
    });
    setSelectionAnchor((prev) => (prev && visible.has(getCellRowIndex(prev)) ? prev : null));
  }, [visibleRowIndices]);

  useEffect(() => {
    if (!dragSelect) return;
    const onMouseUp = () => setDragSelect(null);
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [dragSelect]);

  const clearSelection = () => {
    setSelectedCells(new Set());
    setSelectionAnchor(null);
    setShiftNote(null);
  };

  const makeRangeSelection = (field: string, startRowIndex: number, endRowIndex: number) => {
    const startPos = visibleRowIndices.indexOf(startRowIndex);
    const endPos = visibleRowIndices.indexOf(endRowIndex);
    if (startPos === -1 || endPos === -1) return new Set<CellId>();
    const lo = Math.min(startPos, endPos);
    const hi = Math.max(startPos, endPos);
    const next = new Set<CellId>();
    for (let i = lo; i <= hi; i += 1) next.add(makeCellId(visibleRowIndices[i]!, field));
    return next;
  };

  const beginDragSelect = (e: Pick<MouseEvent, 'metaKey' | 'ctrlKey'>, cellId: CellId) => {
    if (readOnly) return;
    const { rowIndex, field } = parseCellId(cellId);
    const additive = isAdditiveMultiSelectEvent(e);

    setSelectedCells((prev) => {
      const base = additive ? new Set(prev) : new Set<CellId>();
      base.add(makeCellId(rowIndex, field));
      setDragSelect({ field, startRowIndex: rowIndex, base });
      return base;
    });

    setSelectionAnchor(makeCellId(rowIndex, field));
    setShiftNote(null);
  };

  const continueDragSelect = (cellId: CellId) => {
    if (!dragSelect) return;
    const { rowIndex, field } = parseCellId(cellId);
    if (field !== dragSelect.field) return;
    const range = makeRangeSelection(dragSelect.field, dragSelect.startRowIndex, rowIndex);
    setSelectedCells(() => {
      const next = new Set<CellId>(dragSelect.base);
      for (const id of range) next.add(id);
      return next;
    });
  };

  const selectCell = (e: Pick<MouseEvent, 'shiftKey' | 'metaKey' | 'ctrlKey'>, cellId: CellId) => {
    if (readOnly) return;
    const additive = isAdditiveMultiSelectEvent(e);
    const isRange = e.shiftKey;

    setSelectedCells((prev) => {
      const next = additive ? new Set(prev) : new Set<CellId>();

      if (isRange && selectionAnchor) {
        const [anchorRowRaw, anchorField] = selectionAnchor.split(':');
        const [rowRaw, field] = cellId.split(':');
        const anchorRow = Number(anchorRowRaw);
        const rowIndex = Number(rowRaw);

        if (anchorField === field) {
          const anchorPos = visibleRowIndices.indexOf(anchorRow);
          const clickPos = visibleRowIndices.indexOf(rowIndex);
          if (anchorPos !== -1 && clickPos !== -1) {
            const start = Math.min(anchorPos, clickPos);
            const end = Math.max(anchorPos, clickPos);
            for (let i = start; i <= end; i += 1) {
              next.add(makeCellId(visibleRowIndices[i]!, field));
            }
            return next;
          }
        }
      }

      if (next.has(cellId)) next.delete(cellId);
      else next.add(cellId);
      return next;
    });

    setSelectionAnchor(cellId);
    setShiftNote(null);
  };

  const shiftSelection = (direction: 'left' | 'right') => {
    if (readOnly) return;
    const result = shiftSelectedCells<IngressRow>({
      allRows,
      selectedCells,
      orderedFields: moneyFieldOrder,
      direction,
    });

    for (const edit of result.edits) {
      onEdit(edit.rowIndex, edit.field, edit.value);
    }

    setSelectedCells(result.nextSelection);
    setSelectionAnchor(null);
    setShiftNote(
      result.skippedMoves > 0 ? `Se omitieron ${result.skippedMoves} movimientos (destino no vacío).` : null,
    );
  };

  const columns = useMemo<ColumnDef<IngressRow, any>[]>(() => {
    const dataColumns = INGRESS_COLUMNS.filter((col) => col.key !== 'pageNumber').map((col) =>
      columnHelper.accessor(col.key, {
        id: col.key,
        header: col.label,
        cell: (info) => {
          const row = info.row.original;
          const actualIndex = allRows.indexOf(row);
          const isEditing = !readOnly && editingCell?.row === info.row.index && editingCell?.col === col.key;
          const isHumanUnreadable = row.humanUnreadableFields?.includes(col.key) ?? false;
          const isAiUnreadable = row.unreadableFields?.includes(col.key) ?? false;

          return (
            <EditableCell
              field={col.key}
              value={info.getValue()}
              type={col.type}
              isEditing={isEditing}
              onStartEdit={() => {
                if (readOnly) return;
                setEditingCell({ row: info.row.index, col: col.key });
              }}
              onStopEdit={() => setEditingCell(null)}
              onEdit={(value) => {
                if (readOnly) return;
                onEdit(actualIndex, col.key, value);
              }}
              onNavigateVertical={(direction) => {
                if (readOnly) return;
                const nextRowIndex = info.row.index + (direction === 'down' ? 1 : -1);
                const rowCount = info.table.getRowModel().rows.length;
                if (nextRowIndex < 0 || nextRowIndex >= rowCount) {
                  setEditingCell(null);
                  return;
                }
                setEditingCell({ row: nextRowIndex, col: col.key });
              }}
              isHumanUnreadable={isHumanUnreadable}
              isAiUnreadable={isAiUnreadable}
              onToggleUnreadable={() => {
                if (readOnly) return;
                onToggleUnreadable(actualIndex, col.key);
              }}
              formatValue={(field, value, _type) => normalizeValueForDisplay(field, value)}
              variant="table"
              readOnly={readOnly}
            />
          );
        },
      }),
    );

    if (readOnly) {
      return dataColumns;
    }

    return [
      ...dataColumns,
      columnHelper.display({
        id: 'actions',
        cell: (info) => {
          const row = info.row.original;
          const actualIndex = allRows.indexOf(row);
          return (
            <Button
              onClick={() => onDelete(actualIndex)}
              variant="ghost"
              size="icon-sm"
              className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5"
              title="Eliminar fila"
            >
              ×
            </Button>
          );
        },
      }),
    ];
  }, [allRows, editingCell, onDelete, onEdit, onToggleUnreadable, readOnly]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  useLayoutEffect(() => {
    const el = theadRef.current;
    if (!el) return;

    const update = () => {
      // Use a stable px height for sticky offset.
      const next = el.getBoundingClientRect().height;
      setTheadHeight((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
    };

    update();

    // Keep the sticky offset correct when header wraps (responsive) or fonts load.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => update()) : null;
    ro?.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const stickyColSpan = useMemo(() => {
    return table.getVisibleLeafColumns().filter((c) => c.id !== 'pageNumber').length;
  }, [table]);

  return (
    <div className="w-full">
      <table className="w-full text-xs border-collapse table-fixed">
        <thead ref={theadRef} className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-30">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers
                .filter((header) => header.id !== 'pageNumber')
                .map((header) => (
                  <th
                    key={header.id}
                    className="px-1 py-1 text-left text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 wrap-break-word"
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {!readOnly && (
            <tr>
              <td
                colSpan={stickyColSpan}
                className="sticky z-20 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                style={{ top: theadHeight }}
              >
                <div className="flex items-center gap-2 px-1 py-1">
                  {selectedCells.size > 0 ? (
                    <>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        {selectedCells.size} celdas seleccionadas
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => shiftSelection('left')}
                        disabled={editingCell != null}
                        title="Mover a la columna anterior"
                      >
                        ← Mover
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => shiftSelection('right')}
                        disabled={editingCell != null}
                        title="Mover a la siguiente columna"
                      >
                        Mover →
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                        Deseleccionar
                      </Button>
                      {shiftNote && <div className="text-[11px] text-amber-600 dark:text-amber-400">{shiftNote}</div>}
                    </>
                  ) : (
                    <div className="text-[11px] text-slate-500 dark:text-slate-500">
                      Selección: arrastra desde la barrita izquierda (en celdas de monto) para seleccionar un rango
                      vertical. También funciona Cmd/Ctrl+Click y Shift+Click.
                    </div>
                  )}
                </div>
              </td>
            </tr>
          )}
          {table.getRowModel().rows.map((row) => {
            const actualIndex = allRows.indexOf(row.original);

            return (
              <tr
                key={row.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 group border-b border-slate-100 dark:border-slate-800"
              >
                {row.getVisibleCells().map((cell) => {
                  if (cell.column.id === 'pageNumber') return null;
                  const colId = cell.column.id;
                  const isMoney = actualIndex >= 0 && moneyFieldSet.has(colId);
                  const cellId = isMoney ? makeCellId(actualIndex, colId) : null;
                  const isSelected = cellId ? selectedCells.has(cellId) : false;
                  const isHumanUnreadable = row.original.humanUnreadableFields?.includes(colId) ?? false;
                  const isAiUnreadable = row.original.unreadableFields?.includes(colId) ?? false;

                  return (
                    <td
                      key={cell.id}
                      className={`px-1 py-0.5 relative ${isHumanUnreadable ? 'bg-red-50 dark:bg-red-900/20' : ''} ${
                        isAiUnreadable && !isHumanUnreadable ? 'bg-orange-50 dark:bg-orange-900/20' : ''
                      } ${isSelected ? 'ring-2 ring-indigo-400 ring-inset' : ''}`}
                      onMouseEnter={() => {
                        if (readOnly) return;
                        if (!cellId) return;
                        continueDragSelect(cellId);
                      }}
                      onMouseDownCapture={(e) => {
                        if (readOnly) return;
                        if (!isMoney) return;
                        if (editingCell) return;
                        const target = e.target as HTMLElement | null;
                        if (target?.closest('button')) return;
                        // Handle allows drag selection without requiring modifiers.
                        if (target?.closest('[data-select-handle]')) return;

                        // Keep old modifier-based selection when clicking anywhere in the cell.
                        if (e.shiftKey || e.metaKey || e.ctrlKey) {
                          e.preventDefault();
                          e.stopPropagation();
                          if (cellId) selectCell(e, cellId);
                        }
                      }}
                    >
                      {isMoney && !readOnly && cellId && (
                        <div
                          data-select-handle
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ns-resize select-none opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Arrastra para seleccionar en columna"
                          onMouseDown={(e) => {
                            if (editingCell) return;
                            e.preventDefault();
                            e.stopPropagation();
                            beginDragSelect(e, cellId);
                          }}
                        >
                          <div className="h-full w-px mx-auto bg-slate-300 dark:bg-slate-600" />
                        </div>
                      )}
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
