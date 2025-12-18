import { readFile } from "fs/promises";
import { existsSync } from "fs";
import z from "zod";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

if (!OPENROUTER_API_KEY) {
  console.error("Error: OPENROUTER_API_KEY environment variable is not set");
  process.exit(1);
}

const IngresoRowSchema = z.object({
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

const EgresoRowSchema = z.object({
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
  totalOtrosGastos: z.coerce.number().nullish(),

  // Gastos de Propaganda
  personalizacionArticulosPromocionales: z.coerce.number().nullish(),
  propagandaElectoral: z.coerce.number().nullish(),
  totalGastosPropaganda: z.coerce.number().nullish(),

  // Total General (right-most column)
  totalGeneral: z.coerce.number().nullish(),
});

const ResponseSchema = z.object({
  ingress: z.array(IngresoRowSchema),
  egress: z.array(EgresoRowSchema),
});
const jsonSchema = z.toJSONSchema(ResponseSchema);

async function encodePDFToBase64(pdfPath: string): Promise<string> {
  const pdfBuffer = await readFile(pdfPath);
  const base64PDF = pdfBuffer.toString("base64");
  return `data:application/pdf;base64,${base64PDF}`;
}

async function processPDF(pdfPath: string): Promise<void> {
  if (!existsSync(pdfPath)) {
    throw new Error(`Error: PDF file not found: ${pdfPath}`);
  }
  console.log(`Reading PDF: ${pdfPath}`);
  const base64PDF = await encodePDFToBase64(pdfPath);
  const filename = pdfPath.split("/").pop();

  console.log("Sending PDF to OpenRouter...");

  const prompt = `This PDF contains financial reports from Panama's Electoral Tribunal (Tribunal Electoral).

IMPORTANT: Look for tables titled "INFORME DE INGRESOS" (income report) and "INFORME DE EGRESOS" or "GASTOS" (expense report). These tables contain MULTIPLE ROWS - extract EACH ROW as a separate record. Do NOT just extract summary totals.

The "INFORME DE INGRESOS" table has these columns in order (left to right):
1. Fecha
2. Recibo No,
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

CRITICAL: For each row, check WHICH COLUMN contains the monetary amount. The amount could be in:
- Column 9 (Donaciones Privadas - Efectivo)
- Column 10 (Donaciones Privadas - Cheque/ACH)  
- Column 11 (Donaciones Privadas - Especie)
- Column 12 (Recursos Propios - Efectivo/Cheque)
- Column 13 (Recursos Propios - Especie)

Extract EVERY ROW from these tables (not just totals). Return a JSON object:
{
  "ingress": [...],  // One object per row in INFORME DE INGRESOS
  "egress": [...]    // One object per row in INFORME DE EGRESOS
}

The "INFORME DE GASTOS" / "INFORME DE EGRESOS" table (Formulario Pre-18) has these columns in order (left to right):
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
  
Here's the full JSON schema for the response:
${JSON.stringify(jsonSchema)}`;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/matixlol/monitoreo-panama",
        "X-Title": "Monitoreo Panama",
      },
      body: JSON.stringify({
        model: MODEL,
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error: API request failed with status ${response.status}`);
      console.error(errorText);
      process.exit(1);
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      console.error("Error: No response from API");
      console.error(JSON.stringify(data, null, 2));
      process.exit(1);
    }

    let content = data.choices[0].message.content.trim();
    if (content.startsWith("```json")) content = content.substring(7).trim();
    if (content.endsWith("```"))
      content = content.substring(0, content.length - 3).trim();

    console.log("Content:", content);
    const result = ResponseSchema.parse(JSON.parse(content));

    // Output the result
    console.log("\n=== EXTRACTED DATA ===\n");
    console.log(JSON.stringify(result, null, 2));

    // Also save to files
    if (result.ingress && Array.isArray(result.ingress)) {
      await Bun.write("ingress.json", JSON.stringify(result.ingress, null, 2));
      console.log(
        `\n✓ Saved ${result.ingress.length} ingress records to ingress.json`
      );
    }

    if (result.egress && Array.isArray(result.egress)) {
      await Bun.write("egress.json", JSON.stringify(result.egress, null, 2));
      console.log(
        `\n✓ Saved ${result.egress.length} egress records to egress.json`
      );
    }

    console.log("\n=== SUMMARY ===");
    console.log(`Ingress records: ${result.ingress?.length || 0}`);
    console.log(`Egress records: ${result.egress?.length || 0}`);
  } catch (error) {
    console.error("Error processing PDF:", error);
    process.exit(1);
  }
}

// Main execution
const pdfPath = process.argv[2];

if (!pdfPath) {
  console.error("Usage: bun run process-pdf.ts <path-to-pdf>");
  console.error("Example: bun run process-pdf.ts document.pdf");
  process.exit(1);
}

await processPDF(pdfPath);
