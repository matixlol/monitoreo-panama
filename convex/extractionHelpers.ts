import { v } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';

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
    await ctx.db.patch(args.documentId, {
      status: args.status,
      errorMessage: args.errorMessage,
    });
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
    await ctx.db.insert('extractions', {
      documentId: args.documentId,
      model: args.model,
      ingress: args.ingress,
      egress: args.egress,
      completedAt: Date.now(),
    });
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
