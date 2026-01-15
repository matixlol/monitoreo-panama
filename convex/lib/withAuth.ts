import { customQuery, customMutation, customAction } from 'convex-helpers/server/customFunctions';
import { query, mutation, action } from '../_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';

/**
 * Authenticated query - ensures user is logged in before executing
 */
export const authQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new Error('Unauthorized');
    }
    return { ctx: { user }, args: {} };
  },
});

/**
 * Authenticated mutation - ensures user is logged in before executing
 */
export const authMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new Error('Unauthorized');
    }
    return { ctx: { user }, args: {} };
  },
});

/**
 * Authenticated action - ensures user is logged in before executing
 */
export const authAction = customAction(action, {
  args: {},
  input: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error('Unauthorized');
    }
    return { ctx: { userId }, args: {} };
  },
});
