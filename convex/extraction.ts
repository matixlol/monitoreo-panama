'use node';

import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { PDFDocument } from 'pdf-lib';
import { z } from 'zod';
import pLimit from 'p-limit';

// Concurrency limit for parallel page processing
const PAGE_CONCURRENCY = 50;

// Model to use for extraction
const MODEL = { id: 'gemini-3-flash', openrouterId: 'google/gemini-3-flash-preview' } as const;

// Extraction prompt (same as process-pdf.ts)
const EXTRACTION_PROMPT = `This PDF segment contains financial reports from Panama's Electoral Tribunal (Tribunal Electoral).

Extract rows from "INFORME DE INGRESOS" and "INFORME DE GASTOS" tables. Don't extract the table if it doesn't look like the one described below. If a cell is empty, just return a literal \`null\`.

"INFORME DE INGRESOS" (Formulario Pre-17/Pre-7) columns:
1. Fecha, 2. Recibo No., 3. Nombre del Contribuyente, 4. Representante Legal, 5. Cédula/RUC, 6. Dirección, 7. Teléfono, 8. Correo Electrónico, 9. Donaciones Privadas - Efectivo, 10. Donaciones Privadas - Cheque/ACH, 11. Donaciones Privadas - Especie, 12. Recursos Propios - Efectivo/Cheque, 13. Recursos Propios - Especie, 14. TOTAL

"INFORME DE GASTOS" (Formulario Pre-18/Pre-8) columns:
1. Fecha, 2. No. de Factura/Recibo, 3. Cédula/RUC, 4. Nombre del Proveedor, 5. Detalle del Gasto, 6. Pago en Efectivo, Especie o Cheque, 7. Movilización, 8. Combustible, 9. Hospedaje, 10. Activistas, 11. Caravana y concentraciones, 12. Comida y Brindis, 13. Alquiler de Local / servicios básicos, 14. Cargos Bancarios, 15. Total de Gastos de Campaña (totalGastosCampania), 16. Personalización de artículos promocionales, 17. Propaganda Electoral, 18. Total de Gastos de Propaganda (totalGastosPropaganda), 19. Total de Gastos de Propaganda y Campaña (totalDeGastosDePropagandaYCampania)

Do not confuse Total de Gastos de Campaña (totalGastosCampania) with Total de Gastos de Propaganda y Campaña (totalDeGastosDePropagandaYCampania). Read each cell as-is, don't try to guess the value if it's not clear.

For each row, if any fields are illegible, unreadable, or unclear in the source document (e.g., due to poor scan quality, handwriting that can't be deciphered, or obscured text), list the field names in the "unreadableFields" array. Only include fields that you genuinely cannot read - do not include fields that are simply empty.`;

// Zod schemas for validation
const IngresoRowSchema = z.object({
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
  // Fields that the AI model couldn't read (illegible, unclear, etc.)
  unreadableFields: z.array(z.string()).nullish(),
});

const EgresoRowSchema = z.object({
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
  // Fields that the AI model couldn't read (illegible, unclear, etc.)
  unreadableFields: z.array(z.string()).nullish(),
});

const ResponseSchema = z.object({
  ingress: z.array(IngresoRowSchema),
  egress: z.array(EgresoRowSchema),
});

type IngressRow = z.infer<typeof IngresoRowSchema> & { pageNumber: number };
type EgressRow = z.infer<typeof EgresoRowSchema> & { pageNumber: number };

// JSON Schema for the response (matching ResponseSchema)
const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    ingress: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fecha: { type: ['string', 'null'] },
          reciboNumero: { type: 'string' },
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
          numeroFacturaRecibo: { type: 'string' },
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

/**
 * Call OpenRouter API to extract data from a PDF page
 */
async function callOpenRouter(
  pdfBase64: string,
  modelId: string,
): Promise<{ ingress: IngressRow[]; egress: EgressRow[] }> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
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
      // Provider-specific options for Gemini
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

  const result = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No content in OpenRouter response');
  }

  const parsed = JSON.parse(content);
  const validated = ResponseSchema.parse(parsed);

  return {
    ingress: validated.ingress as IngressRow[],
    egress: validated.egress as EgressRow[],
  };
}

/**
 * Split a PDF into individual pages
 */
async function splitPdfIntoPages(pdfBytes: ArrayBuffer): Promise<{ pageBytes: Uint8Array; pageNumber: number }[]> {
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
      pageNumber: i + 1, // 1-indexed page numbers
    });
  }

  return pages;
}

/**
 * Re-extract a single page from a document
 */
