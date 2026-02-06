import { readFile, writeFile } from 'fs/promises';
import * as mupdf from 'mupdf';
import { extractSinglePage, EXTRACTION_PROMPT } from '../pdf-extraction';

const [pdfPath, pageNumberStr] = Bun.argv.slice(2);

if (!pdfPath || !pageNumberStr) {
  console.error('Usage: bun scripts/test-extraction.ts <pdf-path> <page-number>');
  process.exit(1);
}

const pageNumber = parseInt(pageNumberStr, 10);
const pdfBytes = await readFile(pdfPath);
const pageBytes = await extractSinglePage(pdfBytes.buffer, pageNumber);

const doc = mupdf.Document.openDocument(pageBytes, 'application/pdf');
const page = doc.loadPage(0);
const scale = 2;
const pixmap = page.toPixmap([scale, 0, 0, scale, 0, 0], mupdf.ColorSpace.DeviceRGB, false, true);
const pngBytes = pixmap.asPNG();
const pngBase64 = Buffer.from(pngBytes).toString('base64');

const SIMPLE_PROMPT = `${EXTRACTION_PROMPT}

Respond with a JSON object: {"ingress": [...rows], "egress": [...rows]}
Each ingress row: {fecha, reciboNumero, contribuyenteNombre, representanteLegal, cedulaRuc, direccion, telefono, correoElectronico, donacionesPrivadasEfectivo, donacionesPrivadasChequeAch, donacionesPrivadasEspecie, recursosPropiosEfectivoCheque, recursosPropiosEspecie, total, unreadableFields}
Each egress row: {fecha, numeroFacturaRecibo, cedulaRuc, proveedorNombre, detalleGasto, pagoTipo, movilizacion, combustible, hospedaje, activistas, caravanaConcentraciones, comidaBrindis, alquilerLocalServiciosBasicos, cargosBancarios, totalGastosCampania, personalizacionArticulosPromocionales, propagandaElectoral, totalGastosPropaganda, totalDeGastosDePropagandaYCampania, unreadableFields}
All monetary fields must be numbers (not strings). Use null for empty cells. Return ONLY valid JSON, no markdown fences.`;

function coerceNumbers(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(coerceNumbers);
  if (typeof obj === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = coerceNumbers(v);
    }
    return out;
  }
  if (typeof obj === 'string') {
    const cleaned = obj.replace(/[,$\s]/g, '');
    if (/^-?\d+(\.\d+)?$/.test(cleaned)) return Number(cleaned);
  }
  return obj;
}

const models = [
  'bytedance-seed/seed-1.6',
  'qwen/qwen3-vl-30b-a3b-instruct',
  'nvidia/nemotron-nano-12b-v2-vl',
];
const apiKey = process.env.OPENROUTER_API_KEY!;

async function runModel(modelId: string) {
  console.log(`[${modelId}] Starting extraction of page ${pageNumber}...`);
  const start = Date.now();

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: SIMPLE_PROMPT },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${pngBase64}` },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`[${modelId}] API error: ${response.status} - ${error}`);
  }

  const result = (await response.json()) as any;
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error(`[${modelId}] No content in response`);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  let jsonStr = content.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();

  const parsed = coerceNumbers(JSON.parse(jsonStr));
  const ingress = parsed.ingress?.length ?? 0;
  const egress = parsed.egress?.length ?? 0;
  console.log(`[${modelId}] Done in ${elapsed}s — ${ingress} ingress, ${egress} egress`);

  const slug = modelId.replace('/', '_');
  const outPath = `extraction-${slug}-p${pageNumber}.json`;
  await writeFile(outPath, JSON.stringify(parsed, null, 2));
  console.log(`[${modelId}] Saved to ${outPath}`);
  return parsed;
}

const results = await Promise.allSettled(models.map(runModel));
for (const [i, r] of results.entries()) {
  if (r.status === 'rejected') {
    console.error(`[${models[i]}] FAILED:`, r.reason);
  }
}
