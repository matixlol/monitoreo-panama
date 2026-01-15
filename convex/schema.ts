import { defineSchema, defineTable } from 'convex/server';
import { authTables } from '@convex-dev/auth/server';
import { v } from 'convex/values';

// Base ingress row fields (shared between extraction and validated data)
const ingressRowBaseFields = {
  pageNumber: v.number(),
  fecha: v.optional(v.union(v.string(), v.null())),
  reciboNumero: v.optional(v.union(v.string(), v.null())),
  contribuyenteNombre: v.optional(v.union(v.string(), v.null())),
  representanteLegal: v.optional(v.union(v.string(), v.null())),
  cedulaRuc: v.optional(v.union(v.string(), v.null())),
  direccion: v.optional(v.union(v.string(), v.null())),
  telefono: v.optional(v.union(v.string(), v.null())),
  correoElectronico: v.optional(v.union(v.string(), v.null())),
  donacionesPrivadasEfectivo: v.optional(v.union(v.number(), v.null())),
  donacionesPrivadasChequeAch: v.optional(v.union(v.number(), v.null())),
  donacionesPrivadasEspecie: v.optional(v.union(v.number(), v.null())),
  recursosPropiosEfectivoCheque: v.optional(v.union(v.number(), v.null())),
  recursosPropiosEspecie: v.optional(v.union(v.number(), v.null())),
  total: v.optional(v.union(v.number(), v.null())),
};

// Base egress row fields (shared between extraction and validated data)
const egressRowBaseFields = {
  pageNumber: v.number(),
  fecha: v.optional(v.union(v.string(), v.null())),
  numeroFacturaRecibo: v.optional(v.union(v.string(), v.null())),
  cedulaRuc: v.optional(v.union(v.string(), v.null())),
  proveedorNombre: v.optional(v.union(v.string(), v.null())),
  detalleGasto: v.optional(v.union(v.string(), v.null())),
  pagoTipo: v.optional(v.union(v.literal('Efectivo'), v.literal('Especie'), v.literal('Cheque'), v.null())),
  movilizacion: v.optional(v.union(v.number(), v.null())),
  combustible: v.optional(v.union(v.number(), v.null())),
  hospedaje: v.optional(v.union(v.number(), v.null())),
  activistas: v.optional(v.union(v.number(), v.null())),
  caravanaConcentraciones: v.optional(v.union(v.number(), v.null())),
  comidaBrindis: v.optional(v.union(v.number(), v.null())),
  alquilerLocalServiciosBasicos: v.optional(v.union(v.number(), v.null())),
  cargosBancarios: v.optional(v.union(v.number(), v.null())),
  totalGastosCampania: v.optional(v.union(v.number(), v.null())),
  personalizacionArticulosPromocionales: v.optional(v.union(v.number(), v.null())),
  propagandaElectoral: v.optional(v.union(v.number(), v.null())),
  totalGastosPropaganda: v.optional(v.union(v.number(), v.null())),
  totalDeGastosDePropagandaYCampania: v.optional(v.union(v.number(), v.null())),
};

// Extraction row validators (with AI-detected unreadableFields)
const extractionIngressRowValidator = v.object({
  ...ingressRowBaseFields,
  unreadableFields: v.optional(v.array(v.string())),
});

const extractionEgressRowValidator = v.object({
  ...egressRowBaseFields,
  unreadableFields: v.optional(v.array(v.string())),
});

// Validated row validators (with human-marked humanUnreadableFields)
const validatedIngressRowValidator = v.object({
  ...ingressRowBaseFields,
  // Fields marked as unreadable/illegible by human validators
  humanUnreadableFields: v.optional(v.array(v.string())),
});

const validatedEgressRowValidator = v.object({
  ...egressRowBaseFields,
  // Fields marked as unreadable/illegible by human validators
  humanUnreadableFields: v.optional(v.array(v.string())),
});

export default defineSchema({
  // Convex Auth tables
  ...authTables,

  // PDF documents metadata
  documents: defineTable({
    fileId: v.id('_storage'),
    name: v.string(),
    pageCount: v.number(),
    status: v.union(v.literal('pending'), v.literal('processing'), v.literal('completed'), v.literal('failed')),
    errorMessage: v.optional(v.string()),
    // Page rotations stored as page number -> degrees (0, 90, 180, 270)
    pageRotations: v.optional(v.record(v.string(), v.number())),
    // Timestamp when processing started (for detecting stuck items)
    processingStartedAt: v.optional(v.number()),
  }).index('by_status', ['status']),

  // Raw extraction results from each model (with AI-detected unreadableFields)
  extractions: defineTable({
    documentId: v.id('documents'),
    model: v.string(), // e.g., "gemini-2.0-flash", "gemini-3-flash"
    ingress: v.array(extractionIngressRowValidator),
    egress: v.array(extractionEgressRowValidator),
    completedAt: v.number(),
  }).index('by_document', ['documentId']),

  // User-validated final data (with human-marked humanUnreadableFields)
  validatedData: defineTable({
    documentId: v.id('documents'),
    ingress: v.array(validatedIngressRowValidator),
    egress: v.array(validatedEgressRowValidator),
    validatedAt: v.number(),
  }).index('by_document', ['documentId']),
});

// Export validators for use in other files
export {
  extractionIngressRowValidator,
  extractionEgressRowValidator,
  validatedIngressRowValidator,
  validatedEgressRowValidator,
};
