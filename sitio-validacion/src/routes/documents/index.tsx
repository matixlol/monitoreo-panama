import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';

export const Route = createFileRoute('/documents/')({
  component: DocumentsPage,
});

function DocumentsPage() {
  const documents = useQuery(api.documents.listDocuments);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const createDocument = useMutation(api.documents.createDocument);
  const retryExtraction = useMutation(api.documents.retryExtraction);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setUploadError('Please select a PDF file');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // Get page count from PDF
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pageCount = pdfDoc.getPageCount();

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

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRetry = async (documentId: string) => {
    try {
      await retryExtraction({ documentId: documentId as any });
    } catch (error) {
      console.error('Retry failed:', error);
    }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Documentos PDF</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">Sube documentos PDF para extraer datos financieros</p>
        </div>

        {/* Upload Section */}
        <div className="mb-8 p-6 bg-white dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600">
          <div className="text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
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
                  Subir PDF
                </>
              )}
            </label>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              PDF con tablas de INFORME DE INGRESOS o INFORME DE GASTOS
            </p>
            {uploadError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{uploadError}</p>}
          </div>
        </div>

        {/* Documents List */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Documentos</h2>
          </div>

          {documents === undefined ? (
            <div className="p-8 text-center text-slate-500">Cargando...</div>
          ) : documents.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No hay documentos. Sube un PDF para comenzar.</div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {documents.map((doc) => (
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
                      {doc.name}
                    </Link>
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
