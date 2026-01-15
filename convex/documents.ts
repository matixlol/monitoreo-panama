import { v } from 'convex/values';
import { internal } from './_generated/api';
import { authMutation, authQuery } from './lib/withAuth';

export const getDocumentStats = authQuery({
  args: {},
  returns: v.object({
    pending: v.number(),
    processing: v.number(),
    completed: v.number(),
    failed: v.number(),
    summaryPending: v.number(),
    summaryProcessing: v.number(),
    summaryCompleted: v.number(),
    summaryFailed: v.number(),
  }),
  handler: async (ctx) => {
    const documents = await ctx.db.query('documents').collect();
    return {
      pending: documents.filter((d) => d.status === 'pending').length,
      processing: documents.filter((d) => d.status === 'processing').length,
      completed: documents.filter((d) => d.status === 'completed').length,
      failed: documents.filter((d) => d.status === 'failed').length,
      summaryPending: documents.filter((d) => d.summaryStatus === 'pending').length,
      summaryProcessing: documents.filter((d) => d.summaryStatus === 'processing').length,
      summaryCompleted: documents.filter((d) => d.summaryStatus === 'completed').length,
      summaryFailed: documents.filter((d) => d.summaryStatus === 'failed').length,
    };
  },
});

/**
 * Generate an upload URL for a PDF file
 */
export const generateUploadUrl = authMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Create a new document record after uploading a PDF
 */
export const createDocument = authMutation({
  args: {
    fileId: v.id('_storage'),
    name: v.string(),
    pageCount: v.number(),
  },
  returns: v.id('documents'),
  handler: async (ctx, args) => {
    const documentId = await ctx.db.insert('documents', {
      fileId: args.fileId,
      name: args.name,
      pageCount: args.pageCount,
      status: 'pending',
    });

    // Trigger the extraction workflow
    await ctx.scheduler.runAfter(0, internal.extraction.startExtraction, {
      documentId,
    });

    return documentId;
  },
});

export const retryAllExtractions = authMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Delete existing extractions for this document
    const existingExtractions = await ctx.db.query('extractions').collect();

    for (const extraction of existingExtractions) {
      await ctx.db.delete(extraction._id);
    }

    // Reset status and clear any previous error
    const documents = await ctx.db.query('documents').collect();

    for (const document of documents) {
      await ctx.db.patch(document._id, {
        status: 'pending',
        errorMessage: undefined,
      });
      await ctx.scheduler.runAfter(0, internal.extraction.startExtraction, {
        documentId: document._id,
      });
    }
    return null;
  },
});

/**
 * Manually trigger re-extraction for a document
 */
export const retryExtraction = authMutation({
  args: {
    documentId: v.id('documents'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) {
      throw new Error('Document not found');
    }

    // Delete existing extractions for this document
    const existingExtractions = await ctx.db
      .query('extractions')
      .withIndex('by_document', (q) => q.eq('documentId', args.documentId))
      .collect();

    for (const extraction of existingExtractions) {
      await ctx.db.delete(extraction._id);
    }

    // Reset status and clear any previous error
    await ctx.db.patch(args.documentId, {
      status: 'pending',
      errorMessage: undefined,
    });

    // Trigger the extraction workflow
    await ctx.scheduler.runAfter(0, internal.extraction.startExtraction, {
      documentId: args.documentId,
    });

    return null;
  },
});

/**
 * List all documents
 */
export const listDocuments = authQuery({
  args: {},
  handler: async (ctx) => {
    const documents = await ctx.db.query('documents').order('desc').collect();

    return await Promise.all(
      documents.map(async (doc) => {
        // First check if there's validated data
        const validatedData = await ctx.db
          .query('validatedData')
          .withIndex('by_document', (q) => q.eq('documentId', doc._id))
          .unique();

        // Get summary extraction for total amounts
        const summaryExtraction = await ctx.db
          .query('summaryExtractions')
          .withIndex('by_document', (q) => q.eq('documentId', doc._id))
          .first();

        const summaryTotals = summaryExtraction
          ? {
              totalIngresos: summaryExtraction.summary.totalIngresos ?? null,
              totalGastos: summaryExtraction.summary.totalGastos ?? null,
            }
          : { totalIngresos: null, totalGastos: null };

        if (validatedData) {
          return {
            ...doc,
            ingressCount: validatedData.ingress.length,
            egressCount: validatedData.egress.length,
            ...summaryTotals,
          };
        }

        // Otherwise, get the latest extraction
        const extractions = await ctx.db
          .query('extractions')
          .withIndex('by_document', (q) => q.eq('documentId', doc._id))
          .order('desc')
          .first();

        if (extractions) {
          return {
            ...doc,
            ingressCount: extractions.ingress.length,
            egressCount: extractions.egress.length,
            ...summaryTotals,
          };
        }

        // No extractions yet
        return {
          ...doc,
          ingressCount: 0,
          egressCount: 0,
          ...summaryTotals,
        };
      }),
    );
  },
});

