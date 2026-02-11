import { PDFDocument } from 'pdf-lib';
import * as mupdf from 'mupdf';
import { z } from 'zod';

import { getModel } from './models';
export { MODELS, DEFAULT_MODEL, getModel, type ModelKey } from './models';

export const EXTRACTION_PROMPT = `This PDF segment contains financial reports from Panama's Electoral Tribunal (Tribunal Electoral).

<task>
Extract rows from "INFORME DE INGRESOS" and "INFORME DE GASTOS" tables. Don't extract the table if it doesn't look like the one described below.
</task>

<critical_rules>
1) If a cell is empty, return a literal \`null\`. Do not shift values into earlier columns when a column is empty.
2) If column headers are missing (continued page), interpret rows strictly in the column order listed below using the visible column grid and spacing.
3) Do not infer monetary columns from totals or from "first non-empty amount". Use the visual column alignment and gridlines.
4) If a monetary value could fit multiple columns, leave all monetary columns \`null\` and add those field names to "unreadableFields".
5) Read each cell as-is. If unclear, mark that field in "unreadableFields" instead of guessing.
</critical_rules>

"INFORME DE INGRESOS" example (headers missing but columns are fixed):
If the row has one amount aligned under "Donaciones Privadas - Cheque/ACH" and "Donaciones Privadas - Efectivo" is empty, return:
donacionesPrivadasEfectivo: null, donacionesPrivadasChequeAch: 400

"INFORME DE INGRESOS" (Formulario Pre-17/Pre-7) columns:
1. Fecha, 2. Recibo No., 3. Nombre del Contribuyente, 4. Representante Legal, 5. Cédula/RUC, 6. Dirección, 7. Teléfono, 8. Correo Electrónico, 9. Donaciones Privadas - Efectivo, 10. Donaciones Privadas - Cheque/ACH, 11. Donaciones Privadas - Especie, 12. Recursos Propios - Efectivo/Cheque, 13. Recursos Propios - Especie, 14. TOTAL

"INFORME DE GASTOS" (Formulario Pre-18/Pre-8) columns:
1. Fecha, 2. No. de Factura/Recibo, 3. Cédula/RUC, 4. Nombre del Proveedor, 5. Detalle del Gasto, 6. Pago en Efectivo, Especie o Cheque, 7. Movilización, 8. Combustible, 9. Hospedaje, 10. Activistas, 11. Caravana y concentraciones, 12. Comida y Brindis, 13. Alquiler de Local / servicios básicos, 14. Cargos Bancarios, 15. Total de Gastos de Campaña (totalGastosCampania), 16. Personalización de artículos promocionales, 17. Propaganda Electoral, 18. Total de Gastos de Propaganda (totalGastosPropaganda), 19. Total de Gastos de Propaganda y Campaña (totalDeGastosDePropagandaYCampania)

Do not confuse Total de Gastos de Campaña (totalGastosCampania) with Total de Gastos de Propaganda y Campaña (totalDeGastosDePropagandaYCampania). If it's available, always include "totalDeGastosDePropagandaYCampania".

For each row, if any fields are illegible, unreadable, or unclear in the source document (e.g., due to poor scan quality, handwriting that can't be deciphered, or obscured text), list the field names in the "unreadableFields" array. Only include fields that you genuinely cannot read - do not include fields that are simply empty.`;

export type PageTypeHint = 'ingress' | 'egress';

export function getExtractionPrompt(pageTypeHint?: PageTypeHint | null): string {
  if (pageTypeHint === 'ingress') {
    return (
      EXTRACTION_PROMPT +
      '\n\nIMPORTANT: This page has been manually identified as an "INFORME DE INGRESOS" page. You MUST extract rows into the "ingress" array, even if the table headers are missing or the page looks ambiguous. Do NOT extract any egress rows — return an empty "egress" array.'
    );
  }
  if (pageTypeHint === 'egress') {
    return (
      EXTRACTION_PROMPT +
      '\n\nIMPORTANT: This page has been manually identified as an "INFORME DE GASTOS" page. You MUST extract rows into the "egress" array, even if the table headers are missing or the page looks ambiguous. Do NOT extract any ingress rows — return an empty "ingress" array.'
    );
  }
  return EXTRACTION_PROMPT;
}

