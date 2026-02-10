import { v } from 'convex/values';
import { internalQuery } from './_generated/server';
import { authMutation, authQuery } from './lib/withAuth';
import { DEFAULT_MODEL, type ModelKey, MODELS } from '../models';

const EXTRACTION_MODEL_KEY = 'extractionModel';

async function getStringFlagValue(ctx: { db: any }, key: string, defaultValue: string): Promise<string> {
  const flag = await ctx.db
    .query('featureFlags')
    .withIndex('by_key', (q: any) => q.eq('key', key))
    .first();
  return flag?.value ?? defaultValue;
}

export const getExtractionModel = authQuery({
  args: {},
  returns: v.string(),
  handler: async (ctx) => getStringFlagValue(ctx, EXTRACTION_MODEL_KEY, DEFAULT_MODEL),
});

export const getExtractionModelInternal = internalQuery({
  args: {},
  returns: v.string(),
  handler: async (ctx) => getStringFlagValue(ctx, EXTRACTION_MODEL_KEY, DEFAULT_MODEL),
});

export const setExtractionModel = authMutation({
  args: {
    model: v.string(),
  },
  returns: v.object({ model: v.string() }),
  handler: async (ctx, args) => {
    if (!(args.model in MODELS)) {
      throw new Error(`Invalid model: ${args.model}. Valid models: ${Object.keys(MODELS).join(', ')}`);
    }

    const existing = await ctx.db
      .query('featureFlags')
      .withIndex('by_key', (q: any) => q.eq('key', EXTRACTION_MODEL_KEY))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { value: args.model, updatedAt: Date.now() });
    } else {
      await ctx.db.insert('featureFlags', {
        key: EXTRACTION_MODEL_KEY,
        enabled: true,
        value: args.model,
        updatedAt: Date.now(),
      });
    }

    return { model: args.model };
  },
});
