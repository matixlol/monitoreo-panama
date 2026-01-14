type CsvIngressRow = {
  pageNumber: number;
  fecha?: string | null;
  reciboNumero?: string | null;
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
  pageNumber: number;
  fecha?: string | null;
  numeroFacturaRecibo?: string | null;
  cedulaRuc?: string | null;
  proveedorNombre?: string | null;
  detalleGasto?: string | null;
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
  source: 'validated' | 'gemini-3' | 'none';
  sourceModel: string | null;
  sourceCompletedAt: number | null;
  ingress: CsvIngressRow[];
  egress: CsvEgressRow[];
  candidateName?: string | null;
  candidatePosition?: string | null;
  candidateParty?: string | null;
  candidateProvince?: string | null;
  candidateDistrict?: string | null;
};

type CsvRow = CsvIngressRow | CsvEgressRow;

const BASE_CSV_COLUMNS = [
  'documentId',
  'documentName',
  'documentStatus',
  'documentPageCount',
  'documentCreatedAt',
  'documentErrorMessage',
  'candidateName',
  'candidatePosition',
  'candidateParty',
  'candidateProvince',
  'candidateDistrict',
  'source',
  'sourceModel',
  'sourceCompletedAt',
  'pageNumber',
  'fecha',
];

const INGRESS_CSV_COLUMNS = [
  ...BASE_CSV_COLUMNS,
  'reciboNumero',
  'contribuyenteNombre',
  'representanteLegal',
  'cedulaRuc',
  'direccion',
  'telefono',
  'correoElectronico',
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
  'cedulaRuc',
  'proveedorNombre',
  'detalleGasto',
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

const serializeCsvValue = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
  }
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

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
    case 'source':
      return doc.source;
    case 'sourceModel':
      return doc.sourceModel ?? null;
    case 'sourceCompletedAt':
      return doc.sourceCompletedAt ?? null;
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
