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
};

export function PdfPanel({ fileUrl, currentPage, pageCount, rotation, onPrev, onNext, onRotate }: Props) {
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
