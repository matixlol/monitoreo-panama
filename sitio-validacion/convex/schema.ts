import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

// Ingress row validator (matching IngresoRowSchema from process-pdf.ts)
const ingressRowValidator = v.object({
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
});

// Egress row validator (matching EgresoRowSchema from process-pdf.ts)
const egressRowValidator = v.object({
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
});

export default defineSchema({
  // Legacy table from template
  numbers: defineTable({
    value: v.number(),
  }),

  // PDF documents metadata
  documents: defineTable({
    fileId: v.id('_storage'),
    name: v.string(),
    pageCount: v.number(),
    status: v.union(v.literal('pending'), v.literal('processing'), v.literal('completed'), v.literal('failed')),
    errorMessage: v.optional(v.string()),
    // Page rotations stored as page number -> degrees (0, 90, 180, 270)
    pageRotations: v.optional(v.record(v.string(), v.number())),
  }),

  // Raw extraction results from each model
  extractions: defineTable({
    documentId: v.id('documents'),
    model: v.string(), // e.g., "gemini-2.0-flash", "gemini-3-flash"
    ingress: v.array(ingressRowValidator),
    egress: v.array(egressRowValidator),
    completedAt: v.number(),
  }).index('by_document', ['documentId']),

  // User-validated final data
  validatedData: defineTable({
    documentId: v.id('documents'),
    ingress: v.array(ingressRowValidator),
    egress: v.array(egressRowValidator),
    validatedAt: v.number(),
  }).index('by_document', ['documentId']),
});

// Export validators for use in other files
export { ingressRowValidator, egressRowValidator };
