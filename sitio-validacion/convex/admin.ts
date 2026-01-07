'use node';

import { v } from 'convex/values';
import { action } from './_generated/server';
import { createAccount, getAuthUserId } from '@convex-dev/auth/server';
import Crypto from 'node:crypto';

/**
 * Generate a random password of specified length
 */
function generatePassword(length: number = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
  const randomBytes = Crypto.randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }
  return password;
}

/**
 * Create a new user with a generated password (admin only, requires authentication)
 */
export const createUser = action({
  args: {
    email: v.string(),
  },
  returns: v.object({
    email: v.string(),
    password: v.string(),
  }),
  handler: async (ctx, args) => {
    // Check if the caller is authenticated
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error('Unauthorized: You must be logged in to create users');
    }

    // Generate a random password
    const password = generatePassword(16);

    try {
      // Create the account using the createAccount helper from @convex-dev/auth
      // This handles password hashing via the Password provider's crypto config
      await createAccount(ctx, {
        provider: 'password',
        account: {
          id: args.email,
          secret: password,
        },
        profile: {
          email: args.email,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        throw new Error(`User with email ${args.email} already exists`);
      }
      throw error;
    }

    return {
      email: args.email,
      password,
    };
  },
});
