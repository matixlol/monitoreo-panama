import { readFile } from "fs/promises";
import { existsSync } from "fs";
import z from "zod";
import { nanoid } from "nanoid";
import { generateObject } from "ai";
import { PDFDocument } from "pdf-lib";
import pMap from "p-map";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { writeFile } from "fs/promises";

export const MODEL_NAME = "gpt-5-mini";
export const OPENROUTER_MODEL = openrouter.chat("openai/gpt-5-mini");

// export const OPENROUTER_MODEL = openrouter.chat("google/gemini-3-flash-preview", {
//   provider: {
//     order: ["google-ai-studio"],
//     allow_fallbacks: true,
//   },
// });

const cedulaRuc = z
  .string()
  .nullable()
  .transform((a) => (a === "null" ? null : a));

export const IngresoRowSchema = z.object({
  fecha: z.string().nullable(),
  reciboNumero: z.string(),
  contribuyenteNombre: z.string().nullable(),
  representanteLegal: z.string().nullable(),
  cedulaRuc,
  direccion: z.string().nullable(),
  telefono: z.string().nullable(),
  correoElectronico: z.string().nullable(),
  donacionesPrivadasEfectivo: z.number().nullable(),
  donacionesPrivadasChequeAch: z.number().nullable(),
  donacionesPrivadasEspecie: z.number().nullable(),
  recursosPropiosEfectivoCheque: z.number().nullable(),
  recursosPropiosEspecie: z.number().nullable(),
  total: z.number().nullable(),
});

export const EgresoRowSchema = z.object({
  fecha: z.string().nullable(),
  numeroFacturaRecibo: z.string(),
  cedulaRuc,
  proveedorNombre: z.string().nullable(),
  detalleGasto: z.string().nullable(),
  pagoTipo: z.enum(["Efectivo", "Especie", "Cheque"]).nullable().catch(null),
  movilizacion: z.number().nullable(),
  combustible: z.number().nullable(),
  hospedaje: z.number().nullable(),
  activistas: z.number().nullable(),
  caravanaConcentraciones: z.number().nullable(),
  comidaBrindis: z.number().nullable(),
  alquilerLocalServiciosBasicos: z.number().nullable(),
  cargosBancarios: z.number().nullable(),
  totalGastosCampania: z.number().nullable(),
  personalizacionArticulosPromocionales: z.number().nullable(),
  propagandaElectoral: z.number().nullable(),
  totalGastosPropaganda: z.number().nullable(),
  totalDeGastosDePropagandaYCampania: z.number().nullable(),
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

interface BatchResult {
  object: ExtractedData;
  usage?: unknown;
}

type BatchProcessor = (
  pdfBytes: Uint8Array,
  pageIndices: number[],
  batchIndex: number,
  totalBatches: number
) => Promise<BatchResult>;

export const BATCH_SIZE = 8;

export const EXTRACTION_PROMPT = `This PDF segment contains financial reports from Panama's Electoral Tribunal (Tribunal Electoral).

Extract rows from "INFORME DE INGRESOS" and "INFORME DE GASTOS" tables. Don't extract the table if it doesn't look like the one described below. If a cell is empty, just return a literal \`null\`.

"INFORME DE INGRESOS" (Formulario Pre-17/Pre-7) columns:
1. Fecha, 2. Recibo No., 3. Nombre del Contribuyente, 4. Representante Legal, 5. Cédula/RUC, 6. Dirección, 7. Teléfono, 8. Correo Electrónico, 9. Donaciones Privadas - Efectivo, 10. Donaciones Privadas - Cheque/ACH, 11. Donaciones Privadas - Especie, 12. Recursos Propios - Efectivo/Cheque, 13. Recursos Propios - Especie, 14. TOTAL

"INFORME DE GASTOS" (Formulario Pre-18/Pre-8) columns:
1. Fecha, 2. No. de Factura/Recibo, 3. Cédula/RUC, 4. Nombre del Proveedor, 5. Detalle del Gasto, 6. Pago en Efectivo, Especie o Cheque, 7. Movilización, 8. Combustible, 9. Hospedaje, 10. Activistas, 11. Caravana y concentraciones, 12. Comida y Brindis, 13. Alquiler de Local / servicios básicos, 14. Cargos Bancarios, 15. Total de Gastos de Campaña (totalGastosCampania), 16. Personalización de artículos promocionales, 17. Propaganda Electoral, 18. Total de Gastos de Propaganda (totalGastosPropaganda), 19. Total de Gastos de Propaganda y Campaña (totalDeGastosDePropagandaYCampania)

Do not confuse Total de Gastos de Campaña (totalGastosCampania) with Total de Gastos de Propaganda y Campaña (totalDeGastosDePropagandaYCampania). Read each cell as-is, don't try to guess the value if it's not clear.`;

export interface PdfChunk {
  pdfBytes: Uint8Array;
  pageIndices: number[];
  batchIndex: number;
  totalBatches: number;
}

/**
 * Split a PDF into chunks of BATCH_SIZE pages each
 * Returns an array of PDF chunks with their metadata
 */
export async function splitPdfIntoChunks(
  pdfBuffer: Buffer | Uint8Array,
  batchSize: number = BATCH_SIZE
): Promise<PdfChunk[]> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const totalPages = pdfDoc.getPageCount();

  const batches: number[][] = [];
  for (let i = 0; i < totalPages; i += batchSize) {
    const batch: number[] = [];
    for (let j = i; j < Math.min(i + batchSize, totalPages); j++) {
      batch.push(j);
    }
    batches.push(batch);
  }

  const chunks: PdfChunk[] = [];
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const pageIndices = batches[batchIndex]!;
    const subPdfDoc = await PDFDocument.create();
    const copiedPages = await subPdfDoc.copyPages(pdfDoc, pageIndices);
    for (const page of copiedPages) {
      subPdfDoc.addPage(page);
    }
    const pdfBytes = await subPdfDoc.save();

    chunks.push({
      pdfBytes,
      pageIndices: pageIndices,
      batchIndex,
      totalBatches: batches.length,
    });
  }

  return chunks;
}