export const IngresoRowSchema = z.object({
  fecha: z.string().nullish(),
  reciboNumero: z.string().nullish(),
  contribuyenteNombre: z.string().nullish(),
  representanteLegal: z.string().nullish(),
  cedulaRuc: z
    .string()
    .nullish()
    .transform((a) => (a === 'null' ? null : a)),
  direccion: z.string().nullish(),
  telefono: z.string().nullish(),
  correoElectronico: z.string().nullish(),
  donacionesPrivadasEfectivo: z.number().nullish(),
  donacionesPrivadasChequeAch: z.number().nullish(),
  donacionesPrivadasEspecie: z.number().nullish(),
  recursosPropiosEfectivoCheque: z.number().nullish(),
  recursosPropiosEspecie: z.number().nullish(),
  total: z.number().nullish(),
  unreadableFields: z.array(z.string()).nullish(),
});

export const EgresoRowSchema = z.object({
  fecha: z.string().nullish(),
  numeroFacturaRecibo: z.string().nullish(),
  cedulaRuc: z
    .string()
    .nullish()
    .transform((a) => (a === 'null' ? null : a)),
  proveedorNombre: z.string().nullish(),
  detalleGasto: z.string().nullish(),
  pagoTipo: z.enum(['Efectivo', 'Especie', 'Cheque']).nullish().catch(null),
  movilizacion: z.number().nullish(),
  combustible: z.number().nullish(),
  hospedaje: z.number().nullish(),
  activistas: z.number().nullish(),
  caravanaConcentraciones: z.number().nullish(),
  comidaBrindis: z.number().nullish(),
  alquilerLocalServiciosBasicos: z.number().nullish(),
  cargosBancarios: z.number().nullish(),
  totalGastosCampania: z.number().nullish(),
  personalizacionArticulosPromocionales: z.number().nullish(),
  propagandaElectoral: z.number().nullish(),
  totalGastosPropaganda: z.number().nullish(),
  totalDeGastosDePropagandaYCampania: z.number().nullish(),
  unreadableFields: z.array(z.string()).nullish(),
});

export const ResponseSchema = z.object({
  ingress: z.array(IngresoRowSchema),
  egress: z.array(EgresoRowSchema),
});

export type IngresoRow = z.infer<typeof IngresoRowSchema>;
export type EgresoRow = z.infer<typeof EgresoRowSchema>;
export type ExtractionResponse = z.infer<typeof ResponseSchema>;

const INGRESS_CSV_COLUMNS = [
  'fecha',
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
] as const;

const EGRESS_CSV_COLUMNS = [
  'fecha',
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
] as const;

const CSV_EXTRACTION_ENVELOPE_SCHEMA = z.object({
  ingressCsv: z.string(),
  egressCsv: z.string(),
});

const CSV_EXTRACTION_ENVELOPE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    ingressCsv: { type: 'string' },
    egressCsv: { type: 'string' },
  },
  required: ['ingressCsv', 'egressCsv'],
};

function getCsvExtractionPrompt(pageTypeHint?: PageTypeHint | null): string {
  const basePrompt = getExtractionPrompt(pageTypeHint);

  return (
    `${basePrompt}\n\n` +
    `Return ONLY JSON with this exact shape:\n` +
    `{"ingressCsv":"...","egressCsv":"..."}\n\n` +
    `CSV format rules (for both ingressCsv and egressCsv):\n` +
    `- RFC4180 CSV with a header row.\n` +
    `- Use comma delimiter.\n` +
    `- Quote EVERY field with double quotes.\n` +
    `- Empty cell must be an empty string ("").\n` +
    `- Numbers must be plain numeric strings (no currency symbols or thousands separators).\n` +
    `- unreadableFields must be a semicolon-separated list of field names (or empty string).\n` +
    `- Do not include markdown fences or any text outside the JSON object.\n\n` +
    `ingressCsv header (exact order): ${INGRESS_CSV_COLUMNS.join(',')}\n` +
    `egressCsv header (exact order): ${EGRESS_CSV_COLUMNS.join(',')}`
  );
}

function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };

  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      pushField();
      i++;
      continue;
    }
    if (ch === '\n') {
      pushField();
      pushRow();
      i++;
      continue;
    }
    if (ch === '\r') {
      i++;
      continue;
    }

    field += ch;
    i++;
  }

  pushField();
  if (row.length > 1 || row[0] !== '') {
    pushRow();
  }

  if (rows.length === 0) {
    return { header: [], rows: [] };
  }

  const [header, ...dataRows] = rows;
  return { header, rows: dataRows };
}