/**
 * Export-ready data for all documents (validated data preferred, otherwise Gemini 3)
 */
export const getDocumentsForCsvExport = authQuery({
  args: {},
  handler: async (ctx) => {
    const documents = await ctx.db.query('documents').order('desc').collect();

    return await Promise.all(
      documents.map(async (doc) => {
        const validatedData = await ctx.db
          .query('validatedData')
          .withIndex('by_document', (q) => q.eq('documentId', doc._id))
          .unique();

        if (validatedData) {
          return {
            ...doc,
            source: 'validated',
            sourceModel: null,
            sourceCompletedAt: validatedData.validatedAt,
            ingress: validatedData.ingress,
            egress: validatedData.egress,
          };
        }

        const extractions = await ctx.db
          .query('extractions')
          .withIndex('by_document', (q) => q.eq('documentId', doc._id))
          .collect();

        const gemini3Extractions = extractions
          .filter((extraction) => extraction.model.startsWith('gemini-3'))
          .sort((a, b) => b.completedAt - a.completedAt);

        const latestExtraction = gemini3Extractions[0]
          ? { extraction: gemini3Extractions[0], source: 'gemini-3' }
          : null;

        if (!latestExtraction) {
          return {
            ...doc,
            source: 'none',
            sourceModel: null,
            sourceCompletedAt: null,
            ingress: [],
            egress: [],
          };
        }

        return {
          ...doc,
          source: latestExtraction.source,
          sourceModel: latestExtraction.extraction.model,
          sourceCompletedAt: latestExtraction.extraction.completedAt,
          ingress: latestExtraction.extraction.ingress,
          egress: latestExtraction.extraction.egress,
        };
      }),
    );
  },
});

/**
 * Get a single document by ID
 */
export const getDocument = authQuery({
  args: {
    documentId: v.id('documents'),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) {
      return null;
    }

    const fileUrl = await ctx.storage.getUrl(doc.fileId);

    return {
      ...doc,
      fileUrl,
    };
  },
});

/**
 * Set the rotation for a specific page (rotates by 90 degrees each call)
 */
export const setPageRotation = authMutation({
  args: {
    documentId: v.id('documents'),
    pageNumber: v.number(),
    rotation: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) {
      throw new Error('Document not found');
    }

    const pageRotations = doc.pageRotations ?? {};
    const normalizedRotation = ((args.rotation % 360) + 360) % 360;

    // Store rotation, or remove if back to 0
    if (normalizedRotation === 0) {
      delete pageRotations[String(args.pageNumber)];
    } else {
      pageRotations[String(args.pageNumber)] = normalizedRotation;
    }

    await ctx.db.patch(args.documentId, { pageRotations });

    return null;
  },
});

/**
 * Reprocess all documents stuck in "processing" state
 */
export const reprocessStuckDocuments = authMutation({
  args: {},
  returns: v.object({
    reprocessed: v.number(),
  }),
  handler: async (ctx) => {
    const processingDocs = await ctx.db
      .query('documents')
      .withIndex('by_status', (q) => q.eq('status', 'processing'))
      .collect();

    for (const doc of processingDocs) {
      const existingExtractions = await ctx.db
        .query('extractions')
        .withIndex('by_document', (q) => q.eq('documentId', doc._id))
        .collect();

      for (const extraction of existingExtractions) {
        await ctx.db.delete(extraction._id);
      }

      await ctx.db.patch(doc._id, {
        status: 'pending',
        errorMessage: undefined,
        processingStartedAt: undefined,
      });

      await ctx.scheduler.runAfter(0, internal.extraction.startExtraction, {
        documentId: doc._id,
      });
    }

    return {
      reprocessed: processingDocs.length,
    };
  },
});

/**
 * Process summaries for all documents that have completed extraction but no summary
 */
