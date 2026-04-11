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
import type * as featureFlags from "../featureFlags.js";
import type * as history from "../history.js";
import type * as http from "../http.js";
import type * as lib_tableHistory from "../lib/tableHistory.js";
import type * as lib_withAuth from "../lib/withAuth.js";
import type * as pageExtractionProposals from "../pageExtractionProposals.js";
import type * as retrier from "../retrier.js";
import type * as summaryExtraction from "../summaryExtraction.js";
import type * as summaryExtractions from "../summaryExtractions.js";

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
  featureFlags: typeof featureFlags;
  history: typeof history;
  http: typeof http;
  "lib/tableHistory": typeof lib_tableHistory;
  "lib/withAuth": typeof lib_withAuth;
  pageExtractionProposals: typeof pageExtractionProposals;
  retrier: typeof retrier;
  summaryExtraction: typeof summaryExtraction;
  summaryExtractions: typeof summaryExtractions;
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

export declare const components: {
  actionRetrier: {
    public: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        { runId: string },
        boolean
      >;
      cleanup: FunctionReference<
        "mutation",
        "internal",
        { runId: string },
        any
      >;
      start: FunctionReference<
        "mutation",
        "internal",
        {
          functionArgs: any;
          functionHandle: string;
          options: {
            base: number;
            initialBackoffMs: number;
            logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
            maxFailures: number;
            onComplete?: string;
            runAfter?: number;
            runAt?: number;
          };
        },
        string
      >;
      status: FunctionReference<
        "query",
        "internal",
        { runId: string },
        | { type: "inProgress" }
        | {
            result:
              | { returnValue: any; type: "success" }
              | { error: string; type: "failed" }
              | { type: "canceled" };
            type: "completed";
          }
      >;
    };
  };
  documentsHistory: {
    lib: {
      listDocumentHistory: FunctionReference<
        "query",
        "internal",
        {
          id: string;
          maxTs: number;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            attribution: any;
            doc: any;
            id: string;
            isDeleted: boolean;
            ts: number;
          }>;
        }
      >;
      listHistory: FunctionReference<
        "query",
        "internal",
        {
          maxTs: number;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            attribution: any;
            doc: any;
            id: string;
            isDeleted: boolean;
            ts: number;
          }>;
        }
      >;
      listSnapshot: FunctionReference<
        "query",
        "internal",
        {
          currentTs: number;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          snapshotTs: number;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            attribution: any;
            doc: any;
            id: string;
            isDeleted: boolean;
            ts: number;
          }>;
          pageStatus?: "SplitRecommended";
          splitCursor?: string;
        }
      >;
      update: FunctionReference<
        "mutation",
        "internal",
        {
          attribution: any;
          doc: any | null;
          id: string;
          serializability: "table" | "document" | "wallclock";
        },
        number
      >;
      vacuumHistory: FunctionReference<
        "mutation",
        "internal",
        { minTsToKeep: number },
        any
      >;
    };
  };
  extractionsHistory: {
    lib: {
      listDocumentHistory: FunctionReference<
        "query",
        "internal",
        {
          id: string;
          maxTs: number;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            attribution: any;
            doc: any;
            id: string;
            isDeleted: boolean;
            ts: number;
          }>;
        }
      >;
      listHistory: FunctionReference<
        "query",
        "internal",
        {
          maxTs: number;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            attribution: any;
            doc: any;
            id: string;
            isDeleted: boolean;
            ts: number;
          }>;
        }
      >;
      listSnapshot: FunctionReference<
        "query",
        "internal",
        {
          currentTs: number;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          snapshotTs: number;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            attribution: any;
            doc: any;
            id: string;
            isDeleted: boolean;
            ts: number;
          }>;
          pageStatus?: "SplitRecommended";
          splitCursor?: string;
        }
      >;
      update: FunctionReference<
        "mutation",
        "internal",
        {
          attribution: any;
          doc: any | null;
          id: string;
          serializability: "table" | "document" | "wallclock";
        },
        number
      >;
      vacuumHistory: FunctionReference<
        "mutation",
        "internal",
        { minTsToKeep: number },
        any
      >;
    };
  };
  summaryExtractionsHistory: {
    lib: {
      listDocumentHistory: FunctionReference<
        "query",
        "internal",
        {
          id: string;
          maxTs: number;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            attribution: any;
            doc: any;
            id: string;
            isDeleted: boolean;
            ts: number;
          }>;
        }
      >;
      listHistory: FunctionReference<
        "query",
        "internal",
        {
          maxTs: number;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            attribution: any;
            doc: any;
            id: string;
            isDeleted: boolean;
            ts: number;
          }>;
        }
      >;
      listSnapshot: FunctionReference<
        "query",
        "internal",
        {
          currentTs: number;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          snapshotTs: number;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            attribution: any;
            doc: any;
            id: string;
            isDeleted: boolean;
            ts: number;
          }>;
          pageStatus?: "SplitRecommended";
          splitCursor?: string;
        }
      >;
      update: FunctionReference<
        "mutation",
        "internal",
        {
          attribution: any;
          doc: any | null;
          id: string;
          serializability: "table" | "document" | "wallclock";
        },
        number
      >;
      vacuumHistory: FunctionReference<
        "mutation",
        "internal",
        { minTsToKeep: number },
        any
      >;
    };
  };
  validatedDataHistory: {
    lib: {
      listDocumentHistory: FunctionReference<
        "query",
        "internal",
        {
          id: string;
          maxTs: number;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            attribution: any;
            doc: any;
            id: string;
            isDeleted: boolean;
            ts: number;
          }>;
        }
      >;
      listHistory: FunctionReference<
        "query",
        "internal",
        {
          maxTs: number;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            attribution: any;
            doc: any;
            id: string;
            isDeleted: boolean;
            ts: number;
          }>;
        }
      >;
      listSnapshot: FunctionReference<
        "query",
        "internal",
        {
          currentTs: number;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          snapshotTs: number;
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            attribution: any;
            doc: any;
            id: string;
            isDeleted: boolean;
            ts: number;
          }>;
          pageStatus?: "SplitRecommended";
          splitCursor?: string;
        }
      >;
      update: FunctionReference<
        "mutation",
        "internal",
        {
          attribution: any;
          doc: any | null;
          id: string;
          serializability: "table" | "document" | "wallclock";
        },
        number
      >;
      vacuumHistory: FunctionReference<
        "mutation",
        "internal",
        { minTsToKeep: number },
        any
      >;
    };
  };
};
