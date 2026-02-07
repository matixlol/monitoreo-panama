import { v } from 'convex/values';
import { authQuery } from './lib/withAuth';
import { summaryExtractionValidator } from './schema';

/**
 * Get the latest summary extraction for a document (Resumen de Ingresos y Gastos).
 */
export const getLatestForDocument = authQuery({
  args: {
    documentId: v.id('documents'),
  },
  returns: v.union(
    v.object({
      _id: v.id('summaryExtractions'),
      _creationTime: v.number(),
      documentId: v.id('documents'),
      model: v.string(),
      summary: summaryExtractionValidator,
      pageNumber: v.number(),
      completedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const extractions = await ctx.db
      .query('summaryExtractions')
      .withIndex('by_document', (q) => q.eq('documentId', args.documentId))
      .collect();

    const latest = extractions.sort((a, b) => b.completedAt - a.completedAt)[0];
    return latest ?? null;
  },
});

