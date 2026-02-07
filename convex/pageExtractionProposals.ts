import { v } from 'convex/values';
import { internalQuery } from './_generated/server';
import { authMutation, authQuery } from './lib/withAuth';
import { extractionEgressRowValidator, extractionIngressRowValidator } from './schema';

const pageExtractionProposalValidator = v.object({
  key: v.string(), // e.g. "gemini-3-flash:1"
  model: v.string(), // "gemini-3-flash" | "gemini-3-pro"
  run: v.number(), // 1 or 2
  ingress: v.array(extractionIngressRowValidator),
  egress: v.array(extractionEgressRowValidator),
  completedAt: v.number(),
  errorMessage: v.optional(v.string()),
});

export const getForPage = authQuery({
  args: {
    documentId: v.id('documents'),
    pageNumber: v.number(),
  },
  returns: v.union(
    v.object({
      _id: v.id('pageExtractionProposals'),
      _creationTime: v.number(),
      documentId: v.id('documents'),
      pageNumber: v.number(),
      proposals: v.array(pageExtractionProposalValidator),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('pageExtractionProposals')
      .withIndex('by_document_page', (q) => q.eq('documentId', args.documentId).eq('pageNumber', args.pageNumber))
      .unique();
  },
});

export const getForPageInternal = internalQuery({
  args: {
    documentId: v.id('documents'),
    pageNumber: v.number(),
  },
  returns: v.union(
    v.object({
      _id: v.id('pageExtractionProposals'),
      documentId: v.id('documents'),
      pageNumber: v.number(),
      proposals: v.array(v.any()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('pageExtractionProposals')
      .withIndex('by_document_page', (q) => q.eq('documentId', args.documentId).eq('pageNumber', args.pageNumber))
      .unique();

    if (!row) return null;

    return {
      _id: row._id,
      documentId: row.documentId,
      pageNumber: row.pageNumber,
      proposals: row.proposals,
    };
  },
});

/**
 * Apply a stored proposal to both the latest Gemini 3 extraction and (if present) validated data.
 *
 * Note: This replaces the data on that page, discarding any previous validated edits on that page.
 */
export const applyProposalToPage = authMutation({
  args: {
    documentId: v.id('documents'),
    pageNumber: v.number(),
    proposalKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const proposalsRow = await ctx.db
      .query('pageExtractionProposals')
      .withIndex('by_document_page', (q) => q.eq('documentId', args.documentId).eq('pageNumber', args.pageNumber))
      .unique();

    if (!proposalsRow) {
      throw new Error('No proposals found for this page');
    }

    const proposal = proposalsRow.proposals.find((p) => p.key === args.proposalKey);
    if (!proposal) {
      throw new Error(`Proposal not found: ${args.proposalKey}`);
    }

    if (proposal.errorMessage) {
      throw new Error(`Cannot apply a failed proposal: ${proposal.errorMessage}`);
    }

    // Update latest Gemini 3 extraction for this document
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

    const updatedIngress = [
      ...(latestExtraction.ingress as Array<{ pageNumber: number }>).filter((row) => row.pageNumber !== args.pageNumber),
      ...(proposal.ingress as Array<any>),
    ];

    const updatedEgress = [
      ...(latestExtraction.egress as Array<{ pageNumber: number }>).filter((row) => row.pageNumber !== args.pageNumber),
      ...(proposal.egress as Array<any>),
    ];

    await ctx.db.patch(latestExtraction._id, {
      ingress: updatedIngress,
      egress: updatedEgress,
      completedAt: Date.now(),
    });

    // Also update validated data if it exists
    const validatedData = await ctx.db
      .query('validatedData')
      .withIndex('by_document', (q) => q.eq('documentId', args.documentId))
      .unique();

    if (validatedData) {
      const stripExtractionFields = <T extends Record<string, unknown>>(rows: T[]): T[] =>
        rows.map(({ unreadableFields, ...rest }) => rest as T);

      const updatedValidatedIngress = [
        ...(validatedData.ingress as Array<{ pageNumber: number }>).filter((row) => row.pageNumber !== args.pageNumber),
        ...stripExtractionFields(proposal.ingress as Array<any>),
      ];

      const updatedValidatedEgress = [
        ...(validatedData.egress as Array<{ pageNumber: number }>).filter((row) => row.pageNumber !== args.pageNumber),
        ...stripExtractionFields(proposal.egress as Array<any>),
      ];

      await ctx.db.patch(validatedData._id, {
        ingress: updatedValidatedIngress,
        egress: updatedValidatedEgress,
        validatedAt: Date.now(),
      });
    }

    return null;
  },
});

