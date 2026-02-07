import { normalizeValueForDisplay } from './utils';

export type EditableCellVariant = 'table' | 'compact';

export type FormatValue = (field: string, value: unknown, type: 'string' | 'number') => string;

type Props = {
  field: string;
  value: unknown;
  type: 'string' | 'number';
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onEdit: (value: string | number | null) => void;
  onNavigateVertical?: (direction: 'up' | 'down') => void;
  isHumanUnreadable: boolean;
  isAiUnreadable: boolean;
  onToggleUnreadable: () => void;
  variant?: EditableCellVariant;
  compact?: boolean;
  showToggleOnHover?: boolean;
  formatValue?: FormatValue;
  readOnly?: boolean;
};

const DEFAULT_FORMAT: FormatValue = (field, value) => normalizeValueForDisplay(field, value);

export function EditableCell({
  field,
  value,
  type,
  isEditing,
  onStartEdit,
  onStopEdit,
  onEdit,
  onNavigateVertical,
  isHumanUnreadable,
  isAiUnreadable,
  onToggleUnreadable,
  variant = 'table',
  compact = false,
  showToggleOnHover = false,
  formatValue = DEFAULT_FORMAT,
  readOnly = false,
}: Props) {
  const isEmpty = value == null || value === '';
  const formattedValue = formatValue(field, value, type);

  const unreadableClassName =
    variant === 'compact'
      ? {
          human: 'bg-red-100/50 dark:bg-red-900/30',
          ai: 'bg-orange-100/50 dark:bg-orange-900/30',
        }
      : {
          human: 'bg-red-50 dark:bg-red-900/20',
          ai: 'bg-orange-50 dark:bg-orange-900/20',
        };

  return (
    <div className={`relative ${compact ? 'text-[10px]' : ''}`}>
      {!readOnly && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleUnreadable();
          }}
          className={`absolute -top-0.5 -right-0.5 leading-none flex items-center justify-center rounded-full transition-colors ${
            variant === 'compact' ? 'text-[10px] w-4 h-4' : 'text-sm w-5 h-5'
          } ${
            isHumanUnreadable
              ? 'bg-red-400 dark:bg-red-700 text-white font-bold shadow-sm'
              : isAiUnreadable
                ? 'bg-orange-400 dark:bg-orange-600 text-white font-bold shadow-sm'
                : `text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 ${
                    showToggleOnHover ? 'opacity-0 group-hover:opacity-100' : ''
                  }`
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
      )}

      {!readOnly && isEditing ? (
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
          className={`w-full px-1 py-0 border border-indigo-400 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800 min-h-[16px] whitespace-pre-wrap ${
            compact ? 'text-[10px]' : 'text-xs'
          }`}
          onBlur={(e) => {
            const text = e.currentTarget.textContent || '';
            const newValue = type === 'number' ? (text ? Number(text) : null) : text || null;
            onEdit(newValue);
            onStopEdit();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.blur();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              if (!onNavigateVertical) return;
              e.preventDefault();
              const text = e.currentTarget.textContent || '';
              const newValue = type === 'number' ? (text ? Number(text) : null) : text || null;
              onEdit(newValue);
              onNavigateVertical(e.key === 'ArrowUp' ? 'up' : 'down');
            } else if (e.key === 'Escape') {
              onStopEdit();
            }
          }}
        />
      ) : (
        <div
          onClick={readOnly ? undefined : onStartEdit}
          className={`${
            readOnly ? 'cursor-default pr-1' : 'cursor-text pr-4'
          } min-h-[14px] ${
            isHumanUnreadable ? unreadableClassName.human : ''
          } ${isAiUnreadable && !isHumanUnreadable ? unreadableClassName.ai : ''}`}
        >
          <span className={isEmpty ? 'text-slate-400 italic' : ''}>{formattedValue}</span>
        </div>
      )}
    </div>
  );
}
