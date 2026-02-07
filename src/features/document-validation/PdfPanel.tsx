import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

const PDFViewer = lazy(() =>
  import('react-pdf').then((mod) => {
    mod.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${mod.pdfjs.version}/build/pdf.worker.min.mjs`;
    import('react-pdf/dist/Page/AnnotationLayer.css');
    import('react-pdf/dist/Page/TextLayer.css');
    return {
      default: ({ fileUrl, currentPage, rotation }: { fileUrl: string; currentPage: number; rotation: number }) => (
        <mod.Document
          file={fileUrl}
          loading={<div className="flex items-center justify-center h-full text-slate-500">Cargando PDF...</div>}
          error={<div className="flex items-center justify-center h-full text-red-500">Error al cargar el PDF</div>}
        >
          <mod.Page
            pageNumber={currentPage}
            className="rounded-lg shadow-lg"
            renderTextLayer={true}
            renderAnnotationLayer={true}
            rotate={rotation}
            loading={<div className="flex items-center justify-center h-64 text-slate-500">Cargando página...</div>}
          />
        </mod.Document>
      ),
    };
  }),
);

type Props = {
  fileUrl?: string | null;
  currentPage: number;
  pageCount: number;
  rotation: number;
  onPrev: () => void;
  onNext: () => void;
  onRotate: () => void;
  onReExtractPage: (args: { proRuns: number; flashRuns: number }) => void | Promise<void>;
  isReExtracting?: boolean;
  reExtractionFailed?: boolean;
};

export function PdfPanel({
  fileUrl,
  currentPage,
  pageCount,
  rotation,
  onPrev,
  onNext,
  onRotate,
  onReExtractPage,
  isReExtracting,
  reExtractionFailed,
}: Props) {
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [proRuns, setProRuns] = useState(1);
  const [flashRuns, setFlashRuns] = useState(0);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const totalRuns = useMemo(() => Math.max(0, proRuns) + Math.max(0, flashRuns), [flashRuns, proRuns]);
  const canConfirm = totalRuns > 0 && !isReExtracting;

  useEffect(() => {
    if (!isModelPickerOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsModelPickerOpen(false);
    };

    const onPointerDown = (e: PointerEvent) => {
      const el = pickerRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setIsModelPickerOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [isModelPickerOpen]);

  useEffect(() => {
    if (isReExtracting) setIsModelPickerOpen(false);
  }, [isReExtracting]);

  const clampRuns = (n: number) => {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(10, Math.trunc(n)));
  };

  const commitReExtract = () => {
    if (!canConfirm) return;
    onReExtractPage({ proRuns: clampRuns(proRuns), flashRuns: clampRuns(flashRuns) });
    setIsModelPickerOpen(false);
  };

  return (
    <div className="h-full border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 flex flex-col overflow-hidden">
      <div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-center gap-4">
        <Button onClick={onPrev} disabled={currentPage <= 1} variant="outline" size="sm">
          ←
        </Button>
        <span className="text-sm text-slate-600 dark:text-slate-400">
          Página {currentPage} de {pageCount}
        </span>
        <Button onClick={onNext} disabled={currentPage >= pageCount} variant="outline" size="sm">
          →
        </Button>
        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600" />
        <Button onClick={onRotate} variant="outline" size="sm" title="Rotar página 90°">
          <svg
            className="w-4 h-4"
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
          Rotar
        </Button>
        <div className="relative" ref={pickerRef}>
          <Button
            onClick={() => setIsModelPickerOpen((v) => !v)}
            variant="outline"
            size="sm"
            title="Re-extraer esta página"
            disabled={isReExtracting}
          >
            {isReExtracting ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            )}
            {isReExtracting ? 'Extrayendo...' : 'Re-extraer'}
          </Button>

          {isModelPickerOpen && !isReExtracting && (
            <div className="absolute z-50 right-0 top-full mt-2 w-64 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-3">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Modelos a ejecutar</div>
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Pro</div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 px-0"
                      onClick={() => setProRuns((v) => clampRuns(v - 1))}
                    >
                      -
                    </Button>
                    <input
                      className="h-7 w-12 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 text-center"
                      type="number"
                      min={0}
                      max={10}
                      step={1}
                      inputMode="numeric"
                      value={proRuns}
                      onChange={(e) => setProRuns(clampRuns(Number(e.target.value)))}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 px-0"
                      onClick={() => setProRuns((v) => clampRuns(v + 1))}
                    >
                      +
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Flash</div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 px-0"
                      onClick={() => setFlashRuns((v) => clampRuns(v - 1))}
                    >
                      -
                    </Button>
                    <input
                      className="h-7 w-12 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100 text-center"
                      type="number"
                      min={0}
                      max={10}
                      step={1}
                      inputMode="numeric"
                      value={flashRuns}
                      onChange={(e) => setFlashRuns(clampRuns(Number(e.target.value)))}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 px-0"
                      onClick={() => setFlashRuns((v) => clampRuns(v + 1))}
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                Se generarán {totalRuns} propuestas (Pro {proRuns}, Flash {flashRuns}).
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setIsModelPickerOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" size="sm" className="h-7" disabled={!canConfirm} onClick={commitReExtract}>
                  Confirmar
                </Button>
              </div>
            </div>
          )}
        </div>
        {reExtractionFailed && (
          <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Falló
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="sticky top-0 min-w-fit flex justify-center">
          {fileUrl ? (
            <Suspense
              fallback={<div className="flex items-center justify-center h-full text-slate-500">Cargando PDF...</div>}
            >
              <PDFViewer fileUrl={fileUrl} currentPage={currentPage} rotation={rotation} />
            </Suspense>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">No se pudo cargar el PDF</div>
          )}
        </div>
      </div>
    </div>
  );
}