export const reExtractPage = internalAction({
  args: {
    documentId: v.id('documents'),
    pageNumber: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get document info
    const doc = await ctx.runQuery(internal.extractionHelpers.getDocumentInternal, {
      documentId: args.documentId,
    });

    if (!doc) {
      throw new Error('Document not found');
    }

    // Fetch PDF from storage
    const pdfUrl = await ctx.storage.getUrl(doc.fileId);
    if (!pdfUrl) {
      throw new Error('Could not get PDF URL');
    }

    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error('Failed to fetch PDF');
    }

    const pdfBytes = await pdfResponse.arrayBuffer();

    // Extract just the single page
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const singlePageDoc = await PDFDocument.create();
    const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [args.pageNumber - 1]); // 0-indexed
    singlePageDoc.addPage(copiedPage);
    const pageBytes = await singlePageDoc.save();
    const pdfBase64 = Buffer.from(pageBytes).toString('base64');

    console.log(`[${MODEL.id}] Re-extracting page ${args.pageNumber}...`);

    const result = await callOpenRouter(pdfBase64, MODEL.openrouterId);

    console.log(
      `[${MODEL.id}] Page ${args.pageNumber} re-extracted: ${result.ingress.length} ingress, ${result.egress.length} egress`,
    );

    // Add page numbers to rows
    const ingressWithPage = result.ingress.map((row) => ({ ...row, pageNumber: args.pageNumber }));
    const egressWithPage = result.egress.map((row) => ({ ...row, pageNumber: args.pageNumber }));

    // Update extraction data for this page
    await ctx.runMutation(internal.extractionHelpers.updateExtractionForPage, {
      documentId: args.documentId,
      pageNumber: args.pageNumber,
      ingress: ingressWithPage,
      egress: egressWithPage,
    });

    return null;
  },
});

/**
 * Main extraction workflow
 */
export const startExtraction = internalAction({
  args: {
    documentId: v.id('documents'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      // Update status to processing
      await ctx.runMutation(internal.extractionHelpers.updateDocumentStatus, {
        documentId: args.documentId,
        status: 'processing',
      });

      // Get document info
      const doc = await ctx.runQuery(internal.extractionHelpers.getDocumentInternal, {
        documentId: args.documentId,
      });

      if (!doc) {
        throw new Error('Document not found');
      }

      // Fetch PDF from storage
      const pdfUrl = await ctx.storage.getUrl(doc.fileId);
      if (!pdfUrl) {
        throw new Error('Could not get PDF URL');
      }

      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        throw new Error('Failed to fetch PDF');
      }

      const pdfBytes = await pdfResponse.arrayBuffer();

      // Split PDF into individual pages
      const pages = await splitPdfIntoPages(pdfBytes);
      console.log(`Split PDF into ${pages.length} pages`);

      console.log(`Processing with ${MODEL.id}...`);

      const allIngress: IngressRow[] = [];
      const allEgress: EgressRow[] = [];

      // Process pages concurrently with limit
      const limit = pLimit(PAGE_CONCURRENCY);

      const pageResults = await Promise.all(
        pages.map((page) =>
          limit(async () => {
            const pdfBase64 = Buffer.from(page.pageBytes).toString('base64');

            try {
              const result = await callOpenRouter(pdfBase64, MODEL.openrouterId);

              console.log(
                `[${MODEL.id}] Page ${page.pageNumber}: ${result.ingress.length} ingress, ${result.egress.length} egress`,
              );

              return {
                pageNumber: page.pageNumber,
                ingress: result.ingress,
                egress: result.egress,
              };
            } catch (error) {
              console.error(`[${MODEL.id}] Error processing page ${page.pageNumber}:`, error);
              // Return empty results for failed pages
              return { pageNumber: page.pageNumber, ingress: [], egress: [] };
            }
          }),
        ),
      );

      // Aggregate results from all pages
      for (const result of pageResults) {
        for (const row of result.ingress) {
          allIngress.push({ ...row, pageNumber: result.pageNumber });
        }
        for (const row of result.egress) {
          allEgress.push({ ...row, pageNumber: result.pageNumber });
        }
      }

      // Store extraction results
      await ctx.runMutation(internal.extractionHelpers.storeExtraction, {
        documentId: args.documentId,
        model: MODEL.id,
        ingress: allIngress,
        egress: allEgress,
      });

      console.log(`[${MODEL.id}] Completed: ${allIngress.length} ingress, ${allEgress.length} egress total`);

      // Update status to completed
      await ctx.runMutation(internal.extractionHelpers.updateDocumentStatus, {
        documentId: args.documentId,
        status: 'completed',
      });

      // Also trigger summary extraction as a separate process
      await ctx.scheduler.runAfter(0, internal.summaryExtraction.startSummaryExtraction, {
        documentId: args.documentId,
      });
    } catch (error) {
      console.error('Extraction failed:', error);

      // Update status to failed
      await ctx.runMutation(internal.extractionHelpers.updateDocumentStatus, {
        documentId: args.documentId,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return null;
  },
});
