type EgressLikeRow = {
  detalleGasto?: string | null;
  detalleGastoResumido?: string | null;
  GastoCategoria?: string | null;
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
};

const EXACT_DETAIL_SUMMARY_MAP: Record<string, string> = {
  'transp': 'Transporte',
  'transp.': 'Transporte',
  'movilizacion': 'Movilización',
  'movilizacion activistas': 'Movilización Activistas',
  'alimentacion': 'Alimentación',
  'viveres': 'Víveres',
  'comida / viveres': 'Víveres',
  'viveres comida': 'Víveres',
  'alimentacion hidratacion': 'Víveres',
  'comida servicio de': 'Víveres',
  'cargo bancario': 'Cargos Bancarios',
  'cargos bancarios': 'Cargos Bancarios',
  'cargo por timbre': 'Cargo Por Timbres',
  'cargo por timbres': 'Cargo Por Timbres',
  'cargos por timbre': 'Cargo Por Timbres',
  'cargos por timbres': 'Cargo Por Timbres',
  'comision de chequera': 'Comision De Chequera',
  'comision chequera': 'Comision De Chequera',
  'itbms com chequera': 'Comision De Chequera',
  'itbms comision chequera': 'Comision De Chequera',
  'itbms de comision de chequera': 'Comision De Chequera',
  'comision bancaria': 'Comision De Chequera',
  'cargo por timbres cheques procesados': 'Cargo Por Timbres',
  'donacion': 'Donacion',
  'c. donacion': 'Donacion',
  'donacion de comida': 'Donacion De Comida',
  'donacion de alimentos': 'Donacion De Alimentos',
  'donacion de alimentos para brindar': 'Donacion De Alimentos',
  'donacion recibo de comida': 'Donacion De Comida',
  'pago de activista': 'Pago De Activistas',
  'pago de activistas': 'Pago De Activistas',
  'pagos de activistas': 'Pago De Activistas',
  'activista': 'Pago De Activistas',
  'activistas': 'Pago De Activistas',
  'pago de observadores': 'Pago De Observadores',
  'combustible / gasolina': 'Combustible',
  'gasolina': 'Combustible',
  'diesel': 'Combustible',
  'diésel': 'Combustible',
  'compra de combustible': 'Combustible',
  'reembolso combustible': 'Combustible',
  'gasto de combustible': 'Combustible',
  'registra gasto de combustible': 'Combustible',
  'registra compra de combustible gira chiriqui': 'Combustible',
  'compra de viveres': 'Víveres',
  'compra de comida': 'Alimentación',
  'comida y brindis': 'Comida Y Brindis',
  'comidas y brindis': 'Comida Y Brindis',
  'platos de comida': 'Alimentación',
  'registra gasto de alimentacion': 'Alimentación',
  'registra alimentacion': 'Alimentación',
  'caja menuda gasto alimentacion gira': 'Caja Menuda Gasto Alimentación Gira',
  'redes sociales': 'Redes Sociales',
  'manejo de redes sociales': 'Manejo De Redes Sociales',
  'administracion de redes': 'Manejo De Redes Sociales',
  'medios digitales': 'Medios Digitales',
  'articulos promocionales': 'Articulos Promocionales',
  'articulos promocionales - tshirts de campaña': 'Articulos Promocionales',
  'articulos para publicidad': 'Articulos Promocionales',
  'articulos para promociones': 'Articulos Promocionales',
  'articulos personalizados': 'Articulos Promocionales',
  'art. promocional': 'Articulos Promocionales',
  'art. promocionales': 'Articulos Promocionales',
  'promocional': 'Articulos Promocionales',
  'promocionales': 'Articulos Promocionales',
  'a. promocionales': 'Articulos Promocionales',
  'personalizacion': 'Personalizacion De Artículos',
  'personalizacion sueter': 'Personalizacion De Artículos',
  'personalizacion de articulos': 'Personalizacion De Artículos',
  'personalizacion de artículos': 'Personalizacion De Artículos',
  'personalizacion de artículos promocionales': 'Personalizacion De Artículos',
  'valla publicitaria': 'Vallas Publicitarias',
  'vallas publicitarias': 'Vallas Publicitarias',
  'vallas y banners': 'Vallas Publicitarias',
  'banners y vallas': 'Vallas Publicitarias',
  'confeccion de banner': 'Banners',
  'confeccion de baners': 'Banners',
  'confección de banners': 'Banners',
  'impresion de banners': 'Banners',
  'impresión de banners': 'Banners',
  'impresion banners': 'Banners',
  'impresión banners': 'Banners',
  'microperforado': 'Microperforados',
  'microperforados': 'Microperforados',
  'volanteo': 'Volantes',
  'volante': 'Volantes',
  'volantes': 'Volantes',
  'copias e impresion': 'Copias E Impresiones',
  'copias e impresiones': 'Copias E Impresiones',
  'impresiones publicitarias': 'Impresiones Publicitarias',
  'impresion baners': 'Banners',
  'alquiler de local': 'Alquiler De Local',
  'alquiler de local / servicios básicos': 'Alquiler De Local',
  'alquiler de buses': 'Alquiler De Buses',
  'alquiler de busito h': 'Alquiler De Buses',
  'alquiler de lancha': 'Alquiler De Lancha',
  'alquiler de lancha y motor': 'Alquiler De Lancha',
  'alquiler de auto': 'Alquiler De Vehiculos',
  'alquiler de carro': 'Alquiler De Vehiculos',
  'alquiler de vehiculos': 'Alquiler De Vehiculos',
  'alquier de vehiculos': 'Alquiler De Vehiculos',
  'caja menuda registra compra materiales de oficina': 'Caja Menuda Oficina',
  'caja menuda registra compra de materiales de oficina': 'Caja Menuda Oficina',
  'caja menuda registra compra material de oficina': 'Caja Menuda Oficina',
  'caja menuda registra compra utiles de oficina': 'Caja Menuda Oficina',
  'cajamenuda registra compra de utiles de oficina': 'Caja Menuda Oficina',
  'servicios contables': 'Servicios De Contabilidad',
  'servicios de contabilidad': 'Servicios De Contabilidad',
  'servicios contador': 'Servicios De Contabilidad',
  'servicios contable': 'Servicios De Contabilidad',
  'honorario contable': 'Servicios De Contabilidad',
  'coordinador de campaña': 'Coordinador De Campaña',
  'jefe de campaña': 'Jefe De Campaña',
  'cordinador de capacitacion': 'Coordinador De Capacitacion',
  'evento': 'Evento',
  'eventos': 'Evento',
  'reunion': 'Evento',
  'reunión': 'Evento',
  'fuego artificiales': 'Fuegos Artificiales',
  'fuegos artificiales': 'Fuegos Artificiales',
  'hospedaje': 'Hospedaje',
};

