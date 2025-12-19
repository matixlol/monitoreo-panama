import { readFile } from "fs/promises";
import { existsSync } from "fs";
import z from "zod";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const getOpenRouterHeaders = (
  includeContentType = false
): Record<string, string> => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    "HTTP-Referer": "https://github.com/matixlol/monitoreo-panama",
    "X-Title": "Monitoreo Panama",
  };
  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
};

async function fetchOrThrow(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `API request failed with status ${response.status}: ${errorText}`
    );
  }
  return response;
}

export const IngresoRowSchema = z.object({
  fecha: z.string().nullish(),
  reciboNumero: z.string(),
  contribuyenteNombre: z.string().nullish(),
  representanteLegal: z.string().nullish(),
  cedulaRuc: z.string().nullish(),
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
  // INFORME DE GASTOS / EGRESOS (Formulario Pre-18)
  fecha: z.string().nullish(),
  numeroFacturaRecibo: z.string(),
  cedulaRuc: z.string().nullish(),
  proveedorNombre: z.string().nullish(),
  detalleGasto: z.string().nullish(),
  // This column is a label like: "Efectivo", "Especie", "Cheque", etc.
  pagoTipo: z.enum(["Efectivo", "Especie", "Cheque"]).nullish(),

  // Otros Gastos de Campaña
  movilizacion: z.coerce.number().nullish(),
  combustible: z.coerce.number().nullish(),
  hospedaje: z.coerce.number().nullish(),
  activistas: z.coerce.number().nullish(),
  caravanaConcentraciones: z.coerce.number().nullish(),
  comidaBrindis: z.coerce.number().nullish(),
  alquilerLocalServiciosBasicos: z.coerce.number().nullish(),
  cargosBancarios: z.coerce.number().nullish(),
  totalGastosCampania: z.coerce.number().nullish(),

  // Gastos de Propaganda
  personalizacionArticulosPromocionales: z.coerce.number().nullish(),
  propagandaElectoral: z.coerce.number().nullish(),
  totalGastosPropaganda: z.coerce.number().nullish(),

  // Total General (right-most column)
  totalGeneral: z.coerce.number().nullish(),
});

export const ResponseSchema = z.object({
  ingress: z.array(IngresoRowSchema),
  egress: z.array(EgresoRowSchema),
});
const jsonSchema = z.toJSONSchema(ResponseSchema);

export type IngresoRow = z.infer<typeof IngresoRowSchema>;
export type EgresoRow = z.infer<typeof EgresoRowSchema>;
export type ExtractedData = z.infer<typeof ResponseSchema>;

export interface ExtractionResult {
  data: ExtractedData;
  cost: number | null; // Cost in USD
}

async function encodePDFToBase64(pdfPath: string): Promise<string> {
  const pdfBuffer = await readFile(pdfPath);
  const base64PDF = pdfBuffer.toString("base64");
  return `data:application/pdf;base64,${base64PDF}`;
}

async function getGenerationCost(generationId: string): Promise<number | null> {
  try {
    const response = await fetchOrThrow(
      `https://openrouter.ai/api/v1/generation?id=${generationId}`,
      { headers: getOpenRouterHeaders() }
    );

    const stats = await response.json();
    return stats.total_cost ?? null;
  } catch (error) {
    console.warn("Failed to fetch generation cost:", error);
    return null;
  }
}

export async function extractDataFromPDF(
  pdfPath: string
): Promise<ExtractionResult> {
  if (!existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  const base64PDF = await encodePDFToBase64(pdfPath);
  const filename = pdfPath.split("/").pop();

  const prompt = `This PDF contains financial reports from Panama's Electoral Tribunal (Tribunal Electoral).

Look for tables titled "INFORME DE INGRESOS" (income report) and "INFORME DE GASTOS" (expense report). These tables contain MULTIPLE ROWS - extract EACH ROW as a separate record. Do NOT extract summary totals for the whole table. 

The table may span across multiple pages. Process the entire table, not just the first page.

The "INFORME DE INGRESOS" table (Formulario Pre-17) has these columns in order (left to right):
1. Fecha
2. Recibo No.
3. Nombre del Contribuyente
4. Representante Legal
5. Cédula/RUC
6. Dirección
7. Teléfono
8. Correo Electrónico
9. Donaciones Privadas - Efectivo (column 9)
10. Donaciones Privadas - Cheque/ACH (column 10)
11. Donaciones Privadas - Especie (column 11)
12. Recursos Propios - Efectivo/Cheque (column 12)
13. Recursos Propios - Especie (column 13)
14. TOTAL

The "INFORME DE GASTOS" table (Formulario Pre-18) has these columns in order (left to right):
1. Fecha
2. No. de Factura/Recibo
3. Cédula/RUC
4. Nombre del Proveedor
5. Detalle del Gasto
6. Pago en Efectivo, Especie o Cheque (a label, NOT an amount)
7. Movilización
8. Combustible
9. Hospedaje
10. Activistas
11. Caravana y concentraciones
12. Comida y Brindis
13. Alquiler de Local / servicios básicos
14. Cargos Bancarios
15. Total de Otros Gastos
16. Personalización de artículos promocionales
17. Propaganda Electoral
18. Total de Gastos de Propaganda
19. Total General

Extract every row from these tables. Return a minified JSON object:
{
  "ingress": [...],  // One object per row in INFORME DE INGRESOS
  "egress": [...]    // One object per row in INFORME DE GASTOS
}
  
Here's the full JSON schema for the response:
${JSON.stringify(jsonSchema)}`;

  const response = await fetchOrThrow(OPENROUTER_API_URL, {
    method: "POST",
    headers: getOpenRouterHeaders(true),
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that extracts financial data from PDFs in JSON format.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "file",
              file: {
                filename: filename,
                file_data: base64PDF,
              },
            },
          ],
        },
      ],
      plugins: [
        { id: "response-healing" },
        {
          id: "file-parser",
          pdf: {
            engine: "native",
          },
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: jsonSchema,
      },
    }),
  });

  const data = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error(`No response from API: ${JSON.stringify(data, null, 2)}`);
  }

  let content = data.choices[0].message.content.trim();
  if (content.startsWith("```json")) content = content.substring(7).trim();
  if (content.endsWith("```"))
    content = content.substring(0, content.length - 3).trim();

  const cost = data.id ? await getGenerationCost(data.id) : null;

  return {
    data: ResponseSchema.parse(JSON.parse(content)),
    cost,
  };
}

async function processPDF(pdfPath: string): Promise<void> {
  console.log(`Reading PDF: ${pdfPath}`);
  console.log("Sending PDF to OpenRouter...");

  try {
    const { data, cost } = await extractDataFromPDF(pdfPath);

    // Output the result
    console.log("\n=== EXTRACTED DATA ===\n");
    console.log(JSON.stringify(data, null, 2));

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
    if (cost !== null) {
      console.log(`Cost: $${cost.toFixed(6)}`);
    }
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
