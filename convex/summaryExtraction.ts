'use node';

import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { PDFDocument } from 'pdf-lib';
import { z } from 'zod';
import { MODEL, callGeminiDirect } from './lib/pdf-extraction';

const SUMMARY_EXTRACTION_PROMPT = `This PDF contains the first pages of a financial report from Panama's Electoral Tribunal. One of these pages should be a "Resumen de Ingresos y Gastos" (Income and Expense Summary).

Find and extract the summary totals from this form. The form typically contains:

INGRESOS (Income):
- Saldo provenientes de las elecciones primarias/recolección de firmas
- Donaciones recibidas en efectivo, cheques y ACH
- Donaciones en especie
- Aporte de la nómina / recursos propios
- TOTAL DE INGRESOS

MENOS GASTOS (Expenses):
- Gastos / Compras efectuadas
- Gastos de donación en especie
- Cargos bancarios (if present)
- TOTAL DEL GASTOS
- TOTAL RESULTADO (DE RESTAR LOS INGRESOS DE GASTOS)

Also extract metadata:
- Form type (e.g., "Pre-15", "Pre-15-A", "Pre-16", "Pre-5")
- Candidate name and cédula
- Contador Público Autorizado name, cédula, CPA number, phone
- Tesorero name (if present)

Return null for fields that are empty or not visible. For numeric values, parse them as numbers (remove currency symbols, commas for thousands).
If any fields are illegible, list them in unreadableFields.
Also return the page number (1-indexed) where you found the summary in the "pageNumber" field.`;

const SummarySchema = z.object({
  saldoPrimariasRecoleccionFirmas: z.number().nullish(),
  donacionesRecibidasEfectivoChequeAch: z.number().nullish(),
  donacionesEnEspecie: z.number().nullish(),
  aporteRecursosPropios: z.number().nullish(),
  totalIngresos: z.number().nullish(),

  gastosComprasEfectuadas: z.number().nullish(),
  gastosDonatcionEnEspecie: z.number().nullish(),
  cargosBancarios: z.number().nullish(),
  totalGastos: z.number().nullish(),
  totalResultado: z.number().nullish(),

  formType: z.string().nullish(),
  candidatoNombre: z.string().nullish(),
  candidatoCedula: z.string().nullish(),
  candidatoFecha: z.string().nullish(),
  contadorNombre: z.string().nullish(),
  contadorCedula: z.string().nullish(),
  contadorCpaNo: z.string().nullish(),
  contadorFecha: z.string().nullish(),
  contadorCelular: z.string().nullish(),
  tesoreroNombre: z.string().nullish(),
  tesoreroCedula: z.string().nullish(),
  tesoreroFecha: z.string().nullish(),

  unreadableFields: z.array(z.string()).nullish(),
  pageNumber: z.number().nullish(),
});

type SummaryData = z.infer<typeof SummarySchema>;

const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    saldoPrimariasRecoleccionFirmas: { type: ['number', 'null'] },
    donacionesRecibidasEfectivoChequeAch: { type: ['number', 'null'] },
    donacionesEnEspecie: { type: ['number', 'null'] },
    aporteRecursosPropios: { type: ['number', 'null'] },
    totalIngresos: { type: ['number', 'null'] },

    gastosComprasEfectuadas: { type: ['number', 'null'] },
    gastosDonatcionEnEspecie: { type: ['number', 'null'] },
    cargosBancarios: { type: ['number', 'null'] },
    totalGastos: { type: ['number', 'null'] },
    totalResultado: { type: ['number', 'null'] },

    formType: { type: ['string', 'null'] },
    candidatoNombre: { type: ['string', 'null'] },
    candidatoCedula: { type: ['string', 'null'] },
    candidatoFecha: { type: ['string', 'null'] },
    contadorNombre: { type: ['string', 'null'] },
    contadorCedula: { type: ['string', 'null'] },
    contadorCpaNo: { type: ['string', 'null'] },
    contadorFecha: { type: ['string', 'null'] },
    contadorCelular: { type: ['string', 'null'] },
    tesoreroNombre: { type: ['string', 'null'] },
    tesoreroCedula: { type: ['string', 'null'] },
    tesoreroFecha: { type: ['string', 'null'] },

    unreadableFields: { type: 'array', items: { type: 'string' } },
    pageNumber: { type: ['number', 'null'] },
  },
  required: [],
};

