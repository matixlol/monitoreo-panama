import { readFile } from 'fs/promises';
import { PDFDocument } from 'pdf-lib';
import {
  callGeminiDirect,
  ResponseSchema,
  RESPONSE_JSON_SCHEMA,
  EXTRACTION_PROMPT,
  MODEL,
  type MediaResolution,
} from '/Users/user/dev/monitoreo-panama/pdf-extraction.ts';

const pdfPath = 'all-pdfs/13-5-2024-1715633566521-Jose Gabriel Carrizo Jaen Candidato PRD Presidente JM.pdf';
const pageNumber = 11;
const headerPageNumber = 10;
const runsPerBatch = 5;
const extraRunsIfAllCorrect = 5;

const exampleBlock = `"INFORME DE INGRESOS" example (headers missing but columns are fixed):\nIf the row has one amount aligned under "Donaciones Privadas - Cheque/ACH" and "Donaciones Privadas - Efectivo" is empty, return:\ndonacionesPrivadasEfectivo: null, donacionesPrivadasChequeAch: 400\n\n`;

const shortPrompt = EXTRACTION_PROMPT.replace(exampleBlock, '').replace(/\n{3,}/g, '\n\n');

const strongColumnPrompt = `${shortPrompt}\n\n<column_alignment>\nWhen headers are missing, treat the monetary columns as fixed slots 9-14.\nNever shift amounts left into earlier monetary columns.\nIf the only visible amount in a row is aligned under Cheque/ACH, then Efectivo must be null.\nIf alignment is ambiguous, set all monetary fields null and list them in unreadableFields.\n</column_alignment>`;

const variants = [
  {
    name: 'baseline-current-prompt',
    prompt: EXTRACTION_PROMPT,
    mediaResolution: 'MEDIA_RESOLUTION_HIGH' as MediaResolution,
    pages: [pageNumber],
  },
  {
    name: 'short-prompt',
    prompt: shortPrompt,
    mediaResolution: 'MEDIA_RESOLUTION_HIGH' as MediaResolution,
    pages: [pageNumber],
  },
  {
    name: 'strong-column-prompt',
    prompt: strongColumnPrompt,
    mediaResolution: 'MEDIA_RESOLUTION_HIGH' as MediaResolution,
    pages: [pageNumber],
  },
  {
    name: 'baseline-prompt-with-header-page',
    prompt: EXTRACTION_PROMPT,
    mediaResolution: 'MEDIA_RESOLUTION_HIGH' as MediaResolution,
    pages: [headerPageNumber, pageNumber],
  },
  {
    name: 'short-prompt-with-header-page',
    prompt: shortPrompt,
    mediaResolution: 'MEDIA_RESOLUTION_HIGH' as MediaResolution,
    pages: [headerPageNumber, pageNumber],
  },
  {
    name: 'baseline-ultra-resolution',
    prompt: EXTRACTION_PROMPT,
    mediaResolution: 'MEDIA_RESOLUTION_ULTRA_HIGH' as MediaResolution,
    pages: [pageNumber],
  },
];

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
  if (correctCount > 0 && unknownCount > 0) return 'unknown';
  return 'unknown';
}

async function buildPdfWithPages(pdfBytes: ArrayBuffer, pages: number[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const out = await PDFDocument.create();
  const copiedPages = await out.copyPages(
    pdfDoc,
    pages.map((p) => p - 1),
  );
  for (const page of copiedPages) out.addPage(page);
  return out.save();
}

async function runVariant(variant: (typeof variants)[number]) {
  const pdfBytes = await readFile(pdfPath);
  const pageBytes = await buildPdfWithPages(pdfBytes.buffer, variant.pages);
  const pdfBase64 = Buffer.from(pageBytes).toString('base64');

  const runOnce = async () => {
    const { parsed } = await callGeminiDirect(pdfBase64, process.env.GEMINI_API_KEY!, {
      prompt: variant.prompt,
      schema: ResponseSchema,
      jsonSchema: RESPONSE_JSON_SCHEMA,
      mediaResolution: variant.mediaResolution,
    });
    return parsed;
  };

  const runBatch = async (count: number) => {
    const results = await Promise.allSettled(Array.from({ length: count }, () => runOnce()));
    const classifications = results.map((r) =>
      r.status === 'fulfilled' ? classifyRun(r.value) : 'unknown',
    );
    const correct = classifications.filter((c) => c === 'correct').length;
    const incorrect = classifications.filter((c) => c === 'incorrect').length;
    const unknown = classifications.filter((c) => c === 'unknown').length;
    return { results, classifications, correct, incorrect, unknown };
  };

  console.log(`\n=== ${variant.name} (${variant.pages.join('+')}, ${variant.mediaResolution}) ===`);
  const firstBatch = await runBatch(runsPerBatch);
  console.log(
    `Batch 1: correct=${firstBatch.correct}, incorrect=${firstBatch.incorrect}, unknown=${firstBatch.unknown}`,
  );

  if (firstBatch.correct === runsPerBatch && firstBatch.incorrect === 0) {
    const secondBatch = await runBatch(extraRunsIfAllCorrect);
    console.log(
      `Batch 2: correct=${secondBatch.correct}, incorrect=${secondBatch.incorrect}, unknown=${secondBatch.unknown}`,
    );
  }
}

for (const variant of variants) {
  await runVariant(variant);
}

console.log(`\nDone. Model: ${MODEL.id}`);