const SUMMARY_RULES: Array<{ label: string; patterns: RegExp[] }> = [
  {
    label: 'Donacion',
    patterns: [/\bdonaci(?:on|ones?)\b/u, /\bc\.?\s*donacion\b/u, /\bdonacion\s+ck[-\s]?\d+/u, /\baporte\b/u],
  },
  {
    label: 'Pago De Observadores',
    patterns: [/\bobservador(?:es)?\b/u, /\bpago\s+de\s+observador(?:es)?\b/u],
  },
  {
    label: 'Pago De Activistas',
    patterns: [/\bpago\s+de\s+activista(?:s)?\b/u, /\bpagos?\s+de\s+activista(?:s)?\b/u, /\bactivista(?:s)?\b/u],
  },
  {
    label: 'Combustible',
    patterns: [
      /\bcombustible\b/u,
      /\bgasolina\b/u,
      /\bdiesel\b/u,
      /\bdi[eé]sel\b/u,
      /\bterpel\b/u,
      /\btexaco\b/u,
      /\bestaci[oó]n\s+de\s+combustible\b/u,
    ],
  },
  {
    label: 'Movilización',
    patterns: [
      /\bmovilizacion\b/u,
      /\bmovilizaci[oó]n\b/u,
      /\btransporte\b/u,
      /\bpasaje\b/u,
      /\bflete\b/u,
      /\bcaravana\b/u,
      /\bestacionamiento\b/u,
    ],
  },
  {
    label: 'Hospedaje',
    patterns: [/\bhospedaje\b/u, /\bhotel\b/u],
  },
  {
    label: 'Alquiler De Local',
    patterns: [
      /\balquiler\b.*\blocal\b/u,
      /\balquiler\b.*\boficina\b/u,
      /\brenta\b.*\blocal\b/u,
      /\blocal\b/u,
      /\boficina\b/u,
      /\binmueble\b/u,
      /\bsillas\b/u,
      /\brancho\b/u,
      /\bespacio\b/u,
    ],
  },
  {
    label: 'Alquiler De Vehiculos',
    patterns: [
      /\balquiler\b.*\b(auto|carro|vehiculo|vehiculos|bus|buses|busito|lancha|motor)\b/u,
      /\blancha\b/u,
      /\bvehiculo\b/u,
      /\bvehiculos\b/u,
      /\bauto\b/u,
      /\bcarro\b/u,
      /\bbuses?\b/u,
    ],
  },
  {
    label: 'Alimentación',
    patterns: [
      /\balimentacion\b/u,
      /\balimentaci[oó]n\b/u,
      /\bcomida\b/u,
      /\bcomidas\b/u,
      /\balimento(?:s)?\b/u,
      /\bviveres\b/u,
      /\bviveres\b/u,
      /\bvíveres\b/u,
      /\bcocinera\b/u,
      /\bcocina\b/u,
      /\brefrigerio\b/u,
      /\bhielo\b/u,
      /\bgatorade\b/u,
      /\brefresco(?:s)?\b/u,
      /\bsoda\b/u,
      /\bjugo(?:s)?\b/u,
      /\bbrindis\b/u,
      /\bplatos?\s+de\s+comida\b/u,
    ],
  },
  {
    label: 'Cargo Por Timbres',
    patterns: [/\btimbres?\b/u, /\btimbre\b/u],
  },
  {
    label: 'Comision De Chequera',
    patterns: [/\bchequera\b/u, /\bcomision\s+bancaria\b/u, /\bcomisi[oó]n\s+bancaria\b/u],
  },
  {
    label: 'Cargos Bancarios',
    patterns: [/\bcargos?\s+bancari(?:o|os)\b/u, /\bcierre\s+de\s+cuenta\b/u, /\bitbms\s+cuentas\b/u],
  },
  {
    label: 'Servicios De Contabilidad',
    patterns: [
      /\bcontabil(?:idad|idades)?\b/u,
      /\bcontable(?:s)?\b/u,
      /\bcontador(?:es)?\b/u,
      /\bhonorario\s+contable\b/u,
    ],
  },
  {
    label: 'Servicios Administrativos',
    patterns: [
      /\bservicios?\s+administrativos?\b/u,
      /\bnotarizacion\b/u,
      /\bnotarizaci[oó]n\b/u,
      /\binternet\b/u,
      /\btelefono\b/u,
      /\btelefonia\b/u,
      /\btelecom\b/u,
      /\belectricidad\b/u,
      /\bagua\b/u,
      /\bgas\b/u,
      /\bnaturgy\b/u,
      /\bmantenimiento\b/u,
      /\binstalacion\b/u,
      /\binstalaci[oó]n\b/u,
    ],
  },
  {
    label: 'Manejo De Redes Sociales',
    patterns: [
      /\bredes?\s+sociales?\b/u,
      /\bfacebook\b/u,
      /\bmarketing\b/u,
      /\bmedios\s+digitales\b/u,
      /\baudiovisual\b/u,
      /\bvideo\b/u,
      /\bred\s+social\b/u,
      /\bprograma\s+politico\b/u,
      /\bprograma\s+radial\b/u,
      /\bradio\b/u,
      /\btelevision\b/u,
      /\btelevisi[oó]n\b/u,
      /\bcuña\b/u,
      /\bcuna\b/u,
      /\bpauta\b/u,
    ],
  },
  {
    label: 'Articulos Promocionales',
    patterns: [
      /\bpromocional(?:es)?\b/u,
      /\bpersonalizacion(?:es)?\b/u,
      /\bpersonalizaci[oó]n(?:es)?\b/u,
      /\bcamiseta(?:s)?\b/u,
      /\bgorra(?:s)?\b/u,
      /\bsticker(?:s)?\b/u,
      /\bserigraf/i,
      /\bt-?shirts?\b/u,
      /\bsueter(?:es)?\b/u,
      /\bsweter(?:es)?\b/u,
      /\bbordado(?:s)?\b/u,
      /\bbandera(?:s)?\b/u,
      /\btaza(?:s)?\b/u,
      /\bparaguas\b/u,
    ],
  },
  {
    label: 'Vallas Publicitarias',
    patterns: [/\bvalla(?:s)?\b/u, /\bbanner(?:s)?\b/u, /\bmicroperforado(?:s)?\b/u],
  },
  {
    label: 'Volantes',
    patterns: [/\bvolante(?:s|o)?\b/u, /\btriptico(?:s)?\b/u, /\btr[ií]ptico(?:s)?\b/u, /\blibreta(?:s)?\b/u],
  },
  {
    label: 'Copias E Impresiones',
    patterns: [
      /\bimpresion(?:es)?\b/u,
      /\bimpresi[oó]n(?:es)?\b/u,
      /\bcopias?\b/u,
      /\bimprenta\b/u,
      /\bfotocopia(?:s)?\b/u,
    ],
  },
  {
    label: 'Evento',
    patterns: [
      /\bevento(?:s)?\b/u,
      /\bacto\b/u,
      /\bmitin\b/u,
      /\bconcentraci(?:on|ones)\b/u,
      /\bconcentraci[oó]n(?:es)?\b/u,
      /\breunion(?:es)?\b/u,
      /\breuni[oó]n(?:es)?\b/u,
      /\bcabalgata\b/u,
      /\bfuegos?\s+artificiales\b/u,
      /\bseguridad\b/u,
      /\bprotocolo\b/u,
      /\blogistica\b/u,
      /\blog[ií]stica\b/u,
      /\bencuesta\b/u,
    ],
  },
  {
    label: 'Caja Menuda',
    patterns: [/\bcaja\s+menuda\b/u, /\bfondo\s+de\s+emergencia\b/u],
  },
  {
    label: 'Reembolso',
    patterns: [/\breembolso\b/u, /\babono\s+a\b/u, /\byappy\b/u],
  },
];