function normalizeHeaderName(name: string): string {
  return name
    .trim()
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, '');
}

function getCell(
  row: string[],
  indexByName: Map<string, number>,
  expectedHeader: string,
  fallbackIndex: number,
): string | null {
  const normalized = normalizeHeaderName(expectedHeader);
  const namedIndex = indexByName.get(normalized);
  const index = namedIndex ?? fallbackIndex;
  if (index < 0 || index >= row.length) return null;
  return row[index] ?? null;
}

function parseStringCell(value: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null') return null;
  return trimmed;
}

function parseNumberCell(value: string | null): number | null {
  const parsed = parseStringCell(value);
  if (parsed == null) return null;

  const normalized = parsed.replaceAll(',', '');
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseUnreadableFieldsCell(value: string | null): string[] | null {
  const parsed = parseStringCell(value);
  if (parsed == null) return null;

  const fields = parsed
    .split(';')
    .map((f) => f.trim())
    .filter(Boolean);

  return fields.length ? fields : null;
}

function parsePagoTipoCell(value: string | null): 'Efectivo' | 'Especie' | 'Cheque' | null {
  const parsed = parseStringCell(value);
  if (parsed == null) return null;
  if (parsed === 'Efectivo' || parsed === 'Especie' || parsed === 'Cheque') return parsed;
  return null;
}

function buildHeaderIndex(header: string[]): Map<string, number> {
  const index = new Map<string, number>();
  header.forEach((name, i) => {
    index.set(normalizeHeaderName(name), i);
  });
  return index;
}

function parseIngressCsv(ingressCsv: string): IngresoRow[] {
  const parsed = parseCsv(ingressCsv);
  if (parsed.rows.length === 0) return [];
  const headerIndex = buildHeaderIndex(parsed.header);

  const rows: IngresoRow[] = parsed.rows
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => ({
      fecha: parseStringCell(getCell(r, headerIndex, 'fecha', 0)),
      reciboNumero: parseStringCell(getCell(r, headerIndex, 'reciboNumero', 1)),
      contribuyenteNombre: parseStringCell(getCell(r, headerIndex, 'contribuyenteNombre', 2)),
      representanteLegal: parseStringCell(getCell(r, headerIndex, 'representanteLegal', 3)),
      cedulaRuc: parseStringCell(getCell(r, headerIndex, 'cedulaRuc', 4)),
      direccion: parseStringCell(getCell(r, headerIndex, 'direccion', 5)),
      telefono: parseStringCell(getCell(r, headerIndex, 'telefono', 6)),
      correoElectronico: parseStringCell(getCell(r, headerIndex, 'correoElectronico', 7)),
      donacionesPrivadasEfectivo: parseNumberCell(getCell(r, headerIndex, 'donacionesPrivadasEfectivo', 8)),
      donacionesPrivadasChequeAch: parseNumberCell(getCell(r, headerIndex, 'donacionesPrivadasChequeAch', 9)),
      donacionesPrivadasEspecie: parseNumberCell(getCell(r, headerIndex, 'donacionesPrivadasEspecie', 10)),
      recursosPropiosEfectivoCheque: parseNumberCell(getCell(r, headerIndex, 'recursosPropiosEfectivoCheque', 11)),
      recursosPropiosEspecie: parseNumberCell(getCell(r, headerIndex, 'recursosPropiosEspecie', 12)),
      total: parseNumberCell(getCell(r, headerIndex, 'total', 13)),
      unreadableFields: parseUnreadableFieldsCell(getCell(r, headerIndex, 'unreadableFields', 14)),
    }));

  return z.array(IngresoRowSchema).parse(rows);
}

