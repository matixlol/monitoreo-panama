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

const json = await readFile(doclingJsonPath, 'utf8');
const doclingSummary = json.length > 20000 ? json.slice(0, 20000) + '\n...[truncated]' : json;

const doclingHint = `\n\n<docling_alignment_hint>\nDocling JSON for this page (truncated if large). Use ONLY to infer column alignment and empty cells; do not copy values as truth if the PDF contradicts it.\n${doclingSummary}\n</docling_alignment_hint>`;

const prompt = `${EXTRACTION_PROMPT}${doclingHint}`;

const pdfBytes = await readFile(pdfPath);
const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

console.log(`[${MODEL.id}] Docling-JSON-fuller extraction, runs=${runs}`);

const results = await Promise.allSettled(
  Array.from({ length: runs }, () =>
    callGeminiDirect(pdfBase64, process.env.GEMINI_API_KEY!, {
      prompt,
      schema: ResponseSchema,
      jsonSchema: RESPONSE_JSON_SCHEMA,
      mediaResolution: 'MEDIA_RESOLUTION_HIGH' as MediaResolution,
    }).then((r) => r.parsed),
  ),
);

const classifications = results.map((r) => (r.status === 'fulfilled' ? classifyRun(r.value) : 'unknown'));
const correct = classifications.filter((c) => c === 'correct').length;
const incorrect = classifications.filter((c) => c === 'incorrect').length;
const unknown = classifications.filter((c) => c === 'unknown').length;

console.log(`Docling-JSON-fuller batch: correct=${correct}, incorrect=${incorrect}, unknown=${unknown}`);

if (correct === runs && incorrect === 0) {
  console.log('All correct in batch 1; running 5 more...');
  const results2 = await Promise.allSettled(
    Array.from({ length: runs }, () =>
      callGeminiDirect(pdfBase64, process.env.GEMINI_API_KEY!, {
        prompt,
        schema: ResponseSchema,
        jsonSchema: RESPONSE_JSON_SCHEMA,
        mediaResolution: 'MEDIA_RESOLUTION_HIGH' as MediaResolution,
      }).then((r) => r.parsed),
    ),
  );
  const classifications2 = results2.map((r) => (r.status === 'fulfilled' ? classifyRun(r.value) : 'unknown'));
  const correct2 = classifications2.filter((c) => c === 'correct').length;
  const incorrect2 = classifications2.filter((c) => c === 'incorrect').length;
  const unknown2 = classifications2.filter((c) => c === 'unknown').length;
  console.log(`Docling-JSON-fuller batch 2: correct=${correct2}, incorrect=${incorrect2}, unknown=${unknown2}`);
}
