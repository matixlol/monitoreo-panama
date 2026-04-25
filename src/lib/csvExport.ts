import { categorizeEgress, normalizeEgressCategoryLabel, summarizeDetalleGasto } from './egressClassification';

type CsvIngressRow = {
  sourceRowId?: string | null;
  pageNumber: number;
  fecha?: string | null;
  rawFecha?: string | null;
  reciboNumero?: string | null;
  numeroCheque?: string | null;
  contribuyenteNombre?: string | null;
  representanteLegal?: string | null;
  cedulaRuc?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  correoElectronico?: string | null;
  donacionesPrivadasEfectivo?: number | null;
  donacionesPrivadasChequeAch?: number | null;
  donacionesPrivadasEspecie?: number | null;
  recursosPropiosEfectivoCheque?: number | null;
  recursosPropiosEspecie?: number | null;
  total?: number | null;
  unreadableFields?: string[];
  humanUnreadableFields?: string[];
};

type CsvEgressRow = {
  sourceRowId?: string | null;
  pageNumber: number;
  fecha?: string | null;
  rawFecha?: string | null;
  numeroFacturaRecibo?: string | null;
  numeroCheque?: string | null;
  cedulaRuc?: string | null;
  proveedorNombre?: string | null;
  detalleGasto?: string | null;
  detalleGastoResumido?: string | null;
  GastoCategoria?: string | null;
  pagoTipo?: 'Efectivo' | 'Especie' | 'Cheque' | null;
  movilizacion?: number | null;
  combustible?: number | null;
  hospedaje?: number | null;
  activistas?: number | null;
  caravanaConcentraciones?: number | null;
  comidaBrindis?: number | null;
  alquilerLocalServiciosBasicos?: number | null;
  cargosBancarios?: number | null;
  totalGastosCampania?: number | null;
  personalizacionArticulosPromocionales?: number | null;
  propagandaElectoral?: number | null;
  totalGastosPropaganda?: number | null;
  totalDeGastosDePropagandaYCampania?: number | null;
  unreadableFields?: string[];
  humanUnreadableFields?: string[];
};

export type CsvExportDocument = {
  _id: string;
  _creationTime: number;
  name: string;
  pageCount: number;
  status: string;
  errorMessage?: string;
  pdfUrl?: string | null;
  // 'official-json' is used for locally-imported export augmentation data.
  source: 'validated' | 'gemini-3' | 'none' | 'official-json';
  sourceModel: string | null;
  sourceCompletedAt: number | null;
  ingress: CsvIngressRow[];
  egress: CsvEgressRow[];
  candidateName?: string | null;
  candidatePosition?: string | null;
  candidateParty?: string | null;
  candidateProvince?: string | null;
  candidateDistrict?: string | null;
  candidateGender?: string | null;
  candidateId?: string | null;
  postulationId?: string | null;
  isSummary?: boolean | null;
  month?: number | null;
  year?: number | null;
};

type CsvRow = CsvIngressRow | CsvEgressRow;

const BASE_CSV_COLUMNS = [
  'documentId',
  'documentName',
  'documentStatus',
  'documentPageCount',
  'documentCreatedAt',
  'documentErrorMessage',
  'pdfUrl',
  'candidateName',
  'candidatePosition',
  'candidateParty',
  'candidateProvince',
  'candidateDistrict',
  'candidateGender',
  'source',
  'sourceModel',
  'sourceCompletedAt',
  'sourceRowId',
  'pageNumber',
  'fecha',
  'rawFecha',
];

const INGRESS_CSV_COLUMNS = [
  ...BASE_CSV_COLUMNS,
  'reciboNumero',
  'numeroCheque',
  'contribuyenteNombre',
  'representanteLegal',
  'cedulaRuc',
  'donacionesPrivadasEfectivo',
  'donacionesPrivadasChequeAch',
  'donacionesPrivadasEspecie',
  'recursosPropiosEfectivoCheque',
  'recursosPropiosEspecie',
  'total',
  'unreadableFields',
  'humanUnreadableFields',
];

