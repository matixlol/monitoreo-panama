import { lazy, Suspense } from 'react';
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
  onReExtractPage: () => void;
  isReExtracting?: boolean;
  reExtractionFailed?: boolean;
};

export function PdfPanel({ fileUrl, currentPage, pageCount, rotation, onPrev, onNext, onRotate, onReExtractPage, isReExtracting, reExtractionFailed }: Props) {
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
        <Button onClick={onReExtractPage} variant="outline" size="sm" title="Re-extraer esta página" disabled={isReExtracting}>
          {isReExtracting ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
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
