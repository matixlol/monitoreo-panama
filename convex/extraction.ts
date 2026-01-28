'use node';

import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import pLimit from 'p-limit';
import {
  MODEL,
  callGeminiDirect,
  splitPdfIntoPages,
  extractSinglePage,
  EXTRACTION_PROMPT,
  ResponseSchema,
  RESPONSE_JSON_SCHEMA,
  type IngresoRow,
  type EgresoRow,
} from '../pdf-extraction';

const PAGE_CONCURRENCY = 50;

type IngressRow = IngresoRow & { pageNumber: number };
type EgressRow = EgresoRow & { pageNumber: number };

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
    try {
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
      const pageBytes = await extractSinglePage(pdfBytes, args.pageNumber);
      const pdfBase64 = Buffer.from(pageBytes).toString('base64');

      // Set status to processing
      await ctx.runMutation(internal.extractionHelpers.setPageReExtractionStatus, {
        documentId: args.documentId,
        pageNumber: args.pageNumber,
        status: 'processing',
      });

      console.log(`[${MODEL.id}] Re-extracting page ${args.pageNumber}...`);

      const { parsed: result } = await callGeminiDirect(pdfBase64, process.env.GEMINI_API_KEY!, {
        prompt: EXTRACTION_PROMPT,
        schema: ResponseSchema,
        jsonSchema: RESPONSE_JSON_SCHEMA,
        mediaResolution: 'MEDIA_RESOLUTION_HIGH',
      });

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

      // Also update validated data if it exists (so UI shows new rows immediately)
      await ctx.runMutation(internal.extractionHelpers.updateValidatedDataForPage, {
        documentId: args.documentId,
        pageNumber: args.pageNumber,
        ingress: ingressWithPage,
        egress: egressWithPage,
      });

      // Clear the re-extraction status
      await ctx.runMutation(internal.extractionHelpers.clearPageReExtractionStatus, {
        documentId: args.documentId,
        pageNumber: args.pageNumber,
      });
    } catch (error) {
      console.error(`[${MODEL.id}] Re-extraction failed for page ${args.pageNumber}:`, error);

      // Set status to failed
      await ctx.runMutation(internal.extractionHelpers.setPageReExtractionStatus, {
        documentId: args.documentId,
        pageNumber: args.pageNumber,
        status: 'failed',
      });
    }

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
              const { parsed: result } = await callGeminiDirect(pdfBase64, process.env.GEMINI_API_KEY!, {
                prompt: EXTRACTION_PROMPT,
                schema: ResponseSchema,
                jsonSchema: RESPONSE_JSON_SCHEMA,
                mediaResolution: 'MEDIA_RESOLUTION_HIGH',
              });

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
