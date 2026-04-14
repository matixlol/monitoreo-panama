import { useEffect, useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { formatPanamaNumber } from '@/lib/currency';
import { EditableCell } from './EditableCell';
import { getCellRowIndex, isAdditiveMultiSelectEvent, makeCellId, type CellId } from './cellSelection';
import { shiftSelectedCells } from './shiftSelectedCells';
import {
  EGRESS_INFO_COLUMNS,
  EGRESS_SPEND_COLUMNS,
  EGRESS_TOTAL_COLUMN,
  type EgressRow,
} from './types';
import { normalizeValueForDisplay } from './utils';

type EgressColumnMeta = {
  group: 'info' | 'spend1' | 'spend2' | 'total';
  type: 'string' | 'number';
  label: string;
};

type Props = {
  rows: EgressRow[];
  allRows: EgressRow[];
  onEdit: (rowIndex: number, field: string, value: string | number | null) => void;
  onMove?: (fromRowIndex: number, toRowIndex: number) => void;
  onDelete: (rowIndex: number) => void;
  onToggleUnreadable: (rowIndex: number, field: string) => void;
  readOnly?: boolean;
};

const columnHelper = createColumnHelper<EgressRow>();

const formatEgressValue = (field: string, value: unknown, type: 'string' | 'number') => {
  if (type === 'number' && value != null) {
    return formatPanamaNumber(Number(value));
  }
  return normalizeValueForDisplay(field, value);
};

export function EgressTable({
  rows,
  allRows,
  onEdit,
  onMove,
  onDelete,
  onToggleUnreadable,
  readOnly = false,
}: Props) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<CellId>>(() => new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<CellId | null>(null);
  const [shiftNote, setShiftNote] = useState<string | null>(null);

  const spendFieldOrder = useMemo(() => EGRESS_SPEND_COLUMNS.map((c) => String(c.key)), []);
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

  const columns = useMemo<ColumnDef<EgressRow, any>[]>(() => {
    const infoColumns = EGRESS_INFO_COLUMNS.filter((col) => col.key !== 'pageNumber').map((col) =>
      columnHelper.accessor(col.key, {
        id: col.key,
        header: col.label,
        meta: { group: 'info', type: col.type, label: col.label } satisfies EgressColumnMeta,
      }),
    );

    const spendColumns = EGRESS_SPEND_COLUMNS.map((col, index) =>
      columnHelper.accessor(col.key, {
        id: col.key,
        header: col.label,
        meta: {
          group: index < 6 ? 'spend1' : 'spend2',
          type: 'number',
          label: col.label,
        } satisfies EgressColumnMeta,
      }),
    );

    const totalColumn = columnHelper.accessor(EGRESS_TOTAL_COLUMN.key, {
      id: EGRESS_TOTAL_COLUMN.key,
      header: EGRESS_TOTAL_COLUMN.label,
      meta: { group: 'total', type: 'number', label: EGRESS_TOTAL_COLUMN.label } satisfies EgressColumnMeta,
    });

    return [...infoColumns, ...spendColumns, totalColumn];
  }, []);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const infoColumns = table
    .getAllLeafColumns()
    .filter((col) => (col.columnDef.meta as EgressColumnMeta | undefined)?.group === 'info');
  const spendRow1Columns = table
    .getAllLeafColumns()
    .filter((col) => (col.columnDef.meta as EgressColumnMeta | undefined)?.group === 'spend1');
  const spendRow2Columns = table
    .getAllLeafColumns()
    .filter((col) => (col.columnDef.meta as EgressColumnMeta | undefined)?.group === 'spend2');
  const totalColumn = table
    .getAllLeafColumns()
    .find((col) => (col.columnDef.meta as EgressColumnMeta | undefined)?.group === 'total');

  const clearSelection = () => {
    setSelectedCells(new Set());
    setSelectionAnchor(null);
    setShiftNote(null);
  };

  const selectCell = (e: Pick<MouseEvent, 'shiftKey' | 'metaKey' | 'ctrlKey'>, cellId: CellId) => {
    if (readOnly) return;
    const additive = isAdditiveMultiSelectEvent(e);
    const isRange = e.shiftKey;

    setSelectedCells((prev) => {
      const next = additive ? new Set(prev) : new Set<CellId>();

      // Range selection only when anchor is in the same column (same field).
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
          return next;
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
    const result = shiftSelectedCells<EgressRow>({
      allRows,
      selectedCells,
      orderedFields: spendFieldOrder,
      direction,
    });

    for (const edit of result.edits) {
      onEdit(edit.rowIndex, edit.field, edit.value);
    }

    setSelectedCells(result.nextSelection);
    setSelectionAnchor(null);
    setShiftNote(result.skippedMoves > 0 ? `Se omitieron ${result.skippedMoves} movimientos (destino no vacío).` : null);
  };

  return (
    <div className="w-full text-xs">
      <div className="flex items-center gap-2 mb-2">
        {selectedCells.size > 0 ? (
          <>
            <div className="text-[11px] text-slate-600 dark:text-slate-400">
              {selectedCells.size} celdas seleccionadas
            </div>
            {!readOnly && (
              <>
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
              </>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
              Limpiar
            </Button>
            {!readOnly && shiftNote && (
              <div className="text-[11px] text-amber-600 dark:text-amber-400">{shiftNote}</div>
            )}
          </>
        ) : (
          <div className="text-[11px] text-slate-500 dark:text-slate-500">
            Selección: Cmd/Ctrl+Click para seleccionar, Shift+Click para rango (misma columna).
          </div>
        )}
      </div>

      {table.getRowModel().rows.map((row) => {
        const actualIndex = allRows.indexOf(row.original);
        const selectionEnabled = actualIndex >= 0;
        const visiblePos = row.index;
        const isFirstVisible = row.index === 0;
        const isLastVisible = row.index === rows.length - 1;
        const moveUpIndex = visiblePos > 0 ? visibleRowIndices[visiblePos - 1] : null;
        const moveDownIndex = visiblePos < visibleRowIndices.length - 1 ? visibleRowIndices[visiblePos + 1] : null;

        return (
          <div
            key={row.id}
            className="group border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            <div className="grid grid-cols-[auto_1fr_1fr_1fr_2fr_auto_auto] gap-1 px-2 py-1 items-start">
              {infoColumns.map((col) => {
                const field = col.id;
                const value = row.getValue(field);
                const isEditing = !readOnly && editingCell?.row === row.index && editingCell?.col === field;
                const isHumanUnreadable = row.original.humanUnreadableFields?.includes(field) ?? false;
                const isAiUnreadable = row.original.unreadableFields?.includes(field) ?? false;
                const unreadableClassName = isHumanUnreadable
                  ? 'bg-red-100/50 dark:bg-red-900/30'
                  : isAiUnreadable
                    ? 'bg-orange-100/50 dark:bg-orange-900/30'
                    : '';

                return (
                  <div
                    key={col.id}
                    className={unreadableClassName}
                  >
                    <div className="text-[9px] text-slate-400 uppercase">
                      {(col.columnDef.meta as EgressColumnMeta | undefined)?.label}
                    </div>
                    <EditableCell
                      field={field}
                      value={value}
                      type={(col.columnDef.meta as EgressColumnMeta | undefined)?.type ?? 'string'}
                      isEditing={isEditing}
                      onStartEdit={() => {
                        if (readOnly) return;
                        setEditingCell({ row: row.index, col: field });
                      }}
                      onStopEdit={() => setEditingCell(null)}
                      onEdit={(next) => {
                        if (readOnly) return;
                        onEdit(actualIndex, field, next);
                      }}
                      isHumanUnreadable={isHumanUnreadable}
                      isAiUnreadable={isAiUnreadable}
                      onToggleUnreadable={() => {
                        if (readOnly) return;
                        onToggleUnreadable(actualIndex, field);
                      }}
                      formatValue={formatEgressValue}
                      compact={false}
                      variant="compact"
                      showToggleOnHover
                      readOnly={readOnly}
                    />
                  </div>
                );
              })}

              <div className="flex items-center">
                {!readOnly && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      onClick={() => {
                        if (moveUpIndex == null) return;
                        onMove?.(actualIndex, moveUpIndex);
                      }}
                      disabled={actualIndex < 0 || isFirstVisible || moveUpIndex == null}
                      variant="ghost"
                      size="icon-sm"
                      className="h-5 w-5"
                      title="Subir fila"
                    >
                      ↑
                    </Button>
                    <Button
                      onClick={() => {
                        if (moveDownIndex == null) return;
                        onMove?.(actualIndex, moveDownIndex);
                      }}
                      disabled={actualIndex < 0 || isLastVisible || moveDownIndex == null}
                      variant="ghost"
                      size="icon-sm"
                      className="h-5 w-5"
                      title="Bajar fila"
                    >
                      ↓
                    </Button>
                    <Button
                      onClick={() => onDelete(actualIndex)}
                      disabled={actualIndex < 0}
                      variant="ghost"
                      size="icon-sm"
                      className="text-red-400 hover:text-red-600 h-5 w-5"
                      title="Eliminar fila"
                    >
                      ×
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="px-2 pb-2">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-md p-1.5 border border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-6 gap-1 mb-1">
                  {spendRow1Columns.map((col) => {
                    const field = col.id;
                    const value = row.getValue(field);
                    const isEditing = !readOnly && editingCell?.row === row.index && editingCell?.col === field;
                    const cellId = selectionEnabled ? makeCellId(actualIndex, field) : null;
                    const isSelected = cellId ? selectedCells.has(cellId) : false;
                    const isHumanUnreadable = row.original.humanUnreadableFields?.includes(field) ?? false;
                    const isAiUnreadable = row.original.unreadableFields?.includes(field) ?? false;
                    const unreadableClassName = isHumanUnreadable
                      ? 'bg-red-100/50 dark:bg-red-900/30'
                      : isAiUnreadable
                        ? 'bg-orange-100/50 dark:bg-orange-900/30'
                        : '';

                    return (
                      <div
                        key={col.id}
                        className={`rounded px-1 py-0.5 ${
                          unreadableClassName || 'bg-white dark:bg-slate-700/50'
                        } ${isSelected ? 'ring-2 ring-indigo-400 ring-inset' : ''}`}
                        onMouseDownCapture={(e) => {
                          if (readOnly) return;
                          if (editingCell) return;
                          if (!cellId) return;
                          if (!(e.shiftKey || e.metaKey || e.ctrlKey)) return;
                          const target = e.target as HTMLElement | null;
                          if (target?.closest('button')) return;
                          e.preventDefault();
                          e.stopPropagation();
                          selectCell(e, cellId);
                        }}
                      >
                        <div
                          className="text-[8px] text-slate-400 dark:text-slate-500 truncate"
                          title={(col.columnDef.meta as EgressColumnMeta | undefined)?.label}
                        >
                          {(col.columnDef.meta as EgressColumnMeta | undefined)?.label}
                        </div>
                        <EditableCell
                          field={field}
                          value={value}
                          type="number"
                          isEditing={isEditing}
                          onStartEdit={() => {
                            if (readOnly) return;
                            setEditingCell({ row: row.index, col: field });
                          }}
                          onStopEdit={() => setEditingCell(null)}
                          onEdit={(next) => {
                            if (readOnly) return;
                            onEdit(actualIndex, field, next);
                          }}
                          isHumanUnreadable={isHumanUnreadable}
                          isAiUnreadable={isAiUnreadable}
                          onToggleUnreadable={() => {
                            if (readOnly) return;
                            onToggleUnreadable(actualIndex, field);
                          }}
                          formatValue={formatEgressValue}
                          compact
                          variant="compact"
                          showToggleOnHover
                          readOnly={readOnly}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-6 gap-1">
                  {spendRow2Columns.map((col) => {
                    const field = col.id;
                    const value = row.getValue(field);
                    const isEditing = !readOnly && editingCell?.row === row.index && editingCell?.col === field;
                    const cellId = selectionEnabled ? makeCellId(actualIndex, field) : null;
                    const isSelected = cellId ? selectedCells.has(cellId) : false;
                    const isHumanUnreadable = row.original.humanUnreadableFields?.includes(field) ?? false;
                    const isAiUnreadable = row.original.unreadableFields?.includes(field) ?? false;
                    const isTotal = field.startsWith('total');
                    const unreadableClassName = isHumanUnreadable
                      ? 'bg-red-100/50 dark:bg-red-900/30'
                      : isAiUnreadable
                        ? 'bg-orange-100/50 dark:bg-orange-900/30'
                        : '';

                    return (
                      <div
                        key={col.id}
                        className={`rounded px-1 py-0.5 ${
                          isTotal
                            ? 'bg-emerald-50 dark:bg-emerald-900/30'
                            : unreadableClassName || 'bg-white dark:bg-slate-700/50'
                        } ${isSelected ? 'ring-2 ring-indigo-400 ring-inset' : ''}`}
                        onMouseDownCapture={(e) => {
                          if (readOnly) return;
                          if (editingCell) return;
                          if (!cellId) return;
                          if (!(e.shiftKey || e.metaKey || e.ctrlKey)) return;
                          const target = e.target as HTMLElement | null;
                          if (target?.closest('button')) return;
                          e.preventDefault();
                          e.stopPropagation();
                          selectCell(e, cellId);
                        }}
                      >
                        <div
                          className={`text-[8px] truncate ${
                            isTotal
                              ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                          title={(col.columnDef.meta as EgressColumnMeta | undefined)?.label}
                        >
                          {(col.columnDef.meta as EgressColumnMeta | undefined)?.label}
                        </div>
                        <EditableCell
                          field={field}
                          value={value}
                          type="number"
                          isEditing={isEditing}
                          onStartEdit={() => {
                            if (readOnly) return;
                            setEditingCell({ row: row.index, col: field });
                          }}
                          onStopEdit={() => setEditingCell(null)}
                          onEdit={(next) => {
                            if (readOnly) return;
                            onEdit(actualIndex, field, next);
                          }}
                          isHumanUnreadable={isHumanUnreadable}
                          isAiUnreadable={isAiUnreadable}
                          onToggleUnreadable={() => {
                            if (readOnly) return;
                            onToggleUnreadable(actualIndex, field);
                          }}
                          formatValue={formatEgressValue}
                          compact
                          variant="compact"
                          showToggleOnHover
                          readOnly={readOnly}
                        />
                      </div>
                    );
                  })}
                </div>

                {totalColumn && (
                  <div className="mt-1 pt-1 border-t border-slate-200 dark:border-slate-600">
                    <div className="flex justify-end">
                      <div
                        className={`rounded px-2 py-1 ${
                          'bg-indigo-50 dark:bg-indigo-900/30'
                        }`}
                      >
                        <div className="text-[8px] text-indigo-600 dark:text-indigo-400 font-semibold">
                          {(totalColumn.columnDef.meta as EgressColumnMeta | undefined)?.label}
                        </div>
                        <div className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                          <EditableCell
                            field={totalColumn.id}
                            value={row.getValue(totalColumn.id)}
                            type="number"
                            isEditing={!readOnly && editingCell?.row === row.index && editingCell?.col === totalColumn.id}
                            onStartEdit={() => {
                              if (readOnly) return;
                              setEditingCell({ row: row.index, col: totalColumn.id });
                            }}
                            onStopEdit={() => setEditingCell(null)}
                            onEdit={(next) => {
                              if (readOnly) return;
                              onEdit(actualIndex, totalColumn.id, next);
                            }}
                            isHumanUnreadable={row.original.humanUnreadableFields?.includes(totalColumn.id) ?? false}
                            isAiUnreadable={row.original.unreadableFields?.includes(totalColumn.id) ?? false}
                            onToggleUnreadable={() => {
                              if (readOnly) return;
                              onToggleUnreadable(actualIndex, totalColumn.id);
                            }}
                            formatValue={formatEgressValue}
                            variant="compact"
                            showToggleOnHover
                            readOnly={readOnly}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
