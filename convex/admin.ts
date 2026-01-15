'use node';

import { v } from 'convex/values';
import { createAccount } from '@convex-dev/auth/server';
import Crypto from 'node:crypto';
import { authAction } from './lib/withAuth';

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
export const createUser = authAction({
  args: {
    email: v.string(),
  },
  returns: v.object({
    email: v.string(),
    password: v.string(),
  }),
  handler: async (ctx, args) => {
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
