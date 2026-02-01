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

function summarizeDocling(doc: any): { columns: string; excerpt: string } {
  const table = doc?.tables?.[0];
  const cells = table?.data?.table_cells || [];
  const numCols = table?.data?.num_cols || 0;

  const colBounds = Array.from({ length: numCols }, () => ({ l: Infinity, r: -Infinity }));
  for (const cell of cells) {
    if (!cell || cell.col_span !== 1) continue;
    const col = cell.start_col_offset_idx;
    if (col == null || col < 0 || col >= numCols) continue;
    colBounds[col].l = Math.min(colBounds[col].l, cell.bbox?.l ?? colBounds[col].l);
    colBounds[col].r = Math.max(colBounds[col].r, cell.bbox?.r ?? colBounds[col].r);
  }

  const columns = colBounds
    .map((b, i) => `col${i + 1}: ${Number.isFinite(b.l) ? b.l.toFixed(2) : 'n/a'}-${
      Number.isFinite(b.r) ? b.r.toFixed(2) : 'n/a'
    }`)
    .join(', ');

  // Build a small excerpt of the markdown table for alignment hints (first 12 rows)
  const rowsByRow: Record<number, string[]> = {};
  for (const cell of cells) {
    if (!cell || cell.col_span !== 1 || cell.row_span !== 1) continue;
    const r = cell.start_row_offset_idx ?? 0;
    const c = cell.start_col_offset_idx ?? 0;
    if (!rowsByRow[r]) rowsByRow[r] = [];
    rowsByRow[r][c] = cell.text ?? '';
  }

  const rowIndices = Object.keys(rowsByRow)
    .map((n) => parseInt(n, 10))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b)
    .slice(0, 12);

  const excerptRows = rowIndices.map((r) =>
    (rowsByRow[r] || []).map((v) => (v ?? '').replace(/\s+/g, ' ').trim()).join(' | '),
  );

  const excerpt = excerptRows.join('\n');
  return { columns, excerpt };
}

const doclingJson = JSON.parse(await readFile(doclingJsonPath, 'utf8'));
const { columns, excerpt } = summarizeDocling(doclingJson);

const doclingHint = `\n\n<docling_alignment_hint>\nDocling extracted a table from this page. Use it ONLY to align columns and detect empty cells.\nDo NOT copy its text as ground truth if the PDF shows something else.\nDocling column x-ranges (coord_origin TOPLEFT): ${columns}\nDocling table excerpt (rows in order, pipe-separated):\n${excerpt}\n</docling_alignment_hint>`;

const prompt = `${EXTRACTION_PROMPT}${doclingHint}`;

const pdfBytes = await readFile(pdfPath);
const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

console.log(`[${MODEL.id}] Docling-assisted extraction, runs=${runs}`);

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

console.log(`Docling-assisted batch: correct=${correct}, incorrect=${incorrect}, unknown=${unknown}`);
