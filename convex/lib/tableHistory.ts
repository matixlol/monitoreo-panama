import { TableHistory } from "convex-table-history";
import type { GenericMutationCtx } from "convex/server";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";

export const documentsHistory = new TableHistory<DataModel, "documents">(components.documentsHistory, {
  serializability: "document",
});

export const extractionsHistory = new TableHistory<DataModel, "extractions">(components.extractionsHistory, {
  serializability: "document",
});

export const summaryExtractionsHistory = new TableHistory<DataModel, "summaryExtractions">(
  components.summaryExtractionsHistory,
  { serializability: "document" },
);

export const validatedDataHistory = new TableHistory<DataModel, "validatedData">(components.validatedDataHistory, {
  serializability: "document",
});

export async function historyAttribution(
  // Keep this generic: both `mutation` and `customMutation` ctx shapes work.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  mutationName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra?: Record<string, any>,
) {
  // Prefer the `withAuth` custom ctx `user` when present.
  let actorIdentity: unknown = ctx?.user ?? null;

  if (actorIdentity == null && ctx?.auth && typeof ctx.auth.getUserIdentity === "function") {
    try {
      actorIdentity = await ctx.auth.getUserIdentity();
    } catch {
      actorIdentity = null;
    }
  }

  return {
    mutationName,
    actorIdentity,
    ...(extra ?? {}),
  };
}

// This file is used inside mutations, so we only ever need the mutation ctx surface.
export type TableHistoryCtx = Pick<GenericMutationCtx<DataModel>, "runMutation"> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auth?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user?: any;
};

