import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ingressRowValidator, egressRowValidator } from "./schema";

/**
 * Get all extractions for a document
 */
export const getExtractions = query({
  args: {
    documentId: v.id("documents"),
  },
  returns: v.array(
    v.object({
      _id: v.id("extractions"),
      _creationTime: v.number(),
      documentId: v.id("documents"),
      model: v.string(),
      ingress: v.array(ingressRowValidator),
      egress: v.array(egressRowValidator),
      completedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("extractions")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
  },
});

/**
 * Get validated data for a document
 */
export const getValidatedData = query({
  args: {
    documentId: v.id("documents"),
  },
  returns: v.union(
    v.object({
      _id: v.id("validatedData"),
      _creationTime: v.number(),
      documentId: v.id("documents"),
      ingress: v.array(ingressRowValidator),
      egress: v.array(egressRowValidator),
      validatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("validatedData")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .unique();
  },
});

/**
 * Save validated data for a document
 */
export const saveValidatedData = mutation({
  args: {
    documentId: v.id("documents"),
    ingress: v.array(ingressRowValidator),
    egress: v.array(egressRowValidator),
  },
  returns: v.id("validatedData"),
  handler: async (ctx, args) => {
    // Check if validated data already exists
    const existing = await ctx.db
      .query("validatedData")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .unique();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        ingress: args.ingress,
        egress: args.egress,
        validatedAt: Date.now(),
      });
      return existing._id;
    }

    // Create new record
    return await ctx.db.insert("validatedData", {
      documentId: args.documentId,
      ingress: args.ingress,
      egress: args.egress,
      validatedAt: Date.now(),
    });
  },
});

// Types for diff computation (used client-side)
export type IngressRow = {
  pageNumber: number;
  fecha?: string | null;
  reciboNumero: string;
  contribuyenteNombre?: string | null;
  representanteLegal?: string | null;
  cedulaRuc?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  correoElectronico?: string | null;
  donacionesPrivadasEfectivo?: number | null;
  donacionesPrivadasChequeAch?: number | null;
  donacionesPrivadasEspecie?: number | null;
  recursosPropiosEfectivoCheque?: number | null;
  recursosPropiosEspecie?: number | null;
  total?: number | null;
};

export type EgressRow = {
  pageNumber: number;
  fecha?: string | null;
  numeroFacturaRecibo: string;
  cedulaRuc?: string | null;
  proveedorNombre?: string | null;
  detalleGasto?: string | null;
  pagoTipo?: "Efectivo" | "Especie" | "Cheque" | null;
  movilizacion?: number | null;
  combustible?: number | null;
  hospedaje?: number | null;
  activistas?: number | null;
  caravanaConcentraciones?: number | null;
  comidaBrindis?: number | null;
  alquilerLocalServiciosBasicos?: number | null;
  cargosBancarios?: number | null;
  totalGastosCampania?: number | null;
  personalizacionArticulosPromocionales?: number | null;
  propagandaElectoral?: number | null;
  totalGastosPropaganda?: number | null;
  totalDeGastosDePropagandaYCampania?: number | null;
};

