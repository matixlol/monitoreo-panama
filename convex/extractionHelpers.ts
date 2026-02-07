import { v } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';
import {
  documentsHistory,
  extractionsHistory,
  historyAttribution,
  summaryExtractionsHistory,
  validatedDataHistory,
} from './lib/tableHistory';

/**
 * Update document status
 */
export const updateDocumentStatus = internalMutation({
  args: {
    documentId: v.id('documents'),
    status: v.union(v.literal('pending'), v.literal('processing'), v.literal('completed'), v.literal('failed')),
    errorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: {
      status: 'pending' | 'processing' | 'completed' | 'failed';
      errorMessage?: string;
      processingStartedAt?: number;
    } = {
      status: args.status,
      errorMessage: args.errorMessage,
    };

    if (args.status === 'processing') {
      patch.processingStartedAt = Date.now();
    }

    await ctx.db.patch(args.documentId, patch);
    const updated = await ctx.db.get(args.documentId);
    await documentsHistory.update(ctx, args.documentId, updated, await historyAttribution(ctx, 'extractionHelpers.updateDocumentStatus'));
    return null;
  },
});

/**
 * Store extraction results
 */
export const storeExtraction = internalMutation({
  args: {
    documentId: v.id('documents'),
    model: v.string(),
    ingress: v.array(v.any()),
    egress: v.array(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const extractionId = await ctx.db.insert('extractions', {
      documentId: args.documentId,
      model: args.model,
      ingress: args.ingress,
      egress: args.egress,
      completedAt: Date.now(),
    });
    const inserted = await ctx.db.get(extractionId);
    await extractionsHistory.update(
      ctx,
      extractionId,
      inserted,
      await historyAttribution(ctx, 'extractionHelpers.storeExtraction', { documentId: args.documentId, model: args.model }),
    );
    return null;
  },
});

/**
 * Clear (delete) any existing page-level extraction proposals for a document page
 */
export const clearPageExtractionProposals = internalMutation({
  args: {
    documentId: v.id('documents'),
    pageNumber: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('pageExtractionProposals')
      .withIndex('by_document_page', (q) => q.eq('documentId', args.documentId).eq('pageNumber', args.pageNumber))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return null;
  },
});

/**
 * Upsert page-level extraction proposals (2x Flash + 2x Pro) for a document page
 */
export const upsertPageExtractionProposals = internalMutation({
  args: {
    documentId: v.id('documents'),
    pageNumber: v.number(),
    proposals: v.array(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query('pageExtractionProposals')
      .withIndex('by_document_page', (q) => q.eq('documentId', args.documentId).eq('pageNumber', args.pageNumber))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        proposals: args.proposals,
        updatedAt: now,
      });
      return null;
    }

    await ctx.db.insert('pageExtractionProposals', {
      documentId: args.documentId,
      pageNumber: args.pageNumber,
      proposals: args.proposals,
      createdAt: now,
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Update summary extraction status
 */
export const updateSummaryStatus = internalMutation({
  args: {
    documentId: v.id('documents'),
    summaryStatus: v.union(v.literal('pending'), v.literal('processing'), v.literal('completed'), v.literal('failed')),
    summaryErrorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: {
      summaryStatus: 'pending' | 'processing' | 'completed' | 'failed';
      summaryErrorMessage?: string;
    } = {
      summaryStatus: args.summaryStatus,
      summaryErrorMessage: args.summaryErrorMessage,
    };

    await ctx.db.patch(args.documentId, patch);
    const updated = await ctx.db.get(args.documentId);
    await documentsHistory.update(ctx, args.documentId, updated, await historyAttribution(ctx, 'extractionHelpers.updateSummaryStatus'));
    return null;
  },
});

/**
 * Store summary extraction results
 */
export const storeSummaryExtraction = internalMutation({
  args: {
    documentId: v.id('documents'),
    model: v.string(),
    summary: v.any(),
    pageNumber: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const summaryExtractionId = await ctx.db.insert('summaryExtractions', {
      documentId: args.documentId,
      model: args.model,
      summary: args.summary,
      pageNumber: args.pageNumber,
      completedAt: Date.now(),
    });
    const inserted = await ctx.db.get(summaryExtractionId);
    await summaryExtractionsHistory.update(
      ctx,
      summaryExtractionId,
      inserted,
      await historyAttribution(ctx, 'extractionHelpers.storeSummaryExtraction', {
        documentId: args.documentId,
        model: args.model,
        pageNumber: args.pageNumber,
      }),
    );
    return null;
  },
});

/**
 * Update extraction data for a specific page (replaces old page data with new)
 */
export const updateExtractionForPage = internalMutation({
  args: {
    documentId: v.id('documents'),
    pageNumber: v.number(),
    ingress: v.array(v.any()),
    egress: v.array(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get the latest extraction for this document
    const extractions = await ctx.db
      .query('extractions')
      .withIndex('by_document', (q) => q.eq('documentId', args.documentId))
      .collect();

    const latestExtraction = extractions
      .filter((e) => e.model.startsWith('gemini-3'))
      .sort((a, b) => b.completedAt - a.completedAt)[0];

    if (!latestExtraction) {
      throw new Error('No extraction found for document');
    }

    // Filter out old page data and add new page data
    const updatedIngress = [
      ...(latestExtraction.ingress as Array<{ pageNumber: number }>).filter(
        (row) => row.pageNumber !== args.pageNumber,
      ),
      ...args.ingress,
    ];

    const updatedEgress = [
      ...(latestExtraction.egress as Array<{ pageNumber: number }>).filter((row) => row.pageNumber !== args.pageNumber),
      ...args.egress,
    ];

    // Update the extraction
    await ctx.db.patch(latestExtraction._id, {
      ingress: updatedIngress,
      egress: updatedEgress,
      completedAt: Date.now(),
    });
    const updated = await ctx.db.get(latestExtraction._id);
    await extractionsHistory.update(
      ctx,
      latestExtraction._id,
      updated,
      await historyAttribution(ctx, 'extractionHelpers.updateExtractionForPage', {
        documentId: args.documentId,
        pageNumber: args.pageNumber,
      }),
    );

    return null;
  },
});

/**
 * Delete validated data for a specific page
 */
export const deleteValidatedDataForPage = internalMutation({
  args: {
    documentId: v.id('documents'),
    pageNumber: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const validatedData = await ctx.db
      .query('validatedData')
      .withIndex('by_document', (q) => q.eq('documentId', args.documentId))
      .unique();

    if (!validatedData) {
      return null; // No validated data to delete
    }

    // Filter out rows for the specified page
    const updatedIngress = (validatedData.ingress as Array<{ pageNumber: number }>).filter(
      (row) => row.pageNumber !== args.pageNumber,
    );

    const updatedEgress = (validatedData.egress as Array<{ pageNumber: number }>).filter(
      (row) => row.pageNumber !== args.pageNumber,
    );

    // Update the validated data
    await ctx.db.patch(validatedData._id, {
      ingress: updatedIngress,
      egress: updatedEgress,
      validatedAt: Date.now(),
    });
    const updated = await ctx.db.get(validatedData._id);
    await validatedDataHistory.update(
      ctx,
      validatedData._id,
      updated,
      await historyAttribution(ctx, 'extractionHelpers.deleteValidatedDataForPage', {
        documentId: args.documentId,
        pageNumber: args.pageNumber,
      }),
    );

    return null;
  },
});

/**
 * Update validated data with re-extracted page data
 * This merges new extraction results into existing validated data
 */
export const updateValidatedDataForPage = internalMutation({
  args: {
    documentId: v.id('documents'),
    pageNumber: v.number(),
    ingress: v.array(v.any()),
    egress: v.array(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const validatedData = await ctx.db
      .query('validatedData')
      .withIndex('by_document', (q) => q.eq('documentId', args.documentId))
      .unique();

    if (!validatedData) {
      return null; // No validated data to update
    }

    // Strip unreadableFields from extraction rows (validatedData uses humanUnreadableFields instead)
    const stripExtractionFields = <T extends Record<string, unknown>>(rows: T[]): T[] =>
      rows.map(({ unreadableFields, ...rest }) => rest as T);

    // Filter out old page data and add new page data
    const updatedIngress = [
      ...(validatedData.ingress as Array<{ pageNumber: number }>).filter((row) => row.pageNumber !== args.pageNumber),
      ...stripExtractionFields(args.ingress),
    ];

    const updatedEgress = [
      ...(validatedData.egress as Array<{ pageNumber: number }>).filter((row) => row.pageNumber !== args.pageNumber),
      ...stripExtractionFields(args.egress),
    ];

    await ctx.db.patch(validatedData._id, {
      ingress: updatedIngress,
      egress: updatedEgress,
      validatedAt: Date.now(),
    });
    const updated = await ctx.db.get(validatedData._id);
    await validatedDataHistory.update(
      ctx,
      validatedData._id,
      updated,
      await historyAttribution(ctx, 'extractionHelpers.updateValidatedDataForPage', {
        documentId: args.documentId,
        pageNumber: args.pageNumber,
      }),
    );

    return null;
  },
});

/**
 * Set page re-extraction status (pending/processing)
 */
export const setPageReExtractionStatus = internalMutation({
  args: {
    documentId: v.id('documents'),
    pageNumber: v.number(),
    status: v.union(v.literal('pending'), v.literal('processing'), v.literal('failed')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return null;

    const pageReExtractionStatus = { ...(doc.pageReExtractionStatus ?? {}) };
    pageReExtractionStatus[String(args.pageNumber)] = args.status;

    await ctx.db.patch(args.documentId, { pageReExtractionStatus });
    const updated = await ctx.db.get(args.documentId);
    await documentsHistory.update(
      ctx,
      args.documentId,
      updated,
      await historyAttribution(ctx, 'extractionHelpers.setPageReExtractionStatus', {
        pageNumber: args.pageNumber,
        status: args.status,
      }),
    );
    return null;
  },
});

/**
 * Clear page re-extraction status (when complete)
 */
export const clearPageReExtractionStatus = internalMutation({
  args: {
    documentId: v.id('documents'),
    pageNumber: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return null;

    const pageReExtractionStatus = { ...(doc.pageReExtractionStatus ?? {}) };
    delete pageReExtractionStatus[String(args.pageNumber)];

    await ctx.db.patch(args.documentId, { pageReExtractionStatus });
    const updated = await ctx.db.get(args.documentId);
    await documentsHistory.update(
      ctx,
      args.documentId,
      updated,
      await historyAttribution(ctx, 'extractionHelpers.clearPageReExtractionStatus', {
        pageNumber: args.pageNumber,
      }),
    );
    return null;
  },
});

/**
 * Internal query to get document (for use in actions)
 */
export const getDocumentInternal = internalQuery({
  args: {
    documentId: v.id('documents'),
  },
  returns: v.union(
    v.object({
      _id: v.id('documents'),
      fileId: v.id('_storage'),
      name: v.string(),
      pageCount: v.number(),
      status: v.union(v.literal('pending'), v.literal('processing'), v.literal('completed'), v.literal('failed')),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) {
      return null;
    }
    return {
      _id: doc._id,
      fileId: doc.fileId,
      name: doc.name,
      pageCount: doc.pageCount,
      status: doc.status,
    };
  },
});