const EGRESS_CATEGORY_LABELS: Record<string, string> = {
  'alimentacion': 'Alimentación',
  'transporte y movilizacion': 'Transporte y Movilización',
  'personal de campana': 'Personal de Campaña',
  'publicidad y promocion': 'Publicidad y Promoción',
  'eventos y logistica electoral': 'Eventos y Logística Electoral',
  'servicios y administracion': 'Servicios y Administración',
  'operacion de campana': 'Operación de Campaña',
};

const normalizeSpaces = (text: string) => text.replace(/[\u00A0\s]+/g, ' ').trim();

const toTitleCase = (text: string) =>
  text
    .toLocaleLowerCase('es')
    .replace(
      /(^|[\s/\-(])([\p{L}\p{N}])/gu,
      (_, prefix: string, char: string) => `${prefix}${char.toLocaleUpperCase('es')}`,
    );

const normalizeMatchKey = (text: string) =>
  normalizeSpaces(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[“”"'`´.,;:!?()[\]{}]+/g, ' ')
    .toLocaleLowerCase('es')
    .replace(/\s+/g, ' ')
    .trim();

const cleanDetailText = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const text = normalizeSpaces(String(value));
  if (!text) return null;
  if (normalizeMatchKey(text) === 'undefined') return null;
  return text;
};

export function normalizeEgressCategoryLabel(value: unknown): string | null {
  const text = cleanDetailText(value);
  if (!text) return null;
  return EGRESS_CATEGORY_LABELS[normalizeMatchKey(text)] ?? text;
}

function hasPositiveAmount(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  const parsed = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) && parsed > 0;
}

function summarizeFromAmounts(row: EgressLikeRow): string | null {
  if (hasPositiveAmount(row.combustible)) return 'Combustible';
  if (hasPositiveAmount(row.movilizacion) || hasPositiveAmount(row.caravanaConcentraciones)) return 'Movilización';
  if (hasPositiveAmount(row.comidaBrindis)) return 'Alimentación';
  if (hasPositiveAmount(row.activistas)) return 'Pago De Activistas';
  if (hasPositiveAmount(row.alquilerLocalServiciosBasicos)) return 'Alquiler De Local';
  if (hasPositiveAmount(row.hospedaje)) return 'Hospedaje';
  if (hasPositiveAmount(row.cargosBancarios)) return 'Cargos Bancarios';
  if (hasPositiveAmount(row.personalizacionArticulosPromocionales) || hasPositiveAmount(row.propagandaElectoral)) {
    return 'Articulos Promocionales';
  }
  if (hasPositiveAmount(row.totalGastosPropaganda)) return 'Propaganda Electoral';
  if (hasPositiveAmount(row.totalGastosCampania) || hasPositiveAmount(row.totalDeGastosDePropagandaYCampania)) {
    return 'Operación de Campaña';
  }
  return null;
}

function applyOpenRefineStyleCleanup(text: string): string {
  let next = toTitleCase(normalizeSpaces(text));

  const exactBefore = EXACT_DETAIL_SUMMARY_MAP[normalizeMatchKey(next)];
  if (exactBefore) next = exactBefore;

  next = next.replace(/^Registra\s+/i, '');
  next = next.replace(/^Compra\s+De\s+/i, '');
  next = normalizeSpaces(next);

  const exactAfter = EXACT_DETAIL_SUMMARY_MAP[normalizeMatchKey(next)];
  if (exactAfter) next = exactAfter;

  return next;
}

function applySummaryRules(text: string): string | null {
  for (const rule of SUMMARY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return rule.label;
    }
  }
  return null;
}

