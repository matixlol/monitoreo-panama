import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { PDFDocument } from 'pdf-lib';
import { createEgressCsvStream, createIngressCsvStream, type CsvExportDocument } from '../../lib/csvExport';
import type { Id } from '../../../convex/_generated/dataModel';
import documentsIndex from '../../data/documents-index.json';

type CandidateMetadata = {
  id: string;
  candidateName: string;
  documentId: string;
  position: string;
  party: string;
  province: string | null;
  district: string | null;
  township: string | null;
  status: string;
  isProclaimed: boolean;
  dateSent: string | null;
  totalIngress: number;
  totalEgress: number;
  pdfUrl: string | null;
};

function normalizeForComparison(str: string): string {
  // Normalize unicode, remove accents, and lowercase
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
    .replace(/[ÃÂ]/g, '') // Remove mojibake artifacts
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function findCandidateByFilename(filename: string): CandidateMetadata | null {
  const normalizedFilename = normalizeForComparison(filename);

  for (const candidate of documentsIndex as CandidateMetadata[]) {
    if (!candidate.pdfUrl) continue;

    // Double decode to handle double-encoded URLs
    let pdfFilename = candidate.pdfUrl.split('/').pop() || '';
    try {
      pdfFilename = decodeURIComponent(decodeURIComponent(pdfFilename));
    } catch {
      try {
        pdfFilename = decodeURIComponent(pdfFilename);
      } catch {
        // Use as-is if decoding fails
      }
    }

    if (normalizeForComparison(pdfFilename) === normalizedFilename) {
      return candidate;
    }
  }
  return null;
}

export const Route = createFileRoute('/documents/')({
  component: DocumentsPage,
});

type UploadProgress = {
  fileName: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
};

function DocumentsPage() {
  const documents = useQuery(api.documents.listDocuments);
  const [exportRequested, setExportRequested] = useState(false);
  const exportData = useQuery(api.documents.getDocumentsForCsvExport, exportRequested ? {} : undefined);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const createDocument = useMutation(api.documents.createDocument);
  const retryExtraction = useMutation(api.documents.retryExtraction);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [uploadStats, setUploadStats] = useState<{ completed: number; failed: number; total: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadSingleFile = useCallback(
    async (file: File, index: number): Promise<boolean> => {
      // Update status to uploading
      setUploadProgress((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index]!, status: 'uploading' };
        return updated;
      });

      try {
        // Get page count from PDF
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pageCount = pdfDoc.getPageCount();

        // Update status to processing
        setUploadProgress((prev) => {
          const updated = [...prev];
          updated[index] = { ...updated[index]!, status: 'processing' };
          return updated;
        });

        // Get upload URL
        const uploadUrl = await generateUploadUrl();

        // Upload file
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const { storageId } = await response.json();

        // Create document record
        await createDocument({
          fileId: storageId,
          name: file.name,
          pageCount,
        });

        // Update status to completed
        setUploadProgress((prev) => {
          const updated = [...prev];
          updated[index] = { ...updated[index]!, status: 'completed' };
          return updated;
        });

        return true;
      } catch (error) {
        // Update status to failed
        setUploadProgress((prev) => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index]!,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Upload failed',
          };
          return updated;
        });
        return false;
      }
    },
    [generateUploadUrl, createDocument],
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Filter for PDFs only
    const pdfFiles = Array.from(files).filter((file) => file.type === 'application/pdf');

    if (pdfFiles.length === 0) {
      setUploadError('Please select PDF files');
      return;
    }

    if (pdfFiles.length !== files.length) {
      setUploadError(`${files.length - pdfFiles.length} non-PDF files were skipped`);
    } else {
      setUploadError(null);
    }

    setIsUploading(true);
    setUploadStats(null);

    // Initialize progress for all files
    const initialProgress: UploadProgress[] = pdfFiles.map((file) => ({
      fileName: file.name,
      status: 'pending',
    }));
    setUploadProgress(initialProgress);

    // Process files in batches of 5 for better performance
    const BATCH_SIZE = 5;
    let completed = 0;
    let failed = 0;

    for (let i = 0; i < pdfFiles.length; i += BATCH_SIZE) {
      const batch = pdfFiles.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map((file, batchIndex) => uploadSingleFile(file, i + batchIndex)));

      results.forEach((success) => {
        if (success) {
          completed++;
        } else {
          failed++;
        }
      });
    }

    setUploadStats({ completed, failed, total: pdfFiles.length });
    setIsUploading(false);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Clear progress after 5 seconds if all succeeded
    if (failed === 0) {
      setTimeout(() => {
        setUploadProgress([]);
        setUploadStats(null);
      }, 3000);
    }
  };

  const handleRetry = async (documentId: Id<'documents'>) => {
    try {
      await retryExtraction({ documentId });
    } catch (error) {
      console.error('Retry failed:', error);
    }
  };

  const hasFilePicker = (
    value: Window,
  ): value is Window & {
    showSaveFilePicker: (options?: {}) => Promise<FileSystemFileHandle>;
  } => 'showSaveFilePicker' in value;

  useEffect(() => {
    if (!exportRequested || !exportData || isExporting) return;
    const runExport = async () => {
      setIsExporting(true);
      setExportError(null);
      try {
        const exportPayload: CsvExportDocument[] = exportData.map((doc) => {
          const candidate = findCandidateByFilename(doc.name);
          return {
            ...doc,
            candidateName: candidate?.candidateName ?? null,
            candidatePosition: candidate?.position ?? null,
            candidateParty: candidate?.party ?? null,
            candidateProvince: candidate?.province ?? null,
            candidateDistrict: candidate?.district ?? null,
          };
        });
        const dateStamp = new Date().toISOString().slice(0, 10);
        const ingressFileName = `documentos-ingresos-${dateStamp}.csv`;
        const egressFileName = `documentos-egresos-${dateStamp}.csv`;
        const ingressStream = createIngressCsvStream(exportPayload);
        const egressStream = createEgressCsvStream(exportPayload);

        if (hasFilePicker(window)) {
          const saveStream = async (stream: ReadableStream<Uint8Array>, suggestedName: string) => {
            const handle = await (window as any).showSaveFilePicker({
              suggestedName,
              types: [
                {
                  description: 'CSV',
                  accept: { 'text/csv': ['.csv'] },
                },
              ],
            });
            const writable = await handle.createWritable();
            const reader = stream.getReader();
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              await writable.write(value);
            }
            await writable.close();
          };

          await saveStream(ingressStream, ingressFileName);
          await saveStream(egressStream, egressFileName);
        } else {
          const downloadStream = async (stream: ReadableStream<Uint8Array>, fileName: string) => {
            const blob = await new Response(stream).blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.click();
            URL.revokeObjectURL(url);
          };
          await downloadStream(ingressStream, ingressFileName);
          await downloadStream(egressStream, egressFileName);
        }
      } catch (error) {
        setExportError(error instanceof Error ? error.message : 'Export failed');
      } finally {
        setIsExporting(false);
        setExportRequested(false);
      }
    };
    void runExport();
  }, [exportRequested, exportData, isExporting]);

  const handleExportCsv = () => {
    setExportError(null);
    setExportRequested(true);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || ''}`}>{status}</span>;
  };

  return (
    <>
      {/* Upload Section */}
          <div className="mb-8 p-6 bg-white dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600">
            <div className="text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                onChange={handleUpload}
                disabled={isUploading}
                className="hidden"
                id="pdf-upload"
              />
              <label
                htmlFor="pdf-upload"
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium cursor-pointer transition-colors ${
                  isUploading
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {isUploading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Subiendo...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    Subir PDFs
                  </>
                )}
              </label>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Selecciona uno o múltiples PDFs (INFORME DE INGRESOS o INFORME DE GASTOS)
              </p>
              {uploadError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{uploadError}</p>}
            </div>

            {/* Upload Progress */}
            {uploadProgress.length > 0 && (
              <div className="mt-6">
                {/* Summary Stats */}
                {uploadStats && (
                  <div className="mb-4 p-3 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {uploadStats.completed}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Completados</div>
                    </div>
                    {uploadStats.failed > 0 && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">{uploadStats.failed}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Fallidos</div>
                      </div>
                    )}
                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-600 dark:text-slate-300">{uploadStats.total}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Total</div>
                    </div>
                  </div>
                )}

                {/* Progress Bar */}
                {isUploading && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 mb-1">
                      <span>Progreso</span>
                      <span>
                        {uploadProgress.filter((p) => p.status === 'completed' || p.status === 'failed').length} /{' '}
                        {uploadProgress.length}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 transition-all duration-300"
                        style={{
                          width: `${(uploadProgress.filter((p) => p.status === 'completed' || p.status === 'failed').length / uploadProgress.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* File List - Collapsible for large uploads */}
                <details className="group" open={uploadProgress.length <= 10}>
                  <summary className="cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200">
                    {uploadProgress.length} archivos{' '}
                    <span className="text-slate-400 group-open:hidden">(click para expandir)</span>
                  </summary>
                  <div className="mt-2 max-h-60 overflow-y-auto space-y-1 text-sm">
                    {uploadProgress.map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 px-2 py-1 rounded ${
                          item.status === 'completed'
                            ? 'bg-emerald-50 dark:bg-emerald-900/20'
                            : item.status === 'failed'
                              ? 'bg-red-50 dark:bg-red-900/20'
                              : item.status === 'uploading' || item.status === 'processing'
                                ? 'bg-blue-50 dark:bg-blue-900/20'
                                : 'bg-slate-50 dark:bg-slate-800'
                        }`}
                      >
                        {/* Status Icon */}
                        {item.status === 'pending' && <span className="w-4 h-4 text-slate-400">○</span>}
                        {(item.status === 'uploading' || item.status === 'processing') && (
                          <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24">
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                        )}
                        {item.status === 'completed' && <span className="w-4 h-4 text-emerald-500">✓</span>}
                        {item.status === 'failed' && <span className="w-4 h-4 text-red-500">✕</span>}

                        {/* File Name */}
                        <span
                          className={`flex-1 truncate ${
                            item.status === 'failed'
                              ? 'text-red-700 dark:text-red-400'
                              : item.status === 'completed'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-slate-700 dark:text-slate-300'
                          }`}
                          title={item.fileName}
                        >
                          {item.fileName}
                        </span>

                        {/* Status Label */}
                        <span className="text-xs text-slate-400">
                          {item.status === 'pending' && 'Pendiente'}
                          {item.status === 'uploading' && 'Subiendo...'}
                          {item.status === 'processing' && 'Procesando...'}
                          {item.status === 'completed' && 'Listo'}
                          {item.status === 'failed' && (item.error || 'Error')}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>

                {/* Clear button when done */}
                {!isUploading && uploadStats && uploadStats.failed > 0 && (
                  <button
                    onClick={() => {
                      setUploadProgress([]);
                      setUploadStats(null);
                    }}
                    className="mt-3 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Limpiar lista
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Documents List */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-3 items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Documentos</h2>
              <div className="flex items-center gap-3">
                {exportError && <span className="text-sm text-red-600 dark:text-red-400">{exportError}</span>}
                <button
                  onClick={handleExportCsv}
                  disabled={isExporting || exportRequested || documents === undefined || documents.length === 0}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    isExporting || exportRequested || documents === undefined || documents.length === 0
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-400'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {isExporting || exportRequested ? 'Exportando...' : 'Exportar CSVs'}
                </button>
              </div>
            </div>

            {documents === undefined ? (
              <div className="p-8 text-center text-slate-500">Cargando...</div>
            ) : documents.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No hay documentos. Sube un PDF para comenzar.</div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {documents.map((doc) => {
                  const candidate = findCandidateByFilename(doc.name);
                  return (
                    <div
                      key={doc._id}
                      className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <Link
                          to="/documents/$documentId"
                          params={{ documentId: doc._id }}
                          className="text-lg font-medium text-indigo-600 dark:text-indigo-400 hover:underline truncate block"
                        >
                          {candidate?.candidateName || doc.name}
                        </Link>
                        {candidate && (
                          <div className="flex items-center gap-2 mt-1 text-sm">
                            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              {candidate.position}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                              {candidate.party}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
                          <span>{doc.pageCount} páginas</span>
                          <span>•</span>
                          {(doc.ingressCount > 0 || doc.egressCount > 0) && (
                            <>
                              <span>{doc.ingressCount} ingresos</span>
                              <span>•</span>
                              <span>{doc.egressCount} egresos</span>
                              <span>•</span>
                            </>
                          )}
                          {(doc.totalIngresos != null || doc.totalGastos != null) && (
                            <>
                              {doc.totalIngresos != null && (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  +${doc.totalIngresos.toLocaleString('es-PA', { minimumFractionDigits: 2 })}
                                </span>
                              )}
                              {doc.totalGastos != null && (
                                <span className="text-red-600 dark:text-red-400 font-medium">
                                  -${doc.totalGastos.toLocaleString('es-PA', { minimumFractionDigits: 2 })}
                                </span>
                              )}
                              <span>•</span>
                            </>
                          )}
                          <span>
                            {new Date(doc._creationTime).toLocaleDateString('es-PA', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {doc.errorMessage && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{doc.errorMessage}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        {getStatusBadge(doc.status)}

                        {doc.status === 'failed' && (
                          <button
                            onClick={() => handleRetry(doc._id)}
                            className="px-3 py-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                          >
                            Reintentar
                          </button>
                        )}

                        {doc.status === 'completed' && (
                          <Link
                            to="/documents/$documentId"
                            params={{ documentId: doc._id }}
                            className="px-3 py-1 text-sm font-medium bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-300"
                          >
                            Validar
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
    </>
  );
}
