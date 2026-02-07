'use node';

import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import pLimit from 'p-limit';
import {
  getModel,
  splitPdfIntoPages,
  extractSinglePage,
  EXTRACTION_PROMPT,
  ResponseSchema,
  RESPONSE_JSON_SCHEMA,
  type ModelKey,
  type IngresoRow,
  type EgresoRow,
  callGeminiDirect,
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
    proRuns: v.optional(v.number()),
    flashRuns: v.optional(v.number()),
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

      // Clear any previous proposals for this page so the UI doesn't show stale results while generating new ones.
      await ctx.runMutation(internal.extractionHelpers.clearPageExtractionProposals, {
        documentId: args.documentId,
        pageNumber: args.pageNumber,
      });

      const clampRuns = (n: number | undefined, fallback: number) => {
        if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
        return Math.max(0, Math.min(10, Math.trunc(n)));
      };

      // Defaults preserve the old behavior (Flash x2, Pro x2) unless the caller specifies otherwise.
      const flashRuns = clampRuns(args.flashRuns, 2);
      const proRuns = clampRuns(args.proRuns, 2);

      if (flashRuns + proRuns <= 0) {
        throw new Error('No model runs requested (flashRuns + proRuns must be > 0)');
      }

      const proposalRuns: { modelKey: ModelKey; run: number }[] = [];
      for (let run = 1; run <= flashRuns; run++) proposalRuns.push({ modelKey: 'gemini-3-flash', run });
      for (let run = 1; run <= proRuns; run++) proposalRuns.push({ modelKey: 'gemini-3-pro', run });

      console.log(`[reExtractPage] Generating proposals for page ${args.pageNumber}...`);

      const proposals = await Promise.all(
        proposalRuns.map(async ({ modelKey, run }) => {
          const model = getModel(modelKey);
          const key = `${model.id}:${run}`;

          try {
            console.log(`[${key}] Re-extracting page ${args.pageNumber}...`);

            const { parsed: result } = await callGeminiDirect(pdfBase64, process.env.GEMINI_API_KEY!, {
              prompt: EXTRACTION_PROMPT,
              schema: ResponseSchema,
              jsonSchema: RESPONSE_JSON_SCHEMA,
              modelId: model.geminiId,
              mediaResolution: 'MEDIA_RESOLUTION_HIGH',
            });

            console.log(
              `[${key}] Page ${args.pageNumber}: ${result.ingress.length} ingress, ${result.egress.length} egress`,
            );

            return {
              key,
              model: model.id,
              run,
              ingress: result.ingress.map((row) => ({ ...row, pageNumber: args.pageNumber })),
              egress: result.egress.map((row) => ({ ...row, pageNumber: args.pageNumber })),
              completedAt: Date.now(),
            };
          } catch (error) {
            console.error(`[${key}] Proposal generation failed for page ${args.pageNumber}:`, error);
            return {
              key,
              model: model.id,
              run,
              ingress: [],
              egress: [],
              completedAt: Date.now(),
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        }),
      );

      // Store proposals for this page (even if some failed).
      await ctx.runMutation(internal.extractionHelpers.upsertPageExtractionProposals, {
        documentId: args.documentId,
        pageNumber: args.pageNumber,
        proposals,
      });
    } catch (error) {
      console.error(`[reExtractPage] Re-extraction failed for page ${args.pageNumber}:`, error);

      // Set status to failed
      await ctx.runMutation(internal.extractionHelpers.setPageReExtractionStatus, {
        documentId: args.documentId,
        pageNumber: args.pageNumber,
        status: 'failed',
      });
    }

    // Only keep a failure status if *all* proposal runs failed. Otherwise clear to indicate completion.
    try {
      const existing = await ctx.runQuery(internal.pageExtractionProposals.getForPageInternal, {
        documentId: args.documentId,
        pageNumber: args.pageNumber,
      });

      const proposals = (existing?.proposals ?? []) as any[];
      const allFailed =
        proposals.length === 0 ||
        proposals.every((p) => typeof p?.errorMessage === 'string' && p.errorMessage.length > 0);

      if (allFailed) {
        await ctx.runMutation(internal.extractionHelpers.setPageReExtractionStatus, {
          documentId: args.documentId,
          pageNumber: args.pageNumber,
          status: 'failed',
        });
      } else {
        await ctx.runMutation(internal.extractionHelpers.clearPageReExtractionStatus, {
          documentId: args.documentId,
          pageNumber: args.pageNumber,
        });
      }
    } catch (error) {
      console.error(`[reExtractPage] Failed to finalize status for page ${args.pageNumber}:`, error);
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
    const modelKey = (await ctx.runQuery(internal.featureFlags.getExtractionModelInternal)) as ModelKey;
    const model = getModel(modelKey);

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

      console.log(`Processing with ${model.id}...`);

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
                modelId: model.geminiId,
                mediaResolution: 'MEDIA_RESOLUTION_HIGH',
              });

              console.log(
                `[${model.id}] Page ${page.pageNumber}: ${result.ingress.length} ingress, ${result.egress.length} egress`,
              );

              return {
                pageNumber: page.pageNumber,
                ingress: result.ingress,
                egress: result.egress,
              };
            } catch (error) {
              console.error(`[${model.id}] Error processing page ${page.pageNumber}:`, error);
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
        model: model.id,
        ingress: allIngress,
        egress: allEgress,
      });

      console.log(`[${model.id}] Completed: ${allIngress.length} ingress, ${allEgress.length} egress total`);

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