/**
 * Process a batch using OpenRouter API (via AI SDK)
 * Note: OpenRouter doesn't support media_resolution passthrough to Google
 */
const processWithOpenRouter: BatchProcessor = async (
  pdfBytes,
  pageIndices,
  batchIndex,
  totalBatches
) => {
  console.log(
    `[Batch ${batchIndex + 1}/${totalBatches}] Processing pages ${
      pageIndices[0]! + 1
    }-${pageIndices[pageIndices.length - 1]! + 1} via OpenRouter...`
  );

  const { object, usage } = await generateObject({
    model: OPENROUTER_MODEL,
    temperature: 0,
    schema: ResponseSchema,
    providerOptions: {
      openrouter: {
        generation_config: {
          media_resolution: "MEDIA_RESOLUTION_HIGH",
        },
      },
    },
    messages: [
      {
        role: "user" as const,
        content: [
          { type: "text", text: EXTRACTION_PROMPT },
          {
            type: "file" as const,
            data: pdfBytes,
            mediaType: "application/pdf",
          },
        ],
      },
    ],
  });

  console.log(
    `[Batch ${batchIndex + 1}] Extracted ${object.ingress.length} ingress and ${
      object.egress.length
    } egress rows.`
  );

  return { object, usage };
};

/**
 * Process a batch using Google AI Studio API directly
 * Supports media_resolution for better PDF quality
 */
const processWithGemini: BatchProcessor = async (
  pdfBytes,
  pageIndices,
  batchIndex,
  totalBatches
) => {
  console.log(
    `[Batch ${batchIndex + 1}/${totalBatches}] Processing pages ${
      pageIndices[0]! + 1
    }-${pageIndices[pageIndices.length - 1]! + 1} via Gemini...`
  );

  const pdfBase64 = Buffer.from(pdfBytes).toString("base64");
  const jsonSchema = z.toJSONSchema(ResponseSchema, { unrepresentable: "any" });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // @ts-ignore
      timeout: false,
      signal: AbortSignal.timeout(1000 * 60 * 15),
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: EXTRACTION_PROMPT },
              {
                inline_data: { mime_type: "application/pdf", data: pdfBase64 },
              },
            ],
          },
        ],
        generationConfig: {
          mediaResolution: "MEDIA_RESOLUTION_HIGH",
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const result = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: unknown;
  };
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No response from Gemini API");
  }

  const id = nanoid();
  await writeFile(`/tmp/gemini-${id}.json`, text);
  try {
    const parsed = JSON.parse(text);
    const object = ResponseSchema.parse(parsed);

    console.log(
      `[Batch ${batchIndex + 1}] Extracted ${
        object.ingress.length
      } ingress and ${object.egress.length} egress rows.`
    );

    return { object, usage: result.usageMetadata };
  } catch (error) {
    console.error(`Error parsing JSON: ${error}`);
    console.error(`Check output at /tmp/gemini-${id}.json`);
    throw error;
  }
};

export async function extractDataFromPDF(
  pdfPath: string
): Promise<ExtractionResult> {
  if (!existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  const pdfBuffer = await readFile(pdfPath);
  const chunks = await splitPdfIntoChunks(pdfBuffer);

  console.log(
    `[Batching] Processing ${chunks.length} batches of up to ${BATCH_SIZE} pages each.`
  );

  const accumulatedData: ExtractedData = {
    ingress: [],
    egress: [],
  };

  const processor: BatchProcessor = processWithOpenRouter;

  const results = await pMap(
    chunks,
    (chunk) =>
      processor(
        chunk.pdfBytes,
        chunk.pageIndices,
        chunk.batchIndex,
        chunk.totalBatches
      ),
    { concurrency: 20 }
  );

  for (const result of results) {
    accumulatedData.ingress.push(...result.object.ingress);
    accumulatedData.egress.push(...result.object.egress);
  }

  return { data: accumulatedData };
}

async function processPDF(pdfPath: string): Promise<void> {
  console.log(`Reading PDF: ${pdfPath}`);
  console.log("Sending PDF to Gemini...");

  try {
    const { data } = await extractDataFromPDF(pdfPath);

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

if (import.meta.main) {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("Usage: bun run process-pdf.ts <path-to-pdf>");
    console.error("Example: bun run process-pdf.ts document.pdf");
    process.exit(1);
  }
  await processPDF(pdfPath);
}
