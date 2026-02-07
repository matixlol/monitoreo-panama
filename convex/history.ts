import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { authQuery } from "./lib/withAuth";
import { documentsHistory, extractionsHistory, summaryExtractionsHistory, validatedDataHistory } from "./lib/tableHistory";

// Documents
export const listDocumentsHistory = authQuery({
  args: { maxTs: v.number(), paginationOpts: paginationOptsValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await documentsHistory.listHistory(ctx, args.maxTs, args.paginationOpts);
  },
});

export const listDocumentsDocumentHistory = authQuery({
  args: { documentId: v.id("documents"), maxTs: v.number(), paginationOpts: paginationOptsValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await documentsHistory.listDocumentHistory(ctx, args.documentId, args.maxTs, args.paginationOpts);
  },
});

export const listDocumentsSnapshot = authQuery({
  args: { snapshotTs: v.number(), currentTs: v.number(), paginationOpts: paginationOptsValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await documentsHistory.listSnapshot(ctx, args.snapshotTs, args.currentTs, args.paginationOpts);
  },
});

// Extractions
export const listExtractionsHistory = authQuery({
  args: { maxTs: v.number(), paginationOpts: paginationOptsValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await extractionsHistory.listHistory(ctx, args.maxTs, args.paginationOpts);
  },
});

export const listExtractionsDocumentHistory = authQuery({
  args: { extractionId: v.id("extractions"), maxTs: v.number(), paginationOpts: paginationOptsValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await extractionsHistory.listDocumentHistory(ctx, args.extractionId, args.maxTs, args.paginationOpts);
  },
});

export const listExtractionsSnapshot = authQuery({
  args: { snapshotTs: v.number(), currentTs: v.number(), paginationOpts: paginationOptsValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await extractionsHistory.listSnapshot(ctx, args.snapshotTs, args.currentTs, args.paginationOpts);
  },
});

// Summary extractions
export const listSummaryExtractionsHistory = authQuery({
  args: { maxTs: v.number(), paginationOpts: paginationOptsValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await summaryExtractionsHistory.listHistory(ctx, args.maxTs, args.paginationOpts);
  },
});

export const listSummaryExtractionsDocumentHistory = authQuery({
  args: { summaryExtractionId: v.id("summaryExtractions"), maxTs: v.number(), paginationOpts: paginationOptsValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await summaryExtractionsHistory.listDocumentHistory(ctx, args.summaryExtractionId, args.maxTs, args.paginationOpts);
  },
});

export const listSummaryExtractionsSnapshot = authQuery({
  args: { snapshotTs: v.number(), currentTs: v.number(), paginationOpts: paginationOptsValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await summaryExtractionsHistory.listSnapshot(ctx, args.snapshotTs, args.currentTs, args.paginationOpts);
  },
});

// Validated data
export const listValidatedDataHistory = authQuery({
  args: { maxTs: v.number(), paginationOpts: paginationOptsValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await validatedDataHistory.listHistory(ctx, args.maxTs, args.paginationOpts);
  },
});

export const listValidatedDataDocumentHistory = authQuery({
  args: { validatedDataId: v.id("validatedData"), maxTs: v.number(), paginationOpts: paginationOptsValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await validatedDataHistory.listDocumentHistory(ctx, args.validatedDataId, args.maxTs, args.paginationOpts);
  },
});

// Convenience wrapper: validated data history for a given `documents` row.
export const listValidatedDataHistoryForDocument = authQuery({
  args: { documentId: v.id("documents"), maxTs: v.number(), paginationOpts: paginationOptsValidator },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const validated = await ctx.db
      .query("validatedData")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .unique();
    if (!validated) return null;
    return await validatedDataHistory.listDocumentHistory(ctx, validated._id, args.maxTs, args.paginationOpts);
  },
});

export const listValidatedDataSnapshot = authQuery({
  args: { snapshotTs: v.number(), currentTs: v.number(), paginationOpts: paginationOptsValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await validatedDataHistory.listSnapshot(ctx, args.snapshotTs, args.currentTs, args.paginationOpts);
  },
});

