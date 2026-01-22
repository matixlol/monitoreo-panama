import { useMemo, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { EditableCell } from './EditableCell';
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
  onDelete: (rowIndex: number) => void;
  onToggleUnreadable: (rowIndex: number, field: string) => void;
};

const columnHelper = createColumnHelper<EgressRow>();

const formatEgressValue = (field: string, value: unknown, type: 'string' | 'number') => {
  if (type === 'number' && value != null) {
    return Number(value).toLocaleString('es-PA', { minimumFractionDigits: 2 });
  }
  return normalizeValueForDisplay(field, value);
};

export function EgressTable({
  rows,
  allRows,
  onEdit,
  onDelete,
  onToggleUnreadable,
}: Props) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);

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

  return (
    <div className="w-full text-xs">
      {table.getRowModel().rows.map((row) => {
        const actualIndex = allRows.indexOf(row.original);

        return (
          <div
            key={row.id}
            className="group border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            <div className="grid grid-cols-[auto_1fr_1fr_1fr_2fr_auto_auto] gap-1 px-2 py-1 items-start">
              {infoColumns.map((col) => {
                const field = col.id;
                const value = row.getValue(field);
                const isEditing = editingCell?.row === row.index && editingCell?.col === field;
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
                      onStartEdit={() => setEditingCell({ row: row.index, col: field })}
                      onStopEdit={() => setEditingCell(null)}
                      onEdit={(next) => onEdit(actualIndex, field, next)}
                      isHumanUnreadable={isHumanUnreadable}
                      isAiUnreadable={isAiUnreadable}
                      onToggleUnreadable={() => onToggleUnreadable(actualIndex, field)}
                      formatValue={formatEgressValue}
                      compact={false}
                      variant="compact"
                      showToggleOnHover
                    />
                  </div>
                );
              })}

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

            <div className="px-2 pb-2">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-md p-1.5 border border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-6 gap-1 mb-1">
                  {spendRow1Columns.map((col) => {
                    const field = col.id;
                    const value = row.getValue(field);
                    const isEditing = editingCell?.row === row.index && editingCell?.col === field;
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
                        }`}
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
                          onStartEdit={() => setEditingCell({ row: row.index, col: field })}
                          onStopEdit={() => setEditingCell(null)}
                          onEdit={(next) => onEdit(actualIndex, field, next)}
                          isHumanUnreadable={isHumanUnreadable}
                          isAiUnreadable={isAiUnreadable}
                          onToggleUnreadable={() => onToggleUnreadable(actualIndex, field)}
                          formatValue={formatEgressValue}
                          compact
                          variant="compact"
                          showToggleOnHover
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-6 gap-1">
                  {spendRow2Columns.map((col) => {
                    const field = col.id;
                    const value = row.getValue(field);
                    const isEditing = editingCell?.row === row.index && editingCell?.col === field;
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
                        }`}
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
                          onStartEdit={() => setEditingCell({ row: row.index, col: field })}
                          onStopEdit={() => setEditingCell(null)}
                          onEdit={(next) => onEdit(actualIndex, field, next)}
                          isHumanUnreadable={isHumanUnreadable}
                          isAiUnreadable={isAiUnreadable}
                          onToggleUnreadable={() => onToggleUnreadable(actualIndex, field)}
                          formatValue={formatEgressValue}
                          compact
                          variant="compact"
                          showToggleOnHover
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
                            isEditing={editingCell?.row === row.index && editingCell?.col === totalColumn.id}
                            onStartEdit={() => setEditingCell({ row: row.index, col: totalColumn.id })}
                            onStopEdit={() => setEditingCell(null)}
                            onEdit={(next) => onEdit(actualIndex, totalColumn.id, next)}
                            isHumanUnreadable={row.original.humanUnreadableFields?.includes(totalColumn.id) ?? false}
                            isAiUnreadable={row.original.unreadableFields?.includes(totalColumn.id) ?? false}
                            onToggleUnreadable={() => onToggleUnreadable(actualIndex, totalColumn.id)}
                            formatValue={formatEgressValue}
                            variant="compact"
                            showToggleOnHover
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
