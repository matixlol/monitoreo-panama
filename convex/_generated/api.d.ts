/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as documents from "../documents.js";
import type * as extraction from "../extraction.js";
import type * as extractionHelpers from "../extractionHelpers.js";
import type * as extractions from "../extractions.js";
import type * as http from "../http.js";
import type * as lib_withAuth from "../lib/withAuth.js";
import type * as summaryExtraction from "../summaryExtraction.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  documents: typeof documents;
  extraction: typeof extraction;
  extractionHelpers: typeof extractionHelpers;
  extractions: typeof extractions;
  http: typeof http;
  "lib/withAuth": typeof lib_withAuth;
  summaryExtraction: typeof summaryExtraction;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
