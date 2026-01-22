import { v } from 'convex/values';
import {
  extractionIngressRowValidator,
  extractionEgressRowValidator,
  validatedIngressRowValidator,
  validatedEgressRowValidator,
} from './schema';
import { authMutation, authQuery } from './lib/withAuth';

/**
 * Get the latest Gemini 3 extraction for a document
 */
export const getGemini3Extraction = authQuery({
  args: {
    documentId: v.id('documents'),
  },
  returns: v.union(
    v.object({
      _id: v.id('extractions'),
      _creationTime: v.number(),
      documentId: v.id('documents'),
      model: v.string(),
      ingress: v.array(extractionIngressRowValidator),
      egress: v.array(extractionEgressRowValidator),
      completedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const extractions = await ctx.db
      .query('extractions')
      .withIndex('by_document', (q) => q.eq('documentId', args.documentId))
      .collect();

    const gemini3 = extractions
      .filter((e) => e.model.startsWith('gemini-3'))
      .sort((a, b) => b.completedAt - a.completedAt)[0];

    return gemini3 ?? null;
  },
});

/**
 * Get validated data for a document
 */
export const getValidatedData = authQuery({
  args: {
    documentId: v.id('documents'),
  },
  returns: v.union(
    v.object({
      _id: v.id('validatedData'),
      _creationTime: v.number(),
      documentId: v.id('documents'),
      ingress: v.array(validatedIngressRowValidator),
      egress: v.array(validatedEgressRowValidator),
      validatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('validatedData')
      .withIndex('by_document', (q) => q.eq('documentId', args.documentId))
      .unique();
  },
});

/**
 * Save validated data for a document
 */
export const saveValidatedData = authMutation({
  args: {
    documentId: v.id('documents'),
    ingress: v.array(validatedIngressRowValidator),
    egress: v.array(validatedEgressRowValidator),
  },
  returns: v.id('validatedData'),
  handler: async (ctx, args) => {
    // Check if validated data already exists
    const existing = await ctx.db
      .query('validatedData')
      .withIndex('by_document', (q) => q.eq('documentId', args.documentId))
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
    return await ctx.db.insert('validatedData', {
      documentId: args.documentId,
      ingress: args.ingress,
      egress: args.egress,
      validatedAt: Date.now(),
    });
  },
});

// Base types for rows (shared fields)
type IngressRowBase = {
  pageNumber: number;
  fecha?: string | null;
  reciboNumero?: string | null;
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

type EgressRowBase = {
  pageNumber: number;
  fecha?: string | null;
  numeroFacturaRecibo?: string | null;
  cedulaRuc?: string | null;
  proveedorNombre?: string | null;
  detalleGasto?: string | null;
  pagoTipo?: 'Efectivo' | 'Especie' | 'Cheque' | null;
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

// Extraction row types (with AI-detected unreadableFields)
export type ExtractionIngressRow = IngressRowBase & {
  unreadableFields?: string[];
};

export type ExtractionEgressRow = EgressRowBase & {
  unreadableFields?: string[];
};

// Validated row types (with human-marked humanUnreadableFields)
export type ValidatedIngressRow = IngressRowBase & {
  humanUnreadableFields?: string[];
};

export type ValidatedEgressRow = EgressRowBase & {
  humanUnreadableFields?: string[];
};

// Legacy aliases for backward compatibility
export type IngressRow = ValidatedIngressRow;
export type EgressRow = ValidatedEgressRow;
