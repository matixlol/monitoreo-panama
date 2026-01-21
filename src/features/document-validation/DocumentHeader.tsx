import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

type Props = {
  documentName: string;
  documentStatus: string;
  isValidated: boolean;
  pagesWithDiffs: number[];
  pagesWithUnreadables: number[];
  isSaving: boolean;
  hasEdits: boolean;
  onSave: () => void;
  onRerunExtraction: () => void;
};

export function DocumentHeader({
  documentName,
  documentStatus,
  isValidated,
  pagesWithDiffs,
  pagesWithUnreadables,
  isSaving,
  hasEdits,
  onSave,
  onRerunExtraction,
}: Props) {
  const isProcessing = documentStatus === 'processing' || documentStatus === 'pending';

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 z-20">
      <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/documents" className="text-slate-500 hover:text-slate-700 dark:text-slate-400">
            ← Volver
          </Link>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate max-w-md">
            {documentName}
          </h1>
          {isValidated && (
            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 rounded-full text-xs">
              Validado
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {isProcessing && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-full text-xs animate-pulse">
              {documentStatus === 'pending' ? 'Pendiente...' : 'Procesando...'}
            </span>
          )}
          {documentStatus === 'failed' && (
            <span className="px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded-full text-xs">
              Error
            </span>
          )}
          {pagesWithDiffs.length > 0 && (
            <span className="text-sm text-amber-600 dark:text-amber-400">
              ⚠ {pagesWithDiffs.length} páginas con diferencias
            </span>
          )}
          {pagesWithUnreadables.length > 0 && (
            <span className="text-sm text-orange-600 dark:text-orange-400">
              ? {pagesWithUnreadables.length} páginas con campos ilegibles
            </span>
          )}

          <Button
            onClick={onRerunExtraction}
            disabled={isProcessing}
            variant="outline"
            className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-900/20"
          >
            {isProcessing ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Extrayendo...
              </>
            ) : (
              <>
                <svg
                  className="mr-2 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Re-extraer
              </>
            )}
          </Button>

          <Button onClick={onSave} disabled={!hasEdits || isSaving} variant={hasEdits ? 'default' : 'outline'}>
            {isSaving ? 'Guardando...' : 'Guardar Validación'}
          </Button>
        </div>
      </div>
    </header>
  );
}