export const processAllSummaries = authMutation({
  args: {
    force: v.optional(v.boolean()),
  },
  returns: v.object({ queued: v.number() }),
  handler: async (ctx, args) => {
    const completedDocs = await ctx.db
      .query('documents')
      .withIndex('by_status', (q) => q.eq('status', 'completed'))
      .collect();

    const docsNeedingSummary = args.force
      ? completedDocs
      : completedDocs.filter(
          (doc) => doc.summaryStatus === undefined || doc.summaryStatus === null || doc.summaryStatus === 'failed',
        );

    for (const doc of docsNeedingSummary) {
      await ctx.db.patch(doc._id, {
        summaryStatus: 'pending',
      });

      await ctx.scheduler.runAfter(0, internal.summaryExtraction.startSummaryExtraction, {
        documentId: doc._id,
      });
    }

    return {
      queued: docsNeedingSummary.length,
    };
  },
});

/**
 * Process summary for a single document
 */
export const processSingleSummary = authMutation({
  args: { documentId: v.id('documents') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) {
      throw new Error('Document not found');
    }

    await ctx.db.patch(args.documentId, {
      summaryStatus: 'pending',
    });

    await ctx.scheduler.runAfter(0, internal.summaryExtraction.startSummaryExtraction, {
      documentId: args.documentId,
    });

    return null;
  },
});

/**
 * Get documents with discrepancy calculations between summary totals and row sums
 */
export const getDocumentsWithDiscrepancies = authQuery({
  args: {},
  handler: async (ctx) => {
    const documents = await ctx.db.query('documents').collect();

    const results = await Promise.all(
      documents.map(async (doc) => {
        // Get summary extraction
        const summaryExtraction = await ctx.db
          .query('summaryExtractions')
          .withIndex('by_document', (q) => q.eq('documentId', doc._id))
          .first();

        if (!summaryExtraction) {
          return null;
        }

        const summaryTotalIngresos = summaryExtraction.summary.totalIngresos ?? null;
        const summaryTotalGastos = summaryExtraction.summary.totalGastos ?? null;

        // Get best row data: validated first, then gemini-3-flash
        const validatedData = await ctx.db
          .query('validatedData')
          .withIndex('by_document', (q) => q.eq('documentId', doc._id))
          .unique();

        let ingress: { total?: number | null }[] = [];
        let egress: { totalDeGastosDePropagandaYCampania?: number | null }[] = [];
        let dataSource: 'validated' | 'gemini-3-flash' | 'none' = 'none';

        if (validatedData) {
          ingress = validatedData.ingress;
          egress = validatedData.egress;
          dataSource = 'validated';
        } else {
          const extractions = await ctx.db
            .query('extractions')
            .withIndex('by_document', (q) => q.eq('documentId', doc._id))
            .collect();

          const gemini3Extraction = extractions
            .filter((e) => e.model.startsWith('gemini-3'))
            .sort((a, b) => b.completedAt - a.completedAt)[0];

          if (gemini3Extraction) {
            ingress = gemini3Extraction.ingress;
            egress = gemini3Extraction.egress;
            dataSource = 'gemini-3-flash';
          }
        }

        // Calculate sums from rows
        const summedIngresos = ingress.reduce((sum, row) => sum + (row.total ?? 0), 0);
        const summedGastos = egress.reduce(
          (sum, row) => sum + (row.totalDeGastosDePropagandaYCampania ?? 0),
          0,
        );

        // Calculate discrepancies
        const ingressDiscrepancy =
          summaryTotalIngresos != null ? summaryTotalIngresos - summedIngresos : null;
        const egressDiscrepancy =
          summaryTotalGastos != null ? summaryTotalGastos - summedGastos : null;

        // Calculate max absolute discrepancy for sorting
        const maxAbsDiscrepancy = Math.max(
          Math.abs(ingressDiscrepancy ?? 0),
          Math.abs(egressDiscrepancy ?? 0),
        );

        return {
          _id: doc._id,
          name: doc.name,
          dataSource,
          summaryTotalIngresos,
          summaryTotalGastos,
          summedIngresos,
          summedGastos,
          ingressDiscrepancy,
          egressDiscrepancy,
          maxAbsDiscrepancy,
          ingressRowCount: ingress.length,
          egressRowCount: egress.length,
        };
      }),
    );

    // Filter out nulls and sort by max absolute discrepancy descending
    return results
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.maxAbsDiscrepancy - a.maxAbsDiscrepancy);
  },
});
