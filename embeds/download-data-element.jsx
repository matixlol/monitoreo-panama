import { useMemo, useState } from 'react';
import ingresosDatasetUrl from './data/documentos-ingresos.csv?url';
import egresosDatasetUrl from './data/documentos-egresos.csv?url';
import { INT } from './embed-shared.jsx';
import { createZipBlob } from '../src/lib/zip';
import { createXlsxBlobFromCsv } from '../src/lib/excelExport';

function resolveAssetUrl(assetUrl) {
  return new URL(assetUrl, import.meta.url).href;
}

const INGRESOS_URL = resolveAssetUrl(ingresosDatasetUrl);
const EGRESOS_URL = resolveAssetUrl(egresosDatasetUrl);
const BUTTON_LABEL = 'Descargar los datos';
const INGRESO_FILENAME = 'documentos-ingresos.csv';
const EGRESO_FILENAME = 'documentos-egresos.csv';
const INGRESO_EXCEL_FILENAME = 'documentos-ingresos.xlsx';
const EGRESO_EXCEL_FILENAME = 'documentos-egresos.xlsx';
const ZIP_FILENAME = 'documentos-panama.zip';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function fetchDatasetText(url, filename) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo descargar ${filename}.`);
  return response.text();
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" width="16" height="16" className="mr-2">
      <path
        d="M10 3.75v8.5m0 0 3-3m-3 3-3-3M4.75 13.75v1.5c0 .55.45 1 1 1h8.5c.55 0 1-.45 1-1v-1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DownloadDataElementApp({ store, loading = false, error = null }) {
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const metaText = useMemo(() => {
    if (!store) return '';
    const declarations = INT((store.ingresos?.length || 0) + (store.egresos?.length || 0));
    return `${declarations} declaraciones en un ZIP con CSV y Excel`;
  }, [store]);

  const handleDownload = async () => {
    setDownloadError('');
    setDownloading(true);
    try {
      const [ingresosCsv, egresosCsv] = await Promise.all([
        fetchDatasetText(INGRESOS_URL, INGRESO_FILENAME),
        fetchDatasetText(EGRESOS_URL, EGRESO_FILENAME),
      ]);
      const [ingresosExcel, egresosExcel] = await Promise.all([
        createXlsxBlobFromCsv(ingresosCsv),
        createXlsxBlobFromCsv(egresosCsv),
      ]);
      const zipBlob = await createZipBlob([
        { name: INGRESO_FILENAME, data: ingresosCsv },
        { name: EGRESO_FILENAME, data: egresosCsv },
        { name: INGRESO_EXCEL_FILENAME, data: ingresosExcel },
        { name: EGRESO_EXCEL_FILENAME, data: egresosExcel },
      ]);
      downloadBlob(zipBlob, ZIP_FILENAME);
    } catch (nextError) {
      setDownloadError(String(nextError?.message || nextError));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <div>
        <button
          className="btn btn-outline-secondary"
          type="button"
          onClick={() => void handleDownload()}
          disabled={loading || downloading}
        >
          <DownloadIcon />
          <span>{downloading ? 'Descargando…' : BUTTON_LABEL}</span>
        </button>
      </div>
      {loading ? <p className="small text-muted mb-0 mt-2">Cargando…</p> : null}
      {!loading && !error && metaText ? <p className="small text-muted mb-0 mt-2">{metaText}</p> : null}
      {error || downloadError ? <p className="small text-danger mb-0 mt-2">{error || downloadError}</p> : null}
    </div>
  );
}
