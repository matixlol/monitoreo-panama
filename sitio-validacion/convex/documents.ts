import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { internal } from './_generated/api';

/**
 * Generate an upload URL for a PDF file
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Create a new document record after uploading a PDF
 */
export const createDocument = mutation({
  args: {
    fileId: v.id('_storage'),
    name: v.string(),
    pageCount: v.number(),
  },
  returns: v.id('documents'),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }
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

/**
 * Manually trigger re-extraction for a document
 */
export const retryExtraction = mutation({
  args: {
    documentId: v.id('documents'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }
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
export const listDocuments = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }
    const documents = await ctx.db.query('documents').order('desc').collect();

    return await Promise.all(
      documents.map(async (doc) => {
        // First check if there's validated data
        const validatedData = await ctx.db
          .query('validatedData')
          .withIndex('by_document', (q) => q.eq('documentId', doc._id))
          .unique();

        if (validatedData) {
          return {
            ...doc,
            ingressCount: validatedData.ingress.length,
            egressCount: validatedData.egress.length,
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
          };
        }

        // No extractions yet
        return {
          ...doc,
          ingressCount: 0,
          egressCount: 0,
        };
      }),
    );
  },
});

/**
 * Get a single document by ID
 */
export const getDocument = query({
  args: {
    documentId: v.id('documents'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }
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
export const setPageRotation = mutation({
  args: {
    documentId: v.id('documents'),
    pageNumber: v.number(),
    rotation: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }
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