function parseEgressCsv(egressCsv: string): EgresoRow[] {
  const parsed = parseCsv(egressCsv);
  if (parsed.rows.length === 0) return [];
  const headerIndex = buildHeaderIndex(parsed.header);

  const rows: EgresoRow[] = parsed.rows
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => ({
      fecha: parseStringCell(getCell(r, headerIndex, 'fecha', 0)),
      numeroFacturaRecibo: parseStringCell(getCell(r, headerIndex, 'numeroFacturaRecibo', 1)),
      cedulaRuc: parseStringCell(getCell(r, headerIndex, 'cedulaRuc', 2)),
      proveedorNombre: parseStringCell(getCell(r, headerIndex, 'proveedorNombre', 3)),
      detalleGasto: parseStringCell(getCell(r, headerIndex, 'detalleGasto', 4)),
      pagoTipo: parsePagoTipoCell(getCell(r, headerIndex, 'pagoTipo', 5)),
      movilizacion: parseNumberCell(getCell(r, headerIndex, 'movilizacion', 6)),
      combustible: parseNumberCell(getCell(r, headerIndex, 'combustible', 7)),
      hospedaje: parseNumberCell(getCell(r, headerIndex, 'hospedaje', 8)),
      activistas: parseNumberCell(getCell(r, headerIndex, 'activistas', 9)),
      caravanaConcentraciones: parseNumberCell(getCell(r, headerIndex, 'caravanaConcentraciones', 10)),
      comidaBrindis: parseNumberCell(getCell(r, headerIndex, 'comidaBrindis', 11)),
      alquilerLocalServiciosBasicos: parseNumberCell(getCell(r, headerIndex, 'alquilerLocalServiciosBasicos', 12)),
      cargosBancarios: parseNumberCell(getCell(r, headerIndex, 'cargosBancarios', 13)),
      totalGastosCampania: parseNumberCell(getCell(r, headerIndex, 'totalGastosCampania', 14)),
      personalizacionArticulosPromocionales: parseNumberCell(
        getCell(r, headerIndex, 'personalizacionArticulosPromocionales', 15),
      ),
      propagandaElectoral: parseNumberCell(getCell(r, headerIndex, 'propagandaElectoral', 16)),
      totalGastosPropaganda: parseNumberCell(getCell(r, headerIndex, 'totalGastosPropaganda', 17)),
      totalDeGastosDePropagandaYCampania: parseNumberCell(
        getCell(r, headerIndex, 'totalDeGastosDePropagandaYCampania', 18),
      ),
      unreadableFields: parseUnreadableFieldsCell(getCell(r, headerIndex, 'unreadableFields', 19)),
    }));

  return z.array(EgresoRowSchema).parse(rows);
}

export const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    ingress: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fecha: { type: ['string', 'null'] },
          reciboNumero: { type: ['string', 'null'] },
          contribuyenteNombre: { type: ['string', 'null'] },
          representanteLegal: { type: ['string', 'null'] },
          cedulaRuc: { type: ['string', 'null'] },
          direccion: { type: ['string', 'null'] },
          telefono: { type: ['string', 'null'] },
          correoElectronico: { type: ['string', 'null'] },
          donacionesPrivadasEfectivo: { type: ['number', 'null'] },
          donacionesPrivadasChequeAch: { type: ['number', 'null'] },
          donacionesPrivadasEspecie: { type: ['number', 'null'] },
          recursosPropiosEfectivoCheque: { type: ['number', 'null'] },
          recursosPropiosEspecie: { type: ['number', 'null'] },
          total: { type: ['number', 'null'] },
          unreadableFields: { type: 'array', items: { type: 'string' } },
        },
        required: [],
      },
    },
    egress: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fecha: { type: ['string', 'null'] },
          numeroFacturaRecibo: { type: ['string', 'null'] },
          cedulaRuc: { type: ['string', 'null'] },
          proveedorNombre: { type: ['string', 'null'] },
          detalleGasto: { type: ['string', 'null'] },
          pagoTipo: { type: ['string', 'null'], enum: ['Efectivo', 'Especie', 'Cheque', null] },
          movilizacion: { type: ['number', 'null'] },
          combustible: { type: ['number', 'null'] },
          hospedaje: { type: ['number', 'null'] },
          activistas: { type: ['number', 'null'] },
          caravanaConcentraciones: { type: ['number', 'null'] },
          comidaBrindis: { type: ['number', 'null'] },
          alquilerLocalServiciosBasicos: { type: ['number', 'null'] },
          cargosBancarios: { type: ['number', 'null'] },
          totalGastosCampania: { type: ['number', 'null'] },
          personalizacionArticulosPromocionales: { type: ['number', 'null'] },
          propagandaElectoral: { type: ['number', 'null'] },
          totalGastosPropaganda: { type: ['number', 'null'] },
          totalDeGastosDePropagandaYCampania: { type: ['number', 'null'] },
          unreadableFields: { type: 'array', items: { type: 'string' } },
        },
        required: [],
      },
    },
  },
  required: ['ingress', 'egress'],
};

