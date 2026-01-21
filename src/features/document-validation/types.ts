export type IngressRow = {
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
  // AI-detected unreadable fields (from extractions)
  unreadableFields?: string[];
  // Human-marked unreadable fields (for validations)
  humanUnreadableFields?: string[];
  // Internal UI-only fields (must be stripped before saving)
  __rowKey?: string;
  __stableRowKey?: string;
  __sourceModel?: string;
};

export type EgressRow = {
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
  // AI-detected unreadable fields (from extractions)
  unreadableFields?: string[];
  // Human-marked unreadable fields (for validations)
  humanUnreadableFields?: string[];
  // Internal UI-only fields (must be stripped before saving)
  __rowKey?: string;
  __stableRowKey?: string;
  __sourceModel?: string;
};

export type ModelExtractions = Record<string, { ingress: IngressRow[]; egress: EgressRow[] }>;

export const INGRESS_KEY_FIELD = 'reciboNumero' as const;
export const EGRESS_KEY_FIELD = 'numeroFacturaRecibo' as const;

export const INGRESS_COLUMNS: { key: keyof IngressRow; label: string; type: 'string' | 'number' }[] = [
  { key: 'pageNumber', label: 'Pág', type: 'number' },
  { key: 'fecha', label: 'Fecha', type: 'string' },
  { key: 'reciboNumero', label: 'Recibo No.', type: 'string' },
  { key: 'contribuyenteNombre', label: 'Contribuyente', type: 'string' },
  { key: 'representanteLegal', label: 'Rep. Legal', type: 'string' },
  { key: 'cedulaRuc', label: 'Cédula/RUC', type: 'string' },
  { key: 'donacionesPrivadasEfectivo', label: 'Don. Efectivo', type: 'number' },
  { key: 'donacionesPrivadasChequeAch', label: 'Don. Cheque/ACH', type: 'number' },
  { key: 'donacionesPrivadasEspecie', label: 'Don. Especie', type: 'number' },
  { key: 'recursosPropiosEfectivoCheque', label: 'Rec. Propios Efec/Cheque', type: 'number' },
  { key: 'recursosPropiosEspecie', label: 'Rec. Propios Especie', type: 'number' },
  { key: 'total', label: 'Total', type: 'number' },
];

export const EGRESS_INFO_COLUMNS: { key: keyof EgressRow; label: string; type: 'string' | 'number' }[] = [
  { key: 'pageNumber', label: 'Pág', type: 'number' },
  { key: 'fecha', label: 'Fecha', type: 'string' },
  { key: 'numeroFacturaRecibo', label: 'Factura/Recibo', type: 'string' },
  { key: 'cedulaRuc', label: 'Cédula/RUC', type: 'string' },
  { key: 'proveedorNombre', label: 'Proveedor', type: 'string' },
  { key: 'detalleGasto', label: 'Detalle', type: 'string' },
  { key: 'pagoTipo', label: 'Tipo Pago', type: 'string' },
];

export const EGRESS_SPEND_COLUMNS: { key: keyof EgressRow; label: string }[] = [
  { key: 'movilizacion', label: 'Movilización' },
  { key: 'combustible', label: 'Combustible' },
  { key: 'hospedaje', label: 'Hospedaje' },
  { key: 'activistas', label: 'Activistas' },
  { key: 'caravanaConcentraciones', label: 'Caravana/Conc.' },
  { key: 'comidaBrindis', label: 'Comida/Brindis' },
  { key: 'alquilerLocalServiciosBasicos', label: 'Alquiler/Serv.' },
  { key: 'cargosBancarios', label: 'Carg. Bancarios' },
  { key: 'personalizacionArticulosPromocionales', label: 'Art. Promocionales' },
  { key: 'propagandaElectoral', label: 'Propaganda' },
  { key: 'totalGastosCampania', label: 'Tot. Campaña' },
  { key: 'totalGastosPropaganda', label: 'Tot. Propaganda' },
];

export const EGRESS_TOTAL_COLUMN: { key: keyof EgressRow; label: string } = {
  key: 'totalDeGastosDePropagandaYCampania',
  label: 'TOTAL GENERAL',
};

export function createIngressRow(pageNumber: number): IngressRow {
  return {
    pageNumber,
    reciboNumero: '',
    fecha: null,
    contribuyenteNombre: null,
    representanteLegal: null,
    cedulaRuc: null,
    direccion: null,
    telefono: null,
    correoElectronico: null,
    donacionesPrivadasEfectivo: null,
    donacionesPrivadasChequeAch: null,
    donacionesPrivadasEspecie: null,
    recursosPropiosEfectivoCheque: null,
    recursosPropiosEspecie: null,
    total: null,
  };
}

export function createEgressRow(pageNumber: number): EgressRow {
  return {
    pageNumber,
    numeroFacturaRecibo: '',
    fecha: null,
    cedulaRuc: null,
    proveedorNombre: null,
    detalleGasto: null,
    pagoTipo: null,
    movilizacion: null,
    combustible: null,
    hospedaje: null,
    activistas: null,
    caravanaConcentraciones: null,
    comidaBrindis: null,
    alquilerLocalServiciosBasicos: null,
    cargosBancarios: null,
    totalGastosCampania: null,
    personalizacionArticulosPromocionales: null,
    propagandaElectoral: null,
    totalGastosPropaganda: null,
    totalDeGastosDePropagandaYCampania: null,
  };
}
