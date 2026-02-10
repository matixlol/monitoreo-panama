import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { useEffect, useMemo, useState } from 'react';

type Props = {
  documentName: string;
  documentStatus: string;
  isValidated: boolean;
  pagesWithUnreadables: number[];
  isSaving: boolean;
  hasEdits: boolean;
  onSave: () => void;
  onRerunExtraction: () => void;
  note: string | null;
  largeTotalsDiscrepancy: boolean;
  isSavingStructuredNotes: boolean;
  onSaveStructuredNotes: (args: { note: string | null; largeTotalsDiscrepancy: boolean }) => Promise<void>;
};

export function DocumentHeader({
  documentName,
  documentStatus,
  isValidated,
  pagesWithUnreadables,
  isSaving,
  hasEdits,
  onSave,
  onRerunExtraction,
  note,
  largeTotalsDiscrepancy,
  isSavingStructuredNotes,
  onSaveStructuredNotes,
}: Props) {
  const isProcessing = documentStatus === 'processing' || documentStatus === 'pending';
  const [draftNote, setDraftNote] = useState(note ?? '');
  const [draftLargeTotalsDiscrepancy, setDraftLargeTotalsDiscrepancy] = useState(Boolean(largeTotalsDiscrepancy));
  const [lastLoadedKey, setLastLoadedKey] = useState<string>('');
  const [isNotesOpen, setIsNotesOpen] = useState(false);

  // Keep local draft in sync when switching documents; avoid overwriting edits mid-typing.
  const loadKey = useMemo(
    () => JSON.stringify({ documentName, note: note ?? null, largeTotalsDiscrepancy: Boolean(largeTotalsDiscrepancy) }),
    [documentName, largeTotalsDiscrepancy, note],
  );
  useEffect(() => {
    if (loadKey === lastLoadedKey) return;
    setDraftNote(note ?? '');
    setDraftLargeTotalsDiscrepancy(Boolean(largeTotalsDiscrepancy));
    setLastLoadedKey(loadKey);
  }, [largeTotalsDiscrepancy, lastLoadedKey, loadKey, note]);

  const hasNotesEdits =
    draftNote.trim() !== (note ?? '').trim() || draftLargeTotalsDiscrepancy !== Boolean(largeTotalsDiscrepancy);

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 z-20">
      <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/documents" className="text-slate-500 hover:text-slate-700 dark:text-slate-400">
            ← Volver
          </Link>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate max-w-md">{documentName}</h1>
          {isValidated && (
            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 rounded-full text-xs">
              Validado
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Button type="button" variant="outline" className="gap-2" onClick={() => setIsNotesOpen((v) => !v)}>
              <span className="inline-flex items-center gap-1">
                Notas
                {(note && note.trim().length > 0) || largeTotalsDiscrepancy ? (
                  <span className="text-xs text-slate-500">(1)</span>
                ) : null}
              </span>
            </Button>

            {isNotesOpen ? (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setIsNotesOpen(false)} />
                <div className="absolute right-0 mt-2 w-[420px] max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg p-3 z-30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Nota del documento
                      </label>
                      <textarea
                        value={draftNote}
                        onChange={(e) => setDraftNote(e.target.value)}
                        rows={4}
                        className="w-full resize-none rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-700"
                        placeholder="Escribe una nota..."
                      />

                      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 select-none">
                        <input
                          type="checkbox"
                          checked={draftLargeTotalsDiscrepancy}
                          onChange={(e) => setDraftLargeTotalsDiscrepancy(e.target.checked)}
                          className="h-4 w-4"
                        />
                        Discrepancias grandes en totales
                      </label>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsNotesOpen(false)}>
                      Cerrar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!hasNotesEdits || isSavingStructuredNotes}
                      onClick={async () => {
                        const trimmed = draftNote.trim();
                        await onSaveStructuredNotes({
                          note: trimmed.length === 0 ? null : trimmed,
                          largeTotalsDiscrepancy: Boolean(draftLargeTotalsDiscrepancy),
                        });
                        setIsNotesOpen(false);
                      }}
                    >
                      {isSavingStructuredNotes ? 'Guardando...' : 'Guardar Notas'}
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </div>

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
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
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
