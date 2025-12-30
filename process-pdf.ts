import { readFile } from "fs/promises";
import { existsSync } from "fs";
import z from "zod";
import { generateObject } from "ai";
import { PDFDocument } from "pdf-lib";
import pMap from "p-map";
import { openrouter } from "@openrouter/ai-sdk-provider";

const cedulaRuc = z
  .string()
  .nullish()
  .transform((a) => (a === "null" ? null : a));

export const IngresoRowSchema = z.object({
  fecha: z.string().nullish(),
  reciboNumero: z.string(),
  contribuyenteNombre: z.string().nullish(),
  representanteLegal: z.string().nullish(),
  cedulaRuc,
  direccion: z.string().nullish(),
  telefono: z.string().nullish(),
  correoElectronico: z.string().nullish(),
  donacionesPrivadasEfectivo: z.number().nullish(),
  donacionesPrivadasChequeAch: z.number().nullish(),
  donacionesPrivadasEspecie: z.number().nullish(),
  recursosPropiosEfectivoCheque: z.number().nullish(),
  recursosPropiosEspecie: z.number().nullish(),
  total: z.number().nullish(),
});

export const EgresoRowSchema = z.object({
  fecha: z.string().nullish(),
  numeroFacturaRecibo: z.string(),
  cedulaRuc,
  proveedorNombre: z.string().nullish(),
  detalleGasto: z.string().nullish(),
  pagoTipo: z.enum(["Efectivo", "Especie", "Cheque"]).nullish().catch(null),
  movilizacion: z.number().nullish(),
  combustible: z.number().nullish(),
  hospedaje: z.number().nullish(),
  activistas: z.number().nullish(),
  caravanaConcentraciones: z.number().nullish(),
  comidaBrindis: z.number().nullish(),
  alquilerLocalServiciosBasicos: z.number().nullish(),
  cargosBancarios: z.number().nullish(),
  totalGastosCampania: z.number().nullish(),
  personalizacionArticulosPromocionales: z.number().nullish(),
  propagandaElectoral: z.number().nullish(),
  totalGastosPropaganda: z.number().nullish(),
  totalDeGastosDePropagandaYCampania: z.number().nullish(),
});

export const ResponseSchema = z.object({
  ingress: z.array(IngresoRowSchema),
  egress: z.array(EgresoRowSchema),
});

export type IngresoRow = z.infer<typeof IngresoRowSchema>;
export type EgresoRow = z.infer<typeof EgresoRowSchema>;
export type ExtractedData = z.infer<typeof ResponseSchema>;

export interface ExtractionResult {
  data: ExtractedData;
}

