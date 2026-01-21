import { useMemo, useState } from 'react';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { EditableCell } from './EditableCell';
import {
  INGRESS_COLUMNS,
  type IngressRow,
  type ModelExtractions,
} from './types';
import { getAlternateValues, getShortModelName, normalizeValueForDisplay } from './utils';

type Props = {
  rows: IngressRow[];
  allRows: IngressRow[];
  diffs: Map<string, Set<string>>;
  modelData: ModelExtractions;
  modelNames: string[];
  getModelsForRow: (stableRowKey: string) => string[];
  onEdit: (rowIndex: number, field: string, value: string | number | null) => void;
  onDelete: (rowIndex: number) => void;
  onToggleUnreadable: (rowIndex: number, field: string) => void;
};

const columnHelper = createColumnHelper<IngressRow>();

export function IngressTable({
  rows,
  allRows,
  diffs,
  modelData,
  modelNames,
  getModelsForRow,
  onEdit,
  onDelete,
  onToggleUnreadable,
}: Props) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);

  const columns = useMemo<ColumnDef<IngressRow>[]>(() => {
    const dataColumns = INGRESS_COLUMNS.filter((col) => col.key !== 'pageNumber').map((col) =>
      columnHelper.accessor(col.key, {
        id: col.key,
        header: col.label,
        cell: (info) => {
          const row = info.row.original;
          const stableRowKey = row.__stableRowKey;
          const rowDiffs = stableRowKey ? diffs.get(stableRowKey) : undefined;
          const actualIndex = allRows.indexOf(row);
          const altValues =
            stableRowKey != null
              ? getAlternateValues('ingress', stableRowKey, 'reciboNumero', col.key, modelNames, modelData)
              : {};
                const isEditing = editingCell?.row === info.row.index && editingCell?.col === col.key;
                const isHumanUnreadable = row.humanUnreadableFields?.includes(col.key) ?? false;
                const isAiUnreadable = row.unreadableFields?.includes(col.key) ?? false;

                return (
                  <EditableCell
                    field={col.key}
                    value={info.getValue()}
                    type={col.type}
                    isEditing={isEditing}
                    onStartEdit={() => setEditingCell({ row: info.row.index, col: col.key })}
                    onStopEdit={() => setEditingCell(null)}
                    onEdit={(value) => onEdit(actualIndex, col.key, value)}
                    hasDiff={rowDiffs?.has(col.key) ?? false}
                    altValues={altValues}
                    isHumanUnreadable={isHumanUnreadable}
                    isAiUnreadable={isAiUnreadable}
                    onToggleUnreadable={() => onToggleUnreadable(actualIndex, col.key)}
                    formatValue={(field, value, _type) => normalizeValueForDisplay(field, value)}
                    variant="table"
                  />
                );
              },
            }),
    );

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
  }, [allRows, diffs, editingCell, modelData, modelNames, onDelete, onEdit, onToggleUnreadable]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const visibleColumns = table.getAllLeafColumns().filter((col) => col.id !== 'pageNumber');
  const firstColumnId = visibleColumns[0]?.id;

  return (
    <table className="w-full text-xs border-collapse table-fixed">
      <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
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
        {table.getRowModel().rows.map((row) => {
          const stableRowKey = row.original.__stableRowKey;
          const rowDiffs = stableRowKey ? diffs.get(stableRowKey) : undefined;
          const modelsFound = stableRowKey ? getModelsForRow(stableRowKey) : [];
          const isMissingFromSomeModels =
            stableRowKey != null && modelsFound.length > 0 && modelsFound.length < modelNames.length;

          return (
            <tr
              key={row.id}
              className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 group border-b border-slate-100 dark:border-slate-800 ${
                isMissingFromSomeModels ? 'bg-orange-50 dark:bg-orange-900/20' : ''
              }`}
            >
              {row.getVisibleCells().map((cell) => {
                if (cell.column.id === 'pageNumber') return null;
                const colId = cell.column.id;
                const isFirst = colId === firstColumnId;
                const isHumanUnreadable = row.original.humanUnreadableFields?.includes(colId) ?? false;
                const isAiUnreadable = row.original.unreadableFields?.includes(colId) ?? false;

                return (
                  <td
                    key={cell.id}
                    className={`px-1 py-0.5 relative ${
                      rowDiffs?.has(colId) ? 'bg-amber-50 dark:bg-amber-900/30 border-l-2 border-amber-400' : ''
                    } ${isHumanUnreadable ? 'bg-red-50 dark:bg-red-900/20' : ''} ${
                      isAiUnreadable && !isHumanUnreadable ? 'bg-orange-50 dark:bg-orange-900/20' : ''
                    }`}
                  >
                    {isFirst && isMissingFromSomeModels && (
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
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