function isValidSummary(summary: SummaryData | null): summary is SummaryData {
  if (!summary) return false;
  return (
    summary.totalIngresos != null ||
    summary.totalGastos != null ||
    summary.totalResultado != null ||
    summary.formType != null
  );
}

async function extractFirstPages(
  pdfBytes: ArrayBuffer,
  maxPages: number,
): Promise<{ pdfBytes: Uint8Array; pageCount: number }> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();
  const pagesToExtract = Math.min(maxPages, totalPages);

  const newDoc = await PDFDocument.create();
  const pageIndices = Array.from({ length: pagesToExtract }, (_, i) => i);
  const copiedPages = await newDoc.copyPages(pdfDoc, pageIndices);

  for (const page of copiedPages) {
    newDoc.addPage(page);
  }

  return {
    pdfBytes: await newDoc.save(),
    pageCount: pagesToExtract,
  };
}

export const startSummaryExtraction = internalAction({
  args: {
    documentId: v.id('documents'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      await ctx.runMutation(internal.extractionHelpers.updateSummaryStatus, {
        documentId: args.documentId,
        summaryStatus: 'processing',
      });

      const doc = await ctx.runQuery(internal.extractionHelpers.getDocumentInternal, {
        documentId: args.documentId,
      });

      if (!doc) {
        throw new Error('Document not found');
      }

      const pdfUrl = await ctx.storage.getUrl(doc.fileId);
      if (!pdfUrl) {
        throw new Error('Could not get PDF URL');
      }

      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        throw new Error('Failed to fetch PDF');
      }

      const pdfBytes = await pdfResponse.arrayBuffer();
      const { pdfBytes: firstPagesPdf, pageCount } = await extractFirstPages(pdfBytes, 8);
      console.log(`Extracted first ${pageCount} pages for summary extraction`);

      const pdfBase64 = Buffer.from(firstPagesPdf).toString('base64');

      console.log(`[Summary] Processing with ${MODEL.id}...`);

      try {
        const { parsed: summary } = await callGeminiDirect(pdfBase64, process.env.GEMINI_API_KEY!, {
          prompt: SUMMARY_EXTRACTION_PROMPT,
          schema: SummarySchema,
          jsonSchema: RESPONSE_JSON_SCHEMA,
          mediaResolution: 'MEDIA_RESOLUTION_HIGH',
        });

        if (isValidSummary(summary)) {
          const pageNumber = summary.pageNumber ?? 1;
          console.log(`[${MODEL.id}] Found valid summary on page ${pageNumber}`);

          await ctx.runMutation(internal.extractionHelpers.storeSummaryExtraction, {
            documentId: args.documentId,
            model: MODEL.id,
            summary: summary as Record<string, unknown>,
            pageNumber,
          });
        } else {
          console.log(`[${MODEL.id}] No valid summary found in first ${pageCount} pages`);
        }
      } catch (error) {
        console.error(`[${MODEL.id}] Error processing summary:`, error);
      }

      await ctx.runMutation(internal.extractionHelpers.updateSummaryStatus, {
        documentId: args.documentId,
        summaryStatus: 'completed',
      });
    } catch (error) {
      console.error('Summary extraction failed:', error);

      await ctx.runMutation(internal.extractionHelpers.updateSummaryStatus, {
        documentId: args.documentId,
        summaryStatus: 'failed',
        summaryErrorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return null;
  },
});