export async function extractDataFromPDF(
  pdfPath: string
): Promise<ExtractionResult> {
  if (!existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  const pdfBuffer = await readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const totalPages = pdfDoc.getPageCount();
  const BATCH_SIZE = 8;

  console.log(
    `[Batching] Total pages: ${totalPages}. Processing in batches of ${BATCH_SIZE}.`
  );

  const accumulatedData: ExtractedData = {
    ingress: [],
    egress: [],
  };

  const batches: number[][] = [];
  for (let i = 0; i < totalPages; i += BATCH_SIZE) {
    const batch = [];
    for (let j = i; j < Math.min(i + BATCH_SIZE, totalPages); j++) {
      batch.push(j);
    }
    batches.push(batch);
  }

  const processBatch = async (pageIndices: number[], batchIndex: number) => {
    console.log(
      `[Batch ${batchIndex + 1}/${batches.length}] Processing pages ${
        pageIndices[0] + 1
      }-${pageIndices[pageIndices.length - 1] + 1}...`
    );

    // Create a new PDF with just the batch pages
    const subPdfDoc = await PDFDocument.create();
    const copiedPages = await subPdfDoc.copyPages(pdfDoc, pageIndices);
    copiedPages.forEach((page) => subPdfDoc.addPage(page));
    const subPdfBytes = await subPdfDoc.save();

    const { object, usage } = await generateObject({
      model: openrouter.chat("google/gemini-3-flash-preview", {
        provider: {
          order: ["google-ai-studio"],
          allow_fallbacks: true,
        },
      }),
      temperature: 0,
      schema: ResponseSchema,
      messages: [
        {
          role: "user" as const,
          content: [
            {
              type: "text",
              text: `This PDF segment contains financial reports from Panama's Electoral Tribunal (Tribunal Electoral).

Extract rows from "INFORME DE INGRESOS" and "INFORME DE GASTOS" tables. Don't extract the table if it doesn't look like the one described below. If a cell is empty, just return a literal \`null\`.

"INFORME DE INGRESOS" (Formulario Pre-17) columns:
1. Fecha, 2. Recibo No., 3. Nombre del Contribuyente, 4. Representante Legal, 5. Cédula/RUC, 6. Dirección, 7. Teléfono, 8. Correo Electrónico, 9. Donaciones Privadas - Efectivo, 10. Donaciones Privadas - Cheque/ACH, 11. Donaciones Privadas - Especie, 12. Recursos Propios - Efectivo/Cheque, 13. Recursos Propios - Especie, 14. TOTAL

"INFORME DE GASTOS" (Formulario Pre-18/Pre-8) columns:
1. Fecha, 2. No. de Factura/Recibo, 3. Cédula/RUC, 4. Nombre del Proveedor, 5. Detalle del Gasto, 6. Pago en Efectivo, Especie o Cheque, 7. Movilización, 8. Combustible, 9. Hospedaje, 10. Activistas, 11. Caravana y concentraciones, 12. Comida y Brindis, 13. Alquiler de Local / servicios básicos, 14. Cargos Bancarios, 15. Total de Gastos de Campaña (totalGastosCampania), 16. Personalización de artículos promocionales, 17. Propaganda Electoral, 18. Total de Gastos de Propaganda (totalGastosPropaganda), 19. Total de Gastos de Propaganda y Campaña (totalDeGastosDePropagandaYCampania)

Do not confuse Total de Gastos de Campaña (totalGastosCampania) with Total de Gastos de Propaganda y Campaña (totalDeGastosDePropagandaYCampania)`,
            },
            {
              type: "file" as const,
              data: subPdfBytes,
              mediaType: "application/pdf",
            },
          ],
        },
      ],
    });

    console.log(
      `[Batch ${batchIndex + 1}] Extracted ${
        object.ingress.length
      } ingress and ${object.egress.length} egress rows.`
    );
    return { object, usage };
  };

  const results = await pMap(
    batches,
    (batch, index) => processBatch(batch, index),
    {
      concurrency: 20,
    }
  );

  for (const result of results) {
    accumulatedData.ingress.push(...result.object.ingress);
    accumulatedData.egress.push(...result.object.egress);
  }

  return {
    data: accumulatedData,
  };
}

async function processPDF(pdfPath: string): Promise<void> {
  console.log(`Reading PDF: ${pdfPath}`);
  console.log("Sending PDF to Gemini...");

  try {
    const { data } = await extractDataFromPDF(pdfPath);

    // Also save to files
    if (data.ingress && Array.isArray(data.ingress)) {
      await Bun.write("ingress.json", JSON.stringify(data.ingress, null, 2));
      console.log(
        `\n✓ Saved ${data.ingress.length} ingress records to ingress.json`
      );
    }

    if (data.egress && Array.isArray(data.egress)) {
      await Bun.write("egress.json", JSON.stringify(data.egress, null, 2));
      console.log(
        `\n✓ Saved ${data.egress.length} egress records to egress.json`
      );
    }

    console.log("\n=== SUMMARY ===");
    console.log(`Ingress records: ${data.ingress?.length || 0}`);
    console.log(`Egress records: ${data.egress?.length || 0}`);
  } catch (error) {
    console.error("Error processing PDF:", error);
    process.exit(1);
  }
}

// Main execution - only run when executed directly
if (import.meta.main) {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    console.error("Usage: bun run process-pdf.ts <path-to-pdf>");
    console.error("Example: bun run process-pdf.ts document.pdf");
    process.exit(1);
  }

  await processPDF(pdfPath);
}
