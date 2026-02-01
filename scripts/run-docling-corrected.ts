import { readFile } from 'fs/promises';
import {
  callGeminiDirect,
  ResponseSchema,
  RESPONSE_JSON_SCHEMA,
  EXTRACTION_PROMPT,
  MODEL,
  type MediaResolution,
} from '../pdf-extraction';

const pdfPath = 'page.pdf';
const doclingJsonPath = '.tmp/docling/page.json';
const runs = 5;

function parseMoney(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.,-]/g, '').replace(/,/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function buildDoclingMoneyMap(doc: any) {
  const grid = doc?.tables?.[0]?.data?.grid || [];
  const map = new Map<string, { efectivo: number | null; cheque: number | null }>();

  for (const row of grid) {
    if (!row?.length) continue;
    const receipt = (row[1]?.text || '').trim();
    if (!receipt) continue;
    const efectivo = parseMoney(row[8]?.text);
    const cheque = parseMoney(row[9]?.text);
    if (efectivo == null && cheque == null) continue;
    map.set(receipt, { efectivo, cheque });
  }

  return map;
}

function classifyRun(parsed: any): 'correct' | 'incorrect' | 'unknown' {
  const targetReceipts = new Set(['758', '759', '751', '760', '761', '762', '763', '764', '765']);
  const rows = Array.isArray(parsed.ingress) ? parsed.ingress : [];
  let sawTarget = false;
  let incorrect = false;
  let correctCount = 0;
  let unknownCount = 0;

  for (const row of rows) {
    if (!row || !targetReceipts.has(String(row.reciboNumero ?? ''))) continue;
    sawTarget = true;
    const efectivo = row.donacionesPrivadasEfectivo ?? null;
    const cheque = row.donacionesPrivadasChequeAch ?? null;

    if (efectivo != null && cheque == null) {
      incorrect = true;
    } else if (cheque != null && efectivo == null) {
      correctCount++;
    } else {
      unknownCount++;
    }
  }

  if (!sawTarget) return 'unknown';
  if (incorrect) return 'incorrect';
  if (correctCount > 0 && unknownCount === 0) return 'correct';
  return 'unknown';
}

const doclingJson = JSON.parse(await readFile(doclingJsonPath, 'utf8'));
const moneyMap = buildDoclingMoneyMap(doclingJson);

const pdfBytes = await readFile(pdfPath);
const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

console.log(`[${MODEL.id}] Docling-corrected extraction, runs=${runs}`);

const results = await Promise.allSettled(
  Array.from({ length: runs }, () =>
    callGeminiDirect(pdfBase64, process.env.GEMINI_API_KEY!, {
      prompt: EXTRACTION_PROMPT,
      schema: ResponseSchema,
      jsonSchema: RESPONSE_JSON_SCHEMA,
      mediaResolution: 'MEDIA_RESOLUTION_HIGH' as MediaResolution,
    }).then((r) => {
      const parsed = r.parsed;
      for (const row of parsed.ingress) {
        const receipt = String(row.reciboNumero ?? '');
        const hint = moneyMap.get(receipt);
        if (!hint) continue;
        if (hint.efectivo != null && hint.cheque == null) {
          row.donacionesPrivadasEfectivo = hint.efectivo;
          row.donacionesPrivadasChequeAch = null;
        } else if (hint.cheque != null && hint.efectivo == null) {
          row.donacionesPrivadasChequeAch = hint.cheque;
          row.donacionesPrivadasEfectivo = null;
        } else if (hint.cheque != null && hint.efectivo != null) {
          row.donacionesPrivadasChequeAch = hint.cheque;
          row.donacionesPrivadasEfectivo = hint.efectivo;
        }
      }
      return parsed;
    }),
  ),
);

const classifications = results.map((r) => (r.status === 'fulfilled' ? classifyRun(r.value) : 'unknown'));
const correct = classifications.filter((c) => c === 'correct').length;
const incorrect = classifications.filter((c) => c === 'incorrect').length;
const unknown = classifications.filter((c) => c === 'unknown').length;

console.log(`Docling-corrected batch: correct=${correct}, incorrect=${incorrect}, unknown=${unknown}`);
