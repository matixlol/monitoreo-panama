import { normalizeValueForComparison, normalizeValueForDisplay, getShortModelName } from './utils';

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
  hasDiff: boolean;
  altValues: Record<string, unknown>;
  isHumanUnreadable: boolean;
  isAiUnreadable: boolean;
  onToggleUnreadable: () => void;
  variant?: EditableCellVariant;
  compact?: boolean;
  showToggleOnHover?: boolean;
  formatValue?: FormatValue;
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
  hasDiff,
  altValues,
  isHumanUnreadable,
  isAiUnreadable,
  onToggleUnreadable,
  variant = 'table',
  compact = false,
  showToggleOnHover = false,
  formatValue = DEFAULT_FORMAT,
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

      {isEditing ? (
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
            } else if (e.key === 'Escape') {
              onStopEdit();
            }
          }}
        />
      ) : (
        <div
          onClick={onStartEdit}
          className={`cursor-text min-h-[14px] pr-4 ${
            isHumanUnreadable ? unreadableClassName.human : ''
          } ${isAiUnreadable && !isHumanUnreadable ? unreadableClassName.ai : ''}`}
        >
          <span className={isEmpty ? 'text-slate-400 italic' : ''}>{formattedValue}</span>
          {Object.keys(altValues).length > 0 && (
            <div className={variant === 'compact' ? 'text-[9px] space-y-0.5 mt-0.5' : 'text-[10px] space-y-1 mt-1'}>
              {Object.entries(altValues).map(([modelName, modelValue]) => {
                const shortName = getShortModelName(modelName);
                const normalizedCurrent = normalizeValueForComparison(field, value);
                const normalizedModel = normalizeValueForComparison(field, modelValue);
                const isSelected = normalizedModel === normalizedCurrent;
                return (
                  <button
                    key={modelName}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(modelValue as string | number | null);
                    }}
                    className={`block w-full text-left rounded border transition-colors cursor-pointer ${
                      variant === 'compact' ? 'py-0 px-0.5 text-[9px]' : 'py-0.5 px-1'
                    } ${
                      isSelected
                        ? variant === 'compact'
                          ? 'border-emerald-400 dark:border-emerald-500 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                          : 'border-emerald-400 dark:border-emerald-500 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-400 dark:ring-emerald-500'
                        : hasDiff
                          ? variant === 'compact'
                            ? 'border-amber-300 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200'
                            : 'border-amber-300 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800 hover:border-amber-400 dark:hover:border-amber-500'
                          : variant === 'compact'
                            ? 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                            : 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                    title={isSelected ? `Valor actual (de ${modelName})` : `Usar valor de ${modelName}`}
                  >
                    {isSelected && <span className={variant === 'compact' ? 'mr-0.5' : 'mr-1'}>✓</span>}
                    <span className="font-medium">{shortName}:</span> {formatValue(field, modelValue, type)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
