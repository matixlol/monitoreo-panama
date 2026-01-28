import { PDFDocument } from 'pdf-lib';
import { z } from 'zod';

export const MODEL = {
  id: 'gemini-3-flash',
  openrouterId: 'google/gemini-3-flash-preview',
  geminiId: 'gemini-3-flash-preview',
} as const;

export const EXTRACTION_PROMPT = `This PDF segment contains financial reports from Panama's Electoral Tribunal (Tribunal Electoral).

Extract rows from "INFORME DE INGRESOS" and "INFORME DE GASTOS" tables. Don't extract the table if it doesn't look like the one described below. If a cell is empty, just return a literal \`null\`.

"INFORME DE INGRESOS" (Formulario Pre-17/Pre-7) columns:
1. Fecha, 2. Recibo No., 3. Nombre del Contribuyente, 4. Representante Legal, 5. Cédula/RUC, 6. Dirección, 7. Teléfono, 8. Correo Electrónico, 9. Donaciones Privadas - Efectivo, 10. Donaciones Privadas - Cheque/ACH, 11. Donaciones Privadas - Especie, 12. Recursos Propios - Efectivo/Cheque, 13. Recursos Propios - Especie, 14. TOTAL

"INFORME DE GASTOS" (Formulario Pre-18/Pre-8) columns:
1. Fecha, 2. No. de Factura/Recibo, 3. Cédula/RUC, 4. Nombre del Proveedor, 5. Detalle del Gasto, 6. Pago en Efectivo, Especie o Cheque, 7. Movilización, 8. Combustible, 9. Hospedaje, 10. Activistas, 11. Caravana y concentraciones, 12. Comida y Brindis, 13. Alquiler de Local / servicios básicos, 14. Cargos Bancarios, 15. Total de Gastos de Campaña (totalGastosCampania), 16. Personalización de artículos promocionales, 17. Propaganda Electoral, 18. Total de Gastos de Propaganda (totalGastosPropaganda), 19. Total de Gastos de Propaganda y Campaña (totalDeGastosDePropagandaYCampania)

Do not confuse Total de Gastos de Campaña (totalGastosCampania) with Total de Gastos de Propaganda y Campaña (totalDeGastosDePropagandaYCampania). Read each cell as-is, don't try to guess the value if it's not clear.

If it's available, always include "totalDeGastosDePropagandaYCampania".

For each row, if any fields are illegible, unreadable, or unclear in the source document (e.g., due to poor scan quality, handwriting that can't be deciphered, or obscured text), list the field names in the "unreadableFields" array. Only include fields that you genuinely cannot read - do not include fields that are simply empty.`;

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
  modelId: string = MODEL.openrouterId,
): Promise<{ raw: OpenRouterRawResponse; parsed: ExtractionResponse }> {
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
                url: `data:application/pdf;base64,${pdfBase64}`,
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
        order: ['google-ai-studio'],
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
    totalTokenCount?: number;
  };
  error?: { message?: string; code?: number };
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
    mediaResolution?: MediaResolution;
  },
): Promise<{ raw: GeminiRawResponse; parsed: T }> {
  const modelId = options.modelId ?? MODEL.geminiId;
  const mediaResolution = options.mediaResolution ?? 'MEDIA_RESOLUTION_MEDIUM';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: options.prompt },
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: pdfBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
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

  return {
    raw: result,
    parsed: validated,
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
