import { readFile } from "fs/promises";
import { existsSync } from "fs";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash"; // "amazon/nova-2-lite-v1";

if (!OPENROUTER_API_KEY) {
  console.error("Error: OPENROUTER_API_KEY environment variable is not set");
  process.exit(1);
}

async function encodePDFToBase64(pdfPath: string): Promise<string> {
  const pdfBuffer = await readFile(pdfPath);
  const base64PDF = pdfBuffer.toString("base64");
  return `data:application/pdf;base64,${base64PDF}`;
}

async function processPDF(pdfPath: string): Promise<void> {
  if (!existsSync(pdfPath)) {
    console.error(`Error: PDF file not found: ${pdfPath}`);
    process.exit(1);
  }

  console.log(`Reading PDF: ${pdfPath}`);
  const base64PDF = await encodePDFToBase64(pdfPath);
  const filename = pdfPath.split("/").pop() || "document.pdf";

  console.log("Sending PDF to OpenRouter...");

  const prompt = `This PDF contains financial reports from Panama's Electoral Tribunal (Tribunal Electoral).

IMPORTANT: Look for tables titled "INFORME DE INGRESOS" (income report) and "INFORME DE EGRESOS" (expense report). These tables contain MULTIPLE ROWS - extract EACH ROW as a separate record. Do NOT just extract summary totals.

The "INFORME DE INGRESOS" table has these EXACT columns in order (left to right):
1. Fecha (date)
2. Recibo No. (receipt number)  
3. Nombre del Contribuyente (contributor name)
4. Representante Legal
5. Cédula/RUC (document number/ID)
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

Most rows will have the amount in only ONE of these columns. Set the Medium.name based on which column has the value:
- If amount is in column 9: Medium.name = "Efectivo"
- If amount is in column 10: Medium.name = "Cheque/ACH"
- If amount is in column 11: Medium.name = "Especie" (Donaciones Privadas)
- If amount is in column 12: Medium.name = "Efectivo/Cheque" (Recursos Propios)
- If amount is in column 13: Medium.name = "Especie" (Recursos Propios)

Also set Subject.name based on whether the amount is in Donaciones Privadas columns (9-11) or Recursos Propios columns (12-13).

Extract EVERY ROW from these tables (not just totals). Return a JSON object:
{
  "ingress": [...],  // One object per row in INFORME DE INGRESOS
  "egress": [...]    // One object per row in INFORME DE EGRESOS
}

Each record should have this structure:
{
  "id": "ing-001" or "eg-001" (sequential),
  "dateSearch": "DD/MM/YYYY" (from Fecha column),
  "date": "YYYY-MM-DDTHH:mm:ss.sssZ" (ISO format of the date),
  "receiptNumber": "from Recibo No. or Factura No. column",
  "amount": number (the TOTAL column value for that row),
  "documentNumber": "from Cédula/RUC column",
  "name": "from Nombre del Contribuyente or Proveedor column",
  "checkNumber": null,
  "bankAccount": null,
  "details": "description if available",
  "type": "ingress" or "egress",
  "phone": "from Teléfono column if available",
  "address": "from Dirección column if available",
  "email": "from Correo Electrónico column if available",
  "donacionesPrivadasEfectivo": number or null (from column 9),
  "donacionesPrivadasChequeAch": number or null (from column 10),
  "donacionesPrivadasEspecie": number or null (from column 11),
  "recursosPropiosEfectivoCheque": number or null (from column 12),
  "recursosPropiosEspecie": number or null (from column 13),
  "Medium": {
    "name": "Efectivo" or "Cheque/ACH" or "Especie" or "Efectivo/Cheque" (based on which column has the amount),
    "isBankAccount": true if Cheque/ACH,
    "isCheck": false
  },
  "Subject": {
    "name": "Donación Privada" (if columns 9-11) or "Recursos Propios" (if columns 12-13),
    "type": "ingress" or "egress",
    "isDonation": true if Donación Privada
  }
}

Return ONLY valid JSON, no additional text or markdown formatting.`;

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
          {
            id: "file-parser",
            pdf: {
              engine: "native",
            },
          },
        ],
        temperature: 0.1,
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

    const content = data.choices[0].message.content;

    // Try to extract JSON from the response
    let jsonContent = content.trim();

    // Remove markdown code blocks if present
    if (jsonContent.startsWith("```")) {
      const lines = jsonContent.split("\n");
      const firstLine = lines[0];
      const lastLine = lines[lines.length - 1];

      if (firstLine.includes("json") && lastLine.trim() === "```") {
        jsonContent = lines.slice(1, -1).join("\n");
      } else if (lastLine.trim() === "```") {
        jsonContent = lines.slice(1, -1).join("\n");
      }
    }

    // Parse the JSON
    let result;
    try {
      result = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error("Error: Failed to parse JSON response");
      console.error("Response content:", content);
      process.exit(1);
    }

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

processPDF(pdfPath).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