export interface OpenRouterRawResponse {
  choices?: { message?: { content?: string } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export async function callOpenRouter(
  pdfBase64: string,
  apiKey: string,
  modelId: string = getModel().openrouterId,
  options?: { providerOrder?: string[]; mimeType?: string },
): Promise<{ raw: OpenRouterRawResponse; parsed: ExtractionResponse }> {
  const providerOrder = options?.providerOrder ?? ['google-ai-studio'];
  const mimeType = options?.mimeType ?? 'application/pdf';
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: EXTRACTION_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${pdfBase64}`,
              },
            },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'extraction_response',
          strict: true,
          schema: RESPONSE_JSON_SCHEMA,
        },
      },
      provider: {
        order: providerOrder,
        allow_fallbacks: true,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const result = (await response.json()) as OpenRouterRawResponse;

  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No content in OpenRouter response');
  }

  const parsed = JSON.parse(content);
  const validated = ResponseSchema.parse(parsed);

  return {
    raw: result,
    parsed: validated,
  };
}

export interface GeminiRawResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
    finishReason?: string;
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    cachedContentTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string; code?: number };
}

const GEMINI_3_FLASH_PRICING = {
  inputPerMillion: 0.5,
  outputPerMillion: 3.0,
  cachedInputPerMillion: 0.05,
};

export function logGeminiCost(usage: GeminiRawResponse['usageMetadata'], label?: string): void {
  if (!usage) {
    console.log('[Cost] No usage metadata available');
    return;
  }

  const promptTokens = usage.promptTokenCount ?? 0;
  const candidatesTokens = usage.candidatesTokenCount ?? 0;
  const thoughtsTokens = usage.thoughtsTokenCount ?? 0;
  const cachedTokens = usage.cachedContentTokenCount ?? 0;
  const totalTokens = usage.totalTokenCount ?? 0;

  const billableInputTokens = promptTokens - cachedTokens;
  const inputCost = (billableInputTokens / 1_000_000) * GEMINI_3_FLASH_PRICING.inputPerMillion;
  const cachedCost = (cachedTokens / 1_000_000) * GEMINI_3_FLASH_PRICING.cachedInputPerMillion;
  const outputCost = (candidatesTokens / 1_000_000) * GEMINI_3_FLASH_PRICING.outputPerMillion;
  const totalCost = inputCost + cachedCost + outputCost;

  const prefix = label ? `[Cost: ${label}]` : '[Cost]';
  console.log(`${prefix} Tokens: ${totalTokens.toLocaleString()} total`);
  console.log(`  Input: ${promptTokens.toLocaleString()} (${cachedTokens.toLocaleString()} cached)`);
  console.log(`  Output: ${candidatesTokens.toLocaleString()} (${thoughtsTokens.toLocaleString()} thinking)`);
  console.log(`  Estimated cost: $${totalCost.toFixed(6)}`);
  console.log(
    `    Input: $${inputCost.toFixed(6)} | Cached: $${cachedCost.toFixed(6)} | Output: $${outputCost.toFixed(6)}`,
  );
}

export type MediaResolution =
  | 'MEDIA_RESOLUTION_LOW'
  | 'MEDIA_RESOLUTION_MEDIUM'
  | 'MEDIA_RESOLUTION_HIGH'
  | 'MEDIA_RESOLUTION_ULTRA_HIGH';

export async function callGeminiDirect<T>(
  pdfBase64: string,
  apiKey: string,
  options: {
    prompt: string;
    schema: z.ZodType<T>;
    jsonSchema: Record<string, unknown>;
    modelId?: string;
    mimeType?: string;
    mediaResolution?: MediaResolution;
    timeoutMs?: number;
  },
): Promise<{ raw: GeminiRawResponse; parsed: T }> {
  const modelId = options.modelId ?? getModel().geminiId;
  const requestedMediaResolution: MediaResolution = options.mediaResolution ?? 'MEDIA_RESOLUTION_HIGH';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;

  async function attempt(mediaResolution: MediaResolution): Promise<{ raw: GeminiRawResponse; parsed: T }> {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: options.mimeType ?? 'application/pdf',
                    data: pdfBase64,
                  },
                },
                { text: options.prompt },
              ],
            },
          ],
          generationConfig: {
            // temperature: 1,
            thinkingConfig: {
              thinkingLevel: 'HIGH',
            },
            mediaResolution,
            response_mime_type: 'application/json',
            response_json_schema: options.jsonSchema,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
      }

      const result = (await response.json()) as GeminiRawResponse;

      if (result.error) {
        throw new Error(`Gemini API error: ${result.error.code} - ${result.error.message}`);
      }

      const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        throw new Error('No content in Gemini response');
      }

      const parsed = JSON.parse(content);
      const validated = options.schema.parse(parsed);

      logGeminiCost(result.usageMetadata, modelId);

      return {
        raw: result,
        parsed: validated,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  try {
    return await attempt(requestedMediaResolution);
  } catch (err) {
    // Some Gemini endpoints reject ULTRA_HIGH; retry once with HIGH (works for both PDFs and images).
    const msg = err instanceof Error ? err.message : String(err);
    if (
      requestedMediaResolution === 'MEDIA_RESOLUTION_ULTRA_HIGH' &&
      msg.includes('generation_config.media_resolution')
    ) {
      return await attempt('MEDIA_RESOLUTION_HIGH');
    }
    throw err;
  }
}

export async function callGeminiCsvExtraction(
  imageBase64: string,
  apiKey: string,
  options?: {
    modelId?: string;
    mimeType?: string;
    mediaResolution?: MediaResolution;
    timeoutMs?: number;
    pageTypeHint?: PageTypeHint | null;
  },
): Promise<{
  raw: GeminiRawResponse;
  parsed: ExtractionResponse;
  csv: { ingressCsv: string; egressCsv: string };
}> {
  const prompt = getCsvExtractionPrompt(options?.pageTypeHint);

  const { raw, parsed } = await callGeminiDirect(imageBase64, apiKey, {
    prompt,
    schema: CSV_EXTRACTION_ENVELOPE_SCHEMA,
    jsonSchema: CSV_EXTRACTION_ENVELOPE_JSON_SCHEMA,
    modelId: options?.modelId,
    mimeType: options?.mimeType ?? 'image/png',
    mediaResolution: options?.mediaResolution,
    timeoutMs: options?.timeoutMs,
  });

  const extraction = ResponseSchema.parse({
    ingress: parseIngressCsv(parsed.ingressCsv),
    egress: parseEgressCsv(parsed.egressCsv),
  });

  return {
    raw,
    parsed: extraction,
    csv: parsed,
  };
}

export async function splitPdfIntoPages(
  pdfBytes: ArrayBuffer,
): Promise<{ pageBytes: Uint8Array; pageNumber: number }[]> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();

  const pages: { pageBytes: Uint8Array; pageNumber: number }[] = [];

  for (let i = 0; i < totalPages; i++) {
    const singlePageDoc = await PDFDocument.create();
    const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
    singlePageDoc.addPage(copiedPage);
    const pageBytes = await singlePageDoc.save();

    pages.push({
      pageBytes,
      pageNumber: i + 1,
    });
  }

  return pages;
}

export async function extractSinglePage(pdfBytes: ArrayBuffer, pageNumber: number): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const singlePageDoc = await PDFDocument.create();
  const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [pageNumber - 1]);
  singlePageDoc.addPage(copiedPage);
  return singlePageDoc.save();
}

export function renderPageAsPng(
  pdfBytes: ArrayBuffer | Uint8Array,
  pageNumber: number,
  options?: { rotation?: number; scale?: number },
): Uint8Array {
  const rotation = options?.rotation ?? 0;
  const scale = options?.scale ?? 4;

  const doc = mupdf.Document.openDocument(
    pdfBytes instanceof ArrayBuffer ? new Uint8Array(pdfBytes) : pdfBytes,
    'application/pdf',
  );
  const page = doc.loadPage(pageNumber - 1);

  let matrix = mupdf.Matrix.scale(scale, scale);
  if (rotation !== 0) {
    const bounds = page.getBounds();
    const w = bounds[2] - bounds[0];
    const h = bounds[3] - bounds[1];

    const rotMatrix = mupdf.Matrix.rotate(rotation);

    let tx = 0;
    let ty = 0;
    const r = ((rotation % 360) + 360) % 360;
    if (r === 90) {
      tx = h;
      ty = 0;
    } else if (r === 180) {
      tx = w;
      ty = h;
    } else if (r === 270) {
      tx = 0;
      ty = w;
    }

    const translateMatrix = mupdf.Matrix.translate(tx, ty);
    const rotateAndTranslate = mupdf.Matrix.concat(rotMatrix, translateMatrix);
    matrix = mupdf.Matrix.concat(rotateAndTranslate, mupdf.Matrix.scale(scale, scale));
  }

  const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true);
  return pixmap.asPNG();
}