const EGRESS_CSV_COLUMNS = [
  ...BASE_CSV_COLUMNS,
  'numeroFacturaRecibo',
  'numeroCheque',
  'cedulaRuc',
  'proveedorNombre',
  'detalleGasto',
  'detalleGastoResumido',
  'GastoCategoria',
  'pagoTipo',
  'movilizacion',
  'combustible',
  'hospedaje',
  'activistas',
  'caravanaConcentraciones',
  'comidaBrindis',
  'alquilerLocalServiciosBasicos',
  'cargosBancarios',
  'totalGastosCampania',
  'personalizacionArticulosPromocionales',
  'propagandaElectoral',
  'totalGastosPropaganda',
  'totalDeGastosDePropagandaYCampania',
  'unreadableFields',
  'humanUnreadableFields',
];

const HIDDEN_CONTACT_FIELD_NAMES = new Set(['direccion', 'telefono', 'correoElectronico']);

function sanitizeCsvString(value: string): string {
  // Strip non-printable control characters that occasionally leak from OCR or source data.
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

const serializeCsvValue = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return `"${sanitizeCsvString(JSON.stringify(value)).replace(/"/g, '""')}"`;
  }
  const stringValue = sanitizeCsvString(String(value));
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

function removeHiddenContactFieldNames(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.filter((fieldName) => !HIDDEN_CONTACT_FIELD_NAMES.has(String(fieldName)));
}

const getCsvValue = (column: string, doc: CsvExportDocument, row: CsvIngressRow | CsvEgressRow) => {
  switch (column) {
    case 'documentId':
      return doc._id;
    case 'documentName':
      return doc.name;
    case 'documentStatus':
      return doc.status;
    case 'documentPageCount':
      return doc.pageCount;
    case 'documentCreatedAt':
      return doc._creationTime;
    case 'documentErrorMessage':
      return doc.errorMessage ?? null;
    case 'pdfUrl':
      return doc.pdfUrl ?? null;
    case 'candidateName':
      return doc.candidateName ?? null;
    case 'candidatePosition':
      return doc.candidatePosition ?? null;
    case 'candidateParty':
      return doc.candidateParty ?? null;
    case 'candidateProvince':
      return doc.candidateProvince ?? null;
    case 'candidateDistrict':
      return doc.candidateDistrict ?? null;
    case 'candidateGender':
      return doc.candidateGender ?? null;
    case 'source':
      return doc.source;
    case 'sourceModel':
      return doc.sourceModel ?? null;
    case 'sourceCompletedAt':
      return doc.sourceCompletedAt ?? null;
    case 'detalleGastoResumido':
      return 'detalleGastoResumido' in row && row.detalleGastoResumido !== undefined
        ? row.detalleGastoResumido
        : summarizeDetalleGasto(row as CsvEgressRow);
    case 'GastoCategoria':
      return (
        normalizeEgressCategoryLabel('GastoCategoria' in row ? row.GastoCategoria : null) ??
        categorizeEgress(row as CsvEgressRow)
      );
    case 'unreadableFields':
    case 'humanUnreadableFields':
      return removeHiddenContactFieldNames((row as Record<string, unknown>)[column]);
    default:
      return (row as Record<string, unknown>)[column] ?? null;
  }
};

const createCsvStream = <RowType extends CsvRow>(
  exportData: CsvExportDocument[],
  columns: string[],
  getRows: (doc: CsvExportDocument) => RowType[],
) => {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`${columns.join(',')}\n`));

      for (const doc of exportData) {
        const rows = getRows(doc) ?? [];

        for (const row of rows) {
          const line = columns.map((column) => serializeCsvValue(getCsvValue(column, doc, row))).join(',');
          controller.enqueue(encoder.encode(`${line}\n`));
        }
      }

      controller.close();
    },
  });
};

export const createIngressCsvStream = (exportData: CsvExportDocument[]) =>
  createCsvStream(exportData, INGRESS_CSV_COLUMNS, (doc) => doc.ingress ?? []);

export const createEgressCsvStream = (exportData: CsvExportDocument[]) =>
  createCsvStream(exportData, EGRESS_CSV_COLUMNS, (doc) => doc.egress ?? []);
