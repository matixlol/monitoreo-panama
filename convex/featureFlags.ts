import { v } from 'convex/values';
import { internalQuery } from './_generated/server';
import { authMutation, authQuery } from './lib/withAuth';

const DOCLING_OVERRIDE_KEY = 'doclingOverride';
const DOCLING_OVERRIDE_DEFAULT = true;

async function getFlagValue(ctx: { db: any }, key: string, defaultValue: boolean) {
  const flag = await ctx.db
    .query('featureFlags')
    .withIndex('by_key', (q: any) => q.eq('key', key))
    .first();
  return flag ? (flag.enabled as boolean) : defaultValue;
}

export const getDoclingOverride = authQuery({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => getFlagValue(ctx, DOCLING_OVERRIDE_KEY, DOCLING_OVERRIDE_DEFAULT),
});

export const getDoclingOverrideInternal = internalQuery({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => getFlagValue(ctx, DOCLING_OVERRIDE_KEY, DOCLING_OVERRIDE_DEFAULT),
});

export const setDoclingOverride = authMutation({
  args: {
    enabled: v.boolean(),
  },
  returns: v.object({ enabled: v.boolean() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('featureFlags')
      .withIndex('by_key', (q) => q.eq('key', DOCLING_OVERRIDE_KEY))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { enabled: args.enabled, updatedAt: Date.now() });
    } else {
      await ctx.db.insert('featureFlags', {
        key: DOCLING_OVERRIDE_KEY,
        enabled: args.enabled,
        updatedAt: Date.now(),
      });
    }

    return { enabled: args.enabled };
  },
});