export function summarizeDetalleGasto(row: EgressLikeRow): string | null {
  const existing = cleanDetailText(row.detalleGastoResumido);
  if (existing) return existing;

  const original = cleanDetailText(row.detalleGasto);
  if (!original) return summarizeFromAmounts(row);

  const cleaned = applyOpenRefineStyleCleanup(original);
  const normalized = normalizeMatchKey(cleaned);
  const exact = EXACT_DETAIL_SUMMARY_MAP[normalized];
  if (exact) return exact;

  const heuristic = applySummaryRules(normalized);
  if (heuristic) return heuristic;

  return cleaned;
}

function textIncludesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

export function categorizeEgress(row: EgressLikeRow): string {
  const existing = normalizeEgressCategoryLabel(row.GastoCategoria);
  if (existing) return existing;

  const detailSummary = summarizeDetalleGasto(row);
  const originalDetail = cleanDetailText(row.detalleGasto);
  const combined = normalizeMatchKey([detailSummary, originalDetail].filter(Boolean).join(' '));

  if (
    textIncludesAny(combined, [
      'comida',
      'alimento',
      'alimentacion',
      'comestible',
      'viveres',
      'bebida',
      'cocina',
      'cocinera',
      'refrigerio',
      'hielo',
      'gatorade',
      'refresco',
      'soda',
      'jugos',
      'jugo',
      'pollo',
      'cerdo',
      'arroz',
      'legumbres',
      'verduras',
      'carnico',
      'brindis',
    ])
  ) {
    return 'Alimentación';
  }

  if (
    textIncludesAny(combined, [
      'combustible',
      'gasolina',
      'diesel',
      'terpel',
      'movilizacion',
      'transporte',
      'caravana',
      'viatico',
      'viaticos',
      'vehiculo',
      'auto',
      'camion',
      'flete',
      'pasaje',
      'lancha',
      'estacionamiento',
      'unidad movil',
      'tolda',
    ])
  ) {
    return 'Transporte y Movilización';
  }

  if (
    textIncludesAny(combined, [
      'activista',
      'coordinador',
      'jefe de campana',
      'encargado',
      'asistente',
      'voluntario',
      'administrador',
      'administrativo',
      'ayudante',
      'apoyo',
      'pago de',
      'honorarios',
      'personal',
    ])
  ) {
    return 'Personal de Campaña';
  }

  if (
    textIncludesAny(combined, [
      'propaganda',
      'publicidad',
      'anuncio',
      'radio',
      'tv',
      'television',
      'cuna',
      'pauta',
      'redes sociales',
      'facebook',
      'marketing',
      'medios digitales',
      'audiovisual',
      'video',
      'diseno',
      'grafico',
      'arte digital',
      'jingle',
      'voceo',
      'radial',
      'programa radial',
      'valla',
      'volante',
      'banner',
      'afiche',
      'material publicitario',
      'promocional',
      'camiseta',
      'gorra',
      'sticker',
      'serigrafia',
      'impr',
      'copias',
      'impresion',
      'fotocopia',
      'tarjetas',
      'libretas',
      'tripticos',
      'microperforados',
    ])
  ) {
    return 'Publicidad y Promoción';
  }

  if (
    textIncludesAny(combined, [
      'evento',
      'acto',
      'mitin',
      'concentracion',
      'reunion',
      'ceremonia',
      'cabalgata',
      'fuegos artificiales',
      'observador',
      'credencial',
      'mesa',
      'encuesta',
      'seguridad',
      'protocolo',
      'logistica',
    ])
  ) {
    return 'Eventos y Logística Electoral';
  }

  if (
    textIncludesAny(combined, [
      'comision',
      'cargo bancario',
      'cargos bancarios',
      'chequera',
      'token',
      'timbre',
      'itbms',
      'transaccion',
      'devolucion',
      'nota de debito',
      'servicios basicos',
      'electricidad',
      'agua',
      'gas',
      'internet',
      'celulares',
      'telefon',
      'telecom',
      'naturgy',
      'tesoreria',
      'notarizacion',
      'mantenimiento',
      'instalacion',
      'servicios de',
    ])
  ) {
    return 'Servicios y Administración';
  }

  if (
    textIncludesAny(combined, [
      'alquiler',
      'renta',
      'local',
      'oficina',
      'inmueble',
      'hospedaje',
      'hotel',
      'salon',
      'sillas',
      'rancho',
      'infraestructura',
      'espacio',
    ])
  ) {
    return 'Alquiler e Infraestructura';
  }

  if (textIncludesAny(combined, ['donacion', 'aporte', 'contribucion'])) {
    return 'Donaciones';
  }

  if (textIncludesAny(combined, ['caja menuda', 'fondo de emergencia', 'reembolso', 'abono a', 'yappy'])) {
    return 'Reembolsos y Caja Menuda';
  }

  if (
    hasPositiveAmount(row.combustible) ||
    hasPositiveAmount(row.movilizacion) ||
    hasPositiveAmount(row.caravanaConcentraciones)
  ) {
    return 'Transporte y Movilización';
  }
  if (hasPositiveAmount(row.comidaBrindis)) return 'Alimentación';
  if (hasPositiveAmount(row.activistas)) return 'Personal de Campaña';
  if (hasPositiveAmount(row.alquilerLocalServiciosBasicos) || hasPositiveAmount(row.hospedaje)) {
    return 'Alquiler e Infraestructura';
  }
  if (hasPositiveAmount(row.cargosBancarios)) return 'Servicios y Administración';
  if (hasPositiveAmount(row.personalizacionArticulosPromocionales) || hasPositiveAmount(row.propagandaElectoral)) {
    return 'Publicidad y Promoción';
  }
  if (hasPositiveAmount(row.totalGastosPropaganda)) return 'Publicidad y Promoción';
  if (hasPositiveAmount(row.totalGastosCampania) || hasPositiveAmount(row.totalDeGastosDePropagandaYCampania)) {
    return 'Operación de Campaña';
  }

  return 'Operación de Campaña';
}
